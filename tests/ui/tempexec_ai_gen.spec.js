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

async function startTempExecAiGeneration(page, requirementText) {
  const overlay = page.locator('#casePageAiGenPrepOverlay-temp-exec');
  await page.click('#tempExecAiGenBtn');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('生成前置准备');
  const documentMode = overlay.locator('input[name="casePageRequirementMode-temp-exec"][value="document"]');
  const manualMode = overlay.locator('input[name="casePageRequirementMode-temp-exec"][value="manual"]');
  await expect(documentMode).toHaveCount(1);
  await documentMode.check({ force: true });
  await expect(overlay.locator('[data-case-page-prep-action="select-requirement"]')).toHaveCount(1);
  await manualMode.check({ force: true });
  await page.fill('#casePageAiGenRequirementText-temp-exec', requirementText);
  await overlay.locator('[data-case-page-prep-nav="next"]').click();
  await expect(overlay).toContainText('导入已有用例');
  await expect(overlay).toContainText('已锁定');
  await expect(overlay).toContainText('用例数');
  await overlay.locator('[data-case-page-prep-nav="next"]').click();
  await expect(overlay).toContainText('生成选项');
  await overlay.locator('[data-case-page-prep-nav="confirm"]').click();
  await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
  await expect(page.locator('#tempExecAiGenDrawer .case-library-ai-gen-section').filter({ hasText: '需求导入' })).toBeHidden();
}

function isSemanticDedupeRequest(body) {
  const requestBody = body && body.payload ? body.payload : body;
  if (!requestBody || !requestBody.messages || !requestBody.messages[1]) return false;
  const payload = JSON.parse(requestBody.messages[1].content);
  return payload
    && payload.operation_contract
    && payload.operation_contract.editable_scope === 'generated_cases_only';
}

async function fulfillTempExecSemanticDedupe(route, body) {
  const requestBody = body && body.payload ? body.payload : body;
  const requestPayload = JSON.parse(requestBody.messages[1].content);
  expect(requestPayload.operation_contract.original_cases_readonly).toBe(true);
  expect(requestPayload.operation_contract.generated_cases_editable).toBe(true);
  expect(requestPayload.original_cases_readonly.length).toBeGreaterThan(0);
  const generated = requestPayload.generated_cases_editable || [];
  const seen = new Set();
  const payload = {
    generated_modules: generated.map((mod) => {
      const kept = [];
      (mod.cases || []).forEach((item) => {
        if (item.title === '登录成功') return;
        const key = [item.module, item.title, item.precondition || item.preconditions || '', item.steps, item.expected].join('::');
        if (seen.has(key)) return;
        seen.add(key);
        kept.push(item);
      });
      return {
        module: mod.module,
        coverage: mod.coverage,
        missing: mod.missing,
        cases: kept,
      };
    }).filter((mod) => mod.cases.length),
    removed_cases: [{
      type: 'duplicate_with_original',
      module: '登录',
      title: '登录成功',
      reason: '与原用例重复',
      duplicate_with: '登录成功',
    }],
    summary: { removed: 1, reason: '语义重复' },
  };
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
  });
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

    let semanticDedupeCalls = 0;
    await page.route('**/mock-temp-exec-ai-append', async (route) => {
      const body = route.request().postDataJSON();
      if (isSemanticDedupeRequest(body)) {
        semanticDedupeCalls += 1;
        const requestBody = body && body.payload ? body.payload : body;
        const requestPayload = JSON.parse(requestBody.messages[1].content);
        const generatedTitles = [];
        (requestPayload.generated_cases_editable || []).forEach((mod) => {
          (mod.cases || []).forEach((item) => generatedTitles.push(item.title));
        });
        expect(generatedTitles.filter((title) => title === '支付失败-余额不足')).toHaveLength(2);
        expect(generatedTitles.filter((title) => title === '登录成功')).toHaveLength(1);
        return fulfillTempExecSemanticDedupe(route, body);
      }
      const userPayload = JSON.parse(body.messages[1].content);
      expect(userPayload.locked_imported_cases.mode).toBe('import');
      expect(userPayload.locked_imported_cases.readonly).toBe(true);
      expect(userPayload.locked_imported_cases.case_count).toBe(1);
      expect(userPayload.dedupe_contract.original_cases_readonly).toBe(true);
      expect(userPayload.dedupe_contract.generated_cases_editable).toBe(true);
      expect(body.messages[0].content).toContain('AI_CASE_WRITING_STYLE_GUIDE.md');
      expect(body.messages[0].content).toContain('去重保护规则');
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
          }, {
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
          }, {
            module: '登录',
            title: '登录成功',
            priority: 'P1',
            precondition: '',
            steps: '输入正确账号密码',
            expected: '登录成功',
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

    await startTempExecAiGeneration(page, '需求：支持登录与支付');
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('生成完成');
    await expect(page.locator('#tempExecAiGenResult')).toBeVisible();
    await expect(page.locator('#tempExecAiGenResultBody td').getByText('支付失败-余额不足', { exact: true })).toHaveCount(1);
    await expect(page.locator('#tempExecAiGenResultBody td').getByText('登录成功', { exact: true })).toHaveCount(0);
    expect(semanticDedupeCalls).toBe(1);

    await page.click('#tempExecAiGenDrawer .drawer-header [data-drawer-close="tempExecAiGenDrawer"]');
    await expect(page.locator('#tempExecAiGenDrawer')).not.toHaveClass(/open/);
    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('生成完成');
    expect(semanticDedupeCalls).toBe(1);

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
    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('生成完成');
    await expect(page.locator('#tempExecAiGenResultBody td').getByText('支付失败-余额不足', { exact: true })).toHaveCount(1);
    expect(semanticDedupeCalls).toBe(1);

    await page.click('#tempExecAiGenDiscardBtn');
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('已清空本次 AI 生成结果');
    await expect(page.locator('#tempExecAiGenResult')).toBeHidden();
    await expect(page.locator('#tempExecAiGenDrawer')).not.toHaveClass(/open|closing/);
    await expect(page.locator('.temp-center-toast')).toContainText('已清空本次 AI 生成结果');

    await page.click('#tempExecAiGenBtn');
    await expect(page.locator('#casePageAiGenPrepOverlay-temp-exec')).toBeVisible();
    await page.click('#casePageAiGenPrepOverlay-temp-exec [data-case-page-prep-close]');
    await expect(page.locator('#casePageAiGenPrepOverlay-temp-exec')).toHaveCount(0);

    await startTempExecAiGeneration(page, '需求：支持登录与支付');
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('生成完成');
    await expect(page.locator('#tempExecAiGenResultBody td').getByText('支付失败-余额不足', { exact: true })).toHaveCount(1);
    expect(semanticDedupeCalls).toBe(2);

    await page.click('#tempExecAiGenRegenerateBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('丢弃当前这批 AI 生成结果');
    await page.click('#appConfirmDrawerCancelBtn');
    await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#casePageAiGenPrepOverlay-temp-exec')).toHaveCount(0);
    await expect(page.locator('#tempExecAiGenDrawer')).toHaveClass(/open/);
    await page.click('#tempExecAiGenRegenerateBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('#casePageAiGenPrepOverlay-temp-exec')).toBeVisible();
    await page.click('#casePageAiGenPrepOverlay-temp-exec [data-case-page-prep-close]');
    await expect(page.locator('#casePageAiGenPrepOverlay-temp-exec')).toHaveCount(0);

    await startTempExecAiGeneration(page, '需求：支持登录与支付');
    await expect(page.locator('#tempExecAiGenStatus')).toContainText('生成完成');
    await expect(page.locator('#tempExecAiGenResultBody td').getByText('支付失败-余额不足', { exact: true })).toHaveCount(1);
    expect(semanticDedupeCalls).toBe(3);

    await page.click('#tempExecAiGenSelectAllBtn');
    await expect(page.locator('#tempExecAiGenAppendBtn')).toBeEnabled();
    await page.click('#tempExecAiGenAppendBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('确定追加');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('.temp-center-toast')).toContainText('追加 2条 用例成功！');
    await expect(page.locator('#tempExecAiGenResultBody td.ai-gen-appended-cell', { hasText: '支付失败-余额不足' })).toBeVisible();
    await expect(page.locator('#tempExecAiGenResultBody td.ai-gen-appended-cell', { hasText: '登录失败-密码错误' })).toBeVisible();
    await expect(page.locator('#tempExecAiGenResultBody td').getByText('支付失败-余额不足', { exact: true }).locator('..').locator('input[data-temp-exec-ai-select]')).toBeDisabled();
    await expect(page.locator('#tempExecAiGenResultBody td').getByText('登录失败-密码错误', { exact: true }).locator('..').locator('input[data-temp-exec-ai-select]')).toBeDisabled();
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
      const body = route.request().postDataJSON();
      if (isSemanticDedupeRequest(body)) {
        return fulfillTempExecSemanticDedupe(route, body);
      }
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

    await startTempExecAiGeneration(page, '需求：支持登录与支付');
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

    await startTempExecAiGeneration(page, '需求：支付流程');
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
      const body = route.request().postDataJSON();
      if (isSemanticDedupeRequest(body)) {
        return fulfillTempExecSemanticDedupe(route, body);
      }
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

    await startTempExecAiGeneration(page, '需求：登录流程');

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
      const body = route.request().postDataJSON();
      if (isSemanticDedupeRequest(body)) {
        return fulfillTempExecSemanticDedupe(route, body);
      }
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

    await startTempExecAiGeneration(page, '需求：支付流程');
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
