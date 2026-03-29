const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html?_=' + Date.now().toString(36));
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

async function mockCaseGenApisWithModel(page, token, user, options) {
  const opts = options || {};
  const modelRemoteId = opts.modelRemoteId || 901;
  const featureId = opts.featureId || 5001;
  const caseGenPrompt = opts.caseGenPrompt || '请仅输出 JSON 数组';
  const modelId = String(modelRemoteId);

  await page.addInitScript((tk) => {
    try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
  }, token);

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;
    const method = route.request().method();
    const tokenHeader = route.request().headers().authorization || '';
    const authed = tokenHeader === `Bearer ${token}`;
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathName === '/api/users/me' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, user);
    }
    if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
    if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
    if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
    if (pathName === '/api/models' && method === 'GET') {
      return respond(200, [{
        id: modelRemoteId,
        name: 'MockCaseGenModel',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          provider: 'custom',
          baseUrl: 'https://mock-model.local/v1/chat/completions',
          apiKey: 'mock-key',
          model: 'mock-model',
          maxTokens: 1024,
        },
      }]);
    }
    if (pathName === '/api/features' && method === 'GET') {
      return respond(200, [{
        id: featureId,
        name: 'default',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          caseGenId: modelId,
          caseGenPrompt: caseGenPrompt,
        },
      }]);
    }
    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  });

  return { modelId: modelId };
}

async function waitCaseGenModelAssigned(page, expectedModelId) {
  await page.waitForFunction((modelId) => {
    const state = window.app && window.app.state ? window.app.state : null;
    if (!state || !state.assignments || !Array.isArray(state.models)) return false;
    return String(state.assignments.caseGenId || '') === String(modelId);
  }, expectedModelId, { timeout: 10000 });
}

async function seedRequirementAndSplit(page, payload) {
  const data = payload || {};
  const modules = Array.isArray(data.modules) && data.modules.length
    ? data.modules
    : [
        { module: '登录模块', key_scenarios: ['账号密码登录'], test_points: ['账号密码校验'], coupled_modules: ['用户中心'] },
        { module: '支付模块', key_scenarios: ['订单支付'], test_points: ['支付回调'], coupled_modules: ['订单中心'] },
      ];
  const requirementLabel = data.requirementLabel || 'XMind需求';
  const rawText = data.rawText || '这是一个用于 XMind 用例生成测试的需求。';
  const caseText = data.caseText || '历史参考用例：登录成功；支付成功。';

  await page.evaluate((input) => {
    var rawTextEl = document.getElementById('rawText');
    var splitEl = document.getElementById('splitResult');
    var caseTextEl = document.getElementById('caseText');
    if (rawTextEl) {
      rawTextEl.removeAttribute('readonly');
      rawTextEl.value = input.rawText;
      rawTextEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (splitEl) {
      splitEl.removeAttribute('readonly');
      splitEl.value = JSON.stringify(input.modules);
      splitEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (caseTextEl) {
      caseTextEl.removeAttribute('readonly');
      caseTextEl.value = input.caseText;
      caseTextEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.requirementLabel = input.requirementLabel;
      window.app.state.requirementLabelSource = 'ui-test';
      window.app.state.lastRawImportName = 'xmind-casegen.txt';
    }
  }, {
    modules: modules,
    requirementLabel: requirementLabel,
    rawText: rawText,
    caseText: caseText,
  });
}

async function openAiTab(page, tabName) {
  await page.click('.tab-group-btn[data-group="ai"]');
  const tabBtn = page.locator('[data-tab-btn="' + tabName + '"]');
  await expect(tabBtn).toBeVisible();
  await tabBtn.click();
  await expect(page.locator('[data-tab-section="' + tabName + '"]').first()).toBeVisible();
}

async function openXmindCaseGenDrawer(page) {
  await openAiTab(page, 'casesgen');
  await page.click('#caseGenModulesTabBtn');
  await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
  await page.click('#xmindCaseGenOpenBtn');
  await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
  await expect(page.locator('#xmindCaseGenDrawerBody')).toBeVisible();
  await expect(page.locator('#xmindCaseGenMindContainer [data-mind-controls]')).toBeVisible();
  await expect(page.locator('#xmindCaseGenSummaryBtn')).toBeVisible();
}

async function installCaseGenModelStub(page, delayMs) {
  await page.evaluate((delay) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    window.__xmindCasegenCalls = [];
    window.__xmindCasegenByModule = {};
    client.proxyModelRequest = function(payload, signal) {
      var modelPayload = payload && payload.payload ? payload.payload : {};
      var messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
      var promptText = messages[0] && messages[0].content ? String(messages[0].content) : '';
      var userText = messages[1] && messages[1].content ? String(messages[1].content) : '';
      var match = userText.match(/"module":"([^"]+)"/);
      var moduleName = match && match[1] ? match[1] : '模块';
      var isTopup = userText.indexOf('已有用例(JSON)') !== -1;
      if (!window.__xmindCasegenByModule[moduleName]) {
        window.__xmindCasegenByModule[moduleName] = { generate: 0, topup: 0 };
      }
      var stat = window.__xmindCasegenByModule[moduleName];
      var responseCases;
      if (isTopup) {
        stat.topup += 1;
        responseCases = [{
          module: moduleName,
          title: moduleName + '-追加-' + stat.topup,
          priority: 'P2',
          preconditions: '补充前置条件',
          steps: ['补充步骤1'],
          expected: '补充预期',
        }];
      } else {
        stat.generate += 1;
        responseCases = [{
          module: moduleName,
          title: moduleName + '-用例-' + stat.generate,
          priority: 'P1',
          preconditions: '前置条件',
          steps: ['步骤1'],
          expected: '预期结果',
        }];
      }
      window.__xmindCasegenCalls.push({
        moduleName: moduleName,
        isTopup: isTopup,
        prompt: promptText,
        user: userText,
      });
      var content = JSON.stringify(responseCases);
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          resolve({
            ok: true,
            status: 200,
            text: function() {
              return Promise.resolve(JSON.stringify({
                choices: [{ message: { content: content } }],
              }));
            },
          });
        }, Number(delay) || 250);
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', function() {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    };
  }, delayMs || 250);
}

async function waitForNodeText(page, text) {
  await page.waitForFunction((expected) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(expected) !== -1;
    });
  }, text, { timeout: 15000 });
}

async function waitForNodeTextAbsent(page, text) {
  await page.waitForFunction((expected) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return !Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(expected) !== -1;
    });
  }, text, { timeout: 15000 });
}

async function waitForNodeStatus(page, topicText, statusText) {
  await page.waitForFunction(({ topic, status }) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      var badge = node && node.querySelector ? node.querySelector('.xmind-node-status-badge') : null;
      var badgeText = badge && badge.textContent ? String(badge.textContent).replace(/\s+/g, ' ').trim() : '';
      return badgeText.indexOf(status) !== -1;
    });
  }, { topic: topicText, status: statusText }, { timeout: 15000 });
}

async function waitForNodeStatusAbsent(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.every.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return true;
      return !(node.querySelector && node.querySelector('.xmind-node-status-badge'));
    });
  }, topicText, { timeout: 15000 });
}

async function waitForXmindInlineStatusEmpty(page) {
  await page.waitForFunction(() => {
    var el = document.getElementById('xmindCaseGenStatus');
    return Boolean(el) && !String(el.textContent || '').trim();
  }, {}, { timeout: 15000 });
}

async function readNodeSpinnerSnapshot(page, topicText) {
  return page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var spinner = null;
    Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      spinner = node && node.querySelector ? node.querySelector('.xmind-node-status-spinner') : null;
      return Boolean(spinner);
    });
    if (!spinner || typeof window.getComputedStyle !== 'function') return null;
    var style = window.getComputedStyle(spinner);
    var animations = typeof spinner.getAnimations === 'function' ? spinner.getAnimations() : [];
    var runningCount = 0;
    if (Array.isArray(animations) && animations.length) {
      animations.forEach(function(anim) {
        if (anim && anim.playState === 'running') {
          runningCount += 1;
        }
      });
    }
    return {
      animationName: String(style.animationName || ''),
      animationDuration: String(style.animationDuration || ''),
      animationPlayState: String(style.animationPlayState || ''),
      display: String(style.display || ''),
      animationsCount: Array.isArray(animations) ? animations.length : 0,
      animationsRunning: runningCount,
    };
  }, topicText);
}

async function readTopupPlaceholderState(page) {
  return page.evaluate(() => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var nodeObj = node && node.nodeObj ? node.nodeObj : null;
      var meta = nodeObj && nodeObj.xmindMeta && typeof nodeObj.xmindMeta === 'object'
        ? nodeObj.xmindMeta
        : {};
      if (String(meta.type || '') !== 'topup-placeholder') return false;
      target = node;
      return true;
    });
    if (!target) return null;
    var wrapper = target.closest ? target.closest('me-wrapper') : null;
    var childrenEl = wrapper && wrapper.parentElement ? wrapper.parentElement : null;
    var parentWrapper = childrenEl && childrenEl.tagName && String(childrenEl.tagName).toLowerCase() === 'me-children'
      ? childrenEl.parentElement
      : null;
    var subLines = null;
    if (parentWrapper && parentWrapper.children) {
      for (var i = 0; i < parentWrapper.children.length; i += 1) {
        var child = parentWrapper.children[i];
        if (!child || !child.tagName) continue;
        if (String(child.tagName).toLowerCase() !== 'svg') continue;
        if (!(child.classList && child.classList.contains('subLines'))) continue;
        subLines = child;
        break;
      }
    }
    var paths = subLines && subLines.querySelectorAll ? subLines.querySelectorAll('path') : [];
    var pendingPath = paths && paths.length ? paths[paths.length - 1] : null;
    return {
      topic: target && target.textContent ? String(target.textContent).replace(/\s+/g, ' ').trim() : '',
      className: target && target.className ? String(target.className) : '',
      linkDash: pendingPath && pendingPath.getAttribute ? String(pendingPath.getAttribute('stroke-dasharray') || '') : '',
      linkMarker: pendingPath && pendingPath.getAttribute ? String(pendingPath.getAttribute('data-xmind-casegen-link') || '') : '',
      linkClass: pendingPath && pendingPath.getAttribute ? String(pendingPath.getAttribute('class') || '') : '',
    };
  });
}

async function waitForTopupHighlightState(page, expectedTitles) {
  await page.waitForFunction((titles) => {
    var expected = Array.isArray(titles) ? titles.slice().sort() : [];
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc[data-xmind-topup-highlight-token]');
    var actual = Array.prototype.map.call(nodes, function(node) {
      var nodeObj = node && node.nodeObj ? node.nodeObj : null;
      return nodeObj && nodeObj.topic !== undefined && nodeObj.topic !== null ? String(nodeObj.topic) : '';
    }).filter(Boolean).sort();
    if (actual.length !== expected.length) return false;
    for (var i = 0; i < actual.length; i += 1) {
      if (actual[i] !== expected[i]) return false;
    }
    var frame = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
    var label = frame && frame.querySelector ? frame.querySelector('.xmind-casegen-topup-highlight-label') : null;
    return Boolean(frame && label && String(label.textContent || '').indexOf('本轮追加用例') !== -1);
  }, expectedTitles, { timeout: 15000 });
}

async function waitForNoTopupHighlightState(page) {
  await page.waitForFunction(() => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc[data-xmind-topup-highlight-token]');
    var frame = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
    return nodes.length === 0 && !frame;
  }, {}, { timeout: 15000 });
}

async function readTopupHighlightState(page) {
  return page.evaluate(() => {
    var frame = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
    var labelEl = frame && frame.querySelector ? frame.querySelector('.xmind-casegen-topup-highlight-label') : null;
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc[data-xmind-topup-highlight-token]');
    var titles = Array.prototype.map.call(nodes, function(node) {
      var nodeObj = node && node.nodeObj ? node.nodeObj : null;
      return nodeObj && nodeObj.topic !== undefined && nodeObj.topic !== null ? String(nodeObj.topic) : '';
    }).filter(Boolean).sort();
    return {
      frameCount: frame ? 1 : 0,
      label: labelEl && labelEl.textContent ? String(labelEl.textContent).replace(/\s+/g, ' ').trim() : '',
      titles: titles,
    };
  });
}

async function adjustMindView(page) {
  await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-in"]');
  await page.evaluate(() => {
    var viewer = document.getElementById('xmindCaseGenMindContainer');
    if (!viewer) return;
    viewer.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: 120,
      deltaY: 80,
    }));
  });
  await page.waitForTimeout(140);
}

async function readMindTransform(page) {
  return page.evaluate(() => {
    var canvas = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
    return canvas && canvas.style ? String(canvas.style.transform || '') : '';
  });
}

async function readNodeViewportCenter(page, topicText, nodeType) {
  return page.evaluate(({ topic, type }) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var nodeObj = node && node.nodeObj ? node.nodeObj : null;
      var meta = nodeObj && nodeObj.xmindMeta && typeof nodeObj.xmindMeta === 'object' ? nodeObj.xmindMeta : {};
      var nodeTopic = nodeObj && nodeObj.topic !== undefined && nodeObj.topic !== null ? String(nodeObj.topic) : '';
      if (type && String(meta.type || '') !== type) return false;
      if (nodeTopic !== topic) return false;
      target = node;
      return true;
    });
    if (!target || !target.getBoundingClientRect) return null;
    var rectTarget = target;
    if (target.querySelector) {
      var textEl = target.querySelector('.text');
      if (textEl && textEl.getBoundingClientRect) {
        rectTarget = textEl;
      }
    }
    var rect = rectTarget.getBoundingClientRect();
    return {
      x: Number(rect.left + (rect.width / 2)),
      y: Number(rect.top + (rect.height / 2)),
    };
  }, { topic: topicText, type: nodeType || '' });
}

async function readViewerCenter(page) {
  return page.evaluate(() => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer [data-mind-canvas]')
      || document.getElementById('xmindCaseGenMindContainer');
    if (!viewer || !viewer.getBoundingClientRect) return null;
    var rect = viewer.getBoundingClientRect();
    return {
      x: Number(rect.left + (rect.width / 2)),
      y: Number(rect.top + (rect.height / 2)),
    };
  });
}

async function seedModuleCases(page, moduleTitle, count) {
  await page.evaluate(({ title, size }) => {
    var state = window.app && window.app.state ? window.app.state : null;
    if (!state || !Array.isArray(state.caseGenModules)) return;
    state.caseGenModules.some(function(mod) {
      var currentTitle = mod && (mod.title || mod.module) ? String(mod.title || mod.module) : '';
      if (currentTitle !== title || !mod.id) return false;
      var list = [];
      for (var i = 0; i < size; i += 1) {
        list.push({
          module: title,
          title: title + '-预置用例-' + (i + 1),
          priority: i % 2 === 0 ? 'P1' : 'P2',
          preconditions: '前置条件-' + (i + 1),
          steps: ['步骤-' + (i + 1)],
          expected: '预期-' + (i + 1),
        });
      }
      if (!state.caseGenResults) state.caseGenResults = {};
      state.caseGenResults[mod.id] = JSON.stringify(list);
      return true;
    });
  }, { title: moduleTitle, size: count });
}

async function forceLongXmindSummary(page) {
  await page.evaluate(() => {
    var requirementSummary = document.getElementById('xmindCaseGenRequirementSummary');
    var requirementMeta = document.getElementById('xmindCaseGenRequirementMeta');
    var casesSummary = document.getElementById('xmindCaseGenCasesSummary');
    var casesMeta = document.getElementById('xmindCaseGenCasesMeta');
    var longText = Array(20).fill('这是一段用于验证 XMind 摘要区智能滚动的超长文本内容').join('');
    if (requirementSummary) requirementSummary.textContent = longText;
    if (requirementMeta) requirementMeta.textContent = longText;
    if (casesSummary) casesSummary.textContent = longText;
    if (casesMeta) casesMeta.textContent = longText;
  });
}

async function openXmindCaseGenSummaryDialog(page) {
  await page.click('#xmindCaseGenSummaryBtn');
  await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
}

async function closeXmindCaseGenSummaryDialog(page) {
  await page.click('#xmindCaseGenSummaryCloseBtn');
  await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);
}

async function readXmindSummaryLayout(page) {
  return page.evaluate(() => {
    var drawerBodyEl = document.getElementById('xmindCaseGenDrawerBody');
    var toolbarEl = document.getElementById('xmindCaseGenToolbar');
    var summaryBtn = document.getElementById('xmindCaseGenSummaryBtn');
    var statusEl = document.getElementById('xmindCaseGenStatus');
    var overlayEl = document.getElementById('xmindCaseGenSummaryOverlay');
    var dialogEl = document.getElementById('xmindCaseGenSummaryDialog');
    var dialogBodyEl = document.getElementById('xmindCaseGenSummaryDialogBody');
    var viewerEl = document.getElementById('xmindCaseGenMindContainer');
    var controlsEl = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
    var inlineActionsEl = controlsEl && controlsEl.querySelector
      ? controlsEl.querySelector('[data-xmind-casegen-inline-actions]')
      : null;
    var drawerBodyRect = drawerBodyEl && drawerBodyEl.getBoundingClientRect ? drawerBodyEl.getBoundingClientRect() : null;
    var toolbarRect = toolbarEl && toolbarEl.getBoundingClientRect ? toolbarEl.getBoundingClientRect() : null;
    var viewerRect = viewerEl && viewerEl.getBoundingClientRect ? viewerEl.getBoundingClientRect() : null;
    var dialogRect = dialogEl && dialogEl.getBoundingClientRect ? dialogEl.getBoundingClientRect() : null;
    var drawerCenterX = drawerBodyRect ? Number(drawerBodyRect.left + (drawerBodyRect.width / 2)) : 0;
    var drawerCenterY = drawerBodyRect ? Number(drawerBodyRect.top + (drawerBodyRect.height / 2)) : 0;
    var dialogCenterX = dialogRect ? Number(dialogRect.left + (dialogRect.width / 2)) : 0;
    var dialogCenterY = dialogRect ? Number(dialogRect.top + (dialogRect.height / 2)) : 0;
    return {
      drawerClientHeight: drawerBodyEl ? Number(drawerBodyEl.clientHeight || 0) : 0,
      drawerScrollHeight: drawerBodyEl ? Number(drawerBodyEl.scrollHeight || 0) : 0,
      drawerScrollable: Boolean(drawerBodyEl && drawerBodyEl.scrollHeight > drawerBodyEl.clientHeight + 1),
      toolbarHidden: Boolean(toolbarEl && toolbarEl.hidden === true),
      toolbarHeight: toolbarRect ? Number(toolbarRect.height || 0) : 0,
      viewerTop: viewerRect ? Number(viewerRect.top || 0) : 0,
      viewerHeight: viewerRect ? Number(viewerRect.height || 0) : 0,
      controlsHeight: controlsEl && controlsEl.getBoundingClientRect ? Number(controlsEl.getBoundingClientRect().height || 0) : 0,
      summaryButtonInControls: Boolean(controlsEl && summaryBtn && controlsEl.contains(summaryBtn)),
      summaryButtonInInlineActions: Boolean(inlineActionsEl && summaryBtn && inlineActionsEl.contains(summaryBtn)),
      statusInControls: Boolean(controlsEl && statusEl && controlsEl.contains(statusEl)),
      inlineActionsCount: inlineActionsEl && inlineActionsEl.querySelectorAll ? inlineActionsEl.querySelectorAll('button').length : 0,
      overlayOpen: Boolean(overlayEl && overlayEl.hidden === false && overlayEl.classList && overlayEl.classList.contains('is-open')),
      buttonText: summaryBtn && summaryBtn.textContent ? String(summaryBtn.textContent).trim() : '',
      buttonExpanded: summaryBtn ? String(summaryBtn.getAttribute('aria-expanded') || '') : '',
      dialogWidth: dialogRect ? Number(dialogRect.width || 0) : 0,
      dialogHeight: dialogRect ? Number(dialogRect.height || 0) : 0,
      dialogBodyClientHeight: dialogBodyEl ? Number(dialogBodyEl.clientHeight || 0) : 0,
      dialogBodyScrollHeight: dialogBodyEl ? Number(dialogBodyEl.scrollHeight || 0) : 0,
      dialogCenterOffsetX: dialogCenterX - drawerCenterX,
      dialogCenterOffsetY: dialogCenterY - drawerCenterY,
    };
  });
}

async function readNodeDecorationGeometry(page, topicText) {
  return page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    var quickTarget = null;
    var fallback = null;
    Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      if (!fallback) fallback = node;
      var badge = node.querySelector ? node.querySelector('.xmind-node-status-badge') : null;
      var quick = node.querySelector ? node.querySelector('.xmind-node-quick-action') : null;
      if (badge) {
        target = node;
        return true;
      }
      if (!quickTarget && quick) quickTarget = node;
      return false;
    });
    if (!target) target = quickTarget || fallback;
    if (!target || !target.getBoundingClientRect) return null;
    var badge = target.querySelector ? target.querySelector('.xmind-node-status-badge') : null;
    var quick = target.querySelector ? target.querySelector('.xmind-node-quick-action') : null;
    var nodeRect = target.getBoundingClientRect();
    var badgeRect = badge && badge.getBoundingClientRect ? badge.getBoundingClientRect() : null;
    var quickRect = quick && quick.getBoundingClientRect ? quick.getBoundingClientRect() : null;
    return {
      flowSide: target.classList && target.classList.contains('xmind-casegen-node-flow-left')
        ? 'left'
        : 'right',
      node: {
        left: nodeRect.left,
        right: nodeRect.right,
        top: nodeRect.top,
        bottom: nodeRect.bottom,
      },
      badge: badgeRect ? {
        left: badgeRect.left,
        right: badgeRect.right,
        top: badgeRect.top,
        bottom: badgeRect.bottom,
      } : null,
      quick: quickRect ? {
        left: quickRect.left,
        right: quickRect.right,
        top: quickRect.top,
        bottom: quickRect.bottom,
      } : null,
    };
  }, topicText);
}

function expectDecorationFollowNodeFlow(geometry) {
  expect(geometry).toBeTruthy();
  expect(geometry.badge).toBeTruthy();
  expect(geometry.quick).toBeTruthy();
  if (geometry.flowSide === 'left') {
    expect(geometry.badge.right).toBeLessThan(geometry.node.left);
    expect(geometry.quick.right).toBeLessThan(geometry.badge.left);
    return;
  }
  expect(geometry.badge.left).toBeGreaterThan(geometry.node.right);
  expect(geometry.quick.left).toBeGreaterThan(geometry.badge.right);
}

async function clickNodeQuickAction(page, topicText) {
  await waitForNodeText(page, topicText);
  const clicked = await page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      target = node;
      return true;
    });
    if (!target || !target.querySelector) return false;
    var btn = target.querySelector('.xmind-node-quick-action');
    if (!btn || btn.disabled || typeof btn.click !== 'function') return false;
    btn.click();
    return true;
  }, topicText);
  expect(clicked).toBeTruthy();
}

async function openNodeContextMenu(page, topicText) {
  await waitForNodeText(page, topicText);
  const opened = await page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      target = node;
      return true;
    });
    if (!target || !target.getBoundingClientRect) return false;
    var rect = target.getBoundingClientRect();
    var clientX = rect.left + Math.min(40, Math.max(rect.width / 2, 8));
    var clientY = rect.top + Math.min(18, Math.max(rect.height / 2, 8));
    target.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 2,
      clientX: clientX,
      clientY: clientY,
    }));
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 2,
      clientX: clientX,
      clientY: clientY,
    }));
    return true;
  }, topicText);
  expect(opened).toBeTruthy();
  await expect(page.locator('.xmind-node-context-menu')).toHaveClass(/is-open/);
}

async function readModuleCaseTitles(page, moduleTitle) {
  return page.evaluate((title) => {
    var state = window.app && window.app.state ? window.app.state : null;
    if (!state || !Array.isArray(state.caseGenModules)) return [];
    var mod = null;
    state.caseGenModules.some(function(item) {
      var currentTitle = item && (item.title || item.module) ? String(item.title || item.module) : '';
      if (currentTitle !== title) return false;
      mod = item;
      return true;
    });
    if (!mod || !state.caseGenResults || !state.caseGenResults[mod.id]) return [];
    try {
      return JSON.parse(state.caseGenResults[mod.id]).map(function(item) {
        return item && item.title ? String(item.title) : '';
      }).filter(Boolean);
    } catch (err) {
      return [];
    }
  }, moduleTitle);
}

test.describe('XMind 用例生成抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('支持模块骨架、根节点完整生成，并在刷新后恢复共享结果', async ({ page }) => {
    const token = 'token-xmind-casegen-flow';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const mocked = await mockCaseGenApisWithModel(page, token, user, { caseGenPrompt: 'XMind页提示词' });
    await gotoIndex(page);
    await waitCaseGenModelAssigned(page, mocked.modelId);
    await seedRequirementAndSplit(page);

    await openXmindCaseGenDrawer(page);
    await expect(page.locator('#xmindCaseGenSummaryBtn')).toBeVisible();
    const inlineLayoutAtOpen = await readXmindSummaryLayout(page);
    expect(inlineLayoutAtOpen.toolbarHidden).toBeTruthy();
    expect(inlineLayoutAtOpen.summaryButtonInControls).toBeTruthy();
    expect(inlineLayoutAtOpen.summaryButtonInInlineActions).toBeTruthy();
    await openXmindCaseGenSummaryDialog(page);
    await expect(page.locator('#xmindCaseGenRequirementSummary')).toContainText('XMind需求');
    await expect(page.locator('#xmindCaseGenCasesSummary')).toContainText('手工输入');
    await closeXmindCaseGenSummaryDialog(page);

    await page.click('#xmindCaseGenGenerateModulesBtn');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await expect(page.locator('.temp-center-toast.ok')).toContainText('已生成模块骨架');
    await waitForXmindInlineStatusEmpty(page);

    const fullscreenBtn = page.locator('#xmindCaseGenMindContainer [data-mind-action="drawer-fullscreen"]');
    await expect(fullscreenBtn).toHaveText('全屏');
    await fullscreenBtn.click();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);

    await installCaseGenModelStub(page, 450);
    await adjustMindView(page);
    const rootCenterBefore = await readNodeViewportCenter(page, 'XMind需求', 'root');
    expect(rootCenterBefore).toBeTruthy();
    await clickNodeQuickAction(page, 'XMind需求');
    await waitForNodeStatus(page, '登录模块', '生成中');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    await expect(fullscreenBtn).toHaveText('复原');
    const loginSpinnerStart = await readNodeSpinnerSnapshot(page, '登录模块');
    expect(loginSpinnerStart).toBeTruthy();
    expect(loginSpinnerStart.animationName).toContain('flow-step-spin');
    expect(loginSpinnerStart.animationDuration).not.toBe('0s');
    expect(loginSpinnerStart.animationPlayState).toBe('running');
    expect(loginSpinnerStart.animationsRunning).toBeGreaterThan(0);
    const runningGeometry = await readNodeDecorationGeometry(page, '登录模块');
    expectDecorationFollowNodeFlow(runningGeometry);
    await waitForNodeStatus(page, '支付模块', '生成中');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    const secondRunningGeometry = await readNodeDecorationGeometry(page, '支付模块');
    expectDecorationFollowNodeFlow(secondRunningGeometry);
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !Array.isArray(state.caseGenModules) || state.caseGenModules.length < 2) return false;
      return state.caseGenModules.every(function(mod) {
        return Boolean(state.caseGenResults && state.caseGenResults[mod.id] && String(state.caseGenResults[mod.id]).trim());
      });
    }, {}, { timeout: 20000 });
    await waitForNodeText(page, '登录模块-用例-1');
    await waitForNodeText(page, '支付模块-用例-1');
    await waitForNodeStatusAbsent(page, '登录模块');
    await waitForNodeStatusAbsent(page, '支付模块');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    await expect(fullscreenBtn).toHaveText('复原');
    const rootCenterAfter = await readNodeViewportCenter(page, 'XMind需求', 'root');
    expect(rootCenterAfter).toBeTruthy();
    expect(Math.abs(rootCenterAfter.x - rootCenterBefore.x)).toBeLessThan(8);
    expect(Math.abs(rootCenterAfter.y - rootCenterBefore.y)).toBeLessThan(8);
    await fullscreenBtn.click();
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/xmind-drawer-fullscreen/);

    await page.click('#closeXmindCaseGenDrawerBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);
    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块-用例-1');
    await page.waitForTimeout(520);
    const reopenedRootCenter = await readNodeViewportCenter(page, 'XMind需求', 'root');
    const reopenedViewerCenter = await readViewerCenter(page);
    expect(reopenedRootCenter).toBeTruthy();
    expect(reopenedViewerCenter).toBeTruthy();
    expect(Math.abs(reopenedRootCenter.x - reopenedViewerCenter.x)).toBeLessThan(32);
    expect(Math.abs(reopenedRootCenter.y - reopenedViewerCenter.y)).toBeLessThan(32);
    await page.click('#closeXmindCaseGenDrawerBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await openAiTab(page, 'casesgen');
    await page.click('#caseGenModulesTabBtn');
    await expect(page.locator('#casesGenerationContainer [data-view]').first()).toBeEnabled();
    const sharedTitles = await readModuleCaseTitles(page, '登录模块');
    expect(sharedTitles).toContain('登录模块-用例-1');

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await waitCaseGenModelAssigned(page, mocked.modelId);
    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块-用例-1');
    await waitForNodeText(page, '支付模块-用例-1');
    await page.waitForTimeout(520);
    const reloadRootCenter = await readNodeViewportCenter(page, 'XMind需求', 'root');
    const reloadViewerCenter = await readViewerCenter(page);
    expect(reloadRootCenter).toBeTruthy();
    expect(reloadViewerCenter).toBeTruthy();
    expect(Math.abs(reloadRootCenter.x - reloadViewerCenter.x)).toBeLessThan(32);
    expect(Math.abs(reloadRootCenter.y - reloadViewerCenter.y)).toBeLessThan(32);
  });

  test('根节点重新生成全部时会并发触发多个模块并全部刷新结果', async ({ page }) => {
    const token = 'token-xmind-casegen-regenerate-all';
    const user = { id: 11, username: 'demo_user_11', role: 'user', level: 'member' };
    const mocked = await mockCaseGenApisWithModel(page, token, user, { caseGenPrompt: 'XMind根节点重生成提示词' });
    await gotoIndex(page);
    await waitCaseGenModelAssigned(page, mocked.modelId);
    await seedRequirementAndSplit(page);

    await openXmindCaseGenDrawer(page);
    await page.click('#xmindCaseGenGenerateModulesBtn');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await installCaseGenModelStub(page, 650);
    await clickNodeQuickAction(page, 'XMind需求');
    await waitForNodeText(page, '登录模块-用例-1');
    await waitForNodeText(page, '支付模块-用例-1');
    expect(await readModuleCaseTitles(page, '登录模块')).toEqual(['登录模块-用例-1']);
    expect(await readModuleCaseTitles(page, '支付模块')).toEqual(['支付模块-用例-1']);

    await clickNodeQuickAction(page, 'XMind需求');
    await page.waitForFunction(() => {
      var app = window.app || {};
      var state = app.state || null;
      if (!state || !state.xmindCaseGen || !state.xmindCaseGen.modules) return false;
      var moduleMap = {};
      (state.caseGenModules || []).forEach(function(mod) {
        if (!mod || !mod.id) return;
        var title = mod.title || mod.module || '';
        moduleMap[title] = state.xmindCaseGen.modules[String(mod.id)] || null;
      });
      return Boolean(
        moduleMap['登录模块'] && moduleMap['登录模块'].running === true &&
        moduleMap['支付模块'] && moduleMap['支付模块'].running === true
      );
    }, {}, { timeout: 15000 });
    await waitForNodeStatus(page, '登录模块', '生成中');
    await waitForNodeStatus(page, '支付模块', '生成中');

    await waitForNodeText(page, '登录模块-用例-2');
    await waitForNodeText(page, '支付模块-用例-2');
    await waitForNodeStatusAbsent(page, '登录模块');
    await waitForNodeStatusAbsent(page, '支付模块');
    expect(await readModuleCaseTitles(page, '登录模块')).toEqual(['登录模块-用例-2']);
    expect(await readModuleCaseTitles(page, '支付模块')).toEqual(['支付模块-用例-2']);

    const moduleCalls = await page.evaluate(() => window.__xmindCasegenByModule || {});
    expect(moduleCalls['登录模块'].generate).toBe(2);
    expect(moduleCalls['支付模块'].generate).toBe(2);
  });

  test('模块节点支持 +AI 生成、右键追加与放弃回滚', async ({ page }) => {
    const token = 'token-xmind-casegen-module';
    const user = { id: 2, username: 'demo_user_2', role: 'user', level: 'member' };
    const mocked = await mockCaseGenApisWithModel(page, token, user, { caseGenPrompt: 'XMind模块提示词' });
    await gotoIndex(page);
    await waitCaseGenModelAssigned(page, mocked.modelId);
    await seedRequirementAndSplit(page, {
      requirementLabel: '模块节点需求',
      modules: [
        { module: '购物车模块', key_scenarios: ['商品加购'], test_points: ['库存校验'], coupled_modules: ['商品详情'] },
      ],
    });

    await openXmindCaseGenDrawer(page);
    await page.click('#xmindCaseGenGenerateModulesBtn');
    await waitForNodeText(page, '购物车模块');

    await installCaseGenModelStub(page, 260);
    await adjustMindView(page);
    const moduleCenterBefore = await readNodeViewportCenter(page, '购物车模块', 'module');
    expect(moduleCenterBefore).toBeTruthy();
    await clickNodeQuickAction(page, '购物车模块');
    await waitForNodeStatus(page, '购物车模块', '生成中');
    expectDecorationFollowNodeFlow(await readNodeDecorationGeometry(page, '购物车模块'));
    await waitForNodeText(page, '购物车模块-用例-1');
    await waitForNodeStatusAbsent(page, '购物车模块');
    const moduleCenterAfterGenerate = await readNodeViewportCenter(page, '购物车模块', 'module');
    expect(moduleCenterAfterGenerate).toBeTruthy();
    expect(Math.abs(moduleCenterAfterGenerate.x - moduleCenterBefore.x)).toBeLessThan(8);
    expect(Math.abs(moduleCenterAfterGenerate.y - moduleCenterBefore.y)).toBeLessThan(8);

    let titles = await readModuleCaseTitles(page, '购物车模块');
    expect(titles).toEqual(['购物车模块-用例-1']);

    await openNodeContextMenu(page, '购物车模块');
    await expect(page.locator('.xmind-node-context-menu-btn', { hasText: '重新生成' })).toBeVisible();
    await expect(page.locator('.xmind-node-context-menu-btn', { hasText: '追加生成' })).toBeVisible();
    await expect(page.locator('.xmind-node-context-menu-btn', { hasText: '放弃本次生成' })).toBeVisible();
    await page.locator('.xmind-node-context-menu-btn', { hasText: '追加生成' }).click();
    await waitForNodeText(page, '追加生成中');
    await waitForNodeText(page, '购物车模块-用例-1');
    const pendingState = await readTopupPlaceholderState(page);
    expect(pendingState).toBeTruthy();
    expect(pendingState.topic).toContain('追加生成中');
    expect(pendingState.className).toContain('xmind-casegen-node-topup-placeholder');
    expect(pendingState.linkMarker).toBe('topup-pending');
    expect(pendingState.linkDash).toBe('6 5');
    await waitForNodeText(page, '购物车模块-追加-1');
    await waitForNodeTextAbsent(page, '追加生成中');
    await waitForNodeStatusAbsent(page, '购物车模块');
    const moduleCenterAfterTopup = await readNodeViewportCenter(page, '购物车模块', 'module');
    expect(moduleCenterAfterTopup).toBeTruthy();
    expect(Math.abs(moduleCenterAfterTopup.x - moduleCenterBefore.x)).toBeLessThan(8);
    expect(Math.abs(moduleCenterAfterTopup.y - moduleCenterBefore.y)).toBeLessThan(8);
    await waitForTopupHighlightState(page, ['购物车模块-追加-1']);
    let topupHighlightState = await readTopupHighlightState(page);
    expect(topupHighlightState.frameCount).toBe(1);
    expect(topupHighlightState.label).toContain('本轮追加用例');
    expect(topupHighlightState.titles).toEqual(['购物车模块-追加-1']);

    titles = await readModuleCaseTitles(page, '购物车模块');
    expect(titles).toEqual(['购物车模块-用例-1', '购物车模块-追加-1']);

    await openNodeContextMenu(page, '购物车模块');
    await page.locator('.xmind-node-context-menu-btn', { hasText: '追加生成' }).click();
    await waitForNodeText(page, '追加生成中');
    await waitForNoTopupHighlightState(page);
    await waitForNodeText(page, '购物车模块-追加-2');
    await waitForNodeTextAbsent(page, '追加生成中');
    await waitForNodeStatusAbsent(page, '购物车模块');
    await waitForTopupHighlightState(page, ['购物车模块-追加-2']);
    topupHighlightState = await readTopupHighlightState(page);
    expect(topupHighlightState.frameCount).toBe(1);
    expect(topupHighlightState.label).toContain('本轮追加用例');
    expect(topupHighlightState.titles).toEqual(['购物车模块-追加-2']);

    titles = await readModuleCaseTitles(page, '购物车模块');
    expect(titles).toEqual(['购物车模块-用例-1', '购物车模块-追加-1', '购物车模块-追加-2']);

    await openNodeContextMenu(page, '购物车模块');
    await page.locator('.xmind-node-context-menu-btn', { hasText: '放弃本次生成' }).click();
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !Array.isArray(state.caseGenModules) || !state.caseGenModules.length) return false;
      var mod = state.caseGenModules[0];
      if (!mod || !state.caseGenResults || !state.caseGenResults[mod.id]) return false;
      try {
        var list = JSON.parse(state.caseGenResults[mod.id]);
        return Array.isArray(list)
          && list.length === 2
          && list[0] && list[0].title === '购物车模块-用例-1'
          && list[1] && list[1].title === '购物车模块-追加-1';
      } catch (err) {
        return false;
      }
    }, {}, { timeout: 15000 });
    await waitForNodeTextAbsent(page, '购物车模块-追加-2');
    await waitForNoTopupHighlightState(page);

    titles = await readModuleCaseTitles(page, '购物车模块');
    expect(titles).toEqual(['购物车模块-用例-1', '购物车模块-追加-1']);
  });

  test('摘要收口为工具栏按钮，点击后在页面中间打开摘要窗口且不压缩 XMind 画布', async ({ page }) => {
    const token = 'token-xmind-casegen-scroll';
    const user = { id: 3, username: 'demo_user_3', role: 'user', level: 'member' };
    const mocked = await mockCaseGenApisWithModel(page, token, user, { caseGenPrompt: 'XMind滚动提示词' });
    await gotoIndex(page);
    await waitCaseGenModelAssigned(page, mocked.modelId);
    await seedRequirementAndSplit(page, {
      requirementLabel: '滚动验证需求',
    });

    await openXmindCaseGenDrawer(page);
    const layoutBeforeOpen = await readXmindSummaryLayout(page);
    expect(layoutBeforeOpen.overlayOpen).toBeFalsy();
    expect(layoutBeforeOpen.drawerScrollable).toBeFalsy();
    expect(layoutBeforeOpen.toolbarHidden).toBeTruthy();
    expect(layoutBeforeOpen.summaryButtonInControls).toBeTruthy();
    expect(layoutBeforeOpen.summaryButtonInInlineActions).toBeTruthy();
    expect(layoutBeforeOpen.statusInControls).toBeTruthy();
    expect(layoutBeforeOpen.inlineActionsCount).toBeGreaterThanOrEqual(8);
    expect(layoutBeforeOpen.toolbarHeight).toBeLessThanOrEqual(1);
    expect(layoutBeforeOpen.controlsHeight).toBeGreaterThan(0);
    expect(layoutBeforeOpen.viewerHeight).toBeGreaterThanOrEqual(420);
    await expect(page.locator('#xmindCaseGenSummaryBtn')).toHaveText('查看摘要');

    await openXmindCaseGenSummaryDialog(page);
    await forceLongXmindSummary(page);
    await expect(page.locator('#xmindCaseGenRequirementSummary')).toContainText('这是一段用于验证 XMind 摘要区智能滚动的超长文本内容');
    await expect(page.locator('#xmindCaseGenCasesSummary')).toContainText('这是一段用于验证 XMind 摘要区智能滚动的超长文本内容');
    const layoutAfterOpen = await readXmindSummaryLayout(page);
    expect(layoutAfterOpen.overlayOpen).toBeTruthy();
    expect(layoutAfterOpen.buttonText).toBe('收起摘要');
    expect(layoutAfterOpen.buttonExpanded).toBe('true');
    expect(Math.abs(layoutAfterOpen.dialogCenterOffsetX)).toBeLessThan(24);
    expect(Math.abs(layoutAfterOpen.dialogCenterOffsetY)).toBeLessThan(24);
    expect(layoutAfterOpen.dialogBodyScrollHeight).toBeGreaterThan(layoutAfterOpen.dialogBodyClientHeight);
    expect(Math.abs(layoutAfterOpen.viewerHeight - layoutBeforeOpen.viewerHeight)).toBeLessThan(2);

    await closeXmindCaseGenSummaryDialog(page);
    const layoutAfterClose = await readXmindSummaryLayout(page);
    expect(layoutAfterClose.overlayOpen).toBeFalsy();
    expect(layoutAfterClose.buttonText).toBe('查看摘要');
    expect(layoutAfterClose.buttonExpanded).toBe('false');
  });

  test('点击全览会重新定位到根节点', async ({ page }) => {
    const token = 'token-xmind-casegen-fit-root';
    const user = { id: 31, username: 'demo_user_fit_root', role: 'user', level: 'member' };
    const mocked = await mockCaseGenApisWithModel(page, token, user, { caseGenPrompt: 'XMind全览定位提示词' });
    await gotoIndex(page);
    await waitCaseGenModelAssigned(page, mocked.modelId);
    await seedRequirementAndSplit(page, {
      requirementLabel: '全览定位需求',
      modules: [
        { module: '订单模块', key_scenarios: ['下单'], test_points: ['价格校验'], coupled_modules: ['支付模块'] },
        { module: '支付模块', key_scenarios: ['支付'], test_points: ['支付回调'], coupled_modules: ['订单模块'] },
      ],
    });

    await openXmindCaseGenDrawer(page);
    await page.click('#xmindCaseGenGenerateModulesBtn');
    await waitForNodeText(page, '订单模块');
    await waitForNodeText(page, '支付模块');

    await adjustMindView(page);
    const viewerBox = await page.locator('#xmindCaseGenMindContainer').boundingBox();
    expect(viewerBox).toBeTruthy();
    await page.mouse.move(viewerBox.x + viewerBox.width * 0.68, viewerBox.y + viewerBox.height * 0.56);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(viewerBox.x + viewerBox.width * 0.36, viewerBox.y + viewerBox.height * 0.26, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(180);
    const centerBeforeFit = await readNodeViewportCenter(page, '全览定位需求', 'root');
    const viewerCenterBeforeFit = await readViewerCenter(page);
    expect(centerBeforeFit).toBeTruthy();
    expect(viewerCenterBeforeFit).toBeTruthy();
    const driftX = Math.abs(centerBeforeFit.x - viewerCenterBeforeFit.x);
    const driftY = Math.abs(centerBeforeFit.y - viewerCenterBeforeFit.y);
    expect(Math.max(driftX, driftY)).toBeGreaterThan(18);

    await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-fit"]');
    await page.waitForTimeout(160);

    const centerAfterFit = await readNodeViewportCenter(page, '全览定位需求', 'root');
    const viewerCenterAfterFit = await readViewerCenter(page);
    expect(centerAfterFit).toBeTruthy();
    expect(viewerCenterAfterFit).toBeTruthy();
    expect(Math.abs(centerAfterFit.x - viewerCenterAfterFit.x)).toBeLessThan(18);
    expect(Math.abs(centerAfterFit.y - viewerCenterAfterFit.y)).toBeLessThan(18);
  });

  test('大量用例下模块重生成会以操作节点为锚点，不漂移到其他位置', async ({ page }) => {
    const token = 'token-xmind-casegen-anchor';
    const user = { id: 4, username: 'demo_user_4', role: 'user', level: 'member' };
    const mocked = await mockCaseGenApisWithModel(page, token, user, { caseGenPrompt: 'XMind锚点提示词' });
    await gotoIndex(page);
    await waitCaseGenModelAssigned(page, mocked.modelId);
    await seedRequirementAndSplit(page, {
      requirementLabel: '锚点需求',
      modules: [
        { module: '订单模块', key_scenarios: ['下单'], test_points: ['价格校验'], coupled_modules: ['支付模块'] },
        { module: '支付模块', key_scenarios: ['支付'], test_points: ['支付回调'], coupled_modules: ['订单模块'] },
      ],
    });
    await seedModuleCases(page, '订单模块', 18);
    await seedModuleCases(page, '支付模块', 16);

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '订单模块-预置用例-18');
    await adjustMindView(page);
    await installCaseGenModelStub(page, 420);
    await openNodeContextMenu(page, '订单模块');
    const centerBefore = await readNodeViewportCenter(page, '订单模块', 'module');
    expect(centerBefore).toBeTruthy();
    await page.locator('.xmind-node-context-menu-btn', { hasText: '重新生成' }).click();
    await waitForNodeStatus(page, '订单模块', '生成中');
    await page.waitForTimeout(140);
    const centerDuring = await readNodeViewportCenter(page, '订单模块', 'module');
    expect(centerDuring).toBeTruthy();
    expect(Math.abs(centerDuring.x - centerBefore.x)).toBeLessThan(8);
    expect(Math.abs(centerDuring.y - centerBefore.y)).toBeLessThan(24);

    await waitForNodeText(page, '订单模块-用例-1');
    await waitForNodeStatusAbsent(page, '订单模块');
    const centerAfter = await readNodeViewportCenter(page, '订单模块', 'module');
    expect(centerAfter).toBeTruthy();
    expect(Math.abs(centerAfter.x - centerBefore.x)).toBeLessThan(8);
    expect(Math.abs(centerAfter.y - centerBefore.y)).toBeLessThan(24);
  });
});
