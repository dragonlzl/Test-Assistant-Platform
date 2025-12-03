(function() {
  window.app = window.app || {};

  function init({ state, config, setStatus, dom }) {
    const {
      defaultPrompts,
      defaultMaxTokens,
      legacyCleanPrompt,
      legacyCaseGenPrompt,
      legacyCasesPrompt,
      providerDefaults,
      modelsKey,
      assignmentKey,
      legacyCleanKey,
      legacyCompareKey,
    } = config || {};

    const {
      modelDisplayNameEl,
      modelProviderEl,
      modelBaseUrlEl,
      modelApiKeyEl,
      modelIdentifierEl,
      modelMaxTokensEl,
      modelFormStatus,
      modelListEl,
      createModelBtn,
      modelFormWrapper,
      modelFormTitle,
      saveModelBtn,
      resetModelFormBtn,
      cleanModelSelect,
      reviewModelSelect,
      compareModelSelect,
      splitModelSelect,
      casesModelSelect,
      caseGenModelSelect,
      caseFilterModelSelect,
      cleanAssignStatus,
      reviewAssignStatus,
      compareAssignStatus,
      splitAssignStatus,
      casesAssignStatus,
      caseGenAssignStatus,
      caseFilterAssignStatus,
      cleanPromptEl,
      reviewPromptEl,
      comparePromptEl,
      splitPromptEl,
      casesPromptEl,
      caseGenPromptEl,
      caseFilterPromptEl,
      cleanReasoningSelect,
      reviewReasoningSelect,
      compareReasoningSelect,
      splitReasoningSelect,
      casesReasoningSelect,
      caseGenReasoningSelect,
      caseFilterReasoningSelect,
    } = dom || {};

    const legacyCleanStorageKey = legacyCleanKey || 'cleaner-config-v1';
    const legacyCompareStorageKey = legacyCompareKey || 'cleaner-compare-config-v1';

    if (!state || !config) {
      console.warn('models.init 缺少 state 或 config');
    }

    function loadModels() {
      try {
        state.models = JSON.parse(localStorage.getItem(modelsKey) || '[]');
      } catch (e) {
        state.models = [];
      }
      migrateLegacyConfigs();
    }

    function migrateLegacyConfigs() {
      const before = state.models.length;
      try {
        const legacyClean = JSON.parse(localStorage.getItem(legacyCleanStorageKey) || '{}');
        if (legacyClean && legacyClean.baseUrl && legacyClean.apiKey && legacyClean.modelName) {
          if (!state.models.some(m => m.baseUrl === legacyClean.baseUrl && m.model === legacyClean.modelName)) {
            state.models.push({
              id: `legacy-clean-${Date.now()}`,
              name: '旧清洗配置',
              provider: legacyClean.provider || 'custom',
              baseUrl: legacyClean.baseUrl,
              apiKey: legacyClean.apiKey,
              model: legacyClean.modelName,
              maxTokens: legacyClean.maxTokens || defaultMaxTokens,
            });
          }
          if (!state.assignments.cleanPrompt || state.assignments.cleanPrompt === defaultPrompts.system) {
            state.assignments.cleanPrompt = legacyClean.prompt || defaultPrompts.system;
          }
        }
        const legacyCompare = JSON.parse(localStorage.getItem(legacyCompareStorageKey) || '{}');
        if (legacyCompare && legacyCompare.baseUrl && legacyCompare.apiKey && legacyCompare.model) {
          if (!state.models.some(m => m.baseUrl === legacyCompare.baseUrl && m.model === legacyCompare.model)) {
            state.models.push({
              id: `legacy-compare-${Date.now()}`,
              name: '旧对比配置',
              provider: legacyCompare.provider || 'custom',
              baseUrl: legacyCompare.baseUrl,
              apiKey: legacyCompare.apiKey,
              model: legacyCompare.model,
              maxTokens: legacyCompare.maxTokens || defaultMaxTokens,
            });
          }
          if (!state.assignments.comparePrompt || state.assignments.comparePrompt === defaultPrompts.compare) {
            state.assignments.comparePrompt = legacyCompare.prompt || defaultPrompts.compare;
          }
        }
        if (!state.assignments.splitPrompt) {
          state.assignments.splitPrompt = defaultPrompts.split;
        }
        if (!state.assignments.casesPrompt) {
          state.assignments.casesPrompt = defaultPrompts.cases;
        }
      } catch (err) {
        console.warn('旧配置迁移失败', err);
      }
      if (state.models.length !== before) {
        localStorage.setItem(modelsKey, JSON.stringify(state.models));
      }
    }

    function saveModels() {
      localStorage.setItem(modelsKey, JSON.stringify(state.models));
      renderModels();
      renderAssignmentsSelect();
    }

    function renderModels() {
      if (!modelListEl) return;
      if (!state.models.length) {
        modelListEl.innerHTML = '<p class="hint">尚未配置模型，请先创建。</p>';
        return;
      }
      modelListEl.innerHTML = state.models.map(m => `
        <div class="model-card" data-id="${m.id}">
          <strong>${m.name || '未命名模型'}</strong>
          <div class="meta">
            <span>类型：${m.provider}</span>
            <span>模型 ID：${m.model}</span>
            <span>Max Tokens：${m.maxTokens || defaultMaxTokens}</span>
          </div>
          <div class="actions">
            <button class="secondary" data-edit="${m.id}">编辑</button>
            <button class="secondary" data-delete="${m.id}">删除</button>
          </div>
        </div>
      `).join('');

      modelListEl.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => fillModelForm(btn.dataset.edit));
      });
      modelListEl.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deleteModel(btn.dataset.delete));
      });
    }

    function resetModelForm(hide = false) {
      state.editingId = null;
      if (modelDisplayNameEl) modelDisplayNameEl.value = '';
      if (modelProviderEl) modelProviderEl.value = 'deepseek';
      if (modelBaseUrlEl) modelBaseUrlEl.value = '';
      if (modelApiKeyEl) modelApiKeyEl.value = '';
      if (modelIdentifierEl) modelIdentifierEl.value = '';
      if (modelMaxTokensEl) modelMaxTokensEl.value = defaultMaxTokens;
      setStatus(modelFormStatus, hide ? '' : '已重置表单', '');
      if (hide && modelFormWrapper) {
        modelFormWrapper.classList.add('hidden');
      }
      applyProviderPreset(modelProviderEl, modelBaseUrlEl, modelIdentifierEl);
    }

    function fillModelForm(id) {
      const model = state.models.find(m => m.id === id);
      if (!model) return;
      state.editingId = id;
      if (modelFormWrapper) modelFormWrapper.classList.remove('hidden');
      if (modelFormTitle) modelFormTitle.textContent = '编辑模型';
      if (modelDisplayNameEl) modelDisplayNameEl.value = model.name || '';
      if (modelProviderEl) modelProviderEl.value = model.provider || 'custom';
      if (modelBaseUrlEl) modelBaseUrlEl.value = model.baseUrl || '';
      if (modelApiKeyEl) modelApiKeyEl.value = model.apiKey || '';
      if (modelIdentifierEl) modelIdentifierEl.value = model.model || '';
      if (modelMaxTokensEl) modelMaxTokensEl.value = model.maxTokens || defaultMaxTokens;
      setStatus(modelFormStatus, '已加载待编辑模型，可修改后保存', 'ok');
    }

    function deleteModel(id) {
      state.models = state.models.filter(m => m.id !== id);
      saveModels();
      if (state.assignments.cleanId === id) state.assignments.cleanId = '';
      if (state.assignments.compareId === id) state.assignments.compareId = '';
      saveAssignments();
    }

    function applyProviderPreset(providerEl, baseUrlEl, modelEl) {
      const preset = providerDefaults[providerEl && providerEl.value];
      if (!preset) return;
      if (baseUrlEl && !baseUrlEl.value.trim()) baseUrlEl.value = preset.baseUrl;
      if (modelEl && !modelEl.value.trim()) modelEl.value = preset.model;
    }

    function saveModel() {
      const maxTokensVal = parseInt(modelMaxTokensEl ? modelMaxTokensEl.value : defaultMaxTokens, 10);
      const model = {
        id: state.editingId || `model-${Date.now()}`,
        name: modelDisplayNameEl ? modelDisplayNameEl.value.trim() || '未命名模型' : '未命名模型',
        provider: modelProviderEl ? modelProviderEl.value : 'custom',
        baseUrl: modelBaseUrlEl ? modelBaseUrlEl.value.trim() : '',
        apiKey: modelApiKeyEl ? modelApiKeyEl.value.trim() : '',
        model: modelIdentifierEl ? modelIdentifierEl.value.trim() : '',
        maxTokens: Number.isFinite(maxTokensVal) && maxTokensVal > 0 ? maxTokensVal : defaultMaxTokens,
      };
      if (!model.baseUrl || !model.apiKey || !model.model) {
        setStatus(modelFormStatus, '请至少填写接口、API Key、模型 ID', 'warn');
        return;
      }
      const exists = state.models.findIndex(m => m.id === model.id);
      if (exists >= 0) {
        state.models[exists] = model;
        setStatus(modelFormStatus, '模型已更新', 'ok');
      } else {
        state.models.push(model);
        setStatus(modelFormStatus, '模型已保存', 'ok');
      }
      state.editingId = null;
      saveModels();
      if (modelFormWrapper) modelFormWrapper.classList.add('hidden');
      renderAssignmentsSelect();
    }

    function loadAssignments() {
      let migrated = false;
      try {
        state.assignments = JSON.parse(localStorage.getItem(assignmentKey) || '{}');
      } catch (e) {
        state.assignments = {};
      }
      state.assignments.cleanId = state.assignments.cleanId || '';
      state.assignments.reviewId = state.assignments.reviewId || '';
      state.assignments.compareId = state.assignments.compareId || '';
      state.assignments.splitId = state.assignments.splitId || '';
      state.assignments.casesId = state.assignments.casesId || '';
      state.assignments.caseGenId = state.assignments.caseGenId || '';
      state.assignments.caseFilterId = state.assignments.caseFilterId || '';
      state.assignments.cleanPrompt = state.assignments.cleanPrompt || defaultPrompts.system;
      if (state.assignments.cleanPrompt === legacyCleanPrompt) {
        state.assignments.cleanPrompt = defaultPrompts.system;
        migrated = true;
      }
      state.assignments.reviewPrompt = state.assignments.reviewPrompt || defaultPrompts.review;
      state.assignments.comparePrompt = state.assignments.comparePrompt || defaultPrompts.compare;
      state.assignments.splitPrompt = state.assignments.splitPrompt || defaultPrompts.split;
      state.assignments.caseGenPrompt = state.assignments.caseGenPrompt || defaultPrompts.casegen;
      if (state.assignments.caseGenPrompt === legacyCaseGenPrompt) {
        state.assignments.caseGenPrompt = defaultPrompts.casegen;
        migrated = true;
      }
      state.assignments.caseFilterPrompt = state.assignments.caseFilterPrompt || defaultPrompts.casefilter;
      state.assignments.cleanReasoning = state.assignments.cleanReasoning || '';
      state.assignments.reviewReasoning = state.assignments.reviewReasoning || '';
      state.assignments.compareReasoning = state.assignments.compareReasoning || '';
      state.assignments.splitReasoning = state.assignments.splitReasoning || '';
      state.assignments.casesReasoning = state.assignments.casesReasoning || '';
      state.assignments.caseGenReasoning = state.assignments.caseGenReasoning || '';
      state.assignments.caseFilterReasoning = state.assignments.caseFilterReasoning || '';
      if (!state.assignments.casesPrompt) {
        state.assignments.casesPrompt = defaultPrompts.cases;
      } else if (state.assignments.casesPrompt === legacyCasesPrompt) {
        state.assignments.casesPrompt = defaultPrompts.cases;
        migrated = true;
      }
      if (state.assignments.caseFilterPrompt === legacyCaseGenPrompt) {
        state.assignments.caseFilterPrompt = defaultPrompts.casefilter;
        migrated = true;
      }
      if (migrated) {
        localStorage.setItem(assignmentKey, JSON.stringify(state.assignments));
      }
    }

    function saveAssignments() {
      if (cleanModelSelect) state.assignments.cleanId = cleanModelSelect.value || '';
      if (reviewModelSelect) state.assignments.reviewId = reviewModelSelect.value || '';
      if (compareModelSelect) state.assignments.compareId = compareModelSelect.value || '';
      if (splitModelSelect) state.assignments.splitId = splitModelSelect.value || '';
      if (casesModelSelect) state.assignments.casesId = casesModelSelect.value || '';
      if (caseGenModelSelect) state.assignments.caseGenId = caseGenModelSelect.value || '';
      if (caseFilterModelSelect) state.assignments.caseFilterId = caseFilterModelSelect.value || '';
      if (cleanPromptEl) state.assignments.cleanPrompt = cleanPromptEl.value.trim() || defaultPrompts.system;
      if (reviewPromptEl) state.assignments.reviewPrompt = reviewPromptEl.value.trim() || defaultPrompts.review;
      if (comparePromptEl) state.assignments.comparePrompt = comparePromptEl.value.trim() || defaultPrompts.compare;
      if (splitPromptEl) state.assignments.splitPrompt = splitPromptEl.value.trim() || defaultPrompts.split;
      if (casesPromptEl) state.assignments.casesPrompt = casesPromptEl.value.trim() || defaultPrompts.cases;
      if (caseGenPromptEl) state.assignments.caseGenPrompt = caseGenPromptEl.value.trim() || defaultPrompts.casegen;
      if (caseFilterPromptEl) state.assignments.caseFilterPrompt = caseFilterPromptEl.value.trim() || defaultPrompts.casefilter;
      if (cleanReasoningSelect) state.assignments.cleanReasoning = cleanReasoningSelect.value || '';
      if (reviewReasoningSelect) state.assignments.reviewReasoning = reviewReasoningSelect.value || '';
      if (compareReasoningSelect) state.assignments.compareReasoning = compareReasoningSelect.value || '';
      if (splitReasoningSelect) state.assignments.splitReasoning = splitReasoningSelect.value || '';
      if (casesReasoningSelect) state.assignments.casesReasoning = casesReasoningSelect.value || '';
      if (caseGenReasoningSelect) state.assignments.caseGenReasoning = caseGenReasoningSelect.value || '';
      if (caseFilterReasoningSelect) state.assignments.caseFilterReasoning = caseFilterReasoningSelect.value || '';
      localStorage.setItem(assignmentKey, JSON.stringify(state.assignments));
      updateAssignmentStatuses();
      setStatus(cleanAssignStatus, '指派已保存', 'ok');
      setStatus(reviewAssignStatus, '指派已保存', 'ok');
      setStatus(compareAssignStatus, '指派已保存', 'ok');
      setStatus(splitAssignStatus, '指派已保存', 'ok');
      setStatus(casesAssignStatus, '指派已保存', 'ok');
      setStatus(caseGenAssignStatus, '指派已保存', 'ok');
      setStatus(caseFilterAssignStatus, '指派已保存', 'ok');
    }

    function renderAssignmentsSelect() {
      if (!cleanModelSelect || !caseFilterPromptEl) return;
      const placeholder = '<option value="">暂无可用模型</option>';
      const createOptions = (selectedId) => state.models.map(m => {
        const sel = m.id === selectedId ? 'selected' : '';
        return `<option value="${m.id}" ${sel}>${m.name} (${m.provider})</option>`;
      }).join('');

      if (!state.models.length) {
        cleanModelSelect.innerHTML = placeholder;
        if (reviewModelSelect) reviewModelSelect.innerHTML = placeholder;
        if (compareModelSelect) compareModelSelect.innerHTML = placeholder;
        if (splitModelSelect) splitModelSelect.innerHTML = placeholder;
        if (casesModelSelect) casesModelSelect.innerHTML = placeholder;
        if (caseGenModelSelect) caseGenModelSelect.innerHTML = placeholder;
        if (caseFilterModelSelect) caseFilterModelSelect.innerHTML = placeholder;
        state.assignments.cleanId = '';
        state.assignments.reviewId = '';
        state.assignments.compareId = '';
        state.assignments.splitId = '';
        state.assignments.casesId = '';
        state.assignments.caseGenId = '';
        state.assignments.caseFilterId = '';
        if (cleanPromptEl) cleanPromptEl.value = state.assignments.cleanPrompt || defaultPrompts.system;
        if (reviewPromptEl) reviewPromptEl.value = state.assignments.reviewPrompt || defaultPrompts.review;
        if (comparePromptEl) comparePromptEl.value = state.assignments.comparePrompt || defaultPrompts.compare;
        if (splitPromptEl) splitPromptEl.value = state.assignments.splitPrompt || defaultPrompts.split;
        if (casesPromptEl) casesPromptEl.value = state.assignments.casesPrompt || defaultPrompts.cases;
        if (caseGenPromptEl) caseGenPromptEl.value = state.assignments.caseGenPrompt || defaultPrompts.casegen;
        if (caseFilterPromptEl) caseFilterPromptEl.value = state.assignments.caseFilterPrompt || defaultPrompts.casefilter;
        updateAssignmentStatuses();
        ['clean', 'review', 'compare', 'split', 'cases', 'casegen', 'casefilter'].forEach(updateReasoningVisibility);
        return;
      }

      const firstModelId = state.models[0] && state.models[0].id ? state.models[0].id : '';
      const secondModelId = state.models[1] && state.models[1].id ? state.models[1].id : '';
      const thirdModelId = state.models[2] && state.models[2].id ? state.models[2].id : '';
      const fourthModelId = state.models[3] && state.models[3].id ? state.models[3].id : '';
      const fifthModelId = state.models[4] && state.models[4].id ? state.models[4].id : '';
      const sixthModelId = state.models[5] && state.models[5].id ? state.models[5].id : '';
      const seventhModelId = state.models[6] && state.models[6].id ? state.models[6].id : '';
      const cleanSel = state.assignments.cleanId || firstModelId;
      const reviewSel = state.assignments.reviewId || (secondModelId || state.assignments.cleanId || firstModelId);
      const compareSel = state.assignments.compareId || (thirdModelId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const splitSel = state.assignments.splitId || (fourthModelId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const casesSel = state.assignments.casesId || (fifthModelId || state.assignments.splitId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const caseGenSel = state.assignments.caseGenId || (sixthModelId || state.assignments.casesId || state.assignments.splitId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const caseFilterSel = state.assignments.caseFilterId || (seventhModelId || state.assignments.caseGenId || state.assignments.casesId || state.assignments.splitId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);

      cleanModelSelect.innerHTML = createOptions(cleanSel);
      if (reviewModelSelect) reviewModelSelect.innerHTML = createOptions(reviewSel);
      if (compareModelSelect) compareModelSelect.innerHTML = createOptions(compareSel);
      if (splitModelSelect) splitModelSelect.innerHTML = createOptions(splitSel);
      if (casesModelSelect) casesModelSelect.innerHTML = createOptions(casesSel);
      if (caseGenModelSelect) caseGenModelSelect.innerHTML = createOptions(caseGenSel);
      if (caseFilterModelSelect) caseFilterModelSelect.innerHTML = createOptions(caseFilterSel);

      state.assignments.cleanId = cleanModelSelect.value || '';
      state.assignments.reviewId = reviewModelSelect ? reviewModelSelect.value || '' : '';
      state.assignments.compareId = compareModelSelect ? compareModelSelect.value || '' : '';
      state.assignments.splitId = splitModelSelect ? splitModelSelect.value || '' : '';
      state.assignments.casesId = casesModelSelect ? casesModelSelect.value || '' : '';
      state.assignments.caseGenId = caseGenModelSelect ? caseGenModelSelect.value || '' : '';
      state.assignments.caseFilterId = caseFilterModelSelect ? caseFilterModelSelect.value || '' : '';
      if (cleanPromptEl) cleanPromptEl.value = state.assignments.cleanPrompt || defaultPrompts.system;
      if (reviewPromptEl) reviewPromptEl.value = state.assignments.reviewPrompt || defaultPrompts.review;
      if (comparePromptEl) comparePromptEl.value = state.assignments.comparePrompt || defaultPrompts.compare;
      if (splitPromptEl) splitPromptEl.value = state.assignments.splitPrompt || defaultPrompts.split;
      if (casesPromptEl) casesPromptEl.value = state.assignments.casesPrompt || defaultPrompts.cases;
      if (caseGenPromptEl) caseGenPromptEl.value = state.assignments.caseGenPrompt || defaultPrompts.casegen;
      if (caseFilterPromptEl) caseFilterPromptEl.value = state.assignments.caseFilterPrompt || defaultPrompts.casefilter;

      updateAssignmentStatuses();
      ['clean', 'review', 'compare', 'split', 'cases', 'casegen', 'casefilter'].forEach(updateReasoningVisibility);
      if (cleanReasoningSelect) cleanReasoningSelect.value = state.assignments.cleanReasoning || '';
      if (reviewReasoningSelect) reviewReasoningSelect.value = state.assignments.reviewReasoning || '';
      if (compareReasoningSelect) compareReasoningSelect.value = state.assignments.compareReasoning || '';
      if (splitReasoningSelect) splitReasoningSelect.value = state.assignments.splitReasoning || '';
      if (casesReasoningSelect) casesReasoningSelect.value = state.assignments.casesReasoning || '';
      if (caseGenReasoningSelect) caseGenReasoningSelect.value = state.assignments.caseGenReasoning || '';
    }

    function updateAssignmentStatuses() {
      const cleanModel = getModelById(state.assignments.cleanId);
      const reviewModel = getModelById(state.assignments.reviewId);
      const compareModel = getModelById(state.assignments.compareId);
      const splitModel = getModelById(state.assignments.splitId);
      const casesModel = getModelById(state.assignments.casesId);
      const caseGenModel = getModelById(state.assignments.caseGenId);
      const caseFilterModel = getModelById(state.assignments.caseFilterId);
      setStatus(cleanAssignStatus, cleanModel ? `当前清洗模型：${cleanModel.name}` : '尚未指派清洗模型', cleanModel ? 'ok' : 'warn');
      setStatus(reviewAssignStatus, reviewModel ? `当前评审模型：${reviewModel.name}` : '尚未指派评审模型', reviewModel ? 'ok' : 'warn');
      setStatus(compareAssignStatus, compareModel ? `当前对比模型：${compareModel.name}` : '尚未指派对比模型', compareModel ? 'ok' : 'warn');
      setStatus(splitAssignStatus, splitModel ? `当前拆分模型：${splitModel.name}` : '尚未指派拆分模型', splitModel ? 'ok' : 'warn');
      setStatus(casesAssignStatus, casesModel ? `当前覆盖对比模型：${casesModel.name}` : '尚未指派覆盖对比模型', casesModel ? 'ok' : 'warn');
      setStatus(caseGenAssignStatus, caseGenModel ? `当前用例生成功能模型：${caseGenModel.name}` : '尚未指派用例生产模型', caseGenModel ? 'ok' : 'warn');
      setStatus(caseFilterAssignStatus, caseFilterModel ? `当前用例相似对比模型：${caseFilterModel.name}` : '尚未指派用例相似对比模型', caseFilterModel ? 'ok' : 'warn');
    }

    function getModelById(id) {
      return state.models.find(m => m.id === id);
    }

    const reasoningKeys = {
      clean: 'cleanReasoning',
      review: 'reviewReasoning',
      compare: 'compareReasoning',
      split: 'splitReasoning',
      cases: 'casesReasoning',
      casegen: 'caseGenReasoning',
      casefilter: 'caseFilterReasoning',
    };

    function getAssignmentKeyPrefix(type) {
      if (type === 'casegen') return 'caseGen';
      if (type === 'casefilter') return 'caseFilter';
      return type;
    }

    function modelIsR1(model) {
      const source = model && model.model ? model.model : '';
      const id = source ? source.toLowerCase() : '';
      return id.includes('deepseek-r1') || id.includes('deepseek-reasoner');
    }

    function updateReasoningVisibility(type) {
      const row = document.querySelector(`[data-reasoning="${type}"]`);
      const select = document.getElementById(`${type}Reasoning`);
      const prefix = getAssignmentKeyPrefix(type);
      const idKey = `${prefix}Id`;
      const model = getModelById(state.assignments[idKey]);
      const show = modelIsR1(model);
      if (row) row.classList.toggle('hidden', !show);
      if (select) select.value = show ? (state.assignments[reasoningKeys[type]] || '') : '';
    }

    function getReasoningForType(type) {
      const prefix = getAssignmentKeyPrefix(type);
      const idKey = `${prefix}Id`;
      const model = getModelById(state.assignments[idKey]);
      if (!modelIsR1(model)) return '';
      return state.assignments[reasoningKeys[type]] || '';
    }

    function getAssignedModel(type) {
      const id = type === 'clean'
        ? state.assignments.cleanId
        : type === 'review'
        ? state.assignments.reviewId
        : type === 'compare'
        ? state.assignments.compareId
        : type === 'split'
        ? state.assignments.splitId
        : type === 'cases'
        ? state.assignments.casesId
        : type === 'casefilter'
        ? state.assignments.caseFilterId
        : state.assignments.caseGenId;
      const label = type === 'clean'
        ? '清洗'
        : type === 'review'
        ? '评审'
        : type === 'compare'
        ? '对比'
        : type === 'split'
        ? '拆分'
        : type === 'cases'
        ? '覆盖对比'
        : type === 'casefilter'
        ? '用例相似对比'
        : '用例生成';
      const model = getModelById(id);
      if (!model) throw new Error(`未找到${label}模型，请先在功能指派中选择`);
      return model;
    }

    async function testModel(id, statusEl) {
      const model = getModelById(id);
      if (!model) {
        setStatus(statusEl, '未选择模型', 'warn');
        return;
      }
      setStatus(statusEl, '正在测试模型...', '');
      try {
        const body = {
          model: model.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 16,
        };
        const headers = { 'Content-Type': 'application/json' };
        if (model.apiKey) headers['Authorization'] = `Bearer ${model.apiKey}`;
        const res = await fetch(model.baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const hasChoices = data && data.choices && data.choices.length;
        const ok = hasChoices || (data && data.output_text) || (data && data.data);
        setStatus(statusEl, ok ? '测试成功，模型可用' : '连接成功但返回为空，请检查返回格式', ok ? 'ok' : 'warn');
      } catch (err) {
        console.error(err);
        setStatus(statusEl, `测试失败：${err.message || err}`, 'err');
      }
    }

    if (modelProviderEl) {
      modelProviderEl.addEventListener('change', () => applyProviderPreset(modelProviderEl, modelBaseUrlEl, modelIdentifierEl));
    }
    if (createModelBtn) {
      createModelBtn.addEventListener('click', () => {
        if (modelFormTitle) modelFormTitle.textContent = '新增模型';
        if (modelFormWrapper) modelFormWrapper.classList.remove('hidden');
        resetModelForm();
      });
    }
    if (saveModelBtn) {
      saveModelBtn.addEventListener('click', saveModel);
    }
    if (resetModelFormBtn) {
      resetModelFormBtn.addEventListener('click', () => resetModelForm(true));
    }

    return {
      loadModels,
      saveModels,
      renderModels,
      resetModelForm,
      fillModelForm,
      deleteModel,
      renderAssignmentsSelect,
      updateAssignmentStatuses,
      loadAssignments,
      saveAssignments,
      updateReasoningVisibility,
      getReasoningForType,
      getAssignedModel,
      testModel,
      saveModel,
    };
  }

  window.app.models = { init };
})();
