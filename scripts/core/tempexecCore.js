(function() {
  function init(deps) {
    var setStatus = deps && deps.setStatus ? deps.setStatus : function() {};
    var normalizeRequirementName = deps && deps.normalizeRequirementName ? deps.normalizeRequirementName : function(text) { return text || ''; };
    var getRequirementLabel = deps && deps.getRequirementLabel ? deps.getRequirementLabel : function() { return ''; };
    var generateTempExecId = deps && deps.generateTempExecId
      ? deps.generateTempExecId
      : function() {
        return 'tempexec-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
      };
    var generateTempVersionId = deps && deps.generateTempVersionId
      ? deps.generateTempVersionId
      : function() {
        return 'tempver-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
      };
    var reuseDetailSeed = 0;
    var generateReusePresetId = deps && deps.generateReusePresetId ? deps.generateReusePresetId : function() { return 'reuse-' + Date.now(); };
    var generateReuseDetailId = deps && deps.generateReuseDetailId
      ? deps.generateReuseDetailId
      : function() {
        reuseDetailSeed += 1;
        return 'reuse-detail-' + Date.now().toString(16) + '-' + reuseDetailSeed.toString(16) + '-' + Math.random().toString(16).slice(2, 6);
      };
    var generateDefectLinkId = deps && deps.generateDefectLinkId ? deps.generateDefectLinkId : function() { return 'defect-' + Date.now(); };
    var normalizeTempExecName = deps && deps.normalizeTempExecName ? deps.normalizeTempExecName : function(name) {
      return (name || '').trim().toLowerCase();
    };
    var stringifyCaseField = deps && deps.stringifyCaseField ? deps.stringifyCaseField : function(val) { return (val || '').toString(); };
    var buildMissingReminderKeywords = deps && deps.buildMissingReminderKeywords
      ? deps.buildMissingReminderKeywords
      : function() { return []; };
    var normalizeMissingReminderMatchConfig = deps && deps.normalizeMissingReminderMatchConfig
      ? deps.normalizeMissingReminderMatchConfig
      : function(value, fallback) {
          var base = fallback && typeof fallback === 'object' ? fallback : { type: true, module: true };
          var raw = value && typeof value === 'object' ? value : {};
          var typeFlag = raw.type === true ? true : raw.type === false ? false : base.type !== false;
          var moduleFlag = raw.module === true ? true : raw.module === false ? false : base.module !== false;
          if (!typeFlag && !moduleFlag) {
            typeFlag = base.type !== false;
            moduleFlag = base.module !== false;
            if (!typeFlag && !moduleFlag) typeFlag = true;
          }
          return { type: typeFlag, module: moduleFlag };
        };
    var callModelWithConfig = deps && deps.callModelWithConfig
      ? deps.callModelWithConfig
      : function() { return Promise.reject(new Error('模型客户端不可用')); };
    var getAssignedModel = deps && deps.getAssignedModel
      ? deps.getAssignedModel
      : function() { throw new Error('未配置模型'); };
    var defaultTempExecColumns = deps && deps.defaultTempExecColumns ? deps.defaultTempExecColumns : {};
    var defaultPlacement = deps && deps.defaultPlacement
      ? deps.defaultPlacement
      : {
        requirementOrder: [],
        fileOrder: {},
        versionOrder: [],
        projectOrder: [],
        versionOrderByProject: {},
        fileOrderByProjectVersion: {},
      };
    var state = deps && deps.state ? deps.state : {};
    var tempExecStorageKey = deps && deps.tempExecStorageKey ? deps.tempExecStorageKey : 'usecase-temp-exec-v1';
    var tempExecFocusStorageKey = deps && deps.tempExecFocusStorageKey ? deps.tempExecFocusStorageKey : 'tempexec-focus-v1';
    var tempExecPageSizeStorageKey = deps && deps.tempExecPageSizeStorageKey ? deps.tempExecPageSizeStorageKey : 'tempexec-page-size';
    var modelsStorageKey = deps && deps.modelsKey ? deps.modelsKey : 'cleaner-models-v1';
    var assignmentStorageKey = deps && deps.assignmentKey ? deps.assignmentKey : 'cleaner-assignment-v1';
    var defaultTempExecPageSize = deps && deps.defaultTempExecPageSize ? deps.defaultTempExecPageSize : 20;
    var caseViewBaseFontSize = deps && Number.isFinite(deps.caseViewBaseFontSize) ? deps.caseViewBaseFontSize : 13;
    var tempExecStatus = deps && deps.dom && deps.dom.tempExecStatus ? deps.dom.tempExecStatus : null;
    var tempVersionGrid = deps && deps.dom && deps.dom.tempVersionGrid ? deps.dom.tempVersionGrid : null;
    var tempExecNav = deps && deps.dom && deps.dom.tempExecNav ? deps.dom.tempExecNav : null;
    var tempFocusZone = deps && deps.dom && deps.dom.tempFocusZone ? deps.dom.tempFocusZone : null;
    var tempExecViewFocusZone = deps && deps.dom && deps.dom.tempExecViewFocusZone ? deps.dom.tempExecViewFocusZone : null;
    var tempExecOverview = deps && deps.dom && deps.dom.tempExecOverview ? deps.dom.tempExecOverview : null;
    var tempExecView = deps && deps.dom && deps.dom.tempExecView ? deps.dom.tempExecView : null;
    var tempExecToolbar = deps && deps.dom && deps.dom.tempExecToolbar ? deps.dom.tempExecToolbar : null;
    var tempExecToolbarCard = deps && deps.dom && deps.dom.tempExecToolbarCard ? deps.dom.tempExecToolbarCard : null;
    var tempReqToggleBtn = deps && deps.dom && deps.dom.toggleTempReq ? deps.dom.toggleTempReq : null;
    var tempVersionToggleBtn = deps && deps.dom && deps.dom.toggleTempVersion ? deps.dom.toggleTempVersion : null;
    var createTempVersionBtn = deps && deps.dom && deps.dom.createTempVersionBtn ? deps.dom.createTempVersionBtn : null;
    var tempExecViewSection = deps && deps.dom && deps.dom.tempExecViewSection ? deps.dom.tempExecViewSection : null;
    var tempExecMindContainer = deps && deps.dom && deps.dom.tempExecMindContainer ? deps.dom.tempExecMindContainer : null;
    var tempExecMindBtn = deps && deps.dom && deps.dom.tempExecMindBtn ? deps.dom.tempExecMindBtn : null;
    var exportTempExecBtn = deps && deps.dom && deps.dom.exportTempExecBtn ? deps.dom.exportTempExecBtn : null;
    var exportTempExecConfigBtn = deps && deps.dom && deps.dom.exportTempExecConfigBtn ? deps.dom.exportTempExecConfigBtn : null;
    var exportTempExecXmindBtn = deps && deps.dom && deps.dom.exportTempExecXmindBtn ? deps.dom.exportTempExecXmindBtn : null;
    var exportTempExecCasesXmindBtn = deps && deps.dom && deps.dom.exportTempExecCasesXmindBtn ? deps.dom.exportTempExecCasesXmindBtn : null;
    var tempExecXmindViewBtn = deps && deps.dom && deps.dom.tempExecXmindViewBtn ? deps.dom.tempExecXmindViewBtn : null;
    var tempExecCaseLibraryChangesBtn = null;
    var tempExecAiGenBtn = null;
    try {
      if (typeof document !== 'undefined') {
        tempExecCaseLibraryChangesBtn = document.getElementById('tempExecCaseLibraryChangesBtn');
        tempExecAiGenBtn = document.getElementById('tempExecAiGenBtn');
      }
    } catch (err) {
      // ignore
    }
    var escapeHtml = deps && deps.escapeHtml ? deps.escapeHtml : function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var escapeHtmlPreserve = deps && deps.escapeHtmlPreserve ? deps.escapeHtmlPreserve : function(text) {
      return escapeHtml(text).replace(/\n/g, '<br>');
    };
    var saveTempExecFocus = function() {
      if (persistenceApi && typeof persistenceApi.saveTempExecFocus === 'function') {
        return persistenceApi.saveTempExecFocus();
      }
      if (deps && typeof deps.saveTempExecFocus === 'function') return deps.saveTempExecFocus();
      return undefined;
    };
    var ensureTempExecColumns = deps && deps.ensureTempExecColumns ? deps.ensureTempExecColumns : function() { return defaultTempExecColumns; };
    var persistSettings = deps && deps.persistSettings ? deps.persistSettings : function() {};
    var setRequirementLabel = deps && deps.setRequirementLabel ? deps.setRequirementLabel : function() {};
    var formatCompactTimestamp = deps && deps.formatCompactTimestamp
      ? deps.formatCompactTimestamp
      : function() {
        var pad = function(num) {
          return num < 10 ? '0' + num : String(num);
        };
        var now = new Date();
        return now.getFullYear().toString()
          + pad(now.getMonth() + 1)
          + pad(now.getDate())
          + '_' + pad(now.getHours())
          + pad(now.getMinutes())
          + pad(now.getSeconds());
      };
    var downloadText = deps && deps.downloadText ? deps.downloadText : function() {};
    var downloadBlob = deps && deps.downloadBlob ? deps.downloadBlob : function() {};
    var scrollElementIntoView = deps && deps.scrollElementIntoView ? deps.scrollElementIntoView : function() {};
    var openConfirmDrawer = deps && deps.openConfirmDrawer
      ? deps.openConfirmDrawer
      : function(options) {
        var msg = options && options.message ? String(options.message) : '';
        var ok = true;
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          ok = window.confirm(msg);
        }
        return Promise.resolve({ ok: ok });
      };
    var tempExecResultOptions = deps && deps.tempExecResultOptions ? deps.tempExecResultOptions : ['未执行', '通过', '失败', '阻塞', '不适用'];
    var reuseApplicabilityCore = deps && deps.reuseApplicabilityCore ? deps.reuseApplicabilityCore : null;
    var tempExecImportDuplicateControllerFactory = deps && deps.tempExecImportDuplicateControllerFactory
      ? deps.tempExecImportDuplicateControllerFactory
      : null;
    var tempExecCaseLibraryDiffControllerFactory = deps && deps.tempExecCaseLibraryDiffControllerFactory
      ? deps.tempExecCaseLibraryDiffControllerFactory
      : null;
    var deriveCaseListFromText = deps && deps.deriveCaseListFromText ? deps.deriveCaseListFromText : function() { return []; };
    var parseXmindFile = deps && deps.parseXmindFile ? deps.parseXmindFile : function() { return Promise.resolve({ text: '', list: [] }); };
    var parseXlsxFileToRows = deps && deps.parseXlsxFileToRows ? deps.parseXlsxFileToRows : null;
    var extractRequirementLabelFromText = deps && deps.extractRequirementLabelFromText ? deps.extractRequirementLabelFromText : function() { return ''; };
    var promptTempExecRequirement = deps && deps.promptTempExecRequirement
      ? deps.promptTempExecRequirement
      : function(fileName, fallbackLabel) {
        var base = normalizeRequirementName(fallbackLabel || '')
          || normalizeRequirementName(getRequirementLabel())
          || normalizeRequirementName((fileName || '').replace(/\.[^.]+$/, ''));
        var input = window.prompt('请输入需求标识', base);
        return input ? normalizeRequirementName(input) : '';
    };
    var ensureRequirementLabel = deps && deps.ensureRequirementLabel ? deps.ensureRequirementLabel : function() {
      return normalizeRequirementName(getRequirementLabel());
    };
    var buildTempExecXmindPackage = deps && deps.buildTempExecXmindPackage ? deps.buildTempExecXmindPackage : null;
    var buildXmindPackageFromCases = deps && deps.buildXmindPackageFromCases ? deps.buildXmindPackageFromCases : null;
    var buildMindDataFromCases = deps && deps.buildMindDataFromCases ? deps.buildMindDataFromCases : null;
    var stripTimestampSuffix = deps && deps.stripTimestampSuffix ? deps.stripTimestampSuffix : function(text) { return text || ''; };
    var getSafeFileBaseName = deps && deps.getSafeFileBaseName
      ? deps.getSafeFileBaseName
      : function(name, fallback) {
        var raw = typeof name === 'string' ? name : (name && name.toString ? name.toString() : '');
        var trimmed = raw.trim();
        var withoutExt = trimmed.replace(/\.[^.]+$/, '');
        var candidate = stripTimestampSuffix(withoutExt || trimmed) || withoutExt || trimmed || (fallback || '');
        if (!candidate) candidate = 'temp_exec';
        var safe = candidate.replace(/[\\/:*?"<>|]/g, '_');
        return safe || 'temp_exec';
      };
    var ensureTempExecReplacement = deps && deps.ensureTempExecReplacement
      ? function(entry, pendingList) { return deps.ensureTempExecReplacement(entry, pendingList || []); }
      : function(entry, pendingList) {
        var normalized = normalizeTempExecName(entry && entry.name);
        var duplicates = state.tempExecFiles.filter(function(file) {
          return normalizeTempExecName(file && file.name) === normalized;
        });
        var pendingDuplicates = (pendingList || []).filter(function(item) {
          return normalizeTempExecName(item && item.name) === normalized;
        });
        if (duplicates.length || pendingDuplicates.length) {
          var confirmMsg = '检测到名称为【' + (entry && entry.name ? entry.name : '') + '】的用例已存在，替换将清除原有执行结果，是否继续？';
          if (!window.confirm(confirmMsg)) return false;
          duplicates.forEach(function(file) { removeTempExecFile(file && file.id); });
          pendingDuplicates.forEach(function(item) {
            var idx = pendingList.indexOf(item);
            if (idx !== -1) pendingList.splice(idx, 1);
          });
        }
        return true;
      };
    var persistenceApi = null;
    var caseLibrarySyncApi = null;
    var caseLibraryDiffApi = null;
    var caseMutationApi = null;
    var workspaceMutationApi = null;
    var fileWorkflowApi = null;
    var importParserApi = null;
    var dbImportApi = null;
    var persistTempExecStatePort = function() {
      return typeof persistTempExecState === 'function'
        ? persistTempExecState()
        : undefined;
    };
    var getApiClient = function() {
      return persistenceApi && typeof persistenceApi.getApiClient === 'function'
        ? persistenceApi.getApiClient()
        : null;
    };

    var appUtils = null;
    try {
      if (typeof window !== 'undefined') {
        appUtils = window.app && window.app.utils ? window.app.utils : null;
      }
    } catch (err) {
      appUtils = null;
    }

    var isDbMode = function() {
      return persistenceApi && typeof persistenceApi.isDbMode === 'function'
        ? persistenceApi.isDbMode()
        : false;
    };

    function syncTempExecCaseLibraryChangesButton(file) {
      return caseLibraryDiffApi
        ? caseLibraryDiffApi.syncTempExecCaseLibraryChangesButton(file)
        : undefined;
    }
    function renderTempExecCaseLibraryDiffCaseTabs(execSetId) {
      return caseLibraryDiffApi
        ? caseLibraryDiffApi.renderTempExecCaseLibraryDiffCaseTabs(execSetId)
        : undefined;
    }
    function openTempExecCaseLibraryDiffDrawer(options) {
      return caseLibraryDiffApi
        ? caseLibraryDiffApi.openTempExecCaseLibraryDiffDrawer(options)
        : false;
    }
    function tryAutoOpenTempExecCaseLibraryDiff() {
      return caseLibraryDiffApi
        ? caseLibraryDiffApi.tryAutoOpenTempExecCaseLibraryDiff()
        : false;
    }

    function mountTempExecToolbarButtons() {
      if (!tempExecToolbar) return;
      var stash = document.getElementById('tempExecToolbarStash');
      var aiSlot = tempExecToolbar.querySelector('#tempExecAiGenSlot');
      var xmindSlot = tempExecToolbar.querySelector('#tempExecXmindSlot');
      var changeSlot = tempExecToolbar.querySelector('#tempExecCaseLibraryChangeSlot');
      var exportSlot = tempExecToolbar.querySelector('#tempExecExportSlot');
      if (tempExecAiGenBtn && aiSlot && tempExecAiGenBtn.parentNode !== aiSlot) {
        aiSlot.appendChild(tempExecAiGenBtn);
      }
      if (tempExecXmindViewBtn) {
        var targetSlot = xmindSlot || exportSlot;
        if (targetSlot && tempExecXmindViewBtn.parentNode !== targetSlot) {
          targetSlot.appendChild(tempExecXmindViewBtn);
        }
      }
      if (tempExecCaseLibraryChangesBtn && changeSlot && tempExecCaseLibraryChangesBtn.parentNode !== changeSlot) {
        changeSlot.appendChild(tempExecCaseLibraryChangesBtn);
      }
      if (exportSlot) {
        if (exportTempExecXmindBtn && exportTempExecXmindBtn.parentNode !== exportSlot) {
          exportSlot.appendChild(exportTempExecXmindBtn);
        }
        if (exportTempExecCasesXmindBtn && exportTempExecCasesXmindBtn.parentNode !== exportSlot) {
          exportSlot.appendChild(exportTempExecCasesXmindBtn);
        }
      }
      if (stash && stash.classList.contains('hidden')) {
        // keep stash hidden
      }
    }

    function stashTempExecToolbarButtons() {
      var stash = document.getElementById('tempExecToolbarStash');
      if (!stash) return;
      var items = [tempExecAiGenBtn, tempExecCaseLibraryChangesBtn, tempExecXmindViewBtn, exportTempExecXmindBtn, exportTempExecCasesXmindBtn];
      items.forEach(function(btn) {
        if (!btn) return;
        if (btn.parentNode !== stash) stash.appendChild(btn);
      });
    }

    var queueExecCasePatch = function(execCaseId, patch, options) {
      return persistenceApi.queueExecCasePatch(execCaseId, patch, options);
    };
    var queueExecCasePatchForItem = function(item, patch) {
      return persistenceApi.queueExecCasePatchForItem(item, patch);
    };
    var consumePendingExecCasePatch = function(tempId) {
      return persistenceApi.consumePendingExecCasePatch(tempId);
    };
    var clearPendingExecCasePatch = function(tempId) {
      return persistenceApi.clearPendingExecCasePatch(tempId);
    };
    var queueExecSetPatch = function(execSetId, patch) {
      return persistenceApi.queueExecSetPatch(execSetId, patch);
    };
    var scheduleTempExecUiSave = function() {
      return persistenceApi.scheduleTempExecUiSave();
    };
    function captureTempExecAnchorRect(anchorEl) {
      return caseMutationApi && typeof caseMutationApi.captureTempExecAnchorRect === 'function'
        ? caseMutationApi.captureTempExecAnchorRect(anchorEl)
        : null;
    }
    function showTempExecBlockHint(anchorRect, message) {
      return caseMutationApi && typeof caseMutationApi.showTempExecBlockHint === 'function'
        ? caseMutationApi.showTempExecBlockHint(anchorRect, message)
        : undefined;
    }

    var tempExecImportDuplicateDrawer = null;
    var tempExecImportDuplicateResolve = null;
    var tempExecImportDuplicateResolved = false;
    var tempExecImportDuplicateConfirmBound = false;
    var tempExecImportDuplicateTableController = null;

    function ensureTempExecImportDuplicateTableController() {
      if (tempExecImportDuplicateTableController) return tempExecImportDuplicateTableController;
      if (!tempExecImportDuplicateControllerFactory || typeof tempExecImportDuplicateControllerFactory.create !== 'function') return null;
      var hostEl = document.getElementById('tempExecImportDuplicateTableHost');
      if (!hostEl) return null;
      tempExecImportDuplicateTableController = tempExecImportDuplicateControllerFactory.create({ hostEl: hostEl });
      return tempExecImportDuplicateTableController;
    }

    function ensureTempExecImportDuplicateDrawer() {
      if (tempExecImportDuplicateDrawer) return tempExecImportDuplicateDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      tempExecImportDuplicateDrawer = window.app.drawer.createDrawer({
        drawerId: 'tempExecImportDuplicateDrawer',
        onClose: function() {
          if (tempExecImportDuplicateResolved) return;
          if (typeof tempExecImportDuplicateResolve === 'function') {
            tempExecImportDuplicateResolved = true;
            try { tempExecImportDuplicateResolve(false); } catch (e) {}
            tempExecImportDuplicateResolve = null;
          }
        },
      });
      if (!tempExecImportDuplicateConfirmBound) {
        tempExecImportDuplicateConfirmBound = true;
        var confirmBtn = document.getElementById('tempExecImportDuplicateConfirmBtn');
        if (confirmBtn && typeof confirmBtn.addEventListener === 'function') {
          confirmBtn.addEventListener('click', function() {
            if (tempExecImportDuplicateResolved) return;
            if (typeof tempExecImportDuplicateResolve !== 'function') return;
            tempExecImportDuplicateResolved = true;
            var resolve = tempExecImportDuplicateResolve;
            tempExecImportDuplicateResolve = null;
            try { resolve(true); } catch (e) {}
            if (tempExecImportDuplicateDrawer && typeof tempExecImportDuplicateDrawer.close === 'function') {
              tempExecImportDuplicateDrawer.close();
            }
          });
        }
      }
      return tempExecImportDuplicateDrawer;
    }

    function renderTempExecImportDuplicateDrawer(payload) {
      var titleEl = document.getElementById('tempExecImportDuplicateTitle');
      var statusEl = document.getElementById('tempExecImportDuplicateStatus');
      var confirmBtn = document.getElementById('tempExecImportDuplicateConfirmBtn');

      var fileName = payload && payload.fileName ? String(payload.fileName) : '用例';
      var total = payload && Number.isFinite(Number(payload.total)) ? Number(payload.total) : 0;
      var uniqueCount = payload && Number.isFinite(Number(payload.uniqueCount)) ? Number(payload.uniqueCount) : 0;
      var duplicateCount = payload && Number.isFinite(Number(payload.duplicateCount)) ? Number(payload.duplicateCount) : 0;
      var rows = payload && Array.isArray(payload.rows) ? payload.rows : [];

      if (titleEl) titleEl.textContent = '导入用例重复校验：' + fileName;
      if (statusEl) {
        var msg = '检测到重复条目 ' + duplicateCount + ' 条（模块/用例描述/前提条件/操作步骤/预期结果均相同），将自动去重：原 ' + total + ' 条 → 去重后 ' + uniqueCount + ' 条。';
        setStatus(statusEl, msg, 'warn');
      }
      if (confirmBtn) confirmBtn.disabled = !duplicateCount;
      var controller = ensureTempExecImportDuplicateTableController();
      if (controller) controller.setData(rows);
    }

    function confirmTempExecImportDuplicateByDrawer(payload) {
      var drawer = ensureTempExecImportDuplicateDrawer();
      if (!drawer) return Promise.resolve(false);

      tempExecImportDuplicateResolved = false;
      renderTempExecImportDuplicateDrawer(payload);
      drawer.open();

      return new Promise(function(resolve) {
        tempExecImportDuplicateResolve = resolve;
      });
    }
    function isTempExecProjectLayoutEnabled() {
      return isDbMode();
    }

    var stateSnapshotOwner = deps && deps.stateSnapshotOwner
      ? deps.stateSnapshotOwner
      : (window.app && window.app.tempExecStateSnapshotOwner
          ? window.app.tempExecStateSnapshotOwner
          : null);
    var placementVersionOwner = deps && deps.placementVersionOwner
      ? deps.placementVersionOwner
      : (window.app && window.app.tempExecPlacementVersionOwner
          ? window.app.tempExecPlacementVersionOwner
          : null);
    var caseInteractionOwner = deps && deps.caseInteractionOwner
      ? deps.caseInteractionOwner
      : (window.app && window.app.tempExecCaseInteractionOwner
          ? window.app.tempExecCaseInteractionOwner
          : null);
    var caseMutationOwner = deps && deps.caseMutationOwner
      ? deps.caseMutationOwner
      : (window.app && window.app.tempExecCaseMutationOwner
          ? window.app.tempExecCaseMutationOwner
          : null);
    var workspaceMutationOwner = deps && deps.workspaceMutationOwner
      ? deps.workspaceMutationOwner
      : (window.app && window.app.tempExecWorkspaceMutationOwner
          ? window.app.tempExecWorkspaceMutationOwner
          : null);
    var fileWorkflowOwner = deps && deps.fileWorkflowOwner
      ? deps.fileWorkflowOwner
      : (window.app && window.app.tempExecFileWorkflowOwner
          ? window.app.tempExecFileWorkflowOwner
          : null);
    var missingReminderOwner = deps && deps.missingReminderOwner
      ? deps.missingReminderOwner
      : (window.app && window.app.tempExecMissingReminderOwner
          ? window.app.tempExecMissingReminderOwner
          : null);
    var missingReminderViewOwner = deps && deps.missingReminderViewOwner
      ? deps.missingReminderViewOwner
      : (window.app && window.app.tempExecMissingReminderViewOwner
          ? window.app.tempExecMissingReminderViewOwner
          : null);
    var caseLibrarySyncOwner = deps && deps.caseLibrarySyncOwner
      ? deps.caseLibrarySyncOwner
      : (window.app && window.app.tempExecCaseLibrarySyncOwner
          ? window.app.tempExecCaseLibrarySyncOwner
          : null);
    var caseLibraryDiffOwner = deps && deps.caseLibraryDiffOwner
      ? deps.caseLibraryDiffOwner
      : (window.app && window.app.tempExecCaseLibraryDiffOwner
          ? window.app.tempExecCaseLibraryDiffOwner
          : null);
    var importParserOwner = deps && deps.importParserOwner
      ? deps.importParserOwner
      : (window.app && window.app.tempExecImportParserOwner
          ? window.app.tempExecImportParserOwner
          : null);
    var persistenceOwner = deps && deps.persistenceOwner
      ? deps.persistenceOwner
      : (window.app && window.app.tempExecPersistenceOwner
          ? window.app.tempExecPersistenceOwner
          : null);
    var dbImportOwner = deps && deps.dbImportOwner
      ? deps.dbImportOwner
      : (window.app && window.app.tempExecDbImportOwner
          ? window.app.tempExecDbImportOwner
          : null);
    var reuseOwner = deps && deps.reuseOwner
      ? deps.reuseOwner
      : (window.app && window.app.tempExecReuseOwner
          ? window.app.tempExecReuseOwner
          : null);
    var navigationViewOwner = deps && deps.navigationViewOwner
      ? deps.navigationViewOwner
      : (window.app && window.app.tempExecNavigationViewOwner
          ? window.app.tempExecNavigationViewOwner
          : null);
    var overviewViewOwner = deps && deps.overviewViewOwner
      ? deps.overviewViewOwner
      : (window.app && window.app.tempExecOverviewViewOwner
          ? window.app.tempExecOverviewViewOwner
          : null);
    var tableViewOwner = deps && deps.tableViewOwner
      ? deps.tableViewOwner
      : (window.app && window.app.tempExecTableViewOwner
          ? window.app.tempExecTableViewOwner
          : null);
    if (!stateSnapshotOwner || typeof stateSnapshotOwner.create !== 'function') {
      throw new Error('临时执行状态快照模块未就绪');
    }
    if (!placementVersionOwner || typeof placementVersionOwner.create !== 'function') {
      throw new Error('临时执行布局版本模块未就绪');
    }
    if (!caseInteractionOwner || typeof caseInteractionOwner.create !== 'function') {
      throw new Error('临时执行用例交互模块未就绪');
    }
    if (!caseMutationOwner || typeof caseMutationOwner.create !== 'function') {
      throw new Error('临时执行用例编辑事务模块未就绪');
    }
    if (!workspaceMutationOwner || typeof workspaceMutationOwner.create !== 'function') {
      throw new Error('临时执行工作区变更模块未就绪');
    }
    if (!fileWorkflowOwner || typeof fileWorkflowOwner.create !== 'function') {
      throw new Error('临时执行文件工作流模块未就绪');
    }
    if (!missingReminderOwner || typeof missingReminderOwner.create !== 'function') {
      throw new Error('临时执行易漏提醒模块未就绪');
    }
    if (!missingReminderViewOwner || typeof missingReminderViewOwner.create !== 'function') {
      throw new Error('临时执行易漏提醒视图模块未就绪');
    }
    if (!caseLibrarySyncOwner || typeof caseLibrarySyncOwner.create !== 'function') {
      throw new Error('临时执行用例库同步模块未就绪');
    }
    if (!caseLibraryDiffOwner || typeof caseLibraryDiffOwner.create !== 'function') {
      throw new Error('临时执行用例库变更模块未就绪');
    }
    if (!importParserOwner || typeof importParserOwner.create !== 'function') {
      throw new Error('临时执行导入解析模块未就绪');
    }
    if (!persistenceOwner || typeof persistenceOwner.create !== 'function') {
      throw new Error('临时执行持久化模块未就绪');
    }
    if (!dbImportOwner || typeof dbImportOwner.create !== 'function') {
      throw new Error('临时执行数据库导入模块未就绪');
    }
    if (!reuseOwner || typeof reuseOwner.create !== 'function') {
      throw new Error('临时执行用例复用模块未就绪');
    }
    if (!navigationViewOwner || typeof navigationViewOwner.create !== 'function') {
      throw new Error('临时执行导航视图模块未就绪');
    }
    if (!overviewViewOwner || typeof overviewViewOwner.create !== 'function') {
      throw new Error('临时执行总览视图模块未就绪');
    }
    if (!tableViewOwner || typeof tableViewOwner.create !== 'function') {
      throw new Error('临时执行表格视图模块未就绪');
    }

    var placementVersionApi = null;
    var navigationViewApi = null;
    var overviewViewApi = null;
    var tableViewApi = null;
    function getTempExecFileCaseCount(file) { return navigationViewApi.getTempExecFileCaseCount(file); }
    function normalizeTempExecImportProjectFilterId(raw) { return navigationViewApi.normalizeTempExecImportProjectFilterId(raw); }
    function renderTempExecNav() { return navigationViewApi.renderTempExecNav(); }
    function renderTempVersionGrid() { return navigationViewApi.renderTempVersionGrid(); }
    function renderTempFocusZone() { return navigationViewApi.renderTempFocusZone(); }
    function toggleTempExecRequirementZone() { return navigationViewApi.toggleTempExecRequirementZone(); }
    function toggleTempExecVersionZone() { return navigationViewApi.toggleTempExecVersionZone(); }
    function setTempExecImportProjectFilter(projectId) { return navigationViewApi.setTempExecImportProjectFilter(projectId); }
    function prioritizeTempExecUnassignedRequirements() { return navigationViewApi.prioritizeTempExecUnassignedRequirements(); }
    function resolveTempExecState(file) { return overviewViewApi.resolveTempExecState(file); }
    function updateTempExecFileStateClass(fileId) { return overviewViewApi.updateTempExecFileStateClass(fileId); }
    function buildTempExecSummary(file) { return overviewViewApi.buildTempExecSummary(file); }
    function getTempExecOrderedFileIds() { return overviewViewApi.getTempExecOrderedFileIds(); }
    function renderTempExecToolbar(file) { return overviewViewApi.renderTempExecToolbar(file); }
    function mapFilterToStatus(matchKey, status) { return overviewViewApi.mapFilterToStatus(matchKey, status); }
    function setTempExecStatusFilter(fileId, filterKey) { return overviewViewApi.setTempExecStatusFilter(fileId, filterKey); }
    function renderTempExecOverview() { return overviewViewApi.renderTempExecOverview(); }
    function renderTempExecView() { return tableViewApi ? tableViewApi.renderTempExecView() : undefined; }
    function renderTempExecTable(file) { return tableViewApi ? tableViewApi.renderTempExecTable(file) : ''; }
    function syncTempExecReuseStatusAlign() { return tableViewApi ? tableViewApi.syncTempExecReuseStatusAlign() : undefined; }
    function scrollTempExecViewTop() { return tableViewApi ? tableViewApi.scrollTempExecViewTop() : undefined; }
    var stateSnapshotApi = stateSnapshotOwner.create({
      state: state,
      reuseApplicabilityCore: reuseApplicabilityCore,
      defaultTempExecColumns: defaultTempExecColumns,
      defaultPlacement: defaultPlacement,
      modelsStorageKey: modelsStorageKey,
      assignmentStorageKey: assignmentStorageKey,
      tempExecStatus: tempExecStatus,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      normalizeRequirementName: normalizeRequirementName,
      generateReuseDetailId: generateReuseDetailId,
      generateReusePresetId: generateReusePresetId,
      generateDefectLinkId: generateDefectLinkId,
      generateTempExecId: generateTempExecId,
      stringifyCaseField: stringifyCaseField,
      getSafeFileBaseName: getSafeFileBaseName,
      getRequirementLabel: getRequirementLabel,
      setStatus: setStatus,
      getTempExecPageSize: function() {
        return placementVersionApi.getTempExecPageSize();
      },
      formatCompactTimestamp: formatCompactTimestamp,
      downloadText: downloadText,
      applyVersionAssignments: function(rawVersions) {
        return placementVersionApi.applyVersionAssignments(rawVersions);
      },
      resetTempExecPages: function(fileId) {
        return placementVersionApi.resetTempExecPages(fileId);
      },
      saveTempExecFocus: saveTempExecFocus,
      ensureTempExecColumns: ensureTempExecColumns,
      persistSettings: persistSettings,
      applyTempExecPageSize: function(value) {
        return placementVersionApi.applyTempExecPageSize(value);
      },
      setRequirementLabel: setRequirementLabel,
      syncTempExecPlacement: function() {
        return placementVersionApi.syncTempExecPlacement();
      },
      persistTempExecState: persistTempExecStatePort,
      renderTempExecNav: renderTempExecNav,
      renderTempExecView: renderTempExecView,
      renderTempVersionGrid: renderTempVersionGrid,
    });
    placementVersionApi = placementVersionOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      defaultPlacement: defaultPlacement,
      defaultTempExecPageSize: defaultTempExecPageSize,
      tempExecPageSizeStorageKey: tempExecPageSizeStorageKey,
      tempExecStatus: tempExecStatus,
      tempVersionGrid: tempVersionGrid,
      tempExecNav: tempExecNav,
      normalizeTempExecPlacement: stateSnapshotApi.normalizeTempExecPlacement,
      normalizeRequirementName: normalizeRequirementName,
      normalizeTempExecName: normalizeTempExecName,
      generateTempVersionId: generateTempVersionId,
      generateReuseDetailId: generateReuseDetailId,
      getTempExecFile: getTempExecFile,
      getTempExecFileCaseCount: getTempExecFileCaseCount,
      getTempExecFilesByRequirement: getTempExecFilesByRequirement,
      isTempExecProjectLayoutEnabled: isTempExecProjectLayoutEnabled,
      persistTempExecState: persistTempExecStatePort,
      renderTempExecNav: renderTempExecNav,
      renderTempVersionGrid: renderTempVersionGrid,
      renderTempExecView: renderTempExecView,
      scrollTempExecViewTop: scrollTempExecViewTop,
      setTempExecActive: setTempExecActive,
      persistSettings: persistSettings,
      scheduleTempExecUiSave: scheduleTempExecUiSave,
      setStatus: setStatus,
    });
    overviewViewApi = overviewViewOwner.create({
      state: state,
      tempVersionGrid: tempVersionGrid,
      tempExecNav: tempExecNav,
      tempExecOverview: tempExecOverview,
      tempExecToolbar: tempExecToolbar,
      tempExecToolbarCard: tempExecToolbarCard,
      getTempExecFile: getTempExecFile,
      getCaseExecutionStatus: function(file, item) {
        return reuseApi && typeof reuseApi.getCaseExecutionStatus === 'function'
          ? reuseApi.getCaseExecutionStatus(file, item)
          : (item && item.actual ? item.actual : '未执行');
      },
      normalizeRequirementName: normalizeRequirementName,
      escapeHtml: escapeHtml,
      isTempExecProjectLayoutEnabled: isTempExecProjectLayoutEnabled,
      isDbMode: isDbMode,
      ensureProjectOrder: placementVersionApi.ensureProjectOrder,
      ensureProjectVersionOrder: placementVersionApi.ensureProjectVersionOrder,
      ensureProjectVersionFileOrder: placementVersionApi.ensureProjectVersionFileOrder,
      ensureRequirementOrder: placementVersionApi.ensureRequirementOrder,
      ensureFileOrder: placementVersionApi.ensureFileOrder,
      resolveProjectName: placementVersionApi.resolveProjectName,
      resolveVersionName: placementVersionApi.resolveVersionName,
      getTempVersionName: placementVersionApi.getTempVersionName,
      getTempExecFileCaseCount: getTempExecFileCaseCount,
      stashTempExecToolbarButtons: stashTempExecToolbarButtons,
      mountTempExecToolbarButtons: mountTempExecToolbarButtons,
      renderTempExecView: renderTempExecView,
    });
    navigationViewApi = navigationViewOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      tempVersionGrid: tempVersionGrid,
      tempExecNav: tempExecNav,
      tempFocusZone: tempFocusZone,
      tempExecViewFocusZone: tempExecViewFocusZone,
      tempReqToggleBtn: tempReqToggleBtn,
      tempVersionToggleBtn: tempVersionToggleBtn,
      createTempVersionBtn: createTempVersionBtn,
      tempExecMindBtn: tempExecMindBtn,
      exportTempExecBtn: exportTempExecBtn,
      exportTempExecConfigBtn: exportTempExecConfigBtn,
      exportTempExecXmindBtn: exportTempExecXmindBtn,
      exportTempExecCasesXmindBtn: exportTempExecCasesXmindBtn,
      tempExecXmindViewBtn: tempExecXmindViewBtn,
      buildMindDataFromCases: buildMindDataFromCases,
      normalizeRequirementName: normalizeRequirementName,
      escapeHtml: escapeHtml,
      getTempExecFile: getTempExecFile,
      resolveTempExecState: resolveTempExecState,
      isTempExecProjectLayoutEnabled: isTempExecProjectLayoutEnabled,
      ensureTempVersionList: placementVersionApi.ensureTempVersionList,
      ensureTempExecPlacement: placementVersionApi.ensureTempExecPlacement,
      ensureVersionOrder: placementVersionApi.ensureVersionOrder,
      ensureRequirementOrder: placementVersionApi.ensureRequirementOrder,
      ensureFileOrder: placementVersionApi.ensureFileOrder,
      ensureProjectOrder: placementVersionApi.ensureProjectOrder,
      ensureProjectVersionOrder: placementVersionApi.ensureProjectVersionOrder,
      ensureProjectVersionFileOrder: placementVersionApi.ensureProjectVersionFileOrder,
      getVersionRequirementBlocks: placementVersionApi.getVersionRequirementBlocks,
      resolveProjectName: placementVersionApi.resolveProjectName,
      resolveVersionName: placementVersionApi.resolveVersionName,
      persistTempExecState: persistTempExecStatePort,
      scheduleTempExecUiSave: scheduleTempExecUiSave,
      renderTempExecOverview: renderTempExecOverview,
    });
    var caseInteractionApi = caseInteractionOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      document: typeof document !== 'undefined' ? document : null,
      tempExecStatus: tempExecStatus,
      tempExecToolbar: tempExecToolbar,
      generateDefectLinkId: generateDefectLinkId,
      getTempExecFile: getTempExecFile,
      isDbMode: isDbMode,
      queueExecCasePatchForItem: queueExecCasePatchForItem,
      persistTempExecState: persistTempExecStatePort,
      renderTempExecView: renderTempExecView,
      openConfirmDrawer: openConfirmDrawer,
      setStatus: setStatus,
    });
    var missingReminderApi = missingReminderOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      document: typeof document !== 'undefined' ? document : null,
      IntersectionObserver: typeof IntersectionObserver !== 'undefined' ? IntersectionObserver : null,
      tempExecView: tempExecView,
      appUtils: appUtils,
      normalizeMissingReminderMatchConfig: normalizeMissingReminderMatchConfig,
      stringifyCaseField: stringifyCaseField,
      buildMissingReminderKeywords: buildMissingReminderKeywords,
      escapeHtml: escapeHtml,
      getApiClient: getApiClient,
      renderTempExecView: renderTempExecView,
      missingReminderViewOwner: missingReminderViewOwner,
      getTempExecFile: getTempExecFile,
      getAssignedModel: getAssignedModel,
      callModelWithConfig: callModelWithConfig,
      openConfirmDrawer: openConfirmDrawer,
    });
    var reuseApi = reuseOwner.create({
      state: state,
      document: typeof document !== 'undefined' ? document : null,
      tempExecStatus: tempExecStatus,
      tempExecView: tempExecView,
      tempExecResultOptions: tempExecResultOptions,
      reuseApplicabilityCore: reuseApplicabilityCore,
      generateReusePresetId: generateReusePresetId,
      generateReuseDetailId: generateReuseDetailId,
      resolveProjectName: placementVersionApi.resolveProjectName,
      getTempExecFile: getTempExecFile,
      setStatus: setStatus,
      isDbMode: isDbMode,
      queueExecSetPatch: queueExecSetPatch,
      queueExecCasePatchForItem: queueExecCasePatchForItem,
      persistTempExecState: persistTempExecStatePort,
      renderTempExecView: renderTempExecView,
      normalizeReusePresets: stateSnapshotApi.normalizeReusePresets,
      getApiClient: getApiClient,
      openConfirmDrawer: openConfirmDrawer,
      normalizeReuseApplicability: stateSnapshotApi.normalizeReuseApplicability,
      escapeHtml: escapeHtml,
      isReuseDetailRemoved: stateSnapshotApi.isReuseDetailRemoved,
      ensureTempExecReuseOpen: caseInteractionApi.ensureTempExecReuseOpen,
      resetTempExecReuseOpen: caseInteractionApi.resetTempExecReuseOpen,
      clearReuseDetailAutoStatus: stateSnapshotApi.clearReuseDetailAutoStatus,
      normalizeExecStatus: function(value) { return normalizeExecStatus(value); },
      captureTempExecAnchorRect: captureTempExecAnchorRect,
      showTempExecBlockHint: showTempExecBlockHint,
      renderTempExecToolbar: renderTempExecToolbar,
      renderTempExecOverview: renderTempExecOverview,
      updateTempExecFileStateClass: updateTempExecFileStateClass,
    });
    caseMutationApi = caseMutationOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      document: typeof document !== 'undefined' ? document : null,
      tempExecStatus: tempExecStatus,
      stringifyCaseField: stringifyCaseField,
      generateTempExecId: generateTempExecId,
      getTempExecFile: getTempExecFile,
      ensureTempExecSelection: caseInteractionApi.ensureTempExecSelection,
      isDbMode: isDbMode,
      queueExecCasePatchForItem: queueExecCasePatchForItem,
      clearPendingExecCasePatch: clearPendingExecCasePatch,
      commitTempExecUndoToDb: function() {
        return persistenceApi && typeof persistenceApi.commitTempExecUndoToDb === 'function'
          ? persistenceApi.commitTempExecUndoToDb()
          : undefined;
      },
      persistTempExecState: persistTempExecStatePort,
      renderTempExecView: renderTempExecView,
      renderTempExecNav: renderTempExecNav,
      renderTempVersionGrid: renderTempVersionGrid,
      clearTempExecCaseStates: caseInteractionApi.clearTempExecCaseStates,
      getTempExecCaseUiKeys: getTempExecCaseUiKeys,
      ensureTempExecNewAddedUiKey: ensureTempExecNewAddedUiKey,
      markTempExecNewAdded: markTempExecNewAdded,
      unmarkTempExecNewAdded: unmarkTempExecNewAdded,
      isTempExecNewAdded: isTempExecNewAdded,
      buildReuseDetailsFromPresets: reuseApi.buildReuseDetailsFromPresets,
      resolveReuseAggregateStatus: reuseApi.resolveReuseAggregateStatus,
      openConfirmDrawer: openConfirmDrawer,
      setStatus: setStatus,
    });
    caseLibrarySyncApi = caseLibrarySyncOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      sessionStorage: typeof sessionStorage !== 'undefined' ? sessionStorage : null,
      getTempExecFile: getTempExecFile,
      openTempExecCaseLibraryDiffDrawer: openTempExecCaseLibraryDiffDrawer,
      syncTempExecCaseLibraryChangesButton: syncTempExecCaseLibraryChangesButton,
      renderTempExecCaseLibraryDiffCaseTabs: renderTempExecCaseLibraryDiffCaseTabs,
    });
    caseLibraryDiffApi = caseLibraryDiffOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      document: typeof document !== 'undefined' ? document : null,
      caseLibrarySyncApi: caseLibrarySyncApi,
      controllerFactory: tempExecCaseLibraryDiffControllerFactory,
      dom: {
        changesButton: tempExecCaseLibraryChangesBtn,
        tempExecView: tempExecView,
        tempExecViewSection: tempExecViewSection,
      },
      setStatus: setStatus,
      escapeHtml: escapeHtml,
      scrollElementIntoView: scrollElementIntoView,
      getTempExecFile: getTempExecFile,
      isDbMode: isDbMode,
      getApiClient: getApiClient,
      setTempExecActive: setTempExecActive,
      jumpToTempExecCase: function(fileId, index, options) {
        return jumpToTempExecCase(fileId, index, options);
      },
    });
    importParserApi = importParserOwner.create({
      tempExecResultOptions: tempExecResultOptions,
      generateDefectLinkId: generateDefectLinkId,
      generateReuseDetailId: generateReuseDetailId,
      normalizeRequirementName: normalizeRequirementName,
      deriveCaseListFromText: deriveCaseListFromText,
      parseXmindFile: parseXmindFile,
      parseXlsxFileToRows: parseXlsxFileToRows,
      buildTempExecCasesFromXmindPaths: placementVersionApi.buildTempExecCasesFromXmindPaths,
      isReuseDetailRemoved: stateSnapshotApi.isReuseDetailRemoved,
      resolveReuseAggregateStatus: reuseApi.resolveReuseAggregateStatus,
    });
    persistenceApi = persistenceOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      tempExecStorageKey: tempExecStorageKey,
      tempExecFocusStorageKey: tempExecFocusStorageKey,
      defaultPlacement: defaultPlacement,
      defaultTempExecPageSize: defaultTempExecPageSize,
      tempExecStatus: tempExecStatus,
      tempExecResultOptions: tempExecResultOptions,
      setStatus: setStatus,
      generateDefectLinkId: generateDefectLinkId,
      normalizeRequirementName: normalizeRequirementName,
      normalizeTempExecCases: stateSnapshotApi.normalizeTempExecCases,
      normalizeReusePresets: stateSnapshotApi.normalizeReusePresets,
      normalizeTempExecPlacement: stateSnapshotApi.normalizeTempExecPlacement,
      serializeTempExecFiles: stateSnapshotApi.serializeTempExecFiles,
      serializeTempExecVersions: stateSnapshotApi.serializeTempExecVersions,
      applyVersionAssignments: placementVersionApi.applyVersionAssignments,
      resetTempExecPages: placementVersionApi.resetTempExecPages,
      clampTempExecPageSize: placementVersionApi.clampTempExecPageSize,
      normalizeTempExecImportProjectFilterId: normalizeTempExecImportProjectFilterId,
      syncTempExecPlacement: placementVersionApi.syncTempExecPlacement,
      renderTempExecNav: renderTempExecNav,
      renderTempExecView: renderTempExecView,
      renderTempVersionGrid: renderTempVersionGrid,
      renderTempFocusZone: renderTempFocusZone,
      renderTempExecOverview: renderTempExecOverview,
      notifyTempExecActiveChange: notifyTempExecActiveChange,
      updateTempExecFileCountBadge: placementVersionApi.updateTempExecFileCountBadge,
      updateTempExecFileStateClass: updateTempExecFileStateClass,
      applyPresetsToCase: reuseApi.applyPresetsToCase,
      pruneTempExecCaseLibraryDiffStore: caseLibrarySyncApi.pruneTempExecCaseLibraryDiffStore,
      applyTempExecCaseLibraryDiffReset: caseLibrarySyncApi.applyTempExecCaseLibraryDiffReset,
      parseDbTimeMs: caseLibrarySyncApi.parseDbTimeMs,
      isTempExecTabActive: caseLibrarySyncApi.isTempExecTabActive,
      consumeTempExecCaseLibrarySyncTrigger: caseLibrarySyncApi.consumeTempExecCaseLibrarySyncTrigger,
      applyTempExecCaseLibrarySyncMeta: caseLibrarySyncApi.applyTempExecCaseLibrarySyncMeta,
      maybeOpenTempExecCaseLibraryAutoPopup: caseLibrarySyncApi.maybeOpenTempExecCaseLibraryAutoPopup,
      markTempExecNewAdded: markTempExecNewAdded,
      getTempExecCaseUiKeys: getTempExecCaseUiKeys,
      syncTempExecFocus: syncTempExecFocus,
    });
    fileWorkflowApi = fileWorkflowOwner.create({
      state: state,
      tempExecStatus: tempExecStatus,
      normalizeRequirementName: normalizeRequirementName,
      getRequirementLabel: getRequirementLabel,
      ensureRequirementLabel: ensureRequirementLabel,
      setRequirementLabel: setRequirementLabel,
      stripTimestampSuffix: stripTimestampSuffix,
      buildTempExecXmindPackage: buildTempExecXmindPackage,
      buildXmindPackageFromCases: buildXmindPackageFromCases,
      getTempExecFileBaseName: stateSnapshotApi.getTempExecFileBaseName,
      formatCompactTimestamp: formatCompactTimestamp,
      downloadBlob: downloadBlob,
      setStatus: setStatus,
      getTempExecFile: getTempExecFile,
      generateTempExecId: generateTempExecId,
      normalizeTempExecCases: stateSnapshotApi.normalizeTempExecCases,
      insertFileIntoOrder: placementVersionApi.insertFileIntoOrder,
      ensureRequirementOrder: placementVersionApi.ensureRequirementOrder,
      saveTempExecFocus: saveTempExecFocus,
      parseTempExecImportFile: importParserApi.parseTempExecImportFile,
      extractRequirementLabelFromText: extractRequirementLabelFromText,
      promptTempExecRequirement: promptTempExecRequirement,
      ensureTempExecReplacement: ensureTempExecReplacement,
      syncTempExecFocus: syncTempExecFocus,
      ensureTempExecPlacement: placementVersionApi.ensureTempExecPlacement,
      syncTempExecPlacement: placementVersionApi.syncTempExecPlacement,
      persistTempExecState: persistTempExecStatePort,
      setTempExecActive: setTempExecActive,
    });
    var exportTempExecToXmind = fileWorkflowApi.exportTempExecToXmind;
    var exportTempExecCasesToXmind = fileWorkflowApi.exportTempExecCasesToXmind;
    var createTempExecFile = fileWorkflowApi.createTempExecFile;
    var importTempExecFiles = fileWorkflowApi.importTempExecFiles;
    dbImportApi = dbImportOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      tempExecStatus: tempExecStatus,
      isDbMode: isDbMode,
      importTempExecFiles: importTempExecFiles,
      getApiClient: getApiClient,
      setStatus: setStatus,
      normalizeTempExecName: normalizeTempExecName,
      getSafeFileBaseName: getSafeFileBaseName,
      parseTempExecImportFile: importParserApi.parseTempExecImportFile,
      normalizeRequirementName: normalizeRequirementName,
      extractRequirementLabelFromText: extractRequirementLabelFromText,
      promptTempExecRequirement: promptTempExecRequirement,
      setRequirementLabel: setRequirementLabel,
      normalizeTempExecCases: stateSnapshotApi.normalizeTempExecCases,
      buildCaseItemPayloadFromTempCase: importParserApi.buildCaseItemPayloadFromTempCase,
      buildExecImportPayloadFromTempCase: importParserApi.buildExecImportPayloadFromTempCase,
      confirmTempExecImportDuplicateByDrawer: confirmTempExecImportDuplicateByDrawer,
      queueTempExecCaseLibraryDiffReset: caseLibrarySyncApi.queueTempExecCaseLibraryDiffReset,
      loadTempExecStateFromDb: persistenceApi.loadTempExecStateFromDb,
      getTempExecFile: getTempExecFile,
      setTempExecActive: setTempExecActive,
    });
    workspaceMutationApi = workspaceMutationOwner.create({
      state: state,
      tempExecStatus: tempExecStatus,
      isDbMode: isDbMode,
      isTempExecProjectLayoutEnabled: isTempExecProjectLayoutEnabled,
      getApiClient: getApiClient,
      clearTempExecCaseLibraryDiffMeta: caseLibrarySyncApi.clearTempExecCaseLibraryDiffMeta,
      loadTempExecState: function() {
        return persistenceApi && typeof persistenceApi.loadTempExecState === 'function'
          ? persistenceApi.loadTempExecState()
          : undefined;
      },
      removeTempExecFromVersion: placementVersionApi.removeTempExecFromVersion,
      ensureTempExecPlacement: placementVersionApi.ensureTempExecPlacement,
      removeFileFromOrder: placementVersionApi.removeFileFromOrder,
      saveTempExecFocus: saveTempExecFocus,
      persistTempExecState: persistTempExecStatePort,
      setTempExecActive: setTempExecActive,
      renderTempVersionGrid: renderTempVersionGrid,
      renderTempExecView: renderTempExecView,
      renderTempExecOverview: renderTempExecOverview,
      setStatus: setStatus,
    });
    var removeTempExecFile = workspaceMutationApi.removeTempExecFile;
    var reorderTempExecProject = workspaceMutationApi.reorderTempExecProject;
    var reorderTempExecProjectVersion = workspaceMutationApi.reorderTempExecProjectVersion;
    var reorderTempExecFileInProjectVersion = workspaceMutationApi.reorderTempExecFileInProjectVersion;
    var removeTempExecProject = workspaceMutationApi.removeTempExecProject;
    var removeTempExecProjectVersion = workspaceMutationApi.removeTempExecProjectVersion;
    var dissolveTempExecArchivedProjectVersion = workspaceMutationApi.dissolveTempExecArchivedProjectVersion;

    var isReuseDetailRemoved = stateSnapshotApi.isReuseDetailRemoved;
    var normalizeReuseApplicability = stateSnapshotApi.normalizeReuseApplicability;
    var clearReuseDetailAutoStatus = stateSnapshotApi.clearReuseDetailAutoStatus;
    var normalizeReuseDetails = stateSnapshotApi.normalizeReuseDetails;
    var normalizeReusePresets = stateSnapshotApi.normalizeReusePresets;
    var normalizeDefectLinks = stateSnapshotApi.normalizeDefectLinks;
    var getTempExecFileBaseName = stateSnapshotApi.getTempExecFileBaseName;
    var normalizeTempExecCase = stateSnapshotApi.normalizeTempExecCase;
    var normalizeTempExecCases = stateSnapshotApi.normalizeTempExecCases;
    var normalizeTempExecPlacement = stateSnapshotApi.normalizeTempExecPlacement;
    var serializeSingleTempExecFile = stateSnapshotApi.serializeSingleTempExecFile;
    var serializeTempExecFiles = stateSnapshotApi.serializeTempExecFiles;
    var serializeTempExecVersions = stateSnapshotApi.serializeTempExecVersions;
    var serializeModelList = stateSnapshotApi.serializeModelList;
    var serializeAssignments = stateSnapshotApi.serializeAssignments;
    var applyImportedModels = stateSnapshotApi.applyImportedModels;
    var applyImportedAssignments = stateSnapshotApi.applyImportedAssignments;
    var serializeTempExecSnapshot = stateSnapshotApi.serializeTempExecSnapshot;
    var exportTempExecSnapshot = stateSnapshotApi.exportTempExecSnapshot;
    var importTempExecSnapshot = stateSnapshotApi.importTempExecSnapshot;
    var applyTempExecSnapshot = stateSnapshotApi.applyTempExecSnapshot;
    var ensureTempExecPlacement = placementVersionApi.ensureTempExecPlacement;
    var resolveProjectName = placementVersionApi.resolveProjectName;
    var resolveVersionName = placementVersionApi.resolveVersionName;
    var updateTempExecFileCountBadge = placementVersionApi.updateTempExecFileCountBadge;
    var ensureProjectOrder = placementVersionApi.ensureProjectOrder;
    var ensureProjectVersionOrder = placementVersionApi.ensureProjectVersionOrder;
    var ensureProjectVersionFileOrder = placementVersionApi.ensureProjectVersionFileOrder;
    var ensureRequirementOrder = placementVersionApi.ensureRequirementOrder;
    var ensureFileOrder = placementVersionApi.ensureFileOrder;
    var ensureVersionOrder = placementVersionApi.ensureVersionOrder;
    var reorderRequirementOrder = placementVersionApi.reorderRequirementOrder;
    var updateVersionOrder = placementVersionApi.updateVersionOrder;
    var removeFileFromOrder = placementVersionApi.removeFileFromOrder;
    var insertFileIntoOrder = placementVersionApi.insertFileIntoOrder;
    var syncTempExecPlacement = placementVersionApi.syncTempExecPlacement;
    var moveTempExecFileToRequirement = placementVersionApi.moveTempExecFileToRequirement;
    var clampTempExecPageSize = placementVersionApi.clampTempExecPageSize;
    var loadTempExecPageSizeSetting = placementVersionApi.loadTempExecPageSizeSetting;
    var saveTempExecPageSizeSetting = placementVersionApi.saveTempExecPageSizeSetting;
    var ensureTempExecPageIndex = placementVersionApi.ensureTempExecPageIndex;
    var getTempExecPageSize = placementVersionApi.getTempExecPageSize;
    var resetTempExecPages = placementVersionApi.resetTempExecPages;
    var setTempExecPage = placementVersionApi.setTempExecPage;
    var changeTempExecPage = placementVersionApi.changeTempExecPage;
    var jumpToTempExecCase = placementVersionApi.jumpToTempExecCase;
    var applyTempExecPageSize = placementVersionApi.applyTempExecPageSize;
    var ensureTempVersionList = placementVersionApi.ensureTempVersionList;
    var getTempVersion = placementVersionApi.getTempVersion;
    var applyVersionAssignments = placementVersionApi.applyVersionAssignments;
    var isVersionNameDuplicate = placementVersionApi.isVersionNameDuplicate;
    var buildTempExecCasesFromXmindPaths = placementVersionApi.buildTempExecCasesFromXmindPaths;
    var createTempVersion = placementVersionApi.createTempVersion;
    var removeTempExecFromVersion = placementVersionApi.removeTempExecFromVersion;
    var removeTempGroupFromVersion = placementVersionApi.removeTempGroupFromVersion;
    var moveTempExecToVersion = placementVersionApi.moveTempExecToVersion;
    var getVersionRequirementBlocks = placementVersionApi.getVersionRequirementBlocks;
    var moveTempExecFileWithinVersion = placementVersionApi.moveTempExecFileWithinVersion;
    var parseReqPayload = placementVersionApi.parseReqPayload;
    var reorderVersionRequirement = placementVersionApi.reorderVersionRequirement;
    var moveRequirementToVersion = placementVersionApi.moveRequirementToVersion;
    var moveRequirementOutOfVersion = placementVersionApi.moveRequirementOutOfVersion;
    var removeTempVersion = placementVersionApi.removeTempVersion;
    var reorderTempVersion = placementVersionApi.reorderTempVersion;
    var renameTempVersion = placementVersionApi.renameTempVersion;
    var getTempVersionName = placementVersionApi.getTempVersionName;
    var ensureTempExecSelection = caseInteractionApi.ensureTempExecSelection;
    var resetTempExecSelections = caseInteractionApi.resetTempExecSelections;
    var ensureTempExecRemarkOpen = caseInteractionApi.ensureTempExecRemarkOpen;
    var resetTempExecRemarkOpen = caseInteractionApi.resetTempExecRemarkOpen;
    var ensureTempExecReuseOpen = caseInteractionApi.ensureTempExecReuseOpen;
    var resetTempExecReuseOpen = caseInteractionApi.resetTempExecReuseOpen;
    var ensureTempExecDefectOpen = caseInteractionApi.ensureTempExecDefectOpen;
    var resetTempExecDefectOpen = caseInteractionApi.resetTempExecDefectOpen;
    var clearTempExecCaseStates = caseInteractionApi.clearTempExecCaseStates;
    var ensureDefectLinks = caseInteractionApi.ensureDefectLinks;
    var addTempExecDefectLink = caseInteractionApi.addTempExecDefectLink;
    var removeTempExecDefectLink = caseInteractionApi.removeTempExecDefectLink;
    var updateTempExecDefectLink = caseInteractionApi.updateTempExecDefectLink;
    var normalizeDefectOpenUrl = caseInteractionApi.normalizeDefectOpenUrl;
    var openTempExecDefectLink = caseInteractionApi.openTempExecDefectLink;
    var toggleTempExecDefectPanel = caseInteractionApi.toggleTempExecDefectPanel;
    var snapshotTempExecSearchFocus = caseInteractionApi.snapshotTempExecSearchFocus;
    var restoreTempExecSearchFocus = caseInteractionApi.restoreTempExecSearchFocus;
    var applyTempExecSearch = caseInteractionApi.applyTempExecSearch;
    var ensureReusePresets = reuseApi.ensureReusePresets;
    var getTempExecReuseApplicabilityProfile = reuseApi.getTempExecReuseApplicabilityProfile;
    var buildReuseDetailsFromPresets = reuseApi.buildReuseDetailsFromPresets;
    var startTempExecPresetDraft = reuseApi.startTempExecPresetDraft;
    var cancelTempExecPresetDraft = reuseApi.cancelTempExecPresetDraft;
    var updateTempExecPresetDraft = reuseApi.updateTempExecPresetDraft;
    var applyPresetToCases = reuseApi.applyPresetToCases;
    var applyPresetsToCase = reuseApi.applyPresetsToCase;
    var removePresetFromCases = reuseApi.removePresetFromCases;
    var confirmTempExecPresetDraft = reuseApi.confirmTempExecPresetDraft;
    var renameTempExecPreset = reuseApi.renameTempExecPreset;
    var updateTempExecPresetApplicability = reuseApi.updateTempExecPresetApplicability;
    var buildTempExecReuseApplicabilityMessage = reuseApi.buildTempExecReuseApplicabilityMessage;
    var applyTempExecReuseApplicability = reuseApi.applyTempExecReuseApplicability;
    var removeTempExecPreset = reuseApi.removeTempExecPreset;
    var getCaseExecutionStatus = reuseApi.getCaseExecutionStatus;
    var aggregateReuseDetails = reuseApi.aggregateReuseDetails;
    var resolveReuseAggregateStatus = reuseApi.resolveReuseAggregateStatus;
    var mapStatusToClass = reuseApi.mapStatusToClass;
    var getCaseExecutionDisplay = reuseApi.getCaseExecutionDisplay;
    var renderReusePresetPanel = reuseApi.renderReusePresetPanel;
    var renderReuseEntries = reuseApi.renderReuseEntries;
    var toggleTempExecReusePanel = reuseApi.toggleTempExecReusePanel;
    var addTempExecReuseEntry = reuseApi.addTempExecReuseEntry;
    var removeTempExecReuseEntry = reuseApi.removeTempExecReuseEntry;
    var updateTempExecReuseStatus = reuseApi.updateTempExecReuseStatus;
    var updateTempExecReuseStatusUi = reuseApi.updateTempExecReuseStatusUi;
    var normalizeReuseDetailStatus = reuseApi.normalizeReuseDetailStatus;
    var syncTempExecReuseStatusFromFirst = reuseApi.syncTempExecReuseStatusFromFirst;
    var updateTempExecReuseText = reuseApi.updateTempExecReuseText;
    var updateTempExecReuseNote = reuseApi.updateTempExecReuseNote;
    var handleTempExecReuseToggle = reuseApi.handleTempExecReuseToggle;
    var updateTempExecResult = caseMutationApi.updateTempExecResult;
    var updateTempExecRemark = caseMutationApi.updateTempExecRemark;
    var pushTempExecUndo = caseMutationApi.pushTempExecUndo;
    var clearTempExecUndo = caseMutationApi.clearTempExecUndo;
    var restoreTempExecUndo = caseMutationApi.restoreTempExecUndo;
    var cleanupTempExecUndoUI = caseMutationApi.cleanupTempExecUndoUI;
    var startTempExecUndoTimer = caseMutationApi.startTempExecUndoTimer;
    var insertTempExecCase = caseMutationApi.insertTempExecCase;
    var appendTempExecAiCases = caseMutationApi.appendTempExecAiCases;
    var removeTempExecCase = caseMutationApi.removeTempExecCase;
    var updateTempExecCaseField = caseMutationApi.updateTempExecCaseField;
    var toggleTempExecSelection = caseMutationApi.toggleTempExecSelection;
    var toggleTempExecSelectAll = caseMutationApi.toggleTempExecSelectAll;
    var ensureTempExecMissingReminderState = missingReminderApi.ensureTempExecMissingReminderState;
    var resolveMissingReminderPlacement = missingReminderApi.resolveMissingReminderPlacement;
    var resolveMissingReminderMatchConfig = missingReminderApi.resolveMissingReminderMatchConfig;
    var resolveMissingReminderAiEnabled = missingReminderApi.resolveMissingReminderAiEnabled;
    var hashReminderText = missingReminderApi.hashReminderText;
    var buildTempExecAiCaseEntry = missingReminderApi.buildTempExecAiCaseEntry;
    var buildTempExecAiCaseText = missingReminderApi.buildTempExecAiCaseText;
    var buildTempExecAiCaseContext = missingReminderApi.buildTempExecAiCaseContext;
    var buildTempExecCaseText = missingReminderApi.buildTempExecCaseText;
    var buildTempExecCaseSearchText = missingReminderApi.buildTempExecCaseSearchText;
    var buildTempExecCaseFieldText = missingReminderApi.buildTempExecCaseFieldText;
    var buildTempExecReminderFieldTextMap = missingReminderApi.buildTempExecReminderFieldTextMap;
    var hasReminderKeywordHit = missingReminderApi.hasReminderKeywordHit;
    var buildTempExecReminderScore = missingReminderApi.buildTempExecReminderScore;
    var resolveTempExecMissingReminderScoreLevel = missingReminderApi.resolveTempExecMissingReminderScoreLevel;
    var resolveTempExecMissingReminderLibraryEmpty = missingReminderApi.resolveTempExecMissingReminderLibraryEmpty;
    var getTempExecMissingReminderAiManager = missingReminderApi.getTempExecMissingReminderAiManager;
    var buildTempExecMissingReminderAiItemsFromTask = missingReminderApi.buildTempExecMissingReminderAiItemsFromTask;
    var applyTempExecMissingReminderAiTaskState = missingReminderApi.applyTempExecMissingReminderAiTaskState;
    var syncTempExecMissingReminderAiTaskState = missingReminderApi.syncTempExecMissingReminderAiTaskState;
    var resetTempExecMissingReminderLibrary = missingReminderApi.resetTempExecMissingReminderLibrary;
    var showTempExecMissingReminderLibraryEmptyToast = missingReminderApi.showTempExecMissingReminderLibraryEmptyToast;
    var checkTempExecMissingReminderLibrary = missingReminderApi.checkTempExecMissingReminderLibrary;
    var buildTempExecMissingReminderSummary = missingReminderApi.buildTempExecMissingReminderSummary;
    var resolveTempExecMissingReminderLimit = missingReminderApi.resolveTempExecMissingReminderLimit;
    var normalizeMissingReminderTypeId = missingReminderApi.normalizeMissingReminderTypeId;
    var normalizeMissingReminderTypeIds = missingReminderApi.normalizeMissingReminderTypeIds;
    var formatTempExecMissingTypeLabel = missingReminderApi.formatTempExecMissingTypeLabel;
    var buildTempExecMissingReminderTable = missingReminderApi.buildTempExecMissingReminderTable;
    var renderTempExecMissingReminderBlock = missingReminderApi.renderTempExecMissingReminderBlock;
    var cleanupTempExecMissingReminderObserver = missingReminderApi.cleanupTempExecMissingReminderObserver;
    var resolveTempExecMissingReminderTarget = missingReminderApi.resolveTempExecMissingReminderTarget;
    var isTempExecMissingReminderInView = missingReminderApi.isTempExecMissingReminderInView;
    var scheduleTempExecMissingReminderLazyLoad = missingReminderApi.scheduleTempExecMissingReminderLazyLoad;
    var clearTempExecMissingReminder = missingReminderApi.clearTempExecMissingReminder;
    var requestTempExecMissingReminderRefresh = missingReminderApi.requestTempExecMissingReminderRefresh;
    var refreshTempExecMissingReminder = missingReminderApi.refreshTempExecMissingReminder;
    var loadTempExecMissingReminderItems = missingReminderApi.loadTempExecMissingReminderItems;
    var clearTempExecMissingReminderAi = missingReminderApi.clearTempExecMissingReminderAi;
    var syncTempExecMissingReminderAiContext = missingReminderApi.syncTempExecMissingReminderAiContext;
    var buildTempExecMissingReminderAiCandidateSnapshot = missingReminderApi.buildTempExecMissingReminderAiCandidateSnapshot;
    var parseTempExecMissingReminderAiIds = missingReminderApi.parseTempExecMissingReminderAiIds;
    var fetchTempExecMissingReminderAiCandidates = missingReminderApi.fetchTempExecMissingReminderAiCandidates;
    var runTempExecMissingReminderAiRecommend = missingReminderApi.runTempExecMissingReminderAiRecommend;
    var hasTempExecMissingReminderAiGenerated = missingReminderApi.hasTempExecMissingReminderAiGenerated;
    var triggerTempExecMissingReminderAiRecommend = missingReminderApi.triggerTempExecMissingReminderAiRecommend;
    tableViewApi = tableViewOwner.create({
      state: state,
      window: typeof window !== 'undefined' ? window : null,
      document: typeof document !== 'undefined' ? document : null,
      tempExecView: tempExecView,
      tempExecViewSection: tempExecViewSection,
      tempExecMindContainer: tempExecMindContainer,
      tempExecMindBtn: tempExecMindBtn,
      exportTempExecBtn: exportTempExecBtn,
      exportTempExecXmindBtn: exportTempExecXmindBtn,
      exportTempExecCasesXmindBtn: exportTempExecCasesXmindBtn,
      tempExecXmindViewBtn: tempExecXmindViewBtn,
      tempExecCaseLibraryChangesBtn: tempExecCaseLibraryChangesBtn,
      tempExecResultOptions: tempExecResultOptions,
      caseViewBaseFontSize: caseViewBaseFontSize,
      buildMindDataFromCases: buildMindDataFromCases,
      escapeHtml: escapeHtml,
      escapeHtmlPreserve: escapeHtmlPreserve,
      ensureTempExecColumns: ensureTempExecColumns,
      scrollElementIntoView: scrollElementIntoView,
      getTempExecFile: getTempExecFile,
      resolveProjectName: resolveProjectName,
      resolveVersionName: resolveVersionName,
      ensureTempExecAssociationRows: ensureTempExecAssociationRows,
      snapshotTempExecSearchFocus: snapshotTempExecSearchFocus,
      restoreTempExecSearchFocus: restoreTempExecSearchFocus,
      renderTempExecToolbar: renderTempExecToolbar,
      clearTempExecMissingReminder: clearTempExecMissingReminder,
      renderTempExecMissingReminderBlock: renderTempExecMissingReminderBlock,
      resolveMissingReminderPlacement: resolveMissingReminderPlacement,
      bindMissingReminderScrollHint: appUtils && typeof appUtils.bindMissingReminderScrollHint === 'function'
        ? function(container) { appUtils.bindMissingReminderScrollHint(container); }
        : function() {},
      syncTempExecCaseLibraryChangesButton: syncTempExecCaseLibraryChangesButton,
      renderTempExecOverview: renderTempExecOverview,
      requestTempExecMissingReminderRefresh: requestTempExecMissingReminderRefresh,
      resolveMissingReminderAiEnabled: resolveMissingReminderAiEnabled,
      scheduleTempExecMissingReminderLazyLoad: scheduleTempExecMissingReminderLazyLoad,
      getTempExecPageSize: getTempExecPageSize,
      getCaseExecutionStatus: getCaseExecutionStatus,
      mapFilterToStatus: mapFilterToStatus,
      ensureTempExecSelection: ensureTempExecSelection,
      ensureTempExecRemarkOpen: ensureTempExecRemarkOpen,
      ensureTempExecReuseOpen: ensureTempExecReuseOpen,
      ensureTempExecDefectOpen: ensureTempExecDefectOpen,
      ensureTempExecPageIndex: ensureTempExecPageIndex,
      getCaseExecutionDisplay: getCaseExecutionDisplay,
      aggregateReuseDetails: aggregateReuseDetails,
      renderReuseEntries: renderReuseEntries,
      isTempExecNewAdded: isTempExecNewAdded,
      renderReusePresetPanel: renderReusePresetPanel,
      buildTempExecSummary: buildTempExecSummary,
    });

    function ensureTempExecAssociationRows(file) {
      if (!file || !file.associationEnabled) return;
      if (!isDbMode()) return;
      if (Array.isArray(file.associationRows)) return;
      if (file._associationRowsLoading) return;
      var caseFileId = file.caseFileId || file.case_file_id || null;
      if (!caseFileId) return;
      var client = getApiClient();
      if (!client || typeof client.listCaseFileAssociations !== 'function') return;
      file._associationRowsLoading = true;
      client
        .listCaseFileAssociations(caseFileId)
        .then(function(rows) {
          file._associationRowsLoading = false;
          file.associationRows = Array.isArray(rows) ? rows : [];
          if (String(state.tempExecActiveId || '') === String(file.id || file.execSetId || '')) {
            renderTempExecView();
          }
        })
        .catch(function() {
          file._associationRowsLoading = false;
          file.associationRows = [];
        });
    }

    function getTempExecFile(fileId) {
      if (!fileId) return null;
      return state.tempExecFiles.find(function(item) { return item.id === fileId; }) || null;
    }

    function getTempExecFilesByRequirement(req) {
      var target = normalizeRequirementName(req) || '未标识需求';
      return state.tempExecFiles.filter(function(file) {
        var name = normalizeRequirementName(file && file.requirement) || '未标识需求';
        return name === target;
      });
    }

    var persistTempExecState = function() {
      return persistenceApi.persistTempExecState();
    };

    var normalizeExecStatus = function(value) {
      return persistenceApi.normalizeExecStatus(value);
    };
    var mapExecCaseToTempCase = function(item) {
      return persistenceApi.mapExecCaseToTempCase(item);
    };
    var consumeTempExecCaseLibrarySyncTrigger = function() {
      return caseLibrarySyncApi.consumeTempExecCaseLibrarySyncTrigger();
    };

    // “＋”新增用例高亮：仅保留在本次页面生命周期（刷新后清空），避免写入 localStorage/DB。
    var tempExecNewAddedCaseUiKeysByFileId = {};
    function ensureTempExecNewAddedStore(fileId) {
      var id = fileId ? String(fileId) : '';
      if (!id) id = 'unknown';
      if (!tempExecNewAddedCaseUiKeysByFileId[id] || typeof tempExecNewAddedCaseUiKeysByFileId[id] !== 'object') {
        tempExecNewAddedCaseUiKeysByFileId[id] = {};
      }
      return tempExecNewAddedCaseUiKeysByFileId[id];
    }
    function ensureTempExecNonEnumerableKey(obj, keyName, value) {
      var core = typeof window !== 'undefined' && window.app ? window.app.uiIdentityCore : null;
      if (!core || typeof core.ensureNonEnumerableKey !== 'function') return '';
      return core.ensureNonEnumerableKey(obj, keyName, value);
    }
    function getTempExecCaseUiKeys(item) {
      if (!item || typeof item !== 'object') return [];
      var keys = [];
      var uiKey = '';
      try { uiKey = String(item.__uiKey || ''); } catch (_) { uiKey = ''; }
      if (uiKey) keys.push(uiKey);
      var cid = item.execCaseId || item.id || null;
      if (cid) keys.push('id-' + String(cid));
      var tmpId = item._tempId ? String(item._tempId) : '';
      if (tmpId) keys.push('tmp-' + tmpId);
      return keys;
    }
    function ensureTempExecNewAddedUiKey(item) {
      if (!item || typeof item !== 'object') return '';
      var key = '';
      try { key = String(item.__uiKey || ''); } catch (_) { key = ''; }
      if (key) return key;
      return ensureTempExecNonEnumerableKey(item, '__uiKey', '');
    }
    function markTempExecNewAdded(fileId, item) {
      var store = ensureTempExecNewAddedStore(fileId);
      var keys = getTempExecCaseUiKeys(item);
      if (!keys.length) {
        var ensured = ensureTempExecNewAddedUiKey(item);
        if (ensured) keys = [ensured];
      }
      keys.forEach(function(k) { if (k) store[k] = true; });
    }
    function unmarkTempExecNewAdded(fileId, item) {
      var store = ensureTempExecNewAddedStore(fileId);
      var keys = getTempExecCaseUiKeys(item);
      keys.forEach(function(k) { if (k) delete store[k]; });
      var ensured = '';
      try { ensured = String(item && item.__uiKey ? item.__uiKey : ''); } catch (_) { ensured = ''; }
      if (ensured) delete store[ensured];
    }
    function isTempExecNewAdded(fileId, item) {
      var store = ensureTempExecNewAddedStore(fileId);
      var keys = getTempExecCaseUiKeys(item);
      for (var i = 0; i < keys.length; i += 1) {
        var k = keys[i];
        if (k && store && store[k] === true) return true;
      }
      return false;
    }

    var loadTempExecStateFromDb = function() {
      return persistenceApi.loadTempExecStateFromDb();
    };
    var loadTempExecState = function() {
      return persistenceApi.loadTempExecState();
    };
    var refreshTempExecStateOnTabActivation = function() {
      return persistenceApi.refreshTempExecStateOnTabActivation();
    };
    var buildCaseItemPayloadFromTempCase = importParserApi.buildCaseItemPayloadFromTempCase;
    var buildExecImportPayloadFromTempCase = importParserApi.buildExecImportPayloadFromTempCase;
    var buildTempExecCasesFromXlsxRows = importParserApi.buildTempExecCasesFromXlsxRows;
    var importTempExecFilesToDb = function(fileList, projectId, versionId, execVersionId) {
      return dbImportApi.importTempExecFilesToDb(fileList, projectId, versionId, execVersionId);
    };

    function notifyTempExecActiveChange(fileId) {
      if (!state || typeof state.onTempExecActiveChange !== 'function') return;
      try {
        state.onTempExecActiveChange(fileId);
      } catch (err) {
        // ignore
      }
    }

    function setTempExecActive(fileId) {
      if (fileId && getTempExecFile(fileId)) {
        state.tempExecActiveId = fileId;
        ensureTempExecPageIndex(fileId);
        try {
          var active = getTempExecFile(fileId);
          if (active) {
            state.tempExecLastActiveContext = {
              projectId: active.projectId ? String(active.projectId) : '',
              versionId: active.versionId !== null && active.versionId !== undefined ? String(active.versionId || '') : '',
            };
          }
        } catch (err) {
          // ignore
        }
      } else if (!fileId) {
        state.tempExecActiveId = '';
      } else {
        state.tempExecActiveId = '';
      }
      state.tempExecMindMode = false;
      if (state.tempExecPresetDraft && state.tempExecPresetDraft.fileId !== state.tempExecActiveId) {
        state.tempExecPresetDraft = null;
      }
      persistTempExecState();
      renderTempExecNav();
      renderTempExecView();
      renderTempVersionGrid();
      renderTempFocusZone();
      notifyTempExecActiveChange(state.tempExecActiveId);
    }

    function reorderTempRequirement(sourceReq, targetReq) {
      var src = normalizeRequirementName(sourceReq);
      var tgt = normalizeRequirementName(targetReq);
      if (!src || !tgt || src === tgt) return;
      reorderRequirementOrder(src, tgt);
      renderTempExecNav();
      renderTempVersionGrid();
    }

    var loadTempExecFocus = function() {
      return persistenceApi.loadTempExecFocus();
    };

    function notifyTempExecFocusChange() {
      if (!state || typeof state.onTempExecFocusChange !== 'function') return;
      try {
        state.onTempExecFocusChange();
      } catch (err) {
        // ignore
      }
    }

    function syncTempExecFocus(skipSave) {
      var valid = state.tempExecFocus.filter(function(id) { return Boolean(getTempExecFile(id)); });
      if (valid.length !== state.tempExecFocus.length) {
        state.tempExecFocus = valid;
        if (!skipSave) saveTempExecFocus();
      } else if (!skipSave) {
        saveTempExecFocus();
      }
      notifyTempExecFocusChange();
    }

    function addTempExecFocus(fileId) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      if (state.tempExecFocus[0] === fileId) return;
      state.tempExecFocus = [fileId].concat(state.tempExecFocus.filter(function(id) { return id !== fileId; }));
      saveTempExecFocus();
      scheduleTempExecUiSave();
      if (state.tempExecActiveId !== fileId) {
        setTempExecActive(fileId);
      } else {
        renderTempExecNav();
        renderTempVersionGrid();
      }
      renderTempFocusZone();
      notifyTempExecFocusChange();
    }

    function insertTempExecFocus(fileId, insertIndex) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var list = (state.tempExecFocus || []).filter(function(id) { return id !== fileId; });
      var idx = Number(insertIndex);
      if (!Number.isFinite(idx)) idx = list.length;
      if (idx < 0) idx = 0;
      if (idx > list.length) idx = list.length;
      list.splice(idx, 0, fileId);
      state.tempExecFocus = list;
      saveTempExecFocus();
      scheduleTempExecUiSave();
      if (state.tempExecActiveId !== fileId) {
        setTempExecActive(fileId);
      } else {
        renderTempExecNav();
        renderTempVersionGrid();
        renderTempFocusZone();
      }
      notifyTempExecFocusChange();
    }

    function removeTempExecFocus(fileId, requireConfirm) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var needConfirm = requireConfirm !== false;
      if (needConfirm) {
        var confirmed = window.confirm('确定将【' + file.name + '】移出专注区吗？');
        if (!confirmed) return;
      }
      state.tempExecFocus = state.tempExecFocus.filter(function(id) { return id !== fileId; });
      file.scope = 'history';
      persistTempExecState();
      saveTempExecFocus();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempFocusZone();
      notifyTempExecFocusChange();
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('app-settings-loaded', function() {
        renderTempExecView();
      });
      window.addEventListener('app-settings-updated', function(e) {
        var detail = e && e.detail ? e.detail : null;
        var keys = detail && Array.isArray(detail.keys) ? detail.keys : [];
        var touchedAi = keys.indexOf('missingCaseReminderAiEnabled') !== -1;
        if (touchedAi) {
          var reminder = ensureTempExecMissingReminderState();
          if (resolveMissingReminderAiEnabled() !== 'on') {
            clearTempExecMissingReminderAi(reminder);
          }
        }
        if (!keys.length
          || keys.indexOf('missingCaseReminderPlacement') !== -1
          || keys.indexOf('missingCaseReminderMatchConfig') !== -1
          || touchedAi) {
          renderTempExecView();
        }
      });
      window.addEventListener('missing-reminder-ai-task', function(e) {
        var detail = e && e.detail ? e.detail : null;
        if (!detail || detail.scene !== 'temp-exec') return;
        if (resolveMissingReminderAiEnabled() !== 'on') return;
        var reminder = ensureTempExecMissingReminderState();
        if (applyTempExecMissingReminderAiTaskState(reminder, detail.task)) {
          renderTempExecView();
        }
      });
    }

    return {
      normalizeTempExecCases: normalizeTempExecCases,
      normalizeTempExecPlacement: normalizeTempExecPlacement,
      serializeSingleTempExecFile: serializeSingleTempExecFile,
      serializeTempExecFiles: serializeTempExecFiles,
      serializeTempExecVersions: serializeTempExecVersions,
      serializeTempExecSnapshot: serializeTempExecSnapshot,
      exportTempExecSnapshot: exportTempExecSnapshot,
      importTempExecSnapshot: importTempExecSnapshot,
      applyTempExecSnapshot: applyTempExecSnapshot,
      createTempExecFile: createTempExecFile,
      exportTempExecToXmind: exportTempExecToXmind,
      exportTempExecCasesToXmind: exportTempExecCasesToXmind,
      loadTempExecState: loadTempExecState,
      refreshTempExecStateOnTabActivation: refreshTempExecStateOnTabActivation,
      importTempExecFiles: importTempExecFiles,
      importTempExecFilesToDb: importTempExecFilesToDb,
      ensureTempExecPlacement: ensureTempExecPlacement,
      ensureRequirementOrder: ensureRequirementOrder,
      ensureFileOrder: ensureFileOrder,
      ensureVersionOrder: ensureVersionOrder,
      reorderRequirementOrder: reorderRequirementOrder,
      updateVersionOrder: updateVersionOrder,
      removeFileFromOrder: removeFileFromOrder,
      insertFileIntoOrder: insertFileIntoOrder,
      syncTempExecPlacement: syncTempExecPlacement,
      moveTempExecFileToRequirement: moveTempExecFileToRequirement,
      clampTempExecPageSize: clampTempExecPageSize,
      loadTempExecPageSizeSetting: loadTempExecPageSizeSetting,
      saveTempExecPageSizeSetting: saveTempExecPageSizeSetting,
      ensureTempExecPageIndex: ensureTempExecPageIndex,
      getTempExecPageSize: getTempExecPageSize,
      resetTempExecPages: resetTempExecPages,
      setTempExecPage: setTempExecPage,
      changeTempExecPage: changeTempExecPage,
      applyTempExecPageSize: applyTempExecPageSize,
      ensureTempVersionList: ensureTempVersionList,
      getTempVersion: getTempVersion,
      applyVersionAssignments: applyVersionAssignments,
      isVersionNameDuplicate: isVersionNameDuplicate,
      createTempVersion: createTempVersion,
      removeTempExecFromVersion: removeTempExecFromVersion,
      removeTempGroupFromVersion: removeTempGroupFromVersion,
      moveTempExecToVersion: moveTempExecToVersion,
      moveTempExecFileWithinVersion: moveTempExecFileWithinVersion,
      getVersionRequirementBlocks: getVersionRequirementBlocks,
      parseReqPayload: parseReqPayload,
      reorderVersionRequirement: reorderVersionRequirement,
      moveRequirementToVersion: moveRequirementToVersion,
      moveRequirementOutOfVersion: moveRequirementOutOfVersion,
      removeTempVersion: removeTempVersion,
      reorderTempVersion: reorderTempVersion,
      renameTempVersion: renameTempVersion,
      getTempVersionName: getTempVersionName,
      ensureTempExecSelection: ensureTempExecSelection,
      resetTempExecSelections: resetTempExecSelections,
      ensureTempExecRemarkOpen: ensureTempExecRemarkOpen,
      resetTempExecRemarkOpen: resetTempExecRemarkOpen,
      ensureTempExecReuseOpen: ensureTempExecReuseOpen,
      resetTempExecReuseOpen: resetTempExecReuseOpen,
      ensureTempExecDefectOpen: ensureTempExecDefectOpen,
      resetTempExecDefectOpen: resetTempExecDefectOpen,
      clearTempExecCaseStates: clearTempExecCaseStates,
      ensureDefectLinks: ensureDefectLinks,
      addTempExecDefectLink: addTempExecDefectLink,
      removeTempExecDefectLink: removeTempExecDefectLink,
      updateTempExecDefectLink: updateTempExecDefectLink,
      openTempExecDefectLink: openTempExecDefectLink,
      toggleTempExecDefectPanel: toggleTempExecDefectPanel,
      applyTempExecSearch: applyTempExecSearch,
      setTempExecStatusFilter: setTempExecStatusFilter,
      getTempExecFile: getTempExecFile,
      getTempExecOrderedFileIds: getTempExecOrderedFileIds,
      getTempExecFilesByRequirement: getTempExecFilesByRequirement,
      setTempExecActive: setTempExecActive,
      updateTempExecResult: updateTempExecResult,
      updateTempExecRemark: updateTempExecRemark,
      pushTempExecUndo: pushTempExecUndo,
      clearTempExecUndo: clearTempExecUndo,
      restoreTempExecUndo: restoreTempExecUndo,
      cleanupTempExecUndoUI: cleanupTempExecUndoUI,
      startTempExecUndoTimer: startTempExecUndoTimer,
      showTempExecBlockHint: showTempExecBlockHint,
      insertTempExecCase: insertTempExecCase,
      appendTempExecAiCases: appendTempExecAiCases,
      removeTempExecCase: removeTempExecCase,
      updateTempExecCaseField: updateTempExecCaseField,
      toggleTempExecSelection: toggleTempExecSelection,
      toggleTempExecSelectAll: toggleTempExecSelectAll,
      removeTempExecFile: removeTempExecFile,
      reorderTempRequirement: reorderTempRequirement,
      persistTempExecState: persistTempExecState,
      renderTempExecNav: renderTempExecNav,
      renderTempExecView: renderTempExecView,
      triggerTempExecMissingReminderAiRecommend: triggerTempExecMissingReminderAiRecommend,
      renderTempVersionGrid: renderTempVersionGrid,
      renderTempExecTable: renderTempExecTable,
      renderTempExecOverview: renderTempExecOverview,
      syncTempExecReuseStatusAlign: syncTempExecReuseStatusAlign,
      renderTempFocusZone: renderTempFocusZone,
      toggleTempExecRequirementZone: toggleTempExecRequirementZone,
      toggleTempExecVersionZone: toggleTempExecVersionZone,
      setTempExecImportProjectFilter: setTempExecImportProjectFilter,
      isTempExecProjectLayoutEnabled: isTempExecProjectLayoutEnabled,
      reorderTempExecProject: reorderTempExecProject,
      reorderTempExecProjectVersion: reorderTempExecProjectVersion,
      reorderTempExecFileInProjectVersion: reorderTempExecFileInProjectVersion,
      removeTempExecProject: removeTempExecProject,
      removeTempExecProjectVersion: removeTempExecProjectVersion,
      dissolveTempExecArchivedProjectVersion: dissolveTempExecArchivedProjectVersion,
      scrollTempExecViewTop: scrollTempExecViewTop,
      ensureReusePresets: ensureReusePresets,
      startTempExecPresetDraft: startTempExecPresetDraft,
      cancelTempExecPresetDraft: cancelTempExecPresetDraft,
      updateTempExecPresetDraft: updateTempExecPresetDraft,
      confirmTempExecPresetDraft: confirmTempExecPresetDraft,
      renameTempExecPreset: renameTempExecPreset,
      updateTempExecPresetApplicability: updateTempExecPresetApplicability,
      applyTempExecReuseApplicability: applyTempExecReuseApplicability,
      removeTempExecPreset: removeTempExecPreset,
      toggleTempExecReusePanel: toggleTempExecReusePanel,
      addTempExecReuseEntry: addTempExecReuseEntry,
      removeTempExecReuseEntry: removeTempExecReuseEntry,
      syncTempExecReuseStatusFromFirst: syncTempExecReuseStatusFromFirst,
      updateTempExecReuseStatus: updateTempExecReuseStatus,
      updateTempExecReuseText: updateTempExecReuseText,
      updateTempExecReuseNote: updateTempExecReuseNote,
      handleTempExecReuseToggle: handleTempExecReuseToggle,
      getCaseExecutionDisplay: getCaseExecutionDisplay,
      loadTempExecFocus: loadTempExecFocus,
      saveTempExecFocus: saveTempExecFocus,
      syncTempExecFocus: syncTempExecFocus,
      addTempExecFocus: addTempExecFocus,
      insertTempExecFocus: insertTempExecFocus,
      removeTempExecFocus: removeTempExecFocus,
      prioritizeTempExecUnassignedRequirements: prioritizeTempExecUnassignedRequirements,
      openTempExecCaseLibraryDiffDrawer: openTempExecCaseLibraryDiffDrawer,
      tryAutoOpenTempExecCaseLibraryDiff: tryAutoOpenTempExecCaseLibraryDiff,
      jumpToTempExecCase: jumpToTempExecCase,
    };
  }

  window.app = window.app || {};
  window.app.tempexecCore = { init: init };
})();
