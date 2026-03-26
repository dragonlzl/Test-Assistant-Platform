const { test, expect } = require('@playwright/test');

test('用例生成设置改版无需新增后端端点', async ({ request }) => {
  const docsRes = await request.get('/openapi.json');
  expect(docsRes.ok()).toBeTruthy();
  const docs = await docsRes.json();
  const paths = docs && docs.paths && typeof docs.paths === 'object' ? Object.keys(docs.paths) : [];
  const casegenLike = paths.filter((p) => /casegen|case-gen|usecase-gen/i.test(String(p || '')));
  expect(casegenLike).toEqual([]);
});
