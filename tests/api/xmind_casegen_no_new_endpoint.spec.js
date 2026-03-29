const { test, expect } = require('@playwright/test');

test('XMind 用例生成抽屉无需新增后端端点', async ({ request }) => {
  const docsRes = await request.get('/openapi.json');
  expect(docsRes.ok()).toBeTruthy();
  const docs = await docsRes.json();
  const paths = docs && docs.paths && typeof docs.paths === 'object' ? Object.keys(docs.paths) : [];
  const related = paths.filter((p) => /xmind|mind|casegen|case-gen|usecase-gen/i.test(String(p || '')));
  const whitelist = [
    '/api/case-template/xmind',
  ];
  const extra = related.filter((p) => whitelist.indexOf(p) === -1);
  expect(extra).toEqual([]);
});
