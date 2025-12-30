const { test, expect } = require('@playwright/test');

test.describe('主题设置', () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const user = { id: 913, username: 'theme_user', role: 'admin', level: 'leader' };

  function createApiHandler(serverState, options) {
    const opts = options || {};
    let settingSeq = 10;
    return async function(route) {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me' && method === 'GET') return respond(200, user);
      if (path === '/api/settings' && method === 'GET') return respond(200, serverState.settings);
      if (path === '/api/settings' && method === 'PUT') {
        const body = route.request().postDataJSON() || {};
        const scope = body.scope || 'user';
        const items = Array.isArray(body.items) ? body.items : [];
        const now = new Date().toISOString();
        const saved = [];
        items.forEach((item) => {
          if (!item || !item.key) return;
          const ownerId = scope === 'global' ? null : user.id;
          let existing = serverState.settings.find(
            (row) => row.key === item.key && row.scope === scope && row.owner_id === ownerId
          );
          if (existing) {
            existing.value_json = item.value_json;
            existing.updated_at = now;
            saved.push(existing);
            return;
          }
          const next = {
            id: settingSeq += 1,
            scope,
            owner_id: ownerId,
            key: item.key,
            value_json: item.value_json,
            updated_at: now,
          };
          serverState.settings.push(next);
          saved.push(next);
        });
        return respond(200, saved);
      }
      if (path === '/api/projects' && method === 'GET') return respond(200, opts.projects || []);
      if (path.indexOf('/api/projects/') === 0 && path.indexOf('/versions') > -1 && method === 'GET') {
        return respond(200, []);
      }
      if (path === '/api/case-files' && method === 'GET') return respond(200, []);
      if (path === '/api/models' && method === 'GET') return respond(200, []);
      if (path === '/api/features' && method === 'GET') return respond(200, []);
      if (path === '/api/ops' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview' && method === 'GET') return respond(200, {});
      if (path === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview/layout' && method === 'GET') return respond(200, {});
      return respond(200, method === 'GET' ? [] : {});
    };
  }

  async function waitForAppReady(page) {
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && window.app.state && window.app.apiClient, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
  }

  test('刷新时优先应用本地主题避免闪白', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('usecase-settings-v1', JSON.stringify({ theme: 'dark' }));
        window.localStorage.setItem('tap-e2e-skip-auth', '1');
        window.localStorage.removeItem('tap-auth-token');
      } catch (err) {
        // ignore
      }
    });
    await page.route('**/*', (route) => {
      const target = route.request().url();
      if (target.startsWith('http://localhost') || target.startsWith('http://127.0.0.1') || target.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });

    await page.goto(base + '/index.html');
    await page.waitForLoadState('domcontentloaded');

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
    expect(theme).toBe('dark');
  });

  test('主题选择需保存后生效', async ({ page }) => {
    const serverState = { settings: [] };
    const apiHandler = createApiHandler(serverState);

    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('tap-auth-token', 'theme-token');
        window.localStorage.removeItem('usecase-settings-v1');
      } catch (err) {
        // ignore
      }
    });
    await page.route('**/*', (route) => {
      const target = route.request().url();
      if (target.startsWith('http://localhost') || target.startsWith('http://127.0.0.1') || target.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.route('**/api/**', apiHandler);

    await page.goto(base + '/index.html');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });

    await expect(page.locator('#themeSelect')).toHaveValue('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.selectOption('#themeSelect', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.click('#saveThemeSetting');
    await expect(page.locator('#themeSettingStatus')).toContainText('主题已保存');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await expect.poll(() => {
      const record = serverState.settings.find((item) => item.key === 'theme');
      return record ? record.value_json : null;
    }).toBe('dark');

    const excelSelect = await page.$('#caseLibraryImportExcelTemplateType');
    if (excelSelect) {
      const excelSelectStyle = await excelSelect.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const appearance = style.getPropertyValue('appearance') || style.appearance || '';
        return { bg: style.backgroundImage, appearance: appearance };
      });
      expect(excelSelectStyle.bg).toContain('data:image/svg+xml');
      expect(excelSelectStyle.appearance).toBe('none');
    }
  });

  test('白色主题下设置控件背景与项目字体权重正常', async ({ page }) => {
    const serverState = { settings: [] };
    const apiHandler = createApiHandler(serverState, {
      projects: [
        { id: 11, name: '项目甲', description: '' },
        { id: 12, name: '项目乙', description: '' },
      ],
    });

    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('tap-auth-token', 'theme-style-token');
        window.localStorage.removeItem('usecase-settings-v1');
      } catch (err) {
        // ignore
      }
    });
    await page.route('**/*', (route) => {
      const target = route.request().url();
      if (target.startsWith('http://localhost') || target.startsWith('http://127.0.0.1') || target.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.route('**/api/**', apiHandler);

    await page.goto(base + '/index.html');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });

    await page.waitForSelector('#tempExecPageSizeInput');
    await page.waitForSelector('#themeSelect');
    await page.waitForSelector('#pageGuideSelectAll');
    await page.waitForSelector('.project-sort-card .name');

    const styles = await page.evaluate(() => {
      function pickStyle(selector) {
        var el = document.querySelector(selector);
        if (!el) return null;
        var style = getComputedStyle(el);
        return {
          background: style.backgroundColor,
          fontWeight: style.fontWeight,
        };
      }

      return {
        pageSize: pickStyle('#tempExecPageSizeInput'),
        themeSelect: pickStyle('#themeSelect'),
        checkbox: pickStyle('#pageGuideSelectAll'),
        projectName: pickStyle('.project-sort-card .name'),
      };
    });

    expect(styles.pageSize && styles.pageSize.background).toBe('rgb(255, 255, 255)');
    expect(styles.themeSelect && styles.themeSelect.background).toBe('rgb(255, 255, 255)');
    expect(styles.checkbox && styles.checkbox.background).toBe('rgb(255, 255, 255)');
    expect(styles.projectName && Number(styles.projectName.fontWeight)).toBeLessThanOrEqual(600);
  });
});
