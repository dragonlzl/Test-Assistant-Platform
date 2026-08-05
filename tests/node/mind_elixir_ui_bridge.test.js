'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirUiBridge.js'));

assert.ok(owner && typeof owner.create === 'function');

var drawerPromise = Promise.resolve({ ok: true, source: 'drawer' });
var drawerOptions = null;
var toastArgs = null;
var windowStub = {
  app: {
    utils: {
      openConfirmDrawer: function(options) {
        drawerOptions = options;
        return drawerPromise;
      },
      showCenterToast: function(message, type, durationMs) {
        toastArgs = [message, type, durationMs];
      },
    },
  },
};
var bridge = owner.create({ window: windowStub });
var options = { title: '确认', message: '是否继续？' };
assert.strictEqual(bridge.openConfirmDrawer(options), drawerPromise);
assert.strictEqual(drawerOptions, options);

bridge.showToast('保存成功', 'success', 1500);
assert.deepStrictEqual(toastArgs, ['保存成功', 'success', 1500]);
toastArgs = null;
bridge.showToast('');
assert.strictEqual(toastArgs, null);

var confirmMessage = '';
var fallbackBridge = owner.create({
  window: {
    confirm: function(message) {
      confirmMessage = message;
      return false;
    },
  },
});
var fallbackPromise = fallbackBridge.openConfirmDrawer({ message: '回退确认' });
assert.ok(fallbackPromise && typeof fallbackPromise.then === 'function');
assert.strictEqual(confirmMessage, '回退确认');

var unavailableBridge = owner.create({ window: null });
assert.doesNotThrow(function() { unavailableBridge.showToast('静默提示'); });

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.strictEqual(coreSource.indexOf('function resolveMindUtilsApi('), -1);
assert.strictEqual(coreSource.indexOf('function openMindConfirmDrawer('), -1);
assert.strictEqual(coreSource.indexOf('function showMindToast('), -1);
assert.ok(coreSource.indexOf('uiBridgeOwner.create') !== -1);
assert.ok(coreSource.indexOf('var openMindConfirmDrawer = uiBridge.openConfirmDrawer;') !== -1);
assert.ok(coreSource.indexOf('var showMindToast = uiBridge.showToast;') !== -1);

[
  'index.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
].forEach(function(relativePath) {
  var html = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  var themeIndex = html.indexOf('./scripts/core/mindElixirThemeOwner.js');
  var uiBridgeIndex = html.indexOf('./scripts/core/mindElixirUiBridge.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(uiBridgeIndex !== -1, relativePath + ' should load the UI bridge');
  assert.ok(themeIndex !== -1 && themeIndex < uiBridgeIndex);
  assert.ok(coreIndex !== -1 && uiBridgeIndex < coreIndex);
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var dynamicThemeIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirThemeOwner.js'");
var dynamicBridgeIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirUiBridge.js'");
var dynamicCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(dynamicBridgeIndex !== -1);
assert.ok(dynamicThemeIndex !== -1 && dynamicThemeIndex < dynamicBridgeIndex);
assert.ok(dynamicCoreIndex !== -1 && dynamicBridgeIndex < dynamicCoreIndex);

fallbackPromise.then(function(result) {
  assert.deepStrictEqual(result, { ok: false });
  return unavailableBridge.openConfirmDrawer({ message: '无窗口环境' });
}).then(function(result) {
  assert.deepStrictEqual(result, { ok: true });
  console.log('mind_elixir_ui_bridge.test.js passed');
}).catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
