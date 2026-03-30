const { test, expect } = require('@playwright/test');

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+bB9sAAAAASUVORK5CYII=',
  'base64'
);

async function gotoCasesgenWorkflow(page) {
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
  const modelId = String(modelRemoteId);

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
    if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
    if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
    if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
    if (pathName === '/api/models' && method === 'GET') {
      return respond(200, [{
        id: modelRemoteId,
        name: 'MockXmindCaseGenModel',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          provider: 'custom',
          baseUrl: 'https://mock-model.local/v1/chat/completions',
          apiKey: 'mock-key',
          model: 'mock-model',
          maxTokens: 1024,
        },
      }]);
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
    }
  }, {
    text: text,
    requirementLabel: requirementLabel,
  });
}

async function seedImportedBaseline(page, list) {
  const baseline = Array.isArray(list) && list.length ? list : [{
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
      }];
    }
  }, { list: baseline });
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

async function openXmindCaseGenDrawer(page) {
  await page.click('#caseGenModulesTabBtn');
  await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
  await page.click('#xmindCaseGenOpenBtn');
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
  expect(renderInfo.debug && renderInfo.debug.phase, JSON.stringify(renderInfo)).toBe('render-success');
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

async function clickXmindNodeQuickAction(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(topic) !== -1 && Boolean(node.querySelector && node.querySelector('.xmind-node-quick-action'));
    });
  }, topicText, { timeout: 15000 });
  const clicked = await page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
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
  async function dispatchContextMenu() {
    const opened = await page.evaluate((topic) => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      var target = null;
      Array.prototype.some.call(nodes, function(node) {
        var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
        if (content.indexOf(topic) === -1) return false;
        target = node;
        return true;
      });
      if (!target || !target.getBoundingClientRect) return false;
      var rect = target.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      target.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + (rect.width / 2),
        clientY: rect.top + (rect.height / 2),
        button: 2,
        buttons: 2,
      }));
      return true;
    }, topicText);
    expect(opened).toBeTruthy();
  }

  await dispatchContextMenu();
  try {
    await page.waitForFunction(() => {
      var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
      return buttons && buttons.length > 0;
    }, {}, { timeout: 3000 });
  } catch (err) {
    await dispatchContextMenu();
    await page.waitForFunction(() => {
      var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
      return buttons && buttons.length > 0;
    }, {}, { timeout: 10000 });
  }
  await expect(page.locator('.xmind-node-context-menu.is-open')).toBeVisible();
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
  const target = page.locator('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn', { hasText: label }).first();
  await expect(target).toBeVisible();
  await target.click();
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

  test('前置准备改为 3 步流程，并支持手填需求图片与最近步骤恢复', async ({ page }) => {
    const token = 'token-xmind-prep';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await page.waitForFunction(() => Boolean(document.querySelector('[data-xmind-casegen-inline-actions]')), {}, { timeout: 10000 });
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('步骤 1 / 3');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.check('input[name="xmindRequirementMode"][value="manual"]');
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
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('步骤 2 / 3');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');

    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('步骤 3 / 3');
    await page.fill('#xmindCaseGenOptionCustomRequirement', '标题保持简洁');
    await page.check('input[data-casegen-setting="needBoundary"]');
    await page.check('input[data-casegen-setting="needSpecial"]');
    await page.check('input[data-casegen-setting="specialWeakNetwork"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('步骤 3 / 3');

    const state = await readState(page);
    expect(state && state.xmindCaseGen && state.xmindCaseGen.prep).toBeTruthy();
    expect(state.xmindCaseGen.prep.requirementMode).toBe('manual');
    expect(state.xmindCaseGen.prep.caseImportMode).toBe('skip');
    expect(state.xmindCaseGen.prep.completed).toBe(true);
    expect(Array.isArray(state.xmindCaseGen.prep.manualRequirementBlocks)).toBeTruthy();
    expect(state.xmindCaseGen.prep.manualRequirementBlocks.length).toBe(2);
    expect(state.caseGenSettings.customRequirement).toBe('标题保持简洁');
    expect(state.caseGenSettings.needBoundary).toBe(true);
    expect(state.caseGenSettings.needSpecial).toBe(true);
    expect(state.caseGenSettings.specialWeakNetwork).toBe(true);
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
      '生成全量用例',
      '重新生成模块',
      '已有模块补全用例',
      '补全模块',
      '补全模块+用例',
      '放弃本次生成',
    ]);
    expect(skeletonItems[5].disabled).toBe(false);
    await clickXmindNodeQuickAction(page, 'XMind根节点需求');

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
    expect(rootItemsWhileModuleRunning.find((item) => item.label === '生成全量用例').disabled).toBe(true);
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

  test('根节点已有模块补全用例会为已有用例模块新增内容渲染独立虚线框', async ({ page }) => {
    const token = 'token-xmind-root-existing-cases-highlight';
    const user = { id: 34, username: 'demo_user_34', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 220);
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

    await openNodeContextMenu(page, 'XMind已有模块补全需求');
    await clickContextMenuAction(page, '已有模块补全用例');

    await waitForNodeText(page, '登录模块-补全用例');
    await waitForNodeText(page, '支付模块-补全用例');
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
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, 'XMind根追加高亮需求');
    await clickContextMenuAction(page, '补全模块+用例');

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
    expect(groups.map((item) => item.label)).toEqual(['本轮追加用例 · 5 条', '本轮追加用例 · 5 条']);
    expect(new Set(groups.map((item) => item.token)).size).toBe(2);
    expect(groups.every((item) => item.nodeCount >= 25)).toBeTruthy();

    const frames = await readAllTopupHighlightFrames(page);
    expect(new Set(frames.map((item) => item.token)).size).toBe(frames.length);
    frames.forEach((item) => {
      expect(item.label).toBe('本轮追加用例 · 5 条');
      expect(item.highlightedNodeCount).toBeGreaterThanOrEqual(25);
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

    await openNodeContextMenu(page, '登录模块');
    const emptyModuleItems = await getContextMenuItems(page);
    expect(emptyModuleItems.map((item) => item.label)).toEqual([
      '生成全量用例',
      '追加生成',
      '放弃本次生成',
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
});
