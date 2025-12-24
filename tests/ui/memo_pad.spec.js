const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

async function waitForSettingsReady(page) {
  await page.waitForFunction(() => window.app && window.app.settingsReady === true, {}, { timeout: 20000 });
}

async function setupRoutes(page, token, options) {
  const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
  const project = { id: 1, name: '项目A', description: '' };
  const versions = [{ id: 11, name: 'v1' }];
  const store = (options && options.settingsStore) ? options.settingsStore : [];

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
    if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
    if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
    if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
    if (pathName === '/api/settings' && method === 'GET') return respond(200, store);
    if (pathName === '/api/settings' && method === 'PUT') {
      var payload = {};
      try { payload = route.request().postDataJSON() || {}; } catch (_) { payload = {}; }
      var scope = payload.scope || 'user';
      store.length = 0;
      (payload.items || []).forEach((item) => {
        store.push(Object.assign({}, item, { scope: scope, owner_id: user.id }));
      });
      return respond(200, store);
    }
    if (pathName === '/api/models' && method === 'GET') return respond(200, []);
    if (pathName === '/api/features' && method === 'GET') return respond(200, []);
    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  });
}

async function confirmDrawer(page, message) {
  const drawer = page.locator('#appConfirmDrawer');
  await expect(drawer).toHaveClass(/open/);
  if (message) {
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText(message);
  }
  await page.click('#appConfirmDrawerConfirmBtn');
  await expect(drawer).not.toHaveClass(/open/);
}

test.describe('个人备忘区', () => {
  test('页签新增/命名与数量上限提示', async ({ page }) => {
    await setupRoutes(page, 'token-memo-tabs');
    await gotoIndex(page);
    await waitForSettingsReady(page);

    await expect(page.locator('#memoPadPanel')).toBeVisible();
    await expect(page.locator('.memo-tab')).toHaveCount(1);

    await page.click('#memoTabAddBtn');
    await page.click('#memoTabAddBtn');
    await expect(page.locator('.memo-tab')).toHaveCount(3);

    await page.click('#memoTabAddBtn');
    await expect(page.locator('.temp-center-toast')).toContainText('页签已满，请先删除已有页签');

    const firstTab = page.locator('.memo-tab').first();
    await firstTab.click();
    await firstTab.click();
    const tabInput = page.locator('.memo-tab.editing .memo-tab-input');
    await tabInput.click();
    await expect(page.locator('.memo-tab.editing')).toBeVisible();
    await tabInput.fill('日常备忘');
    await tabInput.click();
    await expect(page.locator('.memo-tab.editing')).toBeVisible();
    await page.click('#memoPadPanel');
    await expect(page.locator('.memo-tab').first().locator('.memo-tab-label')).toContainText('日常备忘');
  });

  test('条目新增/已办切换/删除', async ({ page }) => {
    await setupRoutes(page, 'token-memo-items');
    await gotoIndex(page);
    await waitForSettingsReady(page);

    await page.click('.memo-item-add');
    await expect(page.locator('.memo-item')).toHaveCount(1);

    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.state.settings) return;
      var memo = window.app.state.settings.memoPad;
      if (!memo || !memo.tabs || !memo.tabs[0]) return;
      memo.tabs[0].items = [
        { id: 'item-a', text: '待办事项A', done: false },
        { id: 'item-b', text: '待办事项B', done: false },
      ];
      if (window.app.memoPadApi && typeof window.app.memoPadApi.renderMemoPad === 'function') {
        window.app.memoPadApi.renderMemoPad();
      }
    });
    await expect(page.locator('.memo-item')).toHaveCount(2);
    await expect(page.locator('#memoTabProgress')).toHaveText('0/2');

    await page.evaluate(() => {
      var btn = document.querySelector('[data-memo-item-toggle="item-a"]');
      if (btn) btn.click();
    });
    await expect(page.locator('#memoTabProgress')).toHaveText('1/2');
    const order = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.memo-item-text')).map(function(el) {
        return (el.textContent || '').trim();
      });
    });
    expect(order[order.length - 1]).toBe('待办事项A');

    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.state.settings) return;
      var memo = window.app.state.settings.memoPad;
      if (!memo || !memo.tabs || !memo.tabs[0]) return;
      var items = Array.isArray(memo.tabs[0].items) ? memo.tabs[0].items.slice() : [];
      items.push({ id: 'item-c', text: '待办事项C', done: false });
      memo.tabs[0].items = items;
      if (window.app.memoPadApi && typeof window.app.memoPadApi.renderMemoPad === 'function') {
        window.app.memoPadApi.renderMemoPad();
      }
    });
    await expect(page.locator('#memoTabProgress')).toHaveText('1/3');
    const orderAfter = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.memo-item-text')).map(function(el) {
        return (el.textContent || '').trim();
      });
    });
    expect(orderAfter[orderAfter.length - 1]).toBe('待办事项A');

    await page.evaluate(() => {
      var btn = document.querySelector('[data-memo-item-remove="item-b"]');
      if (btn) btn.click();
    });
    await confirmDrawer(page, '确认删除该备忘条目');
    await expect(page.locator('.memo-item-text', { hasText: '待办事项A' })).toBeVisible();
    await expect(page.locator('.memo-item-text', { hasText: '待办事项B' })).toHaveCount(0);
  });

  test('删除页签时提示待办事项', async ({ page }) => {
    await setupRoutes(page, 'token-memo-tab-delete');
    await gotoIndex(page);
    await waitForSettingsReady(page);

    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.state.settings) return;
      var memo = window.app.state.settings.memoPad;
      if (!memo || !memo.tabs || !memo.tabs[0]) return;
      memo.tabs[0].items = [{ id: 'memo-item-test', text: '未完成事项', done: false }];
      memo.activeTabId = memo.tabs[0].id;
      if (window.app.memoPadApi && typeof window.app.memoPadApi.renderMemoPad === 'function') {
        window.app.memoPadApi.renderMemoPad();
      }
    });
    await expect(page.locator('.memo-item-text')).toContainText('未完成事项');

    await page.click('.memo-tab-close');
    const drawerMessage = page.locator('#appConfirmDrawerMessage');
    await expect(drawerMessage).toContainText('待办事项');
    await expect(drawerMessage).toContainText('未完成事项');
    await page.click('#appConfirmDrawerCancelBtn');
    await expect(page.locator('.memo-tab')).toHaveCount(1);
  });

  test('备忘区收起持久化并让进度区扩展', async ({ page }) => {
    const settingsStore = [];
    await setupRoutes(page, 'token-memo-collapse', { settingsStore });
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoIndex(page);
    await waitForSettingsReady(page);

    const sizes = await page.evaluate(() => {
      const progress = document.getElementById('caseGenProgressPanel');
      const memo = document.getElementById('memoPadPanel');
      if (!progress || !memo) return null;
      const progressStyle = window.getComputedStyle(progress);
      const memoStyle = window.getComputedStyle(memo);
      return {
        progressGrow: progressStyle.flexGrow,
        memoGrow: memoStyle.flexGrow,
      };
    });
    expect(sizes).not.toBeNull();
    expect(sizes.progressGrow).toBe('1');
    expect(sizes.memoGrow).toBe('1');

    const putSettings = page.waitForResponse((resp) => {
      return resp.url().includes('/api/settings') && resp.request().method() === 'PUT';
    });
    await page.click('#memoPadToggle');
    await putSettings;
    await expect(page.locator('#memoPadPanel')).toHaveClass(/is-collapsed/);
    await page.waitForFunction(() => {
      return window.app && window.app.state && window.app.state.settings
        && window.app.state.settings.memoPad && window.app.state.settings.memoPad.collapsed === true;
    });

    const flexAfter = await page.evaluate(() => {
      const progress = document.getElementById('caseGenProgressPanel');
      const memo = document.getElementById('memoPadPanel');
      if (!progress || !memo) return null;
      const progressStyle = window.getComputedStyle(progress);
      const memoStyle = window.getComputedStyle(memo);
      return {
        progressGrow: progressStyle.flexGrow,
        memoGrow: memoStyle.flexGrow,
      };
    });
    expect(flexAfter).not.toBeNull();
    expect(flexAfter.progressGrow).toBe('1');
    expect(flexAfter.memoGrow).toBe('0');

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await expect(page.locator('#memoPadPanel')).toHaveClass(/is-collapsed/);
  });

  test('进度区数据多时占据备忘区空余空间', async ({ page }) => {
    await setupRoutes(page, 'token-memo-layout');
    await page.setViewportSize({ width: 1280, height: 1000 });
    await gotoIndex(page);
    await waitForSettingsReady(page);

    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      var modules = [];
      for (var i = 0; i < 30; i += 1) {
        modules.push({ id: 'mod-' + i, title: '模块' + (i + 1) });
      }
      window.app.state.caseGenModules = modules;
      if (window.app.state.settings && window.app.state.settings.memoPad && window.app.state.settings.memoPad.tabs) {
        window.app.state.settings.memoPad.tabs[0].items = [];
      }
      if (window.app.memoPadApi && typeof window.app.memoPadApi.renderMemoPad === 'function') {
        window.app.memoPadApi.renderMemoPad();
      }
      if (typeof window.app.renderCaseGenProgressBoard === 'function') {
        window.app.renderCaseGenProgressBoard();
      } else {
        var list = document.getElementById('caseGenProgressList');
        if (list) {
          var html = '';
          for (var j = 0; j < 30; j += 1) {
            html += '<div class="casegen-progress-item state-pending">' +
              '<div class="info"><span class="status-dot"></span>' +
              '<div class="titles"><div class="name">模块' + (j + 1) + '</div></div></div>' +
              '<span class="badge">未生成</span></div>';
          }
          list.innerHTML = html;
        }
        var panel = document.getElementById('caseGenProgressPanel');
        if (panel) panel.classList.remove('hidden');
      }
      if (window.app.sidebarPanels && typeof window.app.sidebarPanels.syncLayoutNow === 'function') {
        window.app.sidebarPanels.syncLayoutNow();
      } else if (window.app.sidebarPanels && typeof window.app.sidebarPanels.requestLayoutSync === 'function') {
        window.app.sidebarPanels.requestLayoutSync();
      }
    });

    await page.waitForFunction(() => {
      var memo = document.getElementById('memoPadPanel');
      var progress = document.getElementById('caseGenProgressPanel');
      if (!memo || !progress) return false;
      var memoGrow = Number(window.getComputedStyle(memo).flexGrow || 0);
      var progressGrow = Number(window.getComputedStyle(progress).flexGrow || 0);
      return memoGrow === 0 && progressGrow >= 1;
    });

    const sizes = await page.evaluate(() => {
      var memo = document.getElementById('memoPadPanel');
      var progress = document.getElementById('caseGenProgressPanel');
      if (!memo || !progress) return null;
      return {
        memoHeight: memo.getBoundingClientRect().height,
        progressHeight: progress.getBoundingClientRect().height,
      };
    });
    expect(sizes).not.toBeNull();
    expect(sizes.progressHeight).toBeGreaterThan(sizes.memoHeight);
  });
});
