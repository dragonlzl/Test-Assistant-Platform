const { test, expect } = require('@playwright/test');

async function openTempExecMoreActions(page) {
  const toggle = page.locator('#tempExecToolbar [data-temp-more-toggle]');
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(page.locator('#tempExecMoreMenu')).toBeVisible();
}

async function ensureMindElixirReady(page, url) {
  var maxRetry = 3;
  for (var i = 0; i < maxRetry; i += 1) {
    var ready = false;
    try {
      await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 8000 });
      ready = await page.evaluate(() => {
        var app = window.app || {};
        var api = app.mindElixirCoreApi || null;
        var hasApi = Boolean(api && typeof api.buildMindDataFromCases === 'function' && typeof api.renderMindMap === 'function');
        var globalObj = null;
        if (typeof MindElixir !== 'undefined') globalObj = MindElixir;
        else if (window && window.MindElixir) globalObj = window.MindElixir;
        var hasCtor = false;
        if (typeof globalObj === 'function') hasCtor = true;
        else if (globalObj && typeof globalObj.default === 'function') hasCtor = true;
        return hasApi && hasCtor;
      });
    } catch (err) {
      ready = false;
    }
    if (ready) return;
    if (i < maxRetry - 1) await page.goto(url);
  }
  throw new Error('MindElixir 依赖未就绪，请重试');
}

async function gotoCaseLibrary(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/case-library.html';
  await page.goto(url);
  await ensureMindElixirReady(page, url);
  return base;
}

async function gotoExec(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/case-exec.html';
  await page.goto(url);
  await ensureMindElixirReady(page, url);
  return base;
}

async function waitCaseLibraryReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.caseLibraryBound === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', {}, { timeout: 30000 });
}

async function waitExecReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.tempExecApi, {}, { timeout: 30000 });
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

function buildCaseLibraryRoutes(page, options) {
  const {
    token,
    user,
    project,
    versions,
    caseFiles,
    caseItemsByFileId,
  } = options;

  return page.route('**/*', async (route) => {
    const reqUrl = route.request().url();
    const method = route.request().method();
    const url = new URL(reqUrl);
    const pathName = url.pathname;
    const auth = route.request().headers()['authorization'] || '';
    const authed = auth === `Bearer ${token}`;

    const respond = (status, body) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (!pathName.startsWith('/api/')) {
      if (reqUrl.startsWith('http://localhost') || reqUrl.startsWith('http://127.0.0.1') || reqUrl.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    }

    if (pathName === '/api/users/me' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, user);
    }
    if (pathName === '/api/projects' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, [project]);
    }
    const versionsMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
    if (versionsMatch && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, versions);
    }
    if (pathName === '/api/case-files' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, caseFiles);
    }
    if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, []);
    }
    const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
    if (itemsMatch && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      const fid = Number(itemsMatch[1]);
      return respond(200, (caseItemsByFileId[fid] || []).slice());
    }

    if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
    if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
    if (pathName === '/api/models' && method === 'GET') return respond(200, []);
    if (pathName === '/api/features' && method === 'GET') return respond(200, []);
    if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
    if (pathName === '/api/auth/logout') return respond(200, {});

    return respond(200, []);
  });
}

async function getNodeCenter(page, viewerSelector, topicText) {
  var position = null;
  for (var attempt = 0; attempt < 8; attempt += 1) {
    var result = await page.evaluate(({ viewer, topic }) => {
      function parseTransform(transformText) {
        var text = transformText === undefined || transformText === null ? '' : String(transformText);
        var translateMatch = text.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/i);
        var scaleMatch = text.match(/scale\(([-\d.]+)\)/i);
        return {
          x: translateMatch ? Number(translateMatch[1]) : 0,
          y: translateMatch ? Number(translateMatch[2]) : 0,
          scale: scaleMatch ? Number(scaleMatch[1]) : 1,
        };
      }
      var viewerEl = document.querySelector(viewer);
      var canvas = viewerEl && viewerEl.querySelector ? viewerEl.querySelector('.xmind-structure-canvas') : null;
      var map = viewerEl && viewerEl.querySelector ? viewerEl.querySelector('.map-canvas') : null;
      var nodes = document.querySelectorAll(viewer + ' me-tpc');
      var found = null;
      Array.prototype.some.call(nodes, function(node) {
        var textEl = node && node.querySelector ? node.querySelector('.text') : null;
        var label = textEl
          ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
          : '';
        if (label !== topic) return false;
        var rect = (textEl || node).getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return false;
        found = {
          x: rect.left + (rect.width / 2),
          y: rect.top + (rect.height / 2),
        };
        return true;
      });
      if (!found || !canvas || !canvas.getBoundingClientRect || !map || !map.style) {
        return { point: found, adjusted: false };
      }
      var canvasRect = canvas.getBoundingClientRect();
      var margin = 24;
      var visible = found.x >= canvasRect.left + margin
        && found.x <= canvasRect.right - margin
        && found.y >= canvasRect.top + margin
        && found.y <= canvasRect.bottom - margin;
      if (visible) return { point: found, adjusted: false };
      var state = parseTransform(map.style.transform || '');
      if (!isFinite(state.x)) state.x = 0;
      if (!isFinite(state.y)) state.y = 0;
      if (!isFinite(state.scale) || state.scale <= 0) state.scale = 1;
      var desiredX = canvasRect.left + (canvasRect.width / 2);
      var desiredY = canvasRect.top + (canvasRect.height / 2);
      var nextX = state.x + (desiredX - found.x);
      var nextY = state.y + (desiredY - found.y);
      map.style.transform = 'translate3d(' + nextX + 'px, ' + nextY + 'px, 0px) scale(' + state.scale + ')';
      return { point: found, adjusted: true };
    }, { viewer: viewerSelector, topic: topicText });
    expect(result && result.point).toBeTruthy();
    if (!result.adjusted) {
      position = result.point;
      break;
    }
    await page.waitForTimeout(120);
  }
  expect(position).toBeTruthy();
  return position;
}

async function clickEditNode(page, viewerSelector, topicText, ctrlKey) {
  var point = await getNodeCenter(page, viewerSelector, topicText);
  if (ctrlKey === true) await page.keyboard.down('Control');
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  if (ctrlKey === true) await page.keyboard.up('Control');
  await page.waitForTimeout(ctrlKey === true ? 220 : 120);
}

async function readEditSelectedLabels(page, viewerSelector) {
  return page.evaluate((viewer) => {
    var selected = document.querySelectorAll(viewer + ' .selected');
    var labels = [];
    var seen = {};
    Array.prototype.forEach.call(selected || [], function(el) {
      var node = el && el.closest ? el.closest('me-tpc') : null;
      if (!node || !node.querySelector) return;
      var textEl = node.querySelector('.text');
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      if (!label || seen[label]) return;
      seen[label] = true;
      labels.push(label);
    });
    return labels;
  }, viewerSelector);
}

async function clearEditSelection(page, viewerSelector) {
  var point = await page.evaluate((viewer) => {
    var canvas = document.querySelector(viewer + ' .xmind-structure-canvas');
    if (!canvas || !canvas.getBoundingClientRect || typeof document.elementsFromPoint !== 'function') return null;
    var rect = canvas.getBoundingClientRect();
    var cols = [0.08, 0.14, 0.22, 0.78, 0.86, 0.92];
    var rows = [0.14, 0.22, 0.34, 0.66, 0.78, 0.88];
    for (var ri = 0; ri < rows.length; ri += 1) {
      for (var ci = 0; ci < cols.length; ci += 1) {
        var x = rect.left + (rect.width * cols[ci]);
        var y = rect.top + (rect.height * rows[ri]);
        var stack = document.elementsFromPoint(x, y) || [];
        var blocked = stack.some(function(el) {
          return Boolean(el && el.closest && el.closest('me-tpc'));
        });
        if (!blocked) return { x: x, y: y };
      }
    }
    return {
      x: rect.left + 18,
      y: rect.top + 18,
    };
  }, viewerSelector);
  expect(point).toBeTruthy();
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
}

async function boxSelectTopics(page, viewerSelector, topics) {
  var fitButton = page.locator(viewerSelector + ' [data-mind-action="zoom-fit"]');
  if (await fitButton.count()) {
    await fitButton.click();
    await page.waitForTimeout(160);
  }
  var bounds = null;
  for (var attempt = 0; attempt < 8; attempt += 1) {
    var result = await page.evaluate(({ viewer, labels }) => {
      function parseTransform(transformText) {
        var text = transformText === undefined || transformText === null ? '' : String(transformText);
        var translateMatch = text.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/i);
        var scaleMatch = text.match(/scale\(([-\d.]+)\)/i);
        return {
          x: translateMatch ? Number(translateMatch[1]) : 0,
          y: translateMatch ? Number(translateMatch[2]) : 0,
          scale: scaleMatch ? Number(scaleMatch[1]) : 1,
        };
      }
      var wanted = Array.isArray(labels) ? labels.slice() : [];
      var found = [];
      var viewerEl = document.querySelector(viewer);
      var canvas = viewerEl && viewerEl.querySelector ? viewerEl.querySelector('.xmind-structure-canvas') : null;
      var map = viewerEl && viewerEl.querySelector ? viewerEl.querySelector('.map-canvas') : null;
      var nodes = document.querySelectorAll(viewer + ' me-tpc');
      Array.prototype.forEach.call(nodes, function(node) {
        if (!node || !node.querySelector) return;
        var textEl = node.querySelector('.text');
        var label = textEl
          ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
          : '';
        if (wanted.indexOf(label) === -1) return;
        var rect = (textEl || node).getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        found.push({
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        });
      });
      if (found.length !== wanted.length) return { bounds: null, adjusted: false };
      var union = {
        left: found[0].left,
        top: found[0].top,
        right: found[0].right,
        bottom: found[0].bottom,
      };
      found.forEach(function(rect) {
        if (rect.left < union.left) union.left = rect.left;
        if (rect.top < union.top) union.top = rect.top;
        if (rect.right > union.right) union.right = rect.right;
        if (rect.bottom > union.bottom) union.bottom = rect.bottom;
      });
      if (!canvas || !canvas.getBoundingClientRect || !map || !map.style) {
        return { bounds: union, adjusted: false };
      }
      var canvasRect = canvas.getBoundingClientRect();
      var margin = 36;
      var tolerance = 2;
      var visible = union.left >= canvasRect.left + margin - tolerance
        && union.right <= canvasRect.right - margin + tolerance
        && union.top >= canvasRect.top + margin - tolerance
        && union.bottom <= canvasRect.bottom - margin + tolerance;
      if (visible) return { bounds: union, adjusted: false };
      var state = parseTransform(map.style.transform || '');
      if (!isFinite(state.x)) state.x = 0;
      if (!isFinite(state.y)) state.y = 0;
      if (!isFinite(state.scale) || state.scale <= 0) state.scale = 1;
      var localUnion = {
        left: (union.left - state.x) / state.scale,
        top: (union.top - state.y) / state.scale,
        right: (union.right - state.x) / state.scale,
        bottom: (union.bottom - state.y) / state.scale,
      };
      var localWidth = localUnion.right - localUnion.left;
      var localHeight = localUnion.bottom - localUnion.top;
      var availableWidth = canvasRect.width - (margin * 2);
      var availableHeight = canvasRect.height - (margin * 2);
      var nextScale = state.scale;
      if (localWidth > 0 && availableWidth > 0 && localWidth * nextScale > availableWidth) {
        nextScale = availableWidth / localWidth;
      }
      if (localHeight > 0 && availableHeight > 0 && localHeight * nextScale > availableHeight) {
        nextScale = availableHeight / localHeight;
      }
      if (!isFinite(nextScale) || nextScale <= 0) nextScale = state.scale;
      var unionCenterX = localUnion.left + (localWidth / 2);
      var unionCenterY = localUnion.top + (localHeight / 2);
      var desiredX = canvasRect.left + (canvasRect.width / 2);
      var desiredY = canvasRect.top + (canvasRect.height / 2);
      var nextX = desiredX - (unionCenterX * nextScale);
      var nextY = desiredY - (unionCenterY * nextScale);
      map.style.transform = 'translate3d(' + nextX + 'px, ' + nextY + 'px, 0px) scale(' + nextScale + ')';
      return { bounds: union, adjusted: true };
    }, { viewer: viewerSelector, labels: topics });
    expect(result && result.bounds).toBeTruthy();
    if (!result.adjusted) {
      bounds = result.bounds;
      break;
    }
    await page.waitForTimeout(120);
  }
  expect(bounds).toBeTruthy();
  if (!bounds) return;
  await page.mouse.move(bounds.left - 18, bounds.top - 18);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(bounds.right + 18, bounds.bottom + 18, { steps: 8 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(180);
}

async function assertBoxDeleteRemovesTopics(page, viewerSelector, topics) {
  await clearEditSelection(page, viewerSelector);
  await boxSelectTopics(page, viewerSelector, topics);
  await page.locator(viewerSelector).focus();
  await page.keyboard.press('Delete');
  for (var i = 0; i < (topics || []).length; i += 1) {
    await expect(page.locator(viewerSelector + ' me-tpc .text', { hasText: topics[i] })).toHaveCount(0);
  }
}

async function expectSelectedLabels(page, viewerSelector, expectedLabels) {
  var normalized = (expectedLabels || []).slice().sort();
  await expect.poll(async () => {
    var labels = await readEditSelectedLabels(page, viewerSelector);
    return labels.slice().sort();
  }).toEqual(normalized);
}

async function readInputBoxText(page) {
  return page.evaluate(() => {
    var input = document.getElementById('input-box');
    return input ? String(input.textContent || '') : '';
  });
}

async function beginInputBoxWithText(page, viewerSelector, topicText, text) {
  var nextText = String(text || '');
  expect(nextText.length).toBeGreaterThan(0);
  await clearEditSelection(page, viewerSelector);
  await clickEditNode(page, viewerSelector, topicText);
  await page.locator(viewerSelector).focus();
  await page.keyboard.press(nextText.slice(0, 1));
  await expect(page.locator('#input-box')).toBeVisible();
  if (nextText.length > 1) {
    await page.keyboard.type(nextText.slice(1));
  }
  await expect.poll(async () => {
    return await readInputBoxText(page);
  }).toBe(nextText);
}

async function dragSelectWholeInputBox(page) {
  var points = await page.evaluate(() => {
    var input = document.getElementById('input-box');
    if (!input || !input.getBoundingClientRect) return null;
    var rect = input.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      startX: rect.left + 2,
      startY: rect.top + (rect.height / 2),
      endX: rect.right - 2,
      endY: rect.top + (rect.height / 2),
    };
  });
  expect(points).toBeTruthy();
  await page.mouse.move(points.startX, points.startY);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(points.endX, points.endY, { steps: 12 });
  await page.mouse.up({ button: 'left' });
}

async function clickInputBoxAtRatio(page, ratio) {
  var point = await page.evaluate((clickRatio) => {
    var input = document.getElementById('input-box');
    if (!input || !input.getBoundingClientRect) return null;
    var rect = input.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    var safeRatio = Number(clickRatio);
    if (!isFinite(safeRatio)) safeRatio = 0.5;
    safeRatio = Math.max(0.15, Math.min(0.85, safeRatio));
    return {
      x: rect.left + (rect.width * safeRatio),
      y: rect.top + (rect.height / 2),
    };
  }, ratio);
  expect(point).toBeTruthy();
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
}

async function doubleClickInputBoxAtRatio(page, ratio) {
  var point = await page.evaluate((clickRatio) => {
    var input = document.getElementById('input-box');
    if (!input || !input.getBoundingClientRect) return null;
    var rect = input.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    var safeRatio = Number(clickRatio);
    if (!isFinite(safeRatio)) safeRatio = 0.5;
    safeRatio = Math.max(0.15, Math.min(0.85, safeRatio));
    return {
      x: rect.left + (rect.width * safeRatio),
      y: rect.top + (rect.height / 2),
    };
  }, ratio);
  expect(point).toBeTruthy();
  await page.mouse.move(point.x, point.y);
  await page.mouse.dblclick(point.x, point.y);
}

async function readInputBoxCaretState(page) {
  return page.evaluate(() => {
    var input = document.getElementById('input-box');
    var selection = window.getSelection ? window.getSelection() : null;
    if (!input || !selection || selection.rangeCount <= 0) return null;
    var range = selection.getRangeAt(0);
    var startContainer = range.startContainer || null;
    var inside = startContainer === input || Boolean(input.contains && input.contains(startContainer));
    var caretOffset = -1;
    if (inside && document.createRange) {
      try {
        var probe = document.createRange();
        probe.selectNodeContents(input);
        probe.setEnd(range.startContainer, range.startOffset);
        caretOffset = String(probe.toString() || '').length;
      } catch (_) {
        caretOffset = -1;
      }
    }
    return {
      inside: inside,
      collapsed: Boolean(selection.isCollapsed),
      selectedText: String(selection.toString() || ''),
      caretOffset: caretOffset,
      textLength: String(input.textContent || '').length,
    };
  });
}

async function selectWholeInputBoxByDom(page) {
  await page.evaluate(() => {
    var input = document.getElementById('input-box');
    if (!input || !document.createRange || !window.getSelection) return;
    if (typeof input.focus === 'function') input.focus();
    var range = document.createRange();
    range.selectNodeContents(input);
    var selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

async function assertMouseBeginEditPlacesCaret(page, viewerSelector, topicText) {
  await clearEditSelection(page, viewerSelector);
  var point = await getNodeCenter(page, viewerSelector, topicText);
  await page.mouse.move(point.x, point.y);
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.locator('#input-box')).toBeVisible();
  await expect.poll(async () => {
    return await readInputBoxText(page);
  }).toBe(topicText);
  await expect.poll(async () => {
    var state = await readInputBoxCaretState(page);
    return Boolean(
      state
      && state.inside
      && state.collapsed
      && state.selectedText === ''
      && state.caretOffset >= 0
      && state.caretOffset <= state.textLength
    );
  }).toBe(true);
  await clickInputBoxAtRatio(page, 0.26);
  await expect.poll(async () => {
    var state = await readInputBoxCaretState(page);
    return Boolean(
      state
      && state.inside
      && state.collapsed
      && state.selectedText === ''
      && state.caretOffset >= 0
      && state.caretOffset <= state.textLength
    );
  }).toBe(true);
  await clickInputBoxAtRatio(page, 0.74);
  await expect.poll(async () => {
    var state = await readInputBoxCaretState(page);
    return Boolean(
      state
      && state.inside
      && state.collapsed
      && state.selectedText === ''
      && state.caretOffset >= 0
      && state.caretOffset <= state.textLength
    );
  }).toBe(true);
  await page.waitForTimeout(220);
  await selectWholeInputBoxByDom(page);
  await expect.poll(async () => {
    return await page.evaluate(() => {
      var selection = window.getSelection ? window.getSelection() : null;
      return selection ? String(selection.toString() || '') : '';
    });
  }).toBe(topicText);
  await clickInputBoxAtRatio(page, 0.42);
  await expect.poll(async () => {
    var state = await readInputBoxCaretState(page);
    return Boolean(
      state
      && state.inside
      && state.collapsed
      && state.selectedText === ''
      && state.caretOffset > 0
      && state.caretOffset < state.textLength
    );
  }).toBe(true);
  await page.evaluate(() => {
    var input = document.getElementById('input-box');
    if (input && typeof input.blur === 'function') input.blur();
  });
  await page.waitForTimeout(120);
}

async function assertInputBoxDragSelectionCanDelete(page, viewerSelector) {
  var inputText = 'abcdefghij';
  await assertMouseBeginEditPlacesCaret(page, viewerSelector, '余额不足时支付失败');
  await beginInputBoxWithText(page, viewerSelector, '支付模块', inputText);
  await page.waitForTimeout(220);
  await selectWholeInputBoxByDom(page);
  await expect.poll(async () => {
    return await page.evaluate(() => {
      var selection = window.getSelection ? window.getSelection() : null;
      return selection ? String(selection.toString() || '') : '';
    });
  }).toBe(inputText);
  await clickInputBoxAtRatio(page, 0.48);
  await expect.poll(async () => {
    var state = await readInputBoxCaretState(page);
    return Boolean(
      state
      && state.inside
      && state.collapsed
      && state.selectedText === ''
      && state.caretOffset > 0
      && state.caretOffset < state.textLength
    );
  }).toBe(true);
  await doubleClickInputBoxAtRatio(page, 0.48);
  await expect.poll(async () => {
    return await page.evaluate(() => {
      var selection = window.getSelection ? window.getSelection() : null;
      return selection ? String(selection.toString() || '') : '';
    });
  }).toBe(inputText);
  await page.waitForTimeout(240);
  await expect.poll(async () => {
    return await page.evaluate(() => {
      var selection = window.getSelection ? window.getSelection() : null;
      return selection ? String(selection.toString() || '') : '';
    });
  }).toBe(inputText);
  await clickInputBoxAtRatio(page, 0.48);
  await expect.poll(async () => {
    var state = await readInputBoxCaretState(page);
    return Boolean(
      state
      && state.inside
      && state.collapsed
      && state.selectedText === ''
      && state.caretOffset > 0
      && state.caretOffset < state.textLength
    );
  }).toBe(true);
  await dragSelectWholeInputBox(page);
  await expect.poll(async () => {
    return await page.evaluate(() => {
      var selection = window.getSelection ? window.getSelection() : null;
      return selection ? String(selection.toString() || '') : '';
    });
  }).toBe(inputText);
  await page.keyboard.press('Backspace');
  await expect.poll(async () => {
    return await readInputBoxText(page);
  }).toBe('');
  await page.evaluate(() => {
    var input = document.getElementById('input-box');
    if (input && typeof input.blur === 'function') input.blur();
  });
  await page.waitForTimeout(80);
}

async function readExactTopicCount(page, viewerSelector, topicText) {
  return page.evaluate(({ viewer, topic }) => {
    var nodes = document.querySelectorAll(viewer + ' me-tpc');
    var count = 0;
    Array.prototype.forEach.call(nodes || [], function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      if (label === topic) count += 1;
    });
    return count;
  }, { viewer: viewerSelector, topic: topicText });
}

async function deleteTopicNode(page, viewerSelector, topicText) {
  await clickEditNode(page, viewerSelector, topicText);
  await expect(page.locator(viewerSelector + ' [data-mind-action="node-delete"]')).toBeEnabled();
  await page.locator(viewerSelector + ' [data-mind-action="node-delete"]').click();
  await page.waitForTimeout(620);
}

async function readDirectChildState(page, viewerSelector, parentTopic) {
  return page.evaluate(({ viewer, topic }) => {
    function normalize(value) {
      return value === undefined || value === null ? '' : String(value).replace(/\s+/g, ' ').trim();
    }
    var nodes = document.querySelectorAll(viewer + ' me-tpc');
    var target = null;
    Array.prototype.some.call(nodes || [], function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? normalize(typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent)
        : '';
      if (label !== topic) return false;
      target = node;
      return true;
    });
    if (!target || !target.nodeObj) return null;
    var children = Array.isArray(target.nodeObj.children) ? target.nodeObj.children : [];
    var emptyChildIds = [];
    var childTopics = [];
    children.forEach(function(child) {
      var childTopic = normalize(child && child.topic);
      childTopics.push(childTopic);
      if (!childTopic) emptyChildIds.push(String(child && child.id ? child.id : ''));
    });
    return {
      childCount: children.length,
      emptyChildCount: emptyChildIds.length,
      emptyChildIds: emptyChildIds,
      childTopics: childTopics,
    };
  }, { viewer: viewerSelector, topic: parentTopic });
}

async function clickFirstEmptyDirectChild(page, viewerSelector, parentTopic) {
  var point = await page.evaluate(({ viewer, topic }) => {
    function normalize(value) {
      return value === undefined || value === null ? '' : String(value).replace(/\s+/g, ' ').trim();
    }
    var nodes = document.querySelectorAll(viewer + ' me-tpc');
    var target = null;
    Array.prototype.some.call(nodes || [], function(node) {
      if (!node || !node.nodeObj || !node.nodeObj.parent) return false;
      var parentLabel = normalize(node.nodeObj.parent.topic);
      var currentLabel = normalize(node.nodeObj.topic);
      if (parentLabel !== topic || currentLabel) return false;
      target = node;
      return true;
    });
    if (!target || !target.getBoundingClientRect) return null;
    var rect = target.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: rect.left + (rect.width / 2),
      y: rect.top + (rect.height / 2),
    };
  }, { viewer: viewerSelector, topic: parentTopic });
  expect(point).toBeTruthy();
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
}

async function readMapTransform(page, viewerSelector) {
  return page.evaluate((viewer) => {
    var map = document.querySelector(viewer + ' .map-canvas');
    if (!map || !map.style) return '';
    return String(map.style.transform || '');
  }, viewerSelector);
}

async function setMapTransform(page, viewerSelector, transformText) {
  await page.evaluate(({ viewer, transform }) => {
    var map = document.querySelector(viewer + ' .map-canvas');
    if (map && map.style) map.style.transform = String(transform || '');
  }, { viewer: viewerSelector, transform: transformText });
}

async function assertDeletingFieldKeepsCase(page, viewerSelector) {
  await expect.poll(async () => {
    return await readExactTopicCount(page, viewerSelector, '其他途径先解锁皮肤');
  }).toBe(1);
  await deleteTopicNode(page, viewerSelector, '对应皮肤直接处于已拥有状态');
  await expect.poll(async () => {
    return await readExactTopicCount(page, viewerSelector, '其他途径先解锁皮肤');
  }).toBe(1);
  await expect.poll(async () => {
    return await readExactTopicCount(page, viewerSelector, '对应皮肤直接处于已拥有状态');
  }).toBe(0);
}

async function assertDeletingNewEmptyChildKeepsParentAndViewport(page, viewerSelector) {
  await clickEditNode(page, viewerSelector, '其他');
  var before = await readDirectChildState(page, viewerSelector, '其他');
  expect(before).toBeTruthy();
  await expect(page.locator(viewerSelector + ' [data-mind-action="node-add"]')).toBeEnabled();
  await page.locator(viewerSelector + ' [data-mind-action="node-add"]').click();
  await expect.poll(async () => {
    var state = await readDirectChildState(page, viewerSelector, '其他');
    return state ? state.emptyChildCount : -1;
  }).toBeGreaterThan(0);
  await clickFirstEmptyDirectChild(page, viewerSelector, '其他');
  var transformBefore = 'translate3d(-320px, -140px, 0px) scale(1)';
  await setMapTransform(page, viewerSelector, transformBefore);
  await expect(page.locator(viewerSelector + ' [data-mind-action="node-delete"]')).toBeEnabled();
  await page.locator(viewerSelector + ' [data-mind-action="node-delete"]').click();
  await page.waitForTimeout(360);
  await expect.poll(async () => {
    return await readExactTopicCount(page, viewerSelector, '其他');
  }).toBe(1);
  await expect.poll(async () => {
    var state = await readDirectChildState(page, viewerSelector, '其他');
    return state ? state.emptyChildCount : -1;
  }).toBe(0);
  await expect.poll(async () => {
    return await readMapTransform(page, viewerSelector);
  }).toBe(transformBefore);
}

async function runEditSelectionAssertions(page, viewerSelector) {
  await clearEditSelection(page, viewerSelector);
  await clickEditNode(page, viewerSelector, '余额不足时支付失败');
  await expectSelectedLabels(page, viewerSelector, ['余额不足时支付失败']);

  await clickEditNode(page, viewerSelector, '优惠券支付成功', true);
  await expectSelectedLabels(page, viewerSelector, ['余额不足时支付失败', '优惠券支付成功']);

  await clearEditSelection(page, viewerSelector);
  await expect.poll(async () => {
    return (await readEditSelectedLabels(page, viewerSelector)).length;
  }).toBe(0);

  await boxSelectTopics(page, viewerSelector, ['余额不足时支付失败', '优惠券支付成功']);
  await expect.poll(async () => {
    var labels = await readEditSelectedLabels(page, viewerSelector);
    return labels.filter(function(label) {
      return label === '余额不足时支付失败' || label === '优惠券支付成功';
    }).length;
  }).toBeGreaterThanOrEqual(2);

  await assertBoxDeleteRemovesTopics(page, viewerSelector, ['余额不足时支付失败', '优惠券支付成功']);
  await assertBoxDeleteRemovesTopics(page, viewerSelector, ['库存不足时下单失败', '提示库存不足', '地址缺失时提交失败', '提示收货地址必填']);
}

test.describe('XMind 编辑态节点选择', () => {
  test('用例库 XMind 编辑态支持单选、Ctrl 多选与框选', async ({ page }) => {
    const token = 'token-case-library-xmind-edit-selection';
    const user = { id: 129, username: 'xmind_edit_selection_user', role: 'admin', level: 'leader' };
    const project = { id: 1301, name: 'XMind编辑态选择项目' };
    const versions = [{ id: 1401, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 1501;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '编辑态节点选择用例集',
      reuse_enabled: false,
      item_count: 4,
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    }];
    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileId] = [{
      id: 15001,
      case_file_id: caseFileId,
      module: '支付模块',
      title: '余额不足时支付失败',
      priority: 'P1',
      precondition: '账号已登录',
      steps: '提交支付订单',
      expected: '提示余额不足',
      remark: '',
      created_at: now,
      updated_at: now,
    }, {
      id: 15002,
      case_file_id: caseFileId,
      module: '支付模块',
      title: '优惠券支付成功',
      priority: 'P2',
      precondition: '账号已登录且有可用优惠券',
      steps: '选择优惠券并提交支付',
      expected: '提示支付成功',
      remark: '',
      created_at: now,
      updated_at: now,
    }, {
      id: 15003,
      case_file_id: caseFileId,
      module: '下单模块',
      title: '库存不足时下单失败',
      priority: 'P1',
      precondition: '商品库存不足',
      steps: '提交下单请求',
      expected: '提示库存不足',
      remark: '',
      created_at: now,
      updated_at: now,
    }, {
      id: 15004,
      case_file_id: caseFileId,
      module: '配送模块',
      title: '地址缺失时提交失败',
      priority: 'P2',
      precondition: '购物车中存在商品',
      steps: '不填写收货地址直接提交',
      expected: '提示收货地址必填',
      remark: '',
      created_at: now,
      updated_at: now,
    }];

    await buildCaseLibraryRoutes(page, {
      token,
      user,
      project,
      versions,
      caseFiles,
      caseItemsByFileId,
    });

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('tap-theme-hint', 'light'); } catch (_) {}
      try { localStorage.setItem('usecase-settings-v1', JSON.stringify({ theme: 'light' })); } catch (_) {}
    }, { token });

    await gotoCaseLibrary(page);
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click('#caseLibraryEditListBody [data-case-lib-edit="' + String(caseFileId) + '"]');
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();

    await page.click('#caseLibraryXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    const viewer = page.locator('#caseLibraryXmindStructureViewer');
    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

    await runEditSelectionAssertions(page, '#caseLibraryXmindStructureViewer');
  });

  test('用例执行 XMind 编辑态支持单选、Ctrl 多选与框选', async ({ page }) => {
    const fileId = 'temp-xmind-edit-selection';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
    }, {
      files: [{
        id: fileId,
        name: '执行编辑态选择集',
        requirement: '执行编辑态选择需求',
        cases: [{
          module: '支付模块',
          title: '余额不足时支付失败',
          priority: 'P1',
          preconditions: '账号已登录',
          steps: '提交支付订单',
          expected: '提示余额不足',
          actual: '未执行',
          remark: '',
        }, {
          module: '支付模块',
          title: '优惠券支付成功',
          priority: 'P2',
          preconditions: '账号已登录且有可用优惠券',
          steps: '选择优惠券并提交支付',
          expected: '提示支付成功',
          actual: '未执行',
          remark: '',
        }, {
          module: '下单模块',
          title: '库存不足时下单失败',
          priority: 'P1',
          preconditions: '商品库存不足',
          steps: '提交下单请求',
          expected: '提示库存不足',
          actual: '未执行',
          remark: '',
        }, {
          module: '配送模块',
          title: '地址缺失时提交失败',
          priority: 'P2',
          preconditions: '购物车中存在商品',
          steps: '不填写收货地址直接提交',
          expected: '提示收货地址必填',
          actual: '未执行',
          remark: '',
        }],
      }],
      versions: [],
      activeId: fileId,
    });

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });

    await gotoExec(page);
    await waitExecReady(page);
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);

    await page.waitForFunction(() => {
      var btn = document.getElementById('tempExecXmindViewBtn');
      return Boolean(btn && !btn.disabled && !(btn.classList && btn.classList.contains('hidden')));
    }, {}, { timeout: 15000 });

    await openTempExecMoreActions(page);
    await page.click('#tempExecXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    const viewer = page.locator('#tempExecXmindStructureViewer');
    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

    await runEditSelectionAssertions(page, '#tempExecXmindStructureViewer');
  });

  test('用例库 XMind 编辑文本支持鼠标拖选后删除', async ({ page }) => {
    const token = 'token-case-library-xmind-edit-text-selection';
    const user = { id: 131, username: 'xmind_edit_text_selection_user', role: 'admin', level: 'leader' };
    const project = { id: 1601, name: 'XMind编辑文本选择项目' };
    const versions = [{ id: 1701, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 1801;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '编辑文本拖选用例集',
      reuse_enabled: false,
      item_count: 1,
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    }];
    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileId] = [{
      id: 18001,
      case_file_id: caseFileId,
      module: '支付模块',
      title: '余额不足时支付失败',
      priority: 'P1',
      precondition: '账号已登录',
      steps: '提交支付订单',
      expected: '提示余额不足',
      remark: '',
      created_at: now,
      updated_at: now,
    }];

    await buildCaseLibraryRoutes(page, {
      token,
      user,
      project,
      versions,
      caseFiles,
      caseItemsByFileId,
    });

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('tap-theme-hint', 'light'); } catch (_) {}
      try { localStorage.setItem('usecase-settings-v1', JSON.stringify({ theme: 'light' })); } catch (_) {}
    }, { token });

    await gotoCaseLibrary(page);
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click('#caseLibraryEditListBody [data-case-lib-edit="' + String(caseFileId) + '"]');
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();

    await page.click('#caseLibraryXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    const viewer = page.locator('#caseLibraryXmindStructureViewer');
    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

    await assertInputBoxDragSelectionCanDelete(page, '#caseLibraryXmindStructureViewer');
  });

  test('用例执行 XMind 编辑文本支持鼠标拖选后删除', async ({ page }) => {
    const fileId = 'temp-xmind-edit-text-selection';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
    }, {
      files: [{
        id: fileId,
        name: '执行编辑文本拖选集',
        requirement: '执行编辑文本拖选需求',
        cases: [{
          module: '支付模块',
          title: '余额不足时支付失败',
          priority: 'P1',
          preconditions: '账号已登录',
          steps: '提交支付订单',
          expected: '提示余额不足',
          actual: '未执行',
          remark: '',
        }],
      }],
      versions: [],
      activeId: fileId,
    });

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });

    await gotoExec(page);
    await waitExecReady(page);
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);

    await page.waitForFunction(() => {
      var btn = document.getElementById('tempExecXmindViewBtn');
      return Boolean(btn && !btn.disabled && !(btn.classList && btn.classList.contains('hidden')));
    }, {}, { timeout: 15000 });

    await openTempExecMoreActions(page);
    await page.click('#tempExecXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    const viewer = page.locator('#tempExecXmindStructureViewer');
    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

    await assertInputBoxDragSelectionCanDelete(page, '#tempExecXmindStructureViewer');
  });

  test('用例库 XMind 编辑删除只移除真实选中分支和新增子节点', async ({ page }) => {
    const token = 'token-case-library-xmind-real-delete-target';
    const user = { id: 132, username: 'xmind_real_delete_user', role: 'admin', level: 'leader' };
    const project = { id: 1901, name: 'XMind真实删除项目' };
    const versions = [{ id: 1902, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 1903;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '真实删除目标用例集',
      reuse_enabled: false,
      item_count: 1,
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    }];
    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileId] = [{
      id: 19031,
      case_file_id: caseFileId,
      module: '其他',
      title: '其他途径先解锁皮肤',
      priority: 'P2',
      precondition: '未拥有全部皮肤',
      steps: '1、好友赠送一个皮肤\n2、先进入金框商城购买皮肤，再观察好友赠送的皮肤能否领取',
      expected: '对应皮肤直接处于已拥有状态',
      remark: '',
      created_at: now,
      updated_at: now,
    }];

    await buildCaseLibraryRoutes(page, {
      token,
      user,
      project,
      versions,
      caseFiles,
      caseItemsByFileId,
    });

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('tap-theme-hint', 'light'); } catch (_) {}
      try { localStorage.setItem('usecase-settings-v1', JSON.stringify({ theme: 'light' })); } catch (_) {}
    }, { token });

    await gotoCaseLibrary(page);
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click('#caseLibraryEditListBody [data-case-lib-edit="' + String(caseFileId) + '"]');
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();

    await page.click('#caseLibraryXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    const viewer = page.locator('#caseLibraryXmindStructureViewer');
    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

    await assertDeletingFieldKeepsCase(page, '#caseLibraryXmindStructureViewer');
    await assertDeletingNewEmptyChildKeepsParentAndViewport(page, '#caseLibraryXmindStructureViewer');
  });

  test('用例执行 XMind 编辑删除只移除真实选中分支和新增子节点', async ({ page }) => {
    const fileId = 'temp-xmind-real-delete-target';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
    }, {
      files: [{
        id: fileId,
        name: '执行真实删除目标集',
        requirement: '执行真实删除目标需求',
        cases: [{
          module: '其他',
          title: '其他途径先解锁皮肤',
          priority: 'P2',
          preconditions: '未拥有全部皮肤',
          steps: '1、好友赠送一个皮肤\n2、先进入金框商城购买皮肤，再观察好友赠送的皮肤能否领取',
          expected: '对应皮肤直接处于已拥有状态',
          actual: '未执行',
          remark: '',
        }],
      }],
      versions: [],
      activeId: fileId,
    });

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });

    await gotoExec(page);
    await waitExecReady(page);
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);

    await page.waitForFunction(() => {
      var btn = document.getElementById('tempExecXmindViewBtn');
      return Boolean(btn && !btn.disabled && !(btn.classList && btn.classList.contains('hidden')));
    }, {}, { timeout: 15000 });

    await openTempExecMoreActions(page);
    await page.click('#tempExecXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    const viewer = page.locator('#tempExecXmindStructureViewer');
    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

    await assertDeletingFieldKeepsCase(page, '#tempExecXmindStructureViewer');
    await assertDeletingNewEmptyChildKeepsParentAndViewport(page, '#tempExecXmindStructureViewer');
  });
});
