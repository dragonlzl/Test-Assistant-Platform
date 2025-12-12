const { test, expect } = require('@playwright/test');

test.describe('项目管理列表与抽屉', () => {
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
        localStorage.setItem('tap-auth-token', 'test-token');
      } catch (_) {}
      const originalReplace = window.location.replace.bind(window.location);
      window.location.replace = function(url) {
        if (url && url.indexOf('login.html') !== -1) return;
        return originalReplace(url);
      };
    });

    const projects = [
      {
        id: 1,
        name: 'Alpha',
        description: '第一个项目',
        created_at: '2024-10-01T12:00:00Z',
        versions: [
          { id: 11, name: 'v1.0' },
          { id: 12, name: 'v1.1' },
          { id: 13, name: 'v1.2' },
          { id: 14, name: 'v1.3' },
          { id: 15, name: 'v1.4' },
          { id: 16, name: 'v1.5' },
        ],
      },
      { id: 2, name: 'Beta', description: '', created_at: '2024-11-11T09:00:00Z', versions: [] },
    ];
    await page.route('**/api/users/me', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'admin', role: 'admin' }) });
    });
    await page.route('**/api/projects', (route) => {
      if (route.request().method().toUpperCase() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) });
      }
      if (route.request().method().toUpperCase() === 'POST') {
        const body = { id: projects.length + 1, name: 'Gamma', description: '新增', created_at: new Date().toISOString(), versions: [] };
        projects.push(body);
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body) });
      }
      return route.continue();
    });
    await page.route('**/api/projects/*/versions', (route) => {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 21, name: 'v2.0', created_at: new Date().toISOString() }) });
    });
    await page.route('**/api/projects/*', (route) => {
      if (route.request().method().toUpperCase() === 'PATCH') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: route.request().postData() || '{}' });
      }
      return route.continue();
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });
  });

  test('列表渲染且抽屉开关正常', async ({ page }) => {
    const manageBtn = page.locator('.tab-group-btn', { hasText: '管理' });
    await manageBtn.click();
    await page.click('[data-group-menu="manage"] [data-tab-btn="project-admin"]');

    const rows = page.locator('#projectTableBody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Alpha');
    await expect(rows.nth(1)).toContainText('Beta');

    const firstActionsWrap = await page.$eval('#projectTableBody tr:first-child .actions', function(el) {
      return window.getComputedStyle(el).flexWrap;
    });
    expect(firstActionsWrap).toBe('nowrap');

    const versionBorder = await page.$eval('#projectTableBody tr:first-child .project-versions', function(el) {
      return window.getComputedStyle(el).borderBottomWidth;
    });
    expect(versionBorder).toBe('0px');

    const versionOverflow = await page.$eval('#projectTableBody tr:first-child .version-list', function(el) {
      return window.getComputedStyle(el).overflowY;
    });
    expect(versionOverflow).toBe('visible');
    const actionsHeight = await page.$eval('#projectTableBody tr:first-child .actions', function(el) {
      return el.getBoundingClientRect().height;
    });
    expect(actionsHeight).toBeLessThanOrEqual(48);
    const actionWhiteSpace = await page.$eval('#projectTableBody tr:first-child .actions button', function(el) {
      return window.getComputedStyle(el).whiteSpace;
    });
    expect(actionWhiteSpace).toBe('nowrap');
    const nameWhiteSpace = await page.$eval('#projectTableBody tr:first-child .project-name-text', function(el) {
      var style = window.getComputedStyle(el);
      return style.whiteSpace;
    });
    expect(nameWhiteSpace).toBe('nowrap');
    const descWhiteSpace = await page.$eval('#projectTableBody tr:first-child .project-desc-text', function(el) {
      var style = window.getComputedStyle(el);
      return style.whiteSpace;
    });
    expect(descWhiteSpace).toBe('nowrap');
    const createdWhiteSpace = await page.$eval('#projectTableBody tr:first-child .project-created-text', function(el) {
      var style = window.getComputedStyle(el);
      return style.whiteSpace;
    });
    expect(createdWhiteSpace).toBe('nowrap');

    const betaVersions = page.locator('#projectTableBody tr').nth(1).locator('.project-versions');
    const emptyLabel = betaVersions.locator('.version-empty');
    await expect(emptyLabel).toBeVisible();
    const cellBox = await betaVersions.boundingBox();
    const emptyBox = await emptyLabel.boundingBox();
    expect(cellBox).not.toBeNull();
    expect(emptyBox).not.toBeNull();
    if (cellBox && emptyBox) {
      const cellCenter = cellBox.y + cellBox.height / 2;
      const emptyCenter = emptyBox.y + emptyBox.height / 2;
      expect(Math.abs(cellCenter - emptyCenter)).toBeLessThanOrEqual(2);
    }

    await page.click('#projectCreateBtn');
    const drawer = page.locator('#projectDrawer');
    await expect(drawer).toHaveClass(/open/);
    await page.fill('#projectNameInput', 'Gamma');
    await page.fill('#projectDescInput', '新增');
    await page.click('#projectSaveBtn');
    await expect(drawer).not.toHaveClass(/open/);
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(2)).toContainText('Gamma');

    await page.locator('[data-action="edit-project"]').first().click();
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#projectNameInput')).toHaveValue('Alpha');
    await page.evaluate(() => {
      var closer = document.querySelector('#projectDrawer [data-drawer-close="projectDrawer"]');
      if (closer && typeof closer.click === 'function') closer.click();
    });
    await expect(drawer).not.toHaveClass(/open/);
  });

  test('非管理员组员仅可见所属项目且无项目编辑/删除', async ({ page }) => {
    await page.unroute('**/api/users/me');
    await page.route('**/api/users/me', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 9, username: 'member', role: 'user', level: 'member' }) });
    });
    const projects = [
      { id: 1, name: 'Alpha', description: 'Alpha desc', created_at: '2024-10-01T12:00:00Z', versions: [{ id: 11, name: 'v1.0' }] },
      { id: 2, name: 'Beta', description: 'Beta desc', created_at: '2024-11-11T09:00:00Z', versions: [{ id: 21, name: 'v2.0' }] },
    ];
    await page.unroute('**/api/projects');
    await page.route('**/api/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) });
    });
    await page.route('**/api/users/9/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ project_id: 2 }]) });
    });
    await page.route('**/api/projects/*/versions', (route) => {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 22, name: 'v2.1', created_at: new Date().toISOString() }) });
    });
    await page.route('**/api/projects/*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.reload();
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="manage"]');
    const projectTabBtn = page.locator('[data-group-menu="manage"] [data-tab-btn="project-admin"]');
    await projectTabBtn.click();
    await expect(page.locator('section[data-tab-section="project-admin"]')).toBeVisible();

    await expect(page.locator('#projectCreateBtn')).toBeHidden();
    const rows = page.locator('#projectTableBody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Beta');
    await expect(rows.first()).not.toContainText('Alpha');
    await expect(rows.first().locator('[data-action="edit-project"]')).toHaveCount(0);
    await expect(rows.first().locator('[data-action="delete-project"]')).toHaveCount(0);
    await expect(rows.first().locator('[data-action="add-version"]')).toBeVisible();
    await expect(rows.first().locator('[data-action="delete-version"]')).toBeVisible();
  });

  test('非管理员组长可编辑所属项目但不能删除项目', async ({ page }) => {
    await page.unroute('**/api/users/me');
    await page.route('**/api/users/me', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 8, username: 'leader', role: 'user', level: 'leader' }) });
    });
    const projects = [
      { id: 1, name: 'Alpha', description: 'Alpha desc', created_at: '2024-10-01T12:00:00Z', versions: [{ id: 11, name: 'v1.0' }] },
      { id: 3, name: 'Gamma', description: 'Gamma desc', created_at: '2024-12-01T09:00:00Z', versions: [{ id: 31, name: 'v3.0' }] },
    ];
    await page.unroute('**/api/projects');
    await page.route('**/api/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) });
    });
    await page.route('**/api/users/8/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ project_id: 3 }]) });
    });
    await page.route('**/api/projects/*/versions', (route) => {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 32, name: 'v3.1', created_at: new Date().toISOString() }) });
    });
    await page.route('**/api/projects/*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.reload();
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="manage"]');
    const projectTabBtn2 = page.locator('[data-group-menu="manage"] [data-tab-btn="project-admin"]');
    await expect(projectTabBtn2).toBeVisible();
    await projectTabBtn2.click();

    await expect(page.locator('#projectCreateBtn')).toBeHidden();
    const rows = page.locator('#projectTableBody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Gamma');
    await expect(rows.first().locator('[data-action="edit-project"]')).toBeVisible();
    await expect(rows.first().locator('[data-action="delete-project"]')).toHaveCount(0);
    await expect(rows.first().locator('[data-action="add-version"]')).toBeVisible();
    await expect(rows.first().locator('[data-action="delete-version"]')).toBeVisible();
  });

  test('组长无分配数据时仍能看到项目列表', async ({ page }) => {
    await page.unroute('**/api/users/me');
    await page.route('**/api/users/me', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 7, username: 'leader2', role: 'user', level: 'leader' }) });
    });
    const projects = [
      { id: 1, name: 'Alpha', description: 'Alpha desc', created_at: '2024-10-01T12:00:00Z', versions: [{ id: 11, name: 'v1.0' }] },
      { id: 2, name: 'Beta', description: 'Beta desc', created_at: '2024-11-11T09:00:00Z', versions: [{ id: 21, name: 'v2.0' }] },
    ];
    await page.unroute('**/api/projects');
    await page.route('**/api/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) });
    });
    await page.route('**/api/users/7/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.reload();
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="manage"]');
    const projectTabBtn3 = page.locator('[data-group-menu="manage"] [data-tab-btn="project-admin"]');
    await expect(projectTabBtn3).toBeVisible();
    await projectTabBtn3.click();

    const rows = page.locator('#projectTableBody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Alpha');
    await expect(rows.nth(1)).toContainText('Beta');
    await expect(page.locator('#projectCreateBtn')).toBeHidden();
    await expect(rows.first().locator('[data-action="edit-project"]')).toBeVisible();
    await expect(rows.first().locator('[data-action="delete-project"]')).toHaveCount(0);
    await expect(rows.first().locator('[data-action="add-version"]')).toBeVisible();
    await expect(rows.first().locator('[data-action="delete-version"]')).toBeVisible();
  });
});
