'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var context = vm.createContext({
  window: { app: {} },
  Array: Array,
  Object: Object,
  String: String,
});
var source = fs.readFileSync(path.join(projectRoot, 'scripts/core/xmindRenderPolicyCore.js'), 'utf8');
vm.runInContext(source, context, { filename: 'scripts/core/xmindRenderPolicyCore.js' });

var core = context.window.app.xmindRenderPolicyCore;

assert.strictEqual(core.isManagedDecorationClassName('xmind-node-status-badge is-running'), true);
assert.strictEqual(core.isManagedDecorationClassName('xmind-casegen-topup-highlight-layer'), true);
assert.strictEqual(core.isManagedDecorationClassName('xmind-node-quick-action'), false);
assert.strictEqual(core.isManagedDecorationClassName('map-canvas'), false);

assert.strictEqual(core.shouldScheduleNodeDecorations([{
  type: 'childList',
  managedOnly: true,
  targetRole: 'topic',
}]), false);
assert.strictEqual(core.shouldScheduleNodeDecorations([{
  type: 'childList',
  insideManaged: true,
  targetRole: 'overlay',
}]), false);
assert.strictEqual(core.shouldScheduleNodeDecorations([{
  type: 'attributes',
  attributeName: 'class',
  targetRole: 'topic',
}]), false);
assert.strictEqual(core.shouldScheduleNodeDecorations([{
  type: 'childList',
  targetRole: 'tree',
}]), true);

assert.strictEqual(core.shouldScheduleTopupHighlightSync([{
  type: 'attributes',
  attributeName: 'style',
  targetRole: 'map',
}]), false);
assert.strictEqual(core.shouldScheduleTopupHighlightSync([{
  type: 'childList',
  managedOnly: true,
  targetRole: 'map',
}]), false);
assert.strictEqual(core.shouldScheduleTopupHighlightSync([{
  type: 'attributes',
  attributeName: 'class',
  targetRole: 'connector',
}]), false);
assert.strictEqual(core.shouldScheduleTopupHighlightSync([{
  type: 'attributes',
  attributeName: 'class',
  targetRole: 'topic',
}]), true);
assert.strictEqual(core.shouldScheduleTopupHighlightSync([{
  type: 'attributes',
  attributeName: 'data-xmind-topup-highlight-token',
  targetRole: 'topic',
}]), true);
assert.strictEqual(core.shouldScheduleTopupHighlightSync([{
  type: 'attributes',
  attributeName: 'data-xmind-topup-highlight-label',
  targetRole: 'topic',
}]), true);
assert.strictEqual(core.shouldScheduleTopupHighlightSync([{
  type: 'childList',
  targetRole: 'tree',
}]), true);

console.log('xmind_render_policy_core.test.js passed');
