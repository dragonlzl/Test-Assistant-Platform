const { test, expect } = require('@playwright/test');

test('用例生成设置仅复用统一模型任务端点', async ({ request }) => {
  const docsRes = await request.get('/openapi.json');
  expect(docsRes.ok()).toBeTruthy();
  const docs = await docsRes.json();
  const paths = docs && docs.paths && typeof docs.paths === 'object' ? Object.keys(docs.paths) : [];
  const casegenLike = paths.filter((p) => /casegen|case-gen|usecase-gen|model-tasks/i.test(String(p || '')));
  expect(casegenLike.sort()).toEqual([
    '/api/model-tasks',
    '/api/model-tasks/cancel-by-owner',
    '/api/model-tasks/{task_id}',
    '/api/model-tasks/{task_id}/cancel',
  ].sort());
});
