const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function initPage(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
  await page.evaluate(() => {
    if (window.app && typeof window.app.init === 'function') window.app.init();
  });
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });
}

test.describe('自动流程澄清开关持久化', () => {
  test('勾选后跨页与刷新仍保持勾选', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
      } catch (_) {}
    });

    await initPage(page, base + '/ai-workflow.html?tab=auto');
    const toggle = page.locator('#autoNeedClarify');
    await toggle.check();
    await expect(toggle).toBeChecked();

    // Simulate immediate page switch without waiting debounce persistence.
    await initPage(page, base + '/settings.html?tab=settings');
    await initPage(page, base + '/ai-workflow.html?tab=auto');
    await expect(page.locator('#autoNeedClarify')).toBeChecked();

    await page.reload();
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => {
      if (window.app && typeof window.app.init === 'function') window.app.init();
    });
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });
    await expect(page.locator('#autoNeedClarify')).toBeChecked();

    const persisted = await page.evaluate(() => {
      try {
        var raw = localStorage.getItem('usecase-workflow-state-v1') || '';
        if (!raw) return false;
        var parsed = JSON.parse(raw);
        var data = parsed && parsed.data ? parsed.data : {};
        return Boolean(data.autoRequireClarifications);
      } catch (_) {
        return false;
      }
    });
    expect(persisted).toBe(true);
  });
});
