const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function prepareExecList(page, options = {}) {
  const reuseEnabled = Boolean(options.reuseEnabled);
  await page.addInitScript(() => {
    try { localStorage.setItem('tap-auth-token', 'tempexec-list-layout-token'); } catch (_) {}
  });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const body = url.pathname === '/api/users/me'
      ? { id: 0, username: 'tempexec_list_layout', role: 'user', level: 'member' }
      : (method === 'GET' ? [] : {});
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto(base + '/case-exec.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.evaluate((enableReuse) => {
    var state = window.app.state;
    var api = window.app.tempExecApi;
    var statuses = ['未执行', '通过', '失败', '阻塞', '不适用'];
    state.tempExecFiles = [{
      id: 'list-layout-file',
      name: '列表布局验证',
      reuseEnabled: enableReuse,
      reusePresets: [],
      createdAt: Date.now(),
      requirement: '',
      projectId: '',
      versionId: '',
      cases: statuses.map(function(status, index) {
        return {
          module: '模块' + String(index + 1),
          title: '紧凑列表用例' + String(index + 1),
          priority: ['P0', 'P1', 'P2'][index % 3],
          preconditions: '前提',
          steps: '步骤',
          expected: '预期',
          actual: status,
          remark: index === 0 ? '执行说明' : '',
          reuseDetails: index === 0 ? [{
            id: 'reuse-detail-1',
            text: '测试项',
            note: '独立备注',
            status: '未执行',
          }] : [],
          defectLinks: index === 0 ? [{ id: 'defect-link-1', url: 'https://example.com/defect/1' }] : [],
        };
      }),
    }];
    state.tempExecActiveId = 'list-layout-file';
    api.renderTempExecView();
  }, reuseEnabled);
  await expect(page.locator('#tempExecView tr.case-row')).toHaveCount(5);
}

test.describe('执行用例列表布局', () => {
  test('表头、状态色、紧凑间距和操作列保持一致', async ({ page }) => {
    await prepareExecList(page);

    const table = page.locator('#tempExecView table').first();
    const prioritySelects = table.locator('select[data-temp-priority]');
    const resultSelects = table.locator('select[data-temp-result]');
    await expect(prioritySelects).toHaveCount(5);

    const priorityOptions = await prioritySelects.first().locator('option').evaluateAll((options) => {
      return options.map((option) => option.value);
    });
    expect(priorityOptions).toEqual(['P0', 'P1', 'P2']);

    const headerAlignments = await table.locator('thead th').evaluateAll((headers) => {
      return headers.map((header) => getComputedStyle(header).textAlign);
    });
    expect(new Set(headerAlignments)).toEqual(new Set(['center']));

    const statusColors = await resultSelects.evaluateAll((selects) => {
      return selects.map((select) => getComputedStyle(select).backgroundColor);
    });
    expect(new Set(statusColors).size).toBe(5);

    const priorityColors = await prioritySelects.evaluateAll((selects) => {
      return selects.slice(0, 3).map((select) => getComputedStyle(select).backgroundColor);
    });
    expect(new Set(priorityColors).size).toBe(3);

    const priorityOptionColors = await prioritySelects.first().locator('option').evaluateAll((options) => {
      return options.map((option) => getComputedStyle(option).color + '/' + getComputedStyle(option).backgroundColor);
    });
    expect(new Set(priorityOptionColors).size).toBe(3);

    const resultOptionColors = await resultSelects.first().locator('option').evaluateAll((options) => {
      return options.map((option) => getComputedStyle(option).color + '/' + getComputedStyle(option).backgroundColor);
    });
    expect(new Set(resultOptionColors).size).toBe(5);

    await prioritySelects.first().selectOption('P2');
    await expect(prioritySelects.first()).toHaveAttribute('data-priority', 'p2');
    await expect.poll(() => page.evaluate(() => window.app.state.tempExecFiles[0].cases[0].priority)).toBe('P2');

    const metrics = await table.locator('tr.case-row').first().evaluate((row) => {
      var cells = row.querySelectorAll('td');
      var actual = row.querySelector('td.actual select, td.actual button');
      var remark = row.querySelector('td.remark button');
      var defect = row.querySelector('td.defect button');
      var actualRect = actual.getBoundingClientRect();
      var remarkRect = remark.getBoundingClientRect();
      var defectRect = defect.getBoundingClientRect();
      return {
        cellPadding: parseFloat(getComputedStyle(cells[0]).padding),
        rowHeight: row.getBoundingClientRect().height,
        controlTops: [actualRect.top, remarkRect.top, defectRect.top],
        controlHeights: [actualRect.height, remarkRect.height, defectRect.height],
      };
    });
    expect(metrics.cellPadding).toBeLessThanOrEqual(5);
    expect(metrics.rowHeight).toBeLessThanOrEqual(44);
    expect(Math.max(...metrics.controlTops) - Math.min(...metrics.controlTops)).toBeLessThanOrEqual(1);
    expect(Math.max(...metrics.controlHeights) - Math.min(...metrics.controlHeights)).toBeLessThanOrEqual(1);
  });

  test('详情按钮统一为长方形小圆角且内容边框保持直角', async ({ page }) => {
    await prepareExecList(page, { reuseEnabled: true });
    const view = page.locator('#tempExecView');

    await view.locator('[data-temp-reuse-panel]').first().click();
    await view.locator('[data-temp-remark-toggle]').first().click();
    await view.locator('[data-temp-defect-toggle]').first().click();
    await expect(view.locator('.reuse-panel')).toBeVisible();
    await expect(view.locator('.remark-panel').first()).toBeVisible();
    await expect(view.locator('.defect-panel').first()).toBeVisible();

    const geometry = await view.evaluate((root) => {
      function radii(selector) {
        return Array.from(root.querySelectorAll(selector))
          .filter(function(element) { return element.getClientRects().length > 0; })
          .map(function(element) { return getComputedStyle(element).borderTopLeftRadius; });
      }
      return {
        buttons: radii([
          '.reuse-add',
          '.reuse-sync',
          '.reuse-remove',
          '.defect-add',
          '.defect-open',
          '.defect-remove',
          '.temp-pagination-controls button',
          '.remark-toggle',
          '.defect-toggle',
          '.case-op',
        ].join(',')),
        selects: radii('.priority-select, .status-select'),
        fields: radii([
          '.remark-panel',
          '.reuse-input',
          '.reuse-note',
          '.defect-entry input',
          '.temp-pagination-controls input',
        ].join(',')),
        frames: radii('.workspace-list-view, .temp-pagination, .reuse-panel, .defect-panel'),
      };
    });

    expect(geometry.buttons.length).toBeGreaterThan(8);
    expect(new Set(geometry.buttons)).toEqual(new Set(['4px']));
    expect(new Set(geometry.selects)).toEqual(new Set(['4px']));
    expect(new Set(geometry.fields)).toEqual(new Set(['0px']));
    expect(new Set(geometry.frames)).toEqual(new Set(['0px']));
  });
});
