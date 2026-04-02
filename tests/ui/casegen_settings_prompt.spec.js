const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html?_=' + Date.now().toString(36));
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

async function setCasegenToggle(page, inputId, checked) {
  const input = page.locator('#' + inputId);
  const current = await input.isChecked();
  if (current === (checked === true)) return;
  await page.locator('label[for="' + inputId + '"]').click();
}

async function mockBasicApis(page, token, user) {
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
    if (pathName === '/api/models' && method === 'GET') return respond(200, []);
    if (pathName === '/api/features' && method === 'GET') return respond(200, []);
    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  });
}

async function mockCaseGenApisWithModel(page, token, user, options) {
  const opts = options || {};
  const modelRemoteId = opts.modelRemoteId || 901;
  const featureId = opts.featureId || 5001;
  const caseGenPrompt = opts.caseGenPrompt || '请仅输出 JSON 数组';
  const xmindCaseGenPrompt = opts.xmindCaseGenPrompt || '请仅输出 XMind JSON';
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
        name: 'MockCaseGenModel',
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
        },
      }]);
    }
    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  });

  return { modelId, modelRemoteId };
}

async function seedCaseGenModules(page, modules) {
  const list = Array.isArray(modules) && modules.length ? modules : [
    { module: '登录', key_scenarios: ['账号登录'], test_points: ['账号密码'], coupled_modules: ['用户中心'] },
    { module: '支付', key_scenarios: ['订单支付'], test_points: ['支付回调'], coupled_modules: ['商城'] },
    { module: '活动', key_scenarios: ['活动参与'], test_points: ['奖励发放'], coupled_modules: ['背包'] },
  ];
  await page.evaluate((payload) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('clean');
    const split = document.getElementById('splitResult');
    if (split) {
      split.removeAttribute('readonly');
      split.value = JSON.stringify(payload);
      split.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.requirementLabel = '提示词拼装需求';
      window.app.state.requirementLabelSource = 'ui-test';
    }
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('casesgen');
  }, list);
  await page.waitForFunction(() => {
    const state = window.app && window.app.state ? window.app.state : null;
    return state && Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
  }, {}, { timeout: 8000 });
}

async function openCaseGenActionDrawer(page, action) {
  const next = action === 'topup'
    ? '#caseGenAllTopupBtn'
    : (action === 'suggested' ? '#caseGenSuggestionGenerateBtn' : '#caseGenAllGenerateBtn');
  await page.click('#caseGenSettingsTabBtn');
  await expect(page.locator('#caseGenSettingsTabBtn')).toHaveClass(/is-active/);
  await page.click(next);
  await expect(page.locator('#caseGenActionDrawer')).toHaveClass(/open/);
}

async function confirmCaseGenActionDrawer(page) {
  await page.click('#caseGenActionDrawerConfirmBtn');
  await expect(page.locator('#caseGenActionDrawer')).not.toHaveClass(/open/);
}

async function cancelCaseGenActionDrawer(page) {
  await page.click('#caseGenActionDrawerCancelBtn');
  await expect(page.locator('#caseGenActionDrawer')).not.toHaveClass(/open/);
}

async function openModuleGenerateDrawer(page, moduleId) {
  await page.click('#caseGenModulesTabBtn');
  const target = moduleId
    ? '#casesGenerationContainer [data-generate="' + moduleId + '"]'
    : '#casesGenerationContainer [data-generate]';
  await page.click(target);
  await expect(page.locator('#caseGenModuleGenerateDrawer')).toHaveClass(/open/);
}

async function chooseModuleGenerateUseGlobal(page) {
  await expect(page.locator('#caseGenModuleGenerateGlobalPanel')).toHaveClass(/is-active/);
  await page.click('#caseGenModuleGenerateGlobalConfirmBtn');
  await expect(page.locator('#caseGenModuleGenerateDrawer')).not.toHaveClass(/open/);
}

async function chooseModuleGenerateUseLocal(page) {
  await page.click('#caseGenModuleGenerateLocalTabBtn');
  await expect(page.locator('#caseGenModuleGenerateLocalTabBtn')).toHaveClass(/is-active/);
  await expect(page.locator('#caseGenModuleGenerateLocalPanel')).toHaveClass(/is-active/);
}

async function confirmModuleGenerateUseLocal(page) {
  await page.click('#caseGenModuleGenerateLocalConfirmBtn');
  await expect(page.locator('#caseGenModuleGenerateDrawer')).not.toHaveClass(/open/);
}

async function chooseModuleGenerateTopup(page) {
  await page.click('#caseGenModuleGenerateTopupTabBtn');
  await expect(page.locator('#caseGenModuleGenerateTopupTabBtn')).toHaveClass(/is-active/);
  await expect(page.locator('#caseGenModuleGenerateTopupPanel')).toHaveClass(/is-active/);
}

async function confirmModuleGenerateTopup(page) {
  await page.click('#caseGenModuleGenerateTopupConfirmBtn');
  await expect(page.locator('#caseGenModuleGenerateDrawer')).not.toHaveClass(/open/);
}

async function waitCaseGenModelAssigned(page, expectedModelId) {
  await page.waitForFunction((modelId) => {
    const state = window.app && window.app.state ? window.app.state : null;
    if (!state || !state.assignments || !Array.isArray(state.models)) return false;
    return String(state.assignments.caseGenId || '') === String(modelId);
  }, expectedModelId, { timeout: 10000 });
}

async function installCaseGenPromptCapture(page) {
  await page.evaluate(() => {
    const client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    window.__casegenPromptSnapshots = [];
    client.proxyModelRequest = function(payload, signal) {
      const modelPayload = payload && payload.payload ? payload.payload : {};
      const messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
      const promptText = messages[0] && messages[0].content ? String(messages[0].content) : '';
      const userText = messages[1] && messages[1].content ? String(messages[1].content) : '';
      window.__casegenPromptSnapshots.push({
        prompt: promptText,
        user: userText,
      });
      const match = userText.match(/"targetModule"\s*:\s*"([^"]+)"/) || userText.match(/"module":"([^"]+)"/);
      const moduleName = match && match[1] ? match[1] : '模块';
      const isXmind = promptText.indexOf('operation_contract') !== -1
        || promptText.indexOf('XMind 用例生成页面') !== -1
        || promptText.indexOf('{modules:[') !== -1;
      const content = isXmind
        ? JSON.stringify({
            modules: [{
              module: moduleName,
              key_scenarios: ['账号登录'],
              test_points: ['账号密码'],
              coupled_modules: ['用户中心'],
              cases: [{
                module: moduleName,
                title: moduleName + '-用例',
                priority: 'P1',
                preconditions: '前置条件',
                steps: ['1、步骤一'],
                expected: '预期结果',
              }],
            }],
          })
        : JSON.stringify([{
            module: moduleName,
            title: moduleName + '-用例',
            priority: 'P1',
            preconditions: '前置条件',
            steps: ['步骤1'],
            expected: '预期结果',
          }]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            text: function() {
              return Promise.resolve(JSON.stringify({
                choices: [{ message: { content: content } }],
              }));
            },
          });
        }, 80);
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    };
  });
}

async function clickXmindNodeQuickAction(page, topicText) {
  await page.waitForFunction((topic) => {
    const nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      const content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(topic) !== -1 && Boolean(node.querySelector && node.querySelector('.xmind-node-quick-action'));
    });
  }, topicText, { timeout: 15000 });
  const clicked = await page.evaluate((topic) => {
    const nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    let target = null;
    Array.prototype.some.call(nodes, function(node) {
      const content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      target = node;
      return true;
    });
    if (!target || !target.querySelector) return false;
    const btn = target.querySelector('.xmind-node-quick-action');
    if (!btn || btn.disabled || typeof btn.click !== 'function') return false;
    btn.click();
    return true;
  }, topicText);
  expect(clicked).toBeTruthy();
}

async function openXmindRootContextMenu(page) {
  const target = page.locator('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text').first();
  await expect(target).toBeVisible();
  let opened = false;
  for (let i = 0; i < 4; i += 1) {
    await target.click({ button: 'right', force: true });
    try {
      await page.waitForFunction(() => {
        const buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
        return Boolean(buttons && buttons.length > 0);
      }, {}, { timeout: i === 0 ? 2500 : 1500 });
      opened = true;
      break;
    } catch (err) {
      opened = false;
    }
  }
  expect(opened).toBeTruthy();
}

async function clickXmindContextMenuAction(page, label) {
  const actionLabel = String(label || '').trim();
  await page.waitForFunction((text) => {
    const buttons = document.querySelectorAll('.xmind-node-context-menu-btn');
    return Array.prototype.some.call(buttons, function(btn) {
      return String(btn.textContent || '').trim() === String(text || '').trim();
    });
  }, actionLabel, { timeout: 10000 });
  const clicked = await page.evaluate((text) => {
    const buttons = document.querySelectorAll('.xmind-node-context-menu-btn');
    let target = null;
    Array.prototype.some.call(buttons, function(btn) {
      if (String(btn.textContent || '').trim() !== String(text || '').trim()) return false;
      target = btn;
      return true;
    });
    if (!target || target.disabled || typeof target.click !== 'function') return false;
    target.click();
    return true;
  }, actionLabel);
  expect(clicked).toBeTruthy();
}

test.describe('用例生成-设置项与跳转', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('全局设置会拼接到用例生成提示词', async ({ page }) => {
    const token = 'token-casegen-settings-prompt';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };

    await mockBasicApis(page, token, user);
    await gotoIndex(page);
    await seedCaseGenModules(page);

    await openCaseGenActionDrawer(page, 'generate');
    await expect(page.locator('#caseGenCustomRequirement')).toHaveValue('');
    await expect(page.locator('#caseGenNeedFunctionCondition')).toBeChecked();
    await expect(page.locator('#caseGenNeedNumericValidation')).toBeChecked();
    await expect(page.locator('#caseGenNeedBoundary')).not.toBeChecked();
    await expect(page.locator('#caseGenNeedMobile')).not.toBeChecked();
    await expect(page.locator('#caseGenNeedSpecial')).not.toBeChecked();
    await page.fill('#caseGenCustomRequirement', '标题尽量短，优先覆盖活动奖励回收。');
    await expect(page.locator('#caseGenSpecialRepeatOperation')).toBeDisabled();
    await setCasegenToggle(page, 'caseGenNeedBoundary', true);
    await setCasegenToggle(page, 'caseGenNeedMobile', true);
    await setCasegenToggle(page, 'caseGenNeedSpecial', true);
    await expect(page.locator('#caseGenSpecialRepeatOperation')).toBeEnabled();
    await setCasegenToggle(page, 'caseGenSpecialRepeatOperation', true);
    await setCasegenToggle(page, 'caseGenSpecialWeakNetwork', true);
    await confirmCaseGenActionDrawer(page);
    await expect(page.locator('#caseGenModulesTabBtn')).toHaveClass(/is-active/);
    await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
    await expect(page.locator('#casegenSettingsPanel')).not.toHaveClass(/is-active/);

    await page.waitForFunction(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      const settings = state && state.caseGenSettings ? state.caseGenSettings : null;
      return settings
        && settings.customRequirement === '标题尽量短，优先覆盖活动奖励回收。'
        && settings.needFunctionCondition === true
        && settings.needNumericValidation === true
        && settings.needBoundary === true
        && settings.needMobile === true
        && settings.needSpecial === true
        && settings.specialRepeatOperation === true
        && settings.specialWeakNetwork === true;
    }, {}, { timeout: 5000 });

    const promptInfo = await page.evaluate(() => {
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!api || typeof api.buildCaseGenPrompt !== 'function' || typeof api.getCaseGenPromptComponents !== 'function') {
        return null;
      }
      return {
        prompt: api.buildCaseGenPrompt('基础提示词'),
        parts: api.getCaseGenPromptComponents(),
      };
    });

    expect(promptInfo).not.toBeNull();
    expect(promptInfo.prompt).toContain('基础提示词');
    expect(promptInfo.prompt).toContain('用户附加要求：标题尽量短，优先覆盖活动奖励回收。');
    expect(promptInfo.prompt).toContain('生成时需要考虑功能使用条件');
    expect(promptInfo.prompt).toContain('生成时需要考虑数值验证');
    expect(promptInfo.prompt).toContain('生成时需要考虑边界场景');
    expect(promptInfo.prompt).toContain('生成时需要考虑移动设备操作');
    expect(promptInfo.prompt).toContain('生成时需要考虑特殊场景');
    expect(promptInfo.prompt).toContain('特殊场景需包含重复操作');
    expect(promptInfo.prompt).toContain('特殊场景需包含弱网环境');
    expect(promptInfo.prompt).not.toContain('特殊场景需包含多点触控');
    expect(promptInfo.parts.length).toBeGreaterThanOrEqual(7);

    await openCaseGenActionDrawer(page, 'generate');
    await expect(page.locator('#caseGenCustomRequirement')).toHaveValue('');
    await expect(page.locator('#caseGenNeedFunctionCondition')).toBeChecked();
    await expect(page.locator('#caseGenNeedNumericValidation')).toBeChecked();
    await expect(page.locator('#caseGenNeedBoundary')).not.toBeChecked();
    await expect(page.locator('#caseGenNeedMobile')).not.toBeChecked();
    await expect(page.locator('#caseGenNeedSpecial')).not.toBeChecked();
    await cancelCaseGenActionDrawer(page);
  });

  test('生成操作区确认后会自动切换到生成模块页签', async ({ page }) => {
    const token = 'token-casegen-batch-switch-tab';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      caseGenPrompt: '请仅输出 JSON 数组',
    });

    await gotoIndex(page);
    await seedCaseGenModules(page);
    await waitCaseGenModelAssigned(page, mockInfo.modelId);
    await installCaseGenPromptCapture(page);

    await openCaseGenActionDrawer(page, 'generate');
    await confirmCaseGenActionDrawer(page);

    await expect(page.locator('#caseGenModulesTabBtn')).toHaveClass(/is-active/);
    await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
    await expect(page.locator('#caseGenSettingsTabBtn')).not.toHaveClass(/is-active/);
    await expect(page.locator('#casegenSettingsPanel')).not.toHaveClass(/is-active/);

    await page.waitForFunction(() => {
      return window.__casegenPromptSnapshots && window.__casegenPromptSnapshots.length > 0;
    }, {}, { timeout: 10000 });
  });

  test('要求取消勾选后，重新生成不会保留已移除的提示词部件', async ({ page }) => {
    const token = 'token-casegen-settings-uncheck';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };

    await mockBasicApis(page, token, user);
    await gotoIndex(page);
    await seedCaseGenModules(page);

    await openCaseGenActionDrawer(page, 'generate');
    await setCasegenToggle(page, 'caseGenNeedBoundary', true);
    await setCasegenToggle(page, 'caseGenNeedSpecial', true);
    await setCasegenToggle(page, 'caseGenSpecialWeakNetwork', true);
    await setCasegenToggle(page, 'caseGenNeedBoundary', false);
    await setCasegenToggle(page, 'caseGenNeedSpecial', false);
    await confirmCaseGenActionDrawer(page);

    const promptInfo = await page.evaluate(() => {
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!api || typeof api.buildCaseGenPrompt !== 'function') {
        return null;
      }
      return api.buildCaseGenPrompt('基础提示词');
    });

    expect(promptInfo).not.toBeNull();
    expect(promptInfo).not.toContain('生成时需要考虑边界场景');
    expect(promptInfo).not.toContain('生成时需要考虑特殊场景');
    expect(promptInfo).not.toContain('特殊场景需包含弱网环境');
  });

  test('单模块生成先打开选择抽屉并展示当前模块信息', async ({ page }) => {
    const token = 'token-casegen-module-drawer';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };

    await mockBasicApis(page, token, user);
    await gotoIndex(page);
    await seedCaseGenModules(page);

    await openModuleGenerateDrawer(page);
    await expect(page.locator('#caseGenModuleGenerateDrawerModuleTitle')).toContainText('登录');
    await expect(page.locator('#caseGenModuleGenerateDrawerScenarios')).toContainText('账号登录');
    await expect(page.locator('#caseGenModuleGenerateDrawerPoints')).toContainText('账号密码');
    await expect(page.locator('#caseGenModuleGenerateDrawerCoupled')).toContainText('用户中心');
    await expect(page.locator('#caseGenModuleGenerateDrawerGlobalSummary')).toContainText('考虑功能使用条件');
    await expect(page.locator('#caseGenModuleGenerateDrawerGlobalSummary')).toContainText('数值验证');
    await expect(page.locator('#caseGenModuleGenerateGlobalTabBtn')).toBeVisible();
    await expect(page.locator('#caseGenModuleGenerateLocalTabBtn')).toBeVisible();
    await expect(page.locator('#caseGenModuleGenerateTopupTabBtn')).toBeVisible();
    await chooseModuleGenerateTopup(page);
    await expect(page.locator('#caseGenModuleTopupHint')).toContainText('当前模块暂无已生成用例');
    await expect(page.locator('#caseGenModuleGenerateTopupConfirmBtn')).toBeDisabled();
  });

  test('单模块生成选择走全局配置时，会沿用当前全局提示词设置', async ({ page }) => {
    const token = 'token-casegen-module-global';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      caseGenPrompt: '请仅输出 JSON 数组',
    });

    await gotoIndex(page);
    await seedCaseGenModules(page);
    await waitCaseGenModelAssigned(page, mockInfo.modelId);
    await installCaseGenPromptCapture(page);

    await page.evaluate(() => {
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!api || typeof api.setCaseGenSettingValue !== 'function') return;
      api.setCaseGenSettingValue('customRequirement', '全局要求：优先覆盖边界和弱网。');
      api.setCaseGenSettingValue('needBoundary', true);
      api.setCaseGenSettingValue('needSpecial', true);
      api.setCaseGenSettingValue('specialWeakNetwork', true);
    });

    await openModuleGenerateDrawer(page);
    await expect(page.locator('#caseGenModuleGenerateDrawerGlobalSummary')).toContainText('额外要求：全局要求：优先覆盖边界和弱网。');
    await expect(page.locator('#caseGenModuleGenerateDrawerGlobalSummary')).toContainText('考虑边界');
    await chooseModuleGenerateUseGlobal(page);

    await page.waitForFunction(() => {
      return window.__casegenPromptSnapshots && window.__casegenPromptSnapshots.length === 1;
    }, {}, { timeout: 10000 });

    const promptInfo = await page.evaluate(() => window.__casegenPromptSnapshots[0] || null);
    expect(promptInfo).not.toBeNull();
    expect(String(promptInfo.prompt || '')).toContain('用户附加要求：全局要求：优先覆盖边界和弱网。');
    expect(String(promptInfo.prompt || '')).toContain('生成时需要考虑边界场景');
    expect(String(promptInfo.prompt || '')).toContain('特殊场景需包含弱网环境');
  });

  test('单模块生成选择独立配置时，会覆盖全局且不会污染全局设置', async ({ page }) => {
    const token = 'token-casegen-module-local';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      caseGenPrompt: '请仅输出 JSON 数组',
    });

    await gotoIndex(page);
    await seedCaseGenModules(page);
    await waitCaseGenModelAssigned(page, mockInfo.modelId);
    await installCaseGenPromptCapture(page);

    await page.evaluate(() => {
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!api || typeof api.setCaseGenSettingValue !== 'function') return;
      api.setCaseGenSettingValue('customRequirement', '全局要求：默认关注边界。');
      api.setCaseGenSettingValue('needBoundary', true);
      api.setCaseGenSettingValue('needMobile', false);
    });

    await openModuleGenerateDrawer(page);
    await chooseModuleGenerateUseLocal(page);
    await expect(page.locator('#caseGenModuleLocalRequirement')).toHaveValue('');
    await expect(page.locator('#caseGenModuleLocalNeedFunctionCondition')).toBeChecked();
    await expect(page.locator('#caseGenModuleLocalNeedNumericValidation')).toBeChecked();
    await expect(page.locator('#caseGenModuleLocalNeedBoundary')).not.toBeChecked();
    await expect(page.locator('#caseGenModuleLocalNeedMobile')).not.toBeChecked();

    await page.fill('#caseGenModuleLocalRequirement', '仅当前模块考虑移动端手势。');
    await setCasegenToggle(page, 'caseGenModuleLocalNeedMobile', true);
    await confirmModuleGenerateUseLocal(page);

    await page.waitForFunction(() => {
      return window.__casegenPromptSnapshots && window.__casegenPromptSnapshots.length === 1;
    }, {}, { timeout: 10000 });

    const promptInfo = await page.evaluate(() => window.__casegenPromptSnapshots[0] || null);
    expect(promptInfo).not.toBeNull();
    expect(String(promptInfo.prompt || '')).toContain('用户附加要求：仅当前模块考虑移动端手势。');
    expect(String(promptInfo.prompt || '')).toContain('生成时需要考虑移动设备操作');
    expect(String(promptInfo.prompt || '')).not.toContain('全局要求：默认关注边界。');
    expect(String(promptInfo.prompt || '')).not.toContain('生成时需要考虑边界场景');

    const globalPrompt = await page.evaluate(() => {
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!api || typeof api.buildCaseGenPrompt !== 'function') return '';
      return api.buildCaseGenPrompt('基础提示词');
    });
    expect(globalPrompt).toContain('用户附加要求：全局要求：默认关注边界。');
    expect(globalPrompt).toContain('生成时需要考虑边界场景');
    expect(globalPrompt).not.toContain('仅当前模块考虑移动端手势。');
    expect(globalPrompt).not.toContain('生成时需要考虑移动设备操作');
  });

  test('单模块补全生成不继承全局勾选，只执行补全逻辑', async ({ page }) => {
    const token = 'token-casegen-module-topup';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      caseGenPrompt: '请仅输出 JSON 数组',
    });

    await gotoIndex(page);
    await seedCaseGenModules(page);
    await waitCaseGenModelAssigned(page, mockInfo.modelId);
    await installCaseGenPromptCapture(page);

    await page.evaluate(() => {
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      const state = window.app && window.app.state ? window.app.state : null;
      if (api && typeof api.setCaseGenSettingValue === 'function') {
        api.setCaseGenSettingValue('needBoundary', true);
        api.setCaseGenSettingValue('needMobile', true);
        api.setCaseGenSettingValue('customRequirement', '全局要求：不应进入模块补全。');
      }
      if (!state || !Array.isArray(state.caseGenModules) || !state.caseGenModules.length) return;
      if (!state.caseGenSuggestions || typeof state.caseGenSuggestions !== 'object') {
        state.caseGenSuggestions = {};
      }
      const mod = state.caseGenModules[0];
      const moduleTitle = mod && (mod.title || mod.module) ? String(mod.title || mod.module) : '登录';
      state.caseGenSuggestions[mod.id] = '模块原始建议';
      state.caseGenResults[mod.id] = JSON.stringify([{
        module: moduleTitle,
        title: moduleTitle + '-已有用例',
        priority: 'P1',
        preconditions: '前置条件',
        steps: ['步骤1'],
        expected: '预期结果',
      }], null, 2);
      if (api && typeof api.renderCaseGeneration === 'function') {
        api.renderCaseGeneration();
      }
    });

    await openModuleGenerateDrawer(page);
    await chooseModuleGenerateTopup(page);
    await expect(page.locator('#caseGenModuleTopupSuggestion')).toHaveValue('模块原始建议');
    await page.fill('#caseGenModuleTopupSuggestion', '抽屉内改过的补全建议');
    await confirmModuleGenerateTopup(page);

    await page.waitForFunction(() => {
      return window.__casegenPromptSnapshots && window.__casegenPromptSnapshots.length === 1;
    }, {}, { timeout: 10000 });

    const promptInfo = await page.evaluate(() => window.__casegenPromptSnapshots[0] || null);
    expect(promptInfo).not.toBeNull();
    expect(String(promptInfo.prompt || '')).not.toContain('全局要求：不应进入模块补全。');
    expect(String(promptInfo.prompt || '')).not.toContain('生成时需要考虑边界场景');
    expect(String(promptInfo.prompt || '')).not.toContain('生成时需要考虑移动设备操作');
    expect(String(promptInfo.user || '')).toContain('额外要求：抽屉内改过的补全建议');
    expect(String(promptInfo.user || '')).toContain('已有用例(JSON)');
    expect(String(promptInfo.user || '')).toContain('请在不重复的前提下补充新的测试用例');
    await expect(page.locator('#casesGenerationContainer textarea[data-suggestion]').first()).toHaveValue('抽屉内改过的补全建议');
  });

  test('抽屉内取消选择不会污染已确认的全局要求', async ({ page }) => {
    const token = 'token-casegen-settings-cancel';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };

    await mockBasicApis(page, token, user);
    await gotoIndex(page);
    await seedCaseGenModules(page);

    await openCaseGenActionDrawer(page, 'generate');
    await page.fill('#caseGenCustomRequirement', '这次不要保留');
    await setCasegenToggle(page, 'caseGenNeedBoundary', true);
    await setCasegenToggle(page, 'caseGenNeedSpecial', true);
    await cancelCaseGenActionDrawer(page);

    const promptInfo = await page.evaluate(() => {
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!api || typeof api.buildCaseGenPrompt !== 'function') {
        return null;
      }
      return api.buildCaseGenPrompt('基础提示词');
    });

    expect(promptInfo).not.toBeNull();
    expect(promptInfo).not.toContain('用户附加要求：这次不要保留');
    expect(promptInfo).not.toContain('生成时需要考虑边界场景');
    expect(promptInfo).not.toContain('生成时需要考虑特殊场景');
  });

  test('全模块生成会锁定启动时的要求快照，不受生成中途取消勾选影响', async ({ page }) => {
    const token = 'token-casegen-settings-batch-snapshot';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const modules = Array.from({ length: 6 }).map((_, idx) => ({
      module: '模块' + (idx + 1),
      key_scenarios: ['场景' + (idx + 1)],
      test_points: ['要点' + (idx + 1)],
      coupled_modules: [],
    }));

    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      caseGenPrompt: '请仅输出 JSON 数组',
    });
    await gotoIndex(page);
    await seedCaseGenModules(page, modules);

    await page.waitForFunction((expectedModelId) => {
      const state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.assignments || !Array.isArray(state.models)) return false;
      return String(state.assignments.caseGenId || '') === String(expectedModelId);
    }, mockInfo.modelId, { timeout: 10000 });

    await page.evaluate(() => {
      const client = window.app && window.app.apiClient ? window.app.apiClient : null;
      if (!client) return;
      window.__casegenPromptSnapshots = [];
      client.proxyModelRequest = function(payload, signal) {
        const modelPayload = payload && payload.payload ? payload.payload : {};
        const messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
        const promptText = messages[0] && messages[0].content ? String(messages[0].content) : '';
        const userText = messages[1] && messages[1].content ? String(messages[1].content) : '';
        window.__casegenPromptSnapshots.push(promptText);
        const match = userText.match(/"module":"([^"]+)"/);
        const moduleName = match && match[1] ? match[1] : '模块';
        const content = JSON.stringify([{
          module: moduleName,
          title: moduleName + '-用例',
          priority: 'P1',
          preconditions: '前置条件',
          steps: ['步骤1'],
          expected: '预期结果',
        }]);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              text: function() {
                return Promise.resolve(JSON.stringify({
                  choices: [{ message: { content: content } }],
                }));
              },
            });
          }, 180);
          if (signal && typeof signal.addEventListener === 'function') {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('aborted'));
            }, { once: true });
          }
        });
      };
    });

    await openCaseGenActionDrawer(page, 'generate');
    await expect(page.locator('#caseGenNeedFunctionCondition')).toBeChecked();
    await expect(page.locator('#caseGenNeedNumericValidation')).toBeChecked();
    await setCasegenToggle(page, 'caseGenNeedBoundary', true);
    await confirmCaseGenActionDrawer(page);

    await page.evaluate(() => {
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (api && typeof api.setCaseGenSettingValue === 'function') {
        api.setCaseGenSettingValue('needBoundary', false);
        return;
      }
      const state = window.app && window.app.state ? window.app.state : null;
      if (state && state.caseGenSettings) state.caseGenSettings.needBoundary = false;
    });

    await page.waitForFunction(() => {
      return window.__casegenPromptSnapshots && window.__casegenPromptSnapshots.length === 6;
    }, {}, { timeout: 10000 });

    const prompts = await page.evaluate(() => window.__casegenPromptSnapshots || []);
    expect(prompts).toHaveLength(6);
    prompts.forEach((item) => {
      expect(String(item || '')).toContain('生成时需要考虑边界场景');
    });
  });

  test('左侧进度点击会切到生成模块页签并定位目标模块', async ({ page }) => {
    const token = 'token-casegen-progress-jump';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };

    await mockBasicApis(page, token, user);
    await gotoIndex(page);
    await seedCaseGenModules(page);

    const targetModuleId = await page.evaluate(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      if (!state || !Array.isArray(state.caseGenModules) || state.caseGenModules.length < 2) return '';
      state.caseGenModules.forEach((mod) => {
        const title = mod && (mod.title || mod.module) ? String(mod.title || mod.module) : '模块';
        const payload = [{
          module: title,
          title: title + '-用例',
          priority: 'P1',
          preconditions: '前置条件',
          steps: ['步骤1', '步骤2'],
          expected: '预期结果',
        }];
        state.caseGenResults[mod.id] = JSON.stringify(payload, null, 2);
      });
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      }
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGenProgressBoard === 'function') {
        window.app.casesGenApi.renderCaseGenProgressBoard();
      }
      if (window.app.casesGenApi && typeof window.app.casesGenApi.setCaseGenViewTab === 'function') {
        window.app.casesGenApi.setCaseGenViewTab('settings', { persist: false });
      }
      return String(state.caseGenModules[1].id || '');
    });

    await expect(page.locator('#caseGenSettingsTabBtn')).toHaveClass(/is-active/);
    await page.click('#sidebarTabCasegen');
    await expect(page.locator('[data-sidebar-panel="casegen"].is-active')).toBeVisible();
    await page.locator('[data-sidebar-panel="casegen"] [data-casegen-module="' + targetModuleId + '"]').dispatchEvent('click');

    await expect(page.locator('#caseGenModulesTabBtn')).toHaveClass(/is-active/);
    await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
    await expect(page.locator('#caseGenViewDrawer')).toHaveClass(/open/);

    const box = await page.locator('#casesGenerationContainer [data-module-id="' + targetModuleId + '"]').boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeLessThan(720);
  });

  test('XMind 用例生成抽屉使用专属指派与提示词拼装', async ({ page }) => {
    const token = 'token-casegen-settings-xmind';
    const user = { id: 8, username: 'demo_user_8', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      caseGenPrompt: '普通用例提示词',
      xmindCaseGenPrompt: '基础提示词-XMind页',
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/ai-workflow.html?tab=casesgen&_=' + Date.now().toString(36));
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await page.waitForFunction(() => {
      const api = window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
      let globalObj = null;
      if (typeof MindElixir !== 'undefined') globalObj = MindElixir;
      else if (window && window.MindElixir) globalObj = window.MindElixir;
      const hasCtor = typeof globalObj === 'function' || Boolean(globalObj && typeof globalObj.default === 'function');
      return Boolean(api && typeof api.renderMindMap === 'function' && hasCtor);
    }, {}, { timeout: 20000 });
    await page.waitForFunction((modelId) => {
      const state = window.app && window.app.state ? window.app.state : null;
      return Boolean(
        state &&
        state.assignments &&
        String(state.assignments.xmindCaseGenId || '') === String(modelId || '')
      );
    }, mockInfo.modelId, { timeout: 10000 });

    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await page.click('#caseGenModulesTabBtn');
    await page.click('#xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await page.waitForTimeout(500);
    await page.waitForFunction(() => {
      const controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
      const debug = window.app && window.app.__xmindCasegenDebug ? window.app.__xmindCasegenDebug : null;
      if (controls && controls.getBoundingClientRect && controls.getBoundingClientRect().width > 0) return true;
      return Boolean(debug && (debug.phase === 'render-success' || /error/.test(String(debug.phase || ''))));
    }, {}, { timeout: 15000 });
    const renderInfo = await page.evaluate(() => {
      const controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
      const rect = controls && controls.getBoundingClientRect ? controls.getBoundingClientRect() : null;
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

    await page.evaluate(() => {
      const rawTextEl = document.getElementById('rawText');
      if (rawTextEl) {
        rawTextEl.removeAttribute('readonly');
        rawTextEl.value = '这是 XMind 专属提示词拼装测试需求。';
      }
      if (window.app && window.app.state) {
        window.app.state.requirementLabel = 'XMind提示词需求';
        window.app.state.requirementLabelSource = 'ui-test';
        window.app.state.xmindCaseGen = window.app.state.xmindCaseGen || {};
        window.app.state.xmindCaseGen.prep = {
          step: 3,
          requirementMode: 'document',
          requirementSupplement: '补充说明',
          manualRequirementBlocks: [],
          caseImportMode: 'skip',
          completed: true,
        };
      }
      if (rawTextEl) {
        rawTextEl.dispatchEvent(new Event('input', { bubbles: true }));
        rawTextEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await page.click('#xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.fill('#xmindCaseGenOptionCustomRequirement', 'XMind 页面专用要求');
    await expect(page.locator('[data-casegen-setting-card="needFunctionCondition"]')).toHaveClass(/is-on/);
    await expect(page.locator('[data-casegen-setting-card="needNumericValidation"]')).toHaveClass(/is-on/);
    await page.locator('input[data-casegen-setting="needBoundary"]').check({ force: true });
    await page.locator('input[data-casegen-setting="needSpecial"]').check({ force: true });
    await page.locator('input[data-casegen-setting="specialWeakNetwork"]').check({ force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await installCaseGenPromptCapture(page);
    await openXmindRootContextMenu(page);
    await clickXmindContextMenuAction(page, '生成全量用例');

    await page.waitForFunction(() => {
      return Array.isArray(window.__casegenPromptSnapshots) && window.__casegenPromptSnapshots.length > 0;
    }, {}, { timeout: 15000 });

    const lastPrompt = await page.evaluate(() => {
      const list = Array.isArray(window.__casegenPromptSnapshots) ? window.__casegenPromptSnapshots : [];
      return list.length ? list[list.length - 1] : null;
    });
    expect(lastPrompt).not.toBeNull();
    expect(String(lastPrompt.prompt || '')).toContain('基础提示词-XMind页');
    expect(String(lastPrompt.prompt || '')).toContain('用户附加要求：XMind 页面专用要求');
    expect(String(lastPrompt.prompt || '')).toContain('生成时需要考虑功能使用条件');
    expect(String(lastPrompt.prompt || '')).toContain('生成时需要考虑数值验证');
    expect(String(lastPrompt.prompt || '')).toContain('生成时需要考虑边界场景');
    expect(String(lastPrompt.prompt || '')).toContain('特殊场景需包含弱网环境');
    expect(String(lastPrompt.prompt || '')).toContain('用例标题 title 必须简洁明了');
    expect(String(lastPrompt.prompt || '')).toContain('steps 必须是数组');
    expect(String(lastPrompt.prompt || '')).toContain('1、xxx');
    expect(String(lastPrompt.prompt || '')).not.toContain('普通用例提示词');
  });
});
