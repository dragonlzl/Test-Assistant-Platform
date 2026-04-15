const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const token = 'xmind-kb-ui-token';
const user = { id: 301, username: 'xmind_kb_user', role: 'user', level: 'member' };

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
}

async function gotoCasesgenWorkflow(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('tap-auth-token', 'xmind-kb-ui-token'); } catch (_) {}
  });
  await page.goto(base + '/ai-workflow.html?tab=casesgen&_=' + Date.now().toString(36));
  await waitForAppReady(page);
  await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
}

async function setupSettingsRoutes(page) {
  const savedSettings = [];
  const validateCalls = [];

  await page.addInitScript(() => {
    try { localStorage.setItem('tap-auth-token', 'xmind-kb-ui-token'); } catch (_) {}
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/users/me' && method === 'GET') return respond(200, user);
    if (path === '/api/settings' && method === 'GET') return respond(200, savedSettings);
    if (path === '/api/settings' && method === 'PUT') {
      const payload = route.request().postDataJSON();
      const items = Array.isArray(payload && payload.items) ? payload.items : [];
      items.forEach((item) => {
        if (!item || !item.key) return;
        const existing = savedSettings.find((entry) => entry.key === item.key);
        if (existing) existing.value_json = item.value_json;
        else {
          savedSettings.push({
            key: item.key,
            scope: payload.scope || 'user',
            owner_id: user.id,
            value_json: item.value_json,
          });
        }
      });
      return respond(200, savedSettings);
    }
    if (path === '/api/knowledge-base/validate' && method === 'POST') {
      const payload = route.request().postDataJSON();
      validateCalls.push(payload);
      return respond(200, {
        ok: true,
        normalized_base_url: payload.base_url,
        manifest: {
          doc_count: 89,
          entry_count: 847,
        },
        warnings: [],
      });
    }
    if (path === '/api/projects' && method === 'GET') return respond(200, []);
    if (path.indexOf('/api/projects/') === 0 && path.indexOf('/versions') > -1 && method === 'GET') return respond(200, []);
    if (path === '/api/case-files' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'GET') return respond(200, []);
    if (path === '/api/features' && method === 'GET') return respond(200, []);
    return respond(200, method === 'GET' ? [] : {});
  });

  return { savedSettings, validateCalls };
}

async function mockCaseGenApisWithModel(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('tap-auth-token', 'xmind-kb-ui-token'); } catch (_) {}
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/users/me' && method === 'GET') return respond(200, user);
    if (path === '/api/settings' && method === 'GET') return respond(200, []);
    if (path === '/api/settings' && method === 'PUT') return respond(200, []);
    if (path === '/api/projects' && method === 'GET') return respond(200, []);
    if (path.indexOf('/api/projects/') === 0 && path.indexOf('/versions') > -1 && method === 'GET') return respond(200, []);
    if (path === '/api/case-files' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'GET') {
      return respond(200, [{
        id: 901,
        name: 'MockXmindCaseGenModel',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          provider: 'custom',
          baseUrl: 'https://mock-model.local/v1/chat/completions',
          apiKey: 'mock-key',
          model: 'mock-model',
          maxTokens: 1024,
          capabilities: [],
        },
      }]);
    }
    if (path === '/api/features' && method === 'GET') {
      return respond(200, [{
        id: 5001,
        name: 'default',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          xmindCaseGenId: '901',
          xmindCaseGenPrompt: '基础提示词-XMind页',
          xmindCaseGenReasoning: '',
          xmindCaseGenTemperature: 0.2,
        },
      }]);
    }
    return respond(200, method === 'GET' ? [] : {});
  });
}

async function waitXmindModelAssigned(page) {
  await page.waitForFunction(() => {
    var state = window.app && window.app.state ? window.app.state : null;
    return Boolean(state && state.assignments && String(state.assignments.xmindCaseGenId || '') === '901');
  }, null, { timeout: 10000 });
}

async function openXmindCaseGenDrawer(page) {
  let drawerOpen = await page.evaluate(() => {
    var drawer = document.getElementById('xmindCaseGenDrawer');
    return Boolean(drawer && drawer.classList && drawer.classList.contains('open'));
  });
  if (!drawerOpen) {
    await page.evaluate(() => {
      if (window.app && window.app.xmindCasegenApi && typeof window.app.xmindCasegenApi.open === 'function') {
        window.app.xmindCasegenApi.open({ instant: true, userInitiated: true });
      }
    });
  }
  await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
  await page.waitForFunction(() => {
    var controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
    var addBtn = document.getElementById('xmindCaseGenWorkspaceAddBtn');
    var debug = window.app && window.app.__xmindCasegenDebug ? window.app.__xmindCasegenDebug : null;
    if (controls && controls.getBoundingClientRect) {
      var rect = controls.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    if (addBtn && addBtn.getBoundingClientRect) {
      var addRect = addBtn.getBoundingClientRect();
      if (addRect.width > 0 && addRect.height > 0) return true;
    }
    return Boolean(debug && (debug.phase === 'render-success' || /error/.test(String(debug.phase || ''))));
  }, {}, { timeout: 15000 });
}

async function syncActiveWorkspaceSnapshotFromLiveState(page, options) {
  const input = options || {};
  await page.evaluate((payload) => {
    var app = window.app || {};
    var state = app.state;
    if (!state || !state.xmindCaseGen || !state.xmindCaseGen.workspaces) return false;
    var host = state.xmindCaseGen;
    var activeId = String(host.activeWorkspaceId || '');
    var record = activeId && host.workspaces ? host.workspaces[activeId] : null;
    if (!record) return false;

    function clone(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_) {
        return fallback;
      }
    }

    function ensureObject(value) {
      return value && typeof value === 'object' ? value : {};
    }

    var liveXmind = clone(state.xmindCaseGen, {}) || {};
    delete liveXmind.activeWorkspaceId;
    delete liveXmind.mirrorWorkspaceId;
    delete liveXmind.workspaceOrder;
    delete liveXmind.workspaces;
    delete liveXmind.nextWorkspaceSeq;
    delete liveXmind.openButtonDotVisible;

    record.snapshot = ensureObject(record.snapshot);
    record.snapshot.shared = ensureObject(record.snapshot.shared);
    record.snapshot.xmind = ensureObject(record.snapshot.xmind);

    Object.keys(liveXmind).forEach(function(key) {
      record.snapshot.xmind[key] = clone(liveXmind[key], liveXmind[key]);
    });
    if (payload.prep && typeof payload.prep === 'object') {
      record.snapshot.xmind.prep = ensureObject(record.snapshot.xmind.prep);
      Object.keys(payload.prep).forEach(function(key) {
        record.snapshot.xmind.prep[key] = clone(payload.prep[key], payload.prep[key]);
      });
    }
    record.snapshot.shared.requirementLabel = '';
    record.snapshot.shared.requirementLabelSource = '';
    record.name = String(payload.workspaceName || record.name || '');
    record.updatedAt = Date.now();

    Object.keys(record.snapshot.xmind).forEach(function(key) {
      state.xmindCaseGen[key] = clone(record.snapshot.xmind[key], record.snapshot.xmind[key]);
    });
    if (app.persistWorkflowStateNow && typeof app.persistWorkflowStateNow === 'function') {
      app.persistWorkflowStateNow();
    }
    return true;
  }, {
    workspaceName: input.workspaceName || '',
    prep: input.prep || {},
  });
}

async function createXmindWorkspaceByManualPrep(page, name, description) {
  await page.click('#xmindCaseGenWorkspaceAddBtn');
  await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
  await page.evaluate((payload) => {
    var state = window.app && window.app.state ? window.app.state : null;
    if (!state || !state.xmindCaseGen) return;
    var prep = state.xmindCaseGen.prep = state.xmindCaseGen.prep || {};
    prep.step = 3;
    prep.requirementMode = 'manual';
    prep.requirementSupplement = '';
    prep.manualRequirementLabel = String(payload.name || '未命名需求');
    prep.manualRequirementBlocks = [{
      type: 'text',
      text: String(payload.description || '需求描述'),
    }];
    prep.caseImportMode = 'skip';
    prep.baseLocked = true;
    prep.completed = true;
  }, {
    name: String(name || '未命名需求'),
    description: String(description || '需求描述'),
  });
  await syncActiveWorkspaceSnapshotFromLiveState(page, {
    workspaceName: String(name || '未命名需求'),
    prep: {
      step: 3,
      requirementMode: 'manual',
      manualRequirementLabel: String(name || '未命名需求'),
      manualRequirementBlocks: [{ type: 'text', text: String(description || '需求描述') }],
      caseImportMode: 'skip',
      baseLocked: true,
      completed: true,
    },
  });
  await page.click('#xmindCaseGenSummaryCloseBtn');
  await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);
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
    return Array.prototype.every.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(expected) === -1;
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

async function openNodeContextMenu(page, topicText) {
  const target = page.locator('#xmindCaseGenMindContainer me-tpc .text', { hasText: topicText }).first();
  await expect(target).toBeVisible();
  await target.click({ button: 'right', force: true });
  await page.waitForFunction(() => {
    var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
    return buttons && buttons.length > 0;
  }, null, { timeout: 10000 });
}

async function clickContextMenuAction(page, label) {
  const button = page.locator('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn', {
    hasText: String(label || '').trim(),
  }).first();
  await expect(button).toBeVisible();
  await button.click({ force: true });
}

async function switchWorkspace(page, label) {
  const tab = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
    hasText: String(label || ''),
  }).first();
  await expect(tab).toBeVisible();
  await tab.click();
  await waitForNodeText(page, String(label || ''));
}

async function installKnowledgeBaseStubs(page) {
  await page.evaluate(() => {
    function flattenContent(content) {
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      return content.map(function(item) {
        if (!item || typeof item !== 'object') return '';
        if (item.type === 'text') return String(item.text || '');
        return '[image]';
      }).join('\n');
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
      return null;
    }

    function makeCase(moduleName, title) {
      return {
        module: moduleName,
        title: title,
        priority: 'P1',
        preconditions: moduleName + '前置条件',
        steps: ['1、进入' + moduleName, '2、执行' + title],
        expected: title + '执行成功',
      };
    }

    function makeModule(name) {
      return {
        module: name,
        key_scenarios: [name + '主场景'],
        test_points: [name + '关键校验'],
        coupled_modules: [],
        cases: [
          makeCase(name, name + '-完整-1'),
          makeCase(name, name + '-完整-2'),
        ],
      };
    }

    function successResponse(text) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: function() {
          return Promise.resolve(JSON.stringify({
            choices: [{ message: { content: String(text || '') } }],
          }));
        },
      });
    }

    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    window.__kbValidateCalls = [];
    window.__kbCatalogCalls = [];
    window.__kbDocumentCalls = [];
    window.__xmindKbProxyCalls = [];

    client.validateKnowledgeBase = function(payload) {
      window.__kbValidateCalls.push(JSON.parse(JSON.stringify(payload || {})));
      return Promise.resolve({
        ok: true,
        normalized_base_url: payload && payload.base_url ? String(payload.base_url || '') : '',
        manifest: {
          doc_count: 89,
          entry_count: 847,
        },
        warnings: [],
      });
    };

    client.catalogKnowledgeBase = function(payload) {
      var body = JSON.parse(JSON.stringify(payload || {}));
      window.__kbCatalogCalls.push(body);
      return Promise.resolve({
        normalized_base_url: String(body.base_url || ''),
        manifest: { doc_count: 89, entry_count: 847 },
        warnings: [],
        documents: [{
          doc_id: 'doc-a-1',
          module: '技能系统',
          title: '页签A知识文档',
          aliases: ['页签A', '技能按钮'],
          keywords: ['冷却', '中断恢复'],
          summary: '技能按钮状态、冷却和中断恢复规则。',
          relative_path: 'skills/a.md',
          clean_path: '_llm/docs/skills/a.md',
          source_url: 'http://kb.example/skills/a',
          heading_samples: ['技能按钮状态', '冷却恢复'],
        }, {
          doc_id: 'doc-b-1',
          module: '支付系统',
          title: '页签B知识文档',
          aliases: ['页签B', '支付'],
          keywords: ['扣费', '失败回滚'],
          summary: '扣费、失败回滚和重试规则。',
          relative_path: 'payment/b.md',
          clean_path: '_llm/docs/payment/b.md',
          source_url: 'http://kb.example/payment/b',
          heading_samples: ['扣费校验', '失败回滚'],
        }],
      });
    };

    client.getKnowledgeBaseDocuments = function(payload) {
      var body = JSON.parse(JSON.stringify(payload || {}));
      window.__kbDocumentCalls.push(body);
      var docIds = Array.isArray(body.doc_ids) ? body.doc_ids : [];
      var documents = [];
      docIds.forEach(function(docId) {
        if (docId === 'doc-a-1') {
          documents.push({
            doc_id: 'doc-a-1',
            module: '技能系统',
            title: '页签A知识文档',
            relative_path: 'skills/a.md',
            clean_path: '_llm/docs/skills/a.md',
            source_url: 'http://kb.example/skills/a',
            sections: [{
              section_id: 'doc-a-1::section-1',
              heading: '技能按钮状态',
              content: '页签A知识摘录：技能按钮状态、冷却和中断恢复规则。',
            }, {
              section_id: 'doc-a-1::section-2',
              heading: '冷却恢复',
              content: '页签A补充知识：技能冷却结束后按钮状态需要同步恢复。',
            }],
          });
          return;
        }
        if (docId === 'doc-b-1') {
          documents.push({
            doc_id: 'doc-b-1',
            module: '支付系统',
            title: '页签B知识文档',
            relative_path: 'payment/b.md',
            clean_path: '_llm/docs/payment/b.md',
            source_url: 'http://kb.example/payment/b',
            sections: [{
              section_id: 'doc-b-1::section-1',
              heading: '扣费校验',
              content: '页签B知识摘录：扣费与失败回滚规则。',
            }],
          });
        }
      });
      return Promise.resolve({
        normalized_base_url: String(body.base_url || ''),
        manifest: { doc_count: 89, entry_count: 847 },
        warnings: [],
        documents: documents,
      });
    };

    client.proxyModelRequest = function(payload) {
      var modelPayload = payload && payload.payload ? payload.payload : {};
      var messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
      var promptText = flattenContent(messages[0] && messages[0].content);
      var userText = flattenContent(messages[1] && messages[1].content);
      var requirementContext = parseJsonText(extractSection(userText, '【需求上下文(JSON)】')) || {};
      var documentContext = parseJsonText(extractSection(userText, '【知识文档正文(JSON)】')) || [];
      var requirementLabel = String(requirementContext.requirementLabel || '');
      var requirementText = String(requirementContext.requirementText || '');
      var selectedDocIds = Array.isArray(documentContext)
        ? documentContext.map(function(item) { return item && item.doc_id ? String(item.doc_id || '') : ''; }).filter(Boolean)
        : [];
      window.__xmindKbProxyCalls.push({ prompt: promptText, user: userText });

      if (promptText.indexOf('共享知识库目录检索助手') !== -1 || userText.indexOf('【知识库目录(JSON)】') !== -1) {
        if (requirementLabel.indexOf('页签A') !== -1 || requirementText.indexOf('技能按钮') !== -1) {
          return successResponse(JSON.stringify({
            selected_doc_ids: ['doc-a-1'],
            items: [{ doc_id: 'doc-a-1', reason: '命中页签A规则' }],
          }));
        }
        if (requirementLabel.indexOf('页签B') !== -1 || requirementText.indexOf('支付扣费') !== -1) {
          return successResponse(JSON.stringify({
            selected_doc_ids: ['doc-b-1'],
            items: [{ doc_id: 'doc-b-1', reason: '命中页签B规则' }],
          }));
        }
        return successResponse(JSON.stringify({ selected_doc_ids: [], items: [] }));
      }

      if (promptText.indexOf('共享知识库正文精筛助手') !== -1 || userText.indexOf('【知识文档正文(JSON)】') !== -1) {
        if (selectedDocIds.indexOf('doc-a-1') !== -1) {
          return successResponse(JSON.stringify({
            selected_sections: ['doc-a-1::section-1'],
            items: [{ section_id: 'doc-a-1::section-1', reason: '命中页签A规则' }],
          }));
        }
        if (selectedDocIds.indexOf('doc-b-1') !== -1) {
          return successResponse('这不是合法JSON');
        }
        return successResponse(JSON.stringify({ selected_sections: [], items: [] }));
      }

      var contract = parseJsonText(extractSection(userText, '【operation_contract(JSON)】'))
        || parseJsonText(extractSection(promptText, 'operation_contract(JSON)：'))
        || {};
      var targetModule = String(contract.targetModule || '登录模块');
      var mode = String(contract.mode || '');
      var responseModules = [];
      if (mode === 'full_cases') {
        responseModules = [makeModule('登录模块'), makeModule('支付模块')];
      } else {
        responseModules = [makeModule(targetModule || '登录模块')];
      }
      return successResponse(JSON.stringify({ modules: responseModules }));
    };
  });
}

test.describe('XMind 共享知识库', () => {
  test('设置页可保存并校验知识库地址', async ({ page }) => {
    const state = await setupSettingsRoutes(page);
    await page.goto(base + '/settings.html?_=' + Date.now().toString(36));
    await waitForAppReady(page);
    await expect(page.locator('#knowledgeBaseBaseUrlInput')).toBeVisible();

    await page.fill('#knowledgeBaseBaseUrlInput', 'http://192.168.50.10:8003/sk');
    await page.click('#saveKnowledgeBaseBaseUrl');
    await expect(page.locator('#knowledgeBaseBaseUrlStatus')).toContainText('知识库地址已保存');

    await page.fill('#knowledgeBaseCatalogCharLimitInput', '180000');
    await page.fill('#knowledgeBaseInjectedContextCharLimitInput', '36000');
    await page.fill('#xmindRequestPayloadLimitInput', '5200000');
    await page.click('#saveKnowledgeBaseLimitSettings');
    await expect(page.locator('#knowledgeBaseLimitSettingsStatus')).toContainText('上限已保存');

    const saved = state.savedSettings.find((item) => item.key === 'knowledgeBaseBaseUrl');
    expect(saved).toBeTruthy();
    expect(saved.value_json).toBe('http://192.168.50.10:8003/sk/');
    const savedCatalogLimit = state.savedSettings.find((item) => item.key === 'knowledgeBaseCatalogCharLimit');
    expect(savedCatalogLimit).toBeTruthy();
    expect(savedCatalogLimit.value_json).toBe(180000);
    const savedInjectedLimit = state.savedSettings.find((item) => item.key === 'knowledgeBaseInjectedContextCharLimit');
    expect(savedInjectedLimit).toBeTruthy();
    expect(savedInjectedLimit.value_json).toBe(36000);
    const savedPayloadLimit = state.savedSettings.find((item) => item.key === 'xmindRequestPayloadLimit');
    expect(savedPayloadLimit).toBeTruthy();
    expect(savedPayloadLimit.value_json).toBe(5200000);

    await page.click('#validateKnowledgeBaseBaseUrl');
    await expect(page.locator('#knowledgeBaseBaseUrlStatus')).toContainText('校验成功');
    expect(state.validateCalls).toHaveLength(1);
    expect(state.validateCalls[0].base_url).toBe('http://192.168.50.10:8003/sk/');
  });

  test('知识库状态和结果按 workspace 隔离，AI 失败时仍继续生成', async ({ page }) => {
    page.on('console', (msg) => {
      var text = msg.text();
      if (text && (text.indexOf('XMind managed task consume failed') !== -1 || text.indexOf('XMind casegen mirror render failed') !== -1)) {
        console.log('[page-console]', text);
      }
    });
    page.on('pageerror', (err) => {
      console.log('[page-error]', err && err.stack ? err.stack : String(err || ''));
    });
    await mockCaseGenApisWithModel(page);
    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page);
    await installKnowledgeBaseStubs(page);
    await page.evaluate(() => {
      if (window.app && window.app.state) {
        window.app.state.settings = window.app.state.settings || {};
        window.app.state.settings.knowledgeBaseBaseUrl = 'http://kb.example/sk/';
      }
    });

    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '页签A', '需求A：技能按钮和冷却校验。');
    await waitForNodeText(page, '页签A');
    await openNodeContextMenu(page, '页签A');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块');
    await expect(page.locator('#xmindCaseGenStatus')).toContainText('已生成 2 个模块，4 条用例');
    await expect(page.locator('#xmindCaseGenKnowledgeRuleBtn')).toContainText('已完成');
    await expect(page.locator('#xmindCaseGenKnowledgeAiBtn')).toContainText('已完成');

    await page.click('#xmindCaseGenKnowledgeRuleBtn');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('页签A知识文档');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('页签A知识摘录');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('命中页签A规则');
    await page.click('#xmindCaseGenSummaryCloseBtn');

    await page.click('#xmindCaseGenSummaryBtn');
    await expect(page.locator('.xmind-casegen-kb-used-badge-inline')).toContainText('已使用知识库');
    await page.click('#xmindCaseGenSummaryCloseBtn');

    const modelCallCountBeforeReuse = await page.evaluate(() => {
      return Array.isArray(window.__xmindKbProxyCalls) ? window.__xmindKbProxyCalls.length : 0;
    });
    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '重新生成全量用例');
    await page.waitForFunction((beforeCount) => {
      return Array.isArray(window.__xmindKbProxyCalls) && window.__xmindKbProxyCalls.length > beforeCount;
    }, modelCallCountBeforeReuse, { timeout: 15000 });

    const catalogCallsAfterReuse = await page.evaluate(() => {
      return window.__kbCatalogCalls ? JSON.parse(JSON.stringify(window.__kbCatalogCalls)) : [];
    });
    expect(catalogCallsAfterReuse).toHaveLength(1);
    const documentCallsAfterReuse = await page.evaluate(() => {
      return window.__kbDocumentCalls ? JSON.parse(JSON.stringify(window.__kbDocumentCalls)) : [];
    });
    expect(documentCallsAfterReuse).toHaveLength(1);
    const filterCallsAfterReuse = await page.evaluate(() => {
      var calls = window.__xmindKbProxyCalls ? JSON.parse(JSON.stringify(window.__xmindKbProxyCalls)) : [];
      return calls.filter((item) => {
        var prompt = String(item && item.prompt ? item.prompt : '');
        var user = String(item && item.user ? item.user : '');
        return prompt.indexOf('共享知识库目录检索助手') !== -1
          || user.indexOf('【知识库目录(JSON)】') !== -1
          || prompt.indexOf('共享知识库正文精筛助手') !== -1
          || user.indexOf('【知识文档正文(JSON)】') !== -1;
      });
    });
    expect(filterCallsAfterReuse).toHaveLength(2);

    await createXmindWorkspaceByManualPrep(page, '页签B', '需求B：支付扣费失败继续生成，但不要注入错误知识。');
    await waitForNodeText(page, '页签B');
    await openNodeContextMenu(page, '页签B');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '支付模块');
    await expect(page.locator('#xmindCaseGenStatus')).toContainText('已生成 2 个模块，4 条用例');
    await expect(page.locator('#xmindCaseGenKnowledgeRuleBtn')).toContainText('已完成');
    await expect(page.locator('#xmindCaseGenKnowledgeAiBtn')).toContainText('失败');

    await page.click('#xmindCaseGenKnowledgeAiBtn');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('AI 正文精筛返回结果无法解析为 JSON');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('页签B知识文档');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).not.toContainText('页签A知识摘录');
    await page.click('#xmindCaseGenSummaryCloseBtn');

    await page.click('#xmindCaseGenSummaryBtn');
    await expect(page.locator('.xmind-casegen-kb-used-badge-inline')).toHaveCount(0);
    await page.click('#xmindCaseGenSummaryCloseBtn');

    await switchWorkspace(page, '页签A');
    await expect(page.locator('#xmindCaseGenKnowledgeAiBtn')).toContainText('已完成');
    await page.click('#xmindCaseGenKnowledgeRuleBtn');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('页签A知识文档');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('页签A知识摘录');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).not.toContainText('页签B知识文档');

    const catalogCalls = await page.evaluate(() => {
      return window.__kbCatalogCalls ? JSON.parse(JSON.stringify(window.__kbCatalogCalls)) : [];
    });
    expect(catalogCalls).toHaveLength(2);
    const documentCalls = await page.evaluate(() => {
      return window.__kbDocumentCalls ? JSON.parse(JSON.stringify(window.__kbDocumentCalls)) : [];
    });
    expect(documentCalls).toHaveLength(2);
    expect(documentCalls.some((item) => JSON.stringify(item.doc_ids || []).indexOf('doc-a-1') !== -1)).toBe(true);
    expect(documentCalls.some((item) => JSON.stringify(item.doc_ids || []).indexOf('doc-b-1') !== -1)).toBe(true);

    const workspaceStates = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      var workspaces = host && host.workspaces ? host.workspaces : {};
      return Object.keys(workspaces).map((id) => {
        var record = workspaces[id] || {};
        var snapshot = record.snapshot && record.snapshot.xmind ? record.snapshot.xmind : {};
        var kb = snapshot.knowledgeBase || {};
        return {
          id: id,
          name: String(record.name || ''),
          usedInLatestGeneration: kb.usedInLatestGeneration === true,
          latestError: String(kb.latestError || ''),
          selectedDocuments: Array.isArray(kb.selectedDocuments) ? kb.selectedDocuments : [],
          selectedSections: Array.isArray(kb.selectedSections) ? kb.selectedSections : [],
        };
      });
    });
    expect(workspaceStates).toHaveLength(2);
    var workspaceAState = workspaceStates.find((item) => String(item.name || '').indexOf('页签A') !== -1);
    var workspaceBState = workspaceStates.find((item) => String(item.name || '').indexOf('页签B') !== -1);
    expect(workspaceAState).toBeTruthy();
    expect(workspaceBState).toBeTruthy();
    expect(workspaceAState.usedInLatestGeneration).toBe(true);
    expect(workspaceBState.usedInLatestGeneration).toBe(false);
    expect(JSON.stringify(workspaceAState.selectedDocuments)).toContain('页签A知识文档');
    expect(JSON.stringify(workspaceBState.selectedDocuments)).toContain('页签B知识文档');
    expect(JSON.stringify(workspaceAState.selectedSections)).toContain('页签A知识摘录');
    expect(JSON.stringify(workspaceBState.selectedSections)).not.toContain('页签A知识摘录');
    expect(workspaceBState.latestError).toContain('AI 正文精筛返回结果无法解析为 JSON');

    const filterCalls = await page.evaluate(() => {
      var calls = window.__xmindKbProxyCalls ? JSON.parse(JSON.stringify(window.__xmindKbProxyCalls)) : [];
      return calls.filter((item) => {
        var prompt = String(item && item.prompt ? item.prompt : '');
        var user = String(item && item.user ? item.user : '');
        return prompt.indexOf('共享知识库目录检索助手') !== -1
          || user.indexOf('【知识库目录(JSON)】') !== -1
          || prompt.indexOf('共享知识库正文精筛助手') !== -1
          || user.indexOf('【知识文档正文(JSON)】') !== -1;
      });
    });
    expect(filterCalls).toHaveLength(4);
  });
});
