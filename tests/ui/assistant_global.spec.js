const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function allowLocalOnly(page) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
}

async function mockApi(page) {
  var settingsStore = [];
  var projectStore = [
    { id: 2001, name: '狼人项目', description: '', created_at: '2026-03-01T08:00:00Z', updated_at: '2026-03-01T08:00:00Z' },
  ];
  var caseFilesStore = [
    {
      id: 101,
      project_id: 2001,
      version_id: 301,
      file_name_clean: '登录主流程',
      source: 'import',
      reuse_enabled: false,
      association_count: 1,
      item_count: 8,
      importer_id: 1,
      importer_name: 'assistant_tester',
      imported_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-03T11:00:00Z',
      last_updated_by: 1,
      last_updated_by_name: 'assistant_tester',
    },
    {
      id: 102,
      project_id: 2001,
      version_id: 301,
      file_name_clean: '支付异常链路',
      source: 'import',
      reuse_enabled: false,
      association_count: 0,
      item_count: 6,
      importer_id: 1,
      importer_name: 'assistant_tester',
      imported_at: '2026-03-02T10:00:00Z',
      updated_at: '2026-03-04T09:00:00Z',
      last_updated_by: 1,
      last_updated_by_name: 'assistant_tester',
    },
  ];
  await page.route('**/api/**', async (route) => {
    var url = new URL(route.request().url());
    var method = route.request().method();
    var path = url.pathname;
    function respond(status, body) {
      return route.fulfill({
        status: status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    }
    if (path === '/api/users/me' && method === 'GET') {
      return respond(200, { id: 1, username: 'assistant_tester', role: 'admin', level: 'admin' });
    }
    if (path === '/api/projects' && method === 'GET') return respond(200, projectStore);
    if (path.indexOf('/api/projects/') === 0 && path.indexOf('/versions') > -1 && method === 'GET') return respond(200, []);
    if (path === '/api/case-files' && method === 'GET') {
      var pid = url.searchParams.get('project_id');
      var list = caseFilesStore.slice();
      if (pid) {
        list = list.filter(function(item) {
          return item && String(item.project_id) === String(pid);
        });
      }
      return respond(200, list);
    }
    if (path === '/api/web-search' && method === 'GET') {
      var q = String(url.searchParams.get('q') || '').trim();
      var limit = Number(url.searchParams.get('limit') || 5);
      if (!Number.isFinite(limit) || limit <= 0) limit = 5;
      if (limit > 10) limit = 10;
      var weatherItems = [
        {
          title: '深圳天气预报',
          url: 'https://www.weather.com.cn/weather/101280601.shtml',
          snippet: '深圳今天天气：多云，最高 26℃，最低 19℃。',
          source: 'bing-rss',
        },
        {
          title: '深圳市气象局天气实况',
          url: 'https://weather.sz.gov.cn/qixiangfuwu/yubaofuwu/jinmingtianqiyubao/index.html',
          snippet: '官方发布深圳实时天气与预报。',
          source: 'bing-rss',
        },
      ];
      var listOut = [];
      if (q.indexOf('天气') !== -1 || q.indexOf('weather') !== -1) {
        listOut = weatherItems.slice(0, limit);
      }
      return respond(200, {
        ok: true,
        query: q,
        provider: 'bing-rss',
        items: listOut,
        total: listOut.length,
        reason: listOut.length ? '' : 'no_results',
      });
    }
    if (path === '/api/features' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'POST') return respond(201, { id: Date.now() });
    if (path.indexOf('/api/models/') === 0 && (method === 'PATCH' || method === 'DELETE')) return respond(200, {});
    if (path === '/api/settings' && method === 'GET') return respond(200, settingsStore);
    if (path === '/api/settings' && method === 'PUT') {
      var payload = {};
      try { payload = route.request().postDataJSON() || {}; } catch (err) { payload = {}; }
      settingsStore = Array.isArray(payload.items) ? payload.items.map(function(item) { return item; }) : [];
      return respond(200, settingsStore);
    }
    return respond(200, method === 'GET' ? [] : {});
  });
}

async function gotoIndex(page) {
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await page.evaluate(() => {
    document.querySelectorAll('.tab-group .tab-submenu').forEach(function(menu) {
      menu.classList.remove('hidden');
    });
    document.querySelectorAll('.tab-group').forEach(function(group) {
      group.classList.add('open');
    });
    document.querySelectorAll('.tab-group .tab-group-btn').forEach(function(btn) {
      btn.classList.add('open');
    });
    document.querySelectorAll('[data-tab-btn]').forEach(function(btn) {
      btn.classList.remove('hidden');
      btn.classList.remove('role-hidden');
    });
  });
}

test.describe('全局AI助手', () => {
  test.beforeEach(async ({ page }) => {
    await allowLocalOnly(page);
    await mockApi(page);
    await page.addInitScript(() => {
      ['cleaner-models-v1', 'cleaner-assignment-v1', 'usecase-settings-v1'].forEach(function(key) {
        window.localStorage.removeItem(key);
      });
      window.localStorage.setItem('tap-e2e-skip-auth', '1');
      window.localStorage.setItem('cleaner-models-v1', JSON.stringify([{
        id: 'assistant-model-1',
        name: '助手测试模型',
        provider: 'deepseek',
        baseUrl: 'https://api.example.com/v1/chat/completions',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
        maxTokens: 1024,
      }]));
    });
    await gotoIndex(page);
  });

  test('助手默认锁定并点击引导到设置页', async ({ page }) => {
    await expect(page.locator('#assistantLauncherBtn')).toContainText('锁定');
    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page).toHaveURL(/settings\.html\?tab=settings/);
    await expect(page.locator('#assistantPanel')).toHaveClass(/hidden/);
  });

  test('助手面板背景应为非透明', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    const panelBg = await page.evaluate(() => {
      var panel = document.getElementById('assistantPanel');
      if (!panel) return '';
      return String(window.getComputedStyle(panel).backgroundColor || '').trim();
    });
    expect(panelBg).not.toBe('transparent');
    expect(panelBg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('助手聊天框字体应更小', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    const styles = await page.evaluate(() => {
      var input = document.getElementById('assistantInput');
      var msgBody = document.querySelector('#assistantMessages .assistant-msg-body');
      return {
        inputFontSize: input ? window.getComputedStyle(input).fontSize : '',
        messageFontSize: msgBody ? window.getComputedStyle(msgBody).fontSize : '',
      };
    });
    expect(styles.inputFontSize).toBe('13px');
    expect(styles.messageFontSize).toBe('13px');
  });

  test('助手可按模型输出渲染表格与代码块', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: [
              '执行建议如下：',
              '',
              '| 方案 | 说明 |',
              '| --- | --- |',
              '| 快速修复 | 改动最小，交付快 |',
              '| 稳定方案 | 可维护性更高 |',
              '',
              '```js',
              'const answer = 42;',
              'console.log(answer);',
              '```',
            ].join('\n'),
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '请给我一个方案对比和代码示例');
    await page.click('#assistantSendBtn');

    const rendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return { hasTable: false, hasCodeBlock: false, rowCount: 0, codeText: '' };
      }
      var last = cards[cards.length - 1];
      var table = last.querySelector('table');
      var code = last.querySelector('pre code');
      return {
        hasTable: Boolean(table),
        hasCodeBlock: Boolean(code),
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
        codeText: code && code.textContent ? String(code.textContent) : '',
      };
    });

    expect(rendered.hasTable).toBeTruthy();
    expect(rendered.hasCodeBlock).toBeTruthy();
    expect(rendered.rowCount).toBe(2);
    expect(rendered.codeText).toContain('const answer = 42;');
  });

  test('助手代码块支持点击复制', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: [
              '```bash',
              'echo \"assistant-copy-test\"',
              '```',
            ].join('\n'),
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '给我一段命令');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages .assistant-code-copy-btn').last()).toBeVisible();

    await page.locator('#assistantMessages .assistant-code-copy-btn').last().click();
    await expect.poll(async () => {
      var text = await page.locator('#assistantMessages .assistant-code-copy-btn').last().innerText();
      return String(text || '').trim();
    }).toBe('已复制');
    await expect(page.locator('#assistantStatus')).toContainText('代码已复制');
  });

  test('模型报错可自动诊断，代填前二次确认且可重测', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    const selfDisable = await page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.applyPatch !== 'function') {
        return { ok: false, reason: 'missing api' };
      }
      return window.app.assistantSettingsApi.applyPatch({ assistantEnabled: false }, { source: 'assistant' });
    });
    expect(selfDisable && selfDisable.ok).toBeFalsy();

    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.evaluate(() => {
      window.__assistantDiagApplied = null;
      window.__assistantRetestCount = 0;
      window.app.assistantModelDiagApi.diagnoseFailure = async function() {
        return {
          ok: true,
          diagnosis: {
            judgement: '鉴权或权限异常',
            rootCause: 'API Key 无效或无权限',
            steps: ['检查 API Key 与模型权限', '必要时更换兼容模型'],
            patch: {
              baseUrl: 'https://api.example.com/v1/chat/completions',
              model: 'deepseek-chat',
              maxTokens: 2048,
            },
            manualItems: ['API Key 需手动更新'],
            confidence: 'high',
          },
        };
      };
      window.app.assistantModelDiagApi.applyModelPatch = async function(id, patch) {
        window.__assistantDiagApplied = { id: id, patch: patch };
        return { ok: true, modelId: id, keys: Object.keys(patch || {}) };
      };
      window.app.assistantModelDiagApi.retestModel = async function() {
        window.__assistantRetestCount += 1;
        return { ok: true };
      };
    });

    var confirmCount = 0;
    page.on('dialog', async (dialog) => {
      confirmCount += 1;
      await dialog.accept();
    });

    await page.evaluate((mid) => {
      var detail = {
        ok: false,
        scene: 'assign-clean',
        modelId: mid,
        modelName: '助手模型-UI',
        provider: 'deepseek',
        statusCode: 401,
        errorMessage: 'HTTP 401 unauthorized',
        responsePreview: 'unauthorized',
        requestMeta: {
          hasApiKey: true,
          requestUrl: 'https://api.example.com/v1/chat/completions?token=secret',
          timeoutSec: 30,
        },
        timestamp: Date.now(),
      };
      window.dispatchEvent(new CustomEvent('app-model-test-failed', { detail: detail }));
    }, modelId);

    await expect(page.locator('#assistantMessages')).toContainText('问题判断');
    await page.click('#assistantMessages button:has-text("应用建议配置")');
    await expect.poll(() => confirmCount).toBeGreaterThanOrEqual(2);
    await expect.poll(() => page.evaluate(() => {
      return window.__assistantDiagApplied && window.__assistantDiagApplied.patch
        ? String(window.__assistantDiagApplied.patch.baseUrl || '')
        : '';
    })).toBe('https://api.example.com/v1/chat/completions');
    await expect(page.locator('#assistantMessages')).toContainText('建议配置已应用成功');

    await page.click('#assistantMessages button:has-text("立即重测")');
    await expect(page.locator('#assistantMessages')).toContainText('重测成功');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantRetestCount || 0))).toBe(1);

    const safe = await page.evaluate(() => {
      return window.app.assistantModelDiagApi.sanitizeFailureContext({
        modelId: 'safe-check',
        errorMessage: 'HTTP 401',
        responsePreview: 'unauthorized',
        requestMeta: {
          hasApiKey: true,
          requestUrl: 'https://host.example.com/v1/chat/completions?apiKey=sk-secret',
          apiKey: 'sk-secret',
        },
      });
    });
    expect(safe.requestMeta.hasApiKey).toBeTruthy();
    expect(safe.requestMeta.baseUrl).toBe('https://host.example.com/v1/chat/completions');
    expect(JSON.stringify(safe).indexOf('sk-secret')).toBe(-1);
  });

  test('询问当前页面时返回直接页面回答', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '你现在是什么页面？');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('当前页面是：');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).not.toContain('按你的意图返回页面数据');
  });

  test('首问当前有哪些用例时应直接返回用例列表', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '当前有哪些用例');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('当前用例列表');

    await expect(page.locator('#assistantMessages')).toContainText('登录主流程');
    await expect(page.locator('#assistantMessages')).toContainText('支付异常链路');
    await expect(page.locator('#assistantMessages')).not.toContainText('获取当前页面用例列表');
  });

  test('获取当前页面用例列表在无编辑上下文时返回下一步提示', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '获取当前页面用例列表');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前页面没有正在编辑或查看的用例');
    await expect(page.locator('#assistantMessages')).toContainText('1. 进入“用例库 -> 查看&编辑”，打开一个用例文件');
    await expect(page.locator('#assistantMessages')).toContainText('2. 或直接问我');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前用例列表');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前页面是：');
  });

  test('现在的页面有什么用例在无编辑上下文时返回下一步提示', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '现在的页面有什么用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前页面没有正在编辑或查看的用例');
    await expect(page.locator('#assistantMessages')).toContainText('1. 进入“用例库 -> 查看&编辑”，打开一个用例文件');
    await expect(page.locator('#assistantMessages')).toContainText('2. 或直接问我');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前用例列表');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前页面是：');
  });

  test('用例库页无编辑上下文时不应回退执行页结果', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'case-library';
        window.app.state.tempExecActiveId = 'exec-file-1';
        window.app.state.tempExecActiveFileId = 'exec-file-1';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-file-1',
            name: '执行文件A',
            projectId: '2001',
            versionId: '301',
            cases: [
              { id: 'te-1', module: '登录', title: '账号密码登录', priority: 'P1', preconditions: '账号已注册', steps: '输入账号密码并登录', expected: '登录成功', remark: '主链路', actual: '通过' },
            ],
          },
        ];
      }
      if (window.app && window.app.caseLibraryApi) {
        window.app.caseLibraryApi.getCurrentEditorCaseSnapshot = function() {
          return { ok: true, hasContext: false, scope: 'editor', items: [] };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '现在的页面有什么用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前页面没有正在编辑或查看的用例');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前正在查看用例：执行文件A');
    await expect(page.locator('#assistantMessages')).not.toContainText('执行结果');
  });

  test('当前页面用例优先返回正在编辑用例而非全库', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.caseLibraryApi) {
        window.app.caseLibraryApi.getCurrentEditorCaseSnapshot = function() {
          return {
            ok: true,
            hasContext: true,
            scope: 'editor',
            projectId: '2001',
            caseFile: {
              id: '48',
              name: '狼人技能优化',
              projectId: '2001',
              versionId: '301',
            },
            searchText: '',
            total: 2,
            totalAll: 2,
            truncated: false,
            items: [
              {
                index: 1,
                sourceIndex: 1,
                id: '901',
                module: '技能',
                title: '狼人成长技能展示',
                priority: 'P1',
                precondition: '角色已解锁',
                steps: '进入战斗，触发成长技能',
                expected: '技能展示正确',
                remark: '覆盖主流程',
              },
              {
                index: 2,
                sourceIndex: 2,
                id: '902',
                module: '结算',
                title: '技能冷却校验',
                priority: 'P1',
                precondition: '技能进入冷却',
                steps: '等待冷却完成',
                expected: '冷却时间正确',
                remark: '边界值5秒',
              },
            ],
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '现在的页面有什么用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前正在编辑用例：狼人技能优化');
    await expect(page.locator('#assistantMessages')).toContainText('当前页面用例明细（完整字段）');
    await expect(page.locator('#assistantMessages')).toContainText('前置条件');
    await expect(page.locator('#assistantMessages')).toContainText('步骤');
    await expect(page.locator('#assistantMessages')).toContainText('预期结果');
    await expect(page.locator('#assistantMessages')).toContainText('备注');
    await expect(page.locator('#assistantMessages')).toContainText('狼人成长技能展示');
    await expect(page.locator('#assistantMessages')).toContainText('技能冷却校验');
    await expect(page.locator('#assistantMessages')).toContainText('角色已解锁');
    await expect(page.locator('#assistantMessages')).toContainText('覆盖主流程');
    await expect(page.locator('#assistantMessages')).not.toContainText('登录主流程');
    await expect(page.locator('#assistantMessages')).not.toContainText('支付异常链路');

    const tableMeta = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return {
          headers: [],
          overflowX: '',
          tableMinWidth: '',
          tableLayout: '',
          cellWhiteSpace: '',
          cellWordBreak: '',
          cellOverflowWrap: '',
          hasCaseTable: false,
          hasProxyBar: false,
          hasProxyThumb: false,
          proxyThumbWidth: 0,
        };
      }
      var last = cards[cards.length - 1];
      var wrapper = last ? last.querySelector('.assistant-case-table-scroll') : null;
      var proxy = last ? last.querySelector('.assistant-case-table-scrollbar') : null;
      var thumb = proxy ? proxy.querySelector('.assistant-table-scrollbar-thumb') : null;
      var table = wrapper ? wrapper.querySelector('table.assistant-case-table') : null;
      var firstDataCell = table ? table.querySelector('tbody td') : null;
      var scrollableWidth = wrapper ? Math.max(0, (wrapper.scrollWidth || 0) - (wrapper.clientWidth || 0)) : 0;
      var headers = [];
      if (table) {
        headers = Array.prototype.map.call(table.querySelectorAll('thead th'), function(th) {
          return String(th && th.textContent ? th.textContent : '').trim();
        });
      }
      return {
        headers: headers,
        overflowX: wrapper ? window.getComputedStyle(wrapper).overflowX : '',
        wrapperScrollbarWidth: wrapper ? window.getComputedStyle(wrapper).getPropertyValue('scrollbar-width') : '',
        tableMinWidth: table ? window.getComputedStyle(table).minWidth : '',
        tableLayout: table ? window.getComputedStyle(table).tableLayout : '',
        cellWhiteSpace: firstDataCell ? window.getComputedStyle(firstDataCell).whiteSpace : '',
        cellWordBreak: firstDataCell ? window.getComputedStyle(firstDataCell).wordBreak : '',
        cellOverflowWrap: firstDataCell ? window.getComputedStyle(firstDataCell).overflowWrap : '',
        hasCaseTable: Boolean(table),
        hasProxyBar: Boolean(proxy),
        hasProxyThumb: Boolean(thumb),
        proxyThumbWidth: thumb ? (parseFloat(window.getComputedStyle(thumb).width || '0') || 0) : 0,
        scrollableWidth: scrollableWidth,
      };
    });
    expect(tableMeta.hasCaseTable).toBeTruthy();
    expect(tableMeta.headers[0]).toBe('序号');
    expect(tableMeta.headers[1]).toBe('ID');
    expect(tableMeta.headers).not.toContain('执行结果');
    expect(tableMeta.overflowX === 'auto' || tableMeta.overflowX === 'scroll').toBeTruthy();
    if (tableMeta.wrapperScrollbarWidth) {
      expect(tableMeta.wrapperScrollbarWidth.trim()).toBe('none');
    }
    expect(tableMeta.tableLayout).toBe('fixed');
    expect(parseFloat(tableMeta.tableMinWidth || '0')).toBeGreaterThanOrEqual(1300);
    expect(tableMeta.cellWhiteSpace).toBe('pre-wrap');
    expect(tableMeta.cellWordBreak).toBe('break-word');
    expect(tableMeta.cellOverflowWrap).toBe('anywhere');
    expect(tableMeta.hasProxyBar).toBeTruthy();
    expect(tableMeta.hasProxyThumb).toBeTruthy();
    expect(tableMeta.proxyThumbWidth).toBeGreaterThan(20);
    expect(tableMeta.scrollableWidth).toBeGreaterThan(0);
  });

  test('当前页面用例查询支持条件筛选（和技能无关）', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.caseLibraryApi) {
        window.app.caseLibraryApi.getCurrentEditorCaseSnapshot = function() {
          return {
            ok: true,
            hasContext: true,
            scope: 'editor',
            projectId: '2001',
            caseFile: {
              id: '95',
              name: '狼人技能优化',
              projectId: '2001',
              versionId: '301',
            },
            searchText: '',
            total: 6,
            totalAll: 6,
            truncated: false,
            items: [
              { index: 1, sourceIndex: 1, id: '7582', module: '通用', title: '技能冷却', priority: 'P1', precondition: '技能解锁', steps: '释放技能', expected: '冷却正常', remark: '' },
              { index: 2, sourceIndex: 2, id: '7587', module: '通用', title: '死亡复活', priority: 'P1', precondition: '角色死亡', steps: '触发复活', expected: '可复活', remark: '' },
              { index: 3, sourceIndex: 3, id: '7588', module: '通用', title: '技能演示', priority: 'P1', precondition: '演示开关开启', steps: '进入演示页', expected: '演示正常', remark: '' },
              { index: 4, sourceIndex: 4, id: '7589', module: '通用', title: '联机', priority: 'P1', precondition: '网络正常', steps: '创建房间', expected: '联机成功', remark: '' },
              { index: 5, sourceIndex: 5, id: '7601', module: '地图', title: '地图探索', priority: 'P1', precondition: '进入地图', steps: '移动探索', expected: '地图可交互', remark: '' },
              { index: 6, sourceIndex: 6, id: '7602', module: '技能效果', title: '蓄力吞噬', priority: 'P1', precondition: '技能蓄力', steps: '释放吞噬', expected: '造成伤害', remark: '' },
            ],
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '当前页面中有哪些用例和技能无关的？');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前正在编辑用例：狼人技能优化');
    await expect(page.locator('#assistantMessages')).toContainText('已按条件过滤：排除“技能”');
    await expect(page.locator('#assistantMessages')).toContainText('当前页面用例明细（完整字段）');
    await expect(page.locator('#assistantMessages')).toContainText('死亡复活');
    await expect(page.locator('#assistantMessages')).toContainText('联机');
    await expect(page.locator('#assistantMessages')).toContainText('地图探索');
    await expect(page.locator('#assistantMessages')).not.toContainText('技能冷却');
    await expect(page.locator('#assistantMessages')).not.toContainText('技能演示');
    await expect(page.locator('#assistantMessages')).not.toContainText('蓄力吞噬');
  });

  test('助手用例表格支持展开完整视图并可关闭，刷新后自动关闭', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.caseLibraryApi) {
        window.app.caseLibraryApi.getCurrentEditorCaseSnapshot = function() {
          return {
            ok: true,
            hasContext: true,
            scope: 'editor',
            contextSource: 'case-library',
            projectId: '2001',
            caseFile: { id: '48', name: '狼人技能优化', projectId: '2001', versionId: '301' },
            searchText: '',
            total: 3,
            totalAll: 3,
            truncated: false,
            items: [
              { index: 1, sourceIndex: 1, id: '9001', module: '技能', title: '狼人成长技能展示', priority: 'P1', precondition: '角色已解锁', steps: '进入战斗，触发成长技能', expected: '技能展示正确', remark: '覆盖主流程' },
              { index: 2, sourceIndex: 2, id: '9002', module: '结算', title: '技能冷却校验', priority: 'P1', precondition: '技能进入冷却', steps: '等待冷却完成', expected: '冷却时间正确', remark: '边界值5秒' },
              { index: 3, sourceIndex: 3, id: '9003', module: '联机', title: '多人联机稳定性', priority: 'P1', precondition: '网络良好', steps: '重复进出房间并结算', expected: '流程稳定无报错', remark: '长文本备注用于验证滚动与换行展示，确保完整可读' },
            ],
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '现在的页面有什么用例');
    await page.click('#assistantSendBtn');

    const expandBtn = page.locator('#assistantMessages .assistant-case-table-expand-btn').last();
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();
    await expect(page.locator('#assistantCasePreview')).not.toHaveClass(/hidden/);

    const previewMeta = await page.evaluate(() => {
      var body = document.getElementById('assistantCasePreviewBody');
      var table = body ? body.querySelector('table.assistant-case-table') : null;
      var proxy = body ? body.querySelector('.assistant-case-table-scrollbar') : null;
      var thumb = proxy ? proxy.querySelector('.assistant-table-scrollbar-thumb') : null;
      var previewScroll = body ? body.querySelector('.assistant-case-preview-table-view') : null;
      var firstCell = table ? table.querySelector('tbody td') : null;
      var closeBtn = document.getElementById('assistantCasePreviewClose');
      return {
        hasTable: Boolean(table),
        bodyButtonCount: body ? body.querySelectorAll('button').length : 0,
        hasProxyThumb: Boolean(thumb),
        proxyThumbWidth: thumb ? (parseFloat(window.getComputedStyle(thumb).width || '0') || 0) : 0,
        previewOverflowX: previewScroll ? window.getComputedStyle(previewScroll).overflowX : '',
        hasTempCaseViewClass: previewScroll ? previewScroll.classList.contains('temp-case-view') : false,
        previewScrollbarWidth: previewScroll ? window.getComputedStyle(previewScroll).getPropertyValue('scrollbar-width') : '',
        tableLayout: table ? window.getComputedStyle(table).tableLayout : '',
        tableMinWidth: table ? (parseFloat(window.getComputedStyle(table).minWidth || '0') || 0) : 0,
        cellWhiteSpace: firstCell ? window.getComputedStyle(firstCell).whiteSpace : '',
        cellWordBreak: firstCell ? window.getComputedStyle(firstCell).wordBreak : '',
        cellOverflowWrap: firstCell ? window.getComputedStyle(firstCell).overflowWrap : '',
        closeBtnDisplay: closeBtn ? window.getComputedStyle(closeBtn).display : '',
        closeBtnAlignItems: closeBtn ? window.getComputedStyle(closeBtn).alignItems : '',
        closeBtnJustifyContent: closeBtn ? window.getComputedStyle(closeBtn).justifyContent : '',
      };
    });
    expect(previewMeta.hasTable).toBeTruthy();
    expect(previewMeta.bodyButtonCount).toBe(0);
    expect(previewMeta.hasProxyThumb).toBeTruthy();
    expect(previewMeta.proxyThumbWidth).toBeGreaterThan(20);
    expect(previewMeta.previewOverflowX === 'auto' || previewMeta.previewOverflowX === 'scroll').toBeTruthy();
    expect(previewMeta.hasTempCaseViewClass).toBeTruthy();
    if (previewMeta.previewScrollbarWidth) {
      expect(previewMeta.previewScrollbarWidth.trim()).toBe('none');
    }
    expect(previewMeta.tableLayout).toBe('fixed');
    expect(previewMeta.tableMinWidth).toBeGreaterThanOrEqual(1300);
    expect(previewMeta.cellWhiteSpace).toBe('pre-wrap');
    expect(previewMeta.cellWordBreak).toBe('break-word');
    expect(previewMeta.cellOverflowWrap).toBe('anywhere');
    expect(previewMeta.closeBtnDisplay).toContain('flex');
    expect(previewMeta.closeBtnAlignItems).toBe('center');
    expect(previewMeta.closeBtnJustifyContent).toBe('center');

    await page.click('#assistantCasePreviewClose');
    await expect(page.locator('#assistantCasePreview')).toHaveClass(/hidden/);

    await expandBtn.click();
    await expect(page.locator('#assistantCasePreview')).not.toHaveClass(/hidden/);
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.waitForSelector('#assistantCasePreview', { state: 'attached' });
    await expect(page.locator('#assistantCasePreview')).toHaveClass(/hidden/);
  });

  test('在用例执行页查看用例时应返回当前查看用例条目', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.goto(base + '/case-exec.html?tab=tempexec');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.waitForSelector('#assistantLauncherBtn');
    await page.evaluate((mid) => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.applyPatch !== 'function') return;
      window.app.assistantSettingsApi.applyPatch(
        { assistantEnabled: true, assistantModelId: mid },
        { source: 'assistant-ui', allowSelfDisable: true }
      );
    }, modelId);
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecActiveId = 'exec-file-1';
        window.app.state.tempExecActiveFileId = 'exec-file-1';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-file-1',
            name: '执行文件A',
            projectId: '2001',
            versionId: '301',
            cases: [
              {
                id: 'te-1',
                module: '登录',
                title: '账号密码登录',
                priority: 'P1',
                preconditions: '账号已注册',
                steps: '输入账号密码并登录',
                expected: '登录成功',
                remark: '主链路',
                actual: '通过',
              },
              {
                id: 'te-2',
                module: '支付',
                title: '余额不足支付失败',
                priority: 'P1',
                preconditions: '余额不足',
                steps: '提交支付',
                expected: '提示余额不足',
                remark: '资金不足',
                actual: '失败',
              },
            ],
          },
        ];
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '现在的页面有什么用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前正在查看用例：执行文件A');
    await expect(page.locator('#assistantMessages')).toContainText('当前页面用例明细（完整字段）');
    await expect(page.locator('#assistantMessages')).toContainText('账号密码登录');
    await expect(page.locator('#assistantMessages')).toContainText('余额不足支付失败');
    await expect(page.locator('#assistantMessages')).toContainText('主链路');
    await expect(page.locator('#assistantMessages')).toContainText('资金不足');
    await expect(page.locator('#assistantMessages')).toContainText('通过');
    await expect(page.locator('#assistantMessages')).toContainText('失败');

    const execHeaders = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) return [];
      var last = cards[cards.length - 1];
      var table = last ? last.querySelector('table.assistant-case-table') : null;
      if (!table) return [];
      return Array.prototype.map.call(table.querySelectorAll('thead th'), function(th) {
        return String(th && th.textContent ? th.textContent : '').trim();
      });
    });
    expect(execHeaders[0]).toBe('序号');
    expect(execHeaders[1]).toBe('ID');
    expect(execHeaders).toContain('执行结果');
  });

  test('模型误判 query_page_data 时仍应优先返回当前页面用例结果', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return { ok: true, content: '{"action":"query_page_data","tab":"case-library"}' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '现在的页面有什么用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前页面没有正在编辑或查看的用例');
    await expect(page.locator('#assistantMessages')).toContainText('1. 进入“用例库 -> 查看&编辑”，打开一个用例文件');
    await expect(page.locator('#assistantMessages')).not.toContainText('按你的意图返回页面数据');
  });

  test('复合问句应同时回答页面与可执行操作', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);
    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '我当前所处页面时什么，能做什么操作？');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('当前页面是：');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('当前页面可执行操作：');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('查看设置项效果说明');
  });

  test('询问如何修改用例时返回操作指引而非页面数据', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '我应该怎么修改用例？');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('用例库');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('查看&编辑');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).not.toContain('按你的意图返回页面数据');
  });

  test('咨询类问题优先走模型思考而非固定模板', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      window.__assistantModelFirstCount = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantModelFirstCount += 1;
          return { ok: true, content: '建议先定位目标场景，再按风险优先级调整断言与前置条件。' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '我应该怎么修改用例？');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('建议先定位目标场景');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantModelFirstCount || 0))).toBe(1);
  });

  test('项目外问题应走通用回答而非页面数据查询', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      window.__assistantCallModelCount = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantCallModelCount += 1;
          return { ok: true, content: '这是通用回答：请告诉我你所在城市，我再帮你看天气。' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '现在的天气');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('通用回答');

    await expect.poll(() => page.evaluate(() => Number(window.__assistantCallModelCount || 0))).toBe(1);

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).not.toContain('按你的意图返回页面数据');
  });

  test('联网问题可触发 web_search 动作并返回搜索结果', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      window.__assistantSearchCount = 0;
      window.__assistantSearchQuery = '';
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"action":"web_search","query":"深圳 今天天气","response":"我帮你联网查了深圳今天的天气信息。"}',
          };
        };
        window.app.assistantApi.searchWeb = async function(query) {
          window.__assistantSearchCount += 1;
          window.__assistantSearchQuery = String(query || '');
          return {
            ok: true,
            query: String(query || ''),
            provider: 'duckduckgo',
            items: [
              {
                title: '深圳天气预报',
                url: 'https://example.com/weather/shenzhen',
                snippet: '今日深圳多云，最高 26℃。',
                source: 'DuckDuckGo',
              },
              {
                title: '深圳实时天气',
                url: 'https://example.com/weather/live',
                snippet: '当前体感温度 24℃，东北风 2 级。',
                source: 'DuckDuckGo',
              },
            ],
            total: 2,
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '今天深圳天气怎么样？');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('我帮你联网查了深圳今天的天气信息');
    await expect(page.locator('#assistantMessages')).toContainText('我已根据联网结果整理为简版');
    await expect(page.locator('#assistantMessages')).toContainText('深圳天气预报');
    await expect(page.locator('#assistantMessages')).toContainText('https://example.com/weather/shenzhen');
    await expect(page.locator('#assistantMessages')).toContainText('搜索源：duckduckgo');
    await expect(page.locator('#assistantMessages')).not.toContainText('结果如下：');
    await expect(page.locator('#assistantMessages')).not.toContainText('链接：');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantSearchCount || 0))).toBe(1);
    await expect.poll(() => page.evaluate(() => String(window.__assistantSearchQuery || ''))).toMatch(/^深圳\s+今(天|日)天气$/);
    await expect(page.locator('#assistantMessages')).not.toContainText('按你的意图返回页面数据');
  });

  test('web_search 使用默认助手搜索时应命中后端天气结果', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"action":"web_search","query":"深圳 今天天气","response":"我帮你联网查了深圳今天的天气信息。"}',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '今天的天气怎么样');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('我帮你联网查了深圳今天的天气信息');
    await expect(page.locator('#assistantMessages')).toContainText('我已根据联网结果整理为简版');
    await expect(page.locator('#assistantMessages')).toContainText('深圳天气预报');
    await expect(page.locator('#assistantMessages')).toContainText('weather.com.cn');
    await expect(page.locator('#assistantMessages')).toContainText('搜索源：bing-rss');
    await expect(page.locator('#assistantMessages')).not.toContainText('结果如下：');
    await expect(page.locator('#assistantMessages')).not.toContainText('链接：');
  });

  test('天气问题缺少城市时应先追问城市而非盲搜', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"action":"web_search","query":"今天天气怎么样","response":"我先帮你查一下。"}',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '今天天气怎么样');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('请先告诉我你所在的城市');
    await expect(page.locator('#assistantMessages')).not.toContainText('结果如下：');
  });

  test('web_search 失败时应返回友好降级提示', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      window.__assistantSearchFailCount = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"action":"web_search","query":"AI 最新新闻"}',
          };
        };
        window.app.assistantApi.searchWeb = async function() {
          window.__assistantSearchFailCount += 1;
          return { ok: false, reason: 'network unavailable' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '帮我看下 AI 最新新闻');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('联网搜索失败');
    await expect(page.locator('#assistantMessages')).toContainText('network unavailable');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantSearchFailCount || 0))).toBe(1);
  });

  test('消息应展示时间且重新打开面板自动滚动到最新', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      window.__assistantEchoCount = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantEchoCount += 1;
          return { ok: true, content: '回声响应 #' + window.__assistantEchoCount };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    for (var i = 1; i <= 8; i += 1) {
      await page.fill('#assistantInput', '测试消息 #' + i);
      await page.click('#assistantSendBtn');
      await expect(page.locator('#assistantMessages')).toContainText('回声响应 #' + i);
    }

    await expect(page.locator('#assistantMessages .assistant-msg-time').first()).toBeVisible();
    const latestTimeText = await page.locator('#assistantMessages .assistant-msg-time').last().innerText();
    expect(/[0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2}:[0-9]{2}/.test(String(latestTimeText || '').trim())).toBeTruthy();

    await page.evaluate(() => {
      var close = document.getElementById('assistantCloseBtn');
      var launcher = document.getElementById('assistantLauncherBtn');
      var box = document.getElementById('assistantMessages');
      if (box) box.scrollTop = 0;
      if (close) close.click();
      if (launcher) launcher.click();
    });

    await expect.poll(() => page.evaluate(() => {
      var box = document.getElementById('assistantMessages');
      if (!box) return false;
      var max = Math.max(0, box.scrollHeight - box.clientHeight);
      return box.scrollTop >= (max - 2);
    })).toBe(true);
  });

  test('支持清空聊天记录', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return { ok: true, content: '这是清空前的回复' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '先来一条消息');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('这是清空前的回复');

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.click('#assistantClearBtn');

    await expect(page.locator('#assistantMessages .assistant-msg')).toHaveCount(0);
    await expect(page.locator('#assistantStatus')).toContainText('聊天记录已清空');
  });

  test('多轮对话应承接上下文而非丢失语义', async ({ page }) => {
    const modelId = 'assistant-model-1';

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#assistantModelSelect option[value="assistant-model-1"]')).toHaveCount(1);
    await page.selectOption('#assistantModelSelect', modelId);
    await page.check('#assistantEnabledToggle');
    await page.click('#saveAssistantSetting');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.assistantSettingsApi || typeof window.app.assistantSettingsApi.getSettings !== 'function') return false;
      var snap = window.app.assistantSettingsApi.getSettings();
      return Boolean(snap && snap.assistantEnabled === true && String(snap.assistantModelId || '') === 'assistant-model-1');
    })).toBe(true);

    await page.evaluate(() => {
      window.__assistantHistorySnapshots = [];
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(userText, options) {
          var history = options && Array.isArray(options.history) ? options.history : [];
          window.__assistantHistorySnapshots.push({
            userText: String(userText || ''),
            history: history,
            prompt: options && options.prompt ? String(options.prompt) : '',
          });
          var text = String(userText || '').trim();
          if (text === '今天的天气怎么样？') {
            return { ok: true, content: '可以的，请先告诉我你所在城市。' };
          }
          if (text === '深圳') {
            return { ok: true, content: '收到，深圳。你要查今天还是未来几天？' };
          }
          if (text === '就今天的') {
            var hasWeather = history.some(function(item) {
              var content = item && item.content ? String(item.content) : '';
              return content.indexOf('天气') !== -1;
            });
            var hasCity = history.some(function(item) {
              var content = item && item.content ? String(item.content) : '';
              return content.indexOf('深圳') !== -1;
            });
            if (hasWeather && hasCity) {
              return { ok: true, content: '按上文理解，你要的是深圳今天的天气。' };
            }
            return { ok: true, content: '你是想问今天的什么？' };
          }
          return { ok: true, content: '好的。' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '今天的天气怎么样？');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('请先告诉我你所在城市');

    await page.fill('#assistantInput', '深圳');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('今天还是未来几天');

    await page.fill('#assistantInput', '就今天的');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('深圳今天的天气');

    await expect.poll(() => page.evaluate(() => {
      var list = Array.isArray(window.__assistantHistorySnapshots) ? window.__assistantHistorySnapshots : [];
      if (!list.length) return false;
      var latest = list[list.length - 1];
      if (!latest || String(latest.userText || '') !== '就今天的') return false;
      var history = Array.isArray(latest.history) ? latest.history : [];
      var hasWeather = history.some(function(item) {
        var text = item && item.content ? String(item.content) : '';
        return text.indexOf('天气') !== -1;
      });
      var hasCity = history.some(function(item) {
        var text = item && item.content ? String(item.content) : '';
        return text.indexOf('深圳') !== -1;
      });
      return hasWeather && hasCity;
    })).toBe(true);
  });
});
