const { test, expect } = require('@playwright/test');

async function setup(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-auth-token', 'shared-ui-token');
      localStorage.removeItem('tap-navigation-context-collapsed-v1');
    } catch (error) {}
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const body = url.pathname === '/api/users/me'
      ? { id: 1, username: 'ui_admin', role: 'admin', level: 'leader' }
      : (method === 'GET' ? [] : {});
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true && window.app.uiReady === true);
}

test.describe('Shared UI foundation', () => {
  test('starts shared shells once after the application runtime', async ({ page }) => {
    await setup(page);
    const state = await page.evaluate(() => ({
      appReady: window.app._inited === true,
      uiReady: window.app.uiReady === true,
      navigation: Boolean(window.app.ui && window.app.ui.navigation),
      drawers: Boolean(window.app.ui && window.app.ui.drawers),
      startCount: Number(window.app.__tapSharedUiStartCount || 0),
    }));
    expect(state).toEqual({
      appReady: true,
      uiReady: true,
      navigation: true,
      drawers: true,
      startCount: 1,
    });
  });

  test('uses the two-level navigation dimensions and preserves collapse state', async ({ page }) => {
    await setup(page);
    const expanded = await page.evaluate(() => {
      const rail = document.querySelector('.tap-nav-rail');
      const context = document.querySelector('.tap-nav-context');
      const sidebar = document.querySelector('.sidebar');
      return {
        ready: document.documentElement.classList.contains('tap-navigation-ready'),
        rail: Math.round(rail.getBoundingClientRect().width),
        context: Math.round(context.getBoundingClientRect().width),
        sidebar: Math.round(sidebar.getBoundingClientRect().width),
      };
    });
    expect(expanded).toEqual({ ready: true, rail: 68, context: 240, sidebar: 308 });

    await page.locator('.tap-nav-collapse').click();
    await expect.poll(async () => page.locator('.sidebar').evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(68);
    await expect(page.locator('.tap-nav-context')).toHaveCSS('visibility', 'hidden');
  });

  test('lazy-loads VTable and renders a nonblank canvas with a semantic mirror', async ({ page }) => {
    await setup(page);
    await expect(page.locator('script[data-tap-vtable-runtime="1"]')).toHaveCount(0);

    const result = await page.evaluate(async () => {
      const container = document.createElement('div');
      container.id = 'shared-ui-vtable-probe';
      container.style.width = '820px';
      container.style.height = '320px';
      document.querySelector('main').prepend(container);
      const controller = window.app.ui.VTableHost.mount(container, {
        id: 'shared-ui-probe',
        caption: '基础表格验证',
        rowKey: (record) => record.id,
        columns: [
          { key: 'name', title: '名称', width: 260 },
          { key: 'status', title: '状态', width: 180 },
          { key: 'selected', title: '选择', kind: 'checkbox', width: 90 },
        ],
        records: [
          { id: 'a', name: 'Alpha', status: '进行中', selected: true },
          { id: 'b', name: 'Beta', status: '已完成', selected: false },
        ],
      });
      await controller.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvases = Array.from(container.querySelectorAll('canvas'));
      let coloredPixels = 0;
      canvases.forEach((canvas) => {
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) return;
        const width = Math.min(canvas.width, 500);
        const height = Math.min(canvas.height, 240);
        const data = context.getImageData(0, 0, width, height).data;
        for (let index = 0; index < data.length; index += 16) {
          if (data[index + 3] > 0) coloredPixels += 1;
        }
      });
      return {
        instance: Boolean(controller.getInstance()),
        canvasCount: canvases.length,
        semanticRows: container.querySelectorAll('.tap-vtable-semantic tbody tr').length,
        coloredPixels,
      };
    });

    expect(result.instance).toBe(true);
    expect(result.canvasCount).toBeGreaterThan(0);
    expect(result.semanticRows).toBe(2);
    expect(result.coloredPixels).toBeGreaterThan(100);
    await expect(page.locator('script[data-tap-vtable-runtime="1"]')).toHaveCount(1);
    await expect(page.locator('script[data-tap-vtable-editors="1"]')).toHaveCount(0);
  });

  test('renders an exclusive radio column and bridges enabled Canvas changes', async ({ page }) => {
    await setup(page);

    const mounted = await page.evaluate(async () => {
      const container = document.createElement('div');
      container.id = 'shared-ui-radio-vtable';
      container.style.width = '620px';
      container.style.height = '260px';
      document.querySelector('main').prepend(container);
      window.__sharedUiRadioChanges = [];
      window.__sharedUiRadioTable = window.app.ui.VTableHost.mount(container, {
        id: 'shared-ui-radio-probe',
        strictRowKey: true,
        rowKey: (record) => record.id,
        columns: [
          {
            key: 'selected',
            title: '默认',
            kind: 'radio',
            width: 120,
            disabled: (record) => record.locked === true,
          },
          { key: 'name', title: '名称', width: 260 },
        ],
        records: [
          { id: 'radio-a', name: 'Alpha', selected: true, locked: false },
          { id: 'radio-b', name: 'Beta', selected: false, locked: false },
          { id: 'radio-c', name: 'Gamma', selected: false, locked: true },
        ],
        onCellChange: (payload) => window.__sharedUiRadioChanges.push({
          rowKey: payload.record.id,
          columnKey: payload.column.key,
          value: payload.value,
          source: payload.source,
        }),
      });
      await window.__sharedUiRadioTable.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const table = window.__sharedUiRadioTable.getInstance();
      const canvasHost = container.querySelector('.tap-vtable-canvas');
      const canvasHostRect = canvasHost.getBoundingClientRect();
      const secondRect = table.getCellRelativeRect(0, 2);
      const thirdRect = table.getCellRelativeRect(0, 3);
      const canvases = Array.from(container.querySelectorAll('canvas'));
      let coloredPixels = 0;
      canvases.forEach((canvas) => {
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) return;
        const width = Math.min(canvas.width, 500);
        const height = Math.min(canvas.height, 220);
        const data = context.getImageData(0, 0, width, height).data;
        for (let index = 0; index < data.length; index += 16) {
          if (data[index + 3] > 0) coloredPixels += 1;
        }
      });
      const semanticRadios = Array.from(
        container.querySelectorAll('.tap-vtable-semantic input[type="radio"]')
      );
      return {
        canvasCount: canvases.length,
        coloredPixels,
        radioCount: semanticRadios.length,
        radioNames: semanticRadios.map((radio) => radio.name),
        checked: semanticRadios.map((radio) => radio.checked),
        disabled: semanticRadios.map((radio) => radio.disabled),
        secondPoint: {
          x: canvasHostRect.left + secondRect.left + secondRect.width / 2,
          y: canvasHostRect.top + secondRect.top + secondRect.height / 2,
        },
        thirdPoint: {
          x: canvasHostRect.left + thirdRect.left + thirdRect.width / 2,
          y: canvasHostRect.top + thirdRect.top + thirdRect.height / 2,
        },
      };
    });

    expect(mounted.canvasCount).toBeGreaterThan(0);
    expect(mounted.coloredPixels).toBeGreaterThan(100);
    expect(mounted.radioCount).toBe(3);
    expect(mounted.radioNames[0]).toBeTruthy();
    expect(mounted.radioNames[0]).toBe(mounted.radioNames[1]);
    expect(mounted.radioNames[0]).toBe(mounted.radioNames[2]);
    expect(mounted.checked).toEqual([true, false, false]);
    expect(mounted.disabled).toEqual([false, false, true]);

    await page.mouse.click(mounted.secondPoint.x, mounted.secondPoint.y);
    await expect.poll(() => page.evaluate(() => window.__sharedUiRadioChanges.slice())).toEqual([
      {
        rowKey: 'radio-b',
        columnKey: 'selected',
        value: true,
        source: 'canvas',
      },
    ]);
    await expect.poll(() => page.evaluate(() => Array.from(
      document.querySelectorAll('#shared-ui-radio-vtable .tap-vtable-semantic input[type="radio"]')
    ).map((radio) => radio.checked))).toEqual([false, true, false]);

    await page.mouse.click(mounted.thirdPoint.x, mounted.thirdPoint.y);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__sharedUiRadioChanges.slice())).toEqual([
      {
        rowKey: 'radio-b',
        columnKey: 'selected',
        value: true,
        source: 'canvas',
      },
    ]);
    await expect(page.locator(
      '#shared-ui-radio-vtable .tap-vtable-semantic tr[data-row-key="radio-c"] input[type="radio"]'
    )).toBeDisabled();
  });

  test('lazy-loads editors and bridges edit and selection events with stable row keys', async ({ page }) => {
    await setup(page);
    await expect(page.locator('script[data-tap-vtable-editors="1"]')).toHaveCount(0);

    const mounted = await page.evaluate(async () => {
      const container = document.createElement('div');
      container.id = 'shared-ui-editable-vtable';
      container.style.width = '820px';
      container.style.height = '320px';
      document.querySelector('main').prepend(container);
      window.__sharedUiTableChanges = [];
      window.__sharedUiTableSelections = [];
      window.__sharedUiEditableTable = window.app.ui.VTableHost.mount(container, {
        id: 'shared-ui-editable-probe',
        strictRowKey: true,
        rowKey: (record) => record.id,
        columns: [
          { key: 'name', title: '名称', width: 260, editable: true },
          { key: 'note', title: '说明', width: 300, editable: true, multiline: true },
          { key: 'status', title: '状态', width: 160, editor: { type: 'list', values: ['进行中', '已完成'] } },
        ],
        records: [
          { id: 'a', name: 'Alpha', note: '第一行', status: '进行中' },
          { id: 'b', name: 'Beta', note: '第二行', status: '已完成' },
        ],
        onCellChange: (payload) => window.__sharedUiTableChanges.push({
          rowKey: payload.record.id,
          columnKey: payload.column.key,
          value: payload.value,
          previousValue: payload.previousValue,
          source: payload.source,
        }),
        onSelectionChange: (payload) => window.__sharedUiTableSelections.push({
          rowKeys: payload.rowKeys.slice(),
          active: payload.active,
        }),
      });
      await window.__sharedUiEditableTable.ready;
      const table = window.__sharedUiEditableTable.getInstance();
      return {
        instance: Boolean(table),
        inputEditor: Boolean(window.VTable.register.editor('tap-editor-shared-ui-editable-probe-name')),
        textareaEditor: Boolean(window.VTable.register.editor('tap-editor-shared-ui-editable-probe-note')),
        listEditor: Boolean(window.VTable.register.editor('tap-editor-shared-ui-editable-probe-status')),
      };
    });

    expect(mounted).toEqual({
      instance: true,
      inputEditor: true,
      textareaEditor: true,
      listEditor: true,
    });
    await expect(page.locator('script[data-tap-vtable-editors="1"]')).toHaveCount(1);

    await page.evaluate(() => {
      const table = window.__sharedUiEditableTable.getInstance();
      table.startEditCell(0, 1);
    });
    const inputEditor = page.locator('#shared-ui-editable-vtable input.tap-vtable-editor');
    await expect(inputEditor).toBeVisible();
    await inputEditor.fill('Gamma');
    await page.evaluate(() => window.__sharedUiEditableTable.getInstance().completeEditCell());
    await expect.poll(async () => page.evaluate(() => window.__sharedUiTableChanges[0] || null)).toEqual({
      rowKey: 'a',
      columnKey: 'name',
      value: 'Gamma',
      previousValue: 'Alpha',
      source: 'canvas-editor',
    });

    await page.evaluate(() => window.__sharedUiEditableTable.getInstance().selectCell(1, 2));
    await expect.poll(async () => page.evaluate(() => {
      const list = window.__sharedUiTableSelections || [];
      return list.length ? list[list.length - 1] : null;
    })).toMatchObject({
      rowKeys: ['b'],
      active: { rowKey: 'b', columnKey: 'note' },
    });

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(120);
    await page.evaluate(() => window.__sharedUiEditableTable.getInstance().startEditCell(1, 1));
    const textareaEditor = page.locator('#shared-ui-editable-vtable textarea.tap-vtable-editor');
    await expect(textareaEditor).toBeVisible();
    const editorColors = await textareaEditor.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
    }));
    expect(editorColors.background).toBe('rgb(24, 34, 49)');
    expect(editorColors.color).toBe('rgb(229, 231, 235)');
  });
});
