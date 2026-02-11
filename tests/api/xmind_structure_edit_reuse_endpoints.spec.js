const { test, expect } = require('@playwright/test');

test('XMind 编辑复用既有后端接口', async ({ request }) => {
  const docsRes = await request.get('/openapi.json');
  expect(docsRes.ok()).toBeTruthy();
  const docs = await docsRes.json();
  const paths = docs && docs.paths ? docs.paths : {};

  const caseItemPath = paths['/api/case-files/items/{case_item_id}'] || null;
  const caseItemsPath = paths['/api/case-files/{case_file_id}/items'] || null;
  const execCasePath = paths['/api/exec/cases/{case_id}'] || null;
  const execCasesPath = paths['/api/exec/sets/{exec_set_id}/cases'] || null;

  expect(caseItemPath).toBeTruthy();
  expect(caseItemsPath).toBeTruthy();
  expect(execCasePath).toBeTruthy();
  expect(execCasesPath).toBeTruthy();

  expect(caseItemPath.patch).toBeTruthy();
  expect(caseItemPath.delete).toBeTruthy();
  expect(caseItemsPath.post).toBeTruthy();
  expect(execCasePath.patch).toBeTruthy();
  expect(execCasePath.delete).toBeTruthy();
  expect(execCasesPath.post).toBeTruthy();
});
