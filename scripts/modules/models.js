(function() {
  window.app = window.app || {};

  function init({ state, config, setStatus, dom }) {
    const {
      defaultPrompts,
      providerDefaults,
      modelsKey,
      assignmentKey,
    } = config || {};

    const gptReasoningEfforts = ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
    const deepseekReasoningEfforts = ['low', 'medium', 'high'];
    const reasoningEffortLabels = {
      none: 'None（不启用推理）',
      low: 'Low',
      medium: 'Medium（默认）',
      high: 'High',
      xhigh: 'XHigh',
      max: 'Max',
    };
    const assignmentName = 'default';
    var assignmentWriteQueue = Promise.resolve();
    var assignmentWriteSequence = 0;
    var assignmentWritePending = false;
    var assignmentPullSequence = 0;
    var assignmentRevision = 0;
    var modelPullSequence = 0;
    var modelRevision = 0;
    var modelRefreshBound = false;
    var lastModelRefreshAt = 0;
    const api = window.app && window.app.apiClient;
    const previousCaseWritingStyleGuidePrompt = [
      '【用例编写风格参考：AI_CASE_WRITING_STYLE_GUIDE.md】',
      '在保证覆盖质量、字段完整、语义不重复的前提下，生成结果要贴近人工从 XMind/表格整理检查点的写法：',
      '1、module 使用短业务分类，可保留项目编号习惯，不要写成长标题。',
      '2、title 写短检查点，优先 4-12 个字，不要批量写成“验证XXX功能是否正常”，不要把步骤或预期塞进标题。',
      '3、priority 只能填写 P0、P1、P2；P0 最高，核心链路/登录/支付/严重阻断/版本主功能用 P0，默认多数用例用 P1，边界/低频/兼容/展示细节可用 P2。',
      '4、preconditions 写当前测试状态，保持短句；多条时可用中文序号分点，不写背景解释。',
      '5、steps 优先单行动作，常用“进入、点击、查看、观察、检查、选择、装备、领取、购买、重复、重登”等测试动作，不要扩写成教学流程。',
      '6、expected 写直接可观察结果，常用“正常、正确、显示、展示、提示、可、不可、不会、到账、扣除、刷新、一致”等结果词。',
      '7、保留项目业务词和测试人员口吻，例如平A、红武、词条、专精、保底、回流、pvp、ui、重铸、羁绊；允许轻微人工差异和重复标题。',
      '8、不要为追求风格牺牲质量：字段必须完整，步骤和预期必须可执行/可观察，涉及数值、配置、奖励、付费、登录、状态变化时要写清关键校验点。'
    ].join('\n');
    const previousDefaultXmindCaseGenPrompt = '你是资深测试设计专家，负责 XMind 用例生成页面的结构化结果输出。你必须严格遵循以下规则：\n1、只输出合法 JSON，不要输出任何解释、备注、Markdown 或代码块围栏。\n2、输出结构固定为：{modules:[{module,key_scenarios,test_points,coupled_modules,cases}]}。\n3、每个模块字段要求：module 为模块名；key_scenarios/test_points/coupled_modules 均为数组；cases 可为空数组或省略。\n4、每条用例字段固定为：{module,title,priority,preconditions,steps,expected}，priority 仅允许 P0、P1、P2。\n5、用例标题 title 必须简洁明了，只表达测试意图，不要写成长句，不要把步骤或预期塞进标题。\n6、steps 必须是数组，数组中每一项都必须自带中文序号前缀，格式严格为“1、xxx”“2、xxx”。\n7、不得重复输出已有模块，也不得重复输出与已有用例语义重复的用例；模块命名要稳定、清晰、避免同义重复。\n8、是否允许新增模块、是否给新模块生成用例、是否给已有模块生成用例，必须严格遵守传入的 operation_contract。\n9、当 operation_contract 指定只补模块时，不要为模块生成 cases；当没有可补充内容时返回 {\"modules\":[]}。';
    const previousDefaultXmindCaseGenPromptV2 = previousDefaultXmindCaseGenPrompt + '\n\n' + previousCaseWritingStyleGuidePrompt;
    const previousDefaultCaseLibraryGenPrompt = '你是资深测试用例设计专家，请基于输入 JSON 中的 requirement_text、module_list、existing_cases、coverage_threshold 生成补充用例。要求：1) 分析需求覆盖模块，若需求包含的模块多于 module_list，先在 missing_modules 中补齐缺失模块；若 module_list 多于需求模块可忽略多出模块。2) 对 module_list 中每个模块评估 existing_cases 在当前需求下的覆盖率 coverage(0-100)，覆盖率>=coverage_threshold 的模块可不生成用例。3) 对覆盖率低于阈值的模块生成用例，并与 existing_cases 做语义去重，测试点相似的用例不要输出。4) 缺失模块 coverage 必然为 0，必须生成用例。严格输出 JSON：{missing_modules:[{module,coverage,cases:[{module,title,priority,precondition,steps,expected,remark}]}], existing_modules:[{module,coverage,cases:[{module,title,priority,precondition,steps,expected,remark}]}]}。priority 仅允许 P0/P1/P2，steps 为字符串(可换行)，其他字段为空用空字符串，仅输出 JSON。';
    const previousDefaultCaseLibraryGenPromptV2 = previousDefaultCaseLibraryGenPrompt + '\n\n' + previousCaseWritingStyleGuidePrompt;

    const domRefs = dom || {};
    const pickEl = function(key, id) { return domRefs[key] || document.getElementById(id); };
    const modelDisplayNameEl = pickEl('modelDisplayNameEl', 'modelDisplayName');
    const modelProviderEl = pickEl('modelProviderEl', 'modelProvider');
    const modelBaseUrlEl = pickEl('modelBaseUrlEl', 'modelBaseUrl');
    const modelApiKeyEl = pickEl('modelApiKeyEl', 'modelApiKey');
    const modelIdentifierEl = pickEl('modelIdentifierEl', 'modelIdentifier');
    const modelStreamModeEl = pickEl('modelStreamModeEl', 'modelStreamMode');
    const modelFormStatus = pickEl('modelFormStatus', 'modelFormStatus');
    const modelListEl = pickEl('modelListEl', 'modelList');
    const modelAvailableList = pickEl('modelAvailableListEl', 'modelAvailableList');
    const addModelIdBtn = pickEl('addModelIdBtnEl', 'addModelIdBtn');
    const createModelBtn = pickEl('createModelBtn', 'createModelBtn');
    const modelFormHome = pickEl('modelFormHome', 'modelFormHome');
    const modelFormWrapper = pickEl('modelFormWrapper', 'modelFormWrapper');
    const modelFormTitle = pickEl('modelFormTitle', 'modelFormTitle');
    const saveModelBtn = pickEl('saveModelBtn', 'saveModelBtn');
    const resetModelFormBtn = pickEl('resetModelFormBtn', 'resetModelForm');
    const fetchModelListBtn = pickEl('fetchModelListBtn', 'fetchModelListBtn');
    const fetchModelListHint = pickEl('fetchModelListHint', 'fetchModelListHint');
    const modelListFetchStatus = pickEl('modelListFetchStatus', 'modelListFetchStatus');
    const globalAssignReasoning = pickEl('globalAssignReasoning', 'globalAssignReasoning');
    const xmindCaseGenModelSelect = pickEl('xmindCaseGenModelSelect', 'xmindCaseGenModelSelect');
    const caseFilterModelSelect = pickEl('caseFilterModelSelect', 'caseFilterModelSelect');
    const missingReminderModelSelect = pickEl('missingReminderModelSelect', 'missingReminderModelSelect');
    const caseLibraryGenModelSelect = pickEl('caseLibraryGenModelSelect', 'caseLibraryGenModelSelect');
    const globalAssignModelSelect = pickEl('globalAssignModelSelect', 'globalAssignModelSelect');
    const xmindCaseGenAssignStatus = pickEl('xmindCaseGenAssignStatus', 'xmindCaseGenAssignStatus');
    const caseFilterAssignStatus = pickEl('caseFilterAssignStatus', 'caseFilterAssignStatus');
    const missingReminderAssignStatus = pickEl('missingReminderAssignStatus', 'missingReminderAssignStatus');
    const caseLibraryGenAssignStatus = pickEl('caseLibraryGenAssignStatus', 'caseLibraryGenAssignStatus');
    const assignSaveBar = pickEl('assignSaveBar', 'assignSaveBar');
    const xmindCaseGenPromptEl = pickEl('xmindCaseGenPromptEl', 'xmindCaseGenPrompt');
    const caseFilterPromptEl = pickEl('caseFilterPromptEl', 'caseFilterPrompt');
    const missingReminderPromptEl = pickEl('missingReminderPromptEl', 'missingReminderPrompt');
    const caseLibraryGenPromptEl = pickEl('caseLibraryGenPromptEl', 'caseLibraryGenPrompt');
    const xmindCaseGenReasoningSelect = pickEl('xmindCaseGenReasoningSelect', 'xmindCaseGenReasoning');
    const caseFilterReasoningSelect = pickEl('caseFilterReasoningSelect', 'caseFilterReasoning');
    const missingReminderReasoningSelect = pickEl('missingReminderReasoningSelect', 'missingReminderReasoning');
    const caseLibraryGenReasoningSelect = pickEl('caseLibraryGenReasoningSelect', 'caseLibraryGenReasoning');

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

    function escapeHtml(text) {
      var source = text === undefined || text === null ? '' : String(text);
      return source
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function normalizeCapabilityKey(value) {
      var raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
      if (!raw) return '';
      if (raw === 'vision' || raw === '视觉') return 'vision';
      if (raw === 'reasoning' || raw === '推理') return 'reasoning';
      if (raw === 'chat' || raw === '聊天') return 'chat';
      return '';
    }

    function normalizeModelCapabilities(value) {
      var result = [];
      var seen = {};
      var append = function(item) {
        var key = normalizeCapabilityKey(item);
        if (!key || seen[key]) return;
        seen[key] = true;
        result.push(key);
      };
      if (Array.isArray(value)) {
        value.forEach(append);
      } else if (typeof value === 'string') {
        value.split(/[,|/、\s]+/).forEach(append);
      } else if (value && typeof value === 'object') {
        Object.keys(value).forEach(function(key) {
          if (value[key]) append(key);
        });
      }
      return result;
    }

    function getModelCapabilities(model) {
      if (!model || typeof model !== 'object') return [];
      return normalizeModelCapabilities(
        model.capabilities
        || model.modelCapabilities
        || model.multiModalTags
        || model.multimodalTags
        || model.tags
      );
    }

    function getDeclaredModelCapabilities(model) {
      if (!model || typeof model !== 'object') return null;
      const keys = ['capabilities', 'modelCapabilities', 'multiModalTags', 'multimodalTags', 'tags'];
      for (let index = 0; index < keys.length; index += 1) {
        const value = model[keys[index]];
        if (value !== undefined && value !== null) return normalizeModelCapabilities(value);
      }
      return null;
    }

    function normalizeReasoningEffort(value) {
      var raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
      return Object.prototype.hasOwnProperty.call(reasoningEffortLabels, raw) ? raw : '';
    }

    function getModelIdentifier(model) {
      return model && model.model ? String(model.model).trim().toLowerCase() : '';
    }

    function isDeepseekR1Model(model) {
      var id = getModelIdentifier(model);
      return id.indexOf('deepseek-r1') !== -1 || id.indexOf('deepseek-reasoner') !== -1;
    }

    function isGptReasoningModel(model) {
      var id = getModelIdentifier(model);
      return id.indexOf('gpt-5') === 0 && id.indexOf('chat') === -1;
    }

    function modelHasReasoningCapability(model) {
      return getModelCapabilities(model).indexOf('reasoning') !== -1;
    }

    function modelSupportsReasoning(model) {
      return isDeepseekR1Model(model) || isGptReasoningModel(model) || modelHasReasoningCapability(model);
    }

    function getModelReasoningEfforts(model) {
      if (isDeepseekR1Model(model)) return deepseekReasoningEfforts;
      if (isGptReasoningModel(model) || modelHasReasoningCapability(model)) return gptReasoningEfforts;
      return [];
    }

    function getModelReasoningLabel(value) {
      var normalized = normalizeReasoningEffort(value);
      return normalized ? (reasoningEffortLabels[normalized] || normalized) : '默认';
    }

    function populateReasoningSelect(selectEl, model) {
      if (!selectEl) return false;
      const current = normalizeReasoningEffort(selectEl.value);
      let options = '<option value="">默认</option>';
      gptReasoningEfforts.forEach(function(effort) {
        options += '<option value="' + effort + '">' + escapeHtml(reasoningEffortLabels[effort] || effort) + '</option>';
      });
      selectEl.innerHTML = options;
      selectEl.value = gptReasoningEfforts.indexOf(current) !== -1 ? current : '';
      return true;
    }

    function buildReasoningOptionsHtml(siteId, modelId, selected) {
      const current = normalizeReasoningEffort(selected);
      let html = '<option value="">默认</option>';
      gptReasoningEfforts.forEach(function(effort) {
        html += '<option value="' + effort + '"' + (effort === current ? ' selected' : '') + '>'
          + escapeHtml(reasoningEffortLabels[effort] || effort) + '</option>';
      });
      return html;
    }

    function normalizeModelStream(value) {
      if (value === true) return true;
      var raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
      if (!raw) return false;
      return raw === 'true' || raw === '1' || raw === 'stream' || raw === 'sse' || raw === 'on';
    }

    function readModelStreamFromForm() {
      if (!modelStreamModeEl) return false;
      return modelStreamModeEl.value === 'stream';
    }

    function writeModelStreamToForm(value) {
      if (!modelStreamModeEl) return;
      modelStreamModeEl.value = normalizeModelStream(value) ? 'stream' : 'nonstream';
    }

    function getModelStreamLabel(model) {
      return normalizeModelStream(model && (model.stream !== undefined ? model.stream : model.streamMode))
        ? '流式'
        : '非流式';
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

    let draftAvailableModels = [];

    function normalizeAvailableModels(value) {
      const list = [];
      const seen = {};
      const pushItem = function(item) {
        if (!item) return;
        let id = typeof item === 'string' ? item : (item.id || item.model || item.name);
        id = id === undefined || id === null ? '' : String(id).trim();
        if (!id || seen[id]) return;
        seen[id] = true;
        const normalized = {
          id: id,
          name: (item && typeof item === 'object' && item.name) ? String(item.name) : id,
          contextWindow: (item && typeof item === 'object') ? listingCapacity(item.context_window, item.context_length, item.contextWindow) : undefined,
        };
        const capabilities = getDeclaredModelCapabilities(item);
        if (capabilities !== null) normalized.capabilities = capabilities;
        list.push(normalized);
      };
      if (Array.isArray(value)) value.forEach(pushItem);
      return list;
    }

    function getSiteAvailableModels(site) {
      if (!site || typeof site !== 'object') return [];
      const list = normalizeAvailableModels(site.availableModels);
      const legacyId = site.model !== undefined && site.model !== null ? String(site.model).trim() : '';
      if (!list.length && legacyId) list.push({ id: legacyId, name: legacyId, contextWindow: undefined });
      const legacyCapabilities = getDeclaredModelCapabilities(site);
      return list.map(function(item) {
        if (legacyCapabilities !== null && item.id.toLowerCase() === legacyId.toLowerCase()
          && getDeclaredModelCapabilities(item) === null) {
          return Object.assign({}, item, { capabilities: legacyCapabilities.slice() });
        }
        return item;
      });
    }

    function resolveSiteModel(siteId, modelId) {
      const site = findModelByAnyId(siteId);
      if (!site) return null;
      const available = getSiteAvailableModels(site);
      const targetId = modelId !== undefined && modelId !== null ? String(modelId).trim() : '';
      if (!targetId) return null;
      let meta = null;
      const lowerTarget = targetId.toLowerCase();
      meta = available.find(function(item) { return String(item.id || '').toLowerCase() === lowerTarget; }) || null;
      if (!meta) return null;
      const wireModel = String(meta.id || '').trim();
      if (!wireModel) return null;
      // 显式能力（含空数组）优先，避免把站点能力复制给其它模型。
      let capabilities = getDeclaredModelCapabilities(meta);
      if (capabilities === null) capabilities = guessModelCapabilities(wireModel, meta.name);
      return {
        id: getStableModelId(site),
        remoteId: site.remoteId,
        name: site.name || '未命名模型',
        provider: site.provider || 'custom',
        baseUrl: site.baseUrl || '',
        apiKey: site.apiKey || '',
        model: wireModel,
        stream: normalizeModelStream(site.stream !== undefined ? site.stream : site.streamMode),
        capabilities: capabilities,
        reasoningEffort: normalizeReasoningEffort(site.reasoningEffort),
        configCreatedAt: site.configCreatedAt || site.created_at || site.createdAt || '',
        configUpdatedAt: site.configUpdatedAt || site.updated_at || site.updatedAt || '',
      };
    }

    function resolveSiteIdByModelId(modelId) {
      const target = String(modelId || '').toLowerCase();
      if (!target) return '';
      const site = (state.models || []).find(function(m) {
        return getSiteAvailableModels(m).some(function(item) {
          return String(item.id || '').toLowerCase() === target;
        });
      });
      return site ? getStableModelId(site) : '';
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
        next.capabilities = getModelCapabilities(next);
        next.reasoningEffort = normalizeReasoningEffort(
          next.reasoningEffort !== undefined && next.reasoningEffort !== null
            ? next.reasoningEffort
            : next.reasoning_effort
        );
        next.availableModels = normalizeAvailableModels(next.availableModels);
        next.baseUrl = toBaseUrlRoot(next.baseUrl);
        return next;
      });
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

    function emitModelsUpdated(source) {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      var detail = {
        source: source ? String(source || '') : '',
        revision: modelRevision,
      };
      try {
        if (typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('app-models-updated', { detail: detail }));
        } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
          var event = document.createEvent('CustomEvent');
          event.initCustomEvent('app-models-updated', false, false, detail);
          window.dispatchEvent(event);
        }
      } catch (err) {
        // ignore
      }
    }

    function saveModels() {
      persistModelsLocal();
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

    function modelToConfigJson(model) {
      return {
        provider: model.provider,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        stream: normalizeModelStream(model && (model.stream !== undefined ? model.stream : model.streamMode)),
        capabilities: getModelCapabilities(model),
        reasoningEffort: normalizeReasoningEffort(
          model && model.reasoningEffort !== undefined ? model.reasoningEffort : model && model.reasoning_effort
        ),
        availableModels: getSiteAvailableModels(model),
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
          baseUrl: toBaseUrlRoot(cfg.baseUrl || cfg.base_url || ''),
          apiKey: cfg.apiKey || cfg.api_key || '',
          model: cfg.model || cfg.modelIdentifier || cfg.model_id || '',
          stream: normalizeModelStream(
            cfg.stream !== undefined && cfg.stream !== null ? cfg.stream : cfg.streamMode
          ),
          reasoningEffort: normalizeReasoningEffort(
            cfg.reasoningEffort !== undefined && cfg.reasoningEffort !== null
              ? cfg.reasoningEffort
              : cfg.reasoning_effort
          ),
          capabilities: normalizeModelCapabilities(
            cfg.capabilities
            || cfg.modelCapabilities
            || cfg.multiModalTags
            || cfg.multimodalTags
            || cfg.tags
          ),
          availableModels: normalizeAvailableModels(cfg.availableModels || cfg.available_models),
          configCreatedAt: item && (item.created_at || item.createdAt)
            ? String(item.created_at || item.createdAt || '')
            : '',
          configUpdatedAt: item && (item.updated_at || item.updatedAt)
            ? String(item.updated_at || item.updatedAt || '')
            : '',
        };
      });
    }

    function pullModelsFromServer() {
      if (!api || typeof api.listModelConfigs !== 'function') return Promise.resolve([]);
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      var ownerId = state.currentUser && state.currentUser.id;
      var ready = state.authReady || (window.app && window.app.authReady);
      if (!ownerId && !ready) {
        setTimeout(pullModelsFromServer, 200);
        return Promise.resolve([]);
      }
      var pullSequence = ++modelPullSequence;
      var pullRevision = modelRevision;
      var pullOwnerKey = getCurrentAssignmentOwnerKey();
      lastModelRefreshAt = Date.now();
      return api.listModelConfigs('all', ownerId).then(function(data) {
        if (pullSequence !== modelPullSequence) return state.models;
        if (pullRevision !== modelRevision) return state.models;
        if (pullOwnerKey && getCurrentAssignmentOwnerKey() && pullOwnerKey !== getCurrentAssignmentOwnerKey()) {
          return state.models;
        }
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
          return state.models;
        }
        state.models = remoteModels;
        modelRevision += 1;
        persistModelsLocal();
        syncAssignmentsWithModels({ pushRemote: true });
        renderModels();
        renderAssignmentsSelect();
        updateAssignmentStatuses();
        emitModelsUpdated('remote');
        return remoteModels;
      }).catch(function(err) {
        console.warn('加载远端模型失败', err);
        return state.models;
      });
    }

    function applyRemoteModelId(model, remoteId) {
      if (!model || remoteId === undefined || remoteId === null) return;
      var stableId = String(remoteId);
      var oldId = model.id;
      model.remoteId = remoteId;
      model.id = stableId;
      if (oldId && oldId !== stableId) {
        if (state.editingId && String(state.editingId) === String(oldId)) {
          state.editingId = stableId;
        }
        updateAssignmentsModelId(oldId, stableId, { pushRemote: true });
      }
      persistModelsLocal();
    }

    function applyRemoteModelMetadata(model, response) {
      if (!model || !response || typeof response !== 'object') return;
      if (response.updated_at || response.updatedAt) {
        model.configUpdatedAt = String(response.updated_at || response.updatedAt || '');
      }
      if (response.created_at || response.createdAt) {
        model.configCreatedAt = String(response.created_at || response.createdAt || '');
      }
    }

    function persistModelToServer(model) {
      if (!api || typeof api.createModelConfig !== 'function') return Promise.resolve();
      var storedToken = '';
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        storedToken = api.getStoredToken();
        if (storedToken) api.setToken(storedToken);
      }
      if (!storedToken) return Promise.resolve(null);
      var payload = {
        name: model.name || '未命名模型',
        config_json: modelToConfigJson(model),
      };
      if (model.remoteId) {
        return api.updateModelConfig(model.remoteId, payload).then(function(res) {
          var resId = res && res.id ? res.id : model.remoteId;
          applyRemoteModelId(model, resId);
          applyRemoteModelMetadata(model, res);
          return res;
        });
      }
      return api.createModelConfig(payload).then(function(res) {
        if (res && res.id) applyRemoteModelId(model, res.id);
        applyRemoteModelMetadata(model, res);
        return res;
      });
    }

    // Normalize assignment configs from localStorage/server and keep backward compatibility.
    // Remote values take precedence; missing fields fall back to base/local values and defaults.
    function normalizeAssignmentsObject(cfg, options) {
      var base = options && options.base && typeof options.base === 'object' ? options.base : {};
      var incoming = cfg && typeof cfg === 'object' ? cfg : {};
      var valueFor = function(key, fallback) {
        if (incoming[key] !== undefined && incoming[key] !== null) return incoming[key];
        if (base[key] !== undefined && base[key] !== null) return base[key];
        return fallback;
      };
      var merged = {
        xmindCaseGenId: valueFor('xmindCaseGenId', '') || '',
        caseFilterId: valueFor('caseFilterId', '') || '',
        missingReminderId: valueFor('missingReminderId', '') || '',
        caseLibraryGenId: valueFor('caseLibraryGenId', '') || '',
        xmindCaseGenModelId: valueFor('xmindCaseGenModelId', '') || '',
        caseFilterModelId: valueFor('caseFilterModelId', '') || '',
        missingReminderModelId: valueFor('missingReminderModelId', '') || '',
        caseLibraryGenModelId: valueFor('caseLibraryGenModelId', '') || '',
        xmindCaseGenPrompt: valueFor('xmindCaseGenPrompt', defaultPrompts.xmindcasegen) || defaultPrompts.xmindcasegen,
        caseFilterPrompt: valueFor('caseFilterPrompt', defaultPrompts.casefilter) || defaultPrompts.casefilter,
        missingReminderPrompt: valueFor('missingReminderPrompt', defaultPrompts.missingreminder) || defaultPrompts.missingreminder,
        caseLibraryGenPrompt: valueFor('caseLibraryGenPrompt', defaultPrompts.caselibrarygen) || defaultPrompts.caselibrarygen,
        xmindCaseGenReasoning: valueFor('xmindCaseGenReasoning', '') || '',
        caseFilterReasoning: valueFor('caseFilterReasoning', '') || '',
        missingReminderReasoning: valueFor('missingReminderReasoning', '') || '',
        caseLibraryGenReasoning: valueFor('caseLibraryGenReasoning', '') || '',
      };
      var retainedKeys = Object.keys(merged);
      var migrated = Object.keys(incoming).some(function(key) {
        return retainedKeys.indexOf(key) === -1;
      });
      merged.xmindCaseGenPrompt = merged.xmindCaseGenPrompt || defaultPrompts.xmindcasegen;
      if (
        merged.xmindCaseGenPrompt === previousDefaultXmindCaseGenPrompt
        || merged.xmindCaseGenPrompt === previousDefaultXmindCaseGenPromptV2
      ) {
        merged.xmindCaseGenPrompt = defaultPrompts.xmindcasegen;
        migrated = true;
      }
      if (
        merged.caseLibraryGenPrompt === previousDefaultCaseLibraryGenPrompt
        || merged.caseLibraryGenPrompt === previousDefaultCaseLibraryGenPromptV2
      ) {
        merged.caseLibraryGenPrompt = defaultPrompts.caselibrarygen;
        migrated = true;
      }

      return { assignments: merged, migrated: migrated };
    }

    function cloneAssignments(value) {
      try {
        return JSON.parse(JSON.stringify(value && typeof value === 'object' ? value : {}));
      } catch (err) {
        return Object.assign({}, value && typeof value === 'object' ? value : {});
      }
    }

    function getCurrentAssignmentOwnerKey() {
      var currentUser = state && state.currentUser ? state.currentUser : null;
      if (!currentUser || (currentUser.id === undefined || currentUser.id === null)) return '';
      return String(currentUser.id);
    }

    function getAssignmentRecordTime(item) {
      var raw = item && (item.updated_at || item.updatedAt || item.created_at || item.createdAt);
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (raw) {
        var parsed = Date.parse(String(raw));
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    }

    function isNewerAssignment(item, current) {
      if (!current) return true;
      var itemTime = getAssignmentRecordTime(item);
      var currentTime = getAssignmentRecordTime(current);
      if (itemTime !== currentTime) return itemTime > currentTime;
      var itemId = Number(item && item.id);
      var currentId = Number(current && current.id);
      if (Number.isFinite(itemId) && Number.isFinite(currentId) && itemId !== currentId) {
        return itemId > currentId;
      }
      return false;
    }

    function chooseLatestAssignment(assignments, userId) {
      var chosenUser = null;
      var chosenGlobal = null;
      (assignments || []).forEach(function(item) {
        if (!item) return;
        var ownerId = item.owner_id;
        if (ownerId === null || ownerId === undefined) {
          if (isNewerAssignment(item, chosenGlobal)) chosenGlobal = item;
          return;
        }
        var ownerNum = Number(ownerId);
        if (userId === null || (Number.isFinite(ownerNum) && ownerNum === userId)) {
          if (isNewerAssignment(item, chosenUser)) chosenUser = item;
        }
      });
      return chosenUser || chosenGlobal;
    }

    function pullAssignmentsFromServer() {
      if (!api || typeof api.listFeatureAssignments !== 'function') return Promise.resolve(state.assignments);
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      var ownerId = state.currentUser && state.currentUser.id;
      var ready = state.authReady || (window.app && window.app.authReady);
      if (!ownerId && !ready) {
        setTimeout(pullAssignmentsFromServer, 200);
        return Promise.resolve(state.assignments);
      }
      var pullSequence = ++assignmentPullSequence;
      var pullRevision = assignmentRevision;
      var pullOwnerKey = getCurrentAssignmentOwnerKey();
      return api.listFeatureAssignments('all', ownerId).then(function(list) {
        if (pullSequence !== assignmentPullSequence) return state.assignments;
        if (pullRevision !== assignmentRevision) return state.assignments;
        if (assignmentWritePending) return state.assignments;
        if (pullOwnerKey && getCurrentAssignmentOwnerKey() && pullOwnerKey !== getCurrentAssignmentOwnerKey()) return state.assignments;
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
          return state.assignments;
        }
        // owner_id 可能是 number 或 string；并且 authReady 时 currentUser 可能暂未填充。
        var userId = null;
        if (state && state.currentUser && (state.currentUser.id || state.currentUser.id === 0)) {
          var parsedUserId = Number(state.currentUser.id);
          if (Number.isFinite(parsedUserId)) userId = parsedUserId;
        }
        var chosen = chooseLatestAssignment(assignments, userId);
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
        return state.assignments;
      }).catch(function(err) {
        console.warn('加载功能指派失败', err);
        return state.assignments;
      });
    }

    function refreshAssignmentsFromServer() {
      var waitForWrite = assignmentWritePending ? assignmentWriteQueue : Promise.resolve();
      return waitForWrite.then(function() {
        return pullAssignmentsFromServer();
      });
    }

    function pushAssignmentsToServer() {
      if (!api || typeof api.createFeatureAssignment !== 'function') return Promise.resolve();
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      var snapshot = cloneAssignments(state.assignments);
      var ownerKey = getCurrentAssignmentOwnerKey();
      var writeSequence = ++assignmentWriteSequence;
      assignmentWritePending = true;
      var write = function() {
        var currentOwnerKey = getCurrentAssignmentOwnerKey();
        if (ownerKey && currentOwnerKey && ownerKey !== currentOwnerKey) return Promise.resolve();
        var payload = {
          name: assignmentName,
          config_json: snapshot,
          scope: 'user',
        };
        var markSaved = function() {
          if (!ownerKey || !getCurrentAssignmentOwnerKey() || ownerKey === getCurrentAssignmentOwnerKey()) {
            state.hasSavedAssignments = true;
          }
        };
        if (state.assignmentRemoteId) {
          return api.updateFeatureAssignment(state.assignmentRemoteId, payload).then(function() {
            markSaved();
          });
        }
        return api.createFeatureAssignment(payload).then(function(res) {
          if (res && res.id && !state.assignmentRemoteId) state.assignmentRemoteId = res.id;
          markSaved();
        }).catch(function(err) {
          if (!err || err.status !== 400 || typeof api.listFeatureAssignments !== 'function') throw err;
          var currentUserId = state.currentUser && state.currentUser.id;
          var parsedUserId = Number(currentUserId);
          var userId = Number.isFinite(parsedUserId) ? parsedUserId : null;
          return api.listFeatureAssignments('all', currentUserId).then(function(list) {
            var existing = chooseLatestAssignment(list || [], userId);
            if (!existing || !existing.id) throw err;
            if (!state.assignmentRemoteId) state.assignmentRemoteId = existing.id;
            return api.updateFeatureAssignment(existing.id, payload).then(function() {
              markSaved();
            });
          });
        });
      };
      assignmentWriteQueue = assignmentWriteQueue.then(write).catch(function(err) {
        console.warn('保存功能指派失败', err);
      }).then(function() {
        if (writeSequence === assignmentWriteSequence) assignmentWritePending = false;
      });
      return assignmentWriteQueue;
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

    function bindModelRefresh() {
      if (modelRefreshBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
      modelRefreshBound = true;
      var refreshRemote = function() {
        if (Date.now() - lastModelRefreshAt < 500) return;
        pullModelsFromServer();
        pullAssignmentsFromServer();
      };
      window.addEventListener('focus', refreshRemote);
      window.addEventListener('pageshow', refreshRemote);
      window.addEventListener('app-tab-activated', refreshRemote);
      window.addEventListener('storage', function(event) {
        if (!event || event.key !== modelsKey) return;
        loadModels();
        modelRevision += 1;
        syncAssignmentsWithModels({ pushRemote: false });
        renderModels();
        renderAssignmentsSelect();
        updateAssignmentStatuses();
        emitModelsUpdated('storage');
        refreshRemote();
      });
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', function() {
          if (document.visibilityState !== 'hidden') refreshRemote();
        });
      }
    }

    function restoreModelFormHome() {
      if (!modelFormHome || !modelFormWrapper || !modelFormHome.parentNode) return;
      modelFormHome.parentNode.insertBefore(modelFormWrapper, modelFormHome.nextSibling);
      modelFormWrapper.classList.remove('model-edit-panel-inline');
    }

    function findRenderedModelCard(id) {
      if (!modelListEl) return null;
      var targetId = id === undefined || id === null ? '' : String(id);
      var cards = modelListEl.querySelectorAll('.model-card[data-id]');
      for (var index = 0; index < cards.length; index += 1) {
        if (cards[index].getAttribute('data-id') === targetId) return cards[index];
      }
      return null;
    }

    function mountModelFormAfterModel(id) {
      if (!modelFormWrapper) return;
      var card = findRenderedModelCard(id);
      if (!card || !card.parentNode) {
        restoreModelFormHome();
        return;
      }
      card.parentNode.insertBefore(modelFormWrapper, card.nextSibling);
      modelFormWrapper.classList.add('model-edit-panel-inline');
    }

    function renderModels() {
      if (!modelListEl) return;
      restoreModelFormHome();
      if (!state.models.length) {
        modelListEl.innerHTML = '<p class="hint">尚未配置模型，请先创建。</p>';
        updateTabNotices();
        return;
      }
      modelListEl.innerHTML = state.models.map(m => {
        const stableId = getStableModelId(m);
        const nameHtml = escapeHtml(m && m.name ? m.name : '未命名模型');
        const providerHtml = escapeHtml(m && m.provider ? m.provider : 'custom');
        const streamLabel = escapeHtml(getModelStreamLabel(m));
        const available = getSiteAvailableModels(m);
        const modelIdsHtml = available.slice(0, 6).map(function(item) {
          return '<span class="model-id-chip">' + escapeHtml(item.id) + '</span>';
        }).join('');
        const moreHtml = available.length > 6 ? '<span class="model-id-chip">+' + (available.length - 6) + '</span>' : '';
        return `
        <div class="model-card" data-id="${stableId}">
          <div class="model-name-line">
            <strong>${nameHtml}</strong>
          </div>
          <div class="meta">
            <span>类型：${providerHtml}</span>
            <span>调用：${streamLabel}</span>
            <span>模型数：${available.length}</span>
          </div>
          <div class="model-id-chip-list">${modelIdsHtml}${moreHtml}</div>
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
      if (state.editingId) {
        mountModelFormAfterModel(state.editingId);
      }
      updateTabNotices();
    }

    function resetModelForm(hide = false) {
      state.editingId = null;
      restoreModelFormHome();
      if (modelDisplayNameEl) modelDisplayNameEl.value = '';
      if (modelProviderEl) modelProviderEl.value = 'deepseek';
      if (modelBaseUrlEl) modelBaseUrlEl.value = '';
      if (modelApiKeyEl) modelApiKeyEl.value = '';
      if (modelIdentifierEl) modelIdentifierEl.value = '';
      writeModelStreamToForm(false);
      draftAvailableModels = [];
      renderAvailableModels();
      setStatus(modelListFetchStatus, '', '');
      setStatus(modelFormStatus, hide ? '' : '已重置表单', '');
      if (hide && modelFormWrapper) {
        modelFormWrapper.classList.add('hidden');
      }
      applyProviderPreset(modelProviderEl, modelBaseUrlEl);
    }

    function fillModelForm(id) {
      const model = findModelByAnyId(id);
      if (!model) return;
      state.editingId = getStableModelId(model) || id;
      mountModelFormAfterModel(state.editingId);
      if (modelFormWrapper) modelFormWrapper.classList.remove('hidden');
      if (modelFormTitle) modelFormTitle.textContent = '编辑站点：' + (model.name || '未命名模型');
      if (modelDisplayNameEl) modelDisplayNameEl.value = model.name || '';
      if (modelProviderEl) modelProviderEl.value = model.provider || 'custom';
      if (modelBaseUrlEl) modelBaseUrlEl.value = model.baseUrl || '';
      if (modelApiKeyEl) modelApiKeyEl.value = model.apiKey || '';
      if (modelIdentifierEl) modelIdentifierEl.value = '';
      writeModelStreamToForm(model.stream !== undefined ? model.stream : model.streamMode);
      draftAvailableModels = getSiteAvailableModels(model);
      renderAvailableModels();
      setStatus(modelFormStatus, '已加载待编辑站点，可修改后保存', 'ok');
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
      if (state.editingId && String(state.editingId) === getStableModelId(removed)) {
        state.editingId = null;
        restoreModelFormHome();
        if (modelFormWrapper) modelFormWrapper.classList.add('hidden');
      }
      state.models = state.models.filter(function(m) { return getStableModelId(m) !== targetId; });
      modelRevision += 1;
      persistModelsLocal();
      var keys = assignmentIdKeys;
      keys.forEach(function(key) {
        if (state.assignments[key] === targetId) {
          state.assignments[key] = '';
          state.assignments[key.replace(/Id$/, 'ModelId')] = '';
        }
      });
      persistAssignmentsLocal();
      if (state.assignmentRemoteId || state.hasSavedAssignments) {
        pushAssignmentsToServer();
      }
      renderAssignmentsSelect();
      updateAssignmentStatuses();
      emitModelsUpdated('delete');
      setStatus(modelFormStatus, '模型已删除', 'ok');
    }

    function applyProviderPreset(providerEl, baseUrlEl) {
      const preset = providerDefaults[providerEl && providerEl.value];
      if (!preset) return;
      if (baseUrlEl && !baseUrlEl.value.trim()) baseUrlEl.value = preset.baseUrl;
      if (preset.model && draftAvailableModels.length === 0) {
        draftAvailableModels = [{ id: preset.model, name: preset.model, contextWindow: undefined }];
        renderAvailableModels();
      }
    }

    async function saveModel() {
      const editingModel = state.editingId ? findModelByAnyId(state.editingId) : null;
      const baseId = editingModel ? getStableModelId(editingModel) : (state.editingId || `model-${Date.now()}`);
      const editingIndex = editingModel
        ? state.models.findIndex(function(item) { return item === editingModel; })
        : -1;
      let inheritedRemoteId = null;
      if (editingModel) {
        if (editingModel.remoteId !== undefined && editingModel.remoteId !== null) {
          inheritedRemoteId = editingModel.remoteId;
        } else if (baseId && !Number.isNaN(Number(baseId))) {
          inheritedRemoteId = baseId;
        }
      }
      const availableModels = normalizeAvailableModels(draftAvailableModels);
      if (modelIdentifierEl) {
        const manualId = String(modelIdentifierEl.value || '').trim();
        if (manualId) {
          const manualExists = availableModels.some(function(item) {
            return String(item.id).toLowerCase() === manualId.toLowerCase();
          });
          if (!manualExists) {
            availableModels.push({ id: manualId, name: manualId, contextWindow: undefined });
          }
        }
      }
      const model = {
        id: baseId,
        remoteId: inheritedRemoteId,
        name: modelDisplayNameEl ? modelDisplayNameEl.value.trim() || '未命名模型' : '未命名模型',
        provider: modelProviderEl ? modelProviderEl.value : 'custom',
        baseUrl: toBaseUrlRoot(modelBaseUrlEl ? modelBaseUrlEl.value : ''),
        apiKey: modelApiKeyEl ? modelApiKeyEl.value.trim() : '',
        model: '',
        stream: readModelStreamFromForm(),
        capabilities: [],
        reasoningEffort: '',
        availableModels: availableModels,
      };
      if (!model.baseUrl || !model.apiKey || !availableModels.length) {
        setStatus(modelFormStatus, '请至少填写接口、API Key，并获取或添加至少一个模型', 'warn');
        return;
      }
      if (hasDuplicateModelName(model)) {
        setStatus(modelFormStatus, '模型名称已存在，请换一个名称', 'warn');
        return;
      }
      if (saveModelBtn) saveModelBtn.disabled = true;
      setStatus(modelFormStatus, '正在保存模型...', '');
      try {
        await persistModelToServer(model);
        if (editingIndex >= 0) {
          state.models[editingIndex] = model;
        } else {
          state.models.push(model);
        }
        modelRevision += 1;
        state.editingId = null;
        restoreModelFormHome();
        saveModels();
        setStatus(modelFormStatus, editingIndex >= 0 ? '模型已更新' : '模型已保存', 'ok');
        if (modelFormWrapper) modelFormWrapper.classList.add('hidden');
        renderAssignmentsSelect();
        emitModelsUpdated(editingIndex >= 0 ? 'update' : 'create');
      } catch (err) {
        var message = err && err.message ? err.message : '模型保存失败，请重试';
        setStatus(modelFormStatus, '保存失败：' + message, 'warn');
        if (modelFormWrapper) modelFormWrapper.classList.remove('hidden');
      } finally {
        if (saveModelBtn) saveModelBtn.disabled = false;
      }
    }

    const requiredAssignmentKeys = ['xmindCaseGenId', 'caseFilterId', 'missingReminderId', 'caseLibraryGenId'];
    const assignmentIdKeys = requiredAssignmentKeys.slice();

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
      assignmentRevision += 1;
      const readModelSelection = function(selectEl) {
        if (!selectEl) return { siteId: '', modelId: '' };
        const option = selectEl.selectedOptions && selectEl.selectedOptions[0] ? selectEl.selectedOptions[0] : null;
        return {
          modelId: selectEl.value || '',
          siteId: option ? (option.getAttribute('data-site-id') || '') : '',
        };
      };
      if (xmindCaseGenModelSelect) {
        const xm = readModelSelection(xmindCaseGenModelSelect);
        state.assignments.xmindCaseGenId = xm.siteId;
        state.assignments.xmindCaseGenModelId = xm.modelId;
      }
      if (caseFilterModelSelect) {
        const cf = readModelSelection(caseFilterModelSelect);
        state.assignments.caseFilterId = cf.siteId;
        state.assignments.caseFilterModelId = cf.modelId;
      }
      if (missingReminderModelSelect) {
        const mr = readModelSelection(missingReminderModelSelect);
        state.assignments.missingReminderId = mr.siteId;
        state.assignments.missingReminderModelId = mr.modelId;
      }
      if (caseLibraryGenModelSelect) {
        const cl = readModelSelection(caseLibraryGenModelSelect);
        state.assignments.caseLibraryGenId = cl.siteId;
        state.assignments.caseLibraryGenModelId = cl.modelId;
      }
      if (xmindCaseGenPromptEl) state.assignments.xmindCaseGenPrompt = xmindCaseGenPromptEl.value.trim() || defaultPrompts.xmindcasegen;
      if (caseFilterPromptEl) state.assignments.caseFilterPrompt = caseFilterPromptEl.value.trim() || defaultPrompts.casefilter;
      if (missingReminderPromptEl) state.assignments.missingReminderPrompt = missingReminderPromptEl.value.trim() || defaultPrompts.missingreminder;
      if (caseLibraryGenPromptEl) state.assignments.caseLibraryGenPrompt = caseLibraryGenPromptEl.value.trim() || defaultPrompts.caselibrarygen;
      if (xmindCaseGenReasoningSelect) state.assignments.xmindCaseGenReasoning = xmindCaseGenReasoningSelect.value || '';
      if (caseFilterReasoningSelect) state.assignments.caseFilterReasoning = caseFilterReasoningSelect.value || '';
      if (missingReminderReasoningSelect) state.assignments.missingReminderReasoning = missingReminderReasoningSelect.value || '';
      if (caseLibraryGenReasoningSelect) state.assignments.caseLibraryGenReasoning = caseLibraryGenReasoningSelect.value || '';
      syncAssignmentsWithModels({ pushRemote: false });
      persistAssignmentsLocal();
      state.hasSavedAssignments = true;
      pushAssignmentsToServer();
      updateAssignmentStatuses();
      setStatus(xmindCaseGenAssignStatus, '指派已保存', 'ok');
      setStatus(caseFilterAssignStatus, '指派已保存', 'ok');
      setStatus(missingReminderAssignStatus, '指派已保存', 'ok');
      setStatus(caseLibraryGenAssignStatus, '指派已保存', 'ok');
      if (assignSaveBar) assignSaveBar.classList.add('hidden');
    }

    function renderAssignmentsSelect() {
      if (!xmindCaseGenModelSelect || !caseFilterPromptEl) return;
      syncAssignmentsWithModels({ pushRemote: false });

      const buildOptions = function(selectedSiteId, selectedModelId, includeEmpty) {
        let html = includeEmpty ? '<option value="">请选择模型</option>' : '';
        (state.models || []).forEach(function(site) {
          const siteId = getStableModelId(site);
          const available = getSiteAvailableModels(site);
          if (!available.length) return;
          html += '<optgroup label="' + escapeHtml(site.name || '未命名站点') + '">';
          available.forEach(function(item) {
            const sel = (siteId === selectedSiteId && item.id === selectedModelId) ? 'selected' : '';
            html += '<option value="' + escapeHtml(item.id) + '" data-site-id="' + escapeHtml(siteId) + '" ' + sel + '>'
              + escapeHtml((site.name || '未命名站点') + ' · ' + item.id) + '</option>';
          });
          html += '</optgroup>';
        });
        return html || '<option value="">暂无可用模型</option>';
      };

      const setPrompts = function() {
        if (xmindCaseGenPromptEl) xmindCaseGenPromptEl.value = state.assignments.xmindCaseGenPrompt || defaultPrompts.xmindcasegen;
        if (caseFilterPromptEl) caseFilterPromptEl.value = state.assignments.caseFilterPrompt || defaultPrompts.casefilter;
        if (missingReminderPromptEl) missingReminderPromptEl.value = state.assignments.missingReminderPrompt || defaultPrompts.missingreminder;
        if (caseLibraryGenPromptEl) caseLibraryGenPromptEl.value = state.assignments.caseLibraryGenPrompt || defaultPrompts.caselibrarygen;
      };

      const refreshReasoning = function() {
        ['xmindcasegen', 'casefilter', 'missingreminder', 'caselibrarygen'].forEach(updateReasoningVisibility);
      };

      if (!state.models.length) {
        const placeholder = '<option value="">暂无可用模型</option>';
        if (xmindCaseGenModelSelect) xmindCaseGenModelSelect.innerHTML = placeholder;
        if (caseFilterModelSelect) caseFilterModelSelect.innerHTML = placeholder;
        if (missingReminderModelSelect) missingReminderModelSelect.innerHTML = placeholder;
        if (caseLibraryGenModelSelect) caseLibraryGenModelSelect.innerHTML = placeholder;
        if (globalAssignModelSelect) globalAssignModelSelect.innerHTML = placeholder;
        state.assignments.xmindCaseGenId = '';
        state.assignments.caseFilterId = '';
        state.assignments.missingReminderId = '';
        state.assignments.caseLibraryGenId = '';
        state.assignments.xmindCaseGenModelId = '';
        state.assignments.caseFilterModelId = '';
        state.assignments.missingReminderModelId = '';
        state.assignments.caseLibraryGenModelId = '';
        setPrompts();
        refreshReasoning();
        updateAssignmentStatuses();
        return;
      }

      const resolveSel = function(siteId, modelId) {
        return { siteId: siteId || '', modelId: modelId || '' };
      };
      const xm = resolveSel(state.assignments.xmindCaseGenId, state.assignments.xmindCaseGenModelId);
      const cf = resolveSel(state.assignments.caseFilterId, state.assignments.caseFilterModelId);
      const mr = resolveSel(state.assignments.missingReminderId, state.assignments.missingReminderModelId);
      const cl = resolveSel(state.assignments.caseLibraryGenId, state.assignments.caseLibraryGenModelId);

      if (xmindCaseGenModelSelect) xmindCaseGenModelSelect.innerHTML = buildOptions(xm.siteId, xm.modelId, true);
      if (caseFilterModelSelect) caseFilterModelSelect.innerHTML = buildOptions(cf.siteId, cf.modelId, true);
      if (missingReminderModelSelect) missingReminderModelSelect.innerHTML = buildOptions(mr.siteId, mr.modelId, true);
      if (caseLibraryGenModelSelect) caseLibraryGenModelSelect.innerHTML = buildOptions(cl.siteId, cl.modelId, true);

      // 回写当前下拉实际选中的站点+模型；没有明确选择时保持为空。
      const applySelected = function(selectEl, idKey) {
        if (!selectEl) return;
        const option = selectEl.selectedOptions && selectEl.selectedOptions[0] ? selectEl.selectedOptions[0] : null;
        state.assignments[idKey] = option ? (option.getAttribute('data-site-id') || '') : '';
        state.assignments[idKey.replace(/Id$/, 'ModelId')] = selectEl.value || '';
      };
      applySelected(xmindCaseGenModelSelect, 'xmindCaseGenId');
      applySelected(caseFilterModelSelect, 'caseFilterId');
      applySelected(missingReminderModelSelect, 'missingReminderId');
      applySelected(caseLibraryGenModelSelect, 'caseLibraryGenId');

      if (globalAssignModelSelect) {
        let unifiedSite = '';
        let unifiedModel = '';
        let mismatch = false;
        assignmentIdKeys.forEach(function(idKey) {
          const siteId = state.assignments[idKey] || '';
          const modelId = state.assignments[idKey.replace(/Id$/, 'ModelId')] || '';
          if (!siteId || !modelId) {
            mismatch = true;
            return;
          }
          if (!unifiedSite) {
            unifiedSite = siteId;
            unifiedModel = modelId;
          } else if (unifiedSite !== siteId || unifiedModel !== modelId) {
            mismatch = true;
          }
        });
        globalAssignModelSelect.innerHTML = buildOptions(mismatch ? '' : unifiedSite, mismatch ? '' : unifiedModel, true);
      }
      setPrompts();
      refreshReasoning();
      updateAssignmentStatuses();
    }

    function updateAssignmentStatuses() {
      const resolve = function(siteId, modelId) {
        return siteId ? resolveSiteModel(siteId, modelId) : null;
      };
      const xm = resolve(state.assignments.xmindCaseGenId, state.assignments.xmindCaseGenModelId);
      const cf = resolve(state.assignments.caseFilterId, state.assignments.caseFilterModelId);
      const mr = resolve(state.assignments.missingReminderId, state.assignments.missingReminderModelId);
      const cl = resolve(state.assignments.caseLibraryGenId, state.assignments.caseLibraryGenModelId);
      setStatus(xmindCaseGenAssignStatus, xm ? `当前 XMind 用例生成模型：${xm.name} / ${xm.model}` : '尚未指派 XMind 用例生成模型', xm ? 'ok' : 'warn');
      setStatus(caseFilterAssignStatus, cf ? `当前用例相似对比模型：${cf.name} / ${cf.model}` : '尚未指派用例相似对比模型', cf ? 'ok' : 'warn');
      setStatus(missingReminderAssignStatus, mr ? `当前易漏用例推荐模型：${mr.name} / ${mr.model}` : '尚未指派易漏用例推荐模型', mr ? 'ok' : 'warn');
      setStatus(caseLibraryGenAssignStatus, cl ? `当前用例库生成模型：${cl.name} / ${cl.model}` : '尚未指派用例库生成模型', cl ? 'ok' : 'warn');
      updateTabNotices();
    }

    function getModelById(id) {
      return findModelByAnyId(id);
    }

    const reasoningKeys = {
      xmindcasegen: 'xmindCaseGenReasoning',
      casefilter: 'caseFilterReasoning',
      missingreminder: 'missingReminderReasoning',
      caselibrarygen: 'caseLibraryGenReasoning',
    };

    function normalizeAssignmentType(type) {
      return type === 'casegen' ? 'xmindcasegen' : type;
    }

    function getAssignmentKeyPrefix(type) {
      const normalizedType = normalizeAssignmentType(type);
      if (normalizedType === 'xmindcasegen') return 'xmindCaseGen';
      if (normalizedType === 'casefilter') return 'caseFilter';
      if (normalizedType === 'missingreminder') return 'missingReminder';
      if (normalizedType === 'caselibrarygen') return 'caseLibraryGen';
      return '';
    }

    function getAssignmentReasoningSelect(type) {
      const normalizedType = normalizeAssignmentType(type);
      if (normalizedType === 'xmindcasegen') return xmindCaseGenReasoningSelect;
      if (normalizedType === 'casefilter') return caseFilterReasoningSelect;
      if (normalizedType === 'missingreminder') return missingReminderReasoningSelect;
      if (normalizedType === 'caselibrarygen') return caseLibraryGenReasoningSelect;
      return null;
    }

    function updateReasoningVisibility(type) {
      const prefix = getAssignmentKeyPrefix(type);
      if (!prefix) return;
      const normalizedType = normalizeAssignmentType(type);
      const select = getAssignmentReasoningSelect(type);
      if (select) select.value = state.assignments[reasoningKeys[normalizedType]] || '';
      const siteId = state.assignments[`${prefix}Id`] || '';
      const modelId = state.assignments[`${prefix}ModelId`] || '';
      const model = siteId ? resolveSiteModel(siteId, modelId) : null;
      populateReasoningSelect(select, model);
    }

    function getReasoningForType(type) {
      const normalizedType = type === 'casegen' ? 'xmindcasegen' : type;
      return state.assignments[reasoningKeys[normalizedType]] || '';
    }

    function getTemperatureForType() {
      return 0.2;
    }

    function getAssignedModel(type) {
      const prefix = getAssignmentKeyPrefix(type);
      const labels = {
        xmindcasegen: 'XMind 用例生成',
        casegen: 'XMind 用例生成',
        casefilter: '用例相似对比',
        missingreminder: '易漏用例推荐',
        caselibrarygen: '用例库/执行页生成',
      };
      if (!prefix) throw new Error('不支持的功能指派类型：' + String(type || ''));
      const siteId = state.assignments[`${prefix}Id`];
      const modelId = state.assignments[`${prefix}ModelId`];
      const model = resolveSiteModel(siteId, modelId);
      if (!model || !model.model) throw new Error(`未找到${labels[type] || 'AI 功能'}模型，请先在功能指派中选择`);
      return model;
    }

    function updateTabNotices() {
      const hasModels = Array.isArray(state.models) && state.models.length > 0;
      const hasSavedAssignments = state.hasSavedAssignments !== undefined
        ? state.hasSavedAssignments
        : Boolean(localStorage.getItem(assignmentKey));
      const assignedAll = requiredAssignmentKeys.every(function(key) {
        const assignedId = state.assignments[key];
        const modelId = state.assignments[key.replace(/Id$/, 'ModelId')];
        return Boolean(assignedId && modelId && resolveSiteModel(assignedId, modelId));
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

    function normalizeHttpErrorBody(raw) {
      var text = raw === undefined || raw === null ? '' : String(raw).trim();
      if (!text) return '';
      try {
        var parsed = JSON.parse(text);
        if (parsed && parsed.error) {
          if (typeof parsed.error === 'string' && parsed.error) return parsed.error;
          if (typeof parsed.error.message === 'string' && parsed.error.message) return parsed.error.message;
          if (typeof parsed.error.code === 'string' && parsed.error.code) return parsed.error.code;
        }
        if (parsed && typeof parsed.detail === 'string' && parsed.detail) return parsed.detail;
        if (parsed && typeof parsed.message === 'string' && parsed.message) return parsed.message;
      } catch (err) {
        // ignore
      }
      return text;
    }

    function isTransientFetchError(err) {
      if (!err || err.name === 'AbortError') return false;
      var msg = err && err.message ? String(err.message) : String(err || '');
      if (!msg) return false;
      var lower = msg.toLowerCase();
      if (lower.indexOf('failed to fetch') !== -1) return true;
      if (lower.indexOf('networkerror') !== -1) return true;
      if (lower.indexOf('network request failed') !== -1) return true;
      if (lower.indexOf('load failed') !== -1) return true;
      return false;
    }

    function looksLikeHtmlDocumentText(text) {
      if (text === null || text === undefined) return false;
      var trimmed = String(text).trim().toLowerCase();
      if (!trimmed) return false;
      if (trimmed.indexOf('<!doctype html') === 0) return true;
      if (trimmed.indexOf('<html') === 0) return true;
      if (trimmed.indexOf('<head') === 0) return true;
      if (trimmed.indexOf('<body') === 0) return true;
      return trimmed.indexOf('</html>') !== -1 && trimmed.indexOf('<title') !== -1;
    }

    function extractHtmlTitleText(text) {
      if (text === null || text === undefined) return '';
      var match = String(text).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (!match || !match[1]) return '';
      return String(match[1]).replace(/\s+/g, ' ').trim();
    }

    async function testModel(id, statusEl, siteId) {
      var selectedSiteId = siteId === undefined || siteId === null ? '' : String(siteId).trim();
      var resolvedSiteId = selectedSiteId || resolveSiteIdByModelId(id);
      const model = resolveSiteModel(resolvedSiteId, id);
      if (!model || !model.model) {
        setStatus(statusEl, '未选择模型', 'warn');
        return;
      }
      setStatus(statusEl, '正在测试模型...', '');
      try {
        var baseUrl = model && model.baseUrl ? String(model.baseUrl).toLowerCase() : '';
        var modelId = model && model.model ? String(model.model).toLowerCase() : '';
        var provider = model && model.provider ? String(model.provider).toLowerCase() : '';
        var useStream = normalizeModelStream(model && (model.stream !== undefined ? model.stream : model.streamMode));
        var isClaudeLike = provider === 'claude' || provider === 'anthropic' || modelId.indexOf('claude') !== -1;
        var useClaudeCompat = isClaudeLike && /\/responses(?:\?|$)/i.test(baseUrl);
        var requestUrl = useClaudeCompat
          ? String(model.baseUrl || '').replace(/\/responses(\?|$)/i, '/chat/completions$1')
          : String(model.baseUrl || '');
        requestUrl = normalizeModelRequestUrl(requestUrl, model);
        var isResponsesApi = !useClaudeCompat && /\/responses(?:\?|$)/i.test(requestUrl);
        const body = isResponsesApi
          ? {
            model: model.model,
            stream: useStream,
            input: [
              {
                role: 'user',
                content: [
                  { type: 'input_text', text: 'ping' },
                ],
              },
            ],
          }
          : {
            model: model.model,
            messages: [{ role: 'user', content: 'ping' }],
            stream: useStream,
          };
        const proxyFn = api && typeof api.proxyModelRequest === 'function'
          ? api.proxyModelRequest
          : null;
        let res;
        let proxyError = null;
        let proxyFallbackResponse = null;
        if (proxyFn) {
          try {
            res = await proxyFn({
              base_url: requestUrl,
              api_key: model.apiKey || '',
              payload: body,
              timeout_sec: 30,
            });
            var statusCode = res ? Number(res.status) : 0;
            var canFallback = res && [401, 403, 404, 405, 501].indexOf(statusCode) !== -1;
            if (canFallback) {
              proxyFallbackResponse = res;
              res = null;
            }
          } catch (e) {
            proxyError = e;
            res = null;
          }
        }
        if (!res) {
          const headers = { 'Content-Type': 'application/json' };
          if (model.apiKey) headers['Authorization'] = `Bearer ${model.apiKey}`;
          try {
            res = await fetch(requestUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            });
          } catch (err) {
            if (proxyFallbackResponse && isTransientFetchError(err)) {
              res = proxyFallbackResponse;
            } else if (proxyError && isTransientFetchError(err)) {
              throw proxyError;
            } else {
              throw err;
            }
          }
        }
        const raw = await res.text();
        if (!res.ok) {
          const detailText = normalizeHttpErrorBody(raw);
          const detail = detailText ? ('：' + detailText.slice(0, 200)) : '';
          throw new Error(`HTTP ${res.status}${detail}`);
        }
        if (looksLikeHtmlDocumentText(raw)) {
          var htmlTitle = extractHtmlTitleText(raw);
          var titleText = htmlTitle ? ('（页面标题：' + htmlTitle + '）') : '';
          setStatus(statusEl, '测试失败：接口返回 HTML 页面' + titleText + '，请检查接口地址是否为实际 API 地址', 'err');
          return;
        }
        let data = null;
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (e) {
            data = null;
          }
        }
        const hasChoices = data && data.choices && data.choices.length;
        const hasOutput = data && data.output && data.output.length;
        const ok = hasChoices || hasOutput || (data && data.output_text) || (data && data.data) || (raw && raw.trim());
        setStatus(statusEl, ok ? '测试成功，模型可用' : '连接成功但返回为空，请检查返回格式', ok ? 'ok' : 'warn');
      } catch (err) {
        console.error(err);
        setStatus(statusEl, `测试失败：${err.message || err}`, 'err');
      }
    }

    // ---- 模型列表自动发现（OpenAI 兼容 /models） ----

    const MAX_MODEL_LISTING_BYTES = 4 * 1024 * 1024;

    function listingLabel() {
      for (let i = 0; i < arguments.length; i += 1) {
        const candidate = arguments[i];
        if (typeof candidate === 'string' && candidate.length > 0) return candidate;
      }
      return '';
    }

    function listingCapacity() {
      for (let i = 0; i < arguments.length; i += 1) {
        const candidate = arguments[i];
        if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0) return candidate;
      }
      return undefined;
    }

    // 把用户填的接口地址规约成列表地址：去掉尾部斜杠后拼 /models，
    // 同时兼容填了完整 /chat/completions 或 /responses 路径的情况。
    function deriveModelListingUrl(baseUrl) {
      let url = String(baseUrl || '').trim();
      if (!url) return '';
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) url = url.slice(0, hashIndex);
      url = url
        .replace(/\/chat\/completions$/i, '')
        .replace(/\/completions$/i, '')
        .replace(/\/responses$/i, '')
        .replace(/\/chat$/i, '');
      url = url.replace(/\/+$/, '');
      return url + '/models';
    }

    // 把接口地址规约成实际请求地址：字段语义是「API 根地址」，请求时统一补端点路径。
    // GPT-5 推理模型的裸地址默认使用 Responses API，其它模型默认使用 Chat Completions。
    function normalizeModelRequestUrl(baseUrl, model) {
      let url = String(baseUrl || '').trim();
      if (!url) return url;
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) url = url.slice(0, hashIndex);
      let query = '';
      const qIndex = url.indexOf('?');
      if (qIndex !== -1) {
        query = url.slice(qIndex);
        url = url.slice(0, qIndex);
      }
      url = url.replace(/\/+$/, '');
      const isFull = /\/chat\/completions$/i.test(url)
        || /\/completions$/i.test(url)
        || /\/responses$/i.test(url)
        || /\/chat$/i.test(url)
        || /\/models$/i.test(url);
      if (!isFull) {
        if (url) {
          const modelId = model && model.model ? String(model.model).trim().toLowerCase() : '';
          const prefersResponses = modelId.indexOf('gpt-5') === 0 && modelId.indexOf('chat') === -1;
          if (prefersResponses) {
            url += /\/v1$/i.test(url) ? '/responses' : '/v1/responses';
          } else {
            url += '/chat/completions';
          }
        }
      }
      return url + query;
    }

    // 把接口地址规约成可持久化的地址；显式完整端点需要保留，避免改变调用协议。
    function toBaseUrlRoot(rawUrl) {
      let url = String(rawUrl || '').trim();
      if (!url) return url;
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) url = url.slice(0, hashIndex);
      let query = '';
      const qIndex = url.indexOf('?');
      if (qIndex !== -1) {
        query = url.slice(qIndex);
        url = url.slice(0, qIndex);
      }
      if (/\/chat\/completions$/i.test(url)
        || /\/completions$/i.test(url)
        || /\/responses$/i.test(url)) {
        return url + query;
      }
      url = url
        .replace(/\/chat\/completions$/i, '')
        .replace(/\/completions$/i, '')
        .replace(/\/chat$/i, '')
        .replace(/\/models$/i, '');
      url = url.replace(/\/+$/, '');
      return url + query;
    }

    function parseModelListing(raw) {
      let body = null;
      try {
        body = JSON.parse(raw);
      } catch (err) {
        throw new Error('接口未返回 JSON，无法读取模型列表，请确认接口地址为 OpenAI 兼容网关');
      }
      const data = body && body.data;
      if (!Array.isArray(data)) {
        throw new Error('接口返回中没有 data 数组，无法读取模型列表');
      }
      const models = [];
      data.forEach(function(entry) {
        const item = entry && typeof entry === 'object' ? entry : {};
        const id = listingLabel(item.id);
        if (!id) return;
        const model = {
          id: id,
          name: listingLabel(item.name, item.display_name) || id,
          contextWindow: listingCapacity(item.context_window, item.context_length),
        };
        const capabilities = getDeclaredModelCapabilities(item);
        if (capabilities !== null) model.capabilities = capabilities;
        models.push(model);
      });
      return models;
    }

    function guessModelCapabilities(modelId, name) {
      const haystack = String((modelId || '') + ' ' + (name || '')).toLowerCase();
      const caps = ['chat'];
      const has = function(marker) { return haystack.indexOf(marker) !== -1; };
      const vision = has('vision') || has('multimodal') || has('gpt-4o') || has('gpt-4.1') || has('gpt-5') || has('grok-4') || has('claude-3.5') || has('claude-3.7') || has('claude-4') || has('gemini') || has('qvq') || has('qwen-vl') || has('glm-4v') || has('vl-');
      const reasoning = has('reasoner') || has('reasoning') || has('deepseek-r1') || has('qwq') || has('thinking') || has('gpt-5') || has('grok-3') || has('grok-4');
      if (vision) caps.push('vision');
      if (reasoning) caps.push('reasoning');
      return caps;
    }

    function renderAvailableModels() {
      if (!modelAvailableList) return;
      if (!draftAvailableModels.length) {
        modelAvailableList.innerHTML = '<p class="hint">尚未获取模型。</p>';
        return;
      }
      modelAvailableList.innerHTML = draftAvailableModels.map(function(item, index) {
        const extra = [];
        if (item.contextWindow) extra.push('上下文 ' + item.contextWindow);
        return '<span class="model-id-chip" title="点击 × 移除">'
          + escapeHtml(item.id)
          + (extra.length ? '<em>' + escapeHtml(extra.join(' · ')) + '</em>' : '')
          + '<button type="button" class="model-id-chip-remove" data-remove-model="' + index + '" aria-label="移除">×</button>'
          + '</span>';
      }).join('');
      modelAvailableList.querySelectorAll('[data-remove-model]').forEach(function(node) {
        node.addEventListener('click', function() {
          const idx = Number(node.getAttribute('data-remove-model'));
          removeDraftModelAt(idx);
        });
      });
    }

    function removeDraftModelAt(index) {
      if (!Number.isInteger(index)) return;
      draftAvailableModels = draftAvailableModels.filter(function(_item, i) { return i !== index; });
      renderAvailableModels();
    }

    function addDraftModelId(rawId) {
      const id = String(rawId || '').trim();
      if (!id) {
        setStatus(modelListFetchStatus, '请输入模型 ID', 'warn');
        return;
      }
      const exists = draftAvailableModels.some(function(item) { return String(item.id).toLowerCase() === id.toLowerCase(); });
      if (exists) {
        setStatus(modelListFetchStatus, '模型 "' + id + '" 已在列表中', 'warn');
        return;
      }
      draftAvailableModels.push({ id: id, name: id, contextWindow: undefined });
      renderAvailableModels();
      if (modelIdentifierEl) modelIdentifierEl.value = '';
    }

    async function fetchModelList() {
      const baseUrl = modelBaseUrlEl ? modelBaseUrlEl.value.trim() : '';
      const apiKey = modelApiKeyEl ? modelApiKeyEl.value.trim() : '';
      if (!baseUrl) {
        setStatus(modelListFetchStatus, '请先填写接口地址', 'warn');
        return;
      }
      const listingUrl = deriveModelListingUrl(baseUrl);
      setStatus(modelListFetchStatus, '正在获取模型列表...', '');
      if (fetchModelListBtn) fetchModelListBtn.disabled = true;
      try {
        const proxyFn = api && typeof api.proxyModelListing === 'function' ? api.proxyModelListing : null;
        let res = null;
        let proxyError = null;
        if (proxyFn) {
          try {
            res = await proxyFn({ base_url: listingUrl, api_key: apiKey, timeout_sec: 30 });
            const statusCode = res ? Number(res.status) : 0;
            const canFallback = res && [401, 403, 404, 405, 501].indexOf(statusCode) !== -1;
            if (canFallback) res = null;
          } catch (err) {
            proxyError = err;
            res = null;
          }
        }
        if (!res) {
          const headers = { 'Accept': 'application/json' };
          if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
          try {
            res = await fetch(listingUrl, { method: 'GET', headers: headers });
          } catch (err) {
            if (proxyError && isTransientFetchError(err)) throw proxyError;
            throw err;
          }
        }
        const raw = await res.text();
        if (String(raw || '').length > MAX_MODEL_LISTING_BYTES) {
          throw new Error('模型列表返回过大，已中止读取');
        }
        if (!res.ok) {
          const detail = normalizeHttpErrorBody(raw);
          const detailMsg = detail ? ('：' + detail.slice(0, 200)) : '';
          throw new Error('HTTP ' + res.status + detailMsg);
        }
        const candidates = parseModelListing(raw);
        if (!candidates.length) {
          setStatus(modelListFetchStatus, '该端点没有返回可用模型，请检查接口地址或改为手工添加', 'warn');
          return;
        }
        draftAvailableModels = normalizeAvailableModels(candidates);
        renderAvailableModels();
        setStatus(modelListFetchStatus, '已获取 ' + draftAvailableModels.length + ' 个模型，保存后生效', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(modelListFetchStatus, '获取失败：' + (err && err.message ? err.message : err), 'err');
      } finally {
        if (fetchModelListBtn) fetchModelListBtn.disabled = false;
      }
    }

    if (modelProviderEl) {
      modelProviderEl.addEventListener('change', () => {
        applyProviderPreset(modelProviderEl, modelBaseUrlEl);
      });
    }
    if (modelIdentifierEl) {
      modelIdentifierEl.addEventListener('keydown', (event) => {
        if (event && event.key === 'Enter') {
          event.preventDefault();
          addDraftModelId(modelIdentifierEl.value);
        }
      });
    }
    if (addModelIdBtn) {
      addModelIdBtn.addEventListener('click', () => addDraftModelId(modelIdentifierEl ? modelIdentifierEl.value : ''));
    }
    if (createModelBtn) {
      createModelBtn.addEventListener('click', () => {
        restoreModelFormHome();
        if (modelFormTitle) modelFormTitle.textContent = '新增站点';
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
    if (fetchModelListBtn) {
      fetchModelListBtn.addEventListener('click', fetchModelList);
    }
    loadModels();
    loadAssignments();
    renderModels();
    renderAssignmentsSelect();
    updateAssignmentStatuses();
    pullModelsFromServer();
    pullAssignmentsFromServer();
    bindAuthReady();
    bindModelRefresh();

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
      resolveSiteModel,
      buildReasoningOptionsHtml,
      refreshModels: pullModelsFromServer,
      refreshAssignments: refreshAssignmentsFromServer,
    };
  }

  window.app.models = { init };
})();
