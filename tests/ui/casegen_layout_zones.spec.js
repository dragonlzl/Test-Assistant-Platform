const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html?_=' + Date.now().toString(36));
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

test.describe('用例生成-页面分区', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('用例生成页拆分为 设置/模块 页签，并保留设置区与入库区', async ({ page }) => {
    const token = 'token-casegen-layout';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('casesgen');
    });

    const tabs = page.locator('[data-section-id="casesgen"] [data-casegen-view-tab]');
    await expect(tabs).toHaveCount(2);
    await expect(page.locator('#caseGenSettingsTabBtn')).toHaveClass(/is-active/);
    await expect(page.locator('#casegenSettingsPanel')).toHaveClass(/is-active/);
    await expect(page.locator('#casegenModulesPanel')).not.toHaveClass(/is-active/);

    const order = await page.evaluate(() => {
      const els = Array.prototype.slice.call(document.querySelectorAll('#casegenSettingsPanel .casegen-settings-grid [data-casegen-zone]'));
      return els.map((el) => (el && el.dataset ? el.dataset.casegenZone : ''));
    });
    expect(order).toEqual(['general', 'store', 'other']);

    const settingsGrid = await page.evaluate(() => {
      const container = document.querySelector('#casegenSettingsPanel .casegen-settings-grid');
      if (!container) return null;
      const style = window.getComputedStyle(container);
      return {
        display: style.display,
        flexWrap: style.flexWrap,
      };
    });
    expect(settingsGrid).not.toBeNull();
    expect(settingsGrid.display).toBe('flex');
    expect(settingsGrid.flexWrap).toBe('wrap');

    await expect(page.locator('#casegenSettingsPanel #caseGenCustomRequirement')).toHaveCount(0);
    await expect(page.locator('#casegenSettingsPanel #caseGenNeedBoundary')).toHaveCount(0);
    await expect(page.locator('#caseGenActionDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('[data-casegen-zone="general"] #caseGenAllGenerateBtn')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="general"] #caseGenAllTopupBtn')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="general"] #caseGenSuggestionGenerateBtn')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="other"] #exportCaseGen')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="other"] #exportCaseGenXmind')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="other"] #toSplitFromCaseGen')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenAllViewBtn')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreModeNewBtn')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreModeAppendBtn')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreModeNewPanel')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreActionSelect')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreNewBtn')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreModeAppendPanel')).toBeHidden();

    await page.click('#caseGenStoreModeAppendBtn');
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreModeAppendPanel')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreAppendBtn')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreModeNewPanel')).toBeHidden();

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('clean');
      const split = document.getElementById('splitResult');
      if (split) {
        split.removeAttribute('readonly');
        split.value = JSON.stringify([
          { module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] },
        ]);
        split.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('casesgen');
    });
    await page.waitForFunction(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      return state && Array.isArray(state.caseGenModules) && state.caseGenModules.length === 1;
    }, {}, { timeout: 8000 });
    await expect(page.locator('#caseGenAllGenerateBtn')).toBeEnabled();

    await page.click('#caseGenAllGenerateBtn');
    await expect(page.locator('#caseGenActionDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenActionDrawerTitle')).toContainText('全模块直接生成确认');
    await expect(page.locator('label[for="caseGenCustomRequirement"]')).toContainText('额外要求填写');
    await expect(page.locator('#caseGenCustomRequirement')).toHaveValue('');
    await expect(page.locator('#caseGenNeedBoundary')).toBeVisible();
    await expect(page.locator('#caseGenNeedBoundary')).not.toBeChecked();
    await expect(page.locator('#caseGenNeedSpecial')).toBeVisible();
    await expect(page.locator('#caseGenNeedSpecial')).not.toBeChecked();
    await page.click('#caseGenActionDrawerCancelBtn');
    await expect(page.locator('#caseGenActionDrawer')).not.toHaveClass(/open/);

    await page.click('#caseGenModulesTabBtn');
    await expect(page.locator('#caseGenModulesTabBtn')).toHaveClass(/is-active/);
    await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
    await expect(page.locator('#casegenSettingsPanel')).not.toHaveClass(/is-active/);
    await expect(page.locator('#casegenModulesPanel #casesGenerationContainer')).toBeVisible();
    await expect(page.locator('#casesGenerationContainer [data-topup]')).toHaveCount(0);

    await page.click('#casesGenerationContainer [data-generate]');
    await expect(page.locator('#caseGenModuleGenerateDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenModuleGenerateGlobalTabBtn')).toBeVisible();
    await expect(page.locator('#caseGenModuleGenerateLocalTabBtn')).toBeVisible();
    await expect(page.locator('#caseGenModuleGenerateTopupTabBtn')).toBeVisible();
    await page.click('#caseGenModuleGenerateTopupTabBtn');
    await expect(page.locator('#caseGenModuleGenerateTopupPanel')).toHaveClass(/is-active/);
    await expect(page.locator('#caseGenModuleGenerateTopupConfirmBtn')).toBeDisabled();
    await page.click('#closeCaseGenModuleGenerateDrawerBtn');
    await expect(page.locator('#caseGenModuleGenerateDrawer')).not.toHaveClass(/open/);
  });

  test('生成模块页默认按每行两个模块布局', async ({ page }) => {
    const token = 'token-casegen-module-grid';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('clean');
      const split = document.getElementById('splitResult');
      if (split) {
        split.removeAttribute('readonly');
        split.value = JSON.stringify([
          { module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] },
          { module: '支付', key_scenarios: [], test_points: [], coupled_modules: [] },
          { module: '背包', key_scenarios: [], test_points: [], coupled_modules: [] },
          { module: '活动', key_scenarios: [], test_points: [], coupled_modules: [] },
        ]);
        split.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('casesgen');
    });

    await page.click('#caseGenModulesTabBtn');
    await page.waitForSelector('#casesGenerationContainer [data-module-id]');

    const layout = await page.evaluate(() => {
      const container = document.getElementById('casesGenerationContainer');
      const cards = Array.prototype.slice.call(container ? container.querySelectorAll('[data-module-id]') : []);
      if (!container || cards.length < 2) return null;
      return {
        display: window.getComputedStyle(container).display,
        columnCount: window.getComputedStyle(container).gridTemplateColumns.split(' ').filter(Boolean).length,
        firstTop: Math.round(cards[0].getBoundingClientRect().top),
        secondTop: Math.round(cards[1].getBoundingClientRect().top),
      };
    });

    expect(layout).not.toBeNull();
    expect(layout.display).toBe('grid');
    expect(layout.columnCount).toBeGreaterThanOrEqual(2);
    expect(Math.abs(layout.firstTop - layout.secondTop)).toBeLessThanOrEqual(8);
  });
});
