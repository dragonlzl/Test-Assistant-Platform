(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenPrepDialogController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var summaryDialogBodyEl = opts.summaryDialogBodyEl || null;
    var documentRef = opts.document || (typeof document !== 'undefined' ? document : null);
    var STEP_REQUIREMENT = Number(opts.stepRequirement || 1) || 1;
    var STEP_CASES = Number(opts.stepCases || 2) || 2;
    var STEP_OPTIONS = Number(opts.stepOptions || 3) || 3;
    var escapeHtml = port('escapeHtml', function(value) { return String(value || ''); });
    var cloneJson = port('cloneJson', function(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (error) {
        return fallback;
      }
    });
    var isPrepDialogOpen = port('isPrepDialogOpen', function() { return true; });
    var getPrepState = port('getPrepState', function() { return {}; });
    var clampPrepStep = port('clampPrepStep', function(value) {
      var step = Number(value || STEP_REQUIREMENT);
      return Math.max(STEP_REQUIREMENT, Math.min(STEP_OPTIONS, step));
    });
    var hasRequirementReady = port('hasRequirementReady', function() { return false; });
    var hasCaseStepReady = port('hasCaseStepReady', function() { return false; });
    var isPrepBaseLocked = port('isPrepBaseLocked', function() { return false; });
    var getCaseGenSettingsSnapshot = port('getCaseGenSettingsSnapshot', function() { return {}; });
    var applyCaseGenOptionDraft = port('applyCaseGenOptionDraft');
    var setPrepField = port('setPrepField', function() { return false; });
    var setCaseGenOption = port('setCaseGenOption');
    var persistXmindState = port('persistXmindState');
    var renderOpenedSummaryDialog = port('renderOpenedSummaryDialog');
    var closeSummaryDialog = port('closeSummaryDialog');
    var renderMind = port('renderMind');
    var centerRootNodeView = port('centerRootNodeView');
    var notifySuccessToast = port('notifySuccessToast');
    var notifyStatus = port('notifyStatus');
    var scheduleRender = port('scheduleRender');
    var getActiveKnowledgeBaseState = port('getActiveKnowledgeBaseState', function() { return {}; });
    var getDocumentRequirementText = port('getDocumentRequirementText', function() {
      var rawTextEl = documentRef ? documentRef.getElementById('rawText') : null;
      return rawTextEl && rawTextEl.value ? String(rawTextEl.value).trim() : '';
    });
    var getDocumentRequirementImportName = port('getDocumentRequirementImportName', function() { return ''; });
    var getDocumentRequirementImageCount = port('getDocumentRequirementImageCount', function() { return 0; });
    var getManualRequirementLabelText = port('getManualRequirementLabelText', function() { return ''; });
    var getManualRequirementText = port('getManualRequirementText', function() { return ''; });
    var getManualRequirementImages = port('getManualRequirementImages', function() { return []; });
    var buildCasesSummaryInfo = port('buildCasesSummaryInfo', function() { return { title: '', meta: '' }; });
    var hasImportedBaselineCases = port('hasImportedBaselineCases', function() { return false; });
    var hasAnyRunningGenerationOperation = port('hasAnyRunningGenerationOperation', function() { return false; });
    var triggerRequirementImport = port('triggerRequirementImport');
    var triggerCasesImport = port('triggerCasesImport');
    var triggerCasesLibrarySelect = port('triggerCasesLibrarySelect');
    var ensureManualImageInput = port('ensureManualImageInput', function() { return null; });
    var requestPrepReset = port('requestPrepReset');
    var removeManualRequirementImage = port('removeManualRequirementImage');
    var setManualRequirementText = port('setManualRequirementText');
    var appendManualRequirementImages = port('appendManualRequirementImages', function() { return Promise.resolve(false); });
    var importRequirementFileFromDrop = port('importRequirementFileFromDrop', function() { return false; });
    var importCasesFilesFromDrop = port('importCasesFilesFromDrop', function() { return false; });
    var listenerBound = false;
    var handlers = {};

    function syncSummaryDraftIntoState(optionsValue) {
      var syncOptions = optionsValue || {};
      if (!isPrepDialogOpen() || !summaryDialogBodyEl) return false;
      var changed = false;
      var prep = getPrepState();
      var settings = getCaseGenSettingsSnapshot() || {};
      var preserveCompleted = syncOptions.preserveCompleted === true;

      function markPrepChanged() {
        changed = true;
        if (preserveCompleted !== true) prep.completed = false;
      }

      if (isPrepBaseLocked() !== true) {
        var requirementModeInputs = summaryDialogBodyEl.querySelectorAll('input[name="xmindRequirementMode"]');
        if (requirementModeInputs && requirementModeInputs.length) {
          var requirementModeEl = summaryDialogBodyEl.querySelector('input[name="xmindRequirementMode"]:checked');
          var requirementMode = requirementModeEl ? String(requirementModeEl.value || '') : '';
          if (requirementMode !== 'manual' && requirementMode !== 'document') requirementMode = '';
          if (prep.requirementMode !== requirementMode) {
            prep.requirementMode = requirementMode;
            markPrepChanged();
          }
        }

        var supplementEl = summaryDialogBodyEl.querySelector('#xmindCaseGenRequirementSupplement');
        if (supplementEl) {
          var nextSupplement = String(supplementEl.value || '');
          if (String(prep.requirementSupplement || '') !== nextSupplement) {
            prep.requirementSupplement = nextSupplement;
            markPrepChanged();
          }
        }

        var manualLabelEl = summaryDialogBodyEl.querySelector('#xmindCaseGenManualRequirementLabel');
        if (manualLabelEl) {
          var nextManualLabel = String(manualLabelEl.value || '');
          if (String(prep.manualRequirementLabel || '') !== nextManualLabel) {
            prep.manualRequirementLabel = nextManualLabel;
            markPrepChanged();
          }
        }

        var manualTextEl = summaryDialogBodyEl.querySelector('#xmindCaseGenManualRequirementText');
        if (manualTextEl) {
          var manualText = String(manualTextEl.value || '');
          var manualImages = getManualRequirementImages().map(function(item) {
            return cloneJson(item, null);
          }).filter(Boolean);
          var nextBlocks = [];
          if (manualText.trim()) nextBlocks.push({ type: 'text', text: manualText });
          manualImages.forEach(function(item) { nextBlocks.push(item); });
          if (JSON.stringify(prep.manualRequirementBlocks || []) !== JSON.stringify(nextBlocks)) {
            prep.manualRequirementBlocks = nextBlocks;
            markPrepChanged();
          }
        }

        var caseImportModeInputs = summaryDialogBodyEl.querySelectorAll('input[name="xmindCaseImportMode"]');
        if (caseImportModeInputs && caseImportModeInputs.length) {
          var caseImportModeEl = summaryDialogBodyEl.querySelector('input[name="xmindCaseImportMode"]:checked');
          var caseImportMode = caseImportModeEl ? String(caseImportModeEl.value || '') : '';
          if (caseImportMode !== 'import' && caseImportMode !== 'skip') caseImportMode = '';
          if (prep.caseImportMode !== caseImportMode) {
            prep.caseImportMode = caseImportMode;
            markPrepChanged();
          }
        }
      }

      var customRequirementEl = summaryDialogBodyEl.querySelector('#xmindCaseGenOptionCustomRequirement');
      if (customRequirementEl) {
        var nextCustomRequirement = String(customRequirementEl.value || '');
        if (String(settings.customRequirement || '') !== nextCustomRequirement) {
          applyCaseGenOptionDraft('customRequirement', nextCustomRequirement);
          markPrepChanged();
        }
      }

      var settingInputs = summaryDialogBodyEl.querySelectorAll('input[data-casegen-setting]');
      for (var i = 0; i < settingInputs.length; i += 1) {
        var inputEl = settingInputs[i];
        if (!inputEl || !inputEl.getAttribute) continue;
        var settingKey = String(inputEl.getAttribute('data-casegen-setting') || '');
        if (!settingKey) continue;
        var nextValue = inputEl.type === 'checkbox' ? inputEl.checked === true : String(inputEl.value || '');
        if (settings[settingKey] !== nextValue) {
          applyCaseGenOptionDraft(settingKey, nextValue);
          markPrepChanged();
        }
      }
      return changed;
    }

    function syncPrepDialogState() {
      if (!isPrepDialogOpen() || !summaryDialogBodyEl) return;
      var prep = getPrepState();
      var currentStep = clampPrepStep(prep.step);
      var stepStates = {};
      stepStates[STEP_REQUIREMENT] = hasRequirementReady();
      stepStates[STEP_CASES] = hasCaseStepReady();
      stepStates[STEP_OPTIONS] = prep.completed === true;
      var stepEls = summaryDialogBodyEl.querySelectorAll('[data-prep-step]');
      Array.prototype.forEach.call(stepEls, function(stepEl) {
        var step = Number(stepEl.getAttribute('data-prep-step') || 0);
        if (!stepEl.classList) return;
        if (step === currentStep) {
          stepEl.classList.add('is-active');
          stepEl.classList.remove('is-done');
        } else if (stepStates[step] === true) {
          stepEl.classList.remove('is-active');
          stepEl.classList.add('is-done');
        } else {
          stepEl.classList.remove('is-active');
          stepEl.classList.remove('is-done');
        }
      });
      var statusBadge = summaryDialogBodyEl.querySelector('[data-prep-card-status="current"]');
      if (statusBadge) {
        var done = false;
        var text = '';
        if (currentStep === STEP_REQUIREMENT) {
          done = stepStates[STEP_REQUIREMENT] === true;
          text = done ? '已完成' : '待完成';
        } else if (currentStep === STEP_CASES) {
          done = stepStates[STEP_CASES] === true;
          text = done ? '已完成' : '待选择';
        } else {
          done = stepStates[STEP_OPTIONS] === true;
          text = done ? '已确认' : (isPrepBaseLocked() ? '待重新确认' : '待确认');
        }
        if (statusBadge.classList) {
          statusBadge.classList.toggle('is-done', done);
          statusBadge.classList.toggle('is-ready', !done);
        }
        statusBadge.textContent = text;
      }
      var nextBtn = summaryDialogBodyEl.querySelector('[data-prep-nav="next"]');
      if (nextBtn) {
        var shouldDisable = false;
        if (currentStep === STEP_REQUIREMENT) shouldDisable = stepStates[STEP_REQUIREMENT] !== true;
        if (currentStep === STEP_CASES) shouldDisable = stepStates[STEP_CASES] !== true;
        nextBtn.disabled = shouldDisable;
      }
    }

    function renderPrepStepTabs() {
      var prep = getPrepState();
      var requirementDone = hasRequirementReady();
      var casesDone = requirementDone && hasCaseStepReady();
      var kbState = getActiveKnowledgeBaseState();
      var steps = [
        { step: STEP_REQUIREMENT, label: '需求导入', shortLabel: 'step1', done: requirementDone },
        { step: STEP_CASES, label: '是否导入用例', shortLabel: 'step2', done: casesDone },
        { step: STEP_OPTIONS, label: '生成选项', shortLabel: 'step3', done: prep.completed === true && casesDone },
      ];
      return '<div class="xmind-casegen-prep-stepper-row">'
        + '<div class="xmind-casegen-prep-stepper">'
        + steps.map(function(item) {
          var classes = ['xmind-casegen-prep-step'];
          if (prep.step === item.step) classes.push('is-active');
          else if (item.done) classes.push('is-done');
          return '<span class="' + classes.join(' ') + '" data-prep-step="' + item.step + '" title="' + escapeHtml(item.label) + '"' + (prep.step === item.step ? ' aria-current="step"' : '') + '>'
            + '<span class="xmind-casegen-prep-step-badge">' + escapeHtml(item.shortLabel) + '</span>'
            + '</span>';
        }).join('')
        + '</div>'
        + (kbState.usedInLatestGeneration === true
          ? '<span class="xmind-casegen-kb-used-badge xmind-casegen-kb-used-badge-inline">已使用知识库</span>'
          : '')
        + '</div>';
    }

    function renderRequirementStepCard() {
      var prep = getPrepState();
      var locked = isPrepBaseLocked();
      var mode = prep.requirementMode || '';
      var readonlyAttr = locked ? ' readonly' : '';
      var disabledAttr = locked ? ' disabled' : '';
      var docValue = String(getDocumentRequirementText() || '').trim();
      var docImportName = String(getDocumentRequirementImportName() || '').trim();
      var docImageCount = Number(getDocumentRequirementImageCount() || 0) || 0;
      var docStatusText = docValue
        ? ('已导入' + (docImportName ? '：' + docImportName + '，' : '，') + '正文 ' + String(docValue.length) + ' 字，图片 ' + String(docImageCount) + ' 张')
        : '导入后内容会同步到当前需求上下文';
      var manualLabel = getManualRequirementLabelText();
      var manualText = getManualRequirementText();
      var manualImages = getManualRequirementImages();
      var manualImagesHtml = manualImages.map(function(item, index) {
        var name = item && item.name ? String(item.name) : ('图片' + (index + 1));
        return '<div class="xmind-casegen-prep-image-item">'
          + '<img src="' + escapeHtml(item.dataUrl || '') + '" alt="' + escapeHtml(name) + '" />'
          + '<div class="xmind-casegen-prep-image-item-copy">'
          +   '<span>' + escapeHtml(name) + '</span>'
          +   '<button type="button" class="link-toggle" data-prep-action="remove-manual-image" data-image-index="' + index + '"' + disabledAttr + '>移除</button>'
          + '</div>'
          + '</div>';
      }).join('');
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main ' + (locked ? 'is-readonly' : '') + '">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">step1</span>'
        +       '<strong class="xmind-casegen-prep-card-title">需求导入</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (hasRequirementReady() ? 'done' : 'ready') + '" data-prep-card-status="current">' + (hasRequirementReady() ? '已完成' : '待完成') + '</span>'
        +   '</div>'
        +   (locked ? '<div class="xmind-casegen-prep-warning">当前步骤仅可查看，若要调整需求或参考用例，请开始新的生成准备。</div>' : '')
        +   '<div class="xmind-casegen-prep-choice-grid">'
        +     '<label class="xmind-casegen-prep-choice is-success ' + (mode === 'document' ? 'is-active ' : '') + (locked ? 'is-readonly' : '') + '">'
        +       '<input type="radio" name="xmindRequirementMode" value="document" ' + (mode === 'document' ? 'checked ' : '') + disabledAttr + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">导入需求文档</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">复用现有需求导入链路，可补充说明。</span>'
        +     '</label>'
        +     '<label class="xmind-casegen-prep-choice is-success ' + (mode === 'manual' ? 'is-active ' : '') + (locked ? 'is-readonly' : '') + '">'
        +       '<input type="radio" name="xmindRequirementMode" value="manual" ' + (mode === 'manual' ? 'checked ' : '') + disabledAttr + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">填写需求描述</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">支持文本和图片。</span>'
        +     '</label>'
        +   '</div>'
        +   (mode === 'document'
          ? ''
            + '<div class="xmind-casegen-prep-field">'
            +   '<label>需求文档</label>'
            +   '<div class="zone xmind-casegen-prep-dropzone' + (locked ? ' is-disabled' : '') + '"'
            +     ' id="xmindCaseGenPrepRequirementDropzone"'
            +     ' data-prep-action="import-requirement"'
            +     ' role="button"'
            +     ' tabindex="' + (locked ? '-1' : '0') + '"'
            +     ' aria-disabled="' + (locked ? 'true' : 'false') + '">'
            +     '<div class="zone-line">'
            +       '<strong>原始需求</strong>'
            +       '<span>拖拽或点击选择</span>'
            +     '</div>'
            +     '<div class="status' + (docValue ? ' ok' : '') + '">' + escapeHtml(docStatusText) + '</div>'
            +   '</div>'
            + '</div>'
            + '<div class="xmind-casegen-prep-field">'
            +   '<label for="xmindCaseGenRequirementSupplement">需求补充</label>'
            +   '<textarea id="xmindCaseGenRequirementSupplement" data-prep-input="requirementSupplement" placeholder="非必填，会与需求文档一起作为生成上下文。"' + readonlyAttr + disabledAttr + '>' + escapeHtml(prep.requirementSupplement || '') + '</textarea>'
            + '</div>'
          : '')
        +   (mode === 'manual'
          ? ''
            + '<div class="xmind-casegen-prep-field">'
            +   '<label for="xmindCaseGenManualRequirementLabel">需求名称</label>'
            +   '<input id="xmindCaseGenManualRequirementLabel" data-prep-input="manualRequirementLabel" type="text" maxlength="80" placeholder="必填，将作为根节点标题。"' + readonlyAttr + disabledAttr + ' value="' + escapeHtml(manualLabel) + '" />'
            + '</div>'
            + '<div class="xmind-casegen-prep-field">'
            +   '<label for="xmindCaseGenManualRequirementText">需求描述</label>'
            +   '<textarea id="xmindCaseGenManualRequirementText" data-manual-requirement-text="1" placeholder="请输入需求描述；也可直接粘贴图片到此区域。"' + readonlyAttr + disabledAttr + '>' + escapeHtml(manualText) + '</textarea>'
            + '</div>'
            + '<div class="xmind-casegen-prep-field">'
            +   '<label>需求图片</label>'
            +   '<div class="xmind-casegen-prep-upload-row">'
            +     '<button type="button" class="secondary" data-prep-action="upload-manual-images"' + disabledAttr + '>上传图片</button>'
            +     '<span class="hint">' + (manualImages.length ? ('已添加 ' + String(manualImages.length) + ' 张') : '支持上传或粘贴图片') + '</span>'
            +   '</div>'
            +   '<div class="xmind-casegen-prep-image-list">' + manualImagesHtml + '</div>'
            + '</div>'
          : '')
        + '</div>';
    }

    function renderCasesStepCard() {
      var prep = getPrepState();
      var locked = isPrepBaseLocked();
      var mode = prep.caseImportMode || '';
      var disabledAttr = locked ? ' disabled' : '';
      var casesInfo = buildCasesSummaryInfo();
      var importedCaseFileListHtml = hasImportedBaselineCases()
        ? ('<span class="file-chip">' + escapeHtml(casesInfo.title || '已导入已有用例') + '</span>')
        : '<span class="hint" data-xmind-casegen-case-placeholder="1">未导入文件</span>';
      var caseStatusText = hasImportedBaselineCases()
        ? casesInfo.meta
        : '导入结果同步到当前 XMind 主树基线';
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main ' + (locked ? 'is-readonly' : '') + '">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">step2</span>'
        +       '<strong class="xmind-casegen-prep-card-title">是否导入用例</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (hasCaseStepReady() ? 'done' : 'ready') + '" data-prep-card-status="current">' + (hasCaseStepReady() ? '已完成' : '待选择') + '</span>'
        +   '</div>'
        +   (locked ? '<div class="xmind-casegen-prep-warning">当前步骤仅可查看，导入方式和内容已在本次生成中锁定。</div>' : '')
        +   '<div class="xmind-casegen-prep-choice-grid">'
        +     '<label class="xmind-casegen-prep-choice is-success ' + (mode === 'skip' ? 'is-active ' : '') + (locked ? 'is-readonly' : '') + '">'
        +       '<input type="radio" name="xmindCaseImportMode" value="skip" ' + (mode === 'skip' ? 'checked ' : '') + disabledAttr + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">不导入用例</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">主树只展示 AI 生成内容。</span>'
        +     '</label>'
        +     '<label class="xmind-casegen-prep-choice is-success ' + (mode === 'import' ? 'is-active ' : '') + (locked ? 'is-readonly' : '') + '">'
        +       '<input type="radio" name="xmindCaseImportMode" value="import" ' + (mode === 'import' ? 'checked ' : '') + disabledAttr + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">导入已有用例</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">导入后作为主树基线。</span>'
        +     '</label>'
        +   '</div>'
        +   (mode === 'import'
          ? ''
            + '<div class="xmind-casegen-prep-field">'
            +   '<label>参考用例来源</label>'
            +   '<div class="zone xmind-casegen-prep-dropzone' + (locked ? ' is-disabled' : '') + '"'
            +     ' id="xmindCaseGenPrepCasesDropzone"'
            +     ' data-prep-action="import-cases"'
            +     ' role="button"'
            +     ' tabindex="' + (locked ? '-1' : '0') + '"'
            +     ' aria-disabled="' + (locked ? 'true' : 'false') + '">'
            +     '<div class="zone-line">'
            +       '<strong>测试用例</strong>'
            +       '<span>拖拽或点击选择</span>'
            +     '</div>'
            +     '<div class="status' + (hasImportedBaselineCases() ? ' ok' : '') + '">' + escapeHtml(caseStatusText) + '</div>'
            +   '</div>'
            +   '<div class="actions case-library-import-actions xmind-casegen-prep-upload-actions">'
            +     '<button type="button" class="secondary case-library-import-btn" data-prep-action="select-cases-library"' + disabledAttr + '>从用例库选择</button>'
            +   '</div>'
            +   '<div class="file-list xmind-casegen-prep-filelist">'
            +     importedCaseFileListHtml
            +   '</div>'
            + '</div>'
          : '<p class="hint">' + escapeHtml(casesInfo.meta) + '</p>')
        + '</div>';
    }

    function renderOptionToggleCard(config) {
      var meta = config || {};
      var checked = meta.checked === true;
      var disabled = meta.disabled === true;
      var classes = ['xmind-casegen-prep-toggle'];
      classes.push(checked ? 'is-on' : 'is-off');
      if (disabled) classes.push('is-disabled');
      return ''
        + '<label class="' + classes.join(' ') + '" data-casegen-setting-card="' + escapeHtml(String(meta.key || '')) + '">'
        +   '<input type="checkbox" data-casegen-setting="' + escapeHtml(String(meta.key || '')) + '" ' + (checked ? 'checked ' : '') + (disabled ? 'disabled' : '') + ' />'
        +   '<span class="xmind-casegen-prep-toggle-main">'
        +     '<span class="xmind-casegen-prep-toggle-copy">'
        +       '<span class="xmind-casegen-prep-toggle-title">' + escapeHtml(meta.title || '') + '</span>'
        +       '<span class="xmind-casegen-prep-toggle-desc">' + escapeHtml(meta.desc || '') + '</span>'
        +     '</span>'
        +     '<span class="xmind-casegen-prep-toggle-switch" aria-hidden="true">'
        +       '<span class="xmind-casegen-prep-toggle-state xmind-casegen-prep-toggle-state-on">开</span>'
        +       '<span class="xmind-casegen-prep-toggle-state xmind-casegen-prep-toggle-state-off">关</span>'
        +       '<span class="xmind-casegen-prep-toggle-knob"></span>'
        +     '</span>'
        +   '</span>'
        + '</label>';
    }

    function syncPrepOptionToggleDom() {
      if (!summaryDialogBodyEl) return;
      var settings = getCaseGenSettingsSnapshot();
      var specialEnabled = settings.needSpecial === true;
      var keys = [
        'dedupeSimplify',
        'needFunctionCondition',
        'needNumericValidation',
        'needBoundary',
        'needMobile',
        'needSpecial',
        'specialRepeatOperation',
        'specialMultiTouch',
        'specialRepeatExecution',
        'specialWeakNetwork',
        'specialInterruptResume',
      ];
      keys.forEach(function(key) {
        var inputEl = summaryDialogBodyEl.querySelector('input[data-casegen-setting="' + key + '"]');
        if (!inputEl) return;
        var isSpecialKey = key.indexOf('special') === 0;
        var disabled = isSpecialKey && !specialEnabled;
        var checked = settings[key] === true;
        inputEl.checked = checked;
        inputEl.disabled = disabled;
        var card = inputEl.closest ? inputEl.closest('[data-casegen-setting-card]') : null;
        if (card && card.classList) {
          card.classList.toggle('is-on', checked);
          card.classList.toggle('is-off', !checked);
          card.classList.toggle('is-disabled', disabled);
        }
      });
      var specialGroup = summaryDialogBodyEl.querySelector('[data-casegen-special-group]');
      if (specialGroup && specialGroup.classList) {
        specialGroup.classList.toggle('is-disabled', !specialEnabled);
      }
      var specialDesc = summaryDialogBodyEl.querySelector('[data-casegen-special-desc]');
      if (specialDesc) {
        specialDesc.textContent = specialEnabled
          ? '按需补足本轮要覆盖的特殊场景。'
          : '先开启“考虑特殊场景”，再选择具体细项。';
      }
    }

    function renderOptionsStepCard() {
      var prep = getPrepState();
      var settings = getCaseGenSettingsSnapshot();
      var locked = isPrepBaseLocked();
      var dedupeHtml = renderOptionToggleCard({
        key: 'dedupeSimplify',
        title: '去重并精简',
        desc: '关闭时仅去除重复或高度重叠用例；开启后在保证覆盖质量前提下压缩冗余。',
        checked: settings.dedupeSimplify === true,
      });
      var primaryHtml = ''
        + renderOptionToggleCard({
          key: 'needFunctionCondition',
          title: '考虑功能使用条件',
          desc: '补足解锁、可用、身份门槛、前置任务和时段限制。',
          checked: settings.needFunctionCondition === true,
        })
        + renderOptionToggleCard({
          key: 'needNumericValidation',
          title: '数值验证',
          desc: '补足范围、阈值变化、累计扣减和结算正确性。',
          checked: settings.needNumericValidation === true,
        })
        + renderOptionToggleCard({
          key: 'needBoundary',
          title: '考虑边界',
          desc: '补足上下限、临界值、空值和异常边界。',
          checked: settings.needBoundary === true,
        })
        + renderOptionToggleCard({
          key: 'needMobile',
          title: '考虑移动设备',
          desc: '补足手势、横竖屏和系统打断等移动端场景。',
          checked: settings.needMobile === true,
        })
        + renderOptionToggleCard({
          key: 'needSpecial',
          title: '考虑特殊场景',
          desc: '开启后可继续选择弱网、中断恢复等特殊场景。',
          checked: settings.needSpecial === true,
        });
      var specialHtml = ''
        + renderOptionToggleCard({
          key: 'specialRepeatOperation',
          title: '重复操作',
          desc: '连续点击、重复提交或重复领取。',
          checked: settings.specialRepeatOperation === true,
          disabled: settings.needSpecial !== true,
        })
        + renderOptionToggleCard({
          key: 'specialMultiTouch',
          title: '多点触控',
          desc: '双指、误触连击和多点同时操作。',
          checked: settings.specialMultiTouch === true,
          disabled: settings.needSpecial !== true,
        })
        + renderOptionToggleCard({
          key: 'specialRepeatExecution',
          title: '重复执行',
          desc: '反复进入退出和连续重复执行流程。',
          checked: settings.specialRepeatExecution === true,
          disabled: settings.needSpecial !== true,
        })
        + renderOptionToggleCard({
          key: 'specialWeakNetwork',
          title: '弱网',
          desc: '高延迟、超时、断续连接和重试恢复。',
          checked: settings.specialWeakNetwork === true,
          disabled: settings.needSpecial !== true,
        })
        + renderOptionToggleCard({
          key: 'specialInterruptResume',
          title: '中断恢复',
          desc: '来电、切后台、锁屏或重启后的恢复。',
          checked: settings.specialInterruptResume === true,
          disabled: settings.needSpecial !== true,
        });
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">step3</span>'
        +       '<strong class="xmind-casegen-prep-card-title">生成选项</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (prep.completed ? 'done' : 'ready') + '" data-prep-card-status="current">' + (prep.completed ? '已确认' : (locked ? '待重新确认' : '待确认')) + '</span>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-warning">' + escapeHtml(locked
              ? 'step1 和 step2 已锁定，本次仅可调整生成选项并重新确认。'
              : '确认后，step1 和 step2 在本次生成中都不可更改。') + '</div>'
        +   '<div class="xmind-casegen-prep-field">'
        +     '<label for="xmindCaseGenOptionCustomRequirement">额外要求</label>'
        +     '<textarea id="xmindCaseGenOptionCustomRequirement" data-casegen-setting="customRequirement" placeholder="非必填，用于补充生成要求。">' + escapeHtml(settings.customRequirement || '') + '</textarea>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-option-stack">'
        +     '<div class="xmind-casegen-prep-option-group">'
        +       '<div class="xmind-casegen-prep-option-group-head">'
        +         '<strong class="xmind-casegen-prep-option-group-title">去重设置</strong>'
        +         '<span class="xmind-casegen-prep-option-group-desc">控制全量生成后的自动 AI 去重和工具栏手动 AI 去重。</span>'
        +       '</div>'
        +       '<div class="xmind-casegen-prep-toggle-grid">' + dedupeHtml + '</div>'
        +     '</div>'
        +     '<div class="xmind-casegen-prep-option-group">'
        +       '<div class="xmind-casegen-prep-option-group-head">'
        +         '<strong class="xmind-casegen-prep-option-group-title">基础生成开关</strong>'
        +         '<span class="xmind-casegen-prep-option-group-desc">先把覆盖策略选好，再回到画布触发生成。</span>'
        +       '</div>'
        +       '<div class="xmind-casegen-prep-toggle-grid">' + primaryHtml + '</div>'
        +     '</div>'
        +     '<div class="xmind-casegen-prep-option-group ' + (settings.needSpecial ? '' : 'is-disabled') + '" data-casegen-special-group>'
        +       '<div class="xmind-casegen-prep-option-group-head">'
        +         '<strong class="xmind-casegen-prep-option-group-title">特殊场景细项</strong>'
        +         '<span class="xmind-casegen-prep-option-group-desc" data-casegen-special-desc>' + (settings.needSpecial ? '按需补足本轮要覆盖的特殊场景。' : '先开启“考虑特殊场景”，再选择具体细项。') + '</span>'
        +       '</div>'
        +       '<div class="xmind-casegen-prep-toggle-grid xmind-casegen-prep-toggle-grid-compact">' + specialHtml + '</div>'
        +   '</div>'
        + '</div>';
    }

    function renderPrepFooter() {
      var prep = getPrepState();
      var step = clampPrepStep(prep.step);
      var nextDisabled = false;
      var resetDisabled = hasAnyRunningGenerationOperation();
      if (step === STEP_REQUIREMENT) nextDisabled = !hasRequirementReady();
      if (step === STEP_CASES) nextDisabled = !hasCaseStepReady();
      return '<div class="xmind-casegen-prep-footer">'
        + '<div class="xmind-casegen-prep-footer-side">'
        +   '<button type="button" class="secondary xmind-casegen-prep-reset-btn" id="xmindCaseGenPrepResetBtn" data-prep-action="reset-prep" '
        +     (resetDisabled ? 'disabled' : '') + '>重置</button>'
        + '</div>'
        + '<div class="xmind-casegen-prep-nav">'
        +   (step > STEP_REQUIREMENT
          ? '<button type="button" class="secondary" data-prep-nav="prev">上一步</button>'
          : '')
        +   '<div class="xmind-casegen-prep-nav-main">'
        +   (step < STEP_OPTIONS
          ? '<button type="button" data-prep-nav="next" ' + (nextDisabled ? 'disabled' : '') + '>下一步</button>'
          : '<button type="button" data-prep-nav="confirm">确认并保存</button>')
        +   '</div>'
        + '</div>'
        + '</div>';
    }

    function renderPrepDialog() {
      if (!summaryDialogBodyEl) return;
      var prep = getPrepState();
      var currentStep = clampPrepStep(prep.step);
      if (prep.step !== currentStep) prep.step = currentStep;
      var mainHtml = '';
      if (currentStep === STEP_REQUIREMENT) mainHtml = renderRequirementStepCard();
      else if (currentStep === STEP_CASES) mainHtml = renderCasesStepCard();
      else mainHtml = renderOptionsStepCard();
      summaryDialogBodyEl.innerHTML = ''
        + '<div class="xmind-casegen-prep-flow">'
        +   renderPrepStepTabs()
        +   mainHtml
        +   renderPrepFooter()
        + '</div>';
    }

    function setPrepStep(step) {
      var next = clampPrepStep(step);
      setPrepField('step', next);
      renderOpenedSummaryDialog();
    }

    function handlePrepNav(actionId) {
      var prep = getPrepState();
      var currentStep = clampPrepStep(prep.step);
      if (actionId === 'prev') {
        setPrepStep(currentStep - 1);
        return true;
      }
      if (actionId === 'next') {
        if (currentStep === STEP_REQUIREMENT && !hasRequirementReady()) return false;
        if (currentStep === STEP_CASES && !hasCaseStepReady()) return false;
        setPrepStep(currentStep + 1);
        return true;
      }
      if (actionId === 'confirm') {
        syncSummaryDraftIntoState({ preserveCompleted: true });
        if (!hasRequirementReady() || !hasCaseStepReady()) return false;
        var shouldCenterRoot = prep.completed !== true && String(prep.caseImportMode || '') === 'import';
        prep.baseLocked = true;
        prep.completed = true;
        prep.step = STEP_OPTIONS;
        persistXmindState(true);
        notifySuccessToast('已保存生成前置准备', 3000);
        closeSummaryDialog({ skipPersist: true });
        renderMind({
          reason: 'prep-confirmed',
          persist: false,
          centerRootAfterRender: true,
          skipRestorableViewState: true,
        });
        if (shouldCenterRoot) centerRootNodeView({ persist: true });
        return true;
      }
      return false;
    }

    function dispatchNativeChange(target) {
      if (!target || !target.dispatchEvent) return;
      var changeEvent = null;
      if (typeof Event === 'function') {
        changeEvent = new Event('change', { bubbles: true, cancelable: true });
      } else if (documentRef && documentRef.createEvent) {
        changeEvent = documentRef.createEvent('Event');
        changeEvent.initEvent('change', true, true);
      }
      if (changeEvent) target.dispatchEvent(changeEvent);
    }

    function getPrepRequirementDropzone(target) {
      if (!target || !target.closest) return null;
      return target.closest('#xmindCaseGenPrepRequirementDropzone');
    }

    function getPrepCasesDropzone(target) {
      if (!target || !target.closest) return null;
      return target.closest('#xmindCaseGenPrepCasesDropzone');
    }

    function handleClick(event) {
      var choiceTarget = event && event.target && event.target.closest
        ? event.target.closest('label.xmind-casegen-prep-choice')
        : null;
      if (choiceTarget) {
        var radioInput = choiceTarget.querySelector ? choiceTarget.querySelector('input[type="radio"]') : null;
        if (radioInput && radioInput.disabled !== true) {
          if (event && event.target === radioInput) return;
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          radioInput.checked = true;
          dispatchNativeChange(radioInput);
          return;
        }
      }
      var toggleTarget = event && event.target && event.target.closest
        ? event.target.closest('label.xmind-casegen-prep-toggle')
        : null;
      if (toggleTarget) {
        var toggleInput = toggleTarget.querySelector ? toggleTarget.querySelector('input[type="checkbox"][data-casegen-setting]') : null;
        if (toggleInput && toggleInput.disabled !== true) {
          if (event && event.target === toggleInput) return;
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          toggleInput.checked = toggleInput.checked !== true;
          dispatchNativeChange(toggleInput);
          return;
        }
      }
      var navTarget = event && event.target && event.target.closest
        ? event.target.closest('[data-prep-nav]')
        : null;
      if (navTarget) {
        var navId = String(navTarget.getAttribute('data-prep-nav') || '');
        if (!navId || navTarget.disabled) return;
        handlePrepNav(navId);
        return;
      }
      var actionTarget = event && event.target && event.target.closest
        ? event.target.closest('[data-prep-action]')
        : null;
      if (!actionTarget) return;
      var actionId = String(actionTarget.getAttribute('data-prep-action') || '');
      if (!actionId) return;
      if (actionId === 'import-requirement') {
        triggerRequirementImport();
        return;
      }
      if (actionId === 'import-cases') {
        triggerCasesImport();
        return;
      }
      if (actionId === 'select-cases-library') {
        triggerCasesLibrarySelect();
        return;
      }
      if (actionId === 'upload-manual-images') {
        var input = ensureManualImageInput();
        if (input && typeof input.click === 'function') input.click();
        return;
      }
      if (actionId === 'reset-prep') {
        requestPrepReset();
        return;
      }
      if (actionId === 'remove-manual-image') {
        var imageIndex = Number(actionTarget.getAttribute('data-image-index'));
        if (Number.isFinite(imageIndex)) {
          removeManualRequirementImage(imageIndex);
          renderOpenedSummaryDialog();
        }
      }
    }

    function handleChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target) return;
      if (target.name === 'xmindRequirementMode') {
        if (isPrepBaseLocked()) {
          renderOpenedSummaryDialog();
          return;
        }
        setPrepField('requirementMode', target.value === 'manual' ? 'manual' : 'document');
        renderOpenedSummaryDialog();
        return;
      }
      if (target.name === 'xmindCaseImportMode') {
        if (isPrepBaseLocked()) {
          renderOpenedSummaryDialog();
          return;
        }
        setPrepField('caseImportMode', target.value === 'import' ? 'import' : 'skip');
        renderOpenedSummaryDialog();
        scheduleRender('case-import-mode-change');
        return;
      }
      var settingKey = target.getAttribute ? target.getAttribute('data-casegen-setting') : '';
      if (settingKey) {
        setCaseGenOption(settingKey, target.type === 'checkbox' ? target.checked === true : (target.value || ''));
        if (target.type === 'checkbox') syncPrepOptionToggleDom();
        else renderOpenedSummaryDialog();
      }
    }

    function handleInput(event) {
      var target = event && event.target ? event.target : null;
      if (!target) return;
      var prepInputKey = target.getAttribute ? target.getAttribute('data-prep-input') : '';
      if (prepInputKey === 'manualRequirementLabel') {
        setPrepField('manualRequirementLabel', target.value || '');
        return;
      }
      if (prepInputKey === 'requirementSupplement') {
        setPrepField('requirementSupplement', target.value || '');
        return;
      }
      if (target.getAttribute && target.getAttribute('data-manual-requirement-text')) {
        setManualRequirementText(target.value || '');
        return;
      }
      var settingKey = target.getAttribute ? target.getAttribute('data-casegen-setting') : '';
      if (settingKey && target.type !== 'checkbox') setCaseGenOption(settingKey, target.value || '');
    }

    function handlePaste(event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.getAttribute || !target.getAttribute('data-manual-requirement-text')) return;
      var clipboardData = event.clipboardData;
      var files = [];
      if (clipboardData && clipboardData.items) {
        for (var i = 0; i < clipboardData.items.length; i += 1) {
          var item = clipboardData.items[i];
          if (!item || item.kind !== 'file') continue;
          var file = item.getAsFile ? item.getAsFile() : null;
          if (!file || !(file.type || '').match(/^image\//i)) continue;
          files.push(file);
        }
      }
      if (!files.length) return;
      if (event.preventDefault) event.preventDefault();
      appendManualRequirementImages(files).then(function(ok) {
        if (ok) {
          notifyStatus('已粘贴需求图片', 'ok');
          renderOpenedSummaryDialog();
        }
      });
    }

    function handleDragOver(event) {
      var target = event && event.target ? event.target : null;
      var dropZone = getPrepRequirementDropzone(target) || getPrepCasesDropzone(target);
      if (!dropZone || isPrepBaseLocked()) return;
      if (event.preventDefault) event.preventDefault();
      if (dropZone.classList) dropZone.classList.add('dragover');
    }

    function handleDragLeave(event) {
      var target = event && event.target ? event.target : null;
      var dropZone = getPrepRequirementDropzone(target) || getPrepCasesDropzone(target);
      if (!dropZone) return;
      var related = event ? event.relatedTarget : null;
      if (related && dropZone.contains && dropZone.contains(related)) return;
      if (dropZone.classList) dropZone.classList.remove('dragover');
    }

    function handleDrop(event) {
      var target = event && event.target ? event.target : null;
      var requirementZone = getPrepRequirementDropzone(target);
      var casesZone = getPrepCasesDropzone(target);
      var dropZone = requirementZone || casesZone;
      if (!dropZone) return;
      if (event.preventDefault) event.preventDefault();
      if (dropZone.classList) dropZone.classList.remove('dragover');
      if (isPrepBaseLocked()) return;
      var files = event && event.dataTransfer ? event.dataTransfer.files : null;
      if (requirementZone) {
        var file = files && files[0] ? files[0] : null;
        if (file) importRequirementFileFromDrop(file);
        return;
      }
      if (casesZone) importCasesFilesFromDrop(files);
    }

    function bind() {
      if (listenerBound || !summaryDialogBodyEl || typeof summaryDialogBodyEl.addEventListener !== 'function') return;
      listenerBound = true;
      handlers.click = handleClick;
      handlers.change = handleChange;
      handlers.input = handleInput;
      handlers.paste = handlePaste;
      handlers.dragover = handleDragOver;
      handlers.dragleave = handleDragLeave;
      handlers.drop = handleDrop;
      Object.keys(handlers).forEach(function(eventName) {
        summaryDialogBodyEl.addEventListener(eventName, handlers[eventName]);
      });
    }

    function unbind() {
      if (!listenerBound) return;
      listenerBound = false;
      if (summaryDialogBodyEl && typeof summaryDialogBodyEl.removeEventListener === 'function') {
        Object.keys(handlers).forEach(function(eventName) {
          summaryDialogBodyEl.removeEventListener(eventName, handlers[eventName]);
        });
      }
      handlers = {};
    }

    return {
      bind: bind,
      unbind: unbind,
      syncSummaryDraftIntoState: syncSummaryDraftIntoState,
      syncPrepDialogState: syncPrepDialogState,
      syncPrepOptionToggleDom: syncPrepOptionToggleDom,
      renderPrepDialog: renderPrepDialog,
      setPrepStep: setPrepStep,
      handlePrepNav: handlePrepNav,
    };
  }

  return { create: create };
});
