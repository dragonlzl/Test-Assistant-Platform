const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

async function switchToTempExecPage(page) {
  const navigation = page.waitForURL((url) => url.pathname.endsWith('/case-exec.html'), { timeout: 20000 });
  await page.evaluate(() => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('tempexec');
  }).catch((error) => {
    if (!error || !/Execution context was destroyed/i.test(error.message || '')) throw error;
  });
  await navigation;
  await page.waitForFunction(() => {
    var app = window.app;
    return Boolean(
      app && app._inited === true && app.authReady === true && app.state
      && app.state.activeTab === 'tempexec'
      && app.tempExecApi
      && typeof app.tempExecApi.autoCollapseTempExecReusePanels === 'function'
    );
  }, null, { timeout: 20000 });
}

test.describe('执行视图复用子项滚动自动收起', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-auto-collapse-token');
        localStorage.setItem('tempexec-page-size', '200');
        const cases = [];
        for (let i = 0; i < 120; i += 1) {
          cases.push({
            module: `模块${i + 1}`,
            title: `用例${i + 1}`,
            priority: 'P1',
            preconditions: '',
            steps: `步骤${i + 1}`,
            expected: `结果${i + 1}`,
            actual: '未执行',
            remark: '',
            reuseDetails: i === 0
              ? [{ id: 'reuse-detail-1', text: '子项1', note: '', status: '未执行' }]
              : [],
            defectLinks: [],
          });
        }
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-auto-collapse-file',
            name: '复用自动收起',
            reuseEnabled: true,
            reusePresets: [],
            createdAt: Date.now(),
            requirement: '',
            projectId: '',
            versionId: '',
            cases,
          }],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'reuse-auto-collapse-file',
        }));
      } catch (_) {}
    });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_auto', role: 'user', level: 'member' }) })
    );
  });

  test('滚动离开后自动收起复用子项', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await switchToTempExecPage(page);
    await page.evaluate(() => {
      if (window.app && window.app.api && typeof window.app.api.applyTempExecPageSize === 'function') {
        window.app.api.applyTempExecPageSize(200);
      }
      if (window.scrollTo) window.scrollTo(0, 0);
    });
    await page.waitForSelector('[data-section-id="tempexec-view"]:not(.hidden)');
    await page.waitForSelector('[data-temp-reuse-panel="reuse-auto-collapse-file"][data-index="0"]');
    await page.evaluate(() => {
      window.__scrollCount = 0;
      window.addEventListener('scroll', () => { window.__scrollCount += 1; });
    });
    const openedState = await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.toggleTempExecReusePanel === 'function') {
        window.app.tempExecApi.toggleTempExecReusePanel('reuse-auto-collapse-file', [0]);
      }
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      const row = document.querySelector('[data-temp-reuse-row="reuse-auto-collapse-file"][data-index="0"]');
      const rect = row && row.getBoundingClientRect ? row.getBoundingClientRect() : null;
      return {
        openSetSize: api && typeof api.ensureTempExecReuseOpen === 'function'
          ? api.ensureTempExecReuseOpen('reuse-auto-collapse-file').size
          : 0,
        scrollTop: window.scrollY || document.documentElement.scrollTop || 0,
        viewportHeight: window.innerHeight || document.documentElement.clientHeight || 0,
        rowTop: rect ? rect.top : null,
        rowBottom: rect ? rect.bottom : null,
      };
    });
    expect(openedState.openSetSize).toBe(1);
    const openSetSize = await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.ensureTempExecReuseOpen === 'function') {
        return window.app.tempExecApi.ensureTempExecReuseOpen('reuse-auto-collapse-file').size || 0;
      }
      return 0;
    });
    console.log('openSetSize', openSetSize);
    await expect(page.locator('.reuse-row.visible')).toHaveCount(1);

    for (let i = 0; i < 16; i += 1) {
      await page.mouse.wheel(0, 700);
      const scrollTop = await page.evaluate(() => {
        if (typeof window === 'undefined') return 0;
        return window.scrollY || document.documentElement.scrollTop || 0;
      });
      if (scrollTop > 2400) break;
    }

    await page.evaluate(() => {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event('scroll'));
      }
    });
    await page.waitForTimeout(200);
    const scrollCount = await page.evaluate(() => window.__scrollCount || 0);
    console.log('scrollCount', scrollCount);
    const sectionHidden = await page.evaluate(() => {
      const section = document.querySelector('[data-section-id="tempexec-view"]');
      return section ? section.classList.contains('hidden') : null;
    });
    console.log('sectionHidden', sectionHidden);
    const placeholderState = await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.state.tempExecReusePlaceholders) return null;
      return window.app.state.tempExecReusePlaceholders['reuse-auto-collapse-file'] || null;
    });
    console.log('placeholderState', placeholderState);
    const rowState = await page.evaluate(() => {
      const row = document.querySelector('[data-temp-reuse-row="reuse-auto-collapse-file"][data-index="0"]');
      const panel = document.querySelector('[data-temp-reuse-panel-container="reuse-auto-collapse-file"][data-index="0"]');
      const rect = row && row.getBoundingClientRect ? row.getBoundingClientRect() : null;
      return {
        rowClass: row ? row.className : '',
        panelExists: Boolean(panel),
        rect: rect ? { top: rect.top, bottom: rect.bottom } : null,
      };
    });
    console.log('rowState', rowState);
    await page.waitForSelector('.reuse-row.placeholder');

    await page.evaluate(() => {
      const placeholder = document.querySelector('.reuse-row.placeholder');
      if (placeholder && placeholder.scrollIntoView) {
        placeholder.scrollIntoView({ block: 'center' });
      }
    });
    await page.waitForTimeout(500);
    await expect(page.locator('.reuse-row.visible')).toHaveCount(1);
    await expect(page.locator('.reuse-row.placeholder')).toHaveCount(0);
  });
});
