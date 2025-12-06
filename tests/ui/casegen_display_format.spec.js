const { test, expect } = require('@playwright/test');

test.describe('用例生成展示格式', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('导入含 <br/> 的用例结果后展示为格式化 JSON', async ({ page }) => {
    await page.click('[data-tab-btn="clean"]');
    await page.evaluate(() => {
      window.prompt = () => '测试需求';
      const split = document.getElementById('splitResult');
      if (split) {
        split.removeAttribute('readonly');
        split.value = JSON.stringify([{ module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] }]);
        split.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.click('#goUsecaseGen');

    const importBtn = page.locator('#casesGenerationContainer button[data-import]').first();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      importBtn.click(),
    ]);
    const payload = '#CASE_MODULE:登录\n[{"module":"登录","title":"用例<br/>1","priority":"P1","preconditions":"","steps":["步骤1","步骤2"],"expected":"正常"}]';
    await chooser.setFiles({
      name: 'cases.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(payload),
    });

    const textarea = page.locator('#casesGenerationContainer textarea[data-result]').first();
    await expect(textarea).not.toHaveValue('');
    const value = await textarea.inputValue();
    await expect(value).not.toContain('<br');
    await expect(value).toContain('[');
    await expect(value).toContain('用例\n1');
  });
});
