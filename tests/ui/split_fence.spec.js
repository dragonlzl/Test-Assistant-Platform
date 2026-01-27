const { test, expect } = require('@playwright/test');

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
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
});

test('拆分结果含代码块也能解析', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');

  const fencedSplit = [
    '```json',
    '[{"module":"模块A","key_scenarios":["场景1"],"test_points":["点1"]}]',
    '```',
  ].join('\n');
  await page.evaluate((value) => {
    var el = document.getElementById('splitResult');
    if (el) {
      el.removeAttribute('readonly');
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, fencedSplit);
  const parsed = await page.evaluate(() => {
    const splitCoreInit = window.app && window.app.splitCore && window.app.splitCore.init;
    const utils = window.app && window.app.utils;
    if (!splitCoreInit || !utils || typeof utils.stripCodeFence !== 'function') return [];
    const reqCore = window.app && window.app.requirementCore && typeof window.app.requirementCore.init === 'function'
      ? window.app.requirementCore.init({ state: window.app.state || {}, utils: { stripCodeFence: utils.stripCodeFence } })
      : null;
    const unwrap = reqCore && typeof reqCore.unwrapRequirementPayload === 'function'
      ? reqCore.unwrapRequirementPayload
      : function(text) { return { payload: text }; };
    const normalizeRequirementName = reqCore && typeof reqCore.normalizeRequirementName === 'function'
      ? reqCore.normalizeRequirementName
      : function(text) { return text || ''; };
    const splitCore = splitCoreInit({
      moduleFieldAliases: window.app && window.app.config && window.app.config.moduleFieldAliases ? window.app.config.moduleFieldAliases : {},
      normalizeRequirementName: normalizeRequirementName,
      unwrapRequirementPayload: unwrap,
      stripCodeFence: utils.stripCodeFence,
      repairLooseNewlines: utils.repairLooseNewlines,
      extractJsonPayload: utils.extractJsonPayload,
   });
    if (!splitCore || typeof splitCore.parseSplitModules !== 'function') return [];
    var splitEl = document.getElementById('splitResult');
    var text = splitEl ? (splitEl.value || '') : '';
    return splitCore.parseSplitModules(text);
  });
  expect(Array.isArray(parsed)).toBeTruthy();
  expect(parsed.length).toBe(1);
  expect(parsed[0].title).toBe('模块A');
});

test('拆分结果含 #NODE 与单引号代码块时覆盖对比可正常预检', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const quotedSplit = [
    '#NODE:SPLIT',
    "'''json",
    '[{"module":"模块B","key_scenarios":["场景B"]}]',
    "'''",
  ].join('\n');

  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');
  await page.evaluate((value) => {
    var el = document.getElementById('splitResult');
    if (el) {
      el.removeAttribute('readonly');
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, quotedSplit);

  await page.fill('#caseText', '[{"module":"模块B","title":"用例1"}]');
  await page.click('#casesCompareBtn', { force: true });

  const status = page.locator('#casesCoverageStatus');
  await expect(status).toContainText('未找到覆盖对比模型', { timeout: 5000 });
  await expect(status).not.toContainText('拆分结果解析失败');
});

test('拆分结果重复拼接可解析首段', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');

  const duplicated = [
    '{n "模块A":[{"test_points":["点1"]}]n}',
    '{n "模块B":[{"test_points":["点2"]}]n}',
  ].join('');
  await page.evaluate((value) => {
    var el = document.getElementById('splitResult');
    if (el) {
      el.removeAttribute('readonly');
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, duplicated);

  const parsed = await page.evaluate(() => {
    const splitCoreInit = window.app && window.app.splitCore && window.app.splitCore.init;
    const utils = window.app && window.app.utils;
    if (!splitCoreInit || !utils) return [];
    const reqCore = window.app && window.app.requirementCore && typeof window.app.requirementCore.init === 'function'
      ? window.app.requirementCore.init({ state: window.app.state || {}, utils: { stripCodeFence: utils.stripCodeFence } })
      : null;
    const unwrap = reqCore && typeof reqCore.unwrapRequirementPayload === 'function'
      ? reqCore.unwrapRequirementPayload
      : function(text) { return { payload: text }; };
    const normalizeRequirementName = reqCore && typeof reqCore.normalizeRequirementName === 'function'
      ? reqCore.normalizeRequirementName
      : function(text) { return text || ''; };
    const splitCore = splitCoreInit({
      moduleFieldAliases: window.app && window.app.config && window.app.config.moduleFieldAliases ? window.app.config.moduleFieldAliases : {},
      normalizeRequirementName: normalizeRequirementName,
      unwrapRequirementPayload: unwrap,
      stripCodeFence: utils.stripCodeFence,
      repairLooseNewlines: utils.repairLooseNewlines,
      extractJsonPayload: utils.extractJsonPayload,
    });
    if (!splitCore || typeof splitCore.parseSplitModules !== 'function') return [];
    var splitEl = document.getElementById('splitResult');
    return splitCore.parseSplitModules(splitEl ? splitEl.value || '' : '');
  });

  expect(Array.isArray(parsed)).toBeTruthy();
  expect(parsed.length).toBeGreaterThan(0);
});
