const { test, expect } = require('@playwright/test');

test('XMind 用例生成仅新增统一模型任务端点', async ({ request }) => {
  const docsRes = await request.get('/openapi.json');
  expect(docsRes.ok()).toBeTruthy();
  const docs = await docsRes.json();
  const paths = docs && docs.paths && typeof docs.paths === 'object' ? Object.keys(docs.paths) : [];
  const related = paths.filter((p) => /xmind|mind|casegen|case-gen|usecase-gen|model-tasks/i.test(String(p || '')));
  const whitelist = [
    '/api/case-template/xmind',
    '/api/model-tasks',
    '/api/model-tasks/{task_id}',
    '/api/model-tasks/{task_id}/cancel',
    '/api/model-tasks/cancel-by-owner',
  ];
  const extra = related.filter((p) => whitelist.indexOf(p) === -1);
  expect(extra).toEqual([]);
});
