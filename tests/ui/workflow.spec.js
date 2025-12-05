const { test, expect } = require('@playwright/test');

test.describe('工作流关键交互', () => {
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

  test('全页签与顶部步骤可点击', async ({ page }) => {
    const tabs = await page.$$('[data-tab-btn]');
    for (const tab of tabs) {
      await tab.click();
    }
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
    await page.click('[data-tab-btn="clean"]');
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
    await expect(exportTempExecCfg).toBeDisabled();
    const importTempExecCfg = page.locator('#importTempExecConfigBtn');
    await expect(importTempExecCfg).toHaveCount(1);
    const caseViewBtn = page.locator('#caseViewBtn');
    if (await caseViewBtn.isVisible()) {
      await caseViewBtn.click();
    }
  });

  test('用例执行拖拽占位可响应', async ({ page }) => {
    await page.click('[data-tab-btn="tempexec"]');
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
    await page.click('#tempExecDrawer .drawer-mask');
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
    expect(initial.import).toBe('•');

    await page.evaluate(() => {
      const raw = document.getElementById('rawText');
      if (raw) {
        raw.value = '原始需求内容';
        raw.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (window.app && window.app.state) {
        window.app.state.inProgressStep = 'clean';
      }
      if (raw) {
        raw.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const updated = await getStatusMap();
    expect(updated.import).toBe('✓');
    expect(updated.clean).toBe('↻');
    expect(updated.split).toBe('•');
  });

  test('需求澄清确认有提示', async ({ page }) => {
    await page.click('[data-tab-btn="clean"]');
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
    await page.click('#confirmClarifications');
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
    await page.click('[data-tab-btn="clean"]');
    await page.click('[data-tab-btn="auto"]');
    const recleanBtn = page.locator('#autoRecleanBtn');
    const ignoreBtn = page.locator('#autoIgnoreCoverageBtn');
    await expect(recleanBtn).toBeEnabled();
    await expect(ignoreBtn).toBeEnabled();
  });
});
