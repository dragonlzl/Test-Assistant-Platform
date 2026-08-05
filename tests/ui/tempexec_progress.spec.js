const { test, expect } = require('@playwright/test');

test.describe('临时执行进度视图', () => {
  async function confirmDrawerInput(page, value) {
    const drawer = page.locator('#appConfirmDrawer');
    await drawer.waitFor({ state: 'attached' });
    await page.waitForFunction(() => {
      const el = document.getElementById('appConfirmDrawer');
      return el && el.classList.contains('open');
    }).catch(() => {});
    const isOpen = await drawer.evaluate((el) => el.classList.contains('open')).catch(() => false);
    if (!isOpen) return;
    await expect(page.locator('#appConfirmDrawerInputRow')).toBeVisible();
    await page.fill('#appConfirmDrawerInput', value);
    await page.click('#appConfirmDrawerConfirmBtn');
    await page.waitForFunction(() => {
      const el = document.getElementById('appConfirmDrawer');
      if (el && (el.classList.contains('open') || el.classList.contains('closing'))) return false;
      return !document.querySelector('.drawer.drawer-suspended');
    }).catch(() => {});
  }
  async function createTempVersion(page, name, expectedCount) {
    await page.click('#createTempVersionBtn', { force: true });
    await confirmDrawerInput(page, name);
    if (expectedCount) {
      await expect(page.locator('#tempVersionGrid [data-temp-version]')).toHaveCount(expectedCount);
    }
  }
  async function openOverview(page) {
    await page.evaluate(() => {
      if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
      try {
        window.dispatchEvent(new CustomEvent('app-path-sub-jump', { detail: { tab: 'tempexec', sub: '归档操作&进度预览' } }));
      } catch (err) {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('app-path-sub-jump', false, false, { tab: 'tempexec', sub: '归档操作&进度预览' });
        window.dispatchEvent(evt);
      }
    });
    await expect(page.locator('#tempExecOverviewDrawer')).toHaveClass(/open/);
  }

  async function openAssignDrawer(page) {
    await page.evaluate(() => {
      try {
        window.dispatchEvent(new CustomEvent('app-path-sub-jump', { detail: { tab: 'tempexec', sub: '执行分配' } }));
      } catch (err) {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('app-path-sub-jump', false, false, { tab: 'tempexec', sub: '执行分配' });
        window.dispatchEvent(evt);
      }
    });
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
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
        && app.tempExecApi && typeof app.tempExecApi.renderTempExecView === 'function'
      );
    }, null, { timeout: 20000 });
    await page.evaluate(() => {
      window.app.state.currentUser = { id: 0, username: 'e2e', role: 'admin', level: 'leader' };
      window.app.state.tempExecVersionCollapsed = false;
      if (window.app.tempExecApi.renderTempVersionGrid) window.app.tempExecApi.renderTempVersionGrid();
      if (window.app.tempExecApi.renderTempExecNav) window.app.tempExecApi.renderTempExecNav();
    });
  }

  test.beforeEach(async ({ page }) => {
    page.__promptAnswers = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'ui-test-token');
        localStorage.removeItem('tap-e2e-skip-auth');
        localStorage.removeItem('usecase-temp-exec-v1');
        localStorage.removeItem('tempexec-focus-v1');
        localStorage.removeItem('tempexec-page-size');
        localStorage.removeItem('usecase-active-tab');
      } catch (_) {}
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') {
        return respond(200, { id: 0, username: 'e2e', role: 'admin', level: 'leader' });
      }
      if (method === 'GET') return respond(200, []);
      return respond(200, {});
    });
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : '进度测试需求';
        await dialog.accept(answer);
        return;
      }
      await dialog.accept();
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(
      () => window.app && window.app._inited === true && window.app.tempExecApi,
      { timeout: 20000 }
    );
    await page.waitForFunction(() => window.app && window.app.authReady === true, { timeout: 20000 });
    await page.evaluate(() => {
      if (window.app) window.app.authReady = true;
      if (window.app && window.app.state) {
        window.app.state.currentUser = { id: 0, username: 'e2e', role: 'admin', level: 'leader' };
        window.app.state.tempExecVersionCollapsed = false;
      }
      if (window.app && window.app.tempExecApi) {
        if (window.app.tempExecApi.renderTempVersionGrid) window.app.tempExecApi.renderTempVersionGrid();
        if (window.app.tempExecApi.renderTempExecNav) window.app.tempExecApi.renderTempExecNav();
      }
    });
  });

  test('执行概览统计与拖拽同步', async ({ page }) => {
    await switchToTempExecPage(page);
    await page.locator('#openTempExecImportDrawerBtn').click({ force: true });
    await page.evaluate(() => {
      window.app.state.requirementLabel = '进度测试需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFileA = {
      name: 'progressA.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录', steps: 'step1', expected: 'ok' },
        { module: '模块A', title: '退出', steps: 'step2', expected: 'ok' },
      ], null, 2)),
    };
    const execFileB = {
      name: 'progressB.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块B', title: '下单', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('需求一');
    page.__promptAnswers.push('需求二');
    await page.setInputFiles('#tempExecInput', [execFileA, execFileB]);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });
    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/closing/);
    await openAssignDrawer(page);

    await page.evaluate(() => {
      if (window.app && window.app.state) {
        window.app.state.tempExecVersionCollapsed = false;
      }
      if (window.app && window.app.tempExecApi) {
        if (window.app.tempExecApi.renderTempVersionGrid) window.app.tempExecApi.renderTempVersionGrid();
        if (window.app.tempExecApi.renderTempExecNav) window.app.tempExecApi.renderTempExecNav();
      }
    });

    const createBtn = page.locator('#createTempVersionBtn');
    const createVisible = await createBtn.isVisible().catch(() => false);
    if (createVisible) {
      await createTempVersion(page, '版本一', 1);
      await createTempVersion(page, '版本二', 2);
    } else {
      await page.evaluate(() => {
        const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
        if (!api || typeof api.createTempVersion !== 'function') return;
        api.createTempVersion('版本一');
        api.createTempVersion('版本二');
      });
      await expect(page.locator('#tempVersionGrid [data-temp-version]')).toHaveCount(2);
    }
    await expect(page.locator('#tempVersionGrid [data-temp-version]')).toHaveCount(2);

    const navRows = page.locator('#tempExecNav .temp-req-row[data-temp-file]');
    const firstVersionBody = page.locator('#tempVersionGrid [data-temp-version]').first().locator('.temp-version-body');
    await navRows.first().dragTo(firstVersionBody);
    await expect(navRows).toHaveCount(1);

    const versionOneFileBtn = page.locator('#tempVersionGrid [data-temp-version]').first().locator('button[data-temp-file]').first();
    await versionOneFileBtn.click();
    const firstFileSelects = page.locator('#tempExecView select[data-temp-result]');
    await firstFileSelects.nth(0).selectOption('通过');
    await firstFileSelects.nth(1).selectOption('失败');

    // 执行视图切换文件需回到“执行分配”抽屉选择（点击后会自动收起抽屉并滚动到执行视图）。
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
    await openAssignDrawer(page);
    const remainingNavButtons = page.locator('#tempExecNav button.temp-req-item[data-temp-file]');
    await expect(remainingNavButtons).toHaveCount(1);
    await expect(remainingNavButtons.first()).toBeVisible();
    const remainingFileId = await remainingNavButtons.first().getAttribute('data-temp-file');
    expect(remainingFileId).toBeTruthy();
    await remainingNavButtons.first().click();
    await page.waitForFunction((fileId) => {
      return Boolean(
        window.app && window.app.state
        && String(window.app.state.tempExecActiveId || '') === String(fileId || '')
      );
    }, remainingFileId);
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecToolbar')).toContainText('progressB.json');
    const secondFileSelects = page.locator('#tempExecView select[data-temp-result]');
    await secondFileSelects.nth(0).selectOption('阻塞');
    await secondFileSelects.nth(1).selectOption('不适用');
    const versionOneRow = page.locator('#tempVersionGrid [data-temp-version]').first().locator('.temp-req-row').first();
    await expect(versionOneRow).toHaveClass(/err/);
    await expect(navRows.first()).toHaveClass(/err/);

    await openOverview(page);
    const overviewEntries = page.locator('#tempExecOverview .temp-overview-entry');
    expect(await overviewEntries.count()).toBeGreaterThanOrEqual(2);
    const overviewData = await page.$$eval('#tempExecOverview .temp-overview-entry', (nodes) => nodes.map((node) => {
      const header = node.querySelector('.temp-overview-header span');
      const rate = node.querySelector('.temp-overview-rate');
      const meta = node.querySelector('.temp-overview-meta');
      return {
        title: header ? header.textContent.trim() : '',
        rate: rate ? rate.textContent.trim() : '',
        meta: meta ? meta.textContent : '',
        barColors: Array.from(node.querySelectorAll('.temp-overview-bar .temp-overview-segment')).map(seg => seg.className || ''),
      };
    }));
    const progressEntry = overviewData.find(item => item.title.indexOf('progressA.json') !== -1);
    expect(progressEntry && progressEntry.rate).toContain('执行进度 50%');
    expect(progressEntry && progressEntry.meta).toContain('通过 1');
    expect(progressEntry && progressEntry.meta).toContain('失败 1');
    const pendingEntry = overviewData.find(item => item.title.indexOf('progressB.json') !== -1);
    expect(pendingEntry && pendingEntry.rate).toContain('执行进度 50%');
    expect(pendingEntry && pendingEntry.meta).toContain('阻塞 1');
    expect(pendingEntry && pendingEntry.meta).toContain('不适用 1');
    expect(progressEntry && progressEntry.barColors.some(cls => cls.indexOf('status-failed') !== -1 || cls.indexOf('status-blocked') !== -1)).toBeTruthy();
    expect(pendingEntry && pendingEntry.barColors.some(cls => cls.indexOf('status-blocked') !== -1 || cls.indexOf('status-unspecified') !== -1)).toBeTruthy();
    await expect(page.locator('#tempExecOverview')).toContainText('版本一');
    await expect(page.locator('#tempExecOverview')).toContainText('需求区（未分配版本）');
    const backBtn = page.locator('#tempExecBackBtn');
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click({ force: true });
    }
    await page.evaluate(() => {
      try {
        window.dispatchEvent(new CustomEvent('app-path-sub-jump', { detail: { tab: 'tempexec', sub: '执行视图' } }));
      } catch (err) {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('app-path-sub-jump', false, false, { tab: 'tempexec', sub: '执行视图' });
        window.dispatchEvent(evt);
      }
    });
    const overviewDrawer = page.locator('#tempExecOverviewDrawer');
    await expect(overviewDrawer).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 5000 });
    await openAssignDrawer(page);

    await page.evaluate(() => {
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      const st = window.app && window.app.state ? window.app.state : null;
      if (!api || !st) return;
      const versions = Array.isArray(st.tempExecVersions) ? st.tempExecVersions : [];
      if (versions.length < 2) return;
      const targetVersionId = versions[1] && versions[1].id ? versions[1].id : '';
      if (!targetVersionId) return;
      const files = Array.isArray(st.tempExecFiles) ? st.tempExecFiles : [];
      const pending = files.find((file) => file && file.name === 'progressB.json');
      if (!pending) return;
      api.moveTempExecToVersion(pending.id, targetVersionId);
    });
    await expect(navRows).toHaveCount(0);
    await openOverview(page);
    await expect(page.locator('#tempExecOverview')).toContainText('版本二');
    await expect(page.locator('#tempExecOverview')).toContainText('暂无未分配的用例');
    const finalColors = await page.$$eval('#tempExecOverview .temp-overview-entry', (nodes) => nodes.map((node) => {
      return Array.from(node.querySelectorAll('.temp-overview-bar .temp-overview-segment')).map(seg => seg.className || '');
    }));
    expect(finalColors.some(list => list.some(cls => cls.indexOf('status-failed') !== -1 || cls.indexOf('status-blocked') !== -1))).toBeTruthy();
  });

  test('个人执行总览点击进度可跳转用例并关闭抽屉', async ({ page }) => {
    await switchToTempExecPage(page);
    await page.locator('#openTempExecImportDrawerBtn').click({ force: true });
    await page.evaluate(() => {
      window.app.state.requirementLabel = '进度跳转需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const list = [];
    for (let i = 1; i <= 25; i += 1) {
      list.push({ module: '模块跳转', title: '用例' + i, steps: 'step' + i, expected: 'ok' });
    }
    const execFile = {
      name: 'jumpProgress.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(list, null, 2)),
    };
    page.__promptAnswers = ['跳转需求'];
    await page.setInputFiles('#tempExecInput', [execFile]);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });
    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/closing/);
    await openAssignDrawer(page);

    const jumpInfo = await page.evaluate(() => {
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      const fileId = window.app && window.app.state ? window.app.state.tempExecActiveId : '';
      if (!api || !fileId) return { fileId: '', pendingIndex: 0 };
      const file = api.getTempExecFile(fileId);
      if (!file || !Array.isArray(file.cases)) return { fileId: fileId, pendingIndex: 0 };
      file.reuseEnabled = false;
      for (let i = 0; i < 20; i += 1) {
        if (file.cases[i]) file.cases[i].actual = '通过';
      }
      if (api.renderTempExecView) api.renderTempExecView();
      if (api.renderTempExecNav) api.renderTempExecNav();
      if (api.renderTempVersionGrid) api.renderTempVersionGrid();
      if (api.persistTempExecState) api.persistTempExecState();
      var pendingIndex = 0;
      for (let i = 0; i < file.cases.length; i += 1) {
        var raw = file.cases[i] && file.cases[i].actual ? String(file.cases[i].actual).trim() : '未执行';
        if (raw === 'pending') raw = '未执行';
        if (!raw || raw === '未执行') {
          pendingIndex = i;
          break;
        }
      }
      return { fileId: fileId, pendingIndex: pendingIndex };
    });
    expect(jumpInfo.fileId).toBeTruthy();

    await openOverview(page);
    const entry = page.locator('#tempExecOverview .temp-overview-entry', { hasText: 'jumpProgress.json' }).first();
    await expect(entry).toBeVisible();
    await entry.locator('.temp-overview-segment[data-temp-overview-status="pending"]').click({ force: true });

    await expect(page.locator('#tempExecOverviewDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 5000 });
    const navState = await page.evaluate((fid) => {
      const st = window.app && window.app.state ? window.app.state : {};
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      const size = api && api.getTempExecPageSize ? Number(api.getTempExecPageSize()) : 20;
      const pages = st && st.tempExecPages ? st.tempExecPages : {};
      var firstPending = null;
      if (api && api.getTempExecFile) {
        var file = api.getTempExecFile(fid);
        if (file && Array.isArray(file.cases)) {
          for (var i = 0; i < file.cases.length; i += 1) {
            var raw = file.cases[i] && file.cases[i].actual ? String(file.cases[i].actual).trim() : '未执行';
            if (raw === 'pending') raw = '未执行';
            if (!raw || raw === '未执行') {
              firstPending = i;
              break;
            }
          }
        }
      }
      return {
        activeId: st ? st.tempExecActiveId : '',
        pageIndex: fid && pages ? pages[fid] : null,
        pageSize: size,
        firstPending: firstPending,
      };
    }, jumpInfo.fileId);
    expect(navState.activeId).toBe(jumpInfo.fileId);
    expect(navState.firstPending).toBe(jumpInfo.pendingIndex);
    expect(navState.pageIndex).toBe(Math.floor(jumpInfo.pendingIndex / (navState.pageSize || 20)));
    const targetRow = page.locator('#tempExecView tr.case-row[data-index="20"]').first();
    await expect(targetRow).toBeVisible({ timeout: 5000 });
    const top = await targetRow.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThan(40);
  });

  test('个人执行总览点击卡片可关闭抽屉并切换用例', async ({ page }) => {
    await switchToTempExecPage(page);
    await page.locator('#openTempExecImportDrawerBtn').click({ force: true });

    const list = [];
    for (let i = 1; i <= 3; i += 1) {
      list.push({ module: '模块卡片', title: '用例' + i, steps: 'step' + i, expected: 'ok' });
    }
    const execFileA = {
      name: 'jumpCardA.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(list, null, 2)),
    };
    const execFileB = {
      name: 'jumpCardB.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(list, null, 2)),
    };
    page.__promptAnswers = ['卡片需求'];
    page.__promptAnswers.push('卡片需求2');
    await page.setInputFiles('#tempExecInput', [execFileA, execFileB]);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });
    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/closing/);
    await openAssignDrawer(page);

    const ids = await page.evaluate(() => {
      const st = window.app && window.app.state ? window.app.state : {};
      const active = st ? st.tempExecActiveId : '';
      const files = st && Array.isArray(st.tempExecFiles) ? st.tempExecFiles : [];
      const other = files.find((f) => f && f.id && f.id !== active);
      return {
        activeId: active || '',
        otherId: other ? other.id : '',
        otherName: other && other.name ? other.name : '',
      };
    });
    expect(ids.activeId).toBeTruthy();
    expect(ids.otherId).toBeTruthy();
    expect(ids.otherName).toBeTruthy();

    await openOverview(page);

    const entry = page.locator('#tempExecOverview .temp-overview-entry', { hasText: ids.otherName }).first();
    await expect(entry).toBeVisible();
    await entry.locator('.temp-overview-header').click({ force: true });

    await expect(page.locator('#tempExecOverviewDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 5000 });
    const activeAfter = await page.evaluate(() => (window.app && window.app.state ? window.app.state.tempExecActiveId : ''));
    expect(activeAfter).toBe(ids.otherId);
  });
});
