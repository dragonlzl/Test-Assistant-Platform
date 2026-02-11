const { test, expect } = require('@playwright/test');

test('XMind 结构展示无需新增后端端点', async ({ request }) => {
  const docsRes = await request.get('/openapi.json');
  expect(docsRes.ok()).toBeTruthy();
  const docs = await docsRes.json();
  const paths = docs && docs.paths && typeof docs.paths === 'object' ? Object.keys(docs.paths) : [];
  const xmindLike = paths.filter((p) => /xmind|mind/i.test(String(p || '')));
  const whitelist = [
    '/api/case-template/xmind',
  ];
  const extra = xmindLike.filter((p) => whitelist.indexOf(p) === -1);
  expect(extra).toEqual([]);
});
