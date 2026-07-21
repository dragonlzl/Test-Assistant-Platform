const assert = require('assert');
const viewAdapterOwner = require('../../scripts/modules/caseLibrary/caseLibraryAiGenViewAdapter.js');

function createClassList() {
  const values = new Set();
  return {
    add: function(value) { values.add(value); },
    remove: function(value) { values.delete(value); },
    contains: function(value) { return values.has(value); },
  };
}

function createElement() {
  const attrs = Object.create(null);
  return {
    classList: createClassList(),
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    disabled: false,
    setAttribute: function(name, value) { attrs[name] = String(value); },
    getAttribute: function(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    removeAttribute: function(name) { delete attrs[name]; },
  };
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createHarness() {
  const coverageHeader = createElement();
  const resultBody = createElement();
  resultBody.parentNode = {
    querySelectorAll: function(selector) {
      return selector === 'th.coverage' ? [coverageHeader] : [];
    },
  };
  const dom = {
    aiGenResult: createElement(),
    aiGenResultBody: resultBody,
    aiGenResultSummary: createElement(),
    aiGenSelectionHint: createElement(),
    aiGenAppendBtn: createElement(),
    aiGenSelectAllToggle: createElement(),
    aiGenRunBtn: createElement(),
    aiGenBtn: createElement(),
    xmindViewBtn: createElement(),
    editDrawerOpenBtn: createElement(),
    aiGenRequirementInput: createElement(),
    aiGenFileName: createElement(),
    aiGenStatus: createElement(),
    aiGenImportStatus: createElement(),
    editStatus: createElement(),
    aiGenDrawer: createElement(),
  };
  const statuses = [];
  const drawerCalls = { ensure: 0, open: 0, close: 0, onOpen: null };
  const drawer = {
    open: function() { drawerCalls.open += 1; },
    close: function() { drawerCalls.close += 1; },
  };
  const view = viewAdapterOwner.create({
    dom: dom,
    escapeHtml: escapeHtml,
    escapeHtmlPreserve: function(value) { return escapeHtml(value).replace(/\n/g, '<br>'); },
    countModuleCases: function(modules) {
      return modules.reduce(function(total, entry) { return total + entry.cases.length; }, 0);
    },
    countSelectableCases: function(modules) {
      return modules.reduce(function(total, entry) {
        return total + entry.cases.filter(function(item) { return item.__aiAppended !== true; }).length;
      }, 0);
    },
    normalizeCount: function(value) {
      const number = Number(value);
      return isFinite(number) && number >= 0 ? Math.round(number) : null;
    },
    setStatus: function(element, message, type) {
      statuses.push({ element: element, message: message, type: type });
    },
    ensureDrawer: function(id, closeIds, onOpen) {
      drawerCalls.ensure += 1;
      drawerCalls.id = id;
      drawerCalls.closeIds = closeIds;
      drawerCalls.onOpen = onOpen;
      return drawer;
    },
  });
  return {
    coverageHeader: coverageHeader,
    dom: dom,
    drawer: drawer,
    drawerCalls: drawerCalls,
    statuses: statuses,
    view: view,
  };
}

function testResultRendering() {
  const harness = createHarness();
  const selection = new Set(['case-1']);
  harness.view.renderResult({
    generated: true,
    generationMode: '',
    resultGeneratedCount: 3,
    resultDedupeCount: 1,
    selection: selection,
    modules: [{
      module: '登录 <模块>',
      coverage: 45,
      missing: true,
      cases: [{
        __aiKey: 'case-1',
        title: '成功 <登录>',
        priority: 'P1',
        precondition: '已注册',
        steps: '输入\n提交',
        expected: '进入首页',
      }, {
        __aiKey: 'case-2',
        __aiAppended: true,
        title: '已追加',
        priority: 'P2',
        precondition: '',
        steps: '',
        expected: '',
      }],
    }],
  });

  assert.strictEqual(harness.dom.aiGenResult.classList.contains('hidden'), false);
  assert.strictEqual(harness.coverageHeader.classList.contains('hidden'), false);
  assert.ok(harness.dom.aiGenResultBody.innerHTML.indexOf('登录 &lt;模块&gt;') !== -1);
  assert.ok(harness.dom.aiGenResultBody.innerHTML.indexOf('成功 &lt;登录&gt;') !== -1);
  assert.ok(harness.dom.aiGenResultBody.innerHTML.indexOf('输入<br>提交') !== -1);
  assert.ok(harness.dom.aiGenResultBody.innerHTML.indexOf('data-ai-appended="1" disabled') !== -1);
  assert.strictEqual(harness.dom.aiGenResultSummary.textContent, '生成 3 条，去重 1 条');
  assert.strictEqual(harness.dom.aiGenSelectionHint.textContent, '已选 1 / 1 条');
  assert.strictEqual(harness.dom.aiGenAppendBtn.disabled, false);
  assert.strictEqual(harness.dom.aiGenSelectAllToggle.checked, true);
  assert.deepStrictEqual(Array.from(selection), ['case-1']);

  harness.view.renderResult({
    generated: false,
    generationMode: 'enhanced',
    selection: new Set(),
    modules: [],
  });
  assert.strictEqual(harness.coverageHeader.classList.contains('hidden'), true);
  assert.strictEqual(harness.dom.aiGenResult.classList.contains('hidden'), true);
  assert.ok(harness.dom.aiGenResultBody.innerHTML.indexOf('colspan="7"') !== -1);
  assert.strictEqual(harness.dom.aiGenResultSummary.textContent, '');
  assert.strictEqual(harness.dom.aiGenAppendBtn.disabled, true);
}

function testControlsAndStatusPorts() {
  const harness = createHarness();
  harness.view.syncRunButton({ loading: false, hasRequirement: false, disabledReason: '' });
  assert.strictEqual(harness.dom.aiGenRunBtn.disabled, true);
  harness.view.syncRunButton({ loading: false, hasRequirement: true, disabledReason: '' });
  assert.strictEqual(harness.dom.aiGenRunBtn.disabled, false);

  harness.view.syncFeatureButton({
    loading: false,
    disabledReason: 'no-model',
    showBadge: true,
    canOpenXmind: true,
  });
  assert.strictEqual(harness.dom.aiGenBtn.textContent, 'AI 用例生成');
  assert.strictEqual(harness.dom.aiGenBtn.disabled, false);
  assert.strictEqual(harness.dom.aiGenBtn.getAttribute('data-disabled-reason'), 'no-model');
  assert.strictEqual(harness.dom.aiGenBtn.classList.contains('is-disabled'), true);
  assert.strictEqual(harness.dom.aiGenBtn.classList.contains('has-badge'), true);
  assert.strictEqual(harness.dom.xmindViewBtn.disabled, false);

  harness.view.syncFeatureButton({ loading: true, showBadge: true, canOpenXmind: false });
  assert.strictEqual(harness.dom.aiGenBtn.textContent, '正在生成');
  assert.strictEqual(harness.dom.aiGenBtn.classList.contains('loading'), true);
  assert.strictEqual(harness.dom.aiGenBtn.classList.contains('has-badge'), false);
  assert.strictEqual(harness.dom.xmindViewBtn.disabled, true);

  harness.view.syncNavBadge(true);
  assert.strictEqual(harness.dom.editDrawerOpenBtn.classList.contains('case-library-ai-gen-dot'), true);
  harness.view.syncNavBadge(false);
  assert.strictEqual(harness.dom.editDrawerOpenBtn.classList.contains('case-library-ai-gen-dot'), false);

  harness.view.setRequirementText('需求内容');
  harness.view.setRequirementFileName('requirement.docx');
  assert.strictEqual(harness.view.getRequirementText('fallback'), '需求内容');
  assert.strictEqual(harness.dom.aiGenFileName.textContent, 'requirement.docx');
  harness.view.setGenerationStatus('完成', 'ok');
  harness.view.setImportStatus('读取完成', 'ok');
  harness.view.setEditStatus('待确认', 'warn');
  assert.deepStrictEqual(harness.statuses.map(function(entry) { return entry.message; }), ['完成', '读取完成', '待确认']);
}

function testDrawerLifecycleAndLabelTrigger() {
  const harness = createHarness();
  let openHookCalls = 0;
  const onOpen = function() { openHookCalls += 1; };
  harness.view.openDrawer(onOpen);
  harness.view.closeDrawer(onOpen);
  assert.strictEqual(harness.drawerCalls.ensure, 1);
  assert.strictEqual(harness.drawerCalls.id, 'caseLibraryAiGenDrawer');
  assert.deepStrictEqual(harness.drawerCalls.closeIds, []);
  assert.strictEqual(harness.drawerCalls.open, 1);
  assert.strictEqual(harness.drawerCalls.close, 1);
  assert.strictEqual(harness.view.getDrawerReference(), harness.drawer);
  harness.drawerCalls.onOpen();
  assert.strictEqual(openHookCalls, 1);

  const input = {};
  const label = {
    tagName: 'LABEL',
    contains: function(target) { return target === input; },
  };
  assert.strictEqual(harness.view.hasNativeLabelTrigger(label, input), true);
  assert.strictEqual(harness.view.hasNativeLabelTrigger({ tagName: 'DIV', contains: function() { return true; } }, input), false);
}

testResultRendering();
testControlsAndStatusPorts();
testDrawerLifecycleAndLabelTrigger();
console.log('case library AI generation view adapter tests passed');
