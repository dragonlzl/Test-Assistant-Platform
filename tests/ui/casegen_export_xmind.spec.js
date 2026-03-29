const { test, expect } = require('@playwright/test');

async function prepareCaseGen(page, requirementLabel) {
  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');
  await page.evaluate((reqLabel) => {
    window.prompt = () => reqLabel;
    const split = document.getElementById('splitResult');
    if (split) {
      split.removeAttribute('readonly');
      split.value = JSON.stringify([{ module: '登录模块', key_scenarios: [], test_points: [], coupled_modules: [] }]);
      split.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, requirementLabel);
  await page.click('#goUsecaseGen');
  await page.click('#caseGenModulesTabBtn');
  const moduleId = await page.evaluate(() => {
    const state = window.app && window.app.state;
    return state && state.caseGenModules && state.caseGenModules.length ? state.caseGenModules[0].id : '';
  });
  expect(moduleId).toBeTruthy();
  const casePayload = JSON.stringify([{
    module: '登录模块',
    title: '登录成功',
    priority: 'P1',
    preconditions: '',
    steps: '步骤1',
    expected: '成功',
  }], null, 2);
  const importContent = '#CASE_MODULE:登录模块\n' + casePayload;
  await page.setInputFiles(`input[data-import-input="${moduleId}"]`, {
    name: 'cases.json',
    mimeType: 'application/json',
    buffer: Buffer.from(importContent),
  });
  const requirementDrawer = page.locator('#caseGenRequirementDrawer');
  await expect(requirementDrawer).toHaveClass(/open/);
  await page.fill('#caseGenRequirementDrawerInput', requirementLabel);
  await page.click('#caseGenRequirementDrawerConfirmBtn');
  await expect(requirementDrawer).not.toHaveClass(/open/);
  await page.waitForFunction((id) => {
    const state = window.app && window.app.state;
    return state && state.caseGenResults && state.caseGenResults[id] && state.caseGenResults[id].trim().length > 0;
  }, moduleId);
  await page.evaluate(() => {
    if (window.app && window.app.core && typeof window.app.core.refreshExportCaseGenButton === 'function') {
      window.app.core.refreshExportCaseGenButton();
    }
    if (window.app && window.app.casesGenApi && typeof window.app.casesGenApi.refreshExportCaseGenXmindButton === 'function') {
      window.app.casesGenApi.refreshExportCaseGenXmindButton();
    }
  });
  return moduleId;
}

test.describe('用例生成导出 XMind', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.removeItem('tap-auth-token');
      } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('导出生成用例使用需求标识命名 XMind', async ({ page }) => {
    await prepareCaseGen(page, '需求1');
    await page.click('#caseGenSettingsTabBtn');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#exportCaseGen'),
    ]);
    const name = await download.suggestedFilename();
    expect(name).toMatch(/^需求1_\d{14}\.xmind$/);
  });

  test('全局按钮导出勾选模块用例为 XMind', async ({ page }) => {
    const moduleId = await prepareCaseGen(page, '需求1');
    const viewBtn = page.locator(`[data-view="${moduleId}"]`);
    await expect(viewBtn).toBeEnabled();
    await viewBtn.click();
    await page.waitForSelector(`input[data-case-select-all="${moduleId}"]`);
    await page.click(`input[data-case-select-all="${moduleId}"]`);
    const closeDrawerBtn = page.locator('#closeCaseGenViewDrawerBtn');
    if (await closeDrawerBtn.isVisible()) {
      await closeDrawerBtn.click();
    }
    await page.click('#caseGenSettingsTabBtn');
    const exportBtn = page.locator('#exportCaseGenXmind');
    await expect(exportBtn).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      exportBtn.click(),
    ]);
    const name = await download.suggestedFilename();
    expect(name).toMatch(/^需求1_\d{14}\.xmind$/);
  });

  test('XMind 抽屉可复用共享结果导出当前树', async ({ page }) => {
    await prepareCaseGen(page, '需求XMind');
    await page.click('.tab-group-btn[data-group="ai"]');
    await page.click('[data-tab-btn="casesgen"]');
    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await page.click('#caseGenModulesTabBtn');
    await page.click('#xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await page.waitForFunction(() => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      return Array.prototype.some.call(nodes, function(node) {
        var text = node && node.textContent ? String(node.textContent) : '';
        return text.indexOf('登录成功') !== -1;
      });
    }, {}, { timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#xmindCaseGenExportBtn'),
    ]);
    const name = await download.suggestedFilename();
    expect(name).toMatch(/^需求XMind_\d{14}\.xmind$/);
    const toast = page.locator('.temp-center-toast.ok', { hasText: '已导出当前 XMind' });
    await expect(toast).toBeVisible();
    await page.waitForFunction(() => {
      var el = document.getElementById('xmindCaseGenStatus');
      return Boolean(el) && !String(el.textContent || '').trim();
    }, {}, { timeout: 15000 });
    await expect(toast).toHaveCount(0, { timeout: 4000 });
  });
});
