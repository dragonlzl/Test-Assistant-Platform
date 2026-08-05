const assert = require('assert');
const fs = require('fs');
const path = require('path');

const viewOwnerFactory = require('../../scripts/core/tempExecMissingReminderViewOwner.js');

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createViewOwner(overrides) {
  return viewOwnerFactory.create(Object.assign({
    escapeHtml,
    normalizeMissingReminderTypeIds(values) {
      return Array.isArray(values) ? values.map(Number).filter((value) => value > 0) : [];
    },
    resolveScoreLevel(score, fallback) { return fallback || (score >= 3 ? '高' : '低'); },
  }, overrides || {}));
}

function verifyRenderingContracts() {
  const owner = createViewOwner();
  const reminder = {
    matchedModules: ['登录'],
    matchedTypes: ['异常'],
    hasMatch: true,
    items: [{
      module_name: '登录',
      type_ids: [10],
      type_names: ['异常'],
      title: '<错误密码>',
      priority: 'P1',
      precondition: '已注册',
      steps: '输入错误密码',
      expected: '提示失败',
      match_score: 4,
    }],
  };
  const html = owner.renderBlock(reminder, { aiEnabled: false });
  assert.match(html, /易漏用例参考/);
  assert.match(html, /&lt;错误密码&gt;/);
  assert.match(html, /模块：登录/);
  assert.strictEqual(owner.formatTypeLabel(reminder.items[0]), '异常');
  assert.strictEqual(owner.resolveLimit({ limit: 0 }), 10);
}

function verifyRegionRefreshDoesNotReplaceTable() {
  const slot = { innerHTML: '' };
  let fallbackRenders = 0;
  let hintBinds = 0;
  const owner = createViewOwner({
    tempExecView: {
      querySelector(selector) {
        return selector === '[data-temp-missing-reminder-slot]' ? slot : null;
      },
    },
    renderFallback() { fallbackRenders += 1; },
    bindMissingReminderScrollHint(target) {
      assert.strictEqual(target, slot);
      hintBinds += 1;
    },
  });
  const rendered = owner.renderRegion({ hasMatch: true, items: [] }, { aiEnabled: false });
  assert.strictEqual(rendered, true);
  assert.match(slot.innerHTML, /missing-reminder-card/);
  assert.strictEqual(fallbackRenders, 0);
  assert.strictEqual(hintBinds, 1);
}

function verifyFallbackWithoutSlot() {
  let fallbackRenders = 0;
  const owner = createViewOwner({
    tempExecView: { querySelector() { return null; } },
    renderFallback() { fallbackRenders += 1; },
  });
  assert.strictEqual(owner.renderRegion({ hasMatch: true }, { aiEnabled: false }), false);
  assert.strictEqual(fallbackRenders, 1);
}

function verifyOwnership() {
  const projectRoot = path.join(__dirname, '..', '..');
  const source = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecMissingReminderViewOwner.js'), 'utf8');
  assert.match(source, /function buildTable\(/);
  assert.match(source, /function renderRegion\(/);
  assert.match(source, /data-temp-missing-reminder-slot/);
}

verifyRenderingContracts();
verifyRegionRefreshDoesNotReplaceTable();
verifyFallbackWithoutSlot();
verifyOwnership();
console.log('temp exec missing reminder view owner tests passed');
