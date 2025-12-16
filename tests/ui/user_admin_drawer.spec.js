const { test, expect } = require('@playwright/test');

test.describe('人员管理列表与抽屉', () => {
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

    await page.route('**/api/users/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'test_admin', role: 'admin' }),
      });
    });

    const projects = [
      { id: 1, name: 'Alpha', description: '', created_at: '2024-12-01T12:00:00Z', versions: [] },
      { id: 2, name: 'Beta', description: '', created_at: '2024-12-02T12:00:00Z', versions: [] },
    ];
    const users = [
      { id: 1, username: 'alice', role: 'admin', level: 'leader', is_active: true, created_at: '2024-12-05T10:00:00Z' },
      { id: 2, username: 'bob', role: 'user', level: 'member', is_active: true, created_at: '2024-12-06T10:00:00Z' },
    ];

    await page.route('**/api/projects', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(projects),
      });
    });

    await page.route('**/api/users', (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(users),
      });
    });

    await page.route('**/api/users/*/projects', (route) => {
      const url = route.request().url();
      const match = url.match(/users\/(\d+)\/projects/);
      const uid = match ? Number(match[1]) : 0;
      const mapping = {
        1: [{ project_id: 1, name: 'Alpha' }],
        2: [{ project_id: 2, name: 'Beta' }],
      };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mapping[uid] || []),
      });
    });

    await page.route('**/api/users/assign-projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.tabGroupBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.adminBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.authReady === true, null, { timeout: 20000 });
  });

  test('表格渲染且抽屉打开关闭正常', async ({ page }) => {
    const manageBtn = page.locator('.tab-group-btn', { hasText: '管理' });
    await manageBtn.click();
    const userTabBtn = page.locator('[data-group-menu="manage"] [data-tab-btn="user-admin"]');
    await userTabBtn.click();
    await expect(page.locator('#flowNav')).toBeHidden();
    await expect(page.locator('#userAdminHead')).toBeVisible();
    const userSection = page.locator('section[data-tab-section="user-admin"]');
    await expect(userSection).toBeVisible();

    const tableRows = page.locator('#userTableBody tr');
    await expect(tableRows).toHaveCount(2);
    await expect(tableRows.nth(0)).toContainText('alice');
    await expect(tableRows.nth(1)).toContainText('bob');

    const createBtn = page.locator('#userCreateBtn');
    await createBtn.scrollIntoViewIfNeeded();
    await createBtn.click();
    const drawer = page.locator('#userDrawer');
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#userDrawerTitle')).toContainText('新增');
    await page.locator('#userDrawer .drawer-mask').click();
    await expect(drawer).not.toHaveClass(/open/);

    await page.locator('[data-action="edit-user"]').first().click();
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#userDrawerTitle')).toContainText('编辑');
    await expect(page.locator('#userNameInput')).toBeDisabled();
    const projectChoices = page.locator('#userProjectsSelect .project-checkbox');
    await expect(projectChoices).toHaveCount(2);
    await expect(projectChoices.nth(0)).toContainText('Alpha');
    await expect(projectChoices.nth(0).locator('input')).toBeChecked();
    await expect(projectChoices.nth(1).locator('input')).not.toBeChecked();
  });

  test('抽屉遮罩覆盖侧边导航不可点击', async ({ page }) => {
    const manageBtn = page.locator('.tab-group-btn', { hasText: '管理' });
    await manageBtn.click();
    await page.locator('[data-group-menu=\"manage\"] [data-tab-btn=\"user-admin\"]').click();
    const createBtn = page.locator('#userCreateBtn');
    await createBtn.scrollIntoViewIfNeeded();
    await createBtn.click();
    const drawer = page.locator('#userDrawer');
    await expect(drawer).toHaveClass(/open/);
    const btnBox = await manageBtn.boundingBox();
    const center = { x: btnBox.x + btnBox.width / 2, y: btnBox.y + btnBox.height / 2 };
    const topElement = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el && el.className ? el.className.toString() : '';
    }, center);
    expect(topElement).toMatch(/drawer-mask/);
  });

  test('所属项目为空时展示暂无项目', async ({ page }) => {
    await page.unroute('**/api/projects');
    await page.route('**/api/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.tabGroupBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.adminBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.authReady === true, null, { timeout: 20000 });

    const manageBtn = page.locator('.tab-group-btn', { hasText: '管理' });
    await manageBtn.click();
    await page.locator('[data-group-menu="manage"] [data-tab-btn="user-admin"]').click();
    const createBtn = page.locator('#userCreateBtn');
    await createBtn.scrollIntoViewIfNeeded();
    await createBtn.click();
    const emptyHint = page.locator('#userProjectsSelect .project-checkbox-empty');
    await expect(emptyHint).toContainText('暂无项目');
  });

  test('删除用户需二次确认并输入当前管理员密码', async ({ page }) => {
    await page.unroute('**/api/users');

    const localUsers = [
      { id: 1, username: 'alice', role: 'admin', level: 'leader', is_active: true, created_at: '2024-12-05T10:00:00Z' },
      { id: 2, username: 'bob', role: 'user', level: 'member', is_active: true, created_at: '2024-12-06T10:00:00Z' },
    ];

    await page.route('**/api/users', (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(localUsers) });
    });

    await page.route('**/api/users/2/delete', async (route) => {
      const payload = route.request().postDataJSON ? route.request().postDataJSON() : {};
      if (!payload || payload.admin_password !== 'secret') {
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: '管理员密码错误' }) });
      }
      const idx = localUsers.findIndex((u) => u && u.id === 2);
      if (idx !== -1) localUsers.splice(idx, 1);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ detail: '用户已删除' }) });
    });

    const manageBtn = page.locator('.tab-group-btn', { hasText: '管理' });
    await manageBtn.click();
    await page.locator('[data-group-menu="manage"] [data-tab-btn="user-admin"]').click();

    await page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('删除后果');
      await dialog.accept();
    });
    await page.locator('[data-action="delete-user"][data-id="2"]').click();

    const deleteDrawer = page.locator('#userDeleteDrawer');
    await expect(deleteDrawer).toHaveClass(/open/);
    await expect(page.locator('#userDeleteTargetText')).toContainText('bob');
    await expect(page.locator('#userDeleteConfirmBtn')).toBeDisabled();

    await page.fill('#userDeleteAdminPasswordInput', 'secret');
    await expect(page.locator('#userDeleteConfirmBtn')).toBeEnabled();
    await page.click('#userDeleteConfirmBtn');

    const toast = page.locator('.temp-center-toast', { hasText: '删除成功' });
    await expect(toast).toBeVisible();
    await expect(deleteDrawer).not.toHaveClass(/open/);
    await expect(page.locator('#userTableBody tr')).toHaveCount(1);
    await expect(page.locator('#userTableBody tr').first()).toContainText('alice');

    await page.waitForTimeout(3300);
    await expect(toast).toHaveCount(0);
  });
});
