(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.casesGenGenerationOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var runtime = opts.runtime || {};
    var state = opts.state;
    var config = opts.config;
    var sanitizeCasesForExport = opts.sanitizeCasesForExport;
    var normalizeRequirementName = opts.normalizeRequirementName;
    var defaultPrompts = opts.defaultPrompts;
    var casesGenerationContainer = opts.casesGenerationContainer;
    var caseGenStatus = opts.caseGenStatus;
    var caseGenTimingEl = opts.caseGenTimingEl;
    var caseGenStoreModeNewBtn = opts.caseGenStoreModeNewBtn;
    var caseGenStoreModeAppendBtn = opts.caseGenStoreModeAppendBtn;
    var caseGenStoreModeNewPanel = opts.caseGenStoreModeNewPanel;
    var caseGenStoreModeAppendPanel = opts.caseGenStoreModeAppendPanel;
    var caseGenRequirementDrawerHint = opts.caseGenRequirementDrawerHint;
    var caseGenRequirementDrawerInput = opts.caseGenRequirementDrawerInput;
    var caseGenRequirementDrawerConfirmBtn = opts.caseGenRequirementDrawerConfirmBtn;
    var caseGenRequirementDrawerCancelBtn = opts.caseGenRequirementDrawerCancelBtn;
    var caseGenRequirementDrawerStatus = opts.caseGenRequirementDrawerStatus;
    var caseGenModuleGenerateDrawerTitle = opts.caseGenModuleGenerateDrawerTitle;
    var caseGenModuleGenerateDrawerHint = opts.caseGenModuleGenerateDrawerHint;
    var caseGenModuleGenerateDrawerModuleTitle = opts.caseGenModuleGenerateDrawerModuleTitle;
    var caseGenModuleGenerateDrawerScenarios = opts.caseGenModuleGenerateDrawerScenarios;
    var caseGenModuleGenerateDrawerPoints = opts.caseGenModuleGenerateDrawerPoints;
    var caseGenModuleGenerateDrawerCoupled = opts.caseGenModuleGenerateDrawerCoupled;
    var caseGenModuleGenerateGlobalTabBtn = opts.caseGenModuleGenerateGlobalTabBtn;
    var caseGenModuleGenerateLocalTabBtn = opts.caseGenModuleGenerateLocalTabBtn;
    var caseGenModuleGenerateTopupTabBtn = opts.caseGenModuleGenerateTopupTabBtn;
    var caseGenModuleGenerateGlobalPanel = opts.caseGenModuleGenerateGlobalPanel;
    var caseGenModuleGenerateLocalPanel = opts.caseGenModuleGenerateLocalPanel;
    var caseGenModuleGenerateTopupPanel = opts.caseGenModuleGenerateTopupPanel;
    var caseGenModuleGenerateDrawerGlobalSummary = opts.caseGenModuleGenerateDrawerGlobalSummary;
    var caseGenModuleGenerateGlobalConfirmBtn = opts.caseGenModuleGenerateGlobalConfirmBtn;
    var caseGenModuleLocalRequirementEl = opts.caseGenModuleLocalRequirementEl;
    var caseGenModuleLocalNeedFunctionConditionEl = opts.caseGenModuleLocalNeedFunctionConditionEl;
    var caseGenModuleLocalNeedNumericValidationEl = opts.caseGenModuleLocalNeedNumericValidationEl;
    var caseGenModuleLocalNeedBoundaryEl = opts.caseGenModuleLocalNeedBoundaryEl;
    var caseGenModuleLocalNeedMobileEl = opts.caseGenModuleLocalNeedMobileEl;
    var caseGenModuleLocalNeedSpecialEl = opts.caseGenModuleLocalNeedSpecialEl;
    var caseGenModuleLocalSpecialOptionsEl = opts.caseGenModuleLocalSpecialOptionsEl;
    var caseGenModuleLocalSpecialRepeatOperationEl = opts.caseGenModuleLocalSpecialRepeatOperationEl;
    var caseGenModuleLocalSpecialMultiTouchEl = opts.caseGenModuleLocalSpecialMultiTouchEl;
    var caseGenModuleLocalSpecialRepeatExecutionEl = opts.caseGenModuleLocalSpecialRepeatExecutionEl;
    var caseGenModuleLocalSpecialWeakNetworkEl = opts.caseGenModuleLocalSpecialWeakNetworkEl;
    var caseGenModuleLocalSpecialInterruptResumeEl = opts.caseGenModuleLocalSpecialInterruptResumeEl;
    var caseGenModuleGenerateLocalConfirmBtn = opts.caseGenModuleGenerateLocalConfirmBtn;
    var caseGenModuleTopupSuggestionEl = opts.caseGenModuleTopupSuggestionEl;
    var caseGenModuleTopupHint = opts.caseGenModuleTopupHint;
    var caseGenModuleGenerateTopupConfirmBtn = opts.caseGenModuleGenerateTopupConfirmBtn;
    var caseGenModuleGenerateDrawerStatus = opts.caseGenModuleGenerateDrawerStatus;
    var caseGenActionDrawerTitle = opts.caseGenActionDrawerTitle;
    var caseGenActionDrawerHint = opts.caseGenActionDrawerHint;
    var caseGenActionDrawerRequirementSummary = opts.caseGenActionDrawerRequirementSummary;
    var caseGenActionDrawerConfirmBtn = opts.caseGenActionDrawerConfirmBtn;
    var caseGenActionDrawerStatus = opts.caseGenActionDrawerStatus;
    var caseGenAllGenerateBtn = opts.caseGenAllGenerateBtn;
    var caseGenAllTopupBtn = opts.caseGenAllTopupBtn;
    var caseGenSuggestionGenerateBtn = opts.caseGenSuggestionGenerateBtn;
    var caseGenSettingsTabBtn = opts.caseGenSettingsTabBtn;
    var caseGenLegacyModulesTabBtn = opts.caseGenLegacyModulesTabBtn;
    var caseGenModulesTabBtn = opts.caseGenModulesTabBtn;
    var casegenSettingsPanel = opts.casegenSettingsPanel;
    var casegenLegacyModulesPanel = opts.casegenLegacyModulesPanel;
    var casegenModulesPanel = opts.casegenModulesPanel;
    var caseGenCustomRequirementEl = opts.caseGenCustomRequirementEl;
    var caseGenNeedFunctionConditionEl = opts.caseGenNeedFunctionConditionEl;
    var caseGenNeedNumericValidationEl = opts.caseGenNeedNumericValidationEl;
    var caseGenNeedBoundaryEl = opts.caseGenNeedBoundaryEl;
    var caseGenNeedMobileEl = opts.caseGenNeedMobileEl;
    var caseGenNeedSpecialEl = opts.caseGenNeedSpecialEl;
    var caseGenSpecialOptionsEl = opts.caseGenSpecialOptionsEl;
    var caseGenSpecialRepeatOperationEl = opts.caseGenSpecialRepeatOperationEl;
    var caseGenSpecialMultiTouchEl = opts.caseGenSpecialMultiTouchEl;
    var caseGenSpecialRepeatExecutionEl = opts.caseGenSpecialRepeatExecutionEl;
    var caseGenSpecialWeakNetworkEl = opts.caseGenSpecialWeakNetworkEl;
    var caseGenSpecialInterruptResumeEl = opts.caseGenSpecialInterruptResumeEl;
    var setStatus = opts.setStatus;
    var unwrapRequirementPayload = opts.unwrapRequirementPayload;
    var promptRequirementLabel = opts.promptRequirementLabel;
    var setRequirementLabel = opts.setRequirementLabel;
    var ensureRequirementLabel = opts.ensureRequirementLabel;
    var getRequirementLabel = opts.getRequirementLabel;
    var getCleanedTextForModel = opts.getCleanedTextForModel;
    var getModuleSuggestion = opts.getModuleSuggestion;
    var getAssignedModel = opts.getAssignedModel;
    var getReasoningForType = opts.getReasoningForType;
    var getTemperatureForType = opts.getTemperatureForType;
    var callModelWithConfig = opts.callModelWithConfig;
    var updateModelTiming = opts.updateModelTiming;
    var runConcurrent = opts.runConcurrent;
    var hasImportedCases = opts.hasImportedCases;
    var getImportedCaseObjects = opts.getImportedCaseObjects;
    var renderCaseGenProgressBoard = opts.renderCaseGenProgressBoard;
    var clearCaseProgress = opts.clearCaseProgress;
    var initCaseProgress = opts.initCaseProgress;
    var setCaseProgressGroupState = opts.setCaseProgressGroupState;
    var setCaseProgressStep = opts.setCaseProgressStep;
    var markAllCaseProgressGroups = opts.markAllCaseProgressGroups;
    var persistWorkflowState = opts.persistWorkflowState;
    var setCaseModuleRunning = opts.setCaseModuleRunning;
    var isCaseModuleRunning = opts.isCaseModuleRunning;
    var setCaseModuleStatus = opts.setCaseModuleStatus;
    var extractJsonObjects = opts.extractJsonObjects;
    var stringifyCaseField = opts.stringifyCaseField;
    var ensureCaseModuleStatusState = typeof opts.ensureCaseModuleStatusState === 'function' ? opts.ensureCaseModuleStatusState : noop;
    var hasPendingXmindDrawerRestoreIntent = typeof opts.hasPendingXmindDrawerRestoreIntent === 'function' ? opts.hasPendingXmindDrawerRestoreIntent : noop;
    var setCaseModuleTiming = typeof opts.setCaseModuleTiming === 'function' ? opts.setCaseModuleTiming : noop;
    var closeCaseViewIfActive = typeof opts.closeCaseViewIfActive === 'function' ? opts.closeCaseViewIfActive : noop;
    var updateSupplementButtons = typeof opts.updateSupplementButtons === 'function' ? opts.updateSupplementButtons : noop;
    var refreshCaseSelectionUI = typeof opts.refreshCaseSelectionUI === 'function' ? opts.refreshCaseSelectionUI : noop;
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function' ? opts.openConfirmDrawer : noop;
    var resolveCaseGenActiveDrawer = typeof opts.resolveCaseGenActiveDrawer === 'function' ? opts.resolveCaseGenActiveDrawer : noop;
    var getCaseListForModule = typeof opts.getCaseListForModule === 'function' ? opts.getCaseListForModule : noop;
    var syncLegacyCaseGenState = typeof opts.syncLegacyCaseGenState === 'function' ? opts.syncLegacyCaseGenState : noop;
    var restoreLegacyCaseGenState = typeof opts.restoreLegacyCaseGenState === 'function' ? opts.restoreLegacyCaseGenState : noop;
    var renderCaseGeneration = typeof opts.renderCaseGeneration === 'function' ? opts.renderCaseGeneration : noop;

    function ensureCaseGenRequirementDrawer() {
      if (runtime.caseGenRequirementDrawer) return runtime.caseGenRequirementDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      runtime.caseGenRequirementDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenRequirementDrawer',
        closeButtons: ['closeCaseGenRequirementDrawerBtn'],
        onClose: function() {
          if (caseGenRequirementDrawerInput && caseGenRequirementDrawerInput.classList) {
            caseGenRequirementDrawerInput.classList.remove('input-invalid');
          }
          if (caseGenRequirementDrawerStatus) setStatus(caseGenRequirementDrawerStatus, '', '');
          if (runtime.caseGenRequirementDrawerExternal && typeof runtime.caseGenRequirementDrawerExternal.resolve === 'function') {
            var ext = runtime.caseGenRequirementDrawerExternal;
            runtime.caseGenRequirementDrawerExternal = null;
            try { ext.resolve(''); } catch (err) {}
          }
        },
      });

      function resolveExternal(text, shouldClose) {
        if (runtime.caseGenRequirementDrawerExternal && typeof runtime.caseGenRequirementDrawerExternal.resolve === 'function') {
          var ext = runtime.caseGenRequirementDrawerExternal;
          runtime.caseGenRequirementDrawerExternal = null;
          try { ext.resolve(text || ''); } catch (err) {}
        }
        if (shouldClose && runtime.caseGenRequirementDrawer && typeof runtime.caseGenRequirementDrawer.close === 'function') {
          runtime.caseGenRequirementDrawer.close();
        }
      }

      if (caseGenRequirementDrawerConfirmBtn) {
        caseGenRequirementDrawerConfirmBtn.addEventListener('click', function() {
          if (!caseGenRequirementDrawerInput) {
            resolveExternal('', true);
            return;
          }
          var raw = String(caseGenRequirementDrawerInput.value || '').trim();
          var normalized = normalizeRequirementName(raw);
          if (!normalized) {
            if (caseGenRequirementDrawerStatus) setStatus(caseGenRequirementDrawerStatus, '请填写需求标识（不可为空）', 'warn');
            if (caseGenRequirementDrawerInput.classList) caseGenRequirementDrawerInput.classList.add('input-invalid');
            try { caseGenRequirementDrawerInput.focus(); } catch (_) {}
            return;
          }
          if (normalized.length > 20) {
            if (caseGenRequirementDrawerStatus) setStatus(caseGenRequirementDrawerStatus, '需求标识最长 20 个汉字（或 20 个字符）', 'warn');
            if (caseGenRequirementDrawerInput.classList) caseGenRequirementDrawerInput.classList.add('input-invalid');
            try { caseGenRequirementDrawerInput.focus(); } catch (_) {}
            return;
          }
          if (caseGenRequirementDrawerInput.classList) caseGenRequirementDrawerInput.classList.remove('input-invalid');
          setRequirementLabel(normalized, 'manual');
          resolveExternal(normalized, true);
        });
      }
      if (caseGenRequirementDrawerCancelBtn) {
        caseGenRequirementDrawerCancelBtn.addEventListener('click', function() {
          resolveExternal('', true);
        });
      }
      return runtime.caseGenRequirementDrawer;
    }

    function syncCaseGenActionDrawerSummary() {
      if (!caseGenActionDrawerRequirementSummary) return;
      var settings = normalizeCaseGenPromptSettings(runtime.caseGenActionDrawerDraftSettings || ensureCaseGenSettings());
      caseGenActionDrawerRequirementSummary.textContent = describeCaseGenPromptSettings(settings, '未填写，将按默认要求生成。');
    }

    function findCaseGenModule(moduleId) {
      if (!moduleId || !Array.isArray(state.caseGenModules)) return null;
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        if (mod && String(mod.id || '') === String(moduleId)) return mod;
      }
      return null;
    }

    function formatCaseGenModuleField(value) {
      if (Array.isArray(value)) {
        var list = value.map(function(item) { return stringifyCaseField(item || ''); }).filter(Boolean);
        return list.length ? list.join('、') : '未填写';
      }
      var text = stringifyCaseField(value || '');
      return text || '未填写';
    }

    function describeCaseGenPromptSettings(settingsSource, emptyText) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || {});
      var labels = [];
      var customRequirement = stringifyCaseField(settings.customRequirement || '');
      var specialNames = [];
      if (customRequirement) labels.push('额外要求：' + customRequirement);
      if (settings.needFunctionCondition) labels.push('考虑功能使用条件');
      if (settings.needNumericValidation) labels.push('数值验证');
      if (settings.needBoundary) labels.push('考虑边界');
      if (settings.needMobile) labels.push('考虑移动设备操作');
      if (settings.needSpecial) {
        if (settings.specialRepeatOperation) specialNames.push('重复操作');
        if (settings.specialMultiTouch) specialNames.push('多点触控');
        if (settings.specialRepeatExecution) specialNames.push('重复执行');
        if (settings.specialWeakNetwork) specialNames.push('弱网');
        if (settings.specialInterruptResume) specialNames.push('中断恢复');
        labels.push(specialNames.length ? ('特殊场景：' + specialNames.join(' / ')) : '考虑特殊场景');
      }
      return labels.length ? labels.join('；') : (emptyText || '未填写，将按默认要求生成。');
    }

    function normalizeCaseGenActionContext(context) {
      var source = context && typeof context === 'object' ? context : {};
      if (source.type === 'settings') {
        return {
          type: 'settings',
          action: 'settings',
        };
      }
      if (source.type === 'module-local') {
        return {
          type: 'module-local',
          action: 'generate',
          moduleId: String(source.moduleId || ''),
        };
      }
      return {
        type: 'batch',
        action: source.action === 'topup' ? 'topup' : (source.action === 'suggested' ? 'suggested' : 'generate'),
      };
    }

    function getCaseGenActionMeta(context) {
      var ctxMeta = normalizeCaseGenActionContext(context);
      if (ctxMeta.type === 'settings') {
        return {
          action: 'settings',
          title: '生成要求确认',
          hint: '在这里维护当前 XMind 用例生成与全模块生成共用的额外要求；保存后不会立即触发生成。',
          confirmText: '保存要求',
        };
      }
      if (ctxMeta.type === 'module-local') {
        var moduleInfo = findCaseGenModule(ctxMeta.moduleId);
        var moduleTitle = resolveModuleTitle(moduleInfo && (moduleInfo.title || moduleInfo.module));
        return {
          action: 'generate',
          title: '模块独立生成确认',
          hint: '当前只对【' + moduleTitle + '】生效；以下额外要求仅用于这一次生成，不会写入全局设置，也不会被其他模块复用。',
          confirmText: '确认并生成',
        };
      }
      if (ctxMeta.action === 'topup') {
        return {
          action: 'topup',
          title: '全模块补全生成确认',
          hint: '请填写本轮额外要求，并确认是否需要考虑边界、移动端和特殊场景；确认后再执行全模块补全生成。',
          confirmText: '确认并补全',
        };
      }
      if (ctxMeta.action === 'suggested') {
        return {
          action: 'suggested',
          title: '仅补全用例确认',
          hint: '请填写本轮额外要求，并确认是否需要考虑边界、移动端和特殊场景；确认后只执行填写了生成建议的模块。',
          confirmText: '确认并执行',
        };
      }
      return {
        action: 'generate',
        title: '全模块直接生成确认',
        hint: '请填写本轮额外要求，并确认是否需要考虑边界、移动端和特殊场景；确认后再执行全模块直接生成。',
        confirmText: '确认并生成',
      };
    }

    function runCaseGenBatchAction(action) {
      if (action === 'topup') return topUpAllCaseGenModules();
      if (action === 'suggested') return generateSuggestedCaseGenModules();
      return generateAllCaseGenModules();
    }

    function executeCaseGenActionContext(context, promptSettingsSnapshot) {
      var ctxMeta = normalizeCaseGenActionContext(context);
      if (ctxMeta.type === 'settings') {
        applyCaseGenPromptSettings(normalizeCaseGenPromptSettings(promptSettingsSnapshot || createEmptyCaseGenPromptSettings()));
        return true;
      }
      if (ctxMeta.type === 'module-local') {
        if (!ctxMeta.moduleId) return false;
        return generateCasesForModule(ctxMeta.moduleId, {
          promptSettingsSnapshot: normalizeCaseGenPromptSettings(promptSettingsSnapshot || createEmptyCaseGenPromptSettings()),
        });
      }
      setCaseGenViewTab('legacy-modules');
      return runCaseGenBatchAction(ctxMeta.action);
    }

    function normalizeCaseGenModuleDrawerTab(tab) {
      if (tab === 'local' || tab === 'topup') return tab;
      return 'global';
    }

    function createCaseGenModuleGenerateState(moduleId) {
      return {
        moduleId: String(moduleId || ''),
        activeTab: 'global',
        localSettings: createEmptyCaseGenPromptSettings(),
        topupSuggestion: getModuleSuggestion(moduleId),
      };
    }

    function setCaseGenModuleSuggestionDraft(moduleId, value, persist) {
      if (!moduleId) return;
      if (!state.caseGenSuggestions || typeof state.caseGenSuggestions !== 'object') {
        state.caseGenSuggestions = {};
      }
      state.caseGenSuggestions[moduleId] = String(value || '');
      var suggestionArea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-suggestion="' + moduleId + '"]');
      if (suggestionArea) suggestionArea.value = state.caseGenSuggestions[moduleId];
      if (persist === true) {
        persistWorkflowState();
      }
      renderCaseGenProgressBoard();
      refreshCaseGenBatchButtons();
    }

    function syncCaseGenModuleLocalSpecialOptionsState(settingsSource) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || {});
      var enabled = settings.needSpecial === true;
      var inputs = [
        caseGenModuleLocalSpecialRepeatOperationEl,
        caseGenModuleLocalSpecialMultiTouchEl,
        caseGenModuleLocalSpecialRepeatExecutionEl,
        caseGenModuleLocalSpecialWeakNetworkEl,
        caseGenModuleLocalSpecialInterruptResumeEl,
      ];
      if (caseGenModuleLocalSpecialOptionsEl && caseGenModuleLocalSpecialOptionsEl.classList) {
        caseGenModuleLocalSpecialOptionsEl.classList.toggle('is-disabled', !enabled);
      }
      inputs.forEach(function(input) {
        if (!input) return;
        input.disabled = !enabled;
      });
    }

    function syncCaseGenModuleLocalInputs(settingsSource) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || {});
      if (caseGenModuleLocalRequirementEl) caseGenModuleLocalRequirementEl.value = settings.customRequirement || '';
      if (caseGenModuleLocalNeedFunctionConditionEl) caseGenModuleLocalNeedFunctionConditionEl.checked = settings.needFunctionCondition === true;
      if (caseGenModuleLocalNeedNumericValidationEl) caseGenModuleLocalNeedNumericValidationEl.checked = settings.needNumericValidation === true;
      if (caseGenModuleLocalNeedBoundaryEl) caseGenModuleLocalNeedBoundaryEl.checked = settings.needBoundary === true;
      if (caseGenModuleLocalNeedMobileEl) caseGenModuleLocalNeedMobileEl.checked = settings.needMobile === true;
      if (caseGenModuleLocalNeedSpecialEl) caseGenModuleLocalNeedSpecialEl.checked = settings.needSpecial === true;
      if (caseGenModuleLocalSpecialRepeatOperationEl) caseGenModuleLocalSpecialRepeatOperationEl.checked = settings.specialRepeatOperation === true;
      if (caseGenModuleLocalSpecialMultiTouchEl) caseGenModuleLocalSpecialMultiTouchEl.checked = settings.specialMultiTouch === true;
      if (caseGenModuleLocalSpecialRepeatExecutionEl) caseGenModuleLocalSpecialRepeatExecutionEl.checked = settings.specialRepeatExecution === true;
      if (caseGenModuleLocalSpecialWeakNetworkEl) caseGenModuleLocalSpecialWeakNetworkEl.checked = settings.specialWeakNetwork === true;
      if (caseGenModuleLocalSpecialInterruptResumeEl) caseGenModuleLocalSpecialInterruptResumeEl.checked = settings.specialInterruptResume === true;
      syncCaseGenModuleLocalSpecialOptionsState(settings);
    }

    function setCaseGenModuleLocalSettingValue(key, value) {
      if (!runtime.pendingCaseGenModuleGenerateState) return null;
      var settings = runtime.pendingCaseGenModuleGenerateState.localSettings || createEmptyCaseGenPromptSettings();
      if (key === 'customRequirement') {
        settings.customRequirement = String(value || '');
      } else {
        settings[key] = value === true;
        if (key === 'needSpecial' && value !== true) {
          settings.specialRepeatOperation = false;
          settings.specialMultiTouch = false;
          settings.specialRepeatExecution = false;
          settings.specialWeakNetwork = false;
          settings.specialInterruptResume = false;
        }
      }
      runtime.pendingCaseGenModuleGenerateState.localSettings = normalizeCaseGenPromptSettings(settings);
      syncCaseGenModuleLocalInputs(runtime.pendingCaseGenModuleGenerateState.localSettings);
      return runtime.pendingCaseGenModuleGenerateState.localSettings;
    }

    function getCaseGenModuleGenerateHasResult(moduleId) {
      return getCaseListForModule(moduleId).length > 0;
    }

    function setCaseGenModuleGenerateDrawerTab(tab) {
      var normalizedTab = normalizeCaseGenModuleDrawerTab(tab);
      var moduleState = runtime.pendingCaseGenModuleGenerateState;
      var moduleId = moduleState && moduleState.moduleId ? moduleState.moduleId : '';
      var hasResult = moduleId ? getCaseGenModuleGenerateHasResult(moduleId) : false;
      if (moduleState) {
        moduleState.activeTab = normalizedTab;
      }
      if (caseGenModuleGenerateGlobalTabBtn && caseGenModuleGenerateGlobalTabBtn.classList) {
        caseGenModuleGenerateGlobalTabBtn.classList.toggle('is-active', normalizedTab === 'global');
        caseGenModuleGenerateGlobalTabBtn.setAttribute('aria-selected', normalizedTab === 'global' ? 'true' : 'false');
      }
      if (caseGenModuleGenerateLocalTabBtn && caseGenModuleGenerateLocalTabBtn.classList) {
        caseGenModuleGenerateLocalTabBtn.classList.toggle('is-active', normalizedTab === 'local');
        caseGenModuleGenerateLocalTabBtn.setAttribute('aria-selected', normalizedTab === 'local' ? 'true' : 'false');
      }
      if (caseGenModuleGenerateTopupTabBtn && caseGenModuleGenerateTopupTabBtn.classList) {
        caseGenModuleGenerateTopupTabBtn.classList.toggle('is-active', normalizedTab === 'topup');
        caseGenModuleGenerateTopupTabBtn.setAttribute('aria-selected', normalizedTab === 'topup' ? 'true' : 'false');
      }
      if (caseGenModuleGenerateGlobalPanel && caseGenModuleGenerateGlobalPanel.classList) {
        caseGenModuleGenerateGlobalPanel.classList.toggle('is-active', normalizedTab === 'global');
      }
      if (caseGenModuleGenerateLocalPanel && caseGenModuleGenerateLocalPanel.classList) {
        caseGenModuleGenerateLocalPanel.classList.toggle('is-active', normalizedTab === 'local');
      }
      if (caseGenModuleGenerateTopupPanel && caseGenModuleGenerateTopupPanel.classList) {
        caseGenModuleGenerateTopupPanel.classList.toggle('is-active', normalizedTab === 'topup');
      }
      if (normalizedTab === 'global') {
        if (caseGenModuleGenerateDrawerHint) {
          caseGenModuleGenerateDrawerHint.textContent = '当前模块将直接沿用已确认的全局生成配置；模块自身的测试场景、测试要点、耦合模块与生成建议仍会照常参与本次生成。';
        }
      } else if (normalizedTab === 'local') {
        if (caseGenModuleGenerateDrawerHint) {
          caseGenModuleGenerateDrawerHint.textContent = '当前模块可单独配置本次生成要求；该配置优先于全局，但只在这一次生效，不会写回全局设置。';
        }
        syncCaseGenModuleLocalInputs(moduleState && moduleState.localSettings ? moduleState.localSettings : createEmptyCaseGenPromptSettings());
      } else {
        if (caseGenModuleGenerateDrawerHint) {
          caseGenModuleGenerateDrawerHint.textContent = '补全生成只使用当前模块的生成建议与已有用例，不继承全局或独立配置勾选。';
        }
        if (caseGenModuleTopupSuggestionEl) {
          caseGenModuleTopupSuggestionEl.value = moduleState ? String(moduleState.topupSuggestion || '') : '';
        }
        if (caseGenModuleTopupHint) {
          caseGenModuleTopupHint.textContent = hasResult
            ? '补全生成会在当前模块已有用例基础上，结合这里的生成建议补充新增用例。'
            : '当前模块暂无已生成用例，无法执行补全生成；请先通过“全局配置优先”或“独立配置优先”生成用例。';
        }
        if (caseGenModuleGenerateTopupConfirmBtn) {
          caseGenModuleGenerateTopupConfirmBtn.disabled = !hasResult;
        }
      }
      if (normalizedTab !== 'topup' && caseGenModuleGenerateTopupConfirmBtn) {
        caseGenModuleGenerateTopupConfirmBtn.disabled = !hasResult;
      }
      if (caseGenModuleGenerateDrawerStatus) setStatus(caseGenModuleGenerateDrawerStatus, '', '');
    }

    function syncCaseGenModuleGenerateDrawer(moduleId) {
      var mod = findCaseGenModule(moduleId);
      if (!mod) return false;
      if (!runtime.pendingCaseGenModuleGenerateState || runtime.pendingCaseGenModuleGenerateState.moduleId !== String(moduleId || '')) {
        runtime.pendingCaseGenModuleGenerateState = createCaseGenModuleGenerateState(moduleId);
      }
      if (caseGenModuleGenerateDrawerTitle) caseGenModuleGenerateDrawerTitle.textContent = '模块生成方式确认';
      if (caseGenModuleGenerateDrawerModuleTitle) {
        caseGenModuleGenerateDrawerModuleTitle.textContent = resolveModuleTitle(mod.title || mod.module || '');
      }
      if (caseGenModuleGenerateDrawerScenarios) {
        caseGenModuleGenerateDrawerScenarios.textContent = formatCaseGenModuleField(mod.scenarios);
      }
      if (caseGenModuleGenerateDrawerPoints) {
        caseGenModuleGenerateDrawerPoints.textContent = formatCaseGenModuleField(mod.points);
      }
      if (caseGenModuleGenerateDrawerCoupled) {
        caseGenModuleGenerateDrawerCoupled.textContent = formatCaseGenModuleField(mod.coupled);
      }
      if (caseGenModuleGenerateDrawerGlobalSummary) {
        caseGenModuleGenerateDrawerGlobalSummary.textContent = describeCaseGenPromptSettings(
          createCaseGenPromptSettingsSnapshot(),
          '当前全局生成配置将按共享设置执行，可切换到全局页签查看或调整。'
        );
      }
      syncCaseGenModuleLocalInputs(runtime.pendingCaseGenModuleGenerateState.localSettings);
      if (caseGenModuleTopupSuggestionEl) {
        caseGenModuleTopupSuggestionEl.value = String(runtime.pendingCaseGenModuleGenerateState.topupSuggestion || '');
      }
      setCaseGenModuleGenerateDrawerTab(runtime.pendingCaseGenModuleGenerateState.activeTab || 'global');
      return true;
    }

    function ensureCaseGenModuleGenerateDrawer() {
      if (runtime.caseGenModuleGenerateDrawer) return runtime.caseGenModuleGenerateDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      runtime.caseGenModuleGenerateDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenModuleGenerateDrawer',
        closeButtons: ['closeCaseGenModuleGenerateDrawerBtn'],
        onOpen: function() {
          if (runtime.pendingCaseGenModuleGenerateState && runtime.pendingCaseGenModuleGenerateState.moduleId) {
            syncCaseGenModuleGenerateDrawer(runtime.pendingCaseGenModuleGenerateState.moduleId);
          }
        },
        onClose: function() {
          runtime.pendingCaseGenModuleGenerateState = null;
          if (caseGenModuleGenerateDrawerStatus) setStatus(caseGenModuleGenerateDrawerStatus, '', '');
        },
      });
      if (caseGenModuleGenerateGlobalTabBtn) {
        caseGenModuleGenerateGlobalTabBtn.addEventListener('click', function() {
          setCaseGenModuleGenerateDrawerTab('global');
        });
      }
      if (caseGenModuleGenerateLocalTabBtn) {
        caseGenModuleGenerateLocalTabBtn.addEventListener('click', function() {
          setCaseGenModuleGenerateDrawerTab('local');
        });
      }
      if (caseGenModuleGenerateTopupTabBtn) {
        caseGenModuleGenerateTopupTabBtn.addEventListener('click', function() {
          setCaseGenModuleGenerateDrawerTab('topup');
        });
      }
      if (caseGenModuleLocalRequirementEl) {
        caseGenModuleLocalRequirementEl.addEventListener('input', function() {
          setCaseGenModuleLocalSettingValue('customRequirement', caseGenModuleLocalRequirementEl.value || '');
        });
      }
      if (caseGenModuleLocalNeedFunctionConditionEl) {
        caseGenModuleLocalNeedFunctionConditionEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needFunctionCondition', caseGenModuleLocalNeedFunctionConditionEl.checked === true);
        });
      }
      if (caseGenModuleLocalNeedNumericValidationEl) {
        caseGenModuleLocalNeedNumericValidationEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needNumericValidation', caseGenModuleLocalNeedNumericValidationEl.checked === true);
        });
      }
      if (caseGenModuleLocalNeedBoundaryEl) {
        caseGenModuleLocalNeedBoundaryEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needBoundary', caseGenModuleLocalNeedBoundaryEl.checked === true);
        });
      }
      if (caseGenModuleLocalNeedMobileEl) {
        caseGenModuleLocalNeedMobileEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needMobile', caseGenModuleLocalNeedMobileEl.checked === true);
        });
      }
      if (caseGenModuleLocalNeedSpecialEl) {
        caseGenModuleLocalNeedSpecialEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needSpecial', caseGenModuleLocalNeedSpecialEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialRepeatOperationEl) {
        caseGenModuleLocalSpecialRepeatOperationEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialRepeatOperation', caseGenModuleLocalSpecialRepeatOperationEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialMultiTouchEl) {
        caseGenModuleLocalSpecialMultiTouchEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialMultiTouch', caseGenModuleLocalSpecialMultiTouchEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialRepeatExecutionEl) {
        caseGenModuleLocalSpecialRepeatExecutionEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialRepeatExecution', caseGenModuleLocalSpecialRepeatExecutionEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialWeakNetworkEl) {
        caseGenModuleLocalSpecialWeakNetworkEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialWeakNetwork', caseGenModuleLocalSpecialWeakNetworkEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialInterruptResumeEl) {
        caseGenModuleLocalSpecialInterruptResumeEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialInterruptResume', caseGenModuleLocalSpecialInterruptResumeEl.checked === true);
        });
      }
      if (caseGenModuleTopupSuggestionEl) {
        caseGenModuleTopupSuggestionEl.addEventListener('input', function() {
          if (!runtime.pendingCaseGenModuleGenerateState) return;
          runtime.pendingCaseGenModuleGenerateState.topupSuggestion = String(caseGenModuleTopupSuggestionEl.value || '');
        });
      }
      if (caseGenModuleGenerateGlobalConfirmBtn) {
        caseGenModuleGenerateGlobalConfirmBtn.addEventListener('click', function() {
          var moduleState = runtime.pendingCaseGenModuleGenerateState;
          var moduleId = moduleState && moduleState.moduleId ? moduleState.moduleId : '';
          runtime.pendingCaseGenModuleGenerateState = null;
          if (runtime.caseGenModuleGenerateDrawer && typeof runtime.caseGenModuleGenerateDrawer.close === 'function') {
            runtime.caseGenModuleGenerateDrawer.close();
          }
          if (!moduleId) return;
          setTimeout(function() {
            generateCasesForModule(moduleId, {
              promptSettingsSnapshot: createCaseGenPromptSettingsSnapshot(),
            });
          }, 0);
        });
      }
      if (caseGenModuleGenerateLocalConfirmBtn) {
        caseGenModuleGenerateLocalConfirmBtn.addEventListener('click', function() {
          var moduleState = runtime.pendingCaseGenModuleGenerateState;
          var moduleId = moduleState && moduleState.moduleId ? moduleState.moduleId : '';
          var localSettings = moduleState && moduleState.localSettings
            ? normalizeCaseGenPromptSettings(moduleState.localSettings)
            : createEmptyCaseGenPromptSettings();
          runtime.pendingCaseGenModuleGenerateState = null;
          if (runtime.caseGenModuleGenerateDrawer && typeof runtime.caseGenModuleGenerateDrawer.close === 'function') {
            runtime.caseGenModuleGenerateDrawer.close();
          }
          if (!moduleId) return;
          setTimeout(function() {
            generateCasesForModule(moduleId, {
              promptSettingsSnapshot: localSettings,
            });
          }, 0);
        });
      }
      if (caseGenModuleGenerateTopupConfirmBtn) {
        caseGenModuleGenerateTopupConfirmBtn.addEventListener('click', function() {
          var moduleState = runtime.pendingCaseGenModuleGenerateState;
          var moduleId = moduleState && moduleState.moduleId ? moduleState.moduleId : '';
          var topupSuggestion = moduleState ? String(moduleState.topupSuggestion || '') : '';
          runtime.pendingCaseGenModuleGenerateState = null;
          if (runtime.caseGenModuleGenerateDrawer && typeof runtime.caseGenModuleGenerateDrawer.close === 'function') {
            runtime.caseGenModuleGenerateDrawer.close();
          }
          if (!moduleId) return;
          setCaseGenModuleSuggestionDraft(moduleId, topupSuggestion, true);
          setTimeout(function() {
            topUpCasesForModule(moduleId, {
              promptSettingsSnapshot: createEmptyCaseGenPromptSettings(),
            });
          }, 0);
        });
      }
      return runtime.caseGenModuleGenerateDrawer;
    }

    function ensureCaseGenActionDrawer() {
      if (runtime.caseGenActionDrawer) return runtime.caseGenActionDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      runtime.caseGenActionDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenActionDrawer',
        closeButtons: ['closeCaseGenActionDrawerBtn', 'caseGenActionDrawerCancelBtn'],
        onOpen: function() {
          if (!runtime.caseGenActionDrawerDraftSettings) {
            runtime.caseGenActionDrawerDraftSettings = createEmptyCaseGenPromptSettings();
          }
          syncCaseGenPromptInputs(runtime.caseGenActionDrawerDraftSettings);
          syncCaseGenActionDrawerSummary();
          if (caseGenActionDrawerStatus) setStatus(caseGenActionDrawerStatus, '', '');
        },
        onClose: function() {
          runtime.pendingCaseGenActionContext = null;
          runtime.caseGenActionDrawerDraftSettings = null;
          syncCaseGenPromptInputs(ensureCaseGenSettings());
          if (caseGenActionDrawerStatus) setStatus(caseGenActionDrawerStatus, '', '');
        },
      });
      if (caseGenActionDrawerConfirmBtn) {
        caseGenActionDrawerConfirmBtn.addEventListener('click', function() {
          var context = normalizeCaseGenActionContext(runtime.pendingCaseGenActionContext);
          var promptSettingsSnapshot = null;
          runtime.pendingCaseGenActionContext = null;
          if (runtime.caseGenActionDrawerDraftSettings) {
            if (caseGenCustomRequirementEl) {
              runtime.caseGenActionDrawerDraftSettings.customRequirement = String(caseGenCustomRequirementEl.value || '');
            }
            promptSettingsSnapshot = normalizeCaseGenPromptSettings(runtime.caseGenActionDrawerDraftSettings);
            if (context.type === 'batch') {
              applyCaseGenPromptSettings(promptSettingsSnapshot);
            }
            runtime.caseGenActionDrawerDraftSettings = null;
          }
          if (runtime.caseGenActionDrawer && typeof runtime.caseGenActionDrawer.close === 'function') {
            runtime.caseGenActionDrawer.close();
          }
          setTimeout(function() {
            executeCaseGenActionContext(context, promptSettingsSnapshot);
          }, 0);
        });
      }
      return runtime.caseGenActionDrawer;
    }

    function openCaseGenActionDrawerByContext(context) {
      var normalizedContext = normalizeCaseGenActionContext(context);
      var meta = getCaseGenActionMeta(normalizedContext);
      var drawer = ensureCaseGenActionDrawer();
      if (!drawer || typeof drawer.open !== 'function') {
        return executeCaseGenActionContext(normalizedContext, createEmptyCaseGenPromptSettings());
      }
      runtime.pendingCaseGenActionContext = normalizedContext;
      runtime.caseGenActionDrawerDraftSettings = createEmptyCaseGenPromptSettings();
      if (caseGenActionDrawerTitle) caseGenActionDrawerTitle.textContent = meta.title;
      if (caseGenActionDrawerHint) caseGenActionDrawerHint.textContent = meta.hint;
      if (caseGenActionDrawerConfirmBtn) caseGenActionDrawerConfirmBtn.textContent = meta.confirmText;
      syncCaseGenPromptInputs(runtime.caseGenActionDrawerDraftSettings);
      syncCaseGenActionDrawerSummary();
      if (caseGenActionDrawerStatus) setStatus(caseGenActionDrawerStatus, '', '');
      drawer.open();
      return true;
    }

    function openCaseGenBatchActionDrawer(action) {
      return openCaseGenActionDrawerByContext({
        type: 'batch',
        action: action,
      });
    }

    function openCaseGenSettingsDrawer() {
      return openCaseGenActionDrawerByContext({
        type: 'settings',
      });
    }

    function openCaseGenModuleGenerateDrawer(moduleId) {
      var mod = findCaseGenModule(moduleId);
      if (!mod) {
        setStatus(caseGenStatus, '未找到对应模块，无法继续生成', 'warn');
        return false;
      }
      var drawer = ensureCaseGenModuleGenerateDrawer();
      if (!drawer || typeof drawer.open !== 'function') {
        return generateCasesForModule(moduleId, {
          promptSettingsSnapshot: createCaseGenPromptSettingsSnapshot(),
        });
      }
      runtime.pendingCaseGenModuleGenerateState = createCaseGenModuleGenerateState(moduleId);
      syncCaseGenModuleGenerateDrawer(moduleId);
      drawer.open();
      return true;
    }

    function promptRequirementLabelByDrawer(promptText) {
      var drawer = ensureCaseGenRequirementDrawer();
      if (!drawer || typeof drawer.open !== 'function') {
        return Promise.resolve(promptRequirementLabel(promptText));
      }
      if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
      if (caseGenRequirementDrawerHint) {
        var suffix = '请填写本次需求名称，作为需求标识（不可为空）';
        var text = String(promptText || '').trim();
        caseGenRequirementDrawerHint.textContent = text ? (text + '；' + suffix) : suffix;
      }
      if (caseGenRequirementDrawerStatus) setStatus(caseGenRequirementDrawerStatus, '', '');
      if (caseGenRequirementDrawerInput) {
        if (caseGenRequirementDrawerInput.classList) caseGenRequirementDrawerInput.classList.remove('input-invalid');
        caseGenRequirementDrawerInput.value = getRequirementLabel(false) || '';
      }
      drawer.open();
      try {
        if (caseGenRequirementDrawerInput) caseGenRequirementDrawerInput.focus();
      } catch (_) {}
      return new Promise(function(resolve) {
        runtime.caseGenRequirementDrawerExternal = { resolve: resolve };
      });
    }

    function createDefaultCaseGenSettings() {
      return {
        activeTab: 'settings',
        storeMode: 'new',
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
      };
    }

    function normalizeCaseGenPromptSettings(raw) {
      var defaults = createDefaultCaseGenSettings();
      var source = raw && typeof raw === 'object' ? raw : {};
      return {
        customRequirement: source.customRequirement === undefined || source.customRequirement === null
          ? String(defaults.customRequirement || '')
          : String(source.customRequirement || ''),
        dedupeSimplify: source.dedupeSimplify === undefined
          ? defaults.dedupeSimplify === true
          : source.dedupeSimplify === true,
        needFunctionCondition: source.needFunctionCondition === undefined
          ? defaults.needFunctionCondition === true
          : source.needFunctionCondition === true,
        needNumericValidation: source.needNumericValidation === undefined
          ? defaults.needNumericValidation === true
          : source.needNumericValidation === true,
        needBoundary: source.needBoundary === undefined
          ? defaults.needBoundary === true
          : source.needBoundary === true,
        needMobile: source.needMobile === undefined
          ? defaults.needMobile === true
          : source.needMobile === true,
        needSpecial: source.needSpecial === undefined
          ? defaults.needSpecial === true
          : source.needSpecial === true,
        specialRepeatOperation: source.specialRepeatOperation === undefined
          ? defaults.specialRepeatOperation === true
          : source.specialRepeatOperation === true,
        specialMultiTouch: source.specialMultiTouch === undefined
          ? defaults.specialMultiTouch === true
          : source.specialMultiTouch === true,
        specialRepeatExecution: source.specialRepeatExecution === undefined
          ? defaults.specialRepeatExecution === true
          : source.specialRepeatExecution === true,
        specialWeakNetwork: source.specialWeakNetwork === undefined
          ? defaults.specialWeakNetwork === true
          : source.specialWeakNetwork === true,
        specialInterruptResume: source.specialInterruptResume === undefined
          ? defaults.specialInterruptResume === true
          : source.specialInterruptResume === true,
      };
    }

    function ensureCaseGenSettings() {
      var defaults = createDefaultCaseGenSettings();
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = defaults;
        return state.caseGenSettings;
      }
      Object.keys(defaults).forEach(function(key) {
        if (state.caseGenSettings[key] === undefined || state.caseGenSettings[key] === null) {
          state.caseGenSettings[key] = defaults[key];
        }
      });
      state.caseGenSettings.activeTab = state.caseGenSettings.activeTab === 'legacy-modules'
        ? 'legacy-modules'
        : (state.caseGenSettings.activeTab === 'xmind-modules' || state.caseGenSettings.activeTab === 'modules'
          ? 'xmind-modules'
          : 'settings');
      state.caseGenSettings.storeMode = state.caseGenSettings.storeMode === 'append' ? 'append' : 'new';
      state.caseGenSettings.customRequirement = String(state.caseGenSettings.customRequirement || '');
      state.caseGenSettings.dedupeSimplify = state.caseGenSettings.dedupeSimplify === true;
      state.caseGenSettings.needFunctionCondition = state.caseGenSettings.needFunctionCondition === true;
      state.caseGenSettings.needNumericValidation = state.caseGenSettings.needNumericValidation === true;
      state.caseGenSettings.needBoundary = state.caseGenSettings.needBoundary === true;
      state.caseGenSettings.needMobile = state.caseGenSettings.needMobile === true;
      state.caseGenSettings.needSpecial = state.caseGenSettings.needSpecial === true;
      state.caseGenSettings.specialRepeatOperation = state.caseGenSettings.specialRepeatOperation === true;
      state.caseGenSettings.specialMultiTouch = state.caseGenSettings.specialMultiTouch === true;
      state.caseGenSettings.specialRepeatExecution = state.caseGenSettings.specialRepeatExecution === true;
      state.caseGenSettings.specialWeakNetwork = state.caseGenSettings.specialWeakNetwork === true;
      state.caseGenSettings.specialInterruptResume = state.caseGenSettings.specialInterruptResume === true;
      return state.caseGenSettings;
    }

    function createCaseGenPromptSettingsSnapshot() {
      return normalizeCaseGenPromptSettings(ensureCaseGenSettings());
    }

    function createEmptyCaseGenPromptSettings() {
      return normalizeCaseGenPromptSettings({});
    }

    function syncCaseGenPromptInputs(settingsSource) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || ensureCaseGenSettings());
      if (caseGenCustomRequirementEl) caseGenCustomRequirementEl.value = settings.customRequirement || '';
      if (caseGenNeedFunctionConditionEl) caseGenNeedFunctionConditionEl.checked = settings.needFunctionCondition === true;
      if (caseGenNeedNumericValidationEl) caseGenNeedNumericValidationEl.checked = settings.needNumericValidation === true;
      if (caseGenNeedBoundaryEl) caseGenNeedBoundaryEl.checked = settings.needBoundary === true;
      if (caseGenNeedMobileEl) caseGenNeedMobileEl.checked = settings.needMobile === true;
      if (caseGenNeedSpecialEl) caseGenNeedSpecialEl.checked = settings.needSpecial === true;
      if (caseGenSpecialRepeatOperationEl) caseGenSpecialRepeatOperationEl.checked = settings.specialRepeatOperation === true;
      if (caseGenSpecialMultiTouchEl) caseGenSpecialMultiTouchEl.checked = settings.specialMultiTouch === true;
      if (caseGenSpecialRepeatExecutionEl) caseGenSpecialRepeatExecutionEl.checked = settings.specialRepeatExecution === true;
      if (caseGenSpecialWeakNetworkEl) caseGenSpecialWeakNetworkEl.checked = settings.specialWeakNetwork === true;
      if (caseGenSpecialInterruptResumeEl) caseGenSpecialInterruptResumeEl.checked = settings.specialInterruptResume === true;
      syncCaseGenSpecialOptionsState(settings);
    }

    function applyCaseGenPromptSettings(settingsSource) {
      var settings = ensureCaseGenSettings();
      var normalized = normalizeCaseGenPromptSettings(settingsSource);
      settings.customRequirement = normalized.customRequirement;
      settings.dedupeSimplify = normalized.dedupeSimplify;
      settings.needFunctionCondition = normalized.needFunctionCondition;
      settings.needNumericValidation = normalized.needNumericValidation;
      settings.needBoundary = normalized.needBoundary;
      settings.needMobile = normalized.needMobile;
      settings.needSpecial = normalized.needSpecial;
      settings.specialRepeatOperation = normalized.specialRepeatOperation;
      settings.specialMultiTouch = normalized.specialMultiTouch;
      settings.specialRepeatExecution = normalized.specialRepeatExecution;
      settings.specialWeakNetwork = normalized.specialWeakNetwork;
      settings.specialInterruptResume = normalized.specialInterruptResume;
      syncCaseGenPromptInputs(settings);
      persistWorkflowState();
      return settings;
    }

    function setCaseGenSettingValue(key, value) {
      var settings = ensureCaseGenSettings();
      if (key === 'customRequirement') {
        if (runtime.caseGenActionDrawerDraftSettings) {
          runtime.caseGenActionDrawerDraftSettings.customRequirement = String(value || '');
          syncCaseGenActionDrawerSummary();
          return runtime.caseGenActionDrawerDraftSettings;
        }
        settings.customRequirement = String(value || '');
        syncCaseGenActionDrawerSummary();
        persistWorkflowState();
        return settings;
      }
      if (
        key === 'dedupeSimplify' ||
        key === 'needFunctionCondition' ||
        key === 'needNumericValidation' ||
        key === 'needBoundary' ||
        key === 'needMobile' ||
        key === 'needSpecial' ||
        key === 'specialRepeatOperation' ||
        key === 'specialMultiTouch' ||
        key === 'specialRepeatExecution' ||
        key === 'specialWeakNetwork' ||
        key === 'specialInterruptResume'
      ) {
        if (runtime.caseGenActionDrawerDraftSettings) {
          runtime.caseGenActionDrawerDraftSettings[key] = value === true;
          if (key === 'needSpecial' && value !== true) {
            runtime.caseGenActionDrawerDraftSettings.specialRepeatOperation = false;
            runtime.caseGenActionDrawerDraftSettings.specialMultiTouch = false;
            runtime.caseGenActionDrawerDraftSettings.specialRepeatExecution = false;
            runtime.caseGenActionDrawerDraftSettings.specialWeakNetwork = false;
            runtime.caseGenActionDrawerDraftSettings.specialInterruptResume = false;
            syncCaseGenPromptInputs(runtime.caseGenActionDrawerDraftSettings);
            return runtime.caseGenActionDrawerDraftSettings;
          }
          syncCaseGenSpecialOptionsState(runtime.caseGenActionDrawerDraftSettings);
          return runtime.caseGenActionDrawerDraftSettings;
        }
        settings[key] = value === true;
        if (key === 'needSpecial' && value !== true) {
          settings.specialRepeatOperation = false;
          settings.specialMultiTouch = false;
          settings.specialRepeatExecution = false;
          settings.specialWeakNetwork = false;
          settings.specialInterruptResume = false;
          syncCaseGenPromptInputs(settings);
          persistWorkflowState();
          return settings;
        }
        syncCaseGenSpecialOptionsState(settings);
        persistWorkflowState();
        return settings;
      }
      settings[key] = value;
      persistWorkflowState();
      return settings;
    }

    function syncCaseGenSpecialOptionsState(settingsSource) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || runtime.caseGenActionDrawerDraftSettings || ensureCaseGenSettings());
      var enabled = settings.needSpecial === true;
      var inputs = [
        caseGenSpecialRepeatOperationEl,
        caseGenSpecialMultiTouchEl,
        caseGenSpecialRepeatExecutionEl,
        caseGenSpecialWeakNetworkEl,
        caseGenSpecialInterruptResumeEl,
      ];
      if (caseGenSpecialOptionsEl && caseGenSpecialOptionsEl.classList) {
        caseGenSpecialOptionsEl.classList.toggle('is-disabled', !enabled);
      }
      inputs.forEach(function(input) {
        if (!input) return;
        input.disabled = !enabled;
      });
    }

    function setCaseGenViewTab(tab, options) {
      var settings = ensureCaseGenSettings();
      var previous = settings.activeTab;
      var next = 'settings';
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var xmindDrawerOpen = Boolean(xmindApi && typeof xmindApi.isOpen === 'function' && xmindApi.isOpen());
      if (tab === 'legacy-modules') {
        next = 'legacy-modules';
      } else if (tab === 'xmind-modules' || tab === 'modules') {
        next = 'xmind-modules';
      }
      var changed = settings.activeTab !== next;
      settings.activeTab = next;
      if (caseGenSettingsTabBtn && caseGenSettingsTabBtn.classList) {
        caseGenSettingsTabBtn.classList.toggle('is-active', next === 'settings');
        caseGenSettingsTabBtn.setAttribute('aria-selected', next === 'settings' ? 'true' : 'false');
      }
      if (caseGenLegacyModulesTabBtn && caseGenLegacyModulesTabBtn.classList) {
        caseGenLegacyModulesTabBtn.classList.toggle('is-active', next === 'legacy-modules');
        caseGenLegacyModulesTabBtn.setAttribute('aria-selected', next === 'legacy-modules' ? 'true' : 'false');
      }
      if (caseGenModulesTabBtn && caseGenModulesTabBtn.classList) {
        caseGenModulesTabBtn.classList.toggle('is-active', next === 'xmind-modules');
        caseGenModulesTabBtn.setAttribute('aria-selected', next === 'xmind-modules' ? 'true' : 'false');
      }
      if (casegenSettingsPanel && casegenSettingsPanel.classList) {
        casegenSettingsPanel.classList.toggle('is-active', next === 'settings');
      }
      if (casegenLegacyModulesPanel && casegenLegacyModulesPanel.classList) {
        casegenLegacyModulesPanel.classList.toggle('is-active', next === 'legacy-modules');
      }
      if (casegenModulesPanel && casegenModulesPanel.classList) {
        casegenModulesPanel.classList.toggle('is-active', next === 'xmind-modules');
      }
      if (
        previous === 'xmind-modules'
        && (next === 'settings' || next === 'legacy-modules')
        && xmindApi
        && typeof xmindApi.syncActiveWorkspaceSnapshot === 'function'
      ) {
        xmindApi.syncActiveWorkspaceSnapshot({
          forceShared: true,
          skipSummaryDraftSync: true,
          skipViewStateCapture: true,
          render: false,
        });
      }
      if (next === 'settings' || next === 'legacy-modules') {
        if (!xmindDrawerOpen) {
          restoreLegacyCaseGenState({
            render: false,
            persist: false,
            restoreInputs: previous === 'xmind-modules',
          });
        }
      }
      if (next === 'xmind-modules' && !xmindDrawerOpen && xmindApi && typeof xmindApi.hydrateActiveWorkspaceSnapshot === 'function') {
        if (previous !== 'xmind-modules') {
          syncLegacyCaseGenState({ persist: false, force: true });
        }
        xmindApi.hydrateActiveWorkspaceSnapshot({
          keepDrawerOpen: hasPendingXmindDrawerRestoreIntent(),
        });
        ensureCaseGenSettings().activeTab = next;
      }
      if (next === 'legacy-modules' || next === 'xmind-modules') {
        renderCaseGeneration();
      }
      if (changed && (!options || options.persist !== false)) {
        persistWorkflowState();
      }
    }

    function setCaseGenStoreMode(mode, options) {
      var settings = ensureCaseGenSettings();
      var next = mode === 'append' ? 'append' : 'new';
      var changed = settings.storeMode !== next;
      settings.storeMode = next;
      if (caseGenStoreModeNewBtn && caseGenStoreModeNewBtn.classList) {
        caseGenStoreModeNewBtn.classList.toggle('is-active', next === 'new');
        caseGenStoreModeNewBtn.setAttribute('aria-selected', next === 'new' ? 'true' : 'false');
      }
      if (caseGenStoreModeAppendBtn && caseGenStoreModeAppendBtn.classList) {
        caseGenStoreModeAppendBtn.classList.toggle('is-active', next === 'append');
        caseGenStoreModeAppendBtn.setAttribute('aria-selected', next === 'append' ? 'true' : 'false');
      }
      if (caseGenStoreModeNewPanel && caseGenStoreModeNewPanel.classList) {
        caseGenStoreModeNewPanel.classList.toggle('is-active', next === 'new');
      }
      if (caseGenStoreModeAppendPanel && caseGenStoreModeAppendPanel.classList) {
        caseGenStoreModeAppendPanel.classList.toggle('is-active', next === 'append');
      }
      if (changed && (!options || options.persist !== false)) {
        persistWorkflowState();
      }
    }

    function getCaseGenPromptComponents(settingsOverride) {
      var settings = normalizeCaseGenPromptSettings(settingsOverride || ensureCaseGenSettings());
      var parts = [];
      var customRequirement = stringifyCaseField(settings.customRequirement || '');
      if (customRequirement) {
        parts.push('用户附加要求：' + customRequirement);
      }
      if (settings.needFunctionCondition) {
        parts.push('生成时需要考虑功能使用条件，覆盖功能或系统的解锁条件、可用条件、身份或等级门槛、资源消耗、前置任务和使用时间限制等。');
      }
      if (settings.needNumericValidation) {
        parts.push('生成时需要考虑数值验证，覆盖数值显示、取值范围、阈值变化、计算结果、累计或扣减和结算正确性等。');
      }
      if (settings.needBoundary) {
        parts.push('生成时需要考虑边界场景，覆盖数值上下限、临界条件、空值、满值、阈值切换和异常边界。');
      }
      if (settings.needMobile) {
        parts.push('生成时需要考虑移动设备操作，覆盖点击、长按、滑动、拖拽、横竖屏切换和系统手势干扰等手机交互场景。');
      }
      if (settings.needSpecial) {
        parts.push('生成时需要考虑特殊场景，补充异常路径、非理想环境和非常规用户操作下的用例。');
        if (settings.specialRepeatOperation) {
          parts.push('特殊场景需包含重复操作，例如连续点击、重复领取、重复提交、重复进入或重复处理。');
        }
        if (settings.specialMultiTouch) {
          parts.push('特殊场景需包含多点触控，例如双指缩放、双指拖拽、误触连击和多点同时操作。');
        }
        if (settings.specialRepeatExecution) {
          parts.push('特殊场景需包含重复执行，例如反复进入退出、重复触发流程、重复执行同一任务后的稳定性。');
        }
        if (settings.specialWeakNetwork) {
          parts.push('特殊场景需包含弱网环境，例如高延迟、丢包、断续连接、请求超时和重试恢复。');
        }
        if (settings.specialInterruptResume) {
          parts.push('特殊场景需包含中断恢复，例如来电、切后台、锁屏、应用重启后的恢复与状态一致性。');
        }
      }
      return parts;
    }

    function appendCaseWritingGuidePrompt(promptText) {
      var prompt = stringifyCaseField(promptText || '');
      var guide = config && config.caseWritingStyleGuidePrompt
        ? stringifyCaseField(config.caseWritingStyleGuidePrompt)
        : '';
      if (!guide) return prompt;
      if (prompt.indexOf('AI_CASE_WRITING_STYLE_GUIDE.md') !== -1) return prompt;
      return [prompt, guide].filter(Boolean).join('\n\n');
    }

    function buildCaseGenPrompt(basePrompt, settingsOverride) {
      var prompt = appendCaseWritingGuidePrompt(basePrompt || '');
      var parts = getCaseGenPromptComponents(settingsOverride);
      return [prompt].concat(parts).filter(Boolean).join('\n\n');
    }

    function resolveModuleTitle(name) {
      var text = stringifyCaseField(name || '');
      return text || '未命名模块';
    }

    function normalizeModuleKey(name) {
      var text = stringifyCaseField(name || '');
      return text ? text.toLowerCase() : '未命名模块';
    }

    function normalizeCaseTitle(title) {
      var text = stringifyCaseField(title || '');
      return text ? text.toLowerCase() : '';
    }

    function normalizeCaseListWithModules(list) {
      var normalized = [];
      var buckets = {};
      if (!Array.isArray(list)) return { normalized: normalized, buckets: buckets };
      list.forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var moduleTitle = resolveModuleTitle(item.module || item.module_name || item['模块']);
        var moduleKey = normalizeModuleKey(moduleTitle);
        var cloned = Object.assign({}, item);
        cloned.module = moduleTitle;
        normalized.push(cloned);
        if (!buckets[moduleKey]) buckets[moduleKey] = { title: moduleTitle, list: [] };
        buckets[moduleKey].list.push(cloned);
      });
      return { normalized: normalized, buckets: buckets };
    }

    function chunkArray(list, size) {
      if (!Array.isArray(list) || !list.length) return [];
      var chunkSize = Math.max(1, size || 5);
      var result = [];
      for (var i = 0; i < list.length; i += chunkSize) {
        result.push(list.slice(i, i + chunkSize));
      }
      return result;
    }

    function resolveCaseGenBatchConcurrency(count) {
      if (!Number.isFinite(count) || count <= 0) return 1;
      return Math.max(1, Math.min(5, Math.round(count)));
    }

    function resolveCaseSimilarityConcurrency(count) {
      if (!Number.isFinite(count) || count <= 0) return 1;
      return Math.max(1, Math.min(5, Math.round(count)));
    }

    function resolveCaseGenTimeoutSec() {
      var raw = state && state.settings ? Number(state.settings.timeoutSec) : NaN;
      var fallback = 300;
      if (!Number.isFinite(raw) || raw <= 0) return fallback;
      var normalized = Math.round(raw);
      if (!Number.isFinite(normalized) || normalized <= 0) return fallback;
      return Math.max(30, Math.min(1800, normalized));
    }

    function callCaseGenModelWithGuard(executor) {
      var task = typeof executor === 'function' ? executor : null;
      if (!task) return Promise.reject(new Error('模型调用任务不可用'));
      var timeoutSec = resolveCaseGenTimeoutSec();
      var timeoutMs = timeoutSec * 1000 + 1500;
      var timer = null;
      return new Promise(function(resolve, reject) {
        var settled = false;
        function finishError(err) {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          reject(err);
        }
        function finishOk(data) {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          resolve(data);
        }
        timer = setTimeout(function() {
          finishError(new Error('模型调用超时（超过 ' + timeoutSec + ' 秒），请重试或检查服务状态'));
        }, timeoutMs);
        Promise.resolve().then(function() {
          return task();
        }).then(function(result) {
          finishOk(result);
        }).catch(function(err) {
          finishError(err);
        });
      });
    }

    function parseGeneratedCases(content) {
      var unwrap = unwrapRequirementPayload(content);
      var normalized = typeof unwrap.payload === 'string'
        ? unwrap.payload
        : unwrap.payload
        ? JSON.stringify(unwrap.payload, null, 2)
        : '';
      normalized = (normalized || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;/gi, ' ');
      var parsed = [];
      var hadRecovery = false;
      try {
        parsed = JSON.parse(normalized || '[]');
        if (!Array.isArray(parsed)) parsed = [];
        if (parsed.length) normalized = JSON.stringify(parsed, null, 2);
      } catch (err) {
        parsed = extractJsonObjects(normalized);
        if (parsed.length) {
          normalized = JSON.stringify(parsed, null, 2);
          hadRecovery = true;
        }
      }
      return { parsed: parsed, normalized: normalized, hadRecovery: hadRecovery };
    }

    function hasGeneratedCases() {
      if (!state.caseGenModules || !state.caseGenModules.length) return false;
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        var list = getCaseListForModule(mod.id);
        if (list && list.length) return true;
      }
      return false;
    }

    function hasRunningCaseModules() {
      if (!state.caseGenModules || !state.caseGenModules.length) return false;
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        if (mod && mod.id && isCaseModuleRunning(mod.id)) return true;
      }
      return false;
    }

    function buildCaseGenModuleMeta() {
      var meta = [];
      if (!Array.isArray(state.caseGenModules)) return meta;
      state.caseGenModules.forEach(function(mod) {
        if (!mod || !mod.id) return;
        var title = resolveModuleTitle(mod.title || mod.module || '');
        var list = getCaseListForModule(mod.id);
        var running = isCaseModuleRunning(mod.id);
        var suggestion = getModuleSuggestion(mod.id);
        if (!running && state.caseGenRunning instanceof Set) {
          if (state.caseGenRunning.has(mod.id)) {
            running = true;
          } else if (state.caseGenRunning.has(String(mod.id))) {
            running = true;
          } else {
            var numericId = Number(mod.id);
            if (Number.isFinite(numericId) && state.caseGenRunning.has(numericId)) {
              running = true;
            }
          }
        }
        if (!running) {
          var statusInfo = ensureCaseModuleStatusState()[mod.id];
          var statusText = statusInfo && statusInfo.text ? String(statusInfo.text) : '';
          if (statusText.indexOf('生成中') !== -1 || statusText.indexOf('补全中') !== -1) {
            running = true;
          }
        }
        meta.push({
          id: mod.id,
          title: title,
          hasResult: Boolean(list && list.length),
          hasSuggestion: Boolean(suggestion),
          running: running,
        });
      });
      return meta;
    }

    function listGeneratedCaseGenModuleTitles(meta) {
      return (meta || []).filter(function(entry) {
        return entry && entry.hasResult;
      }).map(function(entry) {
        return entry.title;
      });
    }

    function refreshCaseGenBatchButtons() {
      if (!caseGenAllGenerateBtn) caseGenAllGenerateBtn = document.getElementById('caseGenAllGenerateBtn');
      if (!caseGenAllTopupBtn) caseGenAllTopupBtn = document.getElementById('caseGenAllTopupBtn');
      if (!caseGenSuggestionGenerateBtn) caseGenSuggestionGenerateBtn = document.getElementById('caseGenSuggestionGenerateBtn');
      if (!caseGenAllGenerateBtn && !caseGenAllTopupBtn && !caseGenSuggestionGenerateBtn) return;
      var meta = buildCaseGenModuleMeta();
      var hasGenerateTarget = false;
      var hasTopupTarget = false;
      var hasSuggestionTarget = false;
      var allRunning = meta.length > 0;
      meta.forEach(function(entry) {
        if (!entry) return;
        if (!entry.running) {
          hasGenerateTarget = true;
          if (entry.hasResult) hasTopupTarget = true;
          if (entry.hasSuggestion) hasSuggestionTarget = true;
          allRunning = false;
        }
      });
      if (caseGenAllGenerateBtn) caseGenAllGenerateBtn.disabled = !meta.length || !hasGenerateTarget || allRunning;
      if (caseGenAllTopupBtn) caseGenAllTopupBtn.disabled = !meta.length || !hasTopupTarget || allRunning;
      if (caseGenSuggestionGenerateBtn) caseGenSuggestionGenerateBtn.disabled = !meta.length || !hasSuggestionTarget || allRunning;
    }

    function confirmCaseGenBatchOverwrite(actionLabel, moduleNames) {
      if (!moduleNames.length) return Promise.resolve(true);
      var nameText = moduleNames.join('、');
      var label = actionLabel || '生成';
      var message = '检测到以下模块已有生成数据：' + nameText + '。继续将覆盖已有生成数据并执行全模块' + label + '，是否继续？';
      return openConfirmDrawer({
        title: '确认全模块' + label,
        message: message,
        confirmText: '继续' + label,
        cancelText: '取消',
        previousDrawer: resolveCaseGenActiveDrawer(),
      }).then(function(res) {
        return Boolean(res && res.ok === true);
      });
    }

    function runCaseGenBatch(action) {
      var meta = buildCaseGenModuleMeta();
      var actionLabel = action === 'topup' ? '补全生成' : '直接生成';
      if (!meta.length) {
        setStatus(caseGenStatus, '请先在“测试模块拆分”中生成模块', 'warn');
        return Promise.resolve(false);
      }
      var allRunning = meta.length > 0 && meta.every(function(entry) { return entry && entry.running; });
      if (allRunning) {
        setStatus(caseGenStatus, '全部模块正在生成中，无法执行全模块' + actionLabel, 'warn');
        return Promise.resolve(false);
      }
      if (action === 'topup') {
        var hasTopupTarget = meta.some(function(entry) {
          return entry && entry.hasResult && !entry.running;
        });
        if (!hasTopupTarget) {
          setStatus(caseGenStatus, '暂无可补全的模块，无法执行全模块' + actionLabel, 'warn');
          return Promise.resolve(false);
        }
      } else {
        var hasGenerateTarget = meta.some(function(entry) {
          return entry && !entry.running;
        });
        if (!hasGenerateTarget) {
          setStatus(caseGenStatus, '暂无可生成的模块，无法执行全模块' + actionLabel, 'warn');
          return Promise.resolve(false);
        }
      }
      var generatedModules = listGeneratedCaseGenModuleTitles(meta);
      return confirmCaseGenBatchOverwrite(actionLabel, generatedModules).then(function(ok) {
        if (!ok) {
          setStatus(caseGenStatus, '已取消全模块' + actionLabel, 'warn');
          return false;
        }
        var candidates = [];
        if (action === 'topup') {
          candidates = meta.filter(function(entry) {
            return entry && entry.hasResult && !entry.running;
          });
        } else if (generatedModules.length) {
          candidates = meta.filter(function(entry) { return entry && !entry.running; });
        } else {
          candidates = meta.filter(function(entry) {
            return entry && !entry.hasResult && !entry.running;
          });
        }
        if (!candidates.length) {
          var emptyMsg = action === 'topup' ? '暂无可补全的模块' : '暂无可生成的模块';
          setStatus(caseGenStatus, emptyMsg, 'warn');
          return false;
        }
        var skipped = meta.filter(function(entry) { return entry && entry.running; }).length;
        var concurrency = resolveCaseGenBatchConcurrency(candidates.length);
        var caseGenPromptValue = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
        var promptBase = caseGenPromptValue || defaultPrompts.casegen || '';
        var promptSettingsSnapshot = createCaseGenPromptSettingsSnapshot();
        var hint = '已触发全模块' + actionLabel + '（' + candidates.length + '个模块，并发 ' + concurrency + '）';
        if (skipped) hint += '，已跳过' + skipped + '个生成中的模块';
        setStatus(caseGenStatus, hint, 'ok');
        return runConcurrent(candidates, concurrency, function(entry) {
          if (!entry || !entry.id) return Promise.resolve(false);
          var runTask = action === 'topup' ? topUpCasesForModule : generateCasesForModule;
          return Promise.resolve().then(function() {
            return runTask(entry.id, {
              promptBase: promptBase,
              promptSettingsSnapshot: promptSettingsSnapshot,
            });
          }).catch(function(err) {
            var title = entry && entry.title ? String(entry.title) : '当前模块';
            var msg = err && err.message ? err.message : '未知异常';
            console.error('全模块' + actionLabel + '执行异常', err);
            setCaseModuleStatus(entry.id, '【' + title + '】' + actionLabel + '失败：' + msg, 'err');
            setCaseModuleRunning(entry.id, false);
            return false;
          });
        });
      });
    }

    function generateAllCaseGenModules() {
      return runCaseGenBatch('generate');
    }

    function topUpAllCaseGenModules() {
      return runCaseGenBatch('topup');
    }

    function generateSuggestedCaseGenModules() {
      var meta = buildCaseGenModuleMeta();
      if (!meta.length) {
        setStatus(caseGenStatus, '请先在“测试模块拆分”中生成模块', 'warn');
        return Promise.resolve(false);
      }
      var candidates = meta.filter(function(entry) {
        return entry && entry.hasSuggestion && !entry.running;
      });
      if (!candidates.length) {
        setStatus(caseGenStatus, '暂无包含生成建议的模块可执行仅补全用例', 'warn');
        return Promise.resolve(false);
      }
      var skipped = meta.filter(function(entry) {
        return entry && entry.hasSuggestion && entry.running;
      }).length;
      var concurrency = resolveCaseGenBatchConcurrency(candidates.length);
      var caseGenPromptValue = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
      var promptBase = caseGenPromptValue || defaultPrompts.casegen || '';
      var promptSettingsSnapshot = createCaseGenPromptSettingsSnapshot();
      var hint = '已触发仅补全用例（' + candidates.length + '个模块，并发 ' + concurrency + '）';
      if (skipped) hint += '，已跳过' + skipped + '个生成中的模块';
      setStatus(caseGenStatus, hint, 'ok');
      return runConcurrent(candidates, concurrency, function(entry) {
        if (!entry || !entry.id) return Promise.resolve(false);
        return Promise.resolve().then(function() {
          return generateCasesForModule(entry.id, {
            promptBase: promptBase,
            promptSettingsSnapshot: promptSettingsSnapshot,
          });
        }).catch(function(err) {
          var title = entry && entry.title ? String(entry.title) : '当前模块';
          var msg = err && err.message ? err.message : '未知异常';
          console.error('仅补全用例执行异常', err);
          setCaseModuleStatus(entry.id, '【' + title + '】仅补全用例失败：' + msg, 'err');
          setCaseModuleRunning(entry.id, false);
          return false;
        });
      });
    }

    function commitModuleCases(moduleId, payload) {
      if (!moduleId || !payload || payload.shouldCommit === false) return null;
      var rawResult = payload.rawResult;
      if (rawResult === undefined || rawResult === null) {
        rawResult = JSON.stringify(Array.isArray(payload.list) ? payload.list : [], null, 2);
      } else {
        rawResult = String(rawResult);
      }
      state.caseGenResults[moduleId] = rawResult;
      if (payload.selectionMode === 'keep-valid') {
        var currentSelection = state.caseSelections[moduleId];
        if (!currentSelection || typeof currentSelection.forEach !== 'function') {
          state.caseSelections[moduleId] = new Set();
        } else {
          var currentList = getCaseListForModule(moduleId);
          var validSelection = new Set();
          currentSelection.forEach(function(idx) {
            var num = Number(idx);
            if (Number.isFinite(num) && currentList[num]) validSelection.add(num);
          });
          state.caseSelections[moduleId] = validSelection;
        }
      } else {
        state.caseSelections[moduleId] = new Set();
      }
      if (payload.timingMs === null || payload.timingMs === undefined) {
        setCaseModuleTiming(moduleId);
      } else {
        setCaseModuleTiming(moduleId, Number(payload.timingMs));
      }
      if (payload.statusText !== undefined) {
        setCaseModuleStatus(moduleId, String(payload.statusText || ''), payload.statusType || '');
      }
      if (payload.finalizeStep) {
        setCaseProgressStep(moduleId, 'finalize', payload.finalizeStep);
      }
      closeCaseViewIfActive(moduleId);
      refreshCaseSelectionUI(moduleId);
      updateSupplementButtons(moduleId, payload.hasResult === true || getCaseListForModule(moduleId).length > 0);
      renderCaseGeneration();
      return {
        hasResult: getCaseListForModule(moduleId).length > 0,
        rawResult: rawResult,
      };
    }

    async function buildModuleCases(moduleId, options) {
      options = options || {};
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return null;
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再生成用例');
      if (!requirementLabel) {
        return {
          cancelled: true,
          statusText: '已取消生成：需求标识为空',
          statusType: 'warn',
        };
      }
      var cleanedContext = getCleanedTextForModel();
      var suggestion = getModuleSuggestion(moduleId);
      var model = getAssignedModel('casegen');
      var promptBase = options.promptBase;
      if (promptBase === undefined || promptBase === null || promptBase === '') {
        promptBase = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
        promptBase = promptBase || defaultPrompts.casegen || '';
      }
      var promptSettingsSnapshot = options.promptSettingsSnapshot;
      if (promptSettingsSnapshot === undefined || promptSettingsSnapshot === null) {
        promptSettingsSnapshot = createCaseGenPromptSettingsSnapshot();
      } else {
        promptSettingsSnapshot = normalizeCaseGenPromptSettings(promptSettingsSnapshot);
      }
      var prompt = buildCaseGenPrompt(promptBase, promptSettingsSnapshot);
      var ref = {
        module: mod.title,
        key_scenarios: mod.scenarios,
        test_points: mod.points,
        coupled_modules: mod.coupled,
      };
      var suggestionText = suggestion ? '\n\n用户附加要求：' + suggestion : '';
      var baseContext = cleanedContext
        ? '清洗后需求上下文：\n' + cleanedContext + '\n\n目标测试模块（JSON）：' + JSON.stringify(ref)
        : '测试模块信息（JSON）：' + JSON.stringify(ref);
      var userContent = baseContext + suggestionText + '\n请输出符合提示词要求的 JSON 数组。';
      var reasoning = getReasoningForType('casegen');
      var temperature = getTemperatureForType('casegen');
      var overallStart = Date.now();
      var startTime = Date.now();
      var content = await callCaseGenModelWithGuard(function() {
        return callModelWithConfig(model, userContent, prompt, reasoning, temperature);
      });
      var durationMs = Date.now() - startTime;
      var parsedInfo = parseGeneratedCases(content);
      var parsed = parsedInfo.parsed;
      var normalized = parsedInfo.normalized;
      var hadRecovery = parsedInfo.hadRecovery;
      if (!parsed.length) {
        if (state.caseGenProgress[moduleId]) {
          markAllCaseProgressGroups(moduleId, 'error');
          setCaseProgressStep(moduleId, 'dedupe', 'error');
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        return {
          action: 'generate',
          shouldCommit: true,
          rawResult: '[]',
          list: [],
          hasResult: false,
          timingMs: durationMs,
          statusText: '生成结果为空，请重新生成',
          statusType: 'warn',
          finalizeStep: 'error',
        };
      }
      var dedupInfo = { list: parsed, removed: 0, hadError: false, skipped: true };
      if (hasImportedCases()) {
        dedupInfo = await filterCasesAgainstImported(mod, parsed, '用例生成');
      } else {
        initCaseProgress(moduleId, chunkArray(parsed, 5));
        markAllCaseProgressGroups(moduleId, 'done');
        setCaseProgressStep(moduleId, 'dedupe', 'done');
      }
      if (!dedupInfo.skipped) {
        setCaseProgressStep(moduleId, 'finalize', 'running');
      }
      var filteredList = dedupInfo.list || [];
      var removedByFilter = dedupInfo.removed || 0;
      var filterHadError = dedupInfo.hadError || false;
      if (!filteredList.length) {
        if (!dedupInfo.skipped) setCaseProgressStep(moduleId, 'finalize', 'error');
        return {
          action: 'generate',
          shouldCommit: true,
          rawResult: '[]',
          list: [],
          hasResult: false,
          timingMs: durationMs,
          statusText: '生成的用例与导入用例重复，未保留新的用例',
          statusType: 'warn',
          finalizeStep: 'error',
        };
      }
      var finalJson = dedupInfo.skipped ? normalized : JSON.stringify(filteredList, null, 2);
      var durationSec = Math.max(1, Math.round((Date.now() - overallStart) / 1000));
      var parts = ['【' + mod.title + '】用例已生成 ' + filteredList.length + ' 条', '耗时 ' + durationSec + ' 秒'];
      if (removedByFilter) parts.push('剔除 ' + removedByFilter + ' 条重复用例');
      var message = hadRecovery
        ? parts.join('，') + '（检测到部分数据不完整，已保留完整条目）'
        : parts.join('，');
      return {
        action: 'generate',
        shouldCommit: true,
        rawResult: finalJson,
        list: filteredList,
        hasResult: true,
        timingMs: durationMs,
        statusText: message,
        statusType: hadRecovery || filterHadError ? 'warn' : 'ok',
        finalizeStep: 'done',
      };
    }

    async function buildModuleTopup(moduleId, options) {
      options = options || {};
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return null;
      var existingList = getCaseListForModule(moduleId);
      if (!existingList.length) {
        return {
          cancelled: true,
          statusText: '【' + resolveModuleTitle(mod.title || mod.module || '') + '】暂无原始用例，无法补全',
          statusType: 'warn',
        };
      }
      var cleanedContext = getCleanedTextForModel();
      var suggestion = getModuleSuggestion(moduleId);
      var model = getAssignedModel('casegen');
      var promptBase = options.promptBase;
      if (promptBase === undefined || promptBase === null || promptBase === '') {
        promptBase = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
        promptBase = promptBase || defaultPrompts.casegen || '';
      }
      var promptSettingsSnapshot = options.promptSettingsSnapshot;
      if (promptSettingsSnapshot === undefined || promptSettingsSnapshot === null) {
        promptSettingsSnapshot = createEmptyCaseGenPromptSettings();
      } else {
        promptSettingsSnapshot = normalizeCaseGenPromptSettings(promptSettingsSnapshot);
      }
      var prompt = buildCaseGenPrompt(promptBase, promptSettingsSnapshot);
      var ref = {
        module: mod.title,
        key_scenarios: mod.scenarios,
        test_points: mod.points,
        coupled_modules: mod.coupled,
      };
      var baseContext = cleanedContext
        ? '清洗后需求上下文：\n' + cleanedContext + '\n\n目标测试模块（JSON）：' + JSON.stringify(ref)
        : '测试模块信息（JSON）：' + JSON.stringify(ref);
      var existingJson = JSON.stringify(sanitizeCasesForExport(existingList));
      var suggestionText = suggestion ? '\n\n额外要求：' + suggestion : '';
      var userContent = baseContext + '\n\n已有用例(JSON)：' + existingJson + '\n请在不重复的前提下补充新的测试用例，仅返回新增用例的 JSON 数组。' + suggestionText;
      var reasoning = getReasoningForType('casegen');
      var temperature = getTemperatureForType('casegen');
      var overallStart = Date.now();
      var startTime = Date.now();
      var content = await callCaseGenModelWithGuard(function() {
        return callModelWithConfig(model, userContent, prompt, reasoning, temperature);
      });
      var durationMs = Date.now() - startTime;
      var parsedInfo = parseGeneratedCases(content);
      var parsed = parsedInfo.parsed;
      var hadRecovery = parsedInfo.hadRecovery;
      if (!parsed.length) {
        if (state.caseGenProgress[moduleId]) {
          markAllCaseProgressGroups(moduleId, 'error');
          setCaseProgressStep(moduleId, 'dedupe', 'error');
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        return {
          action: 'topup',
          shouldCommit: false,
          hasResult: existingList.length > 0,
          timingMs: durationMs,
          statusText: '未补充到新的用例，请调整提示后重试',
          statusType: 'warn',
          finalizeStep: 'error',
        };
      }
      var dedupInfo = { list: parsed, removed: 0, hadError: false, skipped: true };
      if (hasImportedCases()) {
        dedupInfo = await filterCasesAgainstImported(mod, parsed, '补全');
      } else {
        initCaseProgress(moduleId, chunkArray(parsed, 5));
        markAllCaseProgressGroups(moduleId, 'done');
        setCaseProgressStep(moduleId, 'dedupe', 'done');
      }
      if (!dedupInfo.skipped) setCaseProgressStep(moduleId, 'finalize', 'running');
      var filteredList = dedupInfo.list || [];
      if (!filteredList.length) {
        setCaseProgressStep(moduleId, 'finalize', 'error');
        return {
          action: 'topup',
          shouldCommit: false,
          hasResult: existingList.length > 0,
          timingMs: durationMs,
          statusText: '补全的用例与导入用例重复，已全部过滤',
          statusType: 'warn',
          finalizeStep: 'error',
        };
      }
      var appended = filteredList.map(function(item) { return Object.assign({}, item, { remark: '后补' }); });
      var updatedList = existingList.concat(appended);
      var durationSec = Math.max(1, Math.round((Date.now() - overallStart) / 1000));
      var parts = ['【' + mod.title + '】已补全 ' + appended.length + ' 条用例', '耗时 ' + durationSec + ' 秒'];
      if (dedupInfo.removed) {
        parts.push('剔除 ' + dedupInfo.removed + ' 条重复用例');
      }
      return {
        action: 'topup',
        shouldCommit: true,
        rawResult: JSON.stringify(updatedList, null, 2),
        list: updatedList,
        addedList: appended,
        hasResult: true,
        timingMs: durationMs,
        selectionMode: 'keep-valid',
        statusText: hadRecovery ? parts.join('，') + '（检测到结构异常，已保留有效条目）' : parts.join('，'),
        statusType: hadRecovery || dedupInfo.hadError ? 'warn' : 'ok',
        finalizeStep: 'done',
      };
    }

    function filterCasesAgainstImported(module, cases, actionLabel) {
      var moduleTitle = module && module.title ? module.title : '当前模块';
      var moduleId = module && module.id ? module.id : '';
      if (!hasImportedCases() || !cases.length) {
        if (moduleId) clearCaseProgress(moduleId);
        return Promise.resolve({ list: cases, removed: 0, hadError: false, skipped: true });
      }
      var importedList = getImportedCaseObjects();
      if (!importedList.length) {
        if (moduleId) clearCaseProgress(moduleId);
        return Promise.resolve({ list: cases, removed: 0, hadError: false, skipped: true });
      }
      var model;
      try {
        model = getAssignedModel('casefilter');
      } catch (err) {
        setCaseModuleStatus(moduleId, '【' + moduleTitle + '】' + actionLabel + '完成，但未配置“用例相似对比”模型，暂未过滤重复项', 'warn');
        if (moduleId) clearCaseProgress(moduleId);
        return Promise.resolve({ list: cases, removed: 0, hadError: false, skipped: true });
      }
      var prompt = state.assignments && state.assignments.caseFilterPrompt
        ? state.assignments.caseFilterPrompt.trim()
        : (defaultPrompts.casefilter || '');
      var reasoning = getReasoningForType('casefilter');
      var temperature = getTemperatureForType('casefilter');
      var baseCases = sanitizeCasesForExport(importedList);
      var baseJson = JSON.stringify(baseCases, null, 2);
      var groups = chunkArray(cases, 5);
      var concurrency = resolveCaseSimilarityConcurrency(groups.length);
      var hadError = false;
      if (moduleId) {
        initCaseProgress(moduleId, groups);
        setCaseProgressStep(moduleId, 'dedupe', 'running');
        setCaseModuleStatus(moduleId, '【' + moduleTitle + '】' + actionLabel + '完成，正在剔除重复用例（' + groups.length + ' 组）...', '');
      }
      return runConcurrent(groups, concurrency, function(group, idx) {
        if (!group || !group.length) return Promise.resolve([]);
        if (moduleId) setCaseProgressGroupState(moduleId, idx, 'running');
        var candidateJson = JSON.stringify(sanitizeCasesForExport(group), null, 2);
        var userContent = '模块：' + moduleTitle + '\n\n导入用例(JSON)：' + baseJson + '\n\n生成用例候选(JSON)：' + candidateJson + '\n\n请删除与导入用例重复或高度相似的候选，仅返回保留的候选 JSON 数组，不需要解释或额外文本。';
        return callCaseGenModelWithGuard(function() {
          return callModelWithConfig(model, userContent, prompt, reasoning, temperature);
        }).then(function(content) {
          var parsed = parseGeneratedCases(content).parsed;
          if (moduleId) setCaseProgressGroupState(moduleId, idx, 'done');
          return parsed.length ? parsed : [];
        }).catch(function(err) {
          console.warn('用例相似对比失败', err);
          hadError = true;
          if (moduleId) setCaseProgressGroupState(moduleId, idx, 'error');
          return group;
        });
      }).then(function(filteredGroups) {
        var flattened = filteredGroups.reduce(function(sum, group) { return sum.concat(group); }, []);
        var removed = Math.max(0, cases.length - flattened.length);
        if (moduleId) {
          setCaseProgressStep(moduleId, 'dedupe', hadError ? 'error' : 'done');
          var hint = hadError
            ? '【' + moduleTitle + '】重复用例剔除部分失败，请检查结果'
            : '【' + moduleTitle + '】重复用例剔除完成';
          setCaseModuleStatus(moduleId, hint, hadError ? 'warn' : 'ok');
        }
        return { list: flattened, removed: removed, hadError: hadError, skipped: false };
      });
    }

    function normalizeStaleCaseProgress(moduleId, moduleTitle) {
      if (!moduleId || isCaseModuleRunning(moduleId)) return;
      var progress = state.caseGenProgress[moduleId];
      if (!progress || typeof progress !== 'object') return;
      var hasStaleRunning = false;
      if (Array.isArray(progress.groups)) {
        progress.groups.forEach(function(group) {
          if (!group || group.state !== 'running') return;
          group.state = 'error';
          hasStaleRunning = true;
        });
      }
      if (progress.dedupe && progress.dedupe.state === 'running') {
        progress.dedupe.state = 'error';
        hasStaleRunning = true;
      }
      if (progress.finalize && progress.finalize.state === 'running') {
        progress.finalize.state = 'error';
        hasStaleRunning = true;
      }
      if (!hasStaleRunning) return;
      var moduleName = resolveModuleTitle(moduleTitle || '');
      var statusInfo = ensureCaseModuleStatusState()[moduleId];
      var statusType = statusInfo && statusInfo.type ? String(statusInfo.type) : '';
      var statusText = statusInfo && statusInfo.text ? String(statusInfo.text) : '';
      if (statusType === 'err' || statusType === 'warn') return;
      if (statusText.indexOf('已中断') !== -1 || statusText.indexOf('失败') !== -1) return;
      setCaseModuleStatus(moduleId, '【' + (moduleName || '当前模块') + '】生成任务已中断，请重新执行', 'warn');
    }

    async function generateCasesForModule(moduleId, options) {
      options = options || {};
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      setCaseModuleTiming(moduleId);
      setCaseModuleRunning(moduleId, true);
      refreshCaseGenBatchButtons();
      var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
      if (textarea) textarea.value = '';
      var generateBtn = casesGenerationContainer && casesGenerationContainer.querySelector('button[data-generate="' + moduleId + '"]');
      if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';
      }
      setCaseModuleStatus(moduleId, '正在生成【' + mod.title + '】的测试用例...', '');
      clearCaseProgress(moduleId);
      updateSupplementButtons(moduleId, false);
      syncLegacyCaseGenState({ persist: false });
      var hasResult = false;
      try {
        var buildResult = await buildModuleCases(moduleId, options);
        if (!buildResult) {
          hasResult = false;
        } else if (buildResult.cancelled) {
          setCaseModuleStatus(moduleId, buildResult.statusText || '已取消生成', buildResult.statusType || 'warn');
          updateModelTiming(caseGenTimingEl);
          hasResult = getCaseListForModule(moduleId).length > 0;
        } else {
          updateModelTiming(caseGenTimingEl, buildResult.timingMs);
          commitModuleCases(moduleId, buildResult);
          hasResult = buildResult.hasResult === true;
          syncLegacyCaseGenState({ persist: false });
        }
      } catch (err) {
        console.error(err);
        setCaseModuleStatus(moduleId, '生成失败：' + err.message, 'err');
        if (state.caseGenProgress[moduleId]) {
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        updateModelTiming(caseGenTimingEl);
        setCaseModuleTiming(moduleId);
      } finally {
        if (generateBtn) {
          generateBtn.disabled = false;
          generateBtn.textContent = '生成用例';
        }
        setCaseModuleRunning(moduleId, false);
        updateSupplementButtons(moduleId, hasResult);
        syncLegacyCaseGenState({ persist: false });
        renderCaseGeneration();
      }
    }

    async function topUpCasesForModule(moduleId, options) {
      options = options || {};
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      setCaseModuleTiming(moduleId);
      setCaseModuleRunning(moduleId, true);
      refreshCaseGenBatchButtons();
      updateSupplementButtons(moduleId, false);
      var generateBtn = casesGenerationContainer && casesGenerationContainer.querySelector('button[data-generate="' + moduleId + '"]');
      if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = '补全中...';
      }
      setCaseModuleStatus(moduleId, '正在补全【' + mod.title + '】的测试用例...', '');
      clearCaseProgress(moduleId);
      syncLegacyCaseGenState({ persist: false });
      try {
        var buildResult = await buildModuleTopup(moduleId, options);
        if (!buildResult) {
          updateModelTiming(caseGenTimingEl);
        } else if (buildResult.cancelled) {
          setCaseModuleStatus(moduleId, buildResult.statusText || '已取消补全', buildResult.statusType || 'warn');
          updateModelTiming(caseGenTimingEl);
        } else {
          updateModelTiming(caseGenTimingEl, buildResult.timingMs);
          if (buildResult.shouldCommit === false) {
            setCaseModuleStatus(moduleId, buildResult.statusText || '未补充到新的用例，请调整提示后重试', buildResult.statusType || 'warn');
            if (buildResult.finalizeStep) setCaseProgressStep(moduleId, 'finalize', buildResult.finalizeStep);
          } else {
            commitModuleCases(moduleId, buildResult);
            syncLegacyCaseGenState({ persist: false });
          }
        }
      } catch (err) {
        console.error(err);
        setCaseModuleStatus(moduleId, '补全失败：' + err.message, 'err');
        if (state.caseGenProgress[moduleId]) {
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        updateModelTiming(caseGenTimingEl);
        setCaseModuleTiming(moduleId);
      } finally {
        if (generateBtn) {
          generateBtn.disabled = false;
          generateBtn.textContent = '生成用例';
        }
        setCaseModuleRunning(moduleId, false);
        updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
        syncLegacyCaseGenState({ persist: false });
        renderCaseGeneration();
      }
    }

    return {
      ensureCaseGenRequirementDrawer: ensureCaseGenRequirementDrawer,
      syncCaseGenActionDrawerSummary: syncCaseGenActionDrawerSummary,
      findCaseGenModule: findCaseGenModule,
      formatCaseGenModuleField: formatCaseGenModuleField,
      describeCaseGenPromptSettings: describeCaseGenPromptSettings,
      normalizeCaseGenActionContext: normalizeCaseGenActionContext,
      getCaseGenActionMeta: getCaseGenActionMeta,
      runCaseGenBatchAction: runCaseGenBatchAction,
      executeCaseGenActionContext: executeCaseGenActionContext,
      normalizeCaseGenModuleDrawerTab: normalizeCaseGenModuleDrawerTab,
      createCaseGenModuleGenerateState: createCaseGenModuleGenerateState,
      setCaseGenModuleSuggestionDraft: setCaseGenModuleSuggestionDraft,
      syncCaseGenModuleLocalSpecialOptionsState: syncCaseGenModuleLocalSpecialOptionsState,
      syncCaseGenModuleLocalInputs: syncCaseGenModuleLocalInputs,
      setCaseGenModuleLocalSettingValue: setCaseGenModuleLocalSettingValue,
      getCaseGenModuleGenerateHasResult: getCaseGenModuleGenerateHasResult,
      setCaseGenModuleGenerateDrawerTab: setCaseGenModuleGenerateDrawerTab,
      syncCaseGenModuleGenerateDrawer: syncCaseGenModuleGenerateDrawer,
      ensureCaseGenModuleGenerateDrawer: ensureCaseGenModuleGenerateDrawer,
      ensureCaseGenActionDrawer: ensureCaseGenActionDrawer,
      openCaseGenActionDrawerByContext: openCaseGenActionDrawerByContext,
      openCaseGenBatchActionDrawer: openCaseGenBatchActionDrawer,
      openCaseGenSettingsDrawer: openCaseGenSettingsDrawer,
      openCaseGenModuleGenerateDrawer: openCaseGenModuleGenerateDrawer,
      promptRequirementLabelByDrawer: promptRequirementLabelByDrawer,
      createDefaultCaseGenSettings: createDefaultCaseGenSettings,
      normalizeCaseGenPromptSettings: normalizeCaseGenPromptSettings,
      ensureCaseGenSettings: ensureCaseGenSettings,
      createCaseGenPromptSettingsSnapshot: createCaseGenPromptSettingsSnapshot,
      createEmptyCaseGenPromptSettings: createEmptyCaseGenPromptSettings,
      syncCaseGenPromptInputs: syncCaseGenPromptInputs,
      applyCaseGenPromptSettings: applyCaseGenPromptSettings,
      setCaseGenSettingValue: setCaseGenSettingValue,
      syncCaseGenSpecialOptionsState: syncCaseGenSpecialOptionsState,
      setCaseGenViewTab: setCaseGenViewTab,
      setCaseGenStoreMode: setCaseGenStoreMode,
      getCaseGenPromptComponents: getCaseGenPromptComponents,
      appendCaseWritingGuidePrompt: appendCaseWritingGuidePrompt,
      buildCaseGenPrompt: buildCaseGenPrompt,
      resolveModuleTitle: resolveModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      normalizeCaseTitle: normalizeCaseTitle,
      normalizeCaseListWithModules: normalizeCaseListWithModules,
      chunkArray: chunkArray,
      resolveCaseGenBatchConcurrency: resolveCaseGenBatchConcurrency,
      resolveCaseSimilarityConcurrency: resolveCaseSimilarityConcurrency,
      resolveCaseGenTimeoutSec: resolveCaseGenTimeoutSec,
      callCaseGenModelWithGuard: callCaseGenModelWithGuard,
      parseGeneratedCases: parseGeneratedCases,
      hasGeneratedCases: hasGeneratedCases,
      hasRunningCaseModules: hasRunningCaseModules,
      buildCaseGenModuleMeta: buildCaseGenModuleMeta,
      listGeneratedCaseGenModuleTitles: listGeneratedCaseGenModuleTitles,
      refreshCaseGenBatchButtons: refreshCaseGenBatchButtons,
      confirmCaseGenBatchOverwrite: confirmCaseGenBatchOverwrite,
      runCaseGenBatch: runCaseGenBatch,
      generateAllCaseGenModules: generateAllCaseGenModules,
      topUpAllCaseGenModules: topUpAllCaseGenModules,
      generateSuggestedCaseGenModules: generateSuggestedCaseGenModules,
      commitModuleCases: commitModuleCases,
      buildModuleCases: buildModuleCases,
      buildModuleTopup: buildModuleTopup,
      filterCasesAgainstImported: filterCasesAgainstImported,
      normalizeStaleCaseProgress: normalizeStaleCaseProgress,
      generateCasesForModule: generateCasesForModule,
      topUpCasesForModule: topUpCasesForModule,
    };
  }

  return { create: create };
});
