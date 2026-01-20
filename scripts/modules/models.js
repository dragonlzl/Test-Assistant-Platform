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

    const defaultTemperature = 0.2;
    const assignmentName = 'default';
    const api = window.app && window.app.apiClient;

    const domRefs = dom || {};
    const pickEl = function(key, id) { return domRefs[key] || document.getElementById(id); };
    const modelDisplayNameEl = pickEl('modelDisplayNameEl', 'modelDisplayName');
    const modelProviderEl = pickEl('modelProviderEl', 'modelProvider');
    const modelBaseUrlEl = pickEl('modelBaseUrlEl', 'modelBaseUrl');
    const modelApiKeyEl = pickEl('modelApiKeyEl', 'modelApiKey');
    const modelIdentifierEl = pickEl('modelIdentifierEl', 'modelIdentifier');
    const modelMaxTokensEl = pickEl('modelMaxTokensEl', 'modelMaxTokens');
    const modelFormStatus = pickEl('modelFormStatus', 'modelFormStatus');
    const modelListEl = pickEl('modelListEl', 'modelList');
    const createModelBtn = pickEl('createModelBtn', 'createModelBtn');
    const modelFormWrapper = pickEl('modelFormWrapper', 'modelFormWrapper');
    const modelFormTitle = pickEl('modelFormTitle', 'modelFormTitle');
    const saveModelBtn = pickEl('saveModelBtn', 'saveModelBtn');
    const resetModelFormBtn = pickEl('resetModelFormBtn', 'resetModelForm');
    const cleanModelSelect = pickEl('cleanModelSelect', 'cleanModelSelect');
    const reviewModelSelect = pickEl('reviewModelSelect', 'reviewModelSelect');
    const compareModelSelect = pickEl('compareModelSelect', 'compareModelSelect');
    const splitModelSelect = pickEl('splitModelSelect', 'splitModelSelect');
    const casesModelSelect = pickEl('casesModelSelect', 'casesModelSelect');
    const caseGenModelSelect = pickEl('caseGenModelSelect', 'caseGenModelSelect');
    const caseFilterModelSelect = pickEl('caseFilterModelSelect', 'caseFilterModelSelect');
    const missingReminderModelSelect = pickEl('missingReminderModelSelect', 'missingReminderModelSelect');
    const caseLibraryGenModelSelect = pickEl('caseLibraryGenModelSelect', 'caseLibraryGenModelSelect');
    const caseGenAgentModelSelect = pickEl('caseGenAgentModelSelect', 'caseGenAgentModelSelect');
    const cleanAssignStatus = pickEl('cleanAssignStatus', 'cleanAssignStatus');
    const reviewAssignStatus = pickEl('reviewAssignStatus', 'reviewAssignStatus');
    const compareAssignStatus = pickEl('compareAssignStatus', 'compareAssignStatus');
    const splitAssignStatus = pickEl('splitAssignStatus', 'splitAssignStatus');
    const casesAssignStatus = pickEl('casesAssignStatus', 'casesAssignStatus');
    const caseGenAssignStatus = pickEl('caseGenAssignStatus', 'caseGenAssignStatus');
    const caseFilterAssignStatus = pickEl('caseFilterAssignStatus', 'caseFilterAssignStatus');
    const missingReminderAssignStatus = pickEl('missingReminderAssignStatus', 'missingReminderAssignStatus');
    const caseLibraryGenAssignStatus = pickEl('caseLibraryGenAssignStatus', 'caseLibraryGenAssignStatus');
    const caseGenAgentAssignStatus = pickEl('caseGenAgentAssignStatus', 'caseGenAgentAssignStatus');
    const saveAssignmentsTopBtn = pickEl('saveAssignmentsTopBtn', 'saveAssignmentsTop');
    const assignSaveBar = pickEl('assignSaveBar', 'assignSaveBar');
    const cleanPromptEl = pickEl('cleanPromptEl', 'cleanPrompt');
    const reviewPromptEl = pickEl('reviewPromptEl', 'reviewPrompt');
    const comparePromptEl = pickEl('comparePromptEl', 'comparePrompt');
    const splitPromptEl = pickEl('splitPromptEl', 'splitPrompt');
    const casesPromptEl = pickEl('casesPromptEl', 'casesPrompt');
    const caseGenPromptEl = pickEl('caseGenPromptEl', 'caseGenPrompt');
    const caseFilterPromptEl = pickEl('caseFilterPromptEl', 'caseFilterPrompt');
    const missingReminderPromptEl = pickEl('missingReminderPromptEl', 'missingReminderPrompt');
    const caseLibraryGenPromptEl = pickEl('caseLibraryGenPromptEl', 'caseLibraryGenPrompt');
    const caseGenAgentPromptEl = pickEl('caseGenAgentPromptEl', 'caseGenAgentPrompt');
    const cleanReasoningSelect = pickEl('cleanReasoningSelect', 'cleanReasoning');
    const reviewReasoningSelect = pickEl('reviewReasoningSelect', 'reviewReasoning');
    const compareReasoningSelect = pickEl('compareReasoningSelect', 'compareReasoning');
    const splitReasoningSelect = pickEl('splitReasoningSelect', 'splitReasoning');
    const casesReasoningSelect = pickEl('casesReasoningSelect', 'casesReasoning');
    const caseGenReasoningSelect = pickEl('caseGenReasoningSelect', 'caseGenReasoning');
    const caseFilterReasoningSelect = pickEl('caseFilterReasoningSelect', 'caseFilterReasoning');
    const missingReminderReasoningSelect = pickEl('missingReminderReasoningSelect', 'missingReminderReasoning');
    const caseLibraryGenReasoningSelect = pickEl('caseLibraryGenReasoningSelect', 'caseLibraryGenReasoning');
    const caseGenAgentReasoningSelect = pickEl('caseGenAgentReasoningSelect', 'caseGenAgentReasoning');
    const cleanTemperatureEl = pickEl('cleanTemperatureEl', 'cleanTemperature');
    const reviewTemperatureEl = pickEl('reviewTemperatureEl', 'reviewTemperature');
    const compareTemperatureEl = pickEl('compareTemperatureEl', 'compareTemperature');
    const splitTemperatureEl = pickEl('splitTemperatureEl', 'splitTemperature');
    const casesTemperatureEl = pickEl('casesTemperatureEl', 'casesTemperature');
    const caseGenTemperatureEl = pickEl('caseGenTemperatureEl', 'caseGenTemperature');
    const caseFilterTemperatureEl = pickEl('caseFilterTemperatureEl', 'caseFilterTemperature');
    const missingReminderTemperatureEl = pickEl('missingReminderTemperatureEl', 'missingReminderTemperature');
    const caseLibraryGenTemperatureEl = pickEl('caseLibraryGenTemperatureEl', 'caseLibraryGenTemperature');
    const caseGenAgentTemperatureEl = pickEl('caseGenAgentTemperatureEl', 'caseGenAgentTemperature');

    const legacyCleanStorageKey = legacyCleanKey || 'cleaner-config-v1';
    const legacyCompareStorageKey = legacyCompareKey || 'cleaner-compare-config-v1';

    if (!state || !config) {
      console.warn('models.init 缺少 state 或 config');
    }

    function getStableModelId(model) {
      if (!model) return '';
      var hasRemote = model.remoteId !== undefined && model.remoteId !== null;
      var stable = hasRemote ? model.remoteId : model.id;
      if (stable === undefined || stable === null) return '';
      return String(stable);
    }

    function normalizeModelName(name) {
      if (name === undefined || name === null) return '';
      return String(name).trim().toLowerCase();
    }

    function hasDuplicateModelName(model) {
      if (!model) return false;
      var targetId = getStableModelId(model);
      var targetName = normalizeModelName(model.name);
      if (!targetName) return false;
      if (!Array.isArray(state.models)) return false;
      return state.models.some(function(m) {
        if (!m) return false;
        var id = getStableModelId(m);
        if (id && targetId && id === targetId) return false;
        return normalizeModelName(m.name) === targetName;
      });
    }

    function findModelByAnyId(value) {
      var target = value === undefined || value === null ? '' : String(value);
      if (!target) return null;
      if (!Array.isArray(state.models)) return null;
      return state.models.find(function(m) {
        if (!m) return false;
        var idVal = m.id === undefined || m.id === null ? '' : String(m.id);
        var remoteVal = m.remoteId === undefined || m.remoteId === null ? '' : String(m.remoteId);
        return idVal === target || remoteVal === target;
      }) || null;
    }

    function loadModels() {
      try {
        state.models = JSON.parse(localStorage.getItem(modelsKey) || '[]');
      } catch (e) {
        state.models = [];
      }
      if (!Array.isArray(state.models)) state.models = [];
      state.models = state.models.map(function(model) {
        var next = model && typeof model === 'object' ? model : {};
        if (next.id !== undefined && next.id !== null) {
          next.id = String(next.id);
        }
        return next;
      });
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

    function persistModelsLocal() {
      try {
        localStorage.setItem(modelsKey, JSON.stringify(state.models));
      } catch (err) {
        console.warn('模型配置写入本地失败', err);
      }
      renderModels();
      renderAssignmentsSelect();
    }

    function saveModels() {
      persistModelsLocal();
      (state.models || []).forEach(function(m) {
        if (m) persistModelToServer(m);
      });
    }

    function setTabNotice(tabName, text) {
      const btn = document.querySelector('[data-tab-btn="' + tabName + '"]');
      if (!btn) return;
      let badge = btn.querySelector('.tab-notice');
      if (!text) {
        if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'tab-notice';
        btn.appendChild(badge);
      }
      badge.textContent = text;
    }

    function setGroupNotice(groupName, text) {
      const btn = document.querySelector('.tab-group-btn[data-group="' + groupName + '"]');
      if (!btn) return;
      let badge = btn.querySelector('.tab-notice');
      if (!text) {
        if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'tab-notice';
        btn.appendChild(badge);
      }
      badge.textContent = text;
    }

    function normalizeTemperature(value) {
      if (value === undefined || value === null || value === '') return defaultTemperature;
      var num = Number(value);
      if (!Number.isFinite(num)) return defaultTemperature;
      if (num < 0) return 0;
      if (num > 1) return 1;
      return Number(num.toFixed(2));
    }

    function modelToConfigJson(model) {
      return {
        provider: model.provider,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        model: model.model,
        maxTokens: model.maxTokens,
      };
    }

    function mapRemoteModels(list) {
      if (!Array.isArray(list)) return [];
      return list.map(function(item) {
        var cfg = item && item.config_json ? item.config_json : {};
        var remoteId = item && item.id !== undefined && item.id !== null ? item.id : null;
        var resolvedId = remoteId !== null && remoteId !== undefined
          ? String(remoteId)
          : (cfg.id || ('model-' + Date.now()));
        return {
          id: resolvedId,
          remoteId: remoteId,
          name: item && item.name ? item.name : (cfg.name || '未命名模型'),
          provider: cfg.provider || 'custom',
          baseUrl: cfg.baseUrl || cfg.base_url || '',
          apiKey: cfg.apiKey || cfg.api_key || '',
          model: cfg.model || cfg.modelIdentifier || cfg.model_id || '',
          maxTokens: cfg.maxTokens || cfg.max_tokens || defaultMaxTokens,
        };
      });
    }

    function pullModelsFromServer() {
      if (!api || typeof api.listModelConfigs !== 'function') return;
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      var ownerId = state.currentUser && state.currentUser.id;
      var ready = state.authReady || (window.app && window.app.authReady);
      if (!ownerId && !ready) {
        setTimeout(pullModelsFromServer, 200);
        return;
      }
      api.listModelConfigs('all', ownerId).then(function(data) {
        var remoteModels = mapRemoteModels(data || []);
        if (!remoteModels.length) {
          if (state.userJustSwitched) {
            state.models = [];
            persistModelsLocal();
            renderModels();
            renderAssignmentsSelect();
            updateAssignmentStatuses();
            state.userModelsReset = true;
          }
          return;
        }
        state.models = remoteModels;
        persistModelsLocal();
        syncAssignmentsWithModels({ pushRemote: true });
        renderModels();
        renderAssignmentsSelect();
        updateAssignmentStatuses();
      }).catch(function(err) {
        console.warn('加载远端模型失败', err);
      });
    }

    function applyRemoteModelId(model, remoteId) {
      if (!model || remoteId === undefined || remoteId === null) return;
      var stableId = String(remoteId);
      var oldId = model.id;
      model.remoteId = remoteId;
      model.id = stableId;
      if (oldId && oldId !== stableId) {
        updateAssignmentsModelId(oldId, stableId, { pushRemote: true });
      }
      persistModelsLocal();
    }

    function persistModelToServer(model) {
      if (!api || typeof api.createModelConfig !== 'function') return Promise.resolve();
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      var payload = {
        name: model.name || '未命名模型',
        config_json: modelToConfigJson(model),
      };
      if (model.remoteId) {
        return api.updateModelConfig(model.remoteId, payload).then(function(res) {
          var resId = res && res.id ? res.id : model.remoteId;
          applyRemoteModelId(model, resId);
          return res;
        }).catch(function(err) {
          console.warn('更新模型配置失败', err);
        });
      }
      return api.createModelConfig(payload).then(function(res) {
        if (res && res.id) applyRemoteModelId(model, res.id);
        return res;
      }).catch(function(err) {
        console.warn('创建模型配置失败', err);
      });
    }

    // Normalize assignment configs from localStorage/server and keep backward compatibility.
    // Remote values take precedence; missing fields fall back to base/local values and defaults.
    function normalizeAssignmentsObject(cfg, options) {
      var base = options && options.base && typeof options.base === 'object' ? options.base : {};
      var incoming = cfg && typeof cfg === 'object' ? cfg : {};
      var merged = Object.assign({}, base, incoming);
      var migrated = false;

      merged.cleanId = merged.cleanId || '';
      merged.reviewId = merged.reviewId || '';
      merged.compareId = merged.compareId || '';
      merged.splitId = merged.splitId || '';
      merged.casesId = merged.casesId || '';
      merged.caseGenId = merged.caseGenId || '';
      merged.caseFilterId = merged.caseFilterId || '';
      merged.missingReminderId = merged.missingReminderId || '';
      merged.caseLibraryGenId = merged.caseLibraryGenId || '';
      merged.caseGenAgentId = merged.caseGenAgentId || '';

      merged.cleanPrompt = merged.cleanPrompt || defaultPrompts.system;
      if (merged.cleanPrompt === legacyCleanPrompt) {
        merged.cleanPrompt = defaultPrompts.system;
        migrated = true;
      }
      merged.reviewPrompt = merged.reviewPrompt || defaultPrompts.review;
      merged.comparePrompt = merged.comparePrompt || defaultPrompts.compare;
      merged.splitPrompt = merged.splitPrompt || defaultPrompts.split;
      merged.caseGenPrompt = merged.caseGenPrompt || defaultPrompts.casegen;
      if (merged.caseGenPrompt === legacyCaseGenPrompt) {
        merged.caseGenPrompt = defaultPrompts.casegen;
        migrated = true;
      }
      merged.caseFilterPrompt = merged.caseFilterPrompt || defaultPrompts.casefilter;
      merged.missingReminderPrompt = merged.missingReminderPrompt || defaultPrompts.missingreminder;
      merged.caseLibraryGenPrompt = merged.caseLibraryGenPrompt || defaultPrompts.caselibrarygen;
      merged.caseGenAgentPrompt = merged.caseGenAgentPrompt || defaultPrompts.casegenagent;

      merged.cleanReasoning = merged.cleanReasoning || '';
      merged.reviewReasoning = merged.reviewReasoning || '';
      merged.compareReasoning = merged.compareReasoning || '';
      merged.splitReasoning = merged.splitReasoning || '';
      merged.casesReasoning = merged.casesReasoning || '';
      merged.caseGenReasoning = merged.caseGenReasoning || '';
      merged.caseFilterReasoning = merged.caseFilterReasoning || '';
      merged.missingReminderReasoning = merged.missingReminderReasoning || '';
      merged.caseLibraryGenReasoning = merged.caseLibraryGenReasoning || '';
      merged.caseGenAgentReasoning = merged.caseGenAgentReasoning || '';

      merged.cleanTemperature = normalizeTemperature(merged.cleanTemperature);
      merged.reviewTemperature = normalizeTemperature(merged.reviewTemperature);
      merged.compareTemperature = normalizeTemperature(merged.compareTemperature);
      merged.splitTemperature = normalizeTemperature(merged.splitTemperature);
      merged.casesTemperature = normalizeTemperature(merged.casesTemperature);
      merged.caseGenTemperature = normalizeTemperature(merged.caseGenTemperature);
      merged.caseFilterTemperature = normalizeTemperature(merged.caseFilterTemperature);
      merged.missingReminderTemperature = normalizeTemperature(merged.missingReminderTemperature);
      merged.caseLibraryGenTemperature = normalizeTemperature(merged.caseLibraryGenTemperature);
      merged.caseGenAgentTemperature = normalizeTemperature(merged.caseGenAgentTemperature);

      if (!merged.casesPrompt) {
        merged.casesPrompt = defaultPrompts.cases;
      } else if (merged.casesPrompt === legacyCasesPrompt) {
        merged.casesPrompt = defaultPrompts.cases;
        migrated = true;
      }
      if (merged.caseFilterPrompt === legacyCaseGenPrompt) {
        merged.caseFilterPrompt = defaultPrompts.casefilter;
        migrated = true;
      }

      return { assignments: merged, migrated: migrated };
    }

    function pullAssignmentsFromServer() {
      if (!api || typeof api.listFeatureAssignments !== 'function') return;
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      var ownerId = state.currentUser && state.currentUser.id;
      var ready = state.authReady || (window.app && window.app.authReady);
      if (!ownerId && !ready) {
        setTimeout(pullAssignmentsFromServer, 200);
        return;
      }
      api.listFeatureAssignments('all', ownerId).then(function(list) {
        var assignments = list || [];
        if (!assignments.length) {
          if (state.userJustSwitched) {
            var emptyNormalized = normalizeAssignmentsObject({}, { base: {} });
            state.assignments = emptyNormalized.assignments;
            state.assignmentRemoteId = null;
            state.hasSavedAssignments = false;
            persistAssignmentsLocal();
            renderAssignmentsSelect();
            updateAssignmentStatuses();
            state.userJustSwitched = false;
            state.userModelsReset = false;
          }
          return;
        }
        // owner_id 可能是 number 或 string；并且 authReady 时 currentUser 可能暂未填充。
        var userId = null;
        if (state && state.currentUser && (state.currentUser.id || state.currentUser.id === 0)) {
          var parsedUserId = Number(state.currentUser.id);
          if (Number.isFinite(parsedUserId)) userId = parsedUserId;
        }
        var chosenUser = null;
        var chosenGlobal = null;
        assignments.forEach(function(item) {
          if (!item) return;
          var ownerId = item.owner_id;
          if (ownerId === null || ownerId === undefined) {
            if (!chosenGlobal) chosenGlobal = item;
            return;
          }
          var ownerNum = Number(ownerId);
          if (userId === null || ownerNum === userId) {
            chosenUser = item;
          }
        });
        var chosen = chosenUser || chosenGlobal;
        if (chosen && chosen.config_json) {
          var baseAssignments = state.assignments && typeof state.assignments === 'object' ? state.assignments : {};
          var normalized = normalizeAssignmentsObject(chosen.config_json, { base: baseAssignments });
          state.assignments = normalized.assignments;
          state.assignmentRemoteId = chosen.id;
          state.hasSavedAssignments = true;
          persistAssignmentsLocal();
          syncAssignmentsWithModels({ pushRemote: true });
          renderAssignmentsSelect();
          updateAssignmentStatuses();
        }
        if (state.userJustSwitched) {
          state.userJustSwitched = false;
          state.userModelsReset = false;
        }
      }).catch(function(err) {
        console.warn('加载功能指派失败', err);
      });
    }

    function pushAssignmentsToServer() {
      if (!api || typeof api.createFeatureAssignment !== 'function') return;
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      var payload = {
        name: assignmentName,
        config_json: state.assignments,
        scope: 'user',
      };
      if (state.assignmentRemoteId) {
        api.updateFeatureAssignment(state.assignmentRemoteId, payload).then(function() {
          state.hasSavedAssignments = true;
        }).catch(function(err) {
          console.warn('更新功能指派失败', err);
        });
        return;
      }
      api.createFeatureAssignment(payload).then(function(res) {
        if (res && res.id) state.assignmentRemoteId = res.id;
        state.hasSavedAssignments = true;
      }).catch(function(err) {
        console.warn('创建功能指派失败', err);
      });
    }

    function bindAuthReady() {
      try {
        window.addEventListener('app-auth-ready', function() {
          pullModelsFromServer();
          pullAssignmentsFromServer();
        });
      } catch (err) {
        // ignore
      }
    }

    function renderModels() {
      if (!modelListEl) return;
      if (!state.models.length) {
        modelListEl.innerHTML = '<p class="hint">尚未配置模型，请先创建。</p>';
        updateDeepseekTokenHint();
        updateTabNotices();
        return;
      }
      modelListEl.innerHTML = state.models.map(m => {
        const stableId = getStableModelId(m);
        return `
        <div class="model-card" data-id="${stableId}">
          <strong>${m.name || '未命名模型'}</strong>
          <div class="meta">
            <span>类型：${m.provider}</span>
            <span>模型 ID：${m.model}</span>
            <span>Max Tokens：${m.maxTokens || defaultMaxTokens}</span>
          </div>
          <div class="actions">
            <button class="secondary" data-edit="${stableId}">编辑</button>
            <button class="secondary" data-delete="${stableId}">删除</button>
          </div>
        </div>
      `;
      }).join('');

      modelListEl.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => fillModelForm(btn.dataset.edit));
      });
      modelListEl.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => {
          var model = findModelByAnyId(btn.dataset.delete);
          var name = model && model.name ? model.name : '该模型';
          var first = window.confirm('确认删除模型“' + name + '”？');
          if (!first) return;
          var second = window.confirm('删除后需要重新指派模型，确定继续删除吗？');
          if (!second) return;
          deleteModel(btn.dataset.delete);
        });
      });
      updateDeepseekTokenHint();
      updateTabNotices();
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
      const model = findModelByAnyId(id);
      if (!model) return;
      state.editingId = getStableModelId(model) || id;
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

    async function deleteModel(id) {
      var targetId = id === undefined || id === null ? '' : String(id);
      var removed = findModelByAnyId(targetId);
      if (!removed) return;
      var remoteId = removed.remoteId !== undefined && removed.remoteId !== null ? removed.remoteId : null;
      if (remoteId && api && typeof api.updateModelConfig === 'function') {
        try {
          if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
            var stored = api.getStoredToken();
            if (stored) api.setToken(stored);
          }
          await api.updateModelConfig(remoteId, { is_active: false });
        } catch (err) {
          setStatus(modelFormStatus, err && err.message ? err.message : '删除模型失败，请重试', 'warn');
          return;
        }
      }
      state.models = state.models.filter(function(m) { return getStableModelId(m) !== targetId; });
      persistModelsLocal();
      var keys = requiredAssignmentKeys.concat(['caseFilterId', 'missingReminderId', 'caseLibraryGenId', 'caseGenAgentId']);
      keys.forEach(function(key) {
        if (state.assignments[key] === targetId) state.assignments[key] = '';
      });
      persistAssignmentsLocal();
      if (state.assignmentRemoteId || state.hasSavedAssignments) {
        pushAssignmentsToServer();
      }
      renderAssignmentsSelect();
      updateAssignmentStatuses();
      setStatus(modelFormStatus, '模型已删除', 'ok');
    }

    function applyProviderPreset(providerEl, baseUrlEl, modelEl) {
      const preset = providerDefaults[providerEl && providerEl.value];
      if (!preset) return;
      if (baseUrlEl && !baseUrlEl.value.trim()) baseUrlEl.value = preset.baseUrl;
      if (modelEl && !modelEl.value.trim()) modelEl.value = preset.model;
    }

    function saveModel() {
      const maxTokensVal = parseInt(modelMaxTokensEl ? modelMaxTokensEl.value : defaultMaxTokens, 10);
      const editingModel = state.editingId ? findModelByAnyId(state.editingId) : null;
      const baseId = editingModel ? getStableModelId(editingModel) : (state.editingId || `model-${Date.now()}`);
      let inheritedRemoteId = null;
      if (editingModel) {
        if (editingModel.remoteId !== undefined && editingModel.remoteId !== null) {
          inheritedRemoteId = editingModel.remoteId;
        } else if (baseId && !Number.isNaN(Number(baseId))) {
          inheritedRemoteId = baseId;
        }
      }
      const model = {
        id: baseId,
        remoteId: inheritedRemoteId,
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
      if (hasDuplicateModelName(model)) {
        setStatus(modelFormStatus, '模型名称已存在，请换一个名称', 'warn');
        return;
      }
      const exists = state.models.findIndex(m => getStableModelId(m) === model.id);
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

    const requiredAssignmentKeys = ['cleanId', 'reviewId', 'compareId', 'splitId', 'casesId', 'caseGenId'];
    const assignmentIdKeys = requiredAssignmentKeys.concat(['caseFilterId', 'missingReminderId', 'caseLibraryGenId', 'caseGenAgentId']);

    function persistAssignmentsLocal() {
      try {
        localStorage.setItem(assignmentKey, JSON.stringify(state.assignments));
      } catch (err) {
        console.warn('功能指派写入本地失败', err);
      }
    }

    function updateAssignmentsModelId(oldId, newId, options) {
      var from = oldId === undefined || oldId === null ? '' : String(oldId);
      var to = newId === undefined || newId === null ? '' : String(newId);
      if (!from || !to) return;
      var changed = false;
      var keys = assignmentIdKeys;
      keys.forEach(function(key) {
        if (state.assignments && state.assignments[key] === from) {
          state.assignments[key] = to;
          changed = true;
        }
      });
      if (changed) {
        state.hasSavedAssignments = state.hasSavedAssignments || Boolean(state.assignmentRemoteId);
        persistAssignmentsLocal();
        if (state.assignmentRemoteId || state.hasSavedAssignments) {
          if (!options || options.pushRemote !== false) pushAssignmentsToServer();
        }
        updateAssignmentStatuses();
      }
    }

    function syncAssignmentsWithModels(options) {
      var changed = false;
      var keys = assignmentIdKeys;
      keys.forEach(function(key) {
        var val = state.assignments && state.assignments[key] ? String(state.assignments[key]) : '';
        if (!val) return;
        var model = findModelByAnyId(val);
        if (!model) return;
        var stable = getStableModelId(model);
        if (stable && stable !== val) {
          state.assignments[key] = stable;
          changed = true;
        }
      });
      if (changed) {
        state.hasSavedAssignments = state.hasSavedAssignments || Boolean(state.assignmentRemoteId);
        persistAssignmentsLocal();
        if (state.assignmentRemoteId || state.hasSavedAssignments) {
          if (!options || options.pushRemote !== false) pushAssignmentsToServer();
        }
        updateAssignmentStatuses();
      }
      return changed;
    }

    function loadAssignments() {
      var savedAssignmentsRaw = '';
      var parsed = {};
      try {
        savedAssignmentsRaw = localStorage.getItem(assignmentKey) || '';
        parsed = JSON.parse(savedAssignmentsRaw || '{}') || {};
      } catch (e) {
        parsed = {};
      }
      const savedHasIds = assignmentIdKeys.some(function(key) {
        return parsed && parsed[key];
      });
      state.hasSavedAssignments = Boolean(savedAssignmentsRaw && savedHasIds);

      var normalized = normalizeAssignmentsObject(parsed);
      state.assignments = normalized.assignments;
      if (normalized.migrated) {
        persistAssignmentsLocal();
      }
      syncAssignmentsWithModels({ pushRemote: false });
    }

    function saveAssignments() {
      var toStableId = function(raw) {
        if (!raw) return '';
        var model = findModelByAnyId(raw);
        return model ? getStableModelId(model) : (raw || '');
      };
      if (cleanModelSelect) state.assignments.cleanId = toStableId(cleanModelSelect.value);
      if (reviewModelSelect) state.assignments.reviewId = toStableId(reviewModelSelect.value);
      if (compareModelSelect) state.assignments.compareId = toStableId(compareModelSelect.value);
      if (splitModelSelect) state.assignments.splitId = toStableId(splitModelSelect.value);
      if (casesModelSelect) state.assignments.casesId = toStableId(casesModelSelect.value);
      if (caseGenModelSelect) state.assignments.caseGenId = toStableId(caseGenModelSelect.value);
      if (caseFilterModelSelect) state.assignments.caseFilterId = toStableId(caseFilterModelSelect.value);
      if (missingReminderModelSelect) state.assignments.missingReminderId = toStableId(missingReminderModelSelect.value);
      if (caseLibraryGenModelSelect) state.assignments.caseLibraryGenId = toStableId(caseLibraryGenModelSelect.value);
      if (caseGenAgentModelSelect) state.assignments.caseGenAgentId = toStableId(caseGenAgentModelSelect.value);
      if (cleanPromptEl) state.assignments.cleanPrompt = cleanPromptEl.value.trim() || defaultPrompts.system;
      if (reviewPromptEl) state.assignments.reviewPrompt = reviewPromptEl.value.trim() || defaultPrompts.review;
      if (comparePromptEl) state.assignments.comparePrompt = comparePromptEl.value.trim() || defaultPrompts.compare;
      if (splitPromptEl) state.assignments.splitPrompt = splitPromptEl.value.trim() || defaultPrompts.split;
      if (casesPromptEl) state.assignments.casesPrompt = casesPromptEl.value.trim() || defaultPrompts.cases;
      if (caseGenPromptEl) state.assignments.caseGenPrompt = caseGenPromptEl.value.trim() || defaultPrompts.casegen;
      if (caseFilterPromptEl) state.assignments.caseFilterPrompt = caseFilterPromptEl.value.trim() || defaultPrompts.casefilter;
      if (missingReminderPromptEl) state.assignments.missingReminderPrompt = missingReminderPromptEl.value.trim() || defaultPrompts.missingreminder;
      if (caseLibraryGenPromptEl) state.assignments.caseLibraryGenPrompt = caseLibraryGenPromptEl.value.trim() || defaultPrompts.caselibrarygen;
      if (caseGenAgentPromptEl) state.assignments.caseGenAgentPrompt = caseGenAgentPromptEl.value.trim() || defaultPrompts.casegenagent;
      if (cleanReasoningSelect) state.assignments.cleanReasoning = cleanReasoningSelect.value || '';
      if (reviewReasoningSelect) state.assignments.reviewReasoning = reviewReasoningSelect.value || '';
      if (compareReasoningSelect) state.assignments.compareReasoning = compareReasoningSelect.value || '';
      if (splitReasoningSelect) state.assignments.splitReasoning = splitReasoningSelect.value || '';
      if (casesReasoningSelect) state.assignments.casesReasoning = casesReasoningSelect.value || '';
      if (caseGenReasoningSelect) state.assignments.caseGenReasoning = caseGenReasoningSelect.value || '';
      if (caseFilterReasoningSelect) state.assignments.caseFilterReasoning = caseFilterReasoningSelect.value || '';
      if (missingReminderReasoningSelect) state.assignments.missingReminderReasoning = missingReminderReasoningSelect.value || '';
      if (caseLibraryGenReasoningSelect) state.assignments.caseLibraryGenReasoning = caseLibraryGenReasoningSelect.value || '';
      if (caseGenAgentReasoningSelect) state.assignments.caseGenAgentReasoning = caseGenAgentReasoningSelect.value || '';
      if (cleanTemperatureEl) state.assignments.cleanTemperature = normalizeTemperature(cleanTemperatureEl.value);
      if (reviewTemperatureEl) state.assignments.reviewTemperature = normalizeTemperature(reviewTemperatureEl.value);
      if (compareTemperatureEl) state.assignments.compareTemperature = normalizeTemperature(compareTemperatureEl.value);
      if (splitTemperatureEl) state.assignments.splitTemperature = normalizeTemperature(splitTemperatureEl.value);
      if (casesTemperatureEl) state.assignments.casesTemperature = normalizeTemperature(casesTemperatureEl.value);
      if (caseGenTemperatureEl) state.assignments.caseGenTemperature = normalizeTemperature(caseGenTemperatureEl.value);
      if (caseFilterTemperatureEl) state.assignments.caseFilterTemperature = normalizeTemperature(caseFilterTemperatureEl.value);
      if (missingReminderTemperatureEl) state.assignments.missingReminderTemperature = normalizeTemperature(missingReminderTemperatureEl.value);
      if (caseLibraryGenTemperatureEl) state.assignments.caseLibraryGenTemperature = normalizeTemperature(caseLibraryGenTemperatureEl.value);
      if (caseGenAgentTemperatureEl) state.assignments.caseGenAgentTemperature = normalizeTemperature(caseGenAgentTemperatureEl.value);
      syncAssignmentsWithModels({ pushRemote: false });
      persistAssignmentsLocal();
      state.hasSavedAssignments = true;
      pushAssignmentsToServer();
      updateAssignmentStatuses();
      setStatus(cleanAssignStatus, '指派已保存', 'ok');
      setStatus(reviewAssignStatus, '指派已保存', 'ok');
      setStatus(compareAssignStatus, '指派已保存', 'ok');
      setStatus(splitAssignStatus, '指派已保存', 'ok');
      setStatus(casesAssignStatus, '指派已保存', 'ok');
      setStatus(caseGenAssignStatus, '指派已保存', 'ok');
      setStatus(caseFilterAssignStatus, '指派已保存', 'ok');
      setStatus(missingReminderAssignStatus, '指派已保存', 'ok');
      setStatus(caseLibraryGenAssignStatus, '指派已保存', 'ok');
      setStatus(caseGenAgentAssignStatus, '指派已保存', 'ok');
      if (assignSaveBar) assignSaveBar.classList.add('hidden');
    }

    function renderAssignmentsSelect() {
      if (!cleanModelSelect || !caseFilterPromptEl) return;
      syncAssignmentsWithModels({ pushRemote: false });
      const placeholder = '<option value="">暂无可用模型</option>';
      const createOptions = (selectedId) => state.models.map(m => {
        const value = getStableModelId(m);
        const sel = value === selectedId ? 'selected' : '';
        return `<option value="${value}" ${sel}>${m.name} (${m.provider})</option>`;
      }).join('');

      if (!state.models.length) {
        cleanModelSelect.innerHTML = placeholder;
        if (reviewModelSelect) reviewModelSelect.innerHTML = placeholder;
        if (compareModelSelect) compareModelSelect.innerHTML = placeholder;
        if (splitModelSelect) splitModelSelect.innerHTML = placeholder;
        if (casesModelSelect) casesModelSelect.innerHTML = placeholder;
        if (caseGenModelSelect) caseGenModelSelect.innerHTML = placeholder;
        if (caseFilterModelSelect) caseFilterModelSelect.innerHTML = placeholder;
        if (missingReminderModelSelect) missingReminderModelSelect.innerHTML = placeholder;
        if (caseLibraryGenModelSelect) caseLibraryGenModelSelect.innerHTML = placeholder;
        if (caseGenAgentModelSelect) caseGenAgentModelSelect.innerHTML = placeholder;
        state.assignments.cleanId = '';
        state.assignments.reviewId = '';
        state.assignments.compareId = '';
        state.assignments.splitId = '';
        state.assignments.casesId = '';
        state.assignments.caseGenId = '';
        state.assignments.caseFilterId = '';
        state.assignments.missingReminderId = '';
        state.assignments.caseLibraryGenId = '';
        state.assignments.caseGenAgentId = '';
        if (cleanPromptEl) cleanPromptEl.value = state.assignments.cleanPrompt || defaultPrompts.system;
        if (reviewPromptEl) reviewPromptEl.value = state.assignments.reviewPrompt || defaultPrompts.review;
        if (comparePromptEl) comparePromptEl.value = state.assignments.comparePrompt || defaultPrompts.compare;
        if (splitPromptEl) splitPromptEl.value = state.assignments.splitPrompt || defaultPrompts.split;
        if (casesPromptEl) casesPromptEl.value = state.assignments.casesPrompt || defaultPrompts.cases;
        if (caseGenPromptEl) caseGenPromptEl.value = state.assignments.caseGenPrompt || defaultPrompts.casegen;
        if (caseFilterPromptEl) caseFilterPromptEl.value = state.assignments.caseFilterPrompt || defaultPrompts.casefilter;
        if (missingReminderPromptEl) missingReminderPromptEl.value = state.assignments.missingReminderPrompt || defaultPrompts.missingreminder;
        if (caseLibraryGenPromptEl) caseLibraryGenPromptEl.value = state.assignments.caseLibraryGenPrompt || defaultPrompts.caselibrarygen;
        if (caseGenAgentPromptEl) caseGenAgentPromptEl.value = state.assignments.caseGenAgentPrompt || defaultPrompts.casegenagent;
        if (cleanTemperatureEl) cleanTemperatureEl.value = state.assignments.cleanTemperature;
        if (reviewTemperatureEl) reviewTemperatureEl.value = state.assignments.reviewTemperature;
        if (compareTemperatureEl) compareTemperatureEl.value = state.assignments.compareTemperature;
        if (splitTemperatureEl) splitTemperatureEl.value = state.assignments.splitTemperature;
        if (casesTemperatureEl) casesTemperatureEl.value = state.assignments.casesTemperature;
        if (caseGenTemperatureEl) caseGenTemperatureEl.value = state.assignments.caseGenTemperature;
        if (caseFilterTemperatureEl) caseFilterTemperatureEl.value = state.assignments.caseFilterTemperature;
        if (missingReminderTemperatureEl) missingReminderTemperatureEl.value = state.assignments.missingReminderTemperature;
        if (caseLibraryGenTemperatureEl) caseLibraryGenTemperatureEl.value = state.assignments.caseLibraryGenTemperature;
        if (caseGenAgentTemperatureEl) caseGenAgentTemperatureEl.value = state.assignments.caseGenAgentTemperature;
        updateAssignmentStatuses();
        ['clean', 'review', 'compare', 'split', 'cases', 'casegen', 'casefilter', 'missingreminder', 'caselibrarygen', 'casegenagent'].forEach(updateReasoningVisibility);
        return;
      }

      const firstModelId = state.models[0] && getStableModelId(state.models[0]) ? getStableModelId(state.models[0]) : '';
      const secondModelId = state.models[1] && getStableModelId(state.models[1]) ? getStableModelId(state.models[1]) : '';
      const thirdModelId = state.models[2] && getStableModelId(state.models[2]) ? getStableModelId(state.models[2]) : '';
      const fourthModelId = state.models[3] && getStableModelId(state.models[3]) ? getStableModelId(state.models[3]) : '';
      const fifthModelId = state.models[4] && getStableModelId(state.models[4]) ? getStableModelId(state.models[4]) : '';
      const sixthModelId = state.models[5] && getStableModelId(state.models[5]) ? getStableModelId(state.models[5]) : '';
      const seventhModelId = state.models[6] && getStableModelId(state.models[6]) ? getStableModelId(state.models[6]) : '';
      const eighthModelId = state.models[7] && getStableModelId(state.models[7]) ? getStableModelId(state.models[7]) : '';
      const ninthModelId = state.models[8] && getStableModelId(state.models[8]) ? getStableModelId(state.models[8]) : '';
      const tenthModelId = state.models[9] && getStableModelId(state.models[9]) ? getStableModelId(state.models[9]) : '';
      const cleanSel = state.assignments.cleanId || firstModelId;
      const reviewSel = state.assignments.reviewId || (secondModelId || state.assignments.cleanId || firstModelId);
      const compareSel = state.assignments.compareId || (thirdModelId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const splitSel = state.assignments.splitId || (fourthModelId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const casesSel = state.assignments.casesId || (fifthModelId || state.assignments.splitId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const caseGenSel = state.assignments.caseGenId || (sixthModelId || state.assignments.casesId || state.assignments.splitId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const caseFilterSel = state.assignments.caseFilterId || (seventhModelId || state.assignments.caseGenId || state.assignments.casesId || state.assignments.splitId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const missingReminderSel = state.assignments.missingReminderId
        || (eighthModelId || state.assignments.caseFilterId || state.assignments.caseGenId || state.assignments.casesId || state.assignments.splitId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const caseLibraryGenSel = state.assignments.caseLibraryGenId
        || (ninthModelId || state.assignments.missingReminderId || state.assignments.caseFilterId || state.assignments.caseGenId || state.assignments.casesId || state.assignments.splitId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);
      const caseGenAgentSel = state.assignments.caseGenAgentId
        || (tenthModelId || state.assignments.caseLibraryGenId || state.assignments.missingReminderId || state.assignments.caseFilterId || state.assignments.caseGenId || state.assignments.casesId || state.assignments.splitId || state.assignments.compareId || state.assignments.reviewId || state.assignments.cleanId || firstModelId);

      cleanModelSelect.innerHTML = createOptions(cleanSel);
      if (reviewModelSelect) reviewModelSelect.innerHTML = createOptions(reviewSel);
      if (compareModelSelect) compareModelSelect.innerHTML = createOptions(compareSel);
      if (splitModelSelect) splitModelSelect.innerHTML = createOptions(splitSel);
      if (casesModelSelect) casesModelSelect.innerHTML = createOptions(casesSel);
      if (caseGenModelSelect) caseGenModelSelect.innerHTML = createOptions(caseGenSel);
      if (caseFilterModelSelect) caseFilterModelSelect.innerHTML = createOptions(caseFilterSel);
      if (missingReminderModelSelect) missingReminderModelSelect.innerHTML = createOptions(missingReminderSel);
      if (caseLibraryGenModelSelect) caseLibraryGenModelSelect.innerHTML = createOptions(caseLibraryGenSel);
      if (caseGenAgentModelSelect) caseGenAgentModelSelect.innerHTML = createOptions(caseGenAgentSel);

      state.assignments.cleanId = cleanModelSelect.value || '';
      state.assignments.reviewId = reviewModelSelect ? reviewModelSelect.value || '' : '';
      state.assignments.compareId = compareModelSelect ? compareModelSelect.value || '' : '';
      state.assignments.splitId = splitModelSelect ? splitModelSelect.value || '' : '';
      state.assignments.casesId = casesModelSelect ? casesModelSelect.value || '' : '';
      state.assignments.caseGenId = caseGenModelSelect ? caseGenModelSelect.value || '' : '';
      state.assignments.caseFilterId = caseFilterModelSelect ? caseFilterModelSelect.value || '' : '';
      state.assignments.missingReminderId = missingReminderModelSelect ? missingReminderModelSelect.value || '' : '';
      state.assignments.caseLibraryGenId = caseLibraryGenModelSelect ? caseLibraryGenModelSelect.value || '' : '';
      state.assignments.caseGenAgentId = caseGenAgentModelSelect ? caseGenAgentModelSelect.value || '' : '';
      if (cleanPromptEl) cleanPromptEl.value = state.assignments.cleanPrompt || defaultPrompts.system;
      if (reviewPromptEl) reviewPromptEl.value = state.assignments.reviewPrompt || defaultPrompts.review;
      if (comparePromptEl) comparePromptEl.value = state.assignments.comparePrompt || defaultPrompts.compare;
      if (splitPromptEl) splitPromptEl.value = state.assignments.splitPrompt || defaultPrompts.split;
      if (casesPromptEl) casesPromptEl.value = state.assignments.casesPrompt || defaultPrompts.cases;
      if (caseGenPromptEl) caseGenPromptEl.value = state.assignments.caseGenPrompt || defaultPrompts.casegen;
      if (caseFilterPromptEl) caseFilterPromptEl.value = state.assignments.caseFilterPrompt || defaultPrompts.casefilter;
      if (missingReminderPromptEl) missingReminderPromptEl.value = state.assignments.missingReminderPrompt || defaultPrompts.missingreminder;
      if (caseLibraryGenPromptEl) caseLibraryGenPromptEl.value = state.assignments.caseLibraryGenPrompt || defaultPrompts.caselibrarygen;
      if (caseGenAgentPromptEl) caseGenAgentPromptEl.value = state.assignments.caseGenAgentPrompt || defaultPrompts.casegenagent;
      if (cleanTemperatureEl) cleanTemperatureEl.value = state.assignments.cleanTemperature;
      if (reviewTemperatureEl) reviewTemperatureEl.value = state.assignments.reviewTemperature;
      if (compareTemperatureEl) compareTemperatureEl.value = state.assignments.compareTemperature;
      if (splitTemperatureEl) splitTemperatureEl.value = state.assignments.splitTemperature;
      if (casesTemperatureEl) casesTemperatureEl.value = state.assignments.casesTemperature;
      if (caseGenTemperatureEl) caseGenTemperatureEl.value = state.assignments.caseGenTemperature;
      if (caseFilterTemperatureEl) caseFilterTemperatureEl.value = state.assignments.caseFilterTemperature;
      if (missingReminderTemperatureEl) missingReminderTemperatureEl.value = state.assignments.missingReminderTemperature;
      if (caseLibraryGenTemperatureEl) caseLibraryGenTemperatureEl.value = state.assignments.caseLibraryGenTemperature;
      if (caseGenAgentTemperatureEl) caseGenAgentTemperatureEl.value = state.assignments.caseGenAgentTemperature;

      updateAssignmentStatuses();
      ['clean', 'review', 'compare', 'split', 'cases', 'casegen', 'casefilter', 'missingreminder', 'caselibrarygen', 'casegenagent'].forEach(updateReasoningVisibility);
      if (cleanReasoningSelect) cleanReasoningSelect.value = state.assignments.cleanReasoning || '';
      if (reviewReasoningSelect) reviewReasoningSelect.value = state.assignments.reviewReasoning || '';
      if (compareReasoningSelect) compareReasoningSelect.value = state.assignments.compareReasoning || '';
      if (splitReasoningSelect) splitReasoningSelect.value = state.assignments.splitReasoning || '';
      if (casesReasoningSelect) casesReasoningSelect.value = state.assignments.casesReasoning || '';
      if (caseGenReasoningSelect) caseGenReasoningSelect.value = state.assignments.caseGenReasoning || '';
      if (caseFilterReasoningSelect) caseFilterReasoningSelect.value = state.assignments.caseFilterReasoning || '';
      if (missingReminderReasoningSelect) missingReminderReasoningSelect.value = state.assignments.missingReminderReasoning || '';
      if (caseLibraryGenReasoningSelect) caseLibraryGenReasoningSelect.value = state.assignments.caseLibraryGenReasoning || '';
      if (caseGenAgentReasoningSelect) caseGenAgentReasoningSelect.value = state.assignments.caseGenAgentReasoning || '';
    }

    function updateAssignmentStatuses() {
      const cleanModel = getModelById(state.assignments.cleanId);
      const reviewModel = getModelById(state.assignments.reviewId);
      const compareModel = getModelById(state.assignments.compareId);
      const splitModel = getModelById(state.assignments.splitId);
      const casesModel = getModelById(state.assignments.casesId);
      const caseGenModel = getModelById(state.assignments.caseGenId);
      const caseFilterModel = getModelById(state.assignments.caseFilterId);
      const missingReminderModel = getModelById(state.assignments.missingReminderId);
      const caseLibraryGenModel = getModelById(state.assignments.caseLibraryGenId);
      const caseGenAgentModel = getModelById(state.assignments.caseGenAgentId);
      setStatus(cleanAssignStatus, cleanModel ? `当前清洗模型：${cleanModel.name}` : '尚未指派清洗模型', cleanModel ? 'ok' : 'warn');
      setStatus(reviewAssignStatus, reviewModel ? `当前评审模型：${reviewModel.name}` : '尚未指派评审模型', reviewModel ? 'ok' : 'warn');
      setStatus(compareAssignStatus, compareModel ? `当前对比模型：${compareModel.name}` : '尚未指派对比模型', compareModel ? 'ok' : 'warn');
      setStatus(splitAssignStatus, splitModel ? `当前拆分模型：${splitModel.name}` : '尚未指派拆分模型', splitModel ? 'ok' : 'warn');
      setStatus(casesAssignStatus, casesModel ? `当前覆盖对比模型：${casesModel.name}` : '尚未指派覆盖对比模型', casesModel ? 'ok' : 'warn');
      setStatus(caseGenAssignStatus, caseGenModel ? `当前用例生成功能模型：${caseGenModel.name}` : '尚未指派用例生产模型', caseGenModel ? 'ok' : 'warn');
      setStatus(caseFilterAssignStatus, caseFilterModel ? `当前用例相似对比模型：${caseFilterModel.name}` : '尚未指派用例相似对比模型', caseFilterModel ? 'ok' : 'warn');
      setStatus(missingReminderAssignStatus, missingReminderModel ? `当前易漏用例推荐模型：${missingReminderModel.name}` : '尚未指派易漏用例推荐模型', missingReminderModel ? 'ok' : 'warn');
      setStatus(caseLibraryGenAssignStatus, caseLibraryGenModel ? `当前用例库生成模型：${caseLibraryGenModel.name}` : '尚未指派用例库生成模型', caseLibraryGenModel ? 'ok' : 'warn');
      setStatus(caseGenAgentAssignStatus, caseGenAgentModel ? `当前用例生成 Agent 模型：${caseGenAgentModel.name}` : '尚未指派用例生成 Agent 模型', caseGenAgentModel ? 'ok' : 'warn');
      updateTabNotices();
    }

    function getModelById(id) {
      return findModelByAnyId(id);
    }

    const reasoningKeys = {
      clean: 'cleanReasoning',
      review: 'reviewReasoning',
      compare: 'compareReasoning',
      split: 'splitReasoning',
      cases: 'casesReasoning',
      casegen: 'caseGenReasoning',
      casefilter: 'caseFilterReasoning',
      missingreminder: 'missingReminderReasoning',
      caselibrarygen: 'caseLibraryGenReasoning',
      casegenagent: 'caseGenAgentReasoning',
    };
    const temperatureKeys = {
      clean: 'cleanTemperature',
      review: 'reviewTemperature',
      compare: 'compareTemperature',
      split: 'splitTemperature',
      cases: 'casesTemperature',
      casegen: 'caseGenTemperature',
      casefilter: 'caseFilterTemperature',
      missingreminder: 'missingReminderTemperature',
      caselibrarygen: 'caseLibraryGenTemperature',
      casegenagent: 'caseGenAgentTemperature',
    };

    function getAssignmentKeyPrefix(type) {
      if (type === 'casegen') return 'caseGen';
      if (type === 'casefilter') return 'caseFilter';
      if (type === 'missingreminder') return 'missingReminder';
      if (type === 'caselibrarygen') return 'caseLibraryGen';
      if (type === 'casegenagent') return 'caseGenAgent';
      return type;
    }

    function modelIsR1(model) {
      const source = model && model.model ? model.model : '';
      const id = source ? source.toLowerCase() : '';
      return id.includes('deepseek-r1') || id.includes('deepseek-reasoner');
    }

    function updateReasoningVisibility(type) {
      const row = document.querySelector(`[data-reasoning="${type}"]`);
      const prefix = getAssignmentKeyPrefix(type);
      const select = document.getElementById(`${type}Reasoning`) || document.getElementById(`${prefix}Reasoning`);
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

    function getTemperatureForType(type) {
      const key = temperatureKeys[type];
      if (!key) return defaultTemperature;
      return normalizeTemperature(state.assignments[key]);
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
        : type === 'missingreminder'
        ? state.assignments.missingReminderId
        : type === 'caselibrarygen'
        ? state.assignments.caseLibraryGenId
        : type === 'casegenagent'
        ? state.assignments.caseGenAgentId
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
        : type === 'missingreminder'
        ? '易漏用例推荐'
        : type === 'caselibrarygen'
        ? '用例库生成'
        : type === 'casegenagent'
        ? '用例生成 Agent'
        : '用例生成';
      const model = getModelById(id);
      if (!model) throw new Error(`未找到${label}模型，请先在功能指派中选择`);
      return model;
    }

    function findDeepseekReasoner() {
      return state.models.find(m => {
        const modelId = (m && m.model ? m.model : '').toLowerCase();
        return modelId.indexOf('deepseek-reasoner') !== -1;
      });
    }

    function updateDeepseekTokenHint() {
      const hint = document.getElementById('deepseekTokenHint');
      if (!hint) return;
      const target = findDeepseekReasoner();
      const recommend = 16384;
      if (!target) {
        hint.textContent = '';
        hint.classList.add('hidden');
        hint.onclick = null;
        return;
      }
      const current = Number(target.maxTokens) || 0;
      if (current >= recommend) {
        hint.textContent = '';
        hint.classList.add('hidden');
        hint.onclick = null;
        return;
      }
      hint.classList.remove('hidden');
      hint.textContent = '当前配置 ' + current + ' < 推荐配置 ' + recommend + '（点击调整）';
      hint.onclick = function() {
        if (typeof fillModelForm === 'function') fillModelForm(target.id);
        const card = modelListEl && modelListEl.querySelector('[data-id="' + target.id + '"]');
        if (card && card.scrollIntoView) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
    }

    function updateTabNotices() {
      const hasModels = Array.isArray(state.models) && state.models.length > 0;
      const hasSavedAssignments = state.hasSavedAssignments !== undefined
        ? state.hasSavedAssignments
        : Boolean(localStorage.getItem(assignmentKey));
      const assignedAll = requiredAssignmentKeys.every(function(key) {
        const assignedId = state.assignments[key];
        return Boolean(assignedId && getModelById(assignedId));
      });
      const missingAssignments = !hasSavedAssignments || !assignedAll;
      state.assignmentsMissing = hasModels ? missingAssignments : false;
      setTabNotice('models', hasModels ? '' : '未配置模型');
      setTabNotice('assign', hasModels ? (missingAssignments ? '未保存指派模型' : '') : '未配置模型');
      const needAiNotice = !hasModels || missingAssignments;
      setGroupNotice('ai', needAiNotice ? '需先配置模型/指派' : '');
      if (assignSaveBar) {
        assignSaveBar.classList.toggle('hidden', !(hasModels && missingAssignments));
      }
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
    if (saveAssignmentsTopBtn) {
      saveAssignmentsTopBtn.addEventListener('click', saveAssignments);
    }

    loadModels();
    loadAssignments();
    renderModels();
    renderAssignmentsSelect();
    updateAssignmentStatuses();
    pullModelsFromServer();
    pullAssignmentsFromServer();
    bindAuthReady();

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
      getTemperatureForType,
      getAssignedModel,
      testModel,
      saveModel,
    };
  }

  window.app.models = { init };
})();
