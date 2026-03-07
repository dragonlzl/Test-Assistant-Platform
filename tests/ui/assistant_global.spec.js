const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn0k1cAAAAASUVORK5CYII=';

function makeTinyPngFile(name) {
  return {
    name: name,
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
  };
}

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

  test('发送后在下一条回复位置显示思考中并原位替换结果', async ({ page }) => {
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
      window.__assistantThinkingCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantThinkingCalls += 1;
          await new Promise(function(resolve) { setTimeout(resolve, 600); });
          return {
            ok: true,
            content: '这是思考完成后的回复',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    const countsBefore = await page.evaluate(() => {
      return {
        ai: document.querySelectorAll('#assistantMessages .assistant-msg.ai').length,
      };
    });

    await page.fill('#assistantInput', '请回答当前状态');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages .assistant-msg.ai.assistant-msg-thinking').last()).toBeVisible();
    await expect(page.locator('#assistantMessages')).toContainText('助手正在思考中');
    await expect.poll(() => page.evaluate(() => {
      return document.querySelectorAll('#assistantMessages .assistant-msg.ai').length;
    })).toBe(countsBefore.ai + 1);

    await expect(page.locator('#assistantMessages')).toContainText('这是思考完成后的回复');
    await expect(page.locator('#assistantMessages')).not.toContainText('助手正在思考中');

    const countsAfter = await page.evaluate(() => {
      var aiNodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      var lastText = '';
      if (aiNodes.length) {
        var body = aiNodes[aiNodes.length - 1].querySelector('.assistant-msg-body');
        lastText = body && body.textContent ? String(body.textContent) : '';
      }
      return {
        ai: aiNodes.length,
        thinking: document.querySelectorAll('#assistantMessages .assistant-msg.ai.assistant-msg-thinking').length,
        lastText: lastText,
      };
    });

    expect(countsAfter.ai).toBe(countsBefore.ai + 1);
    expect(countsAfter.thinking).toBe(0);
    expect(countsAfter.lastText).toContain('这是思考完成后的回复');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantThinkingCalls || 0))).toBe(1);
  });

  test('思考中应禁止继续发送，刷新页面后中断思考', async ({ page }) => {
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
      window.__assistantPendingCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantPendingCalls += 1;
          await new Promise(function(resolve) { setTimeout(resolve, 5000); });
          return { ok: true, content: '这条回复不应在刷新后出现' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    const before = await page.evaluate(() => {
      return {
        user: document.querySelectorAll('#assistantMessages .assistant-msg.user').length,
      };
    });

    await page.fill('#assistantInput', '先发第一条');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages .assistant-msg.ai.assistant-msg-thinking').last()).toBeVisible();
    await expect(page.locator('#assistantSendBtn')).toBeDisabled();

    await page.fill('#assistantInput', '思考中再发一条');
    await page.press('#assistantInput', 'Enter');
    await expect.poll(() => page.evaluate(() => {
      return document.querySelectorAll('#assistantMessages .assistant-msg.user').length;
    })).toBe(before.user + 1);
    await expect.poll(() => page.evaluate(() => Number(window.__assistantPendingCalls || 0))).toBe(1);

    await gotoIndex(page);
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
    await expect(page.locator('#assistantSendBtn')).toBeEnabled();
    await expect(page.locator('#assistantMessages')).not.toContainText('助手正在思考中');
    await expect(page.locator('#assistantMessages')).not.toContainText('这条回复不应在刷新后出现');
  });

  test('明确修改用例指令应触发确认并实际执行写操作', async ({ page }) => {
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
      window.__assistantCaseUpdateCalls = [];
      window.__assistantCaseUpdateModelCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantCaseUpdateModelCalls += 1;
          return { ok: true, content: '我先定位目标用例，然后帮你修改。' };
        };
      }
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var toolName = String(name || '');
          if (toolName !== 'case.update') return oldCallTool(name, args);
          var safeArgs = args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
          window.__assistantCaseUpdateCalls.push({ tool: toolName, args: safeArgs });
          if (!safeArgs || safeArgs.confirmed !== true) {
            return {
              ok: false,
              tool: 'case.update',
              reason: 'confirm_required',
              data: {
                actionLabel: '修改用例',
                message: '该操作会写入用例内容，请确认继续。',
              },
            };
          }
          return {
            ok: true,
            tool: 'case.update',
            data: {
              context: 'case-library',
              index: 1,
              field: 'priority',
              value: 'P0',
            },
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '修改该用例的优先级为P0');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await expect(page.locator('#assistantMessages button:has-text("允许操作")').last()).toBeVisible();
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已允许，正在执行...');
    await expect(page.locator('#assistantMessages button:has-text("允许操作")')).toHaveCount(0);

    await expect(page.locator('#assistantMessages')).toContainText('已修改用例：第 1 条');
    await expect.poll(() => page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg');
      if (!cards || !cards.length) return '';
      var last = cards[cards.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('已修改用例：第 1 条');
    await expect.poll(() => page.evaluate(() => {
      var node = document.getElementById('assistantStatus');
      return node && node.textContent ? String(node.textContent).trim() : '';
    })).toBe('');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantCaseUpdateModelCalls || 0))).toBe(0);
    await expect.poll(() => page.evaluate(() => {
      var list = Array.isArray(window.__assistantCaseUpdateCalls) ? window.__assistantCaseUpdateCalls : [];
      return list.length;
    })).toBe(2);
    await expect.poll(() => page.evaluate(() => {
      var list = Array.isArray(window.__assistantCaseUpdateCalls) ? window.__assistantCaseUpdateCalls : [];
      if (list.length < 2) return false;
      var second = list[1] && list[1].args ? list[1].args : {};
      return second.confirmed === true && String(second.field || '') === 'priority' && String(second.value || '') === 'P0';
    })).toBe(true);
  });

  test('拼接标题指令应触发确认并按追加执行', async ({ page }) => {
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
      window.__assistantAppendCalls = [];
      window.__assistantAppendModelCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantAppendModelCalls += 1;
          return { ok: true, content: '不应走到模型默认回复' };
        };
      }
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var toolName = String(name || '');
          if (toolName !== 'case.update') return oldCallTool(name, args);
          var safeArgs = args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
          window.__assistantAppendCalls.push(safeArgs);
          if (!safeArgs || safeArgs.confirmed !== true) {
            return {
              ok: false,
              tool: 'case.update',
              reason: 'confirm_required',
              data: {
                actionLabel: '修改用例',
                message: '该操作会写入用例内容，请确认继续。',
              },
            };
          }
          var prev = '技能描述';
          var next = String(prev) + String(safeArgs.value || '');
          return {
            ok: true,
            tool: 'case.update',
            data: {
              context: 'case-library',
              index: 1,
              field: String(safeArgs.field || 'title'),
              operation: String(safeArgs.operation || ''),
              value: next,
            },
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把该用例的用例标题拼接上“-联机”');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已修改用例：第 1 条，title = 技能描述-联机');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantAppendModelCalls || 0))).toBe(0);
    await expect.poll(() => page.evaluate(() => {
      var list = Array.isArray(window.__assistantAppendCalls) ? window.__assistantAppendCalls : [];
      if (list.length < 2) return false;
      var first = list[0] || {};
      var second = list[1] || {};
      return String(first.field || '') === 'title'
        && String(first.operation || '') === 'append'
        && String(first.value || '') === '-联机'
        && second.confirmed === true
        && String(second.field || '') === 'title'
        && String(second.operation || '') === 'append'
        && String(second.value || '') === '-联机';
    })).toBe(true);
  });

  test('拼接标题无引号指令应按追加执行', async ({ page }) => {
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
      window.__assistantAppendNoQuoteCalls = [];
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var toolName = String(name || '');
          if (toolName !== 'case.update') return oldCallTool(name, args);
          var safeArgs = args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
          window.__assistantAppendNoQuoteCalls.push(safeArgs);
          if (!safeArgs || safeArgs.confirmed !== true) {
            return {
              ok: false,
              tool: 'case.update',
              reason: 'confirm_required',
              data: {
                actionLabel: '修改用例',
                message: '该操作会写入用例内容，请确认继续。',
              },
            };
          }
          var prev = '技能描述';
          return {
            ok: true,
            tool: 'case.update',
            data: {
              context: 'case-library',
              index: 1,
              field: String(safeArgs.field || 'title'),
              operation: String(safeArgs.operation || ''),
              value: prev + String(safeArgs.value || ''),
            },
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把该用例的用例标题拼接上联机');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已修改用例：第 1 条，title = 技能描述联机');
    await expect.poll(() => page.evaluate(() => {
      var list = Array.isArray(window.__assistantAppendNoQuoteCalls) ? window.__assistantAppendNoQuoteCalls : [];
      if (list.length < 2) return false;
      var first = list[0] || {};
      var second = list[1] || {};
      return String(first.field || '') === 'title'
        && String(first.operation || '') === 'append'
        && String(first.value || '') === '联机'
        && second.confirmed === true
        && String(second.operation || '') === 'append'
        && String(second.value || '') === '联机';
    })).toBe(true);
  });

  test('模型误用 ui.fill_input 编辑用例时应改走 case.update', async ({ page }) => {
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
      window.__assistantRewriteUiFillCalls = [];
      window.__assistantRewriteCaseUpdateCalls = [];
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"ui.fill_input","args":{"field":"title","value":"-联机","operation":"append"}}}',
          };
        };
      }
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var toolName = String(name || '');
          var safeArgs = args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
          if (toolName === 'ui.fill_input') {
            window.__assistantRewriteUiFillCalls.push(safeArgs);
            return oldCallTool(name, args);
          }
          if (toolName !== 'case.update') return oldCallTool(name, args);
          window.__assistantRewriteCaseUpdateCalls.push(safeArgs);
          if (!safeArgs || safeArgs.confirmed !== true) {
            return {
              ok: false,
              tool: 'case.update',
              reason: 'confirm_required',
              data: {
                actionLabel: '修改用例',
                message: '该操作会写入用例内容，请确认继续。',
              },
            };
          }
          return {
            ok: true,
            tool: 'case.update',
            data: {
              context: 'case-library',
              index: 1,
              field: 'title',
              operation: String(safeArgs.operation || ''),
              value: '技能描述-联机',
            },
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '请按计划执行修改');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已修改用例：第 1 条，标题 = 技能描述-联机');
    await expect.poll(() => page.evaluate(() => {
      var fillList = Array.isArray(window.__assistantRewriteUiFillCalls) ? window.__assistantRewriteUiFillCalls : [];
      var updateList = Array.isArray(window.__assistantRewriteCaseUpdateCalls) ? window.__assistantRewriteCaseUpdateCalls : [];
      if (updateList.length < 2) return false;
      var first = updateList[0] || {};
      var second = updateList[1] || {};
      return fillList.length === 0
        && String(first.field || '') === 'title'
        && String(first.operation || '') === 'append'
        && String(first.value || '') === '-联机'
        && second.confirmed === true;
    })).toBe(true);
  });

  test('MCP case.update 确认后失败时不应重复弹确认', async ({ page }) => {
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
            content: '{"mcp":{"tool":"case.update","args":{"context":"case-library","value":"P3"}}}',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把当前用例改成P3');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已允许，正在执行...');
    await expect(page.locator('#assistantMessages button:has-text("允许操作")')).toHaveCount(0);
    await expect(page.locator('#assistantMessages')).toContainText('MCP 工具执行失败：缺少可编辑字段');
    await expect.poll(() => page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg');
      if (!cards || !cards.length) return '';
      var last = cards[cards.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    })).toContain('MCP 工具执行失败：缺少可编辑字段');
    await expect.poll(() => page.evaluate(() => {
      var node = document.getElementById('assistantStatus');
      return node && node.textContent ? String(node.textContent).trim() : '';
    })).toBe('');
    await expect.poll(() => page.evaluate(() => {
      var box = document.getElementById('assistantMessages');
      if (!box) return 0;
      var text = String(box.innerText || '');
      var matched = text.match(/准备执行：修改用例/g);
      return matched ? matched.length : 0;
    })).toBe(1);
  });

  test('MCP case.update 缺少字段时应结合用户问题自动补全后执行', async ({ page }) => {
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
      window.__assistantCaseUpdateAutoInferCalls = [];
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"case.update","args":{"value":"P3"}}}',
          };
        };
      }
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var toolName = String(name || '');
          if (toolName !== 'case.update') return oldCallTool(name, args);
          var safeArgs = args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
          window.__assistantCaseUpdateAutoInferCalls.push(safeArgs);
          if (!safeArgs || safeArgs.confirmed !== true) {
            return {
              ok: false,
              tool: 'case.update',
              reason: 'confirm_required',
              data: {
                actionLabel: '修改用例',
                message: '该操作会写入用例内容，请确认继续。',
              },
            };
          }
          if (String(safeArgs.field || '') !== 'priority') {
            return { ok: false, tool: 'case.update', reason: '缺少可编辑字段' };
          }
          return {
            ok: true,
            tool: 'case.update',
            data: {
              context: 'case-library',
              index: 1,
              field: 'priority',
              value: String(safeArgs.value || ''),
            },
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把当前可见用例优先级改成P3');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已修改用例：第 1 条，priority = P3');
    await expect.poll(() => page.evaluate(() => {
      var list = Array.isArray(window.__assistantCaseUpdateAutoInferCalls) ? window.__assistantCaseUpdateAutoInferCalls : [];
      if (list.length < 2) return false;
      var first = list[0] || {};
      var second = list[1] || {};
      return String(first.field || '') === 'priority'
        && String(first.value || '') === 'P3'
        && second.confirmed === true
        && String(second.field || '') === 'priority'
        && String(second.value || '') === 'P3';
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      var node = document.getElementById('assistantStatus');
      return node && node.textContent ? String(node.textContent).trim() : '';
    })).toBe('');
  });

  test('MCP case.update 缺少 value 时支持“字段上，值”问法（标题/备注）', async ({ page }) => {
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
      window.__assistantCaseValueInferCalls = [];
      window.__assistantCaseValueInferRound = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantCaseValueInferRound += 1;
          if (window.__assistantCaseValueInferRound === 1) {
            return {
              ok: true,
              content: '{"mcp":{"tool":"case.update","args":{"context":"case-library","field":"title","index":1}}}',
            };
          }
          return {
            ok: true,
            content: '{"mcp":{"tool":"case.update","args":{"context":"tempexec","field":"remark","index":2}}}',
          };
        };
      }
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var toolName = String(name || '');
          if (toolName !== 'case.update') return oldCallTool(name, args);
          var safeArgs = args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
          window.__assistantCaseValueInferCalls.push(safeArgs);
          if (!safeArgs || safeArgs.confirmed !== true) {
            return {
              ok: false,
              tool: 'case.update',
              reason: 'confirm_required',
              data: {
                actionLabel: '修改用例',
                message: '该操作会写入用例内容，请确认继续。',
              },
            };
          }
          if (!safeArgs.value || !String(safeArgs.value).trim()) {
            return { ok: false, tool: 'case.update', reason: '缺少要写入的值' };
          }
          return {
            ok: true,
            tool: 'case.update',
            data: {
              context: safeArgs.context ? String(safeArgs.context) : '',
              index: Number(safeArgs.index || 1),
              field: safeArgs.field ? String(safeArgs.field) : '',
              value: String(safeArgs.value || ''),
            },
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '并且标题上，联机稳定性');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已修改用例：第 1 条，标题 = 联机稳定性');

    await page.fill('#assistantInput', '并且备注上，测试用的');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已修改用例：第 2 条，备注 = 测试用的');

    await expect.poll(() => page.evaluate(() => {
      var list = Array.isArray(window.__assistantCaseValueInferCalls) ? window.__assistantCaseValueInferCalls : [];
      if (list.length < 4) return false;
      var first = list[0] || {};
      var firstConfirm = list[1] || {};
      var second = list[2] || {};
      var secondConfirm = list[3] || {};
      return String(first.field || '') === 'title'
        && String(first.value || '') === '联机稳定性'
        && firstConfirm.confirmed === true
        && String(firstConfirm.value || '') === '联机稳定性'
        && String(second.field || '') === 'remark'
        && String(second.value || '') === '测试用的'
        && secondConfirm.confirmed === true
        && String(secondConfirm.value || '') === '测试用的';
    })).toBe(true);
  });

  test('模型报错可自动诊断，代填前需聊天确认且可重测', async ({ page }) => {
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
    await expect(page.locator('#assistantMessages')).toContainText('准备执行：应用建议模型配置');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
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

  test('模型重复输出 action JSON 时应仍可执行，并支持中文名追问', async ({ page }) => {
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
      window.__assistantActionReplyCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(userText) {
          var text = String(userText || '').trim();
          window.__assistantActionReplyCalls += 1;
          if (text.indexOf('当前页面') !== -1) {
            return { ok: true, content: '{"action":"current_page_info"}{"action":"current_page_info"}' };
          }
          return {
            ok: true,
            content: '你是想看**当前页面的中文名**对吗？\n我可以直接帮你取，发我一句：**“获取当前页面数据”**。',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '当前页面时什么');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前页面是：');
    await expect(page.locator('#assistantMessages')).not.toContainText('{"action":"current_page_info"}');

    await page.fill('#assistantInput', '中文名');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前页面中文名：');
    await expect(page.locator('#assistantMessages')).not.toContainText('获取当前页面数据');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantActionReplyCalls || 0))).toBe(2);
  });

  test('页面功能介绍命中旧分支时也应交给模型整理', async ({ page }) => {
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
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecActiveId = 'exec-file-1';
        window.app.state.tempExecActiveFileId = 'exec-file-1';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-file-1',
            name: '狼人技能优化',
            projectId: '2001',
            versionId: '301',
            cases: [
              { id: '95', module: '通用', title: '技能描述-联机', priority: 'P1', preconditions: '联机模式', steps: '查看技能描述', expected: '描述正确', remark: '主链路', actual: '通过' },
              { id: '96', module: '技能效果', title: '第二技能按钮', priority: 'P2', preconditions: '进入战斗', steps: '点击按钮', expected: '按钮可点击', remark: '支链路', actual: '通过' },
            ],
          },
        ];
      }
      window.__assistantPageFunctionRoutePayload = null;
      window.__assistantPageFunctionCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText) {
          var raw = String(inputText || '').trim();
          var payload = null;
          window.__assistantPageFunctionCalls += 1;
          if (raw === '模糊问题') {
            return { ok: true, content: '你可以继续直接发我：1. 用例 ID。2. 完整标题。' };
          }
          try {
            payload = JSON.parse(raw);
          } catch (err) {
            payload = null;
          }
          if (payload && payload.routeName === 'current_page_function') {
            window.__assistantPageFunctionRoutePayload = payload;
            return {
              ok: true,
              content: '这个页面主要用于执行与核对当前测试用例。\n- 可查看当前执行文件中的全部用例。\n- 可更新执行结果与备注。\n- 可结合当前上下文继续提问。',
            };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '模糊问题');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('你可以继续直接发我：1. 用例 ID。2. 完整标题。');

    await page.fill('#assistantInput', '介绍下这个页面的功能');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => Boolean(window.__assistantPageFunctionRoutePayload))).toBe(true);
    const routePayload = await page.evaluate(() => window.__assistantPageFunctionRoutePayload || null);
    expect(routePayload).toBeTruthy();
    expect(routePayload.routeName).toBe('current_page_function');
    expect(routePayload.routeData).toBeTruthy();
    expect(routePayload.routeData.pageData).toBeTruthy();
    expect(routePayload.routeData.pageData.tab).toBe('tempexec');
    expect(routePayload.routeData.pageData.currentCaseContext).toBeTruthy();
    expect(routePayload.routeData.pageData.currentCaseContext.fileName).toBe('狼人技能优化');

    const lastText = await page.evaluate(() => {
      var nodes = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!nodes || !nodes.length) return '';
      var last = nodes[nodes.length - 1];
      return last && last.innerText ? String(last.innerText) : '';
    });
    expect(lastText).toContain('这个页面主要用于执行与核对当前测试用例');
    expect(lastText).toContain('可查看当前执行文件中的全部用例');
    expect(lastText).not.toContain('你可以继续直接发我：1. 用例 ID。2. 完整标题。');
  });

  test('模型可通过 MCP 工具调用返回当前页面用例数量', async ({ page }) => {
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
      window.__assistantMcpCountCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantMcpCountCalls += 1;
          return {
            ok: true,
            content: '{"mcp":{"tool":"cases.list_current","args":{"scope":"editor","countOnly":true}}}',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '当前页面有多少条用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前正在编辑用例：狼人技能优化');
    await expect(page.locator('#assistantMessages')).toContainText('当前页面用例数量：2 条');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantMcpCountCalls || 0))).toBeGreaterThanOrEqual(1);
  });

  test('模型返回 legacy query_case_list 动作时应基于数据自由回答', async ({ page }) => {
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
            total: 2,
            totalAll: 2,
            truncated: false,
            items: [
              {
                index: 1,
                sourceIndex: 1,
                id: '7593',
                module: '技能效果',
                title: '单点吞噬',
                priority: 'P1',
                precondition: '',
                steps: '',
                expected: '',
                remark: '',
                executionResult: '未执行',
              },
              {
                index: 2,
                sourceIndex: 2,
                id: '7596',
                module: '技能效果',
                title: '蓄力吞噬',
                priority: 'P1',
                precondition: '',
                steps: '',
                expected: '',
                remark: '',
                executionResult: '通过',
              },
            ],
          };
        };
      }
      window.__assistantLegacyCaseListCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(input, options) {
          window.__assistantLegacyCaseListCalls += 1;
          var prompt = options && options.prompt ? String(options.prompt) : '';
          if (prompt.indexOf('工具结果解读助手') !== -1) {
            return {
              ok: true,
              content: '不是。当前页面有 2 条用例，其中 1 条已执行通过，1 条未执行。',
            };
          }
          return {
            ok: true,
            content: '{"action":"query_case_list","scope":"editor"}',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '全部都没执行吗？');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('不是。当前页面有 2 条用例');
    await expect(page.locator('#assistantMessages')).toContainText('1 条已执行通过，1 条未执行');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前页面用例明细');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantLegacyCaseListCalls || 0))).toBe(2);
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

  test('搜索模块用例时应优先返回用例结果而非控件列表', async ({ page }) => {
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
      }
      window.__assistantCaseLibrarySearchKeyword = '';
      var searchInput = document.getElementById('caseLibraryEditSearchInput');
      if (!searchInput) {
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'caseLibraryEditSearchInput';
        searchInput.placeholder = '用例库搜索';
        searchInput.style.position = 'fixed';
        searchInput.style.left = '16px';
        searchInput.style.top = '120px';
        searchInput.style.width = '220px';
        document.body.appendChild(searchInput);
      }
      searchInput.addEventListener('input', function() {
        window.__assistantCaseLibrarySearchKeyword = searchInput && searchInput.value ? String(searchInput.value) : '';
      });
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
            total: 4,
            totalAll: 4,
            truncated: false,
            items: [
              { index: 1, sourceIndex: 1, id: '7582', module: '通用', title: '技能冷却', priority: 'P1', precondition: '技能解锁', steps: '释放技能', expected: '冷却正常', remark: '' },
              { index: 2, sourceIndex: 2, id: '7587', module: '通用', title: '死亡复活', priority: 'P1', precondition: '角色死亡', steps: '触发复活', expected: '可复活', remark: '' },
              { index: 3, sourceIndex: 3, id: '7601', module: '地图', title: '地图探索', priority: 'P1', precondition: '进入地图', steps: '移动探索', expected: '地图可交互', remark: '' },
              { index: 4, sourceIndex: 4, id: '7602', module: '技能效果', title: '蓄力吞噬', priority: 'P1', precondition: '技能蓄力', steps: '释放吞噬', expected: '造成伤害', remark: '' },
            ],
          };
        };
      }
      window.__assistantSearchPlannerCalls = 0;
      window.__assistantSearchSummaryCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(input, options) {
          var prompt = options && options.prompt ? String(options.prompt) : '';
          if (prompt.indexOf('用例筛选规划助手') !== -1) {
            window.__assistantSearchPlannerCalls += 1;
            return { ok: true, content: '{"mode":"filter","includeKeywords":["技能效果"],"excludeKeywords":[],"indexParity":"","idParity":""}' };
          }
          if (prompt.indexOf('工具结果解读助手') !== -1) {
            window.__assistantSearchSummaryCalls += 1;
            return { ok: false, reason: 'mock summary failure' };
          }
          return { ok: true, content: '{"mcp":{"tool":"ui.list_controls","args":{"max":120}}}' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '帮我搜索技能效果模块的用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前正在编辑用例：狼人技能优化');
    await expect(page.locator('#assistantMessages')).toContainText('已按条件过滤：包含“技能效果”');
    await expect(page.locator('#assistantMessages')).toContainText('蓄力吞噬');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前可操作控件：');
    await expect(page.locator('#assistantMessages')).not.toContainText('死亡复活');
    await expect.poll(() => page.evaluate(() => String(window.__assistantCaseLibrarySearchKeyword || ''))).toBe('技能效果');
    await expect.poll(() => page.evaluate(() => {
      var input = document.getElementById('caseLibraryEditSearchInput');
      return input && input.value ? String(input.value) : '';
    })).toBe('技能效果');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantSearchPlannerCalls || 0))).toBe(1);
    await expect.poll(() => page.evaluate(() => Number(window.__assistantSearchSummaryCalls || 0))).toBe(1);
  });

  test('当前页面用例查询支持任意字段模糊命中并允许模型自主输出列表', async ({ page }) => {
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
      }
      window.__assistantCaseLibrarySearchKeyword = '';
      var searchInput = document.getElementById('caseLibraryEditSearchInput');
      if (!searchInput) {
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'caseLibraryEditSearchInput';
        searchInput.placeholder = '用例库搜索';
        searchInput.style.position = 'fixed';
        searchInput.style.left = '16px';
        searchInput.style.top = '120px';
        searchInput.style.width = '220px';
        document.body.appendChild(searchInput);
      }
      searchInput.addEventListener('input', function() {
        window.__assistantCaseLibrarySearchKeyword = searchInput && searchInput.value ? String(searchInput.value) : '';
      });
      if (window.app && window.app.caseLibraryApi) {
        window.app.caseLibraryApi.getCurrentEditorCaseSnapshot = function() {
          return {
            ok: true,
            hasContext: true,
            scope: 'editor',
            contextSource: 'case-library',
            projectId: '2001',
            caseFile: {
              id: '95',
              name: '狼人技能优化',
              projectId: '2001',
              versionId: '301',
            },
            searchText: '',
            total: 4,
            totalAll: 4,
            truncated: false,
            items: [
              { index: 1, sourceIndex: 1, id: '9001', module: '技能', title: '狼人成长技能展示', priority: 'P1', precondition: '角色已解锁', steps: '进入战斗', expected: '技能展示正确', remark: '覆盖主流程' },
              { index: 2, sourceIndex: 2, id: '9002', module: '结算', title: '技能冷却校验', priority: 'P1', precondition: '技能进入冷却', steps: '等待冷却完成', expected: '冷却时间正确', remark: '边界值5秒' },
              { index: 3, sourceIndex: 3, id: '9003', module: '联机', title: '多人联机稳定性', priority: 'P1', precondition: '网络良好', steps: '重复进出房间并结算', expected: '流程稳定无报错', remark: '长文本备注用于验证滚动与换行展示' },
              { index: 4, sourceIndex: 4, id: '9004', module: '背包', title: '道具整理', priority: 'P2', precondition: '背包有多个道具', steps: '拖拽调整排序', expected: '道具排序正确', remark: '普通场景' },
            ],
          };
        };
      }
      window.__assistantFuzzyFilterSummaryCalls = 0;
      window.__assistantFuzzyFilterPlannerCalls = 0;
      window.__assistantFuzzyFilterToolPayload = null;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText, options) {
          var prompt = options && options.prompt ? String(options.prompt) : '';
          if (prompt.indexOf('用例筛选规划助手') !== -1) {
            window.__assistantFuzzyFilterPlannerCalls += 1;
            return { ok: true, content: '{"mode":"filter","includeKeywords":["边界值5秒"],"excludeKeywords":[],"indexParity":"","idParity":""}' };
          }
          if (prompt.indexOf('工具结果解读助手') !== -1) {
            var payload = null;
            var items = [];
            var first = null;
            window.__assistantFuzzyFilterSummaryCalls += 1;
            try {
              payload = JSON.parse(String(inputText || ''));
            } catch (err) {
              payload = null;
            }
            if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
              window.__assistantFuzzyFilterToolPayload = payload.toolResult;
              items = Array.isArray(payload.toolResult.items) ? payload.toolResult.items : [];
            }
            first = items.length ? items[0] : null;
            return {
              ok: true,
              content: [
                '1. ' + (first && first.title ? String(first.title) : '未命中'),
                '- 备注：' + (first && first.remark ? String(first.remark) : '—'),
                '- ID：' + (first && first.id ? String(first.id) : '—'),
              ].join('\n'),
            };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把包含“边界值5秒”的用例展示出来');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => Number(window.__assistantFuzzyFilterSummaryCalls || 0))).toBe(1);
    await expect.poll(() => page.evaluate(() => Number(window.__assistantFuzzyFilterPlannerCalls || 0))).toBe(1);
    await expect.poll(() => page.evaluate(() => String(window.__assistantCaseLibrarySearchKeyword || ''))).toBe('边界值5秒');

    const fuzzyPayload = await page.evaluate(() => window.__assistantFuzzyFilterToolPayload || null);
    expect(fuzzyPayload).toBeTruthy();
    expect(fuzzyPayload.scope).toBe('editor');
    expect(fuzzyPayload.filterSummary).toBe('包含“边界值5秒”');
    expect(fuzzyPayload.filterInfo).toBeTruthy();
    expect(Array.isArray(fuzzyPayload.filterInfo.includeKeywords)).toBeTruthy();
    expect(fuzzyPayload.filterInfo.includeKeywords).toContain('边界值5秒');
    expect(Array.isArray(fuzzyPayload.items)).toBeTruthy();
    expect(fuzzyPayload.items).toHaveLength(1);
    expect(fuzzyPayload.items[0].id).toBe('9002');
    expect(fuzzyPayload.items[0].title).toBe('技能冷却校验');
    expect(fuzzyPayload.items[0].remark).toBe('边界值5秒');

    await expect(page.locator('#assistantMessages')).toContainText('技能冷却校验');
    await expect(page.locator('#assistantMessages')).toContainText('边界值5秒');
    await expect(page.locator('#assistantMessages')).not.toContainText('狼人成长技能展示');
    await expect(page.locator('#assistantMessages')).not.toContainText('多人联机稳定性');

    const fuzzyRendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) return { hasTable: false };
      var last = cards[cards.length - 1];
      return { hasTable: Boolean(last && last.querySelector('table')) };
    });
    expect(fuzzyRendered.hasTable).toBeFalsy();
  });

  test('未加引号多关键词查询不应把“这些关键字”并入真实关键词，且原始问句应交给模型', async ({ page }) => {
    const modelId = 'assistant-model-1';
    const queryText = '帮我把包含联机、死亡这些关键字的用例列出来';

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
      }
      if (window.app && window.app.caseLibraryApi) {
        window.app.caseLibraryApi.getCurrentEditorCaseSnapshot = function() {
          return {
            ok: true,
            hasContext: true,
            scope: 'editor',
            contextSource: 'case-library',
            projectId: '2001',
            caseFile: {
              id: '95',
              name: '狼人技能优化',
              projectId: '2001',
              versionId: '301',
            },
            searchText: '',
            total: 4,
            totalAll: 4,
            truncated: false,
            items: [
              { index: 1, sourceIndex: 1, id: '9001', module: '联机', title: '多人联机稳定性', priority: 'P1', precondition: '网络良好', steps: '重复进出房间并结算', expected: '流程稳定无报错', remark: '联机主链路' },
              { index: 2, sourceIndex: 2, id: '9002', module: '结算', title: '角色死亡结算校验', priority: 'P1', precondition: '角色死亡', steps: '触发结算', expected: '死亡结算正确', remark: '死亡流程' },
              { index: 3, sourceIndex: 3, id: '9003', module: '战斗', title: '技能冷却校验', priority: 'P1', precondition: '技能进入冷却', steps: '等待冷却完成', expected: '冷却时间正确', remark: '边界值5秒' },
              { index: 4, sourceIndex: 4, id: '9004', module: '背包', title: '道具整理', priority: 'P2', precondition: '背包有多个道具', steps: '拖拽调整排序', expected: '道具排序正确', remark: '普通场景' },
            ],
          };
        };
      }
      window.__assistantKeywordSuffixSummaryCalls = 0;
      window.__assistantKeywordSuffixPlannerCalls = 0;
      window.__assistantKeywordSuffixPayload = null;
      window.__assistantKeywordSuffixPlannerPayload = null;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText, options) {
          var prompt = options && options.prompt ? String(options.prompt) : '';
          if (prompt.indexOf('用例筛选规划助手') !== -1) {
            var plannerPayload = null;
            window.__assistantKeywordSuffixPlannerCalls += 1;
            try {
              plannerPayload = JSON.parse(String(inputText || ''));
            } catch (err) {
              plannerPayload = null;
            }
            window.__assistantKeywordSuffixPlannerPayload = plannerPayload;
            return { ok: true, content: '{"mode":"filter","includeKeywords":["联机","死亡"],"excludeKeywords":[],"indexParity":"","idParity":""}' };
          }
          if (prompt.indexOf('工具结果解读助手') !== -1) {
            var payload = null;
            var items = [];
            window.__assistantKeywordSuffixSummaryCalls += 1;
            try {
              payload = JSON.parse(String(inputText || ''));
            } catch (err) {
              payload = null;
            }
            if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
              window.__assistantKeywordSuffixPayload = payload;
              items = Array.isArray(payload.toolResult.items) ? payload.toolResult.items : [];
            }
            return {
              ok: true,
              content: items.map(function(item, idx) {
                return (idx + 1) + '. ' + String(item && item.title ? item.title : '');
              }).join('\n'),
            };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', queryText);
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => Number(window.__assistantKeywordSuffixSummaryCalls || 0))).toBe(1);
    await expect.poll(() => page.evaluate(() => Number(window.__assistantKeywordSuffixPlannerCalls || 0))).toBe(1);

    const suffixPlannerPayload = await page.evaluate(() => window.__assistantKeywordSuffixPlannerPayload || null);
    expect(suffixPlannerPayload).toBeTruthy();
    expect(suffixPlannerPayload.userQuestion).toBe(queryText);

    const suffixPayload = await page.evaluate(() => window.__assistantKeywordSuffixPayload || null);
    expect(suffixPayload).toBeTruthy();
    expect(suffixPayload.userQuestion).toBe(queryText);
    expect(suffixPayload.toolResult).toBeTruthy();
    expect(suffixPayload.toolResult.filterSummary).toBe('包含“联机”、“死亡”');
    expect(suffixPayload.toolResult.filterInfo).toBeTruthy();
    expect(Array.isArray(suffixPayload.toolResult.filterInfo.includeKeywords)).toBeTruthy();
    expect(suffixPayload.toolResult.filterInfo.includeKeywords).toEqual(['联机', '死亡']);
    expect(Array.isArray(suffixPayload.toolResult.items)).toBeTruthy();
    expect(suffixPayload.toolResult.items).toHaveLength(2);
    expect(suffixPayload.toolResult.items.map(function(item) { return item.title; })).toEqual(['多人联机稳定性', '角色死亡结算校验']);

    await expect(page.locator('#assistantMessages')).toContainText('多人联机稳定性');
    await expect(page.locator('#assistantMessages')).toContainText('角色死亡结算校验');
    await expect(page.locator('#assistantMessages')).not.toContainText('技能冷却校验');
  });

  test('编号为偶数的用例展示应按当前页序号筛选并允许模型输出表格', async ({ page }) => {
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
      }
      if (window.app && window.app.caseLibraryApi) {
        window.app.caseLibraryApi.getCurrentEditorCaseSnapshot = function() {
          return {
            ok: true,
            hasContext: true,
            scope: 'editor',
            contextSource: 'case-library',
            projectId: '2001',
            caseFile: {
              id: '97',
              name: '狼人战斗回归',
              projectId: '2001',
              versionId: '302',
            },
            searchText: '',
            total: 6,
            totalAll: 6,
            truncated: false,
            items: [
              { index: 1, sourceIndex: 1, id: '8101', module: '战斗', title: '普通攻击', priority: 'P1', precondition: '进入战斗', steps: '点击普攻', expected: '造成伤害', remark: '序号1' },
              { index: 2, sourceIndex: 2, id: '8102', module: '战斗', title: '技能施放', priority: 'P1', precondition: '能量充足', steps: '释放主动技能', expected: '技能施放成功', remark: '序号2' },
              { index: 3, sourceIndex: 3, id: '8103', module: '战斗', title: '闪避', priority: 'P1', precondition: '敌人攻击中', steps: '点击闪避', expected: '成功躲避伤害', remark: '序号3' },
              { index: 4, sourceIndex: 4, id: '8104', module: '战斗', title: '终结技', priority: 'P0', precondition: '怒气已满', steps: '释放终结技', expected: '终结技动画正确', remark: '序号4' },
              { index: 5, sourceIndex: 5, id: '8105', module: '战斗', title: '切换目标', priority: 'P2', precondition: '存在多个敌人', steps: '点击目标切换', expected: '目标切换成功', remark: '序号5' },
              { index: 6, sourceIndex: 6, id: '8106', module: '战斗', title: '自动战斗', priority: 'P1', precondition: '开启自动战斗', steps: '观察战斗行为', expected: '自动释放技能', remark: '序号6' },
            ],
          };
        };
      }
      window.__assistantEvenFilterSummaryCalls = 0;
      window.__assistantEvenFilterPlannerCalls = 0;
      window.__assistantEvenFilterToolPayload = null;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText, options) {
          var prompt = options && options.prompt ? String(options.prompt) : '';
          if (prompt.indexOf('用例筛选规划助手') !== -1) {
            window.__assistantEvenFilterPlannerCalls += 1;
            return { ok: true, content: '{"mode":"filter","includeKeywords":[],"excludeKeywords":[],"indexParity":"even","idParity":""}' };
          }
          if (prompt.indexOf('工具结果解读助手') !== -1) {
            var payload = null;
            var items = [];
            var lines = [
              '| 序号 | ID | 标题 | 备注 |',
              '| --- | --- | --- | --- |',
            ];
            window.__assistantEvenFilterSummaryCalls += 1;
            try {
              payload = JSON.parse(String(inputText || ''));
            } catch (err) {
              payload = null;
            }
            if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
              window.__assistantEvenFilterToolPayload = payload.toolResult;
              items = Array.isArray(payload.toolResult.items) ? payload.toolResult.items : [];
            }
            items.forEach(function(item) {
              var row = item && typeof item === 'object' ? item : {};
              lines.push('| ' + (row.index || '') + ' | ' + (row.id || '') + ' | ' + (row.title || '') + ' | ' + (row.remark || '') + ' |');
            });
            return { ok: true, content: lines.join('\n') };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把编号为偶数的用例展示出来');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => Number(window.__assistantEvenFilterSummaryCalls || 0))).toBe(1);
    await expect.poll(() => page.evaluate(() => Number(window.__assistantEvenFilterPlannerCalls || 0))).toBe(1);

    const evenPayload = await page.evaluate(() => window.__assistantEvenFilterToolPayload || null);
    expect(evenPayload).toBeTruthy();
    expect(evenPayload.scope).toBe('editor');
    expect(evenPayload.filterSummary).toBe('序号为偶数');
    expect(evenPayload.filterInfo).toBeTruthy();
    expect(evenPayload.filterInfo.indexParity).toBe('even');
    expect(Array.isArray(evenPayload.items)).toBeTruthy();
    expect(evenPayload.items).toHaveLength(3);
    expect(evenPayload.items.map(function(item) { return Number(item.index); })).toEqual([2, 4, 6]);
    expect(evenPayload.items.map(function(item) { return String(item.id); })).toEqual(['8102', '8104', '8106']);
    expect(evenPayload.items[0].remark).toBe('序号2');

    await expect(page.locator('#assistantMessages')).toContainText('技能施放');
    await expect(page.locator('#assistantMessages')).toContainText('终结技');
    await expect(page.locator('#assistantMessages')).toContainText('自动战斗');
    await expect(page.locator('#assistantMessages')).not.toContainText('普通攻击');
    await expect(page.locator('#assistantMessages')).not.toContainText('闪避');
    await expect(page.locator('#assistantMessages')).not.toContainText('切换目标');

    const evenRendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return { hasTable: false, rowCount: 0, headers: [] };
      }
      var last = cards[cards.length - 1];
      var table = last ? last.querySelector('table') : null;
      return {
        hasTable: Boolean(table),
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
        headers: table ? Array.prototype.map.call(table.querySelectorAll('thead th'), function(th) {
          return String(th && th.textContent ? th.textContent : '').trim();
        }) : [],
      };
    });
    expect(evenRendered.hasTable).toBeTruthy();
    expect(evenRendered.rowCount).toBe(3);
    expect(evenRendered.headers).toContain('序号');
    expect(evenRendered.headers).toContain('标题');
    expect(evenRendered.headers).toContain('备注');
  });

  test('当前页面有多少条用例应直接返回数量', async ({ page }) => {
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

    await page.fill('#assistantInput', '当前页面有多少条用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('当前正在编辑用例：狼人技能优化');
    await expect(page.locator('#assistantMessages')).toContainText('当前页面用例数量：2 条');
    await expect(page.locator('#assistantMessages')).not.toContainText('获取当前页面数据');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前页面用例明细（完整字段）');
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

  test('助手用例表超过10条时聊天区应缩略展示，展开后查看全部', async ({ page }) => {
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
          var items = [];
          var i = 0;
          for (i = 1; i <= 12; i += 1) {
            var label = i < 10 ? ('0' + i) : String(i);
            items.push({
              index: i,
              sourceIndex: i,
              id: '91' + label,
              module: i % 2 === 0 ? '战斗' : '系统',
              title: '超长列表用例' + label,
              priority: i % 2 === 0 ? 'P1' : 'P2',
              precondition: '前置条件' + label,
              steps: '执行步骤' + label,
              expected: '预期结果' + label,
              remark: '备注' + label,
            });
          }
          return {
            ok: true,
            hasContext: true,
            scope: 'editor',
            contextSource: 'case-library',
            projectId: '2001',
            caseFile: { id: '48', name: '狼人技能优化', projectId: '2001', versionId: '301' },
            searchText: '',
            total: 12,
            totalAll: 12,
            truncated: false,
            items: items,
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '现在的页面有什么用例');
    await page.click('#assistantSendBtn');

    const chatMeta = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return {
          dataRowCount: 0,
          ellipsisRowCount: 0,
          ellipsisText: '',
          ellipsisTextAlign: '',
          summaryText: '',
          actionsJustifyContent: '',
          buttonOffsetLeft: -1,
          hasTemplate: false,
          templateRowCount: 0,
          chatText: '',
        };
      }
      var last = cards[cards.length - 1];
      var table = last ? last.querySelector('table.assistant-case-table') : null;
      var summary = last ? last.querySelector('.assistant-case-table-summary') : null;
      var actions = last ? last.querySelector('.assistant-case-table-actions') : null;
      var button = last ? last.querySelector('.assistant-case-table-expand-btn') : null;
      var template = last ? last.querySelector('template.assistant-case-table-full-template') : null;
      var templateTable = template && template.content && template.content.querySelector
        ? template.content.querySelector('table.assistant-case-table')
        : null;
      var ellipsisRows = table ? table.querySelectorAll('tbody tr.assistant-case-table-ellipsis-row') : [];
      var dataRows = table ? table.querySelectorAll('tbody tr:not(.assistant-case-table-ellipsis-row)') : [];
      var ellipsisRow = ellipsisRows && ellipsisRows.length ? ellipsisRows[0] : null;
      var ellipsisCell = ellipsisRow ? ellipsisRow.querySelector('td') : null;
      return {
        dataRowCount: dataRows ? dataRows.length : 0,
        ellipsisRowCount: ellipsisRows ? ellipsisRows.length : 0,
        ellipsisText: ellipsisRow ? String(ellipsisRow.textContent || '').trim() : '',
        ellipsisTextAlign: ellipsisCell ? window.getComputedStyle(ellipsisCell).textAlign : '',
        summaryText: summary ? String(summary.textContent || '').trim() : '',
        actionsJustifyContent: actions ? window.getComputedStyle(actions).justifyContent : '',
        buttonOffsetLeft: actions && button ? Math.round(button.getBoundingClientRect().left - actions.getBoundingClientRect().left) : -1,
        hasTemplate: Boolean(templateTable),
        templateRowCount: templateTable ? templateTable.querySelectorAll('tbody tr').length : 0,
        chatText: String(last && last.textContent ? last.textContent : ''),
      };
    });
    expect(chatMeta.dataRowCount).toBe(10);
    expect(chatMeta.ellipsisRowCount).toBe(1);
    expect(chatMeta.ellipsisText).toContain('其余 2 条已折叠');
    expect(chatMeta.ellipsisText).toContain('12 条');
    expect(chatMeta.ellipsisTextAlign).toBe('left');
    expect(chatMeta.summaryText).toContain('未完整展开');
    expect(chatMeta.summaryText).toContain('前 10 条');
    expect(chatMeta.summaryText).toContain('其余 2 条已折叠');
    expect(chatMeta.actionsJustifyContent).toBe('flex-start');
    expect(chatMeta.buttonOffsetLeft).toBeLessThan(24);
    expect(chatMeta.hasTemplate).toBeTruthy();
    expect(chatMeta.templateRowCount).toBe(12);
    expect(chatMeta.chatText).toContain('超长列表用例10');
    expect(chatMeta.chatText).toContain('未完整展开');
    expect(chatMeta.chatText).not.toContain('超长列表用例11');

    const expandBtn = page.locator('#assistantMessages .assistant-case-table-expand-btn').last();
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();
    await expect(page.locator('#assistantCasePreview')).not.toHaveClass(/hidden/);

    const previewMeta = await page.evaluate(() => {
      var body = document.getElementById('assistantCasePreviewBody');
      var table = body ? body.querySelector('table.assistant-case-table') : null;
      return {
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
        text: String(body && body.textContent ? body.textContent : ''),
      };
    });
    expect(previewMeta.rowCount).toBe(12);
    expect(previewMeta.text).toContain('超长列表用例11');
    expect(previewMeta.text).toContain('超长列表用例12');
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

  test('完整展示当前页面用例时应把完整字段交给模型并允许模型输出表格', async ({ page }) => {
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
      window.__assistantFullCaseModelCallCount = 0;
      window.__assistantFullCaseToolPayload = null;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText) {
          window.__assistantFullCaseModelCallCount += 1;
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
            window.__assistantFullCaseToolPayload = payload.toolResult;
            var items = Array.isArray(payload.toolResult.items) ? payload.toolResult.items : [];
            var lines = [
              '| 序号 | ID | 模块 | 标题 | 优先级 | 前置条件 | 步骤 | 预期结果 | 备注 | 执行结果 |',
              '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
            ];
            items.forEach(function(item) {
              lines.push('| ' + (item.index || '')
                + ' | ' + (item.id || '')
                + ' | ' + (item.module || '')
                + ' | ' + (item.title || '')
                + ' | ' + (item.priority || '')
                + ' | ' + (item.precondition || '')
                + ' | ' + (item.steps || '')
                + ' | ' + (item.expected || '')
                + ' | ' + (item.remark || '')
                + ' | ' + (item.executionResult || '')
                + ' |');
            });
            return { ok: true, content: lines.join('\n') };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把当前页面用例完整展示给我');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => Number(window.__assistantFullCaseModelCallCount || 0))).toBe(1);
    const payload = await page.evaluate(() => window.__assistantFullCaseToolPayload || null);
    expect(payload).toBeTruthy();
    expect(payload.args.detailLevel).toBe('full');
    expect(payload.contextSource).toBe('tempexec');
    expect(payload.items[0].precondition).toBe('账号已注册');
    expect(payload.items[0].steps).toBe('输入账号密码并登录');
    expect(payload.items[0].expected).toBe('登录成功');
    expect(payload.items[0].remark).toBe('主链路');

    await expect(page.locator('#assistantMessages')).toContainText('账号密码登录');
    await expect(page.locator('#assistantMessages')).toContainText('余额不足支付失败');
    await expect(page.locator('#assistantMessages')).toContainText('账号已注册');
    await expect(page.locator('#assistantMessages')).toContainText('提示余额不足');
    await expect(page.locator('#assistantMessages')).not.toContainText('按你上文语境');
    await expect(page.locator('#assistantMessages')).not.toContainText('如果你指的是');

    const rendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return { hasTable: false, headers: [], rowCount: 0 };
      }
      var last = cards[cards.length - 1];
      var table = last ? last.querySelector('table') : null;
      return {
        hasTable: Boolean(table),
        headers: table ? Array.prototype.map.call(table.querySelectorAll('thead th'), function(th) {
          return String(th && th.textContent ? th.textContent : '').trim();
        }) : [],
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
      };
    });
    expect(rendered.hasTable).toBeTruthy();
    expect(rendered.rowCount).toBe(2);
    expect(rendered.headers).toContain('前置条件');
    expect(rendered.headers).toContain('步骤');
    expect(rendered.headers).toContain('预期结果');
    expect(rendered.headers).toContain('备注');
    expect(rendered.headers).toContain('执行结果');
  });

  test('模型返回用例表别名表头时仍应识别为可展开用例表', async ({ page }) => {
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
                id: '7589',
                module: '通用',
                title: '联机',
                priority: 'P1',
                preconditions: '联机模式',
                steps: '队友观察技能效果',
                expected: '队友视角展示技能效果',
                remark: '主链路',
                actual: '通过',
              },
              {
                id: '7590',
                module: '战斗',
                title: '离线',
                priority: 'P2',
                preconditions: '离线模式',
                steps: '观察技能效果',
                expected: '本地视角展示技能效果',
                remark: '支链路',
                actual: '失败',
              },
            ],
          },
        ];
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText) {
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
            var items = Array.isArray(payload.toolResult.items) ? payload.toolResult.items : [];
            var lines = [
              '| 编号 | 用例ID | 模块 | 标题 | 优先级 | 前置条件 | 步骤 | 预期结果 | 备注 | 执行结果 |',
              '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
            ];
            items.forEach(function(item) {
              lines.push('| ' + (item.index || '')
                + ' | ' + (item.id || '')
                + ' | ' + (item.module || '')
                + ' | ' + (item.title || '')
                + ' | ' + (item.priority || '')
                + ' | ' + (item.precondition || '')
                + ' | ' + (item.steps || '')
                + ' | ' + (item.expected || '')
                + ' | ' + (item.remark || '')
                + ' | ' + (item.executionResult || '')
                + ' |');
            });
            return { ok: true, content: lines.join('\n') };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把当前页面用例完整展示给我');
    await page.click('#assistantSendBtn');

    const rendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return { hasCaseTable: false, hasExpandButton: false, headers: [], rowCount: 0 };
      }
      var last = cards[cards.length - 1];
      var table = last ? last.querySelector('table.assistant-case-table') : null;
      var button = last ? last.querySelector('.assistant-case-table-expand-btn') : null;
      return {
        hasCaseTable: Boolean(table),
        hasExpandButton: Boolean(button),
        headers: table ? Array.prototype.map.call(table.querySelectorAll('thead th'), function(th) {
          return String(th && th.textContent ? th.textContent : '').trim();
        }) : [],
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
      };
    });
    expect(rendered.hasCaseTable).toBeTruthy();
    expect(rendered.hasExpandButton).toBeTruthy();
    expect(rendered.headers).toEqual(['序号', 'ID', '模块', '标题', '优先级', '前置条件', '步骤', '预期结果', '备注', '执行结果']);
    expect(rendered.rowCount).toBe(2);
  });

  test('展示全部用例时不应被上一轮单条上下文误收窄', async ({ page }) => {
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
                id: '7589',
                module: '通用',
                title: '联机',
                priority: 'P1',
                preconditions: '联机模式',
                steps: '队友观察技能效果',
                expected: '队友视角展示技能效果',
                remark: '主链路',
                actual: '通过',
              },
              {
                id: '7590',
                module: '战斗',
                title: '离线',
                priority: 'P2',
                preconditions: '离线模式',
                steps: '观察技能效果',
                expected: '本地视角展示技能效果',
                remark: '支链路',
                actual: '失败',
              },
            ],
          },
        ];
      }
      window.__assistantAllCasePayloads = [];
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText) {
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
            window.__assistantAllCasePayloads.push(payload.toolResult);
            var items = Array.isArray(payload.toolResult.items) ? payload.toolResult.items : [];
            var lines = [
              '全部用例共 **' + items.length + '** 条：',
              '| 序号 | ID | 模块 | 标题 | 优先级 | 前置条件 | 步骤 | 预期结果 | 备注 | 执行结果 |',
              '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
            ];
            items.forEach(function(item) {
              lines.push('| ' + (item.index || '')
                + ' | ' + (item.id || '')
                + ' | ' + (item.module || '')
                + ' | ' + (item.title || '')
                + ' | ' + (item.priority || '')
                + ' | ' + (item.precondition || '')
                + ' | ' + (item.steps || '')
                + ' | ' + (item.expected || '')
                + ' | ' + (item.remark || '')
                + ' | ' + (item.executionResult || '')
                + ' |');
            });
            return { ok: true, content: lines.join('\n') };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把联机这条用例完整展示给我');
    await page.click('#assistantSendBtn');
    await expect.poll(() => page.evaluate(() => (window.__assistantAllCasePayloads || []).length)).toBe(1);

    await page.fill('#assistantInput', '展示全部用例');
    await page.click('#assistantSendBtn');
    await expect.poll(() => page.evaluate(() => (window.__assistantAllCasePayloads || []).length)).toBe(2);

    const payloads = await page.evaluate(() => window.__assistantAllCasePayloads || []);
    expect(payloads[0].items.length).toBe(1);
    expect(payloads[0].items[0].title).toBe('联机');
    expect(payloads[1].items.length).toBe(2);
    expect(payloads[1].items[0].title).toBe('联机');
    expect(payloads[1].items[1].title).toBe('离线');

    const rendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return { rowCount: 0, text: '' };
      }
      var last = cards[cards.length - 1];
      var table = last ? last.querySelector('table') : null;
      return {
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
        text: String(last && last.textContent ? last.textContent : ''),
      };
    });
    expect(rendered.rowCount).toBe(2);
    expect(rendered.text).toContain('联机');
    expect(rendered.text).toContain('离线');
  });

  test('展示全部用例命中 scaffold 时不应重复输出两份完整列表', async ({ page }) => {
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
              { id: '7589', module: '通用', title: '联机', priority: 'P1', preconditions: '联机模式', steps: '队友观察技能效果', expected: '队友视角展示技能效果', remark: '主链路', actual: '通过' },
              { id: '7590', module: '战斗', title: '离线', priority: 'P2', preconditions: '离线模式', steps: '观察技能效果', expected: '本地视角展示技能效果', remark: '支链路', actual: '失败' },
            ],
          },
        ];
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText) {
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
            return {
              ok: true,
              content: '{"mcp":{"tool":"assistant.render_scaffold","args":{"scaffold":"case_table","title":"全部用例展示"}}}',
            };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '展示全部用例');
    await page.click('#assistantSendBtn');

    const rendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return { tableCount: 0, rowCount: 0, text: '', titleCount: 0 };
      }
      var last = cards[cards.length - 1];
      var tables = last ? last.querySelectorAll('table.assistant-case-table') : [];
      var text = String(last && last.textContent ? last.textContent : '');
      var titleCount = text.split('全部用例展示').length - 1;
      return {
        tableCount: tables ? tables.length : 0,
        rowCount: tables && tables.length ? tables[0].querySelectorAll('tbody tr').length : 0,
        text: text,
        titleCount: titleCount,
      };
    });
    expect(rendered.tableCount).toBe(1);
    expect(rendered.rowCount).toBe(2);
    expect(rendered.titleCount).toBe(1);
    expect(rendered.text).toContain('联机');
    expect(rendered.text).toContain('离线');
  });

  test('模型可调用 markdown_table scaffold 时也应支持展开查看', async ({ page }) => {
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
        window.app.assistantApi.callModel = async function(inputText) {
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'missing_library.list_current') {
            return {
              ok: true,
              content: '{"mcp":{"tool":"assistant.render_scaffold","args":{"scaffold":"markdown_table","title":"漏测用例库列表","headers":["序号","ID","模块","类型","标题","优先级"],"rows":[["1","1","云存档","白嫖","皮肤解锁","P1"],["2","2","云存档","白嫖","撒大声地","P2"],["3","3","云存档","白嫖","阿斯顿法师打发","P3"]]}}}',
            };
          }
          return {
            ok: true,
            content: '{"mcp":{"tool":"missing_library.list_current","args":{"limit":20}}}',
          };
        };
      }
      if (window.app && window.app.apiClient) {
        window.app.apiClient.listMissingModules = async function(projectId) {
          return [
            { id: 'm1', project_id: projectId, name: '云存档', item_count: 3 },
          ];
        };
        window.app.apiClient.listMissingModuleItems = async function() {
          return [
            { id: '1', title: '皮肤解锁', priority: 'P1', type_name: '白嫖', module_name: '云存档' },
            { id: '2', title: '撒大声地', priority: 'P2', type_name: '白嫖', module_name: '云存档' },
            { id: '3', title: '阿斯顿法师打发', priority: 'P3', type_name: '白嫖', module_name: '云存档' },
          ];
        };
      }
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecActiveId = 'exec-file-1';
        window.app.state.tempExecActiveFileId = 'exec-file-1';
        window.app.state.tempExecFiles = [
          { id: 'exec-file-1', name: '执行文件A', projectId: '2001', versionId: '301', cases: [] },
        ];
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '漏测用例库都有哪些用例');
    await page.click('#assistantSendBtn');

    const rendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return { hasTable: false, hasExpandButton: false, rowCount: 0, text: '' };
      }
      var last = cards[cards.length - 1];
      var table = last ? last.querySelector('table.assistant-msg-table') : null;
      var button = last ? last.querySelector('.assistant-case-table-expand-btn') : null;
      return {
        hasTable: Boolean(table),
        hasExpandButton: Boolean(button),
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
        text: String(last && last.textContent ? last.textContent : ''),
      };
    });
    expect(rendered.hasTable).toBeTruthy();
    expect(rendered.hasExpandButton).toBeTruthy();
    expect(rendered.rowCount).toBe(3);
    expect(rendered.text).toContain('漏测用例库列表');

    const expandBtn = page.locator('#assistantMessages .assistant-case-table-expand-btn').last();
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();
    await expect(page.locator('#assistantCasePreview')).not.toHaveClass(/hidden/);

    const previewMeta = await page.evaluate(() => {
      var body = document.getElementById('assistantCasePreviewBody');
      var table = body ? body.querySelector('table.assistant-msg-table') : null;
      var firstHead = table ? table.querySelector('thead th') : null;
      var firstCell = table ? table.querySelector('tbody td') : null;
      return {
        hasTable: Boolean(table),
        headText: firstHead ? String(firstHead.textContent || '') : '',
        firstCellText: firstCell ? String(firstCell.textContent || '') : '',
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
      };
    });
    expect(previewMeta.hasTable).toBeTruthy();
    expect(previewMeta.headText).toContain('序号');
    expect(previewMeta.firstCellText).toContain('1');
    expect(previewMeta.rowCount).toBe(3);
  });

  test('模型可调用展示 scaffold 渲染标准用例表', async ({ page }) => {
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
                id: '7589',
                module: '通用',
                title: '联机',
                priority: 'P1',
                preconditions: '联机模式',
                steps: '队友观察技能效果',
                expected: '队友视角展示技能效果',
                remark: '主链路',
                actual: '通过',
              },
              {
                id: '7590',
                module: '战斗',
                title: '离线',
                priority: 'P2',
                preconditions: '离线模式',
                steps: '观察技能效果',
                expected: '本地视角展示技能效果',
                remark: '支链路',
                actual: '失败',
              },
            ],
          },
        ];
      }
      window.__assistantScaffoldToolPayload = null;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText) {
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
            window.__assistantScaffoldToolPayload = payload.toolResult;
            return {
              ok: true,
              content: '{"mcp":{"tool":"assistant.render_scaffold","args":{"scaffold":"case_table","title":"全部用例展示"}}}',
            };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    const scaffoldTools = await page.evaluate(() => {
      if (!window.app || !window.app.assistantMcpApi || typeof window.app.assistantMcpApi.listTools !== 'function') return [];
      return window.app.assistantMcpApi.listTools().map(function(item) { return item && item.name ? String(item.name) : ''; });
    });
    expect(scaffoldTools).toContain('assistant.list_scaffolds');
    expect(scaffoldTools).toContain('assistant.render_scaffold');

    await page.fill('#assistantInput', '把当前页面用例完整展示给我');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => Boolean(window.__assistantScaffoldToolPayload))).toBe(true);
    const rendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return { hasCaseTable: false, hasExpandButton: false, rowCount: 0, text: '' };
      }
      var last = cards[cards.length - 1];
      var table = last ? last.querySelector('table.assistant-case-table') : null;
      var button = last ? last.querySelector('.assistant-case-table-expand-btn') : null;
      return {
        hasCaseTable: Boolean(table),
        hasExpandButton: Boolean(button),
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
        text: String(last && last.textContent ? last.textContent : ''),
      };
    });
    expect(rendered.hasCaseTable).toBeTruthy();
    expect(rendered.hasExpandButton).toBeTruthy();
    expect(rendered.rowCount).toBe(2);
    expect(rendered.text).toContain('全部用例展示');
    await expect(page.locator('#assistantMessages')).toContainText('联机');
    await expect(page.locator('#assistantMessages')).toContainText('离线');
  });

  test('单条完整用例展示时模型返回字段内容竖表应回退为横向用例表', async ({ page }) => {
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
                id: '7589',
                module: '通用',
                title: '联机',
                priority: 'P1',
                preconditions: '联机模式',
                steps: '队友观察技能效果',
                expected: '队友视角展示技能效果',
                remark: '主链路',
                actual: '通过',
              },
            ],
          },
        ];
      }
      window.__assistantSingleDetailModelPayload = null;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText) {
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
            window.__assistantSingleDetailModelPayload = payload.toolResult;
            return {
              ok: true,
              content: [
                '| 字段 | 内容 |',
                '| --- | --- |',
                '| 编号 | 1 |',
                '| 用例 ID | 7589 |',
                '| 模块 | 通用 |',
                '| 标题 | 联机 |',
                '| 优先级 | P1 |',
                '| 前置条件 | 联机模式 |',
                '| 步骤 | 队友观察技能效果 |',
                '| 预期结果 | 队友视角展示技能效果 |',
                '| 备注 | 主链路 |',
              ].join('\n'),
            };
          }
          return { ok: true, content: '不应进入其他模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把当前页面这条用例完整展示给我');
    await page.click('#assistantSendBtn');

    await expect.poll(() => page.evaluate(() => Boolean(window.__assistantSingleDetailModelPayload))).toBe(true);
    const payload = await page.evaluate(() => window.__assistantSingleDetailModelPayload || null);
    expect(payload).toBeTruthy();
    expect(payload.args.detailLevel).toBe('full');
    expect(payload.items.length).toBe(1);
    expect(payload.items[0].id).toBe('7589');

    await expect(page.locator('#assistantMessages')).toContainText('联机');
    await expect(page.locator('#assistantMessages')).toContainText('联机模式');
    await expect(page.locator('#assistantMessages')).toContainText('队友视角展示技能效果');

    const rendered = await page.evaluate(() => {
      var cards = document.querySelectorAll('#assistantMessages .assistant-msg.ai');
      if (!cards || !cards.length) {
        return { hasTable: false, headers: [], rowCount: 0, rows: [] };
      }
      var last = cards[cards.length - 1];
      var table = last ? last.querySelector('table') : null;
      return {
        hasTable: Boolean(table),
        headers: table ? Array.prototype.map.call(table.querySelectorAll('thead th'), function(th) {
          return String(th && th.textContent ? th.textContent : '').trim();
        }) : [],
        rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
        rows: table ? Array.prototype.map.call(table.querySelectorAll('tbody tr'), function(tr) {
          return Array.prototype.map.call(tr.querySelectorAll('td'), function(td) {
            return String(td && td.textContent ? td.textContent : '').trim();
          });
        }) : [],
      };
    });
    expect(rendered.hasTable).toBeTruthy();
    expect(rendered.headers).toEqual(['序号', 'ID', '模块', '标题', '优先级', '前置条件', '步骤', '预期结果', '备注', '执行结果']);
    expect(rendered.headers).not.toEqual(['字段', '内容']);
    expect(rendered.rowCount).toBe(1);
    expect(rendered.rows[0]).toContain('7589');
    expect(rendered.rows[0]).toContain('联机');
    expect(rendered.rows[0]).toContain('联机模式');
    expect(rendered.rows[0]).toContain('队友观察技能效果');
    expect(rendered.rows[0]).toContain('队友视角展示技能效果');
    expect(rendered.rows[0]).toContain('主链路');
  });

  test('补充标题后应在同份用例整份范围内定位并展示目标条目', async ({ page }) => {
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
      }
      var items = [];
      for (var i = 0; i < 73; i += 1) {
        items.push({
          index: i + 1,
          sourceIndex: i + 1,
          id: String(3900 + i),
          module: '通用',
          title: '普通用例' + (i + 1),
          priority: 'P2',
          precondition: '前置' + (i + 1),
          steps: '步骤' + (i + 1),
          expected: '预期' + (i + 1),
          remark: '备注' + (i + 1),
          executionResult: '',
        });
      }
      items[66] = {
        index: 67,
        sourceIndex: 67,
        id: '3967',
        module: '技能',
        title: '技能说明本地化正确性',
        priority: 'P1',
        precondition: '语言切换为英文',
        steps: '进入技能说明页',
        expected: '文案与语言一致',
        remark: '多语言主链路',
        executionResult: '',
      };
      window.__assistantCaseDetailArgsList = [];
      window.__assistantCaseDetailModelPayload = null;
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          if (name === 'cases.list_current') {
            var safeArgs = JSON.parse(JSON.stringify(args || {}));
            window.__assistantCaseDetailArgsList.push(safeArgs);
            var limit = Number(safeArgs.limit);
            if (!Number.isFinite(limit) || limit <= 0) limit = 20;
            var sliced = items.slice(0, limit);
            return {
              ok: true,
              data: {
                ok: true,
                scope: 'editor',
                contextSource: 'case-library',
                projectId: '2001',
                caseFile: {
                  id: '95',
                  name: '狼人技能优化',
                  projectId: '2001',
                  versionId: '301',
                },
                searchText: '',
                total: items.length,
                totalAll: items.length,
                items: sliced,
                truncated: items.length > sliced.length,
              },
            };
          }
          return oldCallTool.apply(this, arguments);
        };
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText) {
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'cases.list_current') {
            window.__assistantCaseDetailModelPayload = payload.toolResult;
            var row = payload.toolResult.items && payload.toolResult.items[0] ? payload.toolResult.items[0] : {};
            return {
              ok: true,
              content: [
                '| ID | 标题 | 前置条件 | 步骤 | 预期结果 | 备注 |',
                '| --- | --- | --- | --- | --- | --- |',
                '| ' + (row.id || '') + ' | ' + (row.title || '') + ' | ' + (row.precondition || '') + ' | ' + (row.steps || '') + ' | ' + (row.expected || '') + ' | ' + (row.remark || '') + ' |',
              ].join('\n'),
            };
          }
          return { ok: true, content: '未命中预期模型分支' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把该用例完整展示给我');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('你可以继续直接发我：1. 用例 ID。2. 完整标题。');

    await page.fill('#assistantInput', '就是技能说明本地化正确性这条');
    await page.click('#assistantSendBtn');

    const toolArgsList = await page.evaluate(() => window.__assistantCaseDetailArgsList || []);
    expect(toolArgsList.length).toBeGreaterThanOrEqual(2);
    const lastArgs = toolArgsList[toolArgsList.length - 1];
    expect(lastArgs.detailLevel).toBe('full');
    expect(lastArgs.limit).toBe(1000);

    const payload = await page.evaluate(() => window.__assistantCaseDetailModelPayload || null);
    expect(payload).toBeTruthy();
    expect(payload.items.length).toBe(1);
    expect(payload.items[0].id).toBe('3967');
    expect(payload.items[0].title).toBe('技能说明本地化正确性');
    expect(payload.items[0].precondition).toBe('语言切换为英文');
    expect(payload.items[0].steps).toBe('进入技能说明页');
    expect(payload.items[0].expected).toBe('文案与语言一致');
    expect(payload.items[0].remark).toBe('多语言主链路');

    await expect(page.locator('#assistantMessages')).toContainText('技能说明本地化正确性');
    await expect(page.locator('#assistantMessages')).toContainText('语言切换为英文');
    await expect(page.locator('#assistantMessages')).toContainText('文案与语言一致');
    await expect(page.locator('#assistantMessages')).not.toContainText('前 20 条');
    await expect(page.locator('#assistantMessages')).not.toContainText('truncated=true');
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

  test('模型动作 settings_patch 需聊天内确认后才执行', async ({ page }) => {
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
      window.__assistantModelActionCount = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantModelActionCount += 1;
          return {
            ok: true,
            content: '{"action":"settings_patch","patch":{"smartTopNavCollapse":true}}',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '请帮我开启导航智能收起');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改设置');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('设置已更新');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantModelActionCount || 0))).toBe(1);
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.state.settings) return false;
      return Boolean(window.app.state.settings.smartTopNavCollapse === true);
    })).toBe(true);
  });

  test('MCP case.update 在执行页可修改执行结果', async ({ page }) => {
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
      var old = document.getElementById('assistantTempExecStatusSelect');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var select = document.createElement('select');
      select.id = 'assistantTempExecStatusSelect';
      select.setAttribute('data-temp-result', 'file-1');
      select.setAttribute('data-index', '0');
      ['未执行', '通过', '失败', '阻塞', '不适用'].forEach(function(label) {
        var opt = document.createElement('option');
        opt.value = label;
        opt.textContent = label;
        if (label === '未执行') opt.selected = true;
        select.appendChild(opt);
      });
      select.style.position = 'fixed';
      select.style.left = '40px';
      select.style.top = '36px';
      select.style.zIndex = '10';
      document.body.appendChild(select);
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"case.update","args":{"context":"tempexec","field":"actual","index":1,"value":"失败"}}}',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '按计划执行修改');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已修改用例：第 1 条，执行结果 = 失败');
    await expect.poll(() => page.evaluate(() => {
      var node = document.getElementById('assistantTempExecStatusSelect');
      return node && node.value ? String(node.value) : '';
    })).toBe('失败');
  });

  test('全部用例执行结果指令应按批量执行', async ({ page }) => {
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
      window.__assistantBulkUpdateCalls = [];
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"case.update","args":{"context":"tempexec","field":"actual","value":"通过"}}}',
          };
        };
      }
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var toolName = String(name || '');
          if (toolName !== 'case.update') return oldCallTool(name, args);
          var safeArgs = args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
          window.__assistantBulkUpdateCalls.push(safeArgs);
          if (!safeArgs || safeArgs.confirmed !== true) {
            return {
              ok: false,
              tool: 'case.update',
              reason: 'confirm_required',
              data: {
                actionLabel: '修改用例',
                message: '该操作会写入用例内容，请确认继续。',
              },
            };
          }
          return {
            ok: true,
            tool: 'case.update',
            data: {
              context: 'tempexec',
              scope: 'all',
              count: 3,
              field: 'actual',
              value: '通过',
            },
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把全部用例的执行结果都改成通过');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已批量修改用例：共 3 条，执行结果 = 通过');
    await expect.poll(() => page.evaluate(() => {
      var list = Array.isArray(window.__assistantBulkUpdateCalls) ? window.__assistantBulkUpdateCalls : [];
      if (list.length < 2) return false;
      var first = list[0] || {};
      var second = list[1] || {};
      return String(first.scope || '') === 'all'
        && String(first.field || '') === 'actual'
        && String(first.value || '') === '通过'
        && second.confirmed === true
        && String(second.scope || '') === 'all';
    })).toBe(true);
  });

  test('复合指令可同时批量改执行结果并清空备注', async ({ page }) => {
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
      window.__assistantCombinedUpdateCalls = [];
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"case.update","args":{"context":"tempexec"}}}',
          };
        };
      }
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var toolName = String(name || '');
          if (toolName !== 'case.update') return oldCallTool(name, args);
          var safeArgs = args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
          window.__assistantCombinedUpdateCalls.push(safeArgs);
          if (safeArgs.confirmed !== true) {
            return {
              ok: false,
              tool: 'case.update',
              reason: 'confirm_required',
              data: {
                actionLabel: '修改用例',
                message: '该操作会写入用例内容，请确认继续。',
              },
            };
          }
          if (String(safeArgs.field || '') === 'actual') {
            return {
              ok: true,
              tool: 'case.update',
              data: {
                context: 'tempexec',
                field: 'actual',
                value: String(safeArgs.value || ''),
                scope: String(safeArgs.scope || 'single'),
                count: 3,
              },
            };
          }
          if (String(safeArgs.field || '') === 'remark') {
            return {
              ok: true,
              tool: 'case.update',
              data: {
                context: 'tempexec',
                field: 'remark',
                value: '',
                cleared: true,
                scope: String(safeArgs.scope || 'single'),
                count: 3,
              },
            };
          }
          return { ok: false, tool: 'case.update', reason: 'unexpected field' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '把全部用例变回未执行状态，且清除备注');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('准备执行：修改用例');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已完成以下修改');
    await expect(page.locator('#assistantMessages')).toContainText('执行结果 = 未执行');
    await expect(page.locator('#assistantMessages')).toContainText('已清空备注');
    await expect.poll(() => page.evaluate(() => {
      var list = Array.isArray(window.__assistantCombinedUpdateCalls) ? window.__assistantCombinedUpdateCalls : [];
      if (list.length < 3) return false;
      var first = list[0] || {};
      var second = list[1] || {};
      var third = list[2] || {};
      return first.confirmed !== true
        && String(first.field || '') === 'actual'
        && String(first.scope || '') === 'all'
        && String(first.value || '') === '未执行'
        && second.confirmed === true
        && String(second.field || '') === 'actual'
        && String(second.scope || '') === 'all'
        && String(third.field || '') === 'remark'
        && third.confirmed === true
        && String(third.scope || '') === 'all'
        && String(third.value || '') === '';
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      var text = String(document.getElementById('assistantMessages') ? document.getElementById('assistantMessages').innerText || '' : '');
      var matched = text.match(/准备执行：修改用例/g);
      return matched ? matched.length : 0;
    })).toBe(1);
  });

  test('MCP ui.click_control 写操作需聊天确认并可拒绝/允许', async ({ page }) => {
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
      window.__assistantUiClickCount = 0;
      var old = document.getElementById('assistantTestSaveBtn');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'assistantTestSaveBtn';
      btn.textContent = '保存测试';
      btn.style.position = 'fixed';
      btn.style.left = '16px';
      btn.style.bottom = '16px';
      btn.addEventListener('click', function() {
        window.__assistantUiClickCount += 1;
      });
      document.body.appendChild(btn);
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"ui.click_control","args":{"domId":"assistantTestSaveBtn"}}}',
          };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '点一下保存按钮');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('准备执行：点击控件');
    await page.locator('#assistantMessages button:has-text("不允许")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已拒绝，本次操作已取消。');
    await expect(page.locator('#assistantMessages')).toContainText('已取消');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantUiClickCount || 0))).toBe(0);

    await page.fill('#assistantInput', '再点一下保存按钮');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('准备执行：点击控件');
    await page.locator('#assistantMessages button:has-text("允许操作")').last().click();
    await expect(page.locator('#assistantMessages')).toContainText('已允许，正在执行...');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantUiClickCount || 0))).toBe(1);
    await expect(page.locator('#assistantMessages')).toContainText('已执行点击：保存测试');
  });

  test('assistantMcpApi case.update 追加模式应拼接而非替换', async ({ page }) => {
    const result = await page.evaluate(async () => {
      var node = document.createElement('div');
      node.contentEditable = 'true';
      node.className = 'temp-inline-edit';
      node.setAttribute('data-case-lib-edit-field', 'title');
      node.setAttribute('data-index', '0');
      node.textContent = '技能描述';
      node.style.position = 'fixed';
      node.style.left = '32px';
      node.style.top = '32px';
      node.style.zIndex = '1';
      document.body.appendChild(node);
      var res = { ok: false, reason: 'missing api' };
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        res = await window.app.assistantMcpApi.callTool('case.update', {
          context: 'case-library',
          confirmed: true,
          index: 1,
          field: 'title',
          value: '-联机',
          operation: 'append',
        });
      }
      return {
        ok: !!(res && res.ok),
        reason: res && res.reason ? String(res.reason) : '',
        value: node.textContent || '',
        operation: res && res.data && res.data.operation ? String(res.data.operation) : '',
      };
    });

    expect(result.ok).toBeTruthy();
    expect(result.reason).toBe('');
    expect(result.operation).toBe('append');
    expect(result.value).toBe('技能描述-联机');
  });

  test('assistantMcpApi case.update 支持修改执行结果状态', async ({ page }) => {
    const result = await page.evaluate(async () => {
      var old = document.getElementById('assistantTempExecStatusDirect');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var select = document.createElement('select');
      select.id = 'assistantTempExecStatusDirect';
      select.setAttribute('data-temp-result', 'file-direct');
      select.setAttribute('data-index', '0');
      ['未执行', '通过', '失败', '阻塞', '不适用'].forEach(function(label) {
        var opt = document.createElement('option');
        opt.value = label;
        opt.textContent = label;
        if (label === '未执行') opt.selected = true;
        select.appendChild(opt);
      });
      select.style.position = 'fixed';
      select.style.left = '32px';
      select.style.top = '64px';
      select.style.zIndex = '1';
      document.body.appendChild(select);
      var res = { ok: false, reason: 'missing api' };
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        res = await window.app.assistantMcpApi.callTool('case.update', {
          context: 'tempexec',
          confirmed: true,
          index: 1,
          fileId: 'file-direct',
          field: 'actual',
          value: 'failed',
        });
      }
      return {
        ok: !!(res && res.ok),
        reason: res && res.reason ? String(res.reason) : '',
        value: select.value || '',
        operation: res && res.data && res.data.operation ? String(res.data.operation) : '',
        field: res && res.data && res.data.field ? String(res.data.field) : '',
        output: res && res.data && res.data.value ? String(res.data.value) : '',
      };
    });

    expect(result.ok).toBeTruthy();
    expect(result.reason).toBe('');
    expect(result.field).toBe('actual');
    expect(result.operation).toBe('replace');
    expect(result.value).toBe('失败');
    expect(result.output).toBe('失败');
  });

  test('assistantMcpApi case.update 在执行页支持修改备注', async ({ page }) => {
    const result = await page.evaluate(async () => {
      var calls = [];
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecFiles = [
          {
            id: 'file-remark-1',
            name: '备注执行文件',
            cases: [
              { remark: '原备注', actual: '未执行' },
            ],
          },
        ];
        window.app.state.tempExecActiveId = 'file-remark-1';
        window.app.state.tempExecActiveFileId = 'file-remark-1';
      }
      if (window.app) {
        if (!window.app.tempExecApi) window.app.tempExecApi = {};
        var oldRemarkUpdater = typeof window.app.tempExecApi.updateTempExecRemark === 'function'
          ? window.app.tempExecApi.updateTempExecRemark
          : null;
        window.app.tempExecApi.updateTempExecRemark = function(fileId, index, value) {
          calls.push({ fileId: String(fileId || ''), index: Number(index), value: String(value || '') });
          if (window.app && window.app.state && Array.isArray(window.app.state.tempExecFiles) && window.app.state.tempExecFiles[0] && Array.isArray(window.app.state.tempExecFiles[0].cases)) {
            var row = window.app.state.tempExecFiles[0].cases[index];
            if (row) row.remark = String(value || '');
          }
        };
        window.__assistantOldRemarkUpdater = oldRemarkUpdater;
      }
      var res = { ok: false, reason: 'missing api' };
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        res = await window.app.assistantMcpApi.callTool('case.update', {
          context: 'tempexec',
          confirmed: true,
          index: 1,
          fileId: 'file-remark-1',
          field: 'remark',
          value: '测试用的',
        });
      }
      var finalRemark = '';
      if (window.app && window.app.state && Array.isArray(window.app.state.tempExecFiles) && window.app.state.tempExecFiles[0] && Array.isArray(window.app.state.tempExecFiles[0].cases) && window.app.state.tempExecFiles[0].cases[0]) {
        finalRemark = String(window.app.state.tempExecFiles[0].cases[0].remark || '');
      }
      if (window.app && window.app.tempExecApi) {
        if (window.__assistantOldRemarkUpdater) {
          window.app.tempExecApi.updateTempExecRemark = window.__assistantOldRemarkUpdater;
          delete window.__assistantOldRemarkUpdater;
        } else {
          delete window.app.tempExecApi.updateTempExecRemark;
        }
      }
      return {
        ok: !!(res && res.ok),
        reason: res && res.reason ? String(res.reason) : '',
        field: res && res.data && res.data.field ? String(res.data.field) : '',
        value: res && res.data && res.data.value ? String(res.data.value) : '',
        operation: res && res.data && res.data.operation ? String(res.data.operation) : '',
        index: res && res.data ? Number(res.data.index || 0) : 0,
        fileId: res && res.data && res.data.fileId ? String(res.data.fileId) : '',
        calls: calls,
        finalRemark: finalRemark,
      };
    });

    expect(result.ok).toBeTruthy();
    expect(result.reason).toBe('');
    expect(result.field).toBe('remark');
    expect(result.value).toBe('测试用的');
    expect(result.operation).toBe('replace');
    expect(result.index).toBe(1);
    expect(result.fileId).toBe('file-remark-1');
    expect(result.calls.length).toBe(1);
    expect(result.calls[0].index).toBe(0);
    expect(result.calls[0].value).toBe('测试用的');
    expect(result.finalRemark).toBe('测试用的');
  });

  test('assistantMcpApi case.update 支持批量修改执行结果', async ({ page }) => {
    const result = await page.evaluate(async () => {
      var calls = [];
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecFiles = [
          {
            id: 'file-bulk-1',
            name: '批量执行文件',
            cases: [
              { actual: '未执行' },
              { actual: '失败' },
              { actual: '阻塞' },
            ],
          },
        ];
        window.app.state.tempExecActiveId = 'file-bulk-1';
        window.app.state.tempExecActiveFileId = 'file-bulk-1';
      }
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.updateTempExecResult === 'function') {
        var oldUpdate = window.app.tempExecApi.updateTempExecResult;
        window.app.tempExecApi.updateTempExecResult = function(fileId, index, value) {
          calls.push({ fileId: String(fileId || ''), index: Number(index), value: String(value || '') });
          if (window.app && window.app.state && Array.isArray(window.app.state.tempExecFiles)) {
            var list = window.app.state.tempExecFiles;
            for (var i = 0; i < list.length; i += 1) {
              if (!list[i] || String(list[i].id || '') !== String(fileId || '')) continue;
              if (!Array.isArray(list[i].cases) || !list[i].cases[index]) continue;
              list[i].cases[index].actual = value;
            }
          }
        };
        window.__assistantTempExecOldUpdate = oldUpdate;
      }
      var res = { ok: false, reason: 'missing api' };
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        res = await window.app.assistantMcpApi.callTool('case.update', {
          context: 'tempexec',
          confirmed: true,
          field: 'actual',
          value: 'pass',
          scope: 'all',
        });
      }
      var actuals = [];
      if (window.app && window.app.state && Array.isArray(window.app.state.tempExecFiles) && window.app.state.tempExecFiles[0] && Array.isArray(window.app.state.tempExecFiles[0].cases)) {
        actuals = window.app.state.tempExecFiles[0].cases.map(function(item) { return item && item.actual ? String(item.actual) : ''; });
      }
      if (window.__assistantTempExecOldUpdate && window.app && window.app.tempExecApi) {
        window.app.tempExecApi.updateTempExecResult = window.__assistantTempExecOldUpdate;
        delete window.__assistantTempExecOldUpdate;
      }
      return {
        ok: !!(res && res.ok),
        reason: res && res.reason ? String(res.reason) : '',
        scope: res && res.data && res.data.scope ? String(res.data.scope) : '',
        count: res && res.data ? Number(res.data.count || 0) : 0,
        output: res && res.data && res.data.value ? String(res.data.value) : '',
        calls: calls,
        actuals: actuals,
      };
    });

    expect(result.ok).toBeTruthy();
    expect(result.reason).toBe('');
    expect(result.scope).toBe('all');
    expect(result.count).toBe(3);
    expect(result.output).toBe('通过');
    expect(result.calls.length).toBe(3);
    expect(result.calls[0].index).toBe(0);
    expect(result.calls[1].index).toBe(1);
    expect(result.calls[2].index).toBe(2);
    expect(result.calls.every(function(item) { return item.value === '通过'; })).toBeTruthy();
    expect(result.actuals).toEqual(['通过', '通过', '通过']);
  });

  test('assistantMcpApi ui.fill_input 命中用例字段需确认并支持追加', async ({ page }) => {
    const result = await page.evaluate(async () => {
      var old = document.getElementById('assistantCaseFillInput');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var node = document.createElement('input');
      node.type = 'text';
      node.id = 'assistantCaseFillInput';
      node.setAttribute('data-case-lib-edit-field', 'title');
      node.setAttribute('data-index', '0');
      node.value = '技能描述';
      node.style.position = 'fixed';
      node.style.left = '32px';
      node.style.top = '70px';
      node.style.zIndex = '2';
      document.body.appendChild(node);

      var first = { ok: false, reason: 'missing api' };
      var second = { ok: false, reason: 'missing api' };
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        first = await window.app.assistantMcpApi.callTool('ui.fill_input', {
          domId: 'assistantCaseFillInput',
          value: '-联机',
          operation: 'append',
        });
        second = await window.app.assistantMcpApi.callTool('ui.fill_input', {
          domId: 'assistantCaseFillInput',
          value: '-联机',
          operation: 'append',
          confirmed: true,
        });
      }
      return {
        firstOk: !!(first && first.ok),
        firstReason: first && first.reason ? String(first.reason) : '',
        firstActionLabel: first && first.data && first.data.actionLabel ? String(first.data.actionLabel) : '',
        secondOk: !!(second && second.ok),
        secondReason: second && second.reason ? String(second.reason) : '',
        secondOperation: second && second.data && second.data.operation ? String(second.data.operation) : '',
        secondField: second && second.data && second.data.field ? String(second.data.field) : '',
        finalValue: node.value || '',
      };
    });

    expect(result.firstOk).toBeFalsy();
    expect(result.firstReason).toBe('confirm_required');
    expect(result.firstActionLabel).toBe('修改用例');
    expect(result.secondOk).toBeTruthy();
    expect(result.secondReason).toBe('');
    expect(result.secondOperation).toBe('append');
    expect(result.secondField).toBe('title');
    expect(result.finalValue).toBe('技能描述-联机');
  });

  test('MCP ui.click_control 支持 id 参数别名', async ({ page }) => {
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
      window.__assistantUiAliasClickCount = 0;
      var old = document.getElementById('assistantTestPlainBtn');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'assistantTestPlainBtn';
      btn.textContent = '查看详情';
      btn.style.position = 'fixed';
      btn.style.left = '16px';
      btn.style.bottom = '52px';
      btn.addEventListener('click', function() {
        window.__assistantUiAliasClickCount += 1;
      });
      document.body.appendChild(btn);
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"ui.click_control","args":{"id":"assistantTestPlainBtn"}}}',
          };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '点击查看详情');
    await page.click('#assistantSendBtn');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantUiAliasClickCount || 0))).toBe(1);
    await expect(page.locator('#assistantMessages')).toContainText('已执行点击：查看详情');
  });

  test('MCP ui.fill_input 仅给输入值时可自动定位搜索框', async ({ page }) => {
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
      window.__assistantSearchFillCount = 0;
      window.__assistantSearchFillValue = '';
      var old = document.getElementById('assistantTestSearchInput');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'assistantTestSearchInput';
      input.placeholder = '搜索关键字';
      input.style.position = 'fixed';
      input.style.left = '18px';
      input.style.top = '18px';
      input.style.width = '220px';
      input.addEventListener('input', function() {
        window.__assistantSearchFillCount += 1;
        window.__assistantSearchFillValue = input.value || '';
      });
      document.body.prepend(input);
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"ui.fill_input","args":{"text":"技能效果"}}}',
          };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '输入技能效果');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('已填写输入');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantSearchFillCount || 0))).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => String(window.__assistantSearchFillValue || ''))).toBe('技能效果');
  });

  test('MCP ui.fill_input 存在同名按钮时优先命中输入框', async ({ page }) => {
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
      window.__assistantSearchConflictFillCount = 0;
      window.__assistantSearchConflictValue = '';
      window.__assistantSearchConflictBtnClicks = 0;
      var oldWrap = document.getElementById('assistantTestSearchWrap');
      if (oldWrap && oldWrap.parentNode) oldWrap.parentNode.removeChild(oldWrap);

      var wrap = document.createElement('div');
      wrap.id = 'assistantTestSearchWrap';
      wrap.style.position = 'fixed';
      wrap.style.left = '18px';
      wrap.style.top = '54px';
      wrap.style.zIndex = '20';
      wrap.style.display = 'flex';
      wrap.style.gap = '8px';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'assistantTestSearchBtn';
      btn.textContent = '冲突控件X99';
      btn.addEventListener('click', function() {
        window.__assistantSearchConflictBtnClicks += 1;
      });

      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'assistantTestSearchInputConflict';
      input.placeholder = '冲突控件X99 输入';
      input.style.width = '220px';
      input.addEventListener('input', function() {
        window.__assistantSearchConflictFillCount += 1;
        window.__assistantSearchConflictValue = input.value || '';
      });

      wrap.appendChild(btn);
      wrap.appendChild(input);
      document.body.appendChild(wrap);

      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"ui.fill_input","args":{"control":"冲突控件X99","value":"技能效果"}}}',
          };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '在搜索框输入技能效果');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('已填写输入');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantSearchConflictFillCount || 0))).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => String(window.__assistantSearchConflictValue || ''))).toBe('技能效果');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantSearchConflictBtnClicks || 0))).toBe(0);
  });

  test('MCP ui.list_controls 默认排除助手面板内控件', async ({ page }) => {
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
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    var listResult = await page.evaluate(async () => {
      if (!window.app || !window.app.assistantMcpApi || typeof window.app.assistantMcpApi.callTool !== 'function') {
        return { ok: false, reason: 'missing mcp api' };
      }
      return window.app.assistantMcpApi.callTool('ui.list_controls', { max: 300 });
    });
    expect(listResult && listResult.ok).toBeTruthy();
    var controls = Array.isArray(listResult && listResult.data ? listResult.data.controls : null)
      ? listResult.data.controls
      : [];
    var hasAssistantInput = controls.some(function(item) {
      return item && String(item.domId || '') === 'assistantInput';
    });
    var hasAssistantSend = controls.some(function(item) {
      return item && String(item.domId || '') === 'assistantSendBtn';
    });
    expect(hasAssistantInput).toBeFalsy();
    expect(hasAssistantSend).toBeFalsy();
  });

  test('模型调用 ui.list_controls 后应继续推理下一步操作', async ({ page }) => {
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
      window.__assistantChainModelCalls = 0;
      var old = document.getElementById('assistantChainSearchInput');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'assistantChainSearchInput';
      input.placeholder = '搜索关键字';
      input.style.position = 'fixed';
      input.style.left = '16px';
      input.style.top = '90px';
      input.style.width = '220px';
      document.body.appendChild(input);

      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText, options) {
          window.__assistantChainModelCalls += 1;
          var prompt = options && options.prompt ? String(options.prompt) : '';
          if (prompt.indexOf('你刚刚调用工具得到如下结果') !== -1) {
            return {
              ok: true,
              content: '{"mcp":{"tool":"ui.fill_input","args":{"domId":"assistantChainSearchInput","value":"技能效果"}}}',
            };
          }
          return {
            ok: true,
            content: '{"mcp":{"tool":"ui.list_controls","args":{"max":80}}}',
          };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '输入技能效果');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('已填写输入');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前可操作控件：');
    await expect.poll(() => page.evaluate(() => {
      var el = document.getElementById('assistantChainSearchInput');
      return el && el.value ? String(el.value) : '';
    })).toBe('技能效果');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantChainModelCalls || 0))).toBeGreaterThanOrEqual(2);
  });

  test('模型可基于多轮 MCP 结果继续调用下一层工具', async ({ page }) => {
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
      window.__assistantMultiRoundModelCalls = 0;
      var old = document.getElementById('assistantMultiRoundSearchInput');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'assistantMultiRoundSearchInput';
      input.placeholder = '搜索关键字';
      input.style.position = 'fixed';
      input.style.left = '16px';
      input.style.top = '120px';
      input.style.width = '220px';
      document.body.appendChild(input);

      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-multi-1',
            name: '多轮推理执行文件',
            cases: [
              { module: '技能', title: '技能冷却', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '未执行' },
              { module: '战斗', title: '联机匹配', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '通过' },
            ],
          },
        ];
        window.app.state.tempExecActiveId = 'exec-multi-1';
        window.app.state.tempExecActiveFileId = 'exec-multi-1';
      }
      if (window.app && window.app.tempExecApi) {
        window.app.tempExecApi.setTempExecActive = function(fileId) {
          if (!window.app || !window.app.state) return;
          window.app.state.tempExecActiveId = String(fileId || '');
          window.app.state.tempExecActiveFileId = String(fileId || '');
        };
      }

      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText, options) {
          window.__assistantMultiRoundModelCalls += 1;
          var prompt = options && options.prompt ? String(options.prompt) : '';
          if (prompt.indexOf('第 2 轮MCP 工具执行结果') !== -1) {
            return {
              ok: true,
              content: '{"mcp":{"tool":"tempexec.search_cases","args":{"term":"技能"}}}',
            };
          }
          if (prompt.indexOf('第 1 轮MCP 工具执行结果') !== -1) {
            return {
              ok: true,
              content: '{"mcp":{"tool":"ui.fill_input","args":{"domId":"assistantMultiRoundSearchInput","value":"技能"}}}',
            };
          }
          return {
            ok: true,
            content: '{"mcp":{"tool":"ui.list_controls","args":{"max":100}}}',
          };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '帮我搜索技能相关条目有多少');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('命中 1 / 2 条');
    await expect.poll(() => page.evaluate(() => {
      var el = document.getElementById('assistantMultiRoundSearchInput');
      return el && el.value ? String(el.value) : '';
    })).toBe('技能');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantMultiRoundModelCalls || 0))).toBeGreaterThanOrEqual(3);
  });

  test('MCP tempexec.search_cases 支持 keyword 参数别名', async ({ page }) => {
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
      window.__assistantSearchAliasArgs = null;
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-alias-1',
            name: '执行文件别名',
            cases: [
              { module: '技能', title: '技能冷却', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '未执行' },
              { module: '战斗', title: '联机匹配', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '通过' },
            ],
          },
        ];
        window.app.state.tempExecActiveId = 'exec-alias-1';
        window.app.state.tempExecActiveFileId = 'exec-alias-1';
      }
      if (window.app && window.app.tempExecApi) {
        window.app.tempExecApi.applyTempExecSearch = function(fileId, term, raw) {
          window.__assistantSearchAliasArgs = {
            fileId: String(fileId || ''),
            term: String(term || ''),
            raw: String(raw || ''),
          };
        };
        window.app.tempExecApi.setTempExecActive = function(fileId) {
          if (window.app && window.app.state) {
            window.app.state.tempExecActiveId = String(fileId || '');
            window.app.state.tempExecActiveFileId = String(fileId || '');
          }
        };
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"tempexec.search_cases","args":{"keyword":"技能"}}}',
          };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '搜索技能');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('已搜索关键词“技能”，命中 1 / 2 条。');
    await expect.poll(() => page.evaluate(() => {
      var info = window.__assistantSearchAliasArgs || null;
      if (!info) return '';
      return String(info.raw || '');
    })).toBe('技能');
  });

  test('模型可通过 MCP tempexec.search_cases 返回命中数量', async ({ page }) => {
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
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-1',
            name: '执行文件A',
            cases: [
              { module: '技能', title: '技能冷却', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '未执行' },
              { module: '战斗', title: '联机匹配', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '通过' },
            ],
          },
        ];
        window.app.state.tempExecActiveId = 'exec-1';
        window.app.state.tempExecActiveFileId = 'exec-1';
      }
      if (window.app && window.app.tempExecApi) {
        window.app.tempExecApi.applyTempExecSearch = function() {};
        window.app.tempExecApi.setTempExecActive = function(fileId) {
          if (!window.app || !window.app.state) return;
          window.app.state.tempExecActiveId = String(fileId || '');
          window.app.state.tempExecActiveFileId = String(fileId || '');
        };
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '{"mcp":{"tool":"tempexec.search_cases","args":{"term":"技能"}}}',
          };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '查一下技能相关的用例');
    await page.click('#assistantSendBtn');
    await expect(page.locator('#assistantMessages')).toContainText('命中 1 / 2 条');
  });

  test('询问是否有下一份用例时应直接检查并返回结论', async ({ page }) => {
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
      window.__assistantNextFileModelCalls = 0;
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-next-1',
            name: '执行文件A',
            cases: [
              { module: '技能', title: '技能冷却', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '未执行' },
            ],
          },
          {
            id: 'exec-next-2',
            name: '执行文件B',
            cases: [
              { module: '战斗', title: '连击触发', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '通过' },
            ],
          },
        ];
        window.app.state.tempExecActiveId = 'exec-next-1';
        window.app.state.tempExecActiveFileId = 'exec-next-1';
      }
      if (window.app && window.app.tempExecApi) {
        window.app.tempExecApi.getTempExecOrderedFileIds = function() {
          return ['exec-next-1', 'exec-next-2'];
        };
        window.app.tempExecApi.setTempExecActive = function(fileId) {
          if (!window.app || !window.app.state) return;
          window.app.state.tempExecActiveId = String(fileId || '');
          window.app.state.tempExecActiveFileId = String(fileId || '');
        };
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantNextFileModelCalls += 1;
          return { ok: true, content: '我先帮你检查是否存在下一份执行用例。' };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '我是否有下一份用例？');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('有下一份执行用例：执行文件B');
    await expect(page.locator('#assistantMessages')).toContainText('当前第 1 份');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.state) return '';
      return String(window.app.state.tempExecActiveId || '');
    })).toBe('exec-next-1');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantNextFileModelCalls || 0))).toBe(0);
  });

  test('切换到下一份用例指令应直接执行切换', async ({ page }) => {
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
      window.__assistantNextFileSwitchModelCalls = 0;
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-switch-1',
            name: '执行文件A',
            cases: [
              { module: '技能', title: '技能冷却', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '未执行' },
            ],
          },
          {
            id: 'exec-switch-2',
            name: '执行文件B',
            cases: [
              { module: '战斗', title: '连击触发', priority: 'P1', preconditions: '', steps: '', expected: '', remark: '', actual: '通过' },
            ],
          },
        ];
        window.app.state.tempExecActiveId = 'exec-switch-1';
        window.app.state.tempExecActiveFileId = 'exec-switch-1';
      }
      if (window.app && window.app.tempExecApi) {
        window.app.tempExecApi.getTempExecOrderedFileIds = function() {
          return ['exec-switch-1', 'exec-switch-2'];
        };
        window.app.tempExecApi.setTempExecActive = function(fileId) {
          if (!window.app || !window.app.state) return;
          window.app.state.tempExecActiveId = String(fileId || '');
          window.app.state.tempExecActiveFileId = String(fileId || '');
        };
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantNextFileSwitchModelCalls += 1;
          return { ok: true, content: '我先帮你切换到下一份执行用例。' };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '切换到下一份用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('已切换到下一份用例：执行文件B');
    await expect.poll(() => page.evaluate(() => {
      if (!window.app || !window.app.state) return '';
      return String(window.app.state.tempExecActiveId || '');
    })).toBe('exec-switch-2');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantNextFileSwitchModelCalls || 0))).toBe(0);
  });

  test('助手可读取当前用例改动历史详情并按需求整理返回', async ({ page }) => {
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
      window.__assistantHistorySnapshotCalls = 0;
      window.__assistantHistoryModelCalls = 0;
      window.__assistantHistoryLastPrompt = '';
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'case-library';
      }
      if (window.app && window.app.caseLibraryApi) {
        window.app.caseLibraryApi.getCurrentHistoryDetailSnapshot = function() {
          window.__assistantHistorySnapshotCalls += 1;
          return {
            ok: true,
            hasContext: true,
            projectId: '2001',
            projectName: '狼人项目',
            versionId: '301',
            versionName: 'v1',
            fileNameClean: '登录流程',
            isDeleted: false,
            loading: false,
            filter: '',
            filterLabel: '',
            total: 4,
            filteredTotal: 4,
            currentPage: 1,
            totalPages: 1,
            pageSize: 20,
            pageStart: 1,
            pageEnd: 4,
            summary: { append: 0, added: 1, updated: 2, deleted: 1, import: 0, reimport: 0, file_deleted: 0, version_changed: 0 },
            filteredSummary: { append: 0, added: 1, updated: 2, deleted: 1, import: 0, reimport: 0, file_deleted: 0, version_changed: 0 },
            pageEvents: [
              {
                index: 1,
                id: '11',
                kind: 'added',
                kindLabel: '新增',
                changedAt: '2026-03-06T09:58:00Z',
                operator: 'demo_user',
                changedFields: ['title', 'steps', 'expected'],
                module: '登录',
                title: '账号锁定',
                old: null,
                new: { module: '登录', title: '账号锁定', priority: 'P1', precondition: '连续输错 5 次', steps: '再次登录', expected: '提示账号锁定', remark: '' },
              },
              {
                index: 2,
                id: '12',
                kind: 'updated',
                kindLabel: '改动',
                changedAt: '2026-03-06T09:55:00Z',
                operator: 'demo_user',
                changedFields: ['steps', 'expected'],
                module: '登录',
                title: '密码登录',
                old: { module: '登录', title: '密码登录', priority: 'P0', precondition: '无', steps: '输入旧步骤', expected: '旧预期', remark: '' },
                new: { module: '登录', title: '密码登录', priority: 'P0', precondition: '无', steps: '输入新步骤', expected: '新预期', remark: '' },
              },
              {
                index: 3,
                id: '13',
                kind: 'deleted',
                kindLabel: '删除',
                changedAt: '2026-03-06T09:52:00Z',
                operator: 'demo_user',
                changedFields: ['title'],
                module: '登录',
                title: '游客登录',
                old: { module: '登录', title: '游客登录', priority: 'P2', precondition: '无', steps: '点击游客登录', expected: '进入首页', remark: '' },
                new: null,
              },
            ],
            events: [
              {
                index: 1,
                id: '11',
                kind: 'added',
                kindLabel: '新增',
                changedAt: '2026-03-06T09:58:00Z',
                operator: 'demo_user',
                changedFields: ['title', 'steps', 'expected'],
                module: '登录',
                title: '账号锁定',
                old: null,
                new: { module: '登录', title: '账号锁定', priority: 'P1', precondition: '连续输错 5 次', steps: '再次登录', expected: '提示账号锁定', remark: '' },
              },
              {
                index: 2,
                id: '12',
                kind: 'updated',
                kindLabel: '改动',
                changedAt: '2026-03-06T09:55:00Z',
                operator: 'demo_user',
                changedFields: ['steps', 'expected'],
                module: '登录',
                title: '密码登录',
                old: { module: '登录', title: '密码登录', priority: 'P0', precondition: '无', steps: '输入旧步骤', expected: '旧预期', remark: '' },
                new: { module: '登录', title: '密码登录', priority: 'P0', precondition: '无', steps: '输入新步骤', expected: '新预期', remark: '' },
              },
              {
                index: 3,
                id: '13',
                kind: 'deleted',
                kindLabel: '删除',
                changedAt: '2026-03-06T09:52:00Z',
                operator: 'demo_user',
                changedFields: ['title'],
                module: '登录',
                title: '游客登录',
                old: { module: '登录', title: '游客登录', priority: 'P2', precondition: '无', steps: '点击游客登录', expected: '进入首页', remark: '' },
                new: null,
              },
            ],
            truncated: false,
          };
        };
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText, options) {
          window.__assistantHistoryModelCalls += 1;
          window.__assistantHistoryLastPrompt = options && options.prompt ? String(options.prompt) : '';
          return {
            ok: true,
            content: [
              '整理结果：',
              '1. 新增 1 条：账号锁定。',
              '2. 删除 1 条：游客登录。',
              '3. 其余改动主要集中在密码登录的步骤与预期结果。',
            ].join('\n'),
          };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '帮我整理当前用例变更内容，重点看新增和删除');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('新增 1 条：账号锁定');
    await expect(page.locator('#assistantMessages')).toContainText('删除 1 条：游客登录');
    await expect(page.locator('#assistantMessages')).not.toContainText('按你的意图返回页面数据');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantHistorySnapshotCalls || 0))).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => Number(window.__assistantHistoryModelCalls || 0))).toBe(1);
    await expect.poll(() => page.evaluate(() => String(window.__assistantHistoryLastPrompt || ''))).toContain('用例改动历史整理助手');
  });

  test('助手在执行页可读取用例变更并准确返回新增数量', async ({ page }) => {
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
      window.__assistantExecDiffSnapshotCalls = 0;
      window.__assistantExecDiffModelCalls = 0;
      window.__assistantExecHistorySnapshotCalls = 0;
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecActiveId = 'exec-diff-1';
        window.app.state.tempExecActiveFileId = 'exec-diff-1';
        window.app.state.tempExecFiles = [
          { id: 'exec-diff-1', name: '狼人技能优化', execSetId: 'exec-diff-1', cases: [] },
        ];
      }
      if (window.app && window.app.tempExecApi) {
        window.app.tempExecApi.getCurrentCaseLibraryDiffSnapshot = function() {
          window.__assistantExecDiffSnapshotCalls += 1;
          return {
            ok: true,
            hasContext: true,
            activeFileId: 'exec-diff-1',
            execSetId: 'exec-diff-1',
            caseFileId: '5001',
            fileName: '狼人技能优化',
            baseUpdatedAt: '2026-03-06T09:00:00Z',
            caseFileUpdatedAt: '2026-03-06T09:58:00Z',
            lastDiffAt: '2026-03-06T09:58:00Z',
            lastShownAt: '2026-03-06T09:59:00Z',
            everChanged: true,
            hasNewDiff: false,
            shouldAutoPopup: false,
            hasSignal: true,
            filter: '',
            filterLabel: '',
            total: 4,
            filteredTotal: 4,
            summary: { appended: 0, added: 2, updated: 1, deleted: 1 },
            filteredSummary: { appended: 0, added: 2, updated: 1, deleted: 1 },
            statusText: '暂无新的用例变更，可查看历史差异：追加 0，新增 2，改动 1，删除 1',
            pageEvents: [
              {
                index: 1,
                caseItemId: '5002',
                kind: 'added',
                kindLabel: '新增',
                changedAt: '2026-03-06T09:58:00Z',
                operator: 'demo_user',
                changedFields: ['title', 'steps', 'expected'],
                module: '狼人',
                title: '守卫首夜守护',
                old: null,
                new: { module: '狼人', title: '守卫首夜守护', priority: 'P1', precondition: '无', steps: '守护目标', expected: '守护成功', remark: '' },
              },
              {
                index: 2,
                caseItemId: '5003',
                kind: 'added',
                kindLabel: '新增',
                changedAt: '2026-03-06T09:57:00Z',
                operator: 'demo_user',
                changedFields: ['title', 'expected'],
                module: '狼人',
                title: '女巫首夜自救',
                old: null,
                new: { module: '狼人', title: '女巫首夜自救', priority: 'P1', precondition: '首夜被刀', steps: '点击自救', expected: '存活到白天', remark: '' },
              },
              {
                index: 3,
                caseItemId: '5004',
                kind: 'updated',
                kindLabel: '改动',
                changedAt: '2026-03-06T09:56:00Z',
                operator: 'demo_user',
                changedFields: ['steps'],
                module: '狼人',
                title: '预言家查验',
                old: { module: '狼人', title: '预言家查验', priority: 'P1', precondition: '无', steps: '旧步骤', expected: '旧预期', remark: '' },
                new: { module: '狼人', title: '预言家查验', priority: 'P1', precondition: '无', steps: '新步骤', expected: '旧预期', remark: '' },
              },
              {
                index: 4,
                caseItemId: '5005',
                kind: 'deleted',
                kindLabel: '删除',
                changedAt: '2026-03-06T09:55:00Z',
                operator: 'demo_user',
                changedFields: ['title'],
                module: '狼人',
                title: '猎人空枪',
                old: { module: '狼人', title: '猎人空枪', priority: 'P2', precondition: '无', steps: '不开枪', expected: '结束发言', remark: '' },
                new: null,
              },
            ],
            events: [],
            truncated: false,
          };
        };
      }
      if (window.app && window.app.caseLibraryApi) {
        window.app.caseLibraryApi.getCurrentHistoryDetailSnapshot = function() {
          window.__assistantExecHistorySnapshotCalls += 1;
          return null;
        };
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantExecDiffModelCalls += 1;
          return { ok: true, content: '模型不应参与这类执行页用例变更计数。' };
        };
      }
      var launcher = document.getElementById('assistantLauncherBtn');
      if (launcher) launcher.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '用例变更内有多少条新增变更');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('新增 2 条');
    await expect(page.locator('#assistantMessages')).toContainText('统计范围：狼人技能优化');
    await expect(page.locator('#assistantMessages')).not.toContainText('无法直接确认');
    await expect.poll(() => page.evaluate(() => Number(window.__assistantExecDiffSnapshotCalls || 0))).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => Number(window.__assistantExecHistorySnapshotCalls || 0))).toBe(0);
    await expect.poll(() => page.evaluate(() => Number(window.__assistantExecDiffModelCalls || 0))).toBe(0);
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
  test('助手可在执行页跨页面匹配漏测用例库，并由模型自主调用工具', async ({ page }) => {
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
      window.__assistantCrossPageToolCalls = [];
      window.__assistantCrossPageModelCalls = [];
      window.__assistantCrossPageToolPayload = null;
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecActiveId = 'exec-cross-1';
        window.app.state.tempExecActiveFileId = 'exec-cross-1';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-cross-1',
            name: '联机死亡复盘',
            projectId: '3001',
            cases: [
              {
                id: 'c1',
                module: '联机',
                title: '联机后玩家死亡回放',
                priority: 'P1',
                precondition: '双人联机房间',
                steps: '玩家死亡后查看回放',
                expected: '死亡信息同步',
              },
              {
                id: 'c2',
                module: '身份',
                title: '死亡后身份牌展示',
                priority: 'P1',
                precondition: '玩家已出局',
                steps: '死亡结算后查看身份牌',
                expected: '身份牌展示正确',
              },
            ],
          },
        ];
      }
      if (window.app && window.app.apiClient) {
        window.app.apiClient.listMissingModules = async function(projectId) {
          return [
            { id: 'm1', project_id: projectId, name: '联机', item_count: 1 },
            { id: 'm2', project_id: projectId, name: '身份', item_count: 2 },
          ];
        };
        window.app.apiClient.listMissingModuleItems = async function(moduleId) {
          if (String(moduleId) === 'm1') {
            return [
              {
                id: 'mi-1',
                title: '联机状态下死亡信息同步',
                priority: 'P1',
                precondition: '多人联机房间',
                steps: '玩家死亡后观察队友视角',
                expected: '死亡信息同步到全部客户端',
              },
            ];
          }
          if (String(moduleId) === 'm2') {
            return [
              {
                id: 'mi-2',
                title: '死亡后身份牌展示',
                priority: 'P1',
                precondition: '玩家出局',
                steps: '查看死亡结算',
                expected: '身份牌展示正确',
              },
              {
                id: 'mi-3',
                title: '白天投票动画',
                priority: 'P2',
                precondition: '正常白天',
                steps: '发起投票',
                expected: '动画正常',
              },
            ];
          }
          return [];
        };
      }
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var safeArgs = JSON.parse(JSON.stringify(args || {}));
          window.__assistantCrossPageToolCalls.push({ name: String(name || ''), args: safeArgs });
          return oldCallTool.apply(this, arguments);
        };
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText, options) {
          window.__assistantCrossPageModelCalls.push({
            inputText: String(inputText || ''),
            prompt: options && options.prompt ? String(options.prompt) : '',
          });
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'cross_page.match_missing_cases') {
            window.__assistantCrossPageToolPayload = payload.toolResult;
            return {
              ok: true,
              content: [
                '找到了 2 组匹配：',
                '1. 联机后玩家死亡回放 -> 联机状态下死亡信息同步。',
                '2. 死亡后身份牌展示 -> 死亡后身份牌展示。',
              ].join('\n'),
            };
          }
          return {
            ok: true,
            content: '{"mcp":{"tool":"cross_page.match_missing_cases","args":{"limit":20}}}',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '帮我看看当前的这份用例，有没有匹配的漏测用例库用例');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('找到了 2 组匹配');
    await expect(page.locator('#assistantMessages')).toContainText('联机后玩家死亡回放');
    await expect(page.locator('#assistantMessages')).toContainText('死亡后身份牌展示');
    await expect(page.locator('#assistantMessages')).not.toContainText('当前页面用例明细');

    const toolCalls = await page.evaluate(() => window.__assistantCrossPageToolCalls || []);
    expect(toolCalls.map(item => item.name)).toContain('cross_page.match_missing_cases');
    expect(toolCalls.map(item => item.name)).not.toContain('cases.list_current');

    const modelCalls = await page.evaluate(() => window.__assistantCrossPageModelCalls || []);
    expect(modelCalls.length).toBeGreaterThanOrEqual(2);
    expect(String(modelCalls[0] && modelCalls[0].prompt || '')).toContain('cross_page.match_missing_cases');

    const toolPayload = await page.evaluate(() => window.__assistantCrossPageToolPayload || null);
    expect(toolPayload && toolPayload.matchTotal).toBe(2);
    expect(toolPayload && toolPayload.matchedCaseCount).toBe(2);
    expect(toolPayload && toolPayload.missingLibraryTotal).toBe(3);
  });

  test('跨页面漏测匹配在规则未直命中时仍应把候选交给模型判断', async ({ page }) => {
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
      window.__assistantCrossPageCandidateToolCalls = [];
      window.__assistantCrossPageCandidateModelCalls = [];
      window.__assistantCrossPageCandidatePayload = null;
      if (window.app && window.app.state) {
        window.app.state.activeTab = 'tempexec';
        window.app.state.tempExecActiveId = 'exec-cross-2';
        window.app.state.tempExecActiveFileId = 'exec-cross-2';
        window.app.state.tempExecFiles = [
          {
            id: 'exec-cross-2',
            name: '主持人保护补测',
            projectId: '3002',
            cases: [
              {
                id: 'c-guard-1',
                module: '流程',
                title: '主持人离线保护',
                priority: 'P1',
                precondition: '玩家 长时间 未操作',
                steps: '等待 倒计时 结束 后 观察 是否 自动 托管',
                expected: '界面 给出 托管 提示',
              },
            ],
          },
        ];
      }
      if (window.app && window.app.apiClient) {
        window.app.apiClient.listMissingModules = async function(projectId) {
          return [
            { id: 'm-guard', project_id: projectId, name: '挂机', item_count: 2 },
          ];
        };
        window.app.apiClient.listMissingModuleItems = async function(moduleId) {
          if (String(moduleId) === 'm-guard') {
            return [
              {
                id: 'mi-guard-1',
                title: '超时保护补测',
                priority: 'P1',
                precondition: '长时间 未操作',
                steps: '等待 倒计时 结束',
                expected: '系统 继续 推进',
              },
              {
                id: 'mi-guard-2',
                title: '发言动画补测',
                priority: 'P2',
                precondition: '正常 白天',
                steps: '点击 麦克风',
                expected: '发言 动画 正常',
              },
            ];
          }
          return [];
        };
      }
      if (window.app && window.app.assistantMcpApi && typeof window.app.assistantMcpApi.callTool === 'function') {
        var oldCallTool = window.app.assistantMcpApi.callTool;
        window.app.assistantMcpApi.callTool = async function(name, args) {
          var safeArgs = JSON.parse(JSON.stringify(args || {}));
          window.__assistantCrossPageCandidateToolCalls.push({ name: String(name || ''), args: safeArgs });
          return oldCallTool.apply(this, arguments);
        };
      }
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function(inputText, options) {
          window.__assistantCrossPageCandidateModelCalls.push({
            inputText: String(inputText || ''),
            prompt: options && options.prompt ? String(options.prompt) : '',
          });
          var payload = null;
          try {
            payload = JSON.parse(String(inputText || ''));
          } catch (err) {
            payload = null;
          }
          if (payload && payload.toolResult && payload.toolResult.tool === 'cross_page.match_missing_cases') {
            window.__assistantCrossPageCandidatePayload = payload.toolResult;
            return {
              ok: true,
              content: [
                '规则直命中 0 组，但我认为有 1 组高相关候选需要补看：',
                '1. 主持人离线保护 -> 超时保护补测。',
              ].join('\n'),
            };
          }
          return {
            ok: true,
            content: '{"mcp":{"tool":"cross_page.match_missing_cases","args":{"limit":20}}}',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '帮我看看当前这份用例有没有需要补看的漏测用例库内容');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('规则直命中 0 组');
    await expect(page.locator('#assistantMessages')).toContainText('主持人离线保护');
    await expect(page.locator('#assistantMessages')).toContainText('超时保护补测');
    await expect(page.locator('#assistantMessages')).not.toContainText('暂未找到明确匹配项');

    const toolCalls = await page.evaluate(() => window.__assistantCrossPageCandidateToolCalls || []);
    expect(toolCalls.map(item => item.name)).toContain('cross_page.match_missing_cases');
    expect(toolCalls.map(item => item.name)).not.toContain('cases.list_current');

    const modelCalls = await page.evaluate(() => window.__assistantCrossPageCandidateModelCalls || []);
    expect(modelCalls.length).toBeGreaterThanOrEqual(2);
    expect(modelCalls.some(item => String(item && item.prompt || '').indexOf('不要把 matchTotal=0 直接回答成“没有相关用例”') !== -1)).toBe(true);

    const toolPayload = await page.evaluate(() => window.__assistantCrossPageCandidatePayload || null);
    expect(toolPayload && toolPayload.matchTotal).toBe(0);
    expect(toolPayload && toolPayload.candidateTotal).toBeGreaterThan(0);
    expect(toolPayload && Array.isArray(toolPayload.candidates)).toBe(true);
    expect(String(toolPayload && toolPayload.candidates && toolPayload.candidates[0] && toolPayload.candidates[0].currentCase && toolPayload.candidates[0].currentCase.steps || '')).toContain('等待');
    expect(String(toolPayload && toolPayload.candidates && toolPayload.candidates[0] && toolPayload.candidates[0].missingItem && toolPayload.candidates[0].missingItem.precondition || '')).toContain('长时间');
  });

  test('助手支持图片附件与文本一起发送给多模态模型', async ({ page }) => {
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
      if (window.app && window.app.state && Array.isArray(window.app.state.models)) {
        window.app.state.models.forEach(function(model) {
          if (String(model && model.id || '') === 'assistant-model-1') {
            model.capabilities = ['vision', 'image'];
          }
        });
      }
      window.__assistantMultimodalCalls = [];
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.getSelectedModelInfo = function() {
          return {
            configured: true,
            usable: true,
            modelId: 'assistant-model-1',
            modelName: '助手测试模型',
            supportsImage: true,
            capabilities: ['vision', 'image'],
          };
        };
        window.app.assistantApi.callModel = async function(userText, options) {
          var blocks = options && Array.isArray(options.contentBlocks) ? options.contentBlocks : [];
          window.__assistantMultimodalCalls.push({
            userText: String(userText || ''),
            blocks: JSON.parse(JSON.stringify(blocks)),
          });
          return { ok: true, content: '已结合 2 张图片和文本完成分析。' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.setInputFiles('#assistantImageInput', [
      makeTinyPngFile('scene-a.png'),
      makeTinyPngFile('scene-b.png'),
    ]);
    await expect(page.locator('#assistantAttachmentList .assistant-attachment-row')).toHaveCount(2);
    await expect(page.locator('#assistantAttachmentList')).toContainText('scene-a.png');
    await expect(page.locator('#assistantAttachmentList')).toContainText('scene-b.png');

    await page.fill('#assistantInput', '请结合两张图片告诉我差异');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('已结合 2 张图片和文本完成分析');
    await expect(page.locator('#assistantMessages .assistant-msg.user .assistant-msg-image')).toHaveCount(2);

    const call = await page.evaluate(() => {
      var list = window.__assistantMultimodalCalls || [];
      return list.length ? list[0] : null;
    });
    expect(call).not.toBeNull();
    expect(String(call.userText || '')).toContain('请结合两张图片告诉我差异');
    expect(Array.isArray(call.blocks)).toBe(true);
    expect(call.blocks.filter(item => item && item.type === 'image')).toHaveLength(2);
    expect(call.blocks.some(item => item && item.type === 'text' && String(item.text || '').indexOf('请结合两张图片告诉我差异') !== -1)).toBe(true);
    expect(String(call.blocks[1] && call.blocks[1].dataUrl || '')).toContain('data:image/');
  });

  test('助手在当前模型不支持视觉时阻止图片发送', async ({ page }) => {
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
      window.__assistantBlockedImageCalls = 0;
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          window.__assistantBlockedImageCalls += 1;
          return { ok: true, content: '不应被调用' };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    });
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.setInputFiles('#assistantImageInput', [makeTinyPngFile('blocked.png')]);
    await expect(page.locator('#assistantAttachmentList .assistant-attachment-row')).toHaveCount(1);
    await page.fill('#assistantInput', '请识别这张图');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantStatus')).toContainText('不支持图片输入');
    await expect(page.locator('#assistantAttachmentList .assistant-attachment-row')).toHaveCount(1);
    await expect(page.locator('#assistantMessages .assistant-msg.user')).toHaveCount(0);
    const blockedCalls = await page.evaluate(() => window.__assistantBlockedImageCalls || 0);
    expect(blockedCalls).toBe(0);
  });

  test('助手回复中的 Markdown 图片会直接渲染展示', async ({ page }) => {
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

    await page.evaluate((tinyBase64) => {
      if (window.app && window.app.assistantApi) {
        window.app.assistantApi.callModel = async function() {
          return {
            ok: true,
            content: '这是生成结果：\n\n![结果图](data:image/png;base64,' + tinyBase64 + ')',
          };
        };
      }
      var btn = document.getElementById('assistantLauncherBtn');
      if (btn) btn.click();
    }, TINY_PNG_BASE64);
    await expect(page.locator('#assistantPanel')).not.toHaveClass(/hidden/);

    await page.fill('#assistantInput', '给我一张示意图');
    await page.click('#assistantSendBtn');

    await expect(page.locator('#assistantMessages')).toContainText('这是生成结果');
    await expect(page.locator('#assistantMessages .assistant-markdown-image').last()).toBeVisible();
    await expect(page.locator('#assistantMessages .assistant-markdown-image').last()).toHaveAttribute('src', /data:image\/png;base64/);
  });

});
