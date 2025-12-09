const { test, expect } = require('@playwright/test');
const JSZip = require('../../scripts/vendor/jszip.min.js');

async function buildXmindBuffer(rootTitle, paths) {
  const createNode = (title) => ({ title });
  const ensureChild = (parent, title) => {
    if (!parent.children) parent.children = { attached: [] };
    const list = parent.children.attached;
    let child = list.find((node) => node.title === title);
    if (!child) {
      child = createNode(title);
      list.push(child);
    }
    return child;
  };
  const root = createNode(rootTitle);
  root.children = { attached: [] };
  paths.forEach((path) => {
    if (!Array.isArray(path) || !path.length) return;
    let cursor = root;
    path.forEach((segment, idx) => {
      const title = typeof segment === 'string' ? segment : '';
      if (idx === 0) return;
      cursor = ensureChild(cursor, title || ('节点' + idx));
    });
  });
  const sheetId = 'sheet-' + Date.now().toString(16);
  const content = [{
    id: sheetId,
    class: 'sheet',
    title: rootTitle,
    rootTopic: root,
  }];
  const metadata = { activeSheetId: sheetId };
  const manifest = { 'file-entries': { 'content.json': {}, 'metadata.json': {} } };
  const zip = new JSZip();
  zip.file('content.json', JSON.stringify(content, null, 2));
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('执行页可区分无结果与带结果/复用的 XMind 导入', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await page.click('[data-tab-btn="tempexec"]');

  const plainPaths = [['需求A', '模块A', '用例1', 'P0', '前置', '步骤', '期望']];
  const resultPaths = [['需求B', '模块B', '用例2', 'P1', '前置条件', '操作步骤', '期望结果', '通过']];
  const reusePaths = [['需求B', '模块B', '用例2', 'P1', '前置条件', '操作步骤', '期望结果', '复用子项1', '失败', '补充备注']];

  const plainBuffer = await buildXmindBuffer('需求A', plainPaths);
  const resultBuffer = await buildXmindBuffer('需求B', resultPaths.concat(reusePaths));

  await page.setInputFiles('#tempExecInput', [
    { name: 'plain.xmind', mimeType: 'application/octet-stream', buffer: plainBuffer },
    { name: 'result_reuse.xmind', mimeType: 'application/octet-stream', buffer: resultBuffer },
  ]);

  await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 8000 });

  const files = await page.evaluate(() => {
    const store = window.app && window.app.state ? window.app.state.tempExecFiles || [] : [];
    return store.map((file) => ({
      name: file.name,
      reuseEnabled: Boolean(file.reuseEnabled),
      cases: (file.cases || []).map((c) => ({
        title: c.title,
        actual: c.actual || '',
        reuseDetails: (c.reuseDetails || []).map((d) => ({ text: d.text, status: d.status, note: d.note || '' })),
      })),
    }));
  });

  expect(files.length).toBeGreaterThanOrEqual(2);
  const plain = files.find((f) => f.name === 'plain.xmind');
  const resultReuse = files.find((f) => f.name === 'result_reuse.xmind');
  expect(plain && plain.reuseEnabled).toBeFalsy();
  expect(plain && plain.cases[0] && plain.cases[0].actual).toBe('未执行');

  expect(resultReuse && resultReuse.reuseEnabled).toBeTruthy();
  const resultCase = resultReuse && resultReuse.cases ? resultReuse.cases.find((c) => c.title === '用例2') : null;
  expect(resultCase && resultCase.actual).toBe('通过');
  expect(resultCase && resultCase.reuseDetails && resultCase.reuseDetails.length).toBe(1);
  expect(resultCase && resultCase.reuseDetails[0] && resultCase.reuseDetails[0].text).toBe('复用子项1');
  expect(resultCase && resultCase.reuseDetails[0] && resultCase.reuseDetails[0].status).toBe('失败');
  expect(resultCase && resultCase.reuseDetails[0] && resultCase.reuseDetails[0].note).toBe('补充备注');
});
