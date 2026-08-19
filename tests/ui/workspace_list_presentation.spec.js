const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 519, username: 'list_admin', role: 'admin', level: 'leader' };

async function setupRoutes(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('tap-auth-token', 'workspace-list-token'); } catch (err) {}
  });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const respond = (body) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (path === '/api/users/me' && method === 'GET') return respond(user);
    if (path === '/api/settings' && method === 'GET') return respond([]);
    if (path === '/api/settings' && method === 'PUT') return respond([]);
    return respond(method === 'GET' ? [] : {});
  });
}

test.describe('核心列表表现层', () => {
  test('映射列表状态并完整展示用例执行长文本', async ({ page }) => {
    await setupRoutes(page);
    await page.goto(base + '/case-exec.html?tab=tempexec');
    await page.waitForFunction(() => {
      return document.documentElement.classList.contains('workspace-shell-enabled')
        && window.app
        && window.app._inited === true
        && window.app.workspaceListPresentation;
    }, null, { timeout: 30000 });

    await page.evaluate(() => {
      var original = document.getElementById('tempExecView');
      original.id = 'tempExecViewOriginal';
      var view = document.createElement('div');
      view.id = 'tempExecView';
      original.parentNode.insertBefore(view, original);
      view.innerHTML = [
        '<table><tbody><tr class="case-row">',
        '<td class="module">这是一个超过十六个字符并且需要展示完整提示的模块名称</td>',
        '<td><span id="longEditor" class="temp-inline-edit" contenteditable="true" data-temp-edit-multiline="true">这是一个超过两行显示范围并且进入编辑状态后需要完整展开的前置条件内容</span></td>',
        '<td><span id="priorityEditor" class="temp-inline-edit" contenteditable="true" data-temp-edit-field="priority">P1</span></td>',
        '<td><select id="statusSelect" class="status-select"><option selected>通过</option></select></td>',
        '</tr></tbody></table>',
      ].join('');
      window.app.workspaceListPresentation.refresh();
    });

    await expect(page.locator('#tempExecView')).toHaveClass(/workspace-list-view/);
    await expect(page.locator('#tempExecView table')).toHaveClass(/workspace-data-table/);
    await expect(page.locator('#longEditor')).toHaveAttribute('data-workspace-wrap', 'true');
    await expect(page.locator('#longEditor')).not.toHaveAttribute('title');
    await expect(page.locator('#priorityEditor')).toHaveAttribute('data-priority', 'p1');
    await expect(page.locator('#statusSelect')).toHaveAttribute('data-workspace-state', 'success');

    const expanded = await page.locator('#longEditor').evaluate((element) => {
      var style = getComputedStyle(element);
      return {
        lineClamp: style.webkitLineClamp,
        maxHeight: style.maxHeight,
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    });
    expect(expanded.lineClamp).toBe('none');
    expect(expanded.maxHeight).toBe('none');
    expect(expanded.overflow).toBe('visible');
    expect(expanded.textOverflow).toBe('clip');
    expect(expanded.scrollHeight).toBeLessThanOrEqual(expanded.clientHeight + 1);

    await page.locator('#longEditor').focus();
    await expect(page.locator('#longEditor')).toHaveClass(/workspace-is-editing/);
    await expect(page.locator('#longEditor')).not.toHaveAttribute('title');
    await expect.poll(() => page.locator('#longEditor').evaluate((element) => getComputedStyle(element).maxHeight))
      .toBe('none');

    await page.locator('#longEditor').evaluate((element) => element.blur());
    await expect(page.locator('#longEditor')).not.toHaveClass(/workspace-is-editing/);
    await expect(page.locator('#longEditor')).not.toHaveAttribute('title');
  });

  test('用例库长文本自动换行且不显示省略号', async ({ page }) => {
    await setupRoutes(page);
    await page.goto(base + '/case-library.html');
    await page.waitForFunction(() => {
      return document.documentElement.classList.contains('workspace-shell-enabled')
        && window.app
        && window.app._inited === true
        && window.app.workspaceListPresentation;
    }, null, { timeout: 30000 });

    await page.evaluate(() => {
      var original = document.getElementById('caseLibraryEditView');
      original.id = 'caseLibraryEditViewOriginal';
      var view = document.createElement('div');
      view.id = 'caseLibraryEditView';
      original.parentNode.insertBefore(view, original);
      view.innerHTML = [
        '<table><tbody><tr class="case-row">',
        '<td id="longModule" class="module">这是一个超过十六个字符并且需要完整换行展示的用例库模块名称</td>',
        '<td><div id="libraryLongEditor" class="temp-inline-edit" contenteditable="true" data-case-lib-edit-field="steps" data-case-lib-multiline="true">第一步执行一个较长操作并观察页面反馈<br>第二步继续执行另一个较长操作并检查最终结果</div></td>',
        '</tr></tbody></table>',
      ].join('');
      window.app.workspaceListPresentation.refresh();
    });

    await expect(page.locator('#libraryLongEditor')).toHaveAttribute('data-workspace-wrap', 'true');
    await expect(page.locator('#longModule')).toHaveAttribute('data-workspace-wrap-cell', 'true');
    const metrics = await page.locator('#caseLibraryEditView').evaluate((root) => {
      function read(selector) {
        var element = root.querySelector(selector);
        var style = getComputedStyle(element);
        return {
          lineClamp: style.webkitLineClamp,
          overflow: style.overflow,
          textOverflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        };
      }
      return {
        editor: read('#libraryLongEditor'),
        module: read('#longModule'),
      };
    });
    expect(metrics.editor.lineClamp).toBe('none');
    expect(metrics.editor.overflow).toBe('visible');
    expect(metrics.editor.textOverflow).toBe('clip');
    expect(metrics.editor.whiteSpace).toBe('pre-wrap');
    expect(metrics.editor.scrollHeight).toBeLessThanOrEqual(metrics.editor.clientHeight + 1);
    expect(metrics.module.lineClamp).toBe('none');
    expect(metrics.module.overflow).toBe('visible');
    expect(metrics.module.textOverflow).toBe('clip');
    expect(['normal', 'pre-wrap']).toContain(metrics.module.whiteSpace);
    expect(metrics.module.scrollHeight).toBeLessThanOrEqual(metrics.module.clientHeight + 1);
  });

  test('用例库列表标题栏内容居中', async ({ page }) => {
    await setupRoutes(page);
    await page.goto(base + '/case-library.html');
    await page.waitForFunction(() => {
      return document.documentElement.classList.contains('workspace-shell-enabled')
        && window.app
        && window.app._inited === true
        && window.app.workspaceListPresentation;
    }, null, { timeout: 30000 });

    await page.evaluate(() => {
      var original = document.getElementById('caseLibraryEditView');
      original.id = 'caseLibraryEditViewOriginal';
      var view = document.createElement('div');
      view.id = 'caseLibraryEditView';
      original.parentNode.insertBefore(view, original);
      view.innerHTML = '<table><thead><tr><th>编号</th><th>模块</th><th>用例标题</th><th>优先级</th></tr></thead><tbody><tr><td>1</td><td>模块</td><td>标题</td><td>P1</td></tr></tbody></table>';
      window.app.workspaceListPresentation.refresh();
    });

    await expect(page.locator('#caseLibraryEditView th')).toHaveCount(4);
    await expect.poll(() => page.locator('#caseLibraryEditView th').evaluateAll((headers) => {
      return headers.every((header) => getComputedStyle(header).textAlign === 'center');
    })).toBeTruthy();
  });
});
