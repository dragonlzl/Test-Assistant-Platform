const { test, expect } = require('@playwright/test');

test('用例库XMind编写用例复用既有导入接口', async ({ request }) => {
  const docsRes = await request.get('/openapi.json');
  expect(docsRes.ok()).toBeTruthy();
  const docs = await docsRes.json();
  const paths = docs && docs.paths ? docs.paths : {};

  const importPath = paths['/api/case-files/import'] || null;
  expect(importPath).toBeTruthy();
  expect(importPath.post).toBeTruthy();

  const allPathKeys = Object.keys(paths || {});
  const writerLike = allPathKeys.filter((p) => /writer|xmind-writer|mind-writer/i.test(String(p || '')));
  expect(writerLike).toEqual([]);
});
