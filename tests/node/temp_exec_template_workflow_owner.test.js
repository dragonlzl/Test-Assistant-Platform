const assert = require('assert');
const owner = require('../../scripts/modules/tempExecTemplateWorkflowOwner');

function createClassList(initial) {
  const values = new Set(initial || []);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
  };
}

function createElement(options) {
  const config = options || {};
  const listeners = {};
  return {
    classList: createClassList(config.classes),
    dataset: config.dataset || {},
    disabled: Boolean(config.disabled),
    innerHTML: '',
    addEventListener(name, listener) { listeners[name] = listener; },
    contains(target) { return target === this; },
    trigger(name, event) { return listeners[name](event || { target: this }); },
    listeners,
  };
}

function createHarness(options) {
  const config = options || {};
  const dropdown = createElement();
  const toggle = createElement({ disabled: config.disabled });
  const menu = createElement({ classes: ['hidden'] });
  const documentListeners = {};
  const elements = {
    caseTemplateDropdown: dropdown,
    caseTemplateToggle: toggle,
    caseTemplateMenu: menu,
  };
  const document = {
    getElementById(id) { return elements[id] || null; },
    addEventListener(name, listener) { documentListeners[name] = listener; },
  };
  const imports = [];
  const statuses = [];
  const workflow = owner.create({
    window: {
      location: { pathname: '/tap/case-exec.html' },
      console: { warn() {} },
    },
    document,
    api: {
      async importTempExecFiles(files) { imports.push(files); },
    },
    fetch: config.fetch,
    File: config.File,
    now: () => 123,
    statusElement: {},
    setStatus(element, message, type) { statuses.push({ message, type }); },
  });
  return { workflow, dropdown, toggle, menu, documentListeners, imports, statuses };
}

assert.strictEqual(owner.normalizeTemplateName('/dir/%E7%99%BB%E5%BD%95.xmind?t=1'), '登录');
assert.deepStrictEqual(
  owner.parseTemplateListFromHtml('<a href="B.xmind">B</a><a href="a.xmind">a</a><a href="A.xmind">A</a>'),
  ['a', 'B']
);
assert.deepStrictEqual(owner.dedupeAndSort(['z.xmind', 'A', 'a.xmind']), ['A', 'z']);
assert.deepStrictEqual(owner.mergeTemplateSources(['manifest'], ['directory']), ['directory']);
assert.deepStrictEqual(owner.mergeTemplateSources(['manifest'], []), ['manifest']);

(async function run() {
  const disabled = createHarness({ disabled: true });
  assert.strictEqual(disabled.workflow.init(), false);
  assert.strictEqual(disabled.workflow.getSnapshot().bound, false);

  const responses = {
    '/tap/caseTemplate/manifest.json?t=123': {
      ok: true,
      async json() { return ['manifest-only.xmind']; },
    },
    '/tap/caseTemplate/?t=123': {
      ok: true,
      async text() { return '<a href="directory.xmind">directory.xmind</a>'; },
    },
  };
  const active = createHarness({
    fetch: async url => responses[url] || { ok: false },
  });
  assert.strictEqual(active.workflow.init(), true);
  assert.strictEqual(active.workflow.init(), false);
  active.toggle.trigger('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(active.dropdown.classList.contains('open'), true);
  assert.strictEqual(active.menu.classList.contains('hidden'), false);
  assert.deepStrictEqual(active.workflow.getSnapshot().templateList, ['directory']);
  assert.ok(active.menu.innerHTML.includes('data-template-name="directory"'));

  active.documentListeners.click({ target: {} });
  assert.strictEqual(active.dropdown.classList.contains('open'), false);
  assert.strictEqual(active.menu.classList.contains('hidden'), true);

  class FakeFile {
    constructor(parts, name, options) {
      this.parts = parts;
      this.name = name;
      this.type = options.type;
    }
  }
  const remote = createHarness({
    File: FakeFile,
    fetch: async url => ({
      ok: url === '/tap/caseTemplate/smoke.xmind?t=123',
      status: 200,
      async blob() { return { type: 'application/x-xmind', size: 1 }; },
    }),
  });
  assert.strictEqual(await remote.workflow.importRemote('smoke'), true);
  assert.strictEqual(remote.imports.length, 1);
  assert.strictEqual(remote.imports[0][0].name, 'smoke.xmind');
  assert.strictEqual(remote.imports[0][0].type, 'application/x-xmind');

  console.log('temp exec template workflow owner tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
