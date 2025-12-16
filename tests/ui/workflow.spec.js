const { test, expect } = require('@playwright/test');

test.describe('工作流关键交互', () => {
  async function openGroup(page, groupName) {
    await page.click('.tab-group-btn[data-group="' + groupName + '"]');
    await expect(page.locator('[data-group-menu="' + groupName + '"]')).toBeVisible();
  }

  async function openAiTab(page, tabName) {
    await openGroup(page, 'ai');
    await page.click('[data-group-menu="ai"] [data-tab-btn="' + tabName + '"]');
  }

  async function openCasesTab(page, tabName) {
    await openGroup(page, 'cases');
    await page.click('[data-group-menu="cases"] [data-tab-btn="' + tabName + '"]');
  }

  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1') ||
        url.startsWith('file:') ||
        url.startsWith('data:') ||
        url.startsWith('blob:') ||
        url.startsWith('about:')
      ) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
      } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => {
      try {
        if (window.app && typeof window.app.init === 'function') window.app.init();
      } catch (e) {}
    });
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });
  });

  test('全页签与顶部步骤可点击', async ({ page }) => {
    await openAiTab(page, 'auto');
    await openAiTab(page, 'clean');
    await openAiTab(page, 'casesgen');
    await openAiTab(page, 'assign');
    await openAiTab(page, 'models');

    await openCasesTab(page, 'tempexec');
    await openCasesTab(page, 'case-library');
    await openCasesTab(page, 'exec-overview');

    await openGroup(page, 'settings');
    await page.click('[data-group-menu="settings"] [data-tab-btn="settings"]');

    await page.click('[data-tab-btn="help"]');
    await openAiTab(page, 'auto');

    const steps = await page.$$('#flowNav .step');
    for (const step of steps) {
      await step.click();
    }
  });

  test('原始需求上传与清空', async ({ page }) => {
    await page.setInputFiles('#fileInput', {
      name: 'demo.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('测试上传内容'),
    });
    await expect(page.locator('#rawText')).toHaveValue('测试上传内容');
    await expect(page.locator('#fileName')).toContainText('demo.txt');
    await expect(page.locator('#parseStatus')).toContainText('读取完成');
    await page.click('#autoRawClear');
    await expect(page.locator('#rawText')).toHaveValue('');
    await expect(page.locator('#fileName')).toContainText('未选择');
  });

  test('功能工作流可导入测试用例文件', async ({ page }) => {
    await openAiTab(page, 'clean');
    await page.setInputFiles('#caseFileInput', {
      name: 'cases.json',
      mimeType: 'application/json',
      buffer: Buffer.from('[{"module":"登录","title":"用例1"}]'),
    });
    await expect(page.locator('#caseFileList')).toContainText('cases.json');
    await expect(page.locator('#caseStatus')).toContainText('已导入');
  });

  test('导入/导出控件默认状态与用例视图按钮可点击', async ({ page }) => {
    const exportCaseGen = page.locator('#exportCaseGen');
    await expect(exportCaseGen).toBeDisabled();
    const exportTempExecCfg = page.locator('#exportTempExecConfigBtn');
    await expect(exportTempExecCfg).toHaveCount(1);
    await expect(exportTempExecCfg).toBeHidden();
    const importTempExecCfg = page.locator('#importTempExecConfigBtn');
    await expect(importTempExecCfg).toHaveCount(1);
    await expect(importTempExecCfg).toBeHidden();
    const caseViewBtn = page.locator('#caseViewBtn');
    if (await caseViewBtn.isVisible()) {
      await caseViewBtn.click();
      const closeBtn = page.locator('#closeCaseViewDrawerBtn');
      if (await closeBtn.isVisible()) await closeBtn.click();
    }
  });

  test('用例执行拖拽占位可响应', async ({ page }) => {
    await openCasesTab(page, 'tempexec');
    await page.click('#openTempExecDrawerBtn');
    const dropZone = page.locator('#tempExecDropZone');
    const data = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'dummy');
      return dt;
    });
    await dropZone.dispatchEvent('dragenter', { dataTransfer: data });
    await dropZone.dispatchEvent('dragover', { dataTransfer: data });
    await dropZone.dispatchEvent('drop', { dataTransfer: data });
    await expect(dropZone).toBeVisible();
    await page.click('#closeTempExecDrawerBtn');
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
  });

  test('自动流程缺失视图与按钮默认状态', async ({ page }) => {
    const autoTab = page.locator('[data-tab-btn="auto"]');
    await expect(autoTab).toHaveClass(/active/);
    const toggle = page.locator('#autoMissingToggle');
    const copy = page.locator('#autoMissingCopy');
    const smart = page.locator('#autoMissingSmartFill');
    const view = page.locator('#autoMissingView');
    const autoBtn = page.locator('#runAutoWorkflow');
    const recleanBtn = page.locator('#autoRecleanBtn');
    await expect(toggle).toBeDisabled();
    await expect(copy).toBeDisabled();
    await expect(smart).toBeDisabled();
    await expect(view).toHaveClass(/hidden/);
    await expect(autoBtn).toBeEnabled();
    await expect(recleanBtn).toBeDisabled();
  });

  test('步骤状态显示待执行/执行中/完成图标', async ({ page }) => {
    const getStatusMap = async () => {
      return page.evaluate(() => {
        const result = {};
        document.querySelectorAll('#flowNav .step').forEach((step) => {
          const key = step.dataset ? step.dataset.target : '';
          const text = (step.querySelector('.step-status') || {}).textContent || '';
          if (key) result[key] = text.trim();
        });
        return result;
      });
    };

    const initial = await getStatusMap();
    expect(initial.import).toBe('▶');
    expect(initial.compare).toBe('▶');

    await page.evaluate(() => {
      const raw = document.getElementById('rawText');
      if (raw) {
        raw.value = '原始需求内容';
        raw.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (window.app && window.app.state) {
        window.app.state.inProgressSteps = { clean: true };
        window.app.state.inProgressStep = '';
      }
      if (raw) {
        raw.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const updated = await getStatusMap();
    expect(updated.import).toBe('✓');
    expect(updated.clean).toBe('↻');
    expect(updated.compare).toBe('▶');
    expect(updated.split).toBe('▶');
  });

  test('执行中步骤使用描边高亮而非全蓝填充', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && window.app.state) {
        window.app.state.inProgressSteps = { review: true };
        window.app.state.inProgressStep = '';
      }
      var raw = document.getElementById('rawText');
      if (raw) {
        raw.value = '原始需求内容';
        raw.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (window.app && window.app.flow && typeof window.app.flow.updateFlowStatus === 'function') {
        window.app.flow.updateFlowStatus();
      }
    });
    const activeStep = page.locator('#flowNav .step.active');
    const activeCount = await activeStep.count();
    expect(activeCount).toBeGreaterThan(0);
    const styles = await page.locator('#flowNav .step[data-target="review"]').evaluate((node) => {
      var computed = window.getComputedStyle(node);
      var status = node.querySelector('.step-status');
      return {
        backgroundColor: computed.backgroundColor,
        boxShadow: computed.boxShadow,
        borderColor: computed.borderColor,
        textColor: computed.color,
        statusData: status ? status.getAttribute('data-status') : '',
        statusInline: status ? status.getAttribute('style') || '' : '',
      };
    });
    expect(styles.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(styles.borderColor).toContain('37, 99, 235');
    expect(styles.boxShadow).toContain('37, 99, 235');
    expect(styles.textColor).toContain('29, 78, 216');
    expect(styles.statusData).toBe('running');
    expect(styles.statusInline).toContain('border-width: 2px');
    expect(styles.statusInline).toContain('rgb(37, 99, 235)');
    expect(styles.statusInline).toContain('background: rgb(255, 255, 255)');
  });

  test('需求澄清确认有提示', async ({ page }) => {
    await openAiTab(page, 'clean');
    await page.evaluate(() => {
      const review = document.getElementById('reviewResult');
      if (review) {
        review.removeAttribute('readonly');
        review.value = JSON.stringify([{ '不明确的需求点': '接口定义不清' }], null, 2);
      }
      if (window.app && window.app.state) {
        window.app.state.reviewClarifications = new Map([[0, '已与产品确认']]);
        window.app.state.reviewRows = [{
          index: 0,
          source: { '不明确的需求点': '接口定义不清' },
          category: '',
          point: '接口定义不清',
          reason: '',
          branch: '',
          clarification: '',
        }];
      }
      const toggle = document.getElementById('toggleReviewView');
      if (toggle) toggle.disabled = false;
      const confirmBtn = document.getElementById('confirmClarifications');
      if (confirmBtn) confirmBtn.disabled = false;
    });
    await page.click('#toggleReviewView');
    await page.click('#confirmClarifications');
    const drawer = page.locator('#reviewViewDrawer');
    await expect(drawer).toHaveClass(/drawer/);
    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('#clarifyStatus')).toContainText('澄清结果已写入评审 JSON');
  });

  test('自动流程覆盖率不足时按钮可用', async ({ page }) => {
    await page.evaluate(() => {
      const payload = { coverage: 80, missing: ['缺少需求点'] };
      const compareEl = document.getElementById('compareResult');
      if (compareEl) compareEl.value = JSON.stringify(payload);
      if (window.app && window.app.state) {
        window.app.state.autoCompareSelections = new Set();
        window.app.state.autoCompareMissingList = [];
      }
    });
    await openAiTab(page, 'clean');
    await openAiTab(page, 'auto');
    const recleanBtn = page.locator('#autoRecleanBtn');
    const ignoreBtn = page.locator('#autoIgnoreCoverageBtn');
    await expect(recleanBtn).toBeEnabled();
    await expect(ignoreBtn).toBeEnabled();
  });
});
