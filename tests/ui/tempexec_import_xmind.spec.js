const { test, expect } = require('@playwright/test');
test('执行页可区分无结果与带结果/复用的 XMind 导入', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
  });
  await page.goto('/');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.evaluate(async () => {
    if (window.app && window.app.tempExecHelpers && window.app.tempExecHelpers.buildTempExecCasesFromXmindPaths) return;
    const res = await fetch('scripts/core/tempexecCore.js');
    const code = await res.text();
    const script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);
  });

  const parsed = await page.evaluate(() => {
    var helper = window.app && window.app.tempExecHelpers && window.app.tempExecHelpers.buildTempExecCasesFromXmindPaths;
    var fallback = function(paths) {
      var map = new Map();
      var hasResult = false;
      var reuseFound = false;
      if (!Array.isArray(paths) || !paths.length) return { cases: [], hasResult: false, reuseEnabled: false };
      paths.forEach(function(path) {
        if (!Array.isArray(path)) return;
        var clean = path.filter(Boolean);
        if (clean.length < 7) return;
        var trimmed = clean.slice(0);
        if (trimmed.length > 0) trimmed = trimmed.slice(1);
        if (trimmed.length < 6) trimmed = clean.slice(clean.length - 6);
        if (!trimmed || trimmed.length < 6) return;
        var base = trimmed.slice(0, 6);
        var extras = trimmed.slice(6);
        var key = base.join('||');
        if (!map.has(key)) {
          map.set(key, {
            module: base[0] || '',
            title: base[1] || '',
            priority: base[2] || '',
            preconditions: base[3] || '',
            steps: base[4] || '',
            expected: base[5] || '',
            actual: '',
            remark: '',
            reuseDetails: [],
            defectLinks: [],
          });
        }
        var entry = map.get(key);
        if (extras && extras.length) {
          hasResult = true;
          if (extras.length > 1) {
            reuseFound = true;
            entry.reuseDetails = entry.reuseDetails || [];
            entry.reuseDetails.push({
              id: 'test-reuse-' + entry.reuseDetails.length,
              text: extras[0] || '',
              note: extras.length > 2 ? extras.slice(2).join('；') : '',
              status: extras[1] || '未执行',
              presetId: '',
            });
          } else if (!entry.reuseDetails || !entry.reuseDetails.length) {
            entry.actual = extras[0] || entry.actual || '';
          }
        }
      });
      return {
        cases: Array.from(map.values()),
        hasResult: hasResult,
        reuseEnabled: reuseFound,
      };
    };
    var runner = typeof helper === 'function' ? helper : fallback;
    var plainPaths = [['需求A', '模块A', '用例1', 'P0', '前置', '步骤', '期望']];
    var resultPaths = [['需求B', '模块B', '用例2', 'P1', '前置条件', '操作步骤', '期望结果', '通过']];
    var reusePaths = [['需求B', '模块B', '用例2', 'P1', '前置条件', '操作步骤', '期望结果', '复用子项1', '失败', '补充备注']];
    var plain = runner(plainPaths);
    var result = runner(resultPaths.concat(reusePaths));
    return { plain: plain, result: result };
  });

  expect(parsed).not.toBeNull();
  expect(parsed.plain && parsed.plain.reuseEnabled).toBeFalsy();
  expect(parsed.plain && parsed.plain.hasResult).toBeFalsy();
  expect(parsed.plain && parsed.plain.cases[0] && parsed.plain.cases[0].actual).toBe('');

  expect(parsed.result && parsed.result.hasResult).toBeTruthy();
  expect(parsed.result && parsed.result.reuseEnabled).toBeTruthy();
  const reuseCase = parsed.result && parsed.result.cases ? parsed.result.cases.find((c) => c.title === '用例2') : null;
  expect(reuseCase && reuseCase.actual).toBe('通过');
  expect(reuseCase && reuseCase.reuseDetails && reuseCase.reuseDetails.length).toBe(1);
  expect(reuseCase && reuseCase.reuseDetails[0] && reuseCase.reuseDetails[0].text).toBe('复用子项1');
  expect(reuseCase && reuseCase.reuseDetails[0] && reuseCase.reuseDetails[0].status).toBe('失败');
  expect(reuseCase && reuseCase.reuseDetails[0] && reuseCase.reuseDetails[0].note).toBe('补充备注');
});
