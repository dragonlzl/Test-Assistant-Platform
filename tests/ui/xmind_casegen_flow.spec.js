const { test, expect } = require('@playwright/test');

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+bB9sAAAAASUVORK5CYII=',
  'base64'
);

async function gotoCasesgenWorkflow(page, options) {
  const opts = options || {};
  if (opts.resetWorkflowStorage !== false) {
    await page.addInitScript((payload) => {
      try {
        if (typeof sessionStorage === 'undefined') return;
        var onceKey = String(payload && payload.onceKey ? payload.onceKey : '__pw-workflow-reset-once');
        if (sessionStorage.getItem(onceKey) === '1') return;
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(String(payload && payload.workflowKey ? payload.workflowKey : 'usecase-workflow-state-v1'));
        }
        sessionStorage.removeItem(String(payload && payload.activeTabKey ? payload.activeTabKey : 'usecase-active-tab'));
        sessionStorage.setItem(onceKey, '1');
      } catch (_) {}
    }, {
      workflowKey: 'usecase-workflow-state-v1',
      activeTabKey: 'usecase-active-tab',
      onceKey: '__pw-workflow-reset-once',
    });
  }
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/ai-workflow.html?tab=casesgen&_=' + Date.now().toString(36);
  await page.goto(url);
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  await page.waitForFunction(() => {
    var api = window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
    var globalObj = null;
    if (typeof MindElixir !== 'undefined') globalObj = MindElixir;
    else if (window && window.MindElixir) globalObj = window.MindElixir;
    var hasCtor = typeof globalObj === 'function' || Boolean(globalObj && typeof globalObj.default === 'function');
    return Boolean(api && typeof api.renderMindMap === 'function' && hasCtor);
  }, {}, { timeout: 20000 });
  await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
  return url;
}

async function mockCaseGenApisWithModel(page, token, user, options) {
  const opts = options || {};
  const modelRemoteId = opts.modelRemoteId || 901;
  const featureId = opts.featureId || 5001;
  const caseGenPrompt = opts.caseGenPrompt || '普通用例提示词';
  const xmindCaseGenPrompt = opts.xmindCaseGenPrompt || '基础提示词-XMind页';
  const modelBaseUrl = opts.modelBaseUrl || 'https://mock-model.local/v1/chat/completions';
  const modelName = opts.modelName || 'mock-model';
  const modelCapabilities = Array.isArray(opts.modelCapabilities) ? opts.modelCapabilities.slice() : [];
  const extraModels = Array.isArray(opts.extraModels) ? opts.extraModels.slice() : [];
  const modelId = String(modelRemoteId);
  const projects = Array.isArray(opts.projects) ? opts.projects : [];
  const versionsByProject = opts.versionsByProject && typeof opts.versionsByProject === 'object'
    ? opts.versionsByProject
    : {};
  const caseFilesByProject = opts.caseFilesByProject && typeof opts.caseFilesByProject === 'object'
    ? opts.caseFilesByProject
    : {};
  const caseItemsByCaseFile = opts.caseItemsByCaseFile && typeof opts.caseItemsByCaseFile === 'object'
    ? opts.caseItemsByCaseFile
    : {};

  await page.addInitScript((tk) => {
    try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
  }, token);

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;
    const method = route.request().method();
    const tokenHeader = route.request().headers().authorization || '';
    const authed = tokenHeader === `Bearer ${token}`;
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathName === '/api/users/me' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, user);
    }
    if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
    if (/^\/api\/projects\/[^/]+\/versions$/.test(pathName) && method === 'GET') {
      const projectId = String(pathName.split('/')[3] || '');
      return respond(200, Array.isArray(versionsByProject[projectId]) ? versionsByProject[projectId] : []);
    }
    if (pathName === '/api/case-files' && method === 'GET') {
      const projectId = String(url.searchParams.get('project_id') || '');
      return respond(200, Array.isArray(caseFilesByProject[projectId]) ? caseFilesByProject[projectId] : []);
    }
    if (pathName === '/api/case-files/import' && method === 'POST') {
      const body = route.request().postDataJSON ? route.request().postDataJSON() : {};
      return respond(200, {
        id: 9201,
        file_name_clean: body && body.file_name ? String(body.file_name).replace(/\.xmind$/i, '') : 'XMind入库结果',
        project_id: body && body.project_id ? Number(body.project_id) : null,
        version_id: body && body.version_id ? Number(body.version_id) : null,
      });
    }
    if (/^\/api\/case-files\/\d+\/items$/.test(pathName) && method === 'GET') {
      const caseFileId = String(pathName.split('/')[3] || '');
      return respond(200, Array.isArray(caseItemsByCaseFile[caseFileId]) ? caseItemsByCaseFile[caseFileId] : []);
    }
    if (/^\/api\/case-files\/\d+\/items\/append$/.test(pathName) && method === 'POST') {
      return respond(200, { appended: 1, overwritten: 0, skipped: 0 });
    }
    if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
    if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
    if (pathName === '/api/models' && method === 'GET') {
      const baseModel = {
        id: modelRemoteId,
        name: 'MockXmindCaseGenModel',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          provider: 'custom',
          baseUrl: modelBaseUrl,
          apiKey: 'mock-key',
          model: modelName,
          maxTokens: 1024,
          capabilities: modelCapabilities,
        },
      };
      return respond(200, [baseModel].concat(extraModels));
    }
    if (pathName === '/api/features' && method === 'GET') {
      return respond(200, [{
        id: featureId,
        name: 'default',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          caseGenId: modelId,
          caseGenPrompt: caseGenPrompt,
          xmindCaseGenId: modelId,
          xmindCaseGenPrompt: xmindCaseGenPrompt,
          xmindCaseGenReasoning: '',
          xmindCaseGenTemperature: 0.2,
        },
      }]);
    }
    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  });

  return { modelId: modelId };
}

async function installXmindProxyRecorder(page, options) {
  const input = options || {};
  const responseText = input.responseText || '{"modules":[]}';
  const status = Number(input.status || 200);
  await page.evaluate(({ responseText, status }) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client || typeof client.proxyModelRequest !== 'function') return;
    window.__xmindProxyCalls = [];
    client.proxyModelRequest = function(payload) {
      window.__xmindProxyCalls.push(JSON.parse(JSON.stringify(payload || {})));
      return Promise.resolve({
        ok: Number(status || 200) >= 200 && Number(status || 200) < 300,
        status: Number(status || 200),
        text: function() {
          return Promise.resolve(JSON.stringify({
            output: [{
              type: 'message',
              role: 'assistant',
              content: [{
                type: 'output_text',
                text: String(responseText || '{"modules":[]}'),
              }],
            }],
          }));
        },
      });
    };
  }, {
    responseText: String(responseText || '{"modules":[]}'),
    status: status,
  });
}

async function waitXmindModelAssigned(page, expectedModelId) {
  await page.waitForFunction((modelId) => {
    var state = window.app && window.app.state ? window.app.state : null;
    return Boolean(
      state &&
      state.assignments &&
      String(state.assignments.xmindCaseGenId || '') === String(modelId || '')
    );
  }, expectedModelId, { timeout: 10000 });
}

async function installXmindModelStub(page, delayMs) {
  await page.evaluate((delay) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    window.__xmindCasegenCalls = [];
    window.__xmindCasegenCounters = {};

    function flattenContent(content) {
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      return content.map(function(item) {
        if (!item || typeof item !== 'object') return '';
        if (item.type === 'text') return String(item.text || '');
        return '[image]';
      }).join('\n');
    }

    function parseJsonText(text) {
      var raw = String(text || '').trim();
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (err) {}
      var objStart = raw.indexOf('{');
      var objEnd = raw.lastIndexOf('}');
      if (objStart >= 0 && objEnd > objStart) {
        try {
          return JSON.parse(raw.slice(objStart, objEnd + 1));
        } catch (err2) {}
      }
      var arrStart = raw.indexOf('[');
      var arrEnd = raw.lastIndexOf(']');
      if (arrStart >= 0 && arrEnd > arrStart) {
        try {
          return JSON.parse(raw.slice(arrStart, arrEnd + 1));
        } catch (err3) {}
      }
      return null;
    }

    function extractSection(text, marker) {
      var source = String(text || '');
      var index = source.indexOf(marker);
      if (index === -1) return '';
      var rest = source.slice(index + marker.length);
      var next = rest.indexOf('\n\n【');
      if (next !== -1) rest = rest.slice(0, next);
      return String(rest || '').trim();
    }

    function nextCounter(key) {
      var map = window.__xmindCasegenCounters;
      var stableKey = String(key || 'default');
      map[stableKey] = Number(map[stableKey] || 0) + 1;
      return map[stableKey];
    }

    function makeCase(moduleName, title, index) {
      var order = Number(index) || 1;
      return {
        module: moduleName,
        title: title,
        priority: order % 2 === 0 ? 'P2' : 'P1',
        preconditions: moduleName + '前置条件',
        steps: [
          '1、进入' + moduleName,
          '2、执行' + title,
        ],
        expected: title + '执行成功',
      };
    }

    function makeModule(name, cases) {
      var list = Array.isArray(cases) ? cases : [];
      return {
        module: name,
        key_scenarios: [name + '主场景'],
        test_points: [name + '关键校验'],
        coupled_modules: [name + '关联模块'],
        cases: list,
      };
    }

    client.proxyModelRequest = function(payload, signal) {
      var modelPayload = payload && payload.payload ? payload.payload : {};
      var messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
      var promptText = flattenContent(messages[0] && messages[0].content);
      var userText = flattenContent(messages[1] && messages[1].content);
      var contract = parseJsonText(extractSection(userText, '【operation_contract(JSON)】'))
        || parseJsonText(extractSection(promptText, 'operation_contract(JSON)：'))
        || {};
      var visibleModules = parseJsonText(extractSection(userText, '【当前可见模块与用例(JSON)】'));
      var visibleList = Array.isArray(visibleModules) ? visibleModules : [];
      var firstVisibleModule = visibleList[0] && visibleList[0].module ? String(visibleList[0].module) : '登录模块';
      var targetModule = String(contract.targetModule || firstVisibleModule || '登录模块');
      var mode = String(contract.mode || '');
      var responseModules = [];

      if (mode === 'full_modules' || mode === 'regenerate_modules') {
        responseModules = [
          makeModule('登录模块'),
          makeModule('支付模块'),
        ];
      } else if (mode === 'full_cases') {
        responseModules = [
          makeModule('登录模块', [
            makeCase('登录模块', '登录成功校验', 1),
            makeCase('登录模块', '登录失败提示', 2),
          ]),
          makeModule('支付模块', [
            makeCase('支付模块', '支付成功校验', 1),
            makeCase('支付模块', '支付失败提示', 2),
          ]),
        ];
      } else if (mode === 'existing_modules_cases') {
        responseModules = visibleList.map(function(item, index) {
          var moduleName = item && item.module ? String(item.module) : ('模块' + String(index + 1));
          return makeModule(moduleName, [
            makeCase(moduleName, moduleName + '-补全用例', 1),
          ]);
        });
      } else if (mode === 'topup_modules') {
        responseModules = [makeModule('消息模块')];
      } else if (mode === 'topup_modules_cases') {
        responseModules = [
          makeModule('技能按钮与界面状态', [
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-1', 1),
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-2', 2),
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-3', 3),
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-4', 4),
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-5', 5),
          ]),
          makeModule('异常状态与边界处理', [
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-1', 1),
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-2', 2),
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-3', 3),
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-4', 4),
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-5', 5),
          ]),
        ];
      } else if (mode === 'append_all_modules_cases') {
        var appendIndex = nextCounter('root:' + firstVisibleModule);
        responseModules = [
          makeModule(firstVisibleModule, [
            makeCase(firstVisibleModule, firstVisibleModule + '-追加-' + appendIndex, 1),
          ]),
          makeModule('消息模块', [
            makeCase('消息模块', '消息模块新增用例', 1),
          ]),
        ];
      } else if (mode === 'module_append_cases') {
        var moduleAppendIndex = nextCounter('module:' + targetModule);
        responseModules = [
          makeModule(targetModule, [
            makeCase(targetModule, targetModule + '-追加-' + moduleAppendIndex, 1),
          ]),
        ];
      } else {
        responseModules = [
          makeModule(targetModule, [
            makeCase(targetModule, targetModule + '-完整-1', 1),
            makeCase(targetModule, targetModule + '-完整-2', 2),
          ]),
        ];
      }

      window.__xmindCasegenCalls.push({
        prompt: promptText,
        user: userText,
        contract: contract,
        responseModules: responseModules,
      });

      var content = JSON.stringify({ modules: responseModules });
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          resolve({
            ok: true,
            status: 200,
            text: function() {
              return Promise.resolve(JSON.stringify({
                choices: [{ message: { content: content } }],
              }));
            },
          });
        }, Number(delay) || 120);
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', function() {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    };
  }, delayMs || 120);
}

async function installRawXmindModelResponse(page, contentText, delayMs) {
  await page.evaluate(({ rawContent, delay }) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    client.proxyModelRequest = function(payload, signal) {
      var content = String(rawContent || '');
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          resolve({
            ok: true,
            status: 200,
            text: function() {
              return Promise.resolve(JSON.stringify({
                choices: [{ message: { content: content } }],
              }));
            },
          });
        }, Number(delay) || 120);
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', function() {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    };
  }, {
    rawContent: contentText,
    delay: delayMs || 120,
  });
}

async function installRejectedXmindModelResponse(page, messageText, delayMs) {
  await page.evaluate(({ message, delay }) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    client.proxyModelRequest = function(payload, signal) {
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          reject(new Error(String(message || '503 Service Unavailable')));
        }, Number(delay) || 120);
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', function() {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    };
  }, {
    message: messageText,
    delay: delayMs || 120,
  });
}

async function installXmindProxyHttpError(page, options) {
  const input = options || {};
  const status = Number(input.status || 503);
  const rawBody = input.rawBody || JSON.stringify({ detail: '连接模型服务失败：上游服务暂时不可用' });
  await page.evaluate(({ status, rawBody }) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    client.proxyModelRequest = function() {
      return Promise.resolve({
        ok: Number(status) >= 200 && Number(status) < 300,
        status: Number(status),
        text: function() {
          return Promise.resolve(String(rawBody || ''));
        },
      });
    };
  }, {
    status: status,
    rawBody: String(rawBody || ''),
  });
}

async function seedDocumentRequirement(page, options) {
  const input = options || {};
  const text = input.text || '这是用于验证 XMind 用例生成的需求说明。';
  const requirementLabel = input.requirementLabel || 'XMind规则重构需求';
  await page.evaluate((payload) => {
    var rawTextEl = document.getElementById('rawText');
    if (rawTextEl) {
      rawTextEl.removeAttribute('readonly');
      rawTextEl.value = payload.text;
      rawTextEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.requirementLabel = payload.requirementLabel;
      window.app.state.requirementLabelSource = 'ui-test';
      window.app.state.lastRawImportName = 'xmind-requirement.docx';
      var docxImages = [];
      var imageCount = Number(payload.imageCount || 0);
      if (imageCount > 0 && payload.imageBytes && Array.isArray(payload.imageBytes)) {
        for (var i = 0; i < imageCount; i += 1) {
          var bytes = new Uint8Array(payload.imageBytes);
          var file = new File([bytes], 'xmind-requirement-image-' + (i + 1) + '.png', { type: 'image/png' });
          docxImages.push({
            index: i + 1,
            blob: file,
          });
        }
      }
      window.app.state.requirementMedia = {
        docxImages: docxImages,
        pastedImages: [],
        lastDocxImageCount: docxImages.length,
        updatedAt: Date.now(),
      };
    }
  }, {
    text: text,
    requirementLabel: requirementLabel,
    imageCount: Number(input.imageCount || 0),
    imageBytes: Array.from(input.imageBytes || []),
  });
}

async function seedImportedBaseline(page, list) {
  const input = list && typeof list === 'object' && !Array.isArray(list) ? list : { list };
  const baseline = Array.isArray(input.list) && input.list.length ? input.list : [{
    module: '登录模块',
    title: '登录模块-基线用例',
    priority: 'P1',
    preconditions: '账号已存在',
    steps: ['1、进入登录页', '2、输入账号密码'],
    expected: '登录成功',
  }];
  await page.evaluate((payload) => {
    var caseTextEl = document.getElementById('caseText');
    var text = JSON.stringify(payload.list, null, 2);
    if (caseTextEl) {
      caseTextEl.removeAttribute('readonly');
      caseTextEl.value = text;
      caseTextEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.importedCases = [{
        name: 'baseline.json',
        text: text,
        list: payload.list,
        meta: payload.meta || null,
      }];
    }
  }, {
    list: baseline,
    meta: input.meta || null,
  });
}

async function seedAiSkeleton(page, modules) {
  const list = Array.isArray(modules) && modules.length ? modules : [{
    id: 'xmind-mod-login',
    title: '登录模块',
    scenarios: ['登录主场景'],
    points: ['账号密码校验'],
    coupled: ['用户中心'],
  }];
  await page.evaluate((payload) => {
    if (!window.app || !window.app.state) return;
    window.app.state.caseGenModules = payload.modules.slice();
    window.app.state.caseGenResults = {};
    window.app.state.caseSelections = {};
    window.app.state.caseGenSuggestions = {};
    window.app.state.caseGenModuleStatus = {};
    window.app.state.caseGenProgress = {};
    window.app.state.caseGenTiming = {};
    if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
      window.app.casesGenApi.renderCaseGeneration();
    }
  }, { modules: list });
}

async function seedAiCases(page, casesByModuleId) {
  const payload = casesByModuleId && typeof casesByModuleId === 'object' ? casesByModuleId : {};
  await page.evaluate((input) => {
    if (!window.app || !window.app.state) return;
    var nextResults = {};
    Object.keys(input || {}).forEach(function(moduleId) {
      nextResults[moduleId] = JSON.stringify(input[moduleId] || [], null, 2);
    });
    window.app.state.caseGenResults = nextResults;
    if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
      window.app.casesGenApi.renderCaseGeneration();
    }
  }, payload);
}

async function seedPrepState(page, options) {
  const input = options || {};
  await page.evaluate((payload) => {
    if (!window.app || !window.app.state) return;
    window.app.state.xmindCaseGen = window.app.state.xmindCaseGen || {};
    window.app.state.xmindCaseGen.prep = {
      step: Number(payload.step) || 3,
      requirementMode: payload.requirementMode || 'document',
      requirementSupplement: payload.requirementSupplement || '',
      manualRequirementBlocks: Array.isArray(payload.manualRequirementBlocks) ? payload.manualRequirementBlocks.slice() : [],
      caseImportMode: payload.caseImportMode || 'skip',
      completed: payload.completed === true,
    };
  }, {
    step: input.step === undefined ? 3 : input.step,
    requirementMode: input.requirementMode || 'document',
    requirementSupplement: input.requirementSupplement || '',
    manualRequirementBlocks: input.manualRequirementBlocks || [],
    caseImportMode: input.caseImportMode || 'skip',
    completed: input.completed !== false,
  });
}

async function clickElementById(page, id) {
  await page.evaluate((targetId) => {
    var el = document.getElementById(targetId);
    if (el && typeof el.click === 'function') el.click();
  }, id);
}

async function dispatchFileDropToZone(page, zoneId, options) {
  const input = options || {};
  await page.evaluate((payload) => {
    var zone = document.getElementById(payload.zoneId);
    if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
    var dt = new DataTransfer();
    var list = Array.isArray(payload.files) ? payload.files : [];
    list.forEach(function(item) {
      if (!item) return;
      dt.items.add(new File([String(item.text || '')], String(item.name || 'payload.txt'), {
        type: String(item.mimeType || 'text/plain'),
      }));
    });
    function dispatch(type) {
      var evt = null;
      if (typeof Event === 'function') {
        evt = new Event(type, { bubbles: true, cancelable: true });
      } else if (document && document.createEvent) {
        evt = document.createEvent('Event');
        evt.initEvent(type, true, true);
      }
      if (!evt) return;
      try {
        Object.defineProperty(evt, 'dataTransfer', { value: dt });
      } catch (_) {
        evt.dataTransfer = dt;
      }
      zone.dispatchEvent(evt);
    }
    dispatch('dragover');
    dispatch('drop');
  }, {
    zoneId: String(zoneId || ''),
    files: Array.isArray(input.files) ? input.files : [],
  });
}

async function openXmindCaseGenDrawer(page) {
  let drawerOpen = await page.evaluate(() => {
    var drawer = document.getElementById('xmindCaseGenDrawer');
    return Boolean(drawer && drawer.classList && drawer.classList.contains('open'));
  });
  if (!drawerOpen) {
    await page.waitForTimeout(260);
    drawerOpen = await page.evaluate(() => {
      var drawer = document.getElementById('xmindCaseGenDrawer');
      return Boolean(drawer && drawer.classList && drawer.classList.contains('open'));
    });
  }
  if (!drawerOpen) {
    await page.click('#caseGenModulesTabBtn');
    await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
    await page.click('#xmindCaseGenOpenBtn');
  }
  await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
  await page.waitForFunction(() => {
    var controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
    var debug = window.app && window.app.__xmindCasegenDebug ? window.app.__xmindCasegenDebug : null;
    if (controls && controls.getBoundingClientRect) {
      var rect = controls.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    return Boolean(debug && (debug.phase === 'render-success' || /error/.test(String(debug.phase || ''))));
  }, {}, { timeout: 15000 });
  const renderInfo = await page.evaluate(() => {
    var controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
    var rect = controls && controls.getBoundingClientRect ? controls.getBoundingClientRect() : null;
    return {
      debug: window.app && window.app.__xmindCasegenDebug ? window.app.__xmindCasegenDebug : null,
      hasControls: Boolean(rect && rect.width > 0 && rect.height > 0),
      containerText: document.getElementById('xmindCaseGenMindContainer')
        ? String(document.getElementById('xmindCaseGenMindContainer').textContent || '').trim()
        : '',
    };
  });
  expect(/error/i.test(String(renderInfo.debug && renderInfo.debug.phase ? renderInfo.debug.phase : '')), JSON.stringify(renderInfo)).toBe(false);
  expect(renderInfo.hasControls, JSON.stringify(renderInfo)).toBeTruthy();
}

async function waitForNodeText(page, text) {
  await page.waitForFunction((expected) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(expected) !== -1;
    });
  }, text, { timeout: 15000 });
}

async function waitForNodeTextAbsent(page, text) {
  await page.waitForFunction((expected) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return !Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(expected) !== -1;
    });
  }, text, { timeout: 15000 });
}

async function waitForNodeStatus(page, topicText, statusText) {
  await page.waitForFunction(({ topic, status }) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      var badge = node && node.querySelector ? node.querySelector('.xmind-node-status-badge') : null;
      var badgeText = badge && badge.textContent ? String(badge.textContent).replace(/\s+/g, ' ').trim() : '';
      return badgeText.indexOf(status) !== -1;
    });
  }, { topic: topicText, status: statusText }, { timeout: 15000 });
}

async function waitForNodeStatusAbsent(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.every.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return true;
      return !(node.querySelector && node.querySelector('.xmind-node-status-badge'));
    });
  }, topicText, { timeout: 15000 });
}

async function waitForNodeClass(page, topicText, className) {
  await page.waitForFunction(({ topic, className: expectedClass }) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      return label.indexOf(topic) !== -1 && node.classList && node.classList.contains(expectedClass);
    });
  }, { topic: topicText, className }, { timeout: 15000 });
}

async function clickXmindNodeQuickAction(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      var btn = node.querySelector && node.querySelector('.xmind-node-quick-action');
      return (stableLabel === topic || label === topic) && Boolean(btn && btn.disabled !== true);
    });
  }, topicText, { timeout: 15000 });
  const clicked = await page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!(stableLabel === topic || label === topic)) return false;
      if (!node.querySelector || !node.querySelector('.xmind-node-quick-action')) return false;
      target = node;
      return true;
    });
    if (!target || !target.querySelector) return false;
    var btn = target.querySelector('.xmind-node-quick-action');
    if (!btn || btn.disabled || typeof btn.click !== 'function') return false;
    btn.click();
    return true;
  }, topicText);
  expect(clicked).toBeTruthy();
}

async function getNodeQuickActionId(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(topic) !== -1 && Boolean(node.querySelector && node.querySelector('.xmind-node-quick-action'));
    });
  }, topicText, { timeout: 15000 });
  return page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var found = '';
    Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      var btn = node && node.querySelector ? node.querySelector('.xmind-node-quick-action') : null;
      if (!btn) return false;
      found = btn && btn.getAttribute ? String(btn.getAttribute('data-mind-node-quick') || '') : '';
      return Boolean(found);
    });
    return found;
  }, topicText);
}

async function openNodeContextMenu(page, topicText) {
  async function dispatchContextMenu(candidateIndex) {
    const result = await page.evaluate(({ topic, index }) => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      var exactMatches = [];
      var structuralMatches = [];
      var fuzzyMatches = [];
      Array.prototype.forEach.call(nodes, function(node) {
        if (!node) return;
        var textEl = node.querySelector ? node.querySelector('.text') : null;
        var label = textEl
          ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
          : '';
        var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
        var content = node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : label;
        var isStructuralNode = Boolean(
          node.classList
          && (node.classList.contains('xmind-casegen-node-root') || node.classList.contains('xmind-casegen-node-module'))
        );
        if (label === topic || stableLabel === topic) {
          exactMatches.push(node);
          return;
        }
        if (isStructuralNode && (stableLabel.indexOf(topic) !== -1 || label.indexOf(topic) !== -1 || content.indexOf(topic) !== -1)) {
          structuralMatches.push(node);
          return;
        }
        if (label.indexOf(topic) !== -1 || content.indexOf(topic) !== -1) {
          fuzzyMatches.push(node);
        }
      });
      var candidates = exactMatches.concat(structuralMatches, fuzzyMatches);
      var target = candidates[Number(index) || 0] || null;
      if (!target || !target.getBoundingClientRect) return false;
      var rect = target.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      var centerX = rect.left + (rect.width / 2);
      var centerY = rect.top + (rect.height / 2);
      var eventTarget = target;
      eventTarget.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
      }));
      eventTarget.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        button: 2,
        buttons: 2,
        which: 3,
      }));
      eventTarget.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        button: 2,
        buttons: 0,
        which: 3,
      }));
      eventTarget.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        button: 2,
        buttons: 2,
        which: 3,
      }));
      return {
        opened: true,
        candidateCount: candidates.length,
      };
    }, {
      topic: topicText,
      index: Number(candidateIndex) || 0,
    });
    expect(result && result.opened).toBeTruthy();
    return result;
  }

  var dispatchInfo = await dispatchContextMenu(0);
  var maxCandidates = dispatchInfo && dispatchInfo.candidateCount ? dispatchInfo.candidateCount : 1;
  var menuOpened = false;
  for (var i = 0; i < maxCandidates; i += 1) {
    if (i > 0) dispatchInfo = await dispatchContextMenu(i);
    try {
      await page.waitForFunction(() => {
        var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
        return buttons && buttons.length > 0;
      }, {}, { timeout: i === 0 ? 3000 : 1500 });
      menuOpened = true;
      break;
    } catch (err) {
      menuOpened = false;
    }
  }
  expect(menuOpened).toBeTruthy();
}

async function openRootContextMenu(page) {
  const target = page.locator('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text').first();
  await expect(target).toBeVisible();
  async function dispatchRootContextMenu() {
    return page.evaluate(() => {
      var node = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
      if (!node) return false;
      var rect = node.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      ['pointerdown', 'mousedown', 'mouseup', 'contextmenu'].forEach(function(type) {
        var init = {
          bubbles: true,
          cancelable: true,
          clientX: centerX,
          clientY: centerY,
          button: 2,
          buttons: type === 'mouseup' ? 0 : 2,
          which: 3,
        };
        try {
          if (type.indexOf('pointer') === 0 && typeof PointerEvent === 'function') {
            node.dispatchEvent(new PointerEvent(type, init));
          } else {
            node.dispatchEvent(new MouseEvent(type, init));
          }
        } catch (err) {
          node.dispatchEvent(new MouseEvent(type === 'pointerdown' ? 'mousedown' : type, init));
        }
      });
      return true;
    });
  }
  var opened = false;
  for (var i = 0; i < 4; i += 1) {
    await target.click({ button: 'right', force: true });
    try {
      await page.waitForFunction(() => {
        var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
        return buttons && buttons.length > 0;
      }, {}, { timeout: i === 0 ? 2500 : 1500 });
      opened = true;
      break;
    } catch (err) {
      opened = false;
      await dispatchRootContextMenu();
      try {
        await page.waitForFunction(() => {
          var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
          return buttons && buttons.length > 0;
        }, {}, { timeout: 1200 });
        opened = true;
        break;
      } catch (fallbackErr) {
        opened = false;
      }
    }
  }
  expect(opened).toBeTruthy();
}

async function getContextMenuItems(page) {
  await page.waitForFunction(() => {
    var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
    return buttons && buttons.length > 0;
  }, {}, { timeout: 10000 });
  return page.evaluate(() => {
    var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
    return Array.prototype.map.call(buttons, function(btn) {
      return {
        label: String(btn.textContent || '').trim(),
        disabled: btn.disabled === true,
      };
    });
  });
}

async function clickContextMenuAction(page, label) {
  const actionLabel = String(label || '').trim();
  await page.waitForFunction((text) => {
    var buttons = document.querySelectorAll('.xmind-node-context-menu-btn');
    return Array.prototype.some.call(buttons, function(btn) {
      return String(btn.textContent || '').trim() === String(text || '').trim();
    });
  }, actionLabel, { timeout: 10000 });
  const clicked = await page.evaluate((text) => {
    var buttons = document.querySelectorAll('.xmind-node-context-menu-btn');
    for (var i = 0; i < buttons.length; i += 1) {
      var btn = buttons[i];
      if (String(btn.textContent || '').trim() !== String(text || '').trim()) continue;
      btn.click();
      return true;
    }
    return false;
  }, actionLabel);
  expect(clicked).toBeTruthy();
}

async function readTopupHighlightMetrics(page) {
  return page.evaluate(() => {
    var frame = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
    if (!frame || !nodes || !nodes.length || !frame.getBoundingClientRect) return null;
    var minLeft = Infinity;
    var minTop = Infinity;
    var maxRight = -Infinity;
    var maxBottom = -Infinity;
    Array.prototype.forEach.call(nodes, function(node) {
      if (!node || !node.getBoundingClientRect) return;
      var rect = node.getBoundingClientRect();
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
      maxRight = Math.max(maxRight, rect.right);
      maxBottom = Math.max(maxBottom, rect.bottom);
    });
    if (!isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) return null;
    var frameRect = frame.getBoundingClientRect();
    return {
      highlightedNodeCount: nodes.length,
      frame: {
        left: frameRect.left,
        top: frameRect.top,
        right: frameRect.right,
        bottom: frameRect.bottom,
      },
      union: {
        left: minLeft,
        top: minTop,
        right: maxRight,
        bottom: maxBottom,
      },
    };
  });
}

async function readAllTopupHighlightFrames(page) {
  return page.evaluate(() => {
    var frameNodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
    var highlightNodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
    var counts = {};
    Array.prototype.forEach.call(highlightNodes, function(node) {
      var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
      if (!token) return;
      counts[token] = Number(counts[token] || 0) + 1;
    });
    return Array.prototype.map.call(frameNodes, function(frame) {
      var token = frame && frame.getAttribute ? String(frame.getAttribute('data-xmind-casegen-topup-frame') || '') : '';
      var label = '';
      var labelEl = frame && frame.querySelector ? frame.querySelector('.xmind-casegen-topup-highlight-label') : null;
      if (labelEl && labelEl.textContent) label = String(labelEl.textContent || '').trim();
      var rect = frame && frame.getBoundingClientRect ? frame.getBoundingClientRect() : null;
      return {
        token: token,
        label: label,
        highlightedNodeCount: Number(counts[token] || 0),
        rect: rect ? {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        } : null,
      };
    });
  });
}

async function readTopupHighlightGroups(page) {
  return page.evaluate(() => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
    var groups = {};
    Array.prototype.forEach.call(nodes, function(node) {
      var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
      if (!token) return;
      if (!groups[token]) {
        groups[token] = {
          token: token,
          label: node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-label') || '') : '',
          nodeCount: 0,
        };
      }
      groups[token].nodeCount += 1;
    });
    return Object.keys(groups).map(function(key) {
      return groups[key];
    });
  });
}

async function panXmindCasegenCanvas(page, deltaX, deltaY) {
  return page.evaluate(({ dx, dy }) => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
      || document.getElementById('xmindCaseGenMindContainer');
    var canvas = document.querySelector('#xmindCaseGenMindContainer [data-mind-canvas]');
    var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
    if (!viewer || !canvas || !map) return { before: '', after: '', dispatched: false };
    var rect = canvas.getBoundingClientRect();
    var before = map.style && map.style.transform ? String(map.style.transform || '') : '';
    canvas.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: Number(dx) || 0,
      deltaY: Number(dy) || 0,
      clientX: rect.left + (rect.width / 2),
      clientY: rect.top + (rect.height / 2),
    }));
    var after = map.style && map.style.transform ? String(map.style.transform || '') : '';
    return {
      before: before,
      after: after,
      dispatched: true,
    };
  }, { dx: deltaX, dy: deltaY });
}

async function toggleXmindCasegenNodeCollapse(page, text) {
  return page.evaluate((expected) => {
    var needle = String(expected || '').trim();
    if (!needle) return false;
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = Array.prototype.find.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(needle) !== -1;
    });
    if (!target) return false;
    var parent = target.parentElement;
    var expander = parent && parent.querySelector ? parent.querySelector('me-epd') : null;
    if (!expander && target.nextElementSibling && target.nextElementSibling.tagName === 'ME-EPD') {
      expander = target.nextElementSibling;
    }
    if (!expander && target.previousElementSibling && target.previousElementSibling.tagName === 'ME-EPD') {
      expander = target.previousElementSibling;
    }
    if (!expander) return false;
    if (typeof expander.click === 'function') {
      expander.click();
      return true;
    }
    if (typeof expander.dispatchEvent !== 'function') return false;
    expander.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, text);
}

async function readXmindCasegenViewSnapshot(page) {
  return page.evaluate(() => {
    var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
    var drawer = document.getElementById('xmindCaseGenDrawer');
    var state = window.app && window.app.state && window.app.state.xmindCaseGen
      ? window.app.state.xmindCaseGen
      : null;
    return {
      activeTab: window.app && window.app.state ? String(window.app.state.activeTab || '') : '',
      drawerOpen: Boolean(drawer && drawer.classList && drawer.classList.contains('open')),
      drawerFullscreen: Boolean(drawer && drawer.classList && drawer.classList.contains('xmind-drawer-fullscreen')),
      transform: map && map.style ? String(map.style.transform || '') : '',
      viewState: state && state.viewState ? JSON.parse(JSON.stringify(state.viewState)) : null,
    };
  });
}

async function readCaseResults(page, moduleId) {
  return page.evaluate((id) => {
    if (!window.app || !window.app.state || !window.app.state.caseGenResults) return [];
    var raw = String(window.app.state.caseGenResults[id] || '');
    if (!raw.trim()) return [];
    try {
      return JSON.parse(raw);
    } catch (err) {
      return [];
    }
  }, moduleId);
}

async function readState(page) {
  return page.evaluate(() => {
    if (!window.app || !window.app.state) return null;
    return JSON.parse(JSON.stringify(window.app.state));
  });
}

async function autoAcceptXmindConfirm(page) {
  await page.evaluate(() => {
    window.__xmindConfirmPayload = null;
    window.confirm = function(message) {
      window.__xmindConfirmPayload = {
        message: String(message || ''),
      };
      return true;
    };
    if (window.app && window.app.confirmDrawer) {
      window.app.confirmDrawer.open = function(payload) {
        window.__xmindConfirmPayload = payload || null;
        return Promise.resolve({ ok: true });
      };
    }
  });
}

async function ctrlClickXmindNodes(page, topics) {
  for (const topic of topics || []) {
    const clicked = await page.evaluate((expected) => {
      var needle = String(expected || '').trim();
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      var target = null;
      Array.prototype.some.call(nodes, function(node) {
        var textEl = node && node.querySelector ? node.querySelector('.text') : null;
        var label = textEl
          ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
          : '';
        var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
        if (!(stableLabel === needle || label === needle)) return false;
        target = node;
        return true;
      });
      if (!target || !target.getBoundingClientRect) return false;
      var rect = target.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      var centerX = rect.left + (rect.width / 2);
      var centerY = rect.top + (rect.height / 2);
      ['mousemove', 'mousedown', 'mouseup', 'click'].forEach(function(type) {
        target.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: centerX,
          clientY: centerY,
          ctrlKey: true,
          metaKey: false,
          button: 0,
          buttons: type === 'mousedown' ? 1 : 0,
        }));
      });
      return true;
    }, topic);
    expect(clicked).toBeTruthy();
    await page.waitForTimeout(240);
  }
}

async function clickXmindNode(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      return stableLabel === topic || label === topic;
    });
  }, topicText, { timeout: 15000 });
  const clicked = await page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!(stableLabel === topic || label === topic)) return false;
      target = node;
      return true;
    });
    if (!target || !target.getBoundingClientRect) return false;
    var rect = target.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    var centerX = rect.left + (rect.width / 2);
    var centerY = rect.top + (rect.height / 2);
    ['mousemove', 'mousedown', 'mouseup', 'click'].forEach(function(type) {
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        button: 0,
        buttons: type === 'mousedown' ? 1 : 0,
      }));
    });
    return true;
  }, topicText);
  expect(clicked).toBeTruthy();
  await page.waitForTimeout(80);
}

async function dragBoxSelectXmindNodes(page, topics) {
  async function readLayout() {
    return page.evaluate((inputTopics) => {
      var expected = Array.isArray(inputTopics) ? inputTopics.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean) : [];
      var canvas = document.querySelector('#xmindCaseGenMindContainer [data-mind-canvas]');
      var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
        || document.getElementById('xmindCaseGenMindContainer');
      var boundsTarget = canvas && canvas.getBoundingClientRect ? canvas : viewer;
      if (!boundsTarget || !boundsTarget.getBoundingClientRect) return null;
      var boundsRect = boundsTarget.getBoundingClientRect();
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      var minLeft = Infinity;
      var minTop = Infinity;
      var maxRight = -Infinity;
      var maxBottom = -Infinity;
      var matchedCount = 0;
      expected.forEach(function(topic) {
        Array.prototype.some.call(nodes, function(node) {
          if (!node || !node.getBoundingClientRect) return false;
          var textEl = node.querySelector ? node.querySelector('.text') : null;
          var label = textEl
            ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
            : '';
          var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
          if (!(stableLabel === topic || label === topic)) return false;
          var targetRect = textEl && textEl.getBoundingClientRect ? textEl.getBoundingClientRect() : node.getBoundingClientRect();
          minLeft = Math.min(minLeft, targetRect.left);
          minTop = Math.min(minTop, targetRect.top);
          maxRight = Math.max(maxRight, targetRect.right);
          maxBottom = Math.max(maxBottom, targetRect.bottom);
          matchedCount += 1;
          return true;
        });
      });
      if (!matchedCount || !isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) return null;
      return {
        bounds: {
          left: boundsRect.left,
          top: boundsRect.top,
          right: boundsRect.right,
          bottom: boundsRect.bottom,
        },
        target: {
          left: minLeft,
          top: minTop,
          right: maxRight,
          bottom: maxBottom,
        },
        matchedCount: matchedCount,
      };
    }, topics);
  }

  var layout = await readLayout();
  for (var attempt = 0; attempt < 3; attempt += 1) {
    await page.waitForTimeout(160);
    var nextLayout = await readLayout();
    if (!layout || !nextLayout) {
      layout = nextLayout;
      continue;
    }
    var stableX = Math.abs(Number(layout.target.left || 0) - Number(nextLayout.target.left || 0)) < 2;
    var stableY = Math.abs(Number(layout.target.top || 0) - Number(nextLayout.target.top || 0)) < 2;
    layout = nextLayout;
    if (stableX && stableY) break;
  }

  expect(layout && layout.matchedCount).toBe((topics || []).length);

  var attempts = [
    { x: 12, y: 10 },
    { x: 18, y: 12 },
    { x: 24, y: 14 },
    { x: 28, y: 16 },
  ];
  var selectedCount = 0;
  for (const padding of attempts) {
    var rect = {
      startX: Math.max(layout.bounds.left + 8, layout.target.left - padding.x),
      startY: Math.max(layout.bounds.top + 8, layout.target.top - padding.y),
      endX: Math.min(layout.bounds.right - 8, layout.target.right + padding.x),
      endY: Math.min(layout.bounds.bottom - 8, layout.target.bottom + padding.y),
    };
    await page.mouse.move(rect.startX, rect.startY);
    await page.mouse.down();
    await page.mouse.move(rect.endX, rect.endY, { steps: 18 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    selectedCount = await readSelectedXmindNodeCount(page);
    if (selectedCount >= (topics || []).length) break;
  }
}

async function pressDeleteInXmind(page) {
  const hasViewer = await page.evaluate(() => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
      || document.getElementById('xmindCaseGenMindContainer');
    if (!viewer || typeof viewer.focus !== 'function') return false;
    if (typeof viewer.focus === 'function') viewer.focus();
    return true;
  });
  expect(hasViewer).toBeTruthy();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(60);
}

async function pressDeleteUndoInXmind(page) {
  const hasViewer = await page.evaluate(() => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
      || document.getElementById('xmindCaseGenMindContainer');
    if (!viewer || typeof viewer.focus !== 'function') return false;
    viewer.focus();
    return true;
  });
  expect(hasViewer).toBeTruthy();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
}

async function pressDeleteRedoInXmind(page) {
  const hasViewer = await page.evaluate(() => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
      || document.getElementById('xmindCaseGenMindContainer');
    if (!viewer || typeof viewer.focus !== 'function') return false;
    viewer.focus();
    return true;
  });
  expect(hasViewer).toBeTruthy();
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(120);
}

async function readSelectedXmindNodeCount(page) {
  return page.evaluate(() => {
    var selected = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-box-selected, #xmindCaseGenMindContainer .selected');
    var seen = {};
    Array.prototype.forEach.call(selected || [], function(node) {
      var host = node && node.closest ? node.closest('me-tpc') : node;
      var textEl = host && host.querySelector ? host.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!stableLabel) return;
      seen[stableLabel] = true;
    });
    return Object.keys(seen).length;
  });
}

async function readSelectedXmindNodeLabels(page) {
  return page.evaluate(() => {
    var selected = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-box-selected, #xmindCaseGenMindContainer .selected');
    var labels = [];
    var seen = {};
    Array.prototype.forEach.call(selected || [], function(node) {
      var host = node && node.closest ? node.closest('me-tpc') : node;
      var textEl = host && host.querySelector ? host.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!stableLabel || seen[stableLabel]) return;
      seen[stableLabel] = true;
      labels.push(stableLabel);
    });
    return labels;
  });
}

test.describe('XMind 用例生成抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('前置准备 step1 的需求文档模式复用拖拽上传样式，并在导入后允许下一步', async ({ page }) => {
    const token = 'token-xmind-prep-document-zone';
    const user = { id: 11, username: 'demo_user_11', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await expect(page.locator('label.xmind-casegen-prep-choice.is-success').filter({ has: page.locator('input[name="xmindRequirementMode"][value="document"]') })).toHaveClass(/is-active/);
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toBeVisible();
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('原始需求');
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('拖拽或点击选择');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.evaluate((payload) => {
      var zone = document.getElementById('xmindCaseGenPrepRequirementDropzone');
      if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
      var dt = new DataTransfer();
      dt.items.add(new File([payload.text], payload.name, { type: 'text/plain' }));
      function dispatch(type) {
        var evt = null;
        if (typeof Event === 'function') {
          evt = new Event(type, { bubbles: true, cancelable: true });
        } else if (document && document.createEvent) {
          evt = document.createEvent('Event');
          evt.initEvent(type, true, true);
        }
        if (!evt) return;
        try {
          Object.defineProperty(evt, 'dataTransfer', { value: dt });
        } catch (_) {
          evt.dataTransfer = dt;
        }
        zone.dispatchEvent(evt);
      }
      dispatch('dragover');
      dispatch('drop');
    }, {
      name: 'xmind-step1-requirement.txt',
      text: '需求正文：支持用户拖拽导入原始需求文档，并同步到 XMind 生成上下文。',
    });

    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('支持用户拖拽导入原始需求文档') !== -1);
    }, {}, { timeout: 20000 });
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('已导入');
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('xmind-step1-requirement.txt');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();
  });

  test('前置准备 step2 的参考用例导入复用拖拽上传样式，并在导入后允许下一步', async ({ page }) => {
    const token = 'token-xmind-prep-cases-zone';
    const user = { id: 12, username: 'demo_user_12', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await page.evaluate((payload) => {
      var zone = document.getElementById('xmindCaseGenPrepRequirementDropzone');
      if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
      var dt = new DataTransfer();
      dt.items.add(new File([payload.text], payload.name, { type: 'text/plain' }));
      function dispatch(type) {
        var evt = null;
        if (typeof Event === 'function') {
          evt = new Event(type, { bubbles: true, cancelable: true });
        } else if (document && document.createEvent) {
          evt = document.createEvent('Event');
          evt.initEvent(type, true, true);
        }
        if (!evt) return;
        try {
          Object.defineProperty(evt, 'dataTransfer', { value: dt });
        } catch (_) {
          evt.dataTransfer = dt;
        }
        zone.dispatchEvent(evt);
      }
      dispatch('dragover');
      dispatch('drop');
    }, {
      name: 'xmind-step2-requirement.txt',
      text: '需求正文：支持在 step2 拖拽导入参考用例。',
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('支持在 step2 拖拽导入参考用例') !== -1);
    }, {}, { timeout: 20000 });
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');

    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step2');
    await page.check('input[name="xmindCaseImportMode"][value="import"]', { force: true });
    await expect(page.locator('#xmindCaseGenPrepCasesDropzone')).toBeVisible();
    await expect(page.locator('#xmindCaseGenPrepCasesDropzone')).toContainText('测试用例');
    await expect(page.locator('#xmindCaseGenPrepCasesDropzone')).toContainText('拖拽或点击选择');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-action="select-cases-library"]')).toBeVisible();
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.evaluate((payload) => {
      var zone = document.getElementById('xmindCaseGenPrepCasesDropzone');
      if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
      var dt = new DataTransfer();
      dt.items.add(new File([payload.text], payload.name, { type: 'application/json' }));
      function dispatch(type) {
        var evt = null;
        if (typeof Event === 'function') {
          evt = new Event(type, { bubbles: true, cancelable: true });
        } else if (document && document.createEvent) {
          evt = document.createEvent('Event');
          evt.initEvent(type, true, true);
        }
        if (!evt) return;
        try {
          Object.defineProperty(evt, 'dataTransfer', { value: dt });
        } catch (_) {
          evt.dataTransfer = dt;
        }
        zone.dispatchEvent(evt);
      }
      dispatch('dragover');
      dispatch('drop');
    }, {
      name: 'xmind-step2-cases.json',
      text: JSON.stringify([{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }]),
    });

    await page.waitForFunction(() => {
      var st = window.app && window.app.state ? window.app.state : null;
      return Boolean(st && Array.isArray(st.importedCases) && st.importedCases.length > 0);
    }, {}, { timeout: 20000 });
    await expect(page.locator('#xmindCaseGenPrepCasesDropzone')).toContainText('当前共 1 条');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody .xmind-casegen-prep-filelist')).toContainText('已导入参考用例');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();
  });

  test('前置准备改为单步 3 步流程，并在确认后锁定前两步', async ({ page }) => {
    const token = 'token-xmind-prep';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await page.waitForFunction(() => Boolean(document.querySelector('[data-xmind-casegen-inline-actions]')), {}, { timeout: 10000 });
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenPrepResetBtn')).toBeVisible();
    await expect(page.locator('#xmindCaseGenSummaryDialogBody .xmind-casegen-prep-step')).toHaveCount(3);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.check('input[name="xmindRequirementMode"][value="manual"]', { force: true });
    await expect(page.locator('label.xmind-casegen-prep-choice.is-success').filter({ has: page.locator('input[name="xmindRequirementMode"][value="manual"]') })).toHaveClass(/is-active/);
    await page.fill('#xmindCaseGenManualRequirementText', '手填需求：支持用户在移动端完成订单确认。');
    await page.click('[data-prep-action="upload-manual-images"]');
    await page.locator('input[type="file"][accept="image/*"]').last().setInputFiles({
      name: 'requirement.png',
      mimeType: 'image/png',
      buffer: ONE_PIXEL_PNG,
    });
    await expect(page.locator('.xmind-casegen-prep-image-item')).toHaveCount(1);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();

    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step2');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]', { force: true });
    await expect(page.locator('label.xmind-casegen-prep-choice.is-success').filter({ has: page.locator('input[name="xmindCaseImportMode"][value="skip"]') })).toHaveClass(/is-active/);
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');

    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step3');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('确认后，step1 和 step2 在本次生成中都不可更改');
    await page.fill('#xmindCaseGenOptionCustomRequirement', '标题保持简洁');
    await expect(page.locator('[data-casegen-setting-card="needFunctionCondition"]')).toHaveClass(/is-on/);
    await expect(page.locator('[data-casegen-setting-card="needNumericValidation"]')).toHaveClass(/is-on/);
    await page.locator('input[data-casegen-setting="needBoundary"]').check({ force: true });
    await page.locator('input[data-casegen-setting="needSpecial"]').check({ force: true });
    await page.locator('input[data-casegen-setting="specialWeakNetwork"]').check({ force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step3');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="prev"]')).toBeEnabled();
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="prev"]');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step2');
    await expect(page.locator('input[name="xmindCaseImportMode"][value="skip"]')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-action="import-cases"]')).toHaveCount(0);
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="prev"]');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('input[name="xmindRequirementMode"][value="manual"]')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenManualRequirementText')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-action="upload-manual-images"]')).toBeDisabled();
    await clickElementById(page, 'xmindCaseGenSummaryCloseBtn');
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step3');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var prep = state && state.xmindCaseGen ? state.xmindCaseGen.prep : null;
      return Boolean(prep && Array.isArray(prep.manualRequirementBlocks) && prep.manualRequirementBlocks.length === 2);
    }, {}, { timeout: 20000 });

    const state = await readState(page);
    expect(state && state.xmindCaseGen && state.xmindCaseGen.prep).toBeTruthy();
    expect(state.xmindCaseGen.prep.requirementMode).toBe('manual');
    expect(state.xmindCaseGen.prep.caseImportMode).toBe('skip');
    expect(state.xmindCaseGen.prep.baseLocked).toBe(true);
    expect(state.xmindCaseGen.prep.completed).toBe(true);
    expect(Array.isArray(state.xmindCaseGen.prep.manualRequirementBlocks)).toBeTruthy();
    expect(state.xmindCaseGen.prep.manualRequirementBlocks.length).toBe(2);
    expect(state.caseGenSettings.customRequirement).toBe('标题保持简洁');
    expect(state.caseGenSettings.needFunctionCondition).toBe(true);
    expect(state.caseGenSettings.needNumericValidation).toBe(true);
    expect(state.caseGenSettings.needBoundary).toBe(true);
    expect(state.caseGenSettings.needSpecial).toBe(true);
    expect(state.caseGenSettings.specialWeakNetwork).toBe(true);
  });

  test('前置准备支持重置，确认后会清空当前导入与生成结果并回到 step1', async ({ page }) => {
    const token = 'token-xmind-prep-reset';
    const user = { id: 101, username: 'demo_user_101', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
    });
    await seedDocumentRequirement(page, {
      text: '需求：重置后需要恢复为未导入、未生成的初始状态。',
      requirementLabel: 'XMind重置需求',
    });
    await seedImportedBaseline(page, [{
      module: '登录模块',
      title: '登录模块-基线用例',
      priority: 'P1',
      preconditions: '账号已存在',
      steps: ['1、进入登录页', '2、输入账号密码'],
      expected: '登录成功',
    }]);
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'import',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');

    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);
    await expect(page.locator('.temp-center-toast').last()).toContainText('已重置当前 XMind 生成内容');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    const resetState = await page.evaluate(() => {
      var st = window.app && window.app.state ? window.app.state : {};
      return {
        rawText: document.getElementById('rawText') ? String(document.getElementById('rawText').value || '') : '',
        caseText: document.getElementById('caseText') ? String(document.getElementById('caseText').value || '') : '',
        requirementLabel: String(st.requirementLabel || ''),
        importedCount: Array.isArray(st.importedCases) ? st.importedCases.length : -1,
        moduleCount: Array.isArray(st.caseGenModules) ? st.caseGenModules.length : -1,
        resultCount: st.caseGenResults && typeof st.caseGenResults === 'object' ? Object.keys(st.caseGenResults).length : -1,
        prep: st.xmindCaseGen && st.xmindCaseGen.prep ? {
          step: Number(st.xmindCaseGen.prep.step || 0),
          requirementMode: String(st.xmindCaseGen.prep.requirementMode || ''),
          caseImportMode: String(st.xmindCaseGen.prep.caseImportMode || ''),
          completed: st.xmindCaseGen.prep.completed === true,
          baseLocked: st.xmindCaseGen.prep.baseLocked === true,
        } : null,
      };
    });

    expect(resetState.rawText).toBe('');
    expect(resetState.caseText).toBe('');
    expect(resetState.requirementLabel).toBe('');
    expect(resetState.importedCount).toBe(0);
    expect(resetState.moduleCount).toBe(0);
    expect(resetState.resultCount).toBe(0);
    expect(resetState.prep).not.toBeNull();
    expect(resetState.prep.step).toBe(1);
    expect(resetState.prep.requirementMode).toBe('');
    expect(resetState.prep.caseImportMode).toBe('');
    expect(resetState.prep.completed).toBe(false);
    expect(resetState.prep.baseLocked).toBe(false);
  });

  test('重置前置准备后重新完成 step1-3，根节点仍可重新执行全量生成并使用新需求上下文', async ({ page }) => {
    const token = 'token-xmind-prep-reset-regenerate';
    const user = { id: 102, username: 'demo_user_102', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 160);
    await autoAcceptXmindConfirm(page);
    await openXmindCaseGenDrawer(page);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-first.txt',
        mimeType: 'text/plain',
        text: '需求正文：第一次生成，仅用于构造重置前的上下文。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('第一次生成') !== -1);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]', { force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);
    await waitForNodeText(page, 'xmind-reset-first');

    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeText(page, '登录成功校验');

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-second.txt',
        mimeType: 'text/plain',
        text: '需求正文：第二次生成，重置后应该使用这一轮的新需求重新生成模块和用例。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('第二次生成') !== -1);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]', { force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await waitForNodeText(page, 'xmind-reset-second');
    await openRootContextMenu(page);
    const resetItems = await getContextMenuItems(page);
    expect(resetItems.map((item) => item.label)).toEqual(['生成全量用例', '生成全量模块']);
    await clickContextMenuAction(page, '生成全量用例');

    await waitForNodeStatus(page, 'xmind-reset-second', '生成中');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeStatusAbsent(page, 'xmind-reset-second');

    const lastRootFullCasesCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      for (var i = calls.length - 1; i >= 0; i -= 1) {
        var item = calls[i];
        if (!item || !item.contract) continue;
        if (String(item.contract.scope || '') !== 'root') continue;
        if (String(item.contract.mode || '') !== 'full_cases') continue;
        return {
          user: String(item.user || ''),
          prompt: String(item.prompt || ''),
        };
      }
      return null;
    });
    expect(lastRootFullCasesCall).toBeTruthy();
    expect(lastRootFullCasesCall.user).toContain('【需求正文】\n需求正文：第二次生成，重置后应该使用这一轮的新需求重新生成模块和用例。');
    expect(lastRootFullCasesCall.user).not.toContain('第一次生成，仅用于构造重置前的上下文');
  });

  test('根节点右键触发生成前置准备时，会先收起右键菜单', async ({ page }) => {
    const token = 'token-xmind-prep-hides-context-menu';
    const user = { id: 1003, username: 'demo_user_1003', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await openRootContextMenu(page);
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(1);
    await clickContextMenuAction(page, '生成全量用例');

    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(0);
  });

  test('重置前置准备后重新生成，真实 proxy 请求只携带当前一轮需求与图片上下文', async ({ page }) => {
    const token = 'token-xmind-prep-reset-proxy-context';
    const user = { id: 103, username: 'demo_user_103', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      modelBaseUrl: 'https://mock-model.local/v1/responses',
      modelName: 'gpt-5.4',
      modelCapabilities: ['vision', 'reasoning', 'chat'],
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[],"cases":[{"module":"登录模块","title":"登录成功校验","priority":"P1","preconditions":"账号已存在","steps":["1、进入登录页","2、输入正确账号密码并提交"],"expected":"登录成功"}]}]}',
    });
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
    });

    await seedDocumentRequirement(page, {
      text: '需求正文：第一次生成，附带图片上下文。',
      requirementLabel: '第一次需求',
      imageCount: 1,
      imageBytes: ONE_PIXEL_PNG,
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await openXmindCaseGenDrawer(page);

    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(1);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);

    await seedDocumentRequirement(page, {
      text: '需求正文：第二次生成，重置后只允许携带这一轮的新需求与图片。',
      requirementLabel: '第二次需求',
      imageCount: 1,
      imageBytes: ONE_PIXEL_PNG,
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await clickElementById(page, 'xmindCaseGenSummaryCloseBtn');
    await page.evaluate(() => {
      if (window.app && window.app.xmindCasegenApi && typeof window.app.xmindCasegenApi.render === 'function') {
        window.app.xmindCasegenApi.render({ reason: 'ui-test-after-reset' });
      }
    });
    await waitForNodeText(page, '第二次需求');

    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(2);

    const proxyCalls = await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls : []);
    expect(proxyCalls.length).toBeGreaterThanOrEqual(2);
    const lastCall = proxyCalls[proxyCalls.length - 1] || {};
    const payload = lastCall && lastCall.payload ? lastCall.payload : {};
    const content = Array.isArray(payload.input) && payload.input[0] && Array.isArray(payload.input[0].content)
      ? payload.input[0].content
      : [];
    const textBlocks = content.filter((item) => item && item.type === 'input_text').map((item) => String(item.text || ''));
    const imageBlocks = content.filter((item) => item && item.type === 'input_image');
    expect(imageBlocks.length).toBe(1);
    expect(textBlocks.join('\n')).toContain('【需求正文】\n需求正文：第二次生成，重置后只允许携带这一轮的新需求与图片。');
    expect(textBlocks.join('\n')).not.toContain('第一次生成，附带图片上下文');
  });

  test('重置前置准备后重新导入需求，不应再被旧工作流数据触发二次确认导入', async ({ page }) => {
    const token = 'token-xmind-prep-reset-no-second-import-confirm';
    const user = { id: 104, username: 'demo_user_104', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
      var cleanedTextEl = document.getElementById('cleanedText');
      if (cleanedTextEl) {
        cleanedTextEl.value = '历史清洗结果：这里模拟页面中仍残留其他工作流数据。';
        cleanedTextEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);

    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-import-after-cleaned.txt',
        mimeType: 'text/plain',
        text: '需求正文：reset 之后重新导入，不应该再次触发确认导入新需求。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('不应该再次触发确认导入新需求') !== -1);
    }, {}, { timeout: 20000 });

    const confirmPayloads = await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads : []);
    expect(confirmPayloads.length).toBe(1);
    expect(String(confirmPayloads[0] && confirmPayloads[0].title || '')).toContain('确认重置前置准备');
  });

  test('重置前置准备后通过真实 step1 文档导入重新完成准备，根节点仍可正常发起真实 proxy 生成', async ({ page }) => {
    const token = 'token-xmind-prep-reset-real-import-and-generate';
    const user = { id: 105, username: 'demo_user_105', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[],"cases":[{"module":"登录模块","title":"登录成功校验","priority":"P1","preconditions":"账号已存在","steps":["1、进入登录页","2、输入账号密码并提交"],"expected":"登录成功"}]}]}',
    });
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
      var cleanedTextEl = document.getElementById('cleanedText');
      if (cleanedTextEl) {
        cleanedTextEl.value = '历史清洗结果：用于模拟 reset 前页面仍有共享工作流数据。';
        cleanedTextEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);

    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-real-import.txt',
        mimeType: 'text/plain',
        text: '需求正文：真实 step1 文档导入后，仍应可以继续完成准备并正常发起生成。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('真实 step1 文档导入后') !== -1);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]', { force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await waitForNodeText(page, 'xmind-reset-real-import');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(1);

    const lastProxyCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls : [];
      return calls.length ? calls[calls.length - 1] : null;
    });
    expect(lastProxyCall).toBeTruthy();
    expect(JSON.stringify(lastProxyCall || {})).toContain('真实 step1 文档导入后');
  });

  test('重置前置准备后通过真实 step1 文档导入重新完成准备，根节点仍可正常发起全量模块生成', async ({ page }) => {
    const token = 'token-xmind-prep-reset-real-import-full-modules';
    const user = { id: 106, username: 'demo_user_106', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[]},{"module":"支付模块","key_scenarios":["支付主流程"],"test_points":["支付结果校验"],"coupled_modules":["订单中心"]}]}',
    });
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
      var splitResultEl = document.getElementById('splitResult');
      if (splitResultEl) {
        splitResultEl.value = '历史模块拆分结果：用于模拟 reset 前页面仍有共享工作流数据。';
        splitResultEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);

    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-real-import-modules.txt',
        mimeType: 'text/plain',
        text: '需求正文：reset 后重新导入，再执行全量模块生成，也应可以正常发起。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('全量模块生成') !== -1);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]', { force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await waitForNodeText(page, 'xmind-reset-real-import-modules');
    await openRootContextMenu(page);
    const rootItems = await getContextMenuItems(page);
    expect(rootItems.map((item) => item.label)).toEqual(['生成全量用例', '生成全量模块']);
    await clickContextMenuAction(page, '生成全量模块');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(1);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
  });

  test('页面刷新后保持在 XMind 用例生成页面，并恢复抽屉、全屏、缩放、位置与已记录折叠状态', async ({ page }) => {
    const token = 'token-xmind-refresh-viewstate';
    const user = { id: 61, username: 'demo_user_refresh_view', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：刷新后需要保持 XMind 用例生成页的当前视图状态。',
      requirementLabel: 'XMind刷新视图需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
      'xmind-mod-pay': [{
        module: '支付模块',
        title: '支付成功校验',
        priority: 'P1',
        preconditions: '订单待支付',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    const beforeZoomSnapshot = await readXmindCasegenViewSnapshot(page);
    await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-in"]');
    await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-in"]');
    const panResult = await panXmindCasegenCanvas(page, 180, 120);
    expect(panResult.dispatched).toBeTruthy();
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      if (!map || !map.style) return false;
      return String(map.style.transform || '') !== String(beforeTransform || '');
    }, beforeZoomSnapshot.transform || panResult.before || '', { timeout: 15000 });
    await page.click('#xmindCaseGenMindContainer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    expect(await toggleXmindCasegenNodeCollapse(page, '登录模块')).toBeTruthy();
    await waitForNodeTextAbsent(page, '登录成功校验');
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    await expect.poll(async () => {
      const snapshot = await readXmindCasegenViewSnapshot(page);
      return snapshot && snapshot.viewState ? snapshot.viewState.collapsedNodeKeys : [];
    }).toContain('module::登录模块');
    await page.evaluate(() => {
      if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
        window.app.persistWorkflowStateNow();
      }
    });

    const beforeReload = await readXmindCasegenViewSnapshot(page);
    expect(beforeReload.activeTab).toBe('casesgen');
    expect(beforeReload.drawerOpen).toBe(true);
    expect(beforeReload.drawerFullscreen).toBe(true);
    expect(beforeReload.transform).not.toBe('');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');

    await expect.poll(async () => {
      const snapshot = await readXmindCasegenViewSnapshot(page);
      return snapshot && snapshot.viewState
        ? {
            drawerOpen: snapshot.drawerOpen,
            drawerFullscreen: snapshot.drawerFullscreen,
            viewDrawerOpen: snapshot.viewState.drawerOpen,
            viewFullscreen: snapshot.viewState.fullscreen,
            viewTransform: snapshot.viewState.transform,
          }
        : null;
    }).toEqual({
      drawerOpen: true,
      drawerFullscreen: true,
      viewDrawerOpen: true,
      viewFullscreen: true,
      viewTransform: beforeReload.transform,
    });
    const afterReload = await readXmindCasegenViewSnapshot(page);
    expect(afterReload.activeTab).toBe('casesgen');
    expect(afterReload.drawerOpen).toBe(true);
    expect(afterReload.drawerFullscreen).toBe(true);
    expect(afterReload.transform).toBe(beforeReload.transform);
    expect(afterReload.viewState).toBeTruthy();
    expect(afterReload.viewState.drawerOpen).toBe(true);
    expect(afterReload.viewState.fullscreen).toBe(true);
    expect(afterReload.viewState.transform).toBe(beforeReload.transform);
    expect(afterReload.viewState.collapsedNodeKeys).toContain('module::登录模块');
  });

  test('工具栏支持查看生成记录，并展示根节点与模块节点的生成摘要', async ({ page }) => {
    const token = 'token-xmind-history';
    const user = { id: 21, username: 'demo_user_history', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：需要记录 XMind 根节点和模块节点的生成历史。',
      requirementLabel: 'XMind生成记录需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    expect(await page.evaluate(() => {
      var host = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-inline-actions]');
      if (!host || !host.children) return [];
      return Array.prototype.map.call(host.children, function(el) {
        return String(el.id || '');
      });
    })).toEqual([
      'xmindCaseGenSummaryBtn',
      'xmindCaseGenHistoryBtn',
      'xmindCaseGenStoreBtn',
      'xmindCaseGenDeleteUndoBtn',
      'xmindCaseGenDeleteRedoBtn',
      'xmindCaseGenExportBtn',
    ]);

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogTitle')).toHaveText('生成记录');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('暂无生成记录');
    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await openNodeContextMenu(page, 'XMind生成记录需求');
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    await expect(page.locator('.xmind-casegen-history-card')).toHaveCount(2);

    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('模块节点 · 登录模块');
    await expect(latestCard).toContainText('生成全量用例');
    await expect(latestCard).toContainText('生成模块 1 个');
    await expect(latestCard).toContainText('登录模块');
    await expect(latestCard).toContainText('2 条用例');

    const previousCard = page.locator('.xmind-casegen-history-card').nth(1);
    await expect(previousCard).toContainText('根节点 · XMind生成记录需求');
    await expect(previousCard).toContainText('生成全量模块');
    await expect(previousCard).toContainText('生成模块 2 个');
    await expect(previousCard).toContainText('登录模块');
    await expect(previousCard).toContainText('支付模块');
    await expect(previousCard).toContainText('0 条用例');
  });

  test('右侧导出XMind按钮替换为模型选择框，并支持直接切换 XMind 模型', async ({ page }) => {
    const token = 'token-xmind-inline-model-select';
    const user = { id: 211, username: 'demo_user_inline_model', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      modelRemoteId: 901,
      modelBaseUrl: 'https://mock-model-a.local/v1/responses',
      modelName: 'gpt-5.4-a',
      modelCapabilities: ['vision', 'reasoning', 'chat'],
      extraModels: [{
        id: 902,
        name: 'MockXmindCaseGenModel-B',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          provider: 'custom',
          baseUrl: 'https://mock-model-b.local/v1/responses',
          apiKey: 'mock-key-b',
          model: 'gpt-5.4-b',
          maxTokens: 2048,
          capabilities: ['vision', 'reasoning', 'chat'],
        },
      }],
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[]}]}',
    });
    await seedDocumentRequirement(page, {
      text: '需求：验证 XMind 右侧工具栏可直接切换模型。',
      requirementLabel: 'XMind模型切换需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind模型切换需求');
    await expect(page.locator('#xmindCaseGenMindContainer [data-mind-action="export-xmind"]')).toHaveClass(/xmind-casegen-default-export-hidden/);
    await expect(page.locator('#xmindCaseGenMindContainer [data-xmind-casegen-model-select]')).toBeVisible();

    const optionTexts = await page.locator('#xmindCaseGenMindContainer [data-xmind-casegen-model-select] option').allTextContents();
    expect(optionTexts).toEqual(['MockXmindCaseGenModel', 'MockXmindCaseGenModel-B']);

    await page.selectOption('#xmindCaseGenMindContainer [data-xmind-casegen-model-select]', '902');
    await expect.poll(async () => {
      return await page.evaluate(() => {
        var state = window.app && window.app.state ? window.app.state : null;
        return state && state.assignments ? String(state.assignments.xmindCaseGenId || '') : '';
      });
    }).toBe('902');

    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(1);

    const lastCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls : [];
      return calls.length ? calls[calls.length - 1] : null;
    });
    expect(lastCall).toBeTruthy();
    expect(String(lastCall.base_url || '')).toBe('https://mock-model-b.local/v1/responses');
  });

  test('生成记录会展示重复模块场景下的通俗未新增原因', async ({ page }) => {
    const token = 'token-xmind-history-nochange';
    const user = { id: 22, username: 'demo_user_history_reason', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRawXmindModelResponse(page, JSON.stringify({
      modules: [
        { module: '技能按钮与界面状态', cases: [] },
        { module: '异常状态与边界处理', cases: [] },
      ],
    }), 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证重复模块导致无新增时，生成记录会展示通俗原因。',
      requirementLabel: 'XMind未新增原因需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-skill',
      title: '技能按钮与界面状态',
      scenarios: ['技能按钮主场景'],
      points: ['按钮状态同步'],
      coupled: ['消息模块'],
    }, {
      id: 'xmind-mod-exception',
      title: '异常状态与边界处理',
      scenarios: ['异常状态场景'],
      points: ['边界处理提示'],
      coupled: ['技能按钮与界面状态'],
    }]);

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '技能按钮与界面状态');
    await waitForNodeText(page, '异常状态与边界处理');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '补全模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('根节点 · XMind未新增原因需求');
    await expect(latestCard).toContainText('补全模块');
    await expect(latestCard).toContainText('本次没有新增结果');
    await expect(latestCard).toContainText('未新增原因：');
    await expect(latestCard).toContainText('当前模块已经覆盖，不需要再补充新模块。');
    await expect(latestCard).toContainText('已有模块已覆盖 2 个');
  });

  test('生成记录会展示模型返回非 JSON 时的具体原因和返回片段', async ({ page }) => {
    const token = 'token-xmind-history-invalid-output';
    const user = { id: 23, username: 'demo_user_history_invalid_output', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRawXmindModelResponse(page, '我认为当前没有需要补充的模块，请直接沿用现有内容。', 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证模型返回普通文本时，生成记录要写出更具体的失败原因。',
      requirementLabel: 'XMind模型返回结构异常需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind模型返回结构异常需求');

    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('根节点 · XMind模型返回结构异常需求');
    await expect(latestCard).toContainText('生成全量模块');
    await expect(latestCard).toContainText('未新增原因：');
    await expect(latestCard).toContainText('模型返回的是说明文字，不是系统可识别的结果。');
    await expect(latestCard).toContainText('返回格式：说明文字');
    await expect(latestCard).toContainText('模型返回片段：');
    await expect(latestCard).toContainText('我认为当前没有需要补充的模块，请直接沿用现有内容。');
  });

  test('生成记录会把空模块数组显示为当前没有需要补充的新模块', async ({ page }) => {
    const token = 'token-xmind-history-empty-modules';
    const user = { id: 24, username: 'demo_user_history_empty_modules', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRawXmindModelResponse(page, '{"modules":[]}', 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证模型返回空模块数组时，历史记录会用通俗文案说明没有可补内容。',
      requirementLabel: 'XMind空模块数组需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind空模块数组需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '补全模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('未新增原因：');
    await expect(latestCard).toContainText('当前没有需要补充的新模块。');
    await expect(latestCard).toContainText('模块列表为空');
  });

  test('生成记录会把模型错误显示为通俗失败原因', async ({ page }) => {
    const token = 'token-xmind-history-model-error';
    const user = { id: 25, username: 'demo_user_history_model_error', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRejectedXmindModelResponse(page, '503 Service Unavailable', 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证模型调用出错时，生成记录会写出通俗失败原因。',
      requirementLabel: 'XMind模型调用错误需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind模型调用错误需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('本次生成未成功');
    await expect(latestCard).toContainText('失败原因：');
    await expect(latestCard).toContainText('模型服务暂时不可用，请稍后重试。');
    await expect(latestCard).toContainText('错误信息：503 Service Unavailable');
  });

  test('DeepSeek 模型在 XMind 提示词下不会误判为 JSON 数组并可正常生成', async ({ page }) => {
    const token = 'token-xmind-deepseek-object-shape';
    const user = { id: 29, username: 'demo_user_deepseek_object_shape', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      modelBaseUrl: 'https://api.deepseek.com/chat/completions',
      modelName: 'deepseek-reasoner',
      modelCapabilities: ['chat'],
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[],"cases":[]}]}',
    });
    await seedDocumentRequirement(page, {
      text: '需求：验证 DeepSeek 在 XMind 提示词下按对象结构返回时仍可被正常解析。',
      requirementLabel: 'XMind DeepSeek 结构需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind DeepSeek 结构需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeText(page, '登录模块');
    await expect(page.locator('.temp-center-toast')).toHaveCount(0);
  });

  test('生成记录会展示代理返回的 HTTP 503 具体错误信息', async ({ page }) => {
    const token = 'token-xmind-history-http-503';
    const user = { id: 28, username: 'demo_user_history_http_503', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyHttpError(page, {
      status: 503,
      rawBody: JSON.stringify({
        detail: '连接模型服务失败：上游服务暂时不可用',
      }),
    });
    await seedDocumentRequirement(page, {
      text: '需求：验证代理 HTTP 503 时，生成记录会保留真实错误详情。',
      requirementLabel: 'XMind代理503需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind代理503需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('本次生成未成功');
    await expect(latestCard).toContainText('失败原因：');
    await expect(latestCard).toContainText('模型服务暂时不可用，请稍后重试。');
    await expect(latestCard).toContainText('错误信息：HTTP 503：连接模型服务失败：上游服务暂时不可用');
  });

  test('根节点支持生成全量模块与生成全量用例，并在刷新后恢复共享结果', async ({ page }) => {
    const token = 'token-xmind-root';
    const user = { id: 2, username: 'demo_user_2', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    const workflowUrl = await gotoCasesgenWorkflow(page);

    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 420);
    await seedDocumentRequirement(page, {
      text: '需求：支持登录与支付模块的完整测试覆盖。',
      requirementLabel: 'XMind根节点需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind根节点需求');

    await openNodeContextMenu(page, 'XMind根节点需求');
    const initialItems = await getContextMenuItems(page);
    expect(initialItems.map((item) => item.label)).toEqual(['生成全量用例', '生成全量模块']);
    await clickContextMenuAction(page, '生成全量模块');

    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');

    await openNodeContextMenu(page, 'XMind根节点需求');
    const skeletonItems = await getContextMenuItems(page);
    expect(skeletonItems.map((item) => item.label)).toEqual([
      '重新生成全量用例',
      '重新生成模块',
      '已有模块补全用例',
      '补全模块',
      '补全模块+用例',
      '放弃本次生成',
    ]);
    expect(skeletonItems[5].disabled).toBe(false);
    await clickContextMenuAction(page, '重新生成全量用例');

    await waitForNodeStatus(page, 'XMind根节点需求', '生成中');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeStatusAbsent(page, 'XMind根节点需求');

    const stateWithCases = await readState(page);
    const loginModuleWithCases = (stateWithCases.caseGenModules || []).find((item) => String(item.title || '') === '登录模块');
    expect(loginModuleWithCases).toBeTruthy();
    const loginCasesBeforeRegenModules = await readCaseResults(page, loginModuleWithCases.id);
    expect(loginCasesBeforeRegenModules.length).toBeGreaterThan(0);
    expect(loginCasesBeforeRegenModules[0].steps[0]).toMatch(/^1、/);
    expect(loginCasesBeforeRegenModules[0].steps[1]).toMatch(/^2、/);
    const renderedStepsNodeText = await page.evaluate(() => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      var found = '';
      Array.prototype.some.call(nodes, function(node) {
        var textEl = node && node.querySelector ? node.querySelector('.text') : null;
        var content = textEl && typeof textEl.innerText === 'string'
          ? String(textEl.innerText || '')
          : (textEl && textEl.textContent ? String(textEl.textContent || '') : '');
        if (content.indexOf('1、进入登录模块') === -1) return false;
        if (content.indexOf('2、执行登录成功校验') === -1) return false;
        found = content;
        return true;
      });
      return found;
    });
    expect(renderedStepsNodeText).toBeTruthy();
    expect(renderedStepsNodeText).not.toContain(' / ');

    await openNodeContextMenu(page, 'XMind根节点需求');
    const regenItems = await getContextMenuItems(page);
    expect(regenItems.map((item) => item.label)).toEqual([
      '重新生成全量用例',
      '重新生成模块',
      '已有模块补全用例',
      '补全模块',
      '补全模块+用例',
      '放弃本次生成',
    ]);

    await clickContextMenuAction(page, '重新生成全量用例');
    await waitForNodeStatus(page, 'XMind根节点需求', '生成中');
    await waitForNodeTextAbsent(page, '登录模块');
    await waitForNodeTextAbsent(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');
    await waitForNodeStatusAbsent(page, 'XMind根节点需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeText(page, '登录成功校验');

    const stateAfterRegenCases = await readState(page);
    const loginModuleAfterRegenCases = (stateAfterRegenCases.caseGenModules || []).find((item) => String(item.title || '') === '登录模块');
    expect(loginModuleAfterRegenCases).toBeTruthy();
    const loginCasesAfterRegenCases = await readCaseResults(page, loginModuleAfterRegenCases.id);
    expect(loginCasesAfterRegenCases.length).toBeGreaterThan(0);
    const lastRootFullCasesCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      for (var i = calls.length - 1; i >= 0; i -= 1) {
        var item = calls[i];
        if (!item || !item.contract) continue;
        if (String(item.contract.scope || '') !== 'root') continue;
        if (String(item.contract.mode || '') !== 'full_cases') continue;
        return {
          user: String(item.user || ''),
          prompt: String(item.prompt || ''),
        };
      }
      return null;
    });
    expect(lastRootFullCasesCall).toBeTruthy();
    expect(lastRootFullCasesCall.user).toContain('【需求正文】\n需求：支持登录与支付模块的完整测试覆盖。');
    expect(lastRootFullCasesCall.user).toContain('【当前可见模块与用例(JSON)】\n[]');
    expect(lastRootFullCasesCall.user).toContain('【当前 AI 生成层(JSON)】\n[]');

    await openNodeContextMenu(page, 'XMind根节点需求');
    await clickContextMenuAction(page, '重新生成模块');
    await waitForNodeStatus(page, 'XMind根节点需求', '生成中');
    await waitForNodeTextAbsent(page, '登录模块');
    await waitForNodeTextAbsent(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');
    await waitForNodeStatusAbsent(page, 'XMind根节点需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');

    const stateBeforeReload = await readState(page);
    const loginModule = (stateBeforeReload.caseGenModules || []).find((item) => String(item.title || '') === '登录模块');
    expect(loginModule).toBeTruthy();
    const loginCases = await readCaseResults(page, loginModule.id);
    expect(loginCases.length).toBe(0);

    await page.goto(workflowUrl);
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await page.waitForFunction(() => {
      var api = window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
      return Boolean(api && typeof api.renderMindMap === 'function');
    }, {}, { timeout: 20000 });
    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');
  });

  test('导入用例作为主树基线后，根节点动作矩阵切换为补全模式并支持回滚到基线', async ({ page }) => {
    const token = 'token-xmind-baseline';
    const user = { id: 3, username: 'demo_user_3', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：在已有参考用例基础上补全消息模块与登录补充用例。',
      requirementLabel: 'XMind基线需求',
    });
    await seedImportedBaseline(page, [{
      module: '登录模块',
      title: '登录模块-基线用例',
      priority: 'P1',
      preconditions: '账号已存在',
      steps: ['1、进入登录页', '2、输入账号密码'],
      expected: '登录成功',
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'import',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块-基线用例');

    await openNodeContextMenu(page, 'XMind基线需求');
    const baselineItems = await getContextMenuItems(page);
    expect(baselineItems.map((item) => item.label)).toEqual([
      '补全模块',
      '补全模块+用例',
      '追加生成全部模块+用例',
      '放弃本次生成',
    ]);
    expect(baselineItems[3].disabled).toBe(true);
    await clickContextMenuAction(page, '追加生成全部模块+用例');

    await waitForNodeText(page, '登录模块-追加-1');
    await waitForNodeText(page, '消息模块');
    await waitForNodeText(page, '消息模块新增用例');

    await openNodeContextMenu(page, 'XMind基线需求');
    const afterAppendItems = await getContextMenuItems(page);
    expect(afterAppendItems[3].disabled).toBe(false);
    await clickContextMenuAction(page, '放弃本次生成');

    await waitForNodeText(page, '登录模块-基线用例');
    await waitForNodeTextAbsent(page, '登录模块-追加-1');
    await waitForNodeTextAbsent(page, '消息模块新增用例');
    await waitForNodeTextAbsent(page, '消息模块');
  });

  test('模块可并发生成，且根节点补模块动作不会阻塞现有模块生成', async ({ page }) => {
    const token = 'token-xmind-concurrency';
    const user = { id: 31, username: 'demo_user_31', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 900);
    await seedDocumentRequirement(page, {
      text: '需求：登录与支付模块允许独立生成，同时根节点可补充新模块。',
      requirementLabel: 'XMind并发需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await clickXmindNodeQuickAction(page, '登录模块');
    await waitForNodeStatus(page, '登录模块', '生成中');

    await openNodeContextMenu(page, 'XMind并发需求');
    const rootItemsWhileModuleRunning = await getContextMenuItems(page);
    expect(rootItemsWhileModuleRunning.find((item) => item.label === '重新生成全量用例').disabled).toBe(true);
    expect(rootItemsWhileModuleRunning.find((item) => item.label === '已有模块补全用例').disabled).toBe(true);
    expect(rootItemsWhileModuleRunning.find((item) => item.label === '补全模块').disabled).toBe(false);
    expect(rootItemsWhileModuleRunning.find((item) => item.label === '补全模块+用例').disabled).toBe(false);
    await clickContextMenuAction(page, '补全模块');
    await waitForNodeStatus(page, 'XMind并发需求', '生成中');

    await openNodeContextMenu(page, '支付模块');
    const payItemsWhileRootRunning = await getContextMenuItems(page);
    expect(payItemsWhileRootRunning.find((item) => item.label === '生成全量用例').disabled).toBe(false);
    expect(payItemsWhileRootRunning.find((item) => item.label === '追加生成').disabled).toBe(true);
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeStatus(page, '支付模块', '生成中');

    const runningState = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var xmind = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      var moduleMap = xmind && xmind.modules ? xmind.modules : {};
      var moduleRunningCount = Object.keys(moduleMap).filter(function(key) {
        return moduleMap[key] && moduleMap[key].running === true;
      }).length;
      return {
        rootRunning: Boolean(xmind && xmind.root && xmind.root.running === true),
        moduleRunningCount: moduleRunningCount,
      };
    });
    expect(runningState.rootRunning).toBe(true);
    expect(runningState.moduleRunningCount).toBeGreaterThanOrEqual(2);

    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeText(page, '支付模块-完整-1');
    await waitForNodeText(page, '消息模块');
    await waitForNodeStatusAbsent(page, '登录模块');
    await waitForNodeStatusAbsent(page, '支付模块');
    await waitForNodeStatusAbsent(page, 'XMind并发需求');
  });

  test('根节点追加全部模块+用例期间会阻塞模块用例生成', async ({ page }) => {
    const token = 'token-xmind-root-blocks-module';
    const user = { id: 32, username: 'demo_user_32', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 900);
    await seedDocumentRequirement(page, {
      text: '需求：基于参考用例追加补全所有模块和用例。',
      requirementLabel: 'XMind根冲突需求',
    });
    await seedImportedBaseline(page, [{
      module: '登录模块',
      title: '登录模块-基线用例',
      priority: 'P1',
      preconditions: '账号已存在',
      steps: ['1、进入登录页', '2、输入账号密码'],
      expected: '登录成功',
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'import',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块-基线用例');

    await openNodeContextMenu(page, 'XMind根冲突需求');
    await clickContextMenuAction(page, '追加生成全部模块+用例');
    await waitForNodeStatus(page, 'XMind根冲突需求', '生成中');

    await openNodeContextMenu(page, '登录模块');
    const moduleItemsWhileRootAppendRunning = await getContextMenuItems(page);
    expect(moduleItemsWhileRootAppendRunning.find((item) => item.label === '生成全量用例').disabled).toBe(true);
    expect(moduleItemsWhileRootAppendRunning.find((item) => item.label === '追加生成').disabled).toBe(true);
    expect(moduleItemsWhileRootAppendRunning.find((item) => item.label === '放弃本次生成').disabled).toBe(true);

    await waitForNodeText(page, '登录模块-追加-1');
    await waitForNodeText(page, '消息模块新增用例');
    await waitForNodeStatusAbsent(page, 'XMind根冲突需求');
  });

  test('根节点放弃本次生成按全局最近一次快照回退，不会误吞更早的模块骨架', async ({ page }) => {
    const token = 'token-xmind-global-rollback';
    const user = { id: 35, username: 'demo_user_35', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 220);
    await seedDocumentRequirement(page, {
      text: '需求：先由根节点生成模块，再由模块单独生成用例，根节点放弃时只回退最近一次模块生成。',
      requirementLabel: 'XMind全局快照需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind全局快照需求');

    await openNodeContextMenu(page, 'XMind全局快照需求');
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');

    await openNodeContextMenu(page, '登录模块');
    var loginModuleItems = await getContextMenuItems(page);
    expect(loginModuleItems.find((item) => item.label === '放弃本次生成').disabled).toBe(false);

    await openNodeContextMenu(page, '支付模块');
    var payModuleItems = await getContextMenuItems(page);
    expect(payModuleItems.find((item) => item.label === '放弃本次生成').disabled).toBe(true);

    await openNodeContextMenu(page, 'XMind全局快照需求');
    await clickContextMenuAction(page, '放弃本次生成');

    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录模块-完整-1');

    await openNodeContextMenu(page, '登录模块');
    loginModuleItems = await getContextMenuItems(page);
    expect(loginModuleItems.find((item) => item.label === '放弃本次生成').disabled).toBe(true);

    await openNodeContextMenu(page, 'XMind全局快照需求');
    var rootItemsAfterRollback = await getContextMenuItems(page);
    expect(rootItemsAfterRollback.find((item) => item.label === '放弃本次生成').disabled).toBe(false);
  });

  test('根节点已有模块补全用例会为已有用例模块新增内容渲染独立虚线框', async ({ page }) => {
    const token = 'token-xmind-root-existing-cases-highlight';
    const user = { id: 34, username: 'demo_user_34', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 900);
    await seedDocumentRequirement(page, {
      text: '需求：针对已有模块继续补全缺漏用例，并给新增用例标记本轮补全范围。',
      requirementLabel: 'XMind已有模块补全需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录模块-完整-1',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码'],
        expected: '登录成功',
      }],
      'xmind-mod-pay': [{
        module: '支付模块',
        title: '支付模块-完整-1',
        priority: 'P1',
        preconditions: '订单已创建',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeText(page, '支付模块-完整-1');
    await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-fit"]');
    await page.waitForTimeout(120);

    await openNodeContextMenu(page, 'XMind已有模块补全需求');
    await clickContextMenuAction(page, '已有模块补全用例');

    await waitForNodeStatus(page, 'XMind已有模块补全需求', '生成中');
    await page.waitForFunction(() => {
      var moduleBadges = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-module .xmind-node-status-badge');
      var placeholders = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-topup-placeholder');
      var casePendingCount = 0;
      Array.prototype.forEach.call(placeholders, function(node) {
        if (String(node.textContent || '').indexOf('补全用例中') !== -1) casePendingCount += 1;
      });
      var pendingLinks = document.querySelectorAll('#xmindCaseGenMindContainer path[data-xmind-casegen-link="topup-pending"]');
      return moduleBadges.length === 0 && casePendingCount === 2 && pendingLinks.length >= 2;
    }, {}, { timeout: 15000 });
    const pendingQuickActionOverlap = await page.evaluate(() => {
      function intersects(a, b) {
        if (!a || !b) return false;
        return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      }
      var quickButtons = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-module .xmind-node-quick-action');
      var placeholders = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-topup-placeholder');
      var placeholderRects = [];
      Array.prototype.forEach.call(placeholders, function(node) {
        if (!node || !node.getBoundingClientRect) return;
        var text = String(node.textContent || '');
        if (text.indexOf('补全用例中') === -1) return;
        placeholderRects.push(node.getBoundingClientRect());
      });
      return Array.prototype.some.call(quickButtons, function(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        return placeholderRects.some(function(target) { return intersects(rect, target); });
      });
    });
    expect(pendingQuickActionOverlap).toBe(false);

    await waitForNodeText(page, '登录模块-补全用例');
    await waitForNodeText(page, '支付模块-补全用例');
    await waitForNodeStatusAbsent(page, '登录模块');
    await waitForNodeStatusAbsent(page, '支付模块');
    await waitForNodeStatusAbsent(page, 'XMind已有模块补全需求');
    await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-fit"]');
    await page.waitForTimeout(180);
    await page.waitForFunction(() => {
      var frames = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
      return frames && frames.length === 2;
    }, {}, { timeout: 15000 });

    const groups = await readTopupHighlightGroups(page);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((item) => item.token)).size).toBe(2);
    expect(groups.every((item) => item.label === '本轮追加用例')).toBeTruthy();
    expect(groups.every((item) => item.nodeCount >= 5)).toBeTruthy();

    const frames = await readAllTopupHighlightFrames(page);
    expect(frames).toHaveLength(2);
    expect(frames.every((item) => item.label === '本轮追加用例')).toBeTruthy();
    expect(frames.every((item) => item.highlightedNodeCount >= 5)).toBeTruthy();

    await page.evaluate(() => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
      var targetToken = '';
      Array.prototype.some.call(nodes, function(node) {
        var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
        if (!token || targetToken) return false;
        targetToken = token;
        return true;
      });
      if (!targetToken) return;
      Array.prototype.forEach.call(nodes, function(node) {
        var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
        if (token !== targetToken || !node || !node.style) return;
        node.style.transform = 'translateY(2200px)';
      });
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(260);

    const framesAfterOffscreen = await readAllTopupHighlightFrames(page);
    expect(framesAfterOffscreen).toHaveLength(2);
  });

  test('根节点补全模块会在追加位置展示生成中占位，并在完成后框选新增模块', async ({ page }) => {
    const token = 'token-xmind-root-topup-modules';
    const user = { id: 36, username: 'demo_user_36', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 320);
    await seedDocumentRequirement(page, {
      text: '需求：在已有模块基础上补全一个新模块，并对新增模块进行高亮标记。',
      requirementLabel: 'XMind根补模块需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind根补模块需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, 'XMind根补模块需求');
    await clickContextMenuAction(page, '补全模块');

    await page.waitForFunction(() => {
      var placeholders = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-topup-placeholder');
      var hasPlaceholder = Array.prototype.some.call(placeholders, function(node) {
        return String(node.textContent || '').indexOf('补全模块中') !== -1;
      });
      var hasPendingLink = Boolean(document.querySelector('#xmindCaseGenMindContainer path[data-xmind-casegen-link="topup-pending"]'));
      return hasPlaceholder && hasPendingLink;
    }, {}, { timeout: 15000 });

    await waitForNodeText(page, '消息模块');
    await page.waitForFunction(() => {
      var frames = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
      return frames && frames.length === 1;
    }, {}, { timeout: 15000 });

    const groups = await readTopupHighlightGroups(page);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('本轮补全模块');
    expect(groups[0].nodeCount).toBeGreaterThanOrEqual(1);

    const frames = await readAllTopupHighlightFrames(page);
    expect(frames).toHaveLength(1);
    expect(frames[0].label).toBe('本轮补全模块');
    expect(frames[0].highlightedNodeCount).toBeGreaterThanOrEqual(1);
    expect(frames[0].rect).toBeTruthy();
  });

  test('根节点补全模块+用例为多个新增模块分别渲染独立追加虚线框', async ({ page }) => {
    const token = 'token-xmind-root-topup-frames';
    const user = { id: 33, username: 'demo_user_33', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 220);
    await seedDocumentRequirement(page, {
      text: '需求：已有模块基础上补全两个中文模块，并分别生成 5 条补充用例。',
      requirementLabel: 'XMind根追加高亮需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind根追加高亮需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, 'XMind根追加高亮需求');
    await clickContextMenuAction(page, '补全模块+用例');
    await page.waitForFunction(() => {
      var placeholders = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-topup-placeholder');
      var hasPlaceholder = Array.prototype.some.call(placeholders, function(node) {
        return String(node.textContent || '').indexOf('补全模块+用例中') !== -1;
      });
      var hasPendingLink = Boolean(document.querySelector('#xmindCaseGenMindContainer path[data-xmind-casegen-link="topup-pending"]'));
      return hasPlaceholder && hasPendingLink;
    }, {}, { timeout: 15000 });

    await waitForNodeText(page, '技能按钮与界面状态');
    await waitForNodeText(page, '异常状态与边界处理');
    await waitForNodeText(page, '技能按钮与界面状态-补充-5');
    await waitForNodeText(page, '异常状态与边界处理-补充-5');

    await page.waitForFunction(() => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
      var groups = {};
      Array.prototype.forEach.call(nodes, function(node) {
        var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
        if (!token) return;
        groups[token] = true;
      });
      return Object.keys(groups).length === 2;
    }, {}, { timeout: 15000 });

    const groups = await readTopupHighlightGroups(page);
    expect(groups).toHaveLength(2);
    expect(groups.map((item) => item.label)).toEqual(['本轮补全模块+用例 · 5 条', '本轮补全模块+用例 · 5 条']);
    expect(new Set(groups.map((item) => item.token)).size).toBe(2);
    expect(groups.every((item) => item.nodeCount >= 26)).toBeTruthy();

    const frames = await readAllTopupHighlightFrames(page);
    expect(new Set(frames.map((item) => item.token)).size).toBe(frames.length);
    frames.forEach((item) => {
      expect(item.label).toBe('本轮补全模块+用例 · 5 条');
      expect(item.highlightedNodeCount).toBeGreaterThanOrEqual(26);
      expect(item.rect).toBeTruthy();
    });
    if (frames.length === 2) {
      expect(
        Math.abs(frames[0].rect.left - frames[1].rect.left) > 3
        || Math.abs(frames[0].rect.top - frames[1].rect.top) > 3
      ).toBeTruthy();
    }
  });

  test('模块节点 +AI 默认动作会从全量生成切换为追加生成，并支持追加高亮与放弃回滚', async ({ page }) => {
    const token = 'token-xmind-module';
    const user = { id: 4, username: 'demo_user_4', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 220);
    await seedDocumentRequirement(page, {
      text: '需求：仅针对登录模块进行全量与追加生成。',
      requirementLabel: 'XMind模块需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块');
    const quickActionScope = await page.evaluate(() => {
      var allButtons = document.querySelectorAll('#xmindCaseGenMindContainer .xmind-node-quick-action');
      var nonModuleButtons = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc:not(.xmind-casegen-node-module) .xmind-node-quick-action');
      return {
        all: allButtons.length,
        nonModule: nonModuleButtons.length,
      };
    });
    expect(quickActionScope.all).toBeGreaterThan(0);
    expect(quickActionScope.nonModule).toBe(0);

    await openNodeContextMenu(page, '登录模块');
    const emptyModuleItems = await getContextMenuItems(page);
    expect(emptyModuleItems.map((item) => item.label)).toEqual([
      '生成全量用例',
      '追加生成',
      '放弃本次生成',
      '删除',
    ]);
    expect(emptyModuleItems.find((item) => item.label === '生成全量用例').disabled).toBe(false);
    expect(emptyModuleItems.find((item) => item.label === '追加生成').disabled).toBe(true);
    expect(emptyModuleItems.find((item) => item.label === '放弃本次生成').disabled).toBe(true);

    let quickActionId = await getNodeQuickActionId(page, '登录模块');
    expect(quickActionId).toBe('module-full-cases');

    await clickXmindNodeQuickAction(page, '登录模块');
    await waitForNodeStatus(page, '登录模块', '生成中');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeStatusAbsent(page, '登录模块');

    await openNodeContextMenu(page, '登录模块');
    const fullCaseItems = await getContextMenuItems(page);
    expect(fullCaseItems.map((item) => item.label)).toEqual([
      '重新生成全量用例',
      '追加生成',
      '放弃本次生成',
      '删除',
    ]);
    await clickContextMenuAction(page, '重新生成全量用例');
    await waitForNodeStatus(page, '登录模块', '生成中');
    await waitForNodeTextAbsent(page, '登录模块-完整-1');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeStatusAbsent(page, '登录模块');

    quickActionId = await getNodeQuickActionId(page, '登录模块');
    expect(quickActionId).toBe('module-append');

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '追加生成');
    await waitForNodeText(page, '追加生成中');
    await page.waitForFunction(() => {
      return Boolean(document.querySelector('#xmindCaseGenMindContainer path[data-xmind-casegen-link="topup-pending"]'));
    }, {}, { timeout: 15000 });
    await waitForNodeText(page, '登录模块-追加-1');
    await page.waitForFunction(() => {
      var frame = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
      if (!frame) return false;
      var label = frame.querySelector('.xmind-casegen-topup-highlight-label');
      return Boolean(label && String(label.textContent || '').indexOf('本轮追加用例') !== -1);
    }, {}, { timeout: 15000 });
    await page.waitForFunction(() => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
      return nodes && nodes.length >= 5;
    }, {}, { timeout: 15000 });

    var metricsBeforePan = await readTopupHighlightMetrics(page);
    expect(metricsBeforePan).toBeTruthy();
    expect(metricsBeforePan.highlightedNodeCount).toBeGreaterThanOrEqual(5);
    expect(metricsBeforePan.frame.left).toBeLessThan(metricsBeforePan.union.left - 8);
    expect(metricsBeforePan.frame.top).toBeLessThan(metricsBeforePan.union.top - 8);
    expect(metricsBeforePan.frame.right).toBeGreaterThan(metricsBeforePan.union.right + 8);
    expect(metricsBeforePan.frame.bottom).toBeGreaterThan(metricsBeforePan.union.bottom + 8);

    var panResult = await panXmindCasegenCanvas(page, 160, 90);
    expect(panResult.dispatched).toBeTruthy();
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      if (!map || !map.style) return false;
      return String(map.style.transform || '') !== String(beforeTransform || '');
    }, panResult.before, { timeout: 15000 });

    var metricsAfterPan = await readTopupHighlightMetrics(page);
    expect(metricsAfterPan).toBeTruthy();
    expect(Math.abs(metricsAfterPan.frame.left - metricsBeforePan.frame.left)).toBeGreaterThan(10);
    expect(Math.abs(metricsAfterPan.union.left - metricsBeforePan.union.left)).toBeGreaterThan(10);
    expect(Math.abs((metricsAfterPan.frame.left - metricsBeforePan.frame.left) - (metricsAfterPan.union.left - metricsBeforePan.union.left))).toBeLessThan(3);
    expect(Math.abs((metricsAfterPan.frame.top - metricsBeforePan.frame.top) - (metricsAfterPan.union.top - metricsBeforePan.union.top))).toBeLessThan(3);

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '放弃本次生成');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeTextAbsent(page, '登录模块-追加-1');
    await page.waitForFunction(() => {
      return !document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
    }, {}, { timeout: 15000 });
  });

  test('用例子节点右键菜单支持删除，删除后会清空回退快照并以当前树为新的生成上下文', async ({ page }) => {
    const token = 'token-xmind-delete-case';
    const user = { id: 41, username: 'demo_user_41', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：允许在 XMind 中删除单条用例，并确保后续生成不再读取被删内容。',
      requirementLabel: 'XMind删除用例需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickXmindNodeQuickAction(page, '登录模块');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeText(page, '登录模块前置条件');
    await autoAcceptXmindConfirm(page);

    await openNodeContextMenu(page, '登录模块前置条件');
    const caseChildItems = await getContextMenuItems(page);
    expect(caseChildItems.map((item) => item.label)).toEqual(['删除']);
    expect(caseChildItems[0].disabled).toBe(false);
    await clickContextMenuAction(page, '删除');
    await page.waitForFunction(() => Boolean(window.__xmindConfirmPayload), {}, { timeout: 5000 });

    await waitForNodeTextAbsent(page, '登录模块-完整-1');

    const stateAfterDelete = await readState(page);
    expect(stateAfterDelete.xmindCaseGen.operationSnapshots).toEqual([]);
    expect(stateAfterDelete.xmindCaseGen.lastOperationSnapshotId).toBe('');
    expect(stateAfterDelete.xmindCaseGen.rootSnapshotId).toBe('');

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');

    const calls = await page.evaluate(() => window.__xmindCasegenCalls || []);
    const lastCall = calls[calls.length - 1] || null;
    expect(lastCall).toBeTruthy();
    expect(String(lastCall.user || '')).not.toContain('登录模块-完整-1');
  });

  test('支持按住 Ctrl 点击多个模块或用例后批量删除，后续生成上下文与当前可见树保持一致', async ({ page }) => {
    const token = 'token-xmind-delete-multi';
    const user = { id: 42, username: 'demo_user_42', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：支持多选批量删除模块和用例，删除后继续按当前画布生成。',
      requirementLabel: 'XMind批量删除需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码并提交'],
        expected: '提示账号或密码错误',
      }],
      'xmind-mod-pay': [{
        module: '支付模块',
        title: '支付成功校验',
        priority: 'P1',
        preconditions: '订单待支付',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付模块');
    await autoAcceptXmindConfirm(page);
    await clickXmindNode(page, '支付模块');
    await ctrlClickXmindNodes(page, ['登录成功校验']);
    await expect.poll(async () => {
      return await readSelectedXmindNodeCount(page);
    }).toBeGreaterThanOrEqual(2);
    await pressDeleteInXmind(page);
    await page.waitForFunction(() => Boolean(window.__xmindConfirmPayload), {}, { timeout: 5000 });

    await waitForNodeTextAbsent(page, '支付模块');
    await waitForNodeTextAbsent(page, '支付成功校验');
    await waitForNodeTextAbsent(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');

    const stateAfterDelete = await readState(page);
    expect((stateAfterDelete.caseGenModules || []).map((item) => item.title)).toEqual(['登录模块']);
    const loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录失败提示']);
    expect(stateAfterDelete.caseGenResults['xmind-mod-pay']).toBeUndefined();

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '重新生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');

    const calls = await page.evaluate(() => window.__xmindCasegenCalls || []);
    const lastCall = calls[calls.length - 1] || null;
    expect(lastCall).toBeTruthy();
    expect(String(lastCall.user || '')).not.toContain('支付模块');
    expect(String(lastCall.user || '')).not.toContain('登录成功校验');
    expect(String(lastCall.user || '')).toContain('登录失败提示');
  });

  test('工具栏支持撤回删除和恢复删除，且仅针对删除历史生效', async ({ page }) => {
    const token = 'token-xmind-delete-undo-toolbar';
    const user = { id: 45, username: 'demo_user_45', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：支持在 XMind 用例生成页撤回删除和恢复删除，且不影响生成历史。',
      requirementLabel: 'XMind删除撤回需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码并提交'],
        expected: '提示账号或密码错误',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');
    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenDeleteRedoBtn')).toBeDisabled();

    await autoAcceptXmindConfirm(page);
    await openNodeContextMenu(page, '登录成功校验');
    await clickContextMenuAction(page, '删除');
    await waitForNodeTextAbsent(page, '登录成功校验');

    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeEnabled();
    await expect(page.locator('#xmindCaseGenDeleteRedoBtn')).toBeDisabled();

    let stateAfterDelete = await readState(page);
    let loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录失败提示']);
    expect((stateAfterDelete.xmindCaseGen.deleteUndoStack || []).length).toBe(1);
    expect((stateAfterDelete.xmindCaseGen.deleteRedoStack || []).length).toBe(0);

    await page.click('#xmindCaseGenDeleteUndoBtn');
    await waitForNodeText(page, '登录成功校验');
    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenDeleteRedoBtn')).toBeEnabled();

    stateAfterDelete = await readState(page);
    loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录成功校验', '登录失败提示']);
    expect((stateAfterDelete.xmindCaseGen.deleteUndoStack || []).length).toBe(0);
    expect((stateAfterDelete.xmindCaseGen.deleteRedoStack || []).length).toBe(1);
    expect((stateAfterDelete.xmindCaseGen.operationSnapshots || []).length).toBe(0);

    await page.click('#xmindCaseGenDeleteRedoBtn');
    await waitForNodeTextAbsent(page, '登录成功校验');
    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeEnabled();
    await expect(page.locator('#xmindCaseGenDeleteRedoBtn')).toBeDisabled();

    stateAfterDelete = await readState(page);
    loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录失败提示']);
    expect((stateAfterDelete.xmindCaseGen.deleteUndoStack || []).length).toBe(1);
    expect((stateAfterDelete.xmindCaseGen.deleteRedoStack || []).length).toBe(0);
  });

  test('键盘快捷键支持撤回删除和恢复删除', async ({ page }) => {
    const token = 'token-xmind-delete-undo-shortcut';
    const user = { id: 46, username: 'demo_user_46', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：支持通过快捷键撤回删除和恢复删除。',
      requirementLabel: 'XMind删除快捷键需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
      'xmind-mod-pay': [{
        module: '支付模块',
        title: '支付成功校验',
        priority: 'P1',
        preconditions: '订单待支付',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '支付模块');
    await autoAcceptXmindConfirm(page);
    await openNodeContextMenu(page, '支付模块');
    await clickContextMenuAction(page, '删除');
    await waitForNodeTextAbsent(page, '支付模块');
    let stateAfterUndo = await readState(page);
    expect((stateAfterUndo.xmindCaseGen.deleteUndoStack || []).length).toBe(1);
    expect((stateAfterUndo.xmindCaseGen.deleteRedoStack || []).length).toBe(0);

    await pressDeleteUndoInXmind(page);
    await waitForNodeText(page, '支付模块');

    stateAfterUndo = await readState(page);
    expect((stateAfterUndo.caseGenModules || []).map((item) => item.title)).toEqual(['登录模块', '支付模块']);
    expect((stateAfterUndo.xmindCaseGen.deleteUndoStack || []).length).toBe(0);
    expect((stateAfterUndo.xmindCaseGen.deleteRedoStack || []).length).toBe(1);

    await pressDeleteRedoInXmind(page);
    await waitForNodeTextAbsent(page, '支付模块');

    stateAfterUndo = await readState(page);
    expect((stateAfterUndo.caseGenModules || []).map((item) => item.title)).toEqual(['登录模块']);
    expect((stateAfterUndo.xmindCaseGen.deleteUndoStack || []).length).toBe(1);
    expect((stateAfterUndo.xmindCaseGen.deleteRedoStack || []).length).toBe(0);
  });

  test('普通单击节点会保持单选高亮，并能从多选收敛为当前节点', async ({ page }) => {
    const token = 'token-xmind-single-select';
    const user = { id: 44, username: 'demo_user_44', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：XMind 只读画布支持普通单击选中节点，同时兼容 Ctrl 多选。',
      requirementLabel: 'XMind单击选中需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码并提交'],
        expected: '提示账号或密码错误',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');

    await clickXmindNode(page, '登录成功校验');
    await expect.poll(async () => {
      return await readSelectedXmindNodeCount(page);
    }).toBe(1);
    await expect.poll(async () => {
      return await readSelectedXmindNodeLabels(page);
    }).toEqual(['登录成功校验']);

    await ctrlClickXmindNodes(page, ['登录失败提示']);
    await expect.poll(async () => {
      return await readSelectedXmindNodeCount(page);
    }).toBeGreaterThanOrEqual(2);

    await clickXmindNode(page, '登录模块');
    await expect.poll(async () => {
      return await readSelectedXmindNodeCount(page);
    }).toBe(1);
    await expect.poll(async () => {
      return await readSelectedXmindNodeLabels(page);
    }).toEqual(['登录模块']);
  });

  test('支持鼠标框选多条用例后批量删除', async ({ page }) => {
    const token = 'token-xmind-delete-box';
    const user = { id: 43, username: 'demo_user_43', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：支持在 XMind 中通过鼠标框选多条用例，再统一删除。',
      requirementLabel: 'XMind框选删除需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码并提交'],
        expected: '提示账号或密码错误',
      }, {
        module: '登录模块',
        title: '登录态保持校验',
        priority: 'P2',
        preconditions: '账号已登录',
        steps: ['1、重新进入首页', '2、检查登录状态'],
        expected: '登录态保持有效',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');
    await waitForNodeText(page, '登录态保持校验');
    await autoAcceptXmindConfirm(page);
    await dragBoxSelectXmindNodes(page, ['登录成功校验', '登录失败提示']);
    await pressDeleteInXmind(page);
    await page.waitForFunction(() => Boolean(window.__xmindConfirmPayload), {}, { timeout: 5000 });

    await waitForNodeTextAbsent(page, '登录成功校验');
    await waitForNodeTextAbsent(page, '登录失败提示');
    await waitForNodeText(page, '登录态保持校验');

    const stateAfterDelete = await readState(page);
    const loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录态保持校验']);
  });

  test('工具栏保存入库会标红未生成用例的模块，并给出悬浮提示', async ({ page }) => {
    const token = 'token-xmind-store-missing-module';
    const user = { id: 44, username: 'demo_user_44', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：保存入库前需要拦截没有生成用例的模块。',
      requirementLabel: 'XMind保存前模块校验需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');

    await waitForNodeClass(page, '登录模块', 'xmind-casegen-node-invalid');
    await expect(page.locator('.temp-center-toast').last()).toContainText('未生成用例');
  });

  test('工具栏保存入库会标红结构不合法的用例，并给出悬浮提示', async ({ page }) => {
    const token = 'token-xmind-store-invalid-case';
    const user = { id: 45, username: 'demo_user_45', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：保存入库前需要拦截结构不完整的用例。',
      requirementLabel: 'XMind保存前用例校验需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录异常空步骤用例',
        priority: 'P1',
        preconditions: '',
        steps: [],
        expected: '给出失败提示',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');

    await waitForNodeClass(page, '登录异常空步骤用例', 'xmind-casegen-node-invalid');
    await expect(page.locator('.temp-center-toast').last()).toContainText('格式不符合入库要求');
  });

  test('无导入用例时，工具栏保存入库会进入新用例入库抽屉', async ({ page }) => {
    const token = 'token-xmind-store-new';
    const user = { id: 46, username: 'demo_user_46', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      projects: [{ id: 1, name: '项目A' }],
      versionsByProject: {
        '1': [{ id: 11, name: 'v1.0.0' }],
      },
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：无导入用例时，保存入库应走新用例入库流程。',
      requirementLabel: 'XMind新用例入库需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');

    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreDrawerTitle')).toContainText('新用例入库');
  });

  test('基线来自用例库选择时，工具栏保存入库会进入旧用例追加入库抽屉并预选目标用例', async ({ page }) => {
    const token = 'token-xmind-store-append';
    const user = { id: 47, username: 'demo_user_47', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      projects: [{ id: 1, name: '项目A' }],
      versionsByProject: {
        '1': [{ id: 11, name: 'v1.0.0' }],
      },
      caseFilesByProject: {
        '1': [{
          id: 401,
          project_id: 1,
          version_id: 11,
          file_name_clean: '登录基线用例',
        }],
      },
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await autoAcceptXmindConfirm(page);
    await seedDocumentRequirement(page, {
      text: '需求：从用例库选择基线后，保存入库应走追加入库流程。',
      requirementLabel: 'XMind追加入库需求',
    });
    await seedImportedBaseline(page, {
      list: [{
        module: '登录模块',
        title: '登录模块-基线用例',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码'],
        expected: '登录成功',
      }],
      meta: {
        sourceType: 'case-library-select',
        caseFileId: 401,
        projectId: 1,
        versionId: 11,
        fileName: '登录基线用例',
      },
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录模块-新增追加入例',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、执行新的补充动作'],
        expected: '补充用例执行成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'import',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');

    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreDrawerTitle')).toContainText('旧用例追加入库');
    await expect.poll(async () => {
      return await page.$eval('#caseGenDbStoreProjectSelect', (el) => String(el.value || ''));
    }).toBe('1');
    await expect.poll(async () => {
      return await page.$eval('#caseGenDbStoreVersionSelect', (el) => String(el.value || ''));
    }).toBe('11');
    await expect.poll(async () => {
      return await page.$eval('#caseGenDbStoreCaseFileSelect', (el) => String(el.value || ''));
    }).toBe('401');
  });

  test('XMind 保存入库确认时不再提示未选择用例，成功后会自动清空当前结果并重置前置准备', async ({ page }) => {
    const token = 'token-xmind-store-no-selection-confirm';
    const user = { id: 48, username: 'demo_user_48', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      projects: [{ id: 1, name: '项目A' }],
      versionsByProject: {
        '1': [{ id: 11, name: 'v1.0.0' }],
      },
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await page.evaluate(() => {
      window.__xmindConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
    });
    await seedDocumentRequirement(page, {
      text: '需求：XMind 入库默认按当前保留结果入库，不应再提示未选择用例。',
      requirementLabel: 'XMind默认全量入库需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreEntryNameRow')).not.toHaveClass(/hidden/);
    await expect(page.locator('#caseGenDbStoreEntryNameInput')).toHaveValue('XMind默认全量入库需求');
    await page.fill('#caseGenDbStoreEntryNameInput', 'XMind默认全量入库需求-确认名');
    await page.selectOption('#caseGenDbStoreProjectSelect', '1');
    await page.selectOption('#caseGenDbStoreVersionSelect', '11');
    const importRequestPromise = page.waitForRequest((request) => {
      return request.url().indexOf('/api/case-files/import') !== -1 && request.method() === 'POST';
    });
    await page.click('#caseGenDbStoreConfirmBtn');
    const importRequest = await importRequestPromise;
    const importPayload = importRequest.postDataJSON ? importRequest.postDataJSON() : {};

    await expect.poll(async () => {
      return await page.evaluate(() => {
        return Array.isArray(window.__xmindConfirmPayloads) ? window.__xmindConfirmPayloads.length : 0;
      });
    }).toBe(0);
    expect(String(importPayload && importPayload.file_name)).toBe('XMind默认全量入库需求-确认名.xmind');
    await expect(page.locator('.temp-center-toast').last()).toContainText('用例入库成功');
    await expect.poll(async () => {
      return await page.evaluate(() => {
        return window.app && window.app.state && Array.isArray(window.app.state.caseGenModules)
          ? window.app.state.caseGenModules.length
          : -1;
      });
    }).toBe(0);

    const resetState = await page.evaluate(() => {
      var st = window.app && window.app.state ? window.app.state : {};
      return {
        rawText: document.getElementById('rawText') ? String(document.getElementById('rawText').value || '') : '',
        moduleCount: Array.isArray(st.caseGenModules) ? st.caseGenModules.length : -1,
        resultCount: st.caseGenResults && typeof st.caseGenResults === 'object' ? Object.keys(st.caseGenResults).length : -1,
        prep: st.xmindCaseGen && st.xmindCaseGen.prep ? {
          step: Number(st.xmindCaseGen.prep.step || 0),
          completed: st.xmindCaseGen.prep.completed === true,
          baseLocked: st.xmindCaseGen.prep.baseLocked === true,
        } : null,
      };
    });
    expect(resetState.rawText).toBe('');
    expect(resetState.moduleCount).toBe(0);
    expect(resetState.resultCount).toBe(0);
    expect(resetState.prep).not.toBeNull();
    expect(resetState.prep.step).toBe(1);
    expect(resetState.prep.completed).toBe(false);
    expect(resetState.prep.baseLocked).toBe(false);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();
  });
});
