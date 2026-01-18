const { test, expect } = require('@playwright/test');

async function gotoExec(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/case-exec.html');
  return base;
}

async function waitTempExecReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await page.waitForFunction(() => window.app && window.app.tempExecApi);
}

test.describe('执行页 AI 用例生成', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('未配置模型时点击提示配置入口', async ({ page }) => {
    const fileId = 'temp-file-ai-1';
    const payload = {
      files: [{
        id: fileId,
        name: '用例A',
        requirement: '需求A',
        cases: [{
          module: '登录',
          title: '登录成功',
          priority: 'P1',
          preconditions: '',
          steps: '输入正确账号密码',
          expected: '登录成功',
          actual: '未执行',
          remark: '',
        }],
      }],
      versions: [],
      activeId: fileId,
    };

    await page.addInitScript((data) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(data.payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', '[]'); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', '{}'); } catch (_) {}
    }, { payload });

    await gotoExec(page);
    await waitTempExecReady(page);
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);
    await page.waitForFunction(() => {
      const card = document.getElementById('tempExecToolbarCard');
      return card && !card.classList.contains('hidden');
    });

    await expect(page.locator('#tempExecAiGenBtn')).toBeVisible();
    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('.temp-center-toast')).toContainText('请到AI功能-功能指派 页面下，配置该功能模型。');
    await expect(page.locator('#tempExecAiGenDrawer')).not.toHaveClass(/open/);
  });

  test('追加生成用例后显示成功提示', async ({ page }) => {
    const fileId = 'temp-file-ai-append';
    const payload = {
      files: [{
        id: fileId,
        name: '用例追加',
        requirement: '需求追加',
        cases: [{
          module: '登录',
          title: '登录成功',
          priority: 'P1',
          preconditions: '',
          steps: '输入正确账号密码',
          expected: '登录成功',
          actual: '未执行',
          remark: '',
        }],
      }],
      versions: [],
      activeId: fileId,
    };
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const modelId = 'temp-exec-ai-append-model';
    const modelBaseUrl = base + '/mock-temp-exec-ai-append';

    await page.addInitScript((data) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(data.payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', JSON.stringify(data.models)); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', JSON.stringify(data.assignments)); } catch (_) {}
    }, {
      payload,
      models: [{
        id: modelId,
        name: '执行追加模型',
        provider: 'custom',
        baseUrl: modelBaseUrl,
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 512,
      }],
      assignments: { caseLibraryGenId: modelId },
    });

    await page.route('**/mock-temp-exec-ai-append', async (route) => {
      const payload = {
        missing_modules: [{
          module: '支付',
          coverage: 0,
          cases: [{
            module: '支付',
            title: '支付失败-余额不足',
            priority: 'P1',
            precondition: '',
            steps: '余额不足时提交支付',
            expected: '提示余额不足',
            remark: '',
          }],
        }],
        existing_modules: [{
          module: '登录',
          coverage: 60,
          cases: [{
            module: '登录',
            title: '登录失败-密码错误',
            priority: 'P1',
            precondition: '',
            steps: '输入错误密码',
            expected: '提示密码错误',
            remark: '',
          }],
        }],
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
      });
    });

    await gotoExec(page);
    await waitTempExecReady(page);
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);
    await page.waitForFunction(() => {
      const card = document.getElementById('tempExecToolbarCard');
      return card && !card.classList.contains('hidden');
    });
    await page.waitForFunction(() => {
      const btn = document.getElementById('tempExecAiGenBtn');
      return btn && !btn.disabled;
    });

    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
    await page.fill('#tempExecAiGenRequirementInput', '需求：支持登录与支付');
    await page.click('#tempExecAiGenRunBtn');
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('生成完成');
    await expect(page.locator('#tempExecAiGenResult')).toBeVisible();

    await page.click('#tempExecAiGenSelectAllBtn');
    await expect(page.locator('#tempExecAiGenAppendBtn')).toBeEnabled();
    await page.click('#tempExecAiGenAppendBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('确定追加');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('.temp-center-toast')).toContainText('追加 2条 用例成功！');
    await expect(page.locator('#tempExecView')).toContainText('支付失败-余额不足');
    await expect(page.locator('#tempExecView')).toContainText('登录失败-密码错误');
  });

  test('生成完成后红点同步专注区/执行分配入口', async ({ page }) => {
    const fileA = 'temp-file-ai-a';
    const fileB = 'temp-file-ai-b';
    const versionId = 'temp-version-ai-1';
    const payload = {
      files: [{
        id: fileA,
        name: '用例A',
        requirement: '需求A',
        cases: [{
          module: '登录',
          title: '登录成功',
          priority: 'P1',
          preconditions: '',
          steps: '输入正确账号密码',
          expected: '登录成功',
          actual: '未执行',
          remark: '',
        }],
      }, {
        id: fileB,
        name: '用例B',
        requirement: '需求B',
        cases: [{
          module: '支付',
          title: '支付成功',
          priority: 'P1',
          preconditions: '',
          steps: '选择商品并完成支付',
          expected: '支付成功并提示结果',
          actual: '未执行',
          remark: '',
        }],
      }],
      versions: [{
        id: versionId,
        name: '版本1',
        fileIds: [fileB],
      }],
      activeId: fileA,
    };
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const modelId = 'temp-exec-ai-model';
    const modelBaseUrl = base + '/mock-temp-exec-ai';

    await page.addInitScript((data) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(data.payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([data.fileA])); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', JSON.stringify(data.models)); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', JSON.stringify(data.assignments)); } catch (_) {}
    }, {
      payload,
      fileA,
      models: [{
        id: modelId,
        name: '执行生成模型',
        provider: 'custom',
        baseUrl: modelBaseUrl,
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 512,
      }],
      assignments: { caseLibraryGenId: modelId },
    });

    await page.route('**/mock-temp-exec-ai', async (route) => {
      const payload = {
        missing_modules: [{
          module: '支付',
          coverage: 0,
          cases: [{
            module: '支付',
            title: '支付失败-余额不足',
            priority: 'P1',
            precondition: '',
            steps: '余额不足时提交支付',
            expected: '提示余额不足',
            remark: '',
          }],
        }],
        existing_modules: [{
          module: '登录',
          coverage: 60,
          cases: [{
            module: '登录',
            title: '登录失败-密码错误',
            priority: 'P1',
            precondition: '',
            steps: '输入错误密码',
            expected: '提示密码错误',
            remark: '',
          }],
        }],
      };
      await new Promise((resolve) => setTimeout(resolve, 400));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
      });
    });

    await gotoExec(page);
    await waitTempExecReady(page);

    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileA);
    await page.waitForFunction(() => {
      const card = document.getElementById('tempExecToolbarCard');
      return card && !card.classList.contains('hidden');
    });
    await page.waitForFunction(() => {
      const btn = document.getElementById('tempExecAiGenBtn');
      return btn && !btn.disabled;
    });

    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
    await page.fill('#tempExecAiGenRequirementInput', '需求：支持登录与支付');
    await page.click('#tempExecAiGenRunBtn');
    await expect(page.locator('#tempExecAiGenBtn')).toContainText('正在生成');
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileB);
    await page.click('#tempExecAiGenDrawer .drawer-header [data-drawer-close="tempExecAiGenDrawer"]');
    await expect(page.locator('#tempExecAiGenDrawer')).not.toHaveClass(/open/);

    const focusBtn = page.locator(`#tempExecViewFocusBlock [data-temp-file="${fileA}"]`);
    await expect(focusBtn).toHaveClass(/case-library-ai-gen-dot/);
    await expect(page.locator('#openTempExecAssignDrawerBtn')).not.toHaveClass(/case-library-ai-gen-dot/);

    await focusBtn.click();
    await expect(focusBtn).not.toHaveClass(/case-library-ai-gen-dot/);

    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileB);
    await page.waitForFunction((nextId) => {
      return window.app && window.app.state && String(window.app.state.tempExecActiveId || '') === String(nextId || '');
    }, fileB);

    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
    await page.fill('#tempExecAiGenRequirementInput', '需求：支付流程');
    await page.click('#tempExecAiGenRunBtn');
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('生成完成');
    await expect(page.locator('#tempExecAiGenBtn')).toHaveClass(/has-badge/);
    await page.click('#tempExecAiGenDrawer .drawer-header [data-drawer-close="tempExecAiGenDrawer"]');

    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileA);
    await page.waitForFunction((nextId) => {
      return window.app && window.app.state && String(window.app.state.tempExecActiveId || '') === String(nextId || '');
    }, fileA);

    await expect(page.locator('#openTempExecAssignDrawerBtn')).toHaveClass(/case-library-ai-gen-dot/);
    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
    await expect(page.locator('#openTempExecAssignDrawerBtn')).not.toHaveClass(/case-library-ai-gen-dot/);

    const versionRow = page.locator(`#tempVersionGrid button[data-temp-file="${fileB}"]`);
    await expect(versionRow).toHaveClass(/case-library-ai-gen-dot/);
    await versionRow.click();
    await expect(versionRow).not.toHaveClass(/case-library-ai-gen-dot/);

    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#tempExecAiGenBtn')).not.toHaveClass(/has-badge/);
  });

  test('切换页面后仍能持续生成', async ({ page }) => {
    const fileId = 'temp-file-ai-global';
    const payload = {
      files: [{
        id: fileId,
        name: '用例全局',
        requirement: '需求全局',
        cases: [{
          module: '登录',
          title: '登录成功',
          priority: 'P1',
          preconditions: '',
          steps: '输入正确账号密码',
          expected: '登录成功',
          actual: '未执行',
          remark: '',
        }],
      }],
      versions: [],
      activeId: fileId,
    };
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const modelId = 'temp-exec-ai-global-model';
    const modelBaseUrl = base + '/mock-temp-exec-ai-global';

    await page.addInitScript((data) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(data.payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', JSON.stringify(data.models)); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', JSON.stringify(data.assignments)); } catch (_) {}
    }, {
      payload,
      models: [{
        id: modelId,
        name: '执行生成模型-全局',
        provider: 'custom',
        baseUrl: modelBaseUrl,
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 512,
      }],
      assignments: { caseLibraryGenId: modelId },
    });

    await page.route('**/mock-temp-exec-ai-global', async (route) => {
      const payload = {
        missing_modules: [],
        existing_modules: [{
          module: '登录',
          coverage: 60,
          cases: [{
            module: '登录',
            title: '登录失败-密码错误',
            priority: 'P1',
            precondition: '',
            steps: '输入错误密码',
            expected: '提示密码错误',
            remark: '',
          }],
        }],
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
      });
    });

    await gotoExec(page);
    await waitTempExecReady(page);
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);
    await page.waitForFunction(() => {
      const card = document.getElementById('tempExecToolbarCard');
      return card && !card.classList.contains('hidden');
    });
    await page.waitForFunction(() => {
      const btn = document.getElementById('tempExecAiGenBtn');
      return btn && !btn.classList.contains('is-disabled');
    });
    await page.waitForFunction(() => {
      return window.app && window.app.core && typeof window.app.core.callModelWithConfig === 'function';
    });

    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
    await page.fill('#tempExecAiGenRequirementInput', '需求：登录流程');
    await page.click('#tempExecAiGenRunBtn');

    await page.goto(base + '/case-library.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('tap-case-library-ai-gen-task:temp-exec');
      if (!raw) return false;
      try {
        const task = JSON.parse(raw);
        return task && task.status === 'done';
      } catch (_) {
        return false;
      }
    });

    await page.goto(base + '/case-exec.html');
    await waitTempExecReady(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);
    await page.waitForFunction(() => {
      const card = document.getElementById('tempExecToolbarCard');
      return card && !card.classList.contains('hidden');
    });
    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('生成完成');
  });

  test('刷新后按钮保持生成中状态', async ({ page }) => {
    const fileId = 'temp-file-ai-refresh';
    const payload = {
      files: [{
        id: fileId,
        name: '用例刷新',
        requirement: '需求刷新',
        cases: [{
          module: '支付',
          title: '支付成功',
          priority: 'P1',
          preconditions: '',
          steps: '完成支付',
          expected: '支付成功',
          actual: '未执行',
          remark: '',
        }],
      }],
      versions: [],
      activeId: fileId,
    };
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const modelId = 'temp-exec-ai-refresh-model';
    const modelBaseUrl = base + '/mock-temp-exec-ai-refresh';
    let callCount = 0;

    await page.addInitScript((data) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(data.payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', JSON.stringify(data.models)); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', JSON.stringify(data.assignments)); } catch (_) {}
    }, {
      payload,
      models: [{
        id: modelId,
        name: '执行生成模型-刷新',
        provider: 'custom',
        baseUrl: modelBaseUrl,
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 512,
      }],
      assignments: { caseLibraryGenId: modelId },
    });

    await page.route('**/mock-temp-exec-ai-refresh', async (route) => {
      callCount += 1;
      await new Promise((resolve) => setTimeout(resolve, callCount === 1 ? 2000 : 500));
      const payload = {
        missing_modules: [],
        existing_modules: [{
          module: '支付',
          coverage: 60,
          cases: [{
            module: '支付',
            title: '支付失败-余额不足',
            priority: 'P1',
            precondition: '',
            steps: '余额不足时提交支付',
            expected: '提示余额不足',
            remark: '',
          }],
        }],
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
      });
    });

    await gotoExec(page);
    await waitTempExecReady(page);
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);
    await page.waitForFunction(() => {
      const card = document.getElementById('tempExecToolbarCard');
      return card && !card.classList.contains('hidden');
    });

    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
    await page.fill('#tempExecAiGenRequirementInput', '需求：支付流程');
    await page.click('#tempExecAiGenRunBtn');
    await expect(page.locator('#tempExecAiGenBtn')).toContainText('正在生成');

    await page.reload();
    await waitTempExecReady(page);
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);
    await page.waitForFunction(() => {
      const card = document.getElementById('tempExecToolbarCard');
      return card && !card.classList.contains('hidden');
    });
    await expect(page.locator('#tempExecAiGenBtn')).toContainText('正在生成');
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('生成完成');
  });
});
