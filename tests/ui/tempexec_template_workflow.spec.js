const { test, expect } = require('@playwright/test');

test('常用用例模版 owner 加载目录并控制下拉状态', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
  });
  await page.route('**/caseTemplate/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/manifest.json')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['manifest-only.xmind']),
      });
      return;
    }
    if (pathname.endsWith('/caseTemplate/')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<a href="directory-first.xmind">directory-first.xmind</a>',
      });
      return;
    }
    await route.fulfill({ status: 404, body: '' });
  });

  await page.goto('/case-exec.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.evaluate(() => {
    const toggle = document.getElementById('caseTemplateToggle');
    toggle.disabled = false;
    const workflow = window.app.tempExecTemplateWorkflowOwner.create({
      api: window.app.tempExecApi || {},
      window,
      document,
      statusElement: document.getElementById('tempExecStatus'),
      setStatus: window.app.setStatus,
      escapeHtml: window.app.escapeHtml,
      now: () => 123,
    });
    window.__templateWorkflowTest = workflow;
    workflow.init();
  });

  await page.evaluate(() => document.getElementById('caseTemplateToggle').click());
  await expect(page.locator('#caseTemplateDropdown')).toHaveClass(/open/);
  await expect(page.locator('#caseTemplateMenu')).not.toHaveClass(/hidden/);
  await expect(page.locator('#caseTemplateMenu [data-template-name]')).toHaveCount(1);
  await expect(page.locator('#caseTemplateMenu [data-template-name]')).toHaveText('directory-first');

  await page.evaluate(() => document.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect(page.locator('#caseTemplateDropdown')).not.toHaveClass(/open/);
  await expect(page.locator('#caseTemplateMenu')).toHaveClass(/hidden/);
});
