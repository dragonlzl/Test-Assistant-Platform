'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var uiIdentityCore = require(path.join(projectRoot, 'scripts/core/uiIdentityCore.js'));
var overlayGeometryCore = require(path.join(projectRoot, 'scripts/core/overlayGeometryCore.js'));

var existing = {};
Object.defineProperty(existing, '__uiKey', {
  value: 'existing-key',
  enumerable: false,
  configurable: true,
  writable: true,
});
assert.strictEqual(uiIdentityCore.ensureNonEnumerableKey(existing, '__uiKey', 'new-key'), 'existing-key');
assert.strictEqual(Object.getOwnPropertyDescriptor(existing, '__uiKey').enumerable, false);

var target = {};
assert.strictEqual(uiIdentityCore.ensureNonEnumerableKey(target, '__uiKey', 'specified-key'), 'specified-key');
var descriptor = Object.getOwnPropertyDescriptor(target, '__uiKey');
assert.strictEqual(descriptor.enumerable, false);
assert.strictEqual(descriptor.configurable, true);
assert.strictEqual(descriptor.writable, true);

var sealed = Object.preventExtensions({});
assert.strictEqual(uiIdentityCore.ensureNonEnumerableKey(sealed, '__uiKey', 'unwritten-key'), 'unwritten-key');
assert.strictEqual(Object.prototype.hasOwnProperty.call(sealed, '__uiKey'), false);
assert.strictEqual(uiIdentityCore.ensureNonEnumerableKey(null, '__uiKey', 'ignored'), '');

var above = overlayGeometryCore.computeAnchoredOverlayPosition(
  { left: 100, top: 100, width: 40, height: 20, bottom: 120 },
  { width: 80, height: 30 },
  { width: 300, height: 240 }
);
assert.deepStrictEqual(above, { left: 80, top: 60, placement: 'above' });

var below = overlayGeometryCore.computeAnchoredOverlayPosition(
  { left: 40, top: 20, width: 20, height: 10, bottom: 30 },
  { width: 80, height: 30 },
  { width: 300, height: 240 }
);
assert.deepStrictEqual(below, { left: 10, top: 40, placement: 'below' });

var clamped = overlayGeometryCore.computeAnchoredOverlayPosition(
  { left: 280, top: 225, width: 20, height: 10, bottom: 235 },
  { width: 80, height: 30 },
  { width: 300, height: 240 }
);
assert.deepStrictEqual(clamped, { left: 212, top: 185, placement: 'above' });

assert.strictEqual(overlayGeometryCore.computeAnchoredOverlayPosition(null, { width: 1, height: 1 }, { width: 1, height: 1 }), null);
assert.strictEqual(overlayGeometryCore.computeAnchoredOverlayPosition({}, null, { width: 1, height: 1 }), null);
assert.strictEqual(overlayGeometryCore.computeAnchoredOverlayPosition({}, { width: 1, height: 1 }, null), null);

assert.deepStrictEqual(overlayGeometryCore.captureAnchorRect({
  left: '12',
  top: '8',
  width: '24',
  height: '16',
}), { left: 12, top: 8, width: 24, height: 16, bottom: 24 });
assert.deepStrictEqual(overlayGeometryCore.captureAnchorRect({
  getBoundingClientRect: function() {
    return { left: 12, top: 8, width: 24, height: 16, bottom: 30 };
  },
}), { left: 12, top: 8, width: 24, height: 16, bottom: 30 });
assert.strictEqual(overlayGeometryCore.captureAnchorRect({
  getBoundingClientRect: function() { throw new Error('not mounted'); },
}), null);

var pageStyleSource = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
var appRuntimeSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/appRuntime.js'), 'utf8');
assert.ok(
  pageStyleSource.indexOf('html[data-preload-nav="1"] body') !== -1
    && pageStyleSource.indexOf('pointer-events: none;') !== -1,
  'preloading pages should not accept interaction before runtime owners are bound'
);
assert.ok(
  appRuntimeSource.indexOf('switchTab(initialTab, { replaceHistory: true });')
    < appRuntimeSource.indexOf('clearPreloadNavFlags();'),
  'runtime should release preload interaction guard after the initial tab is ready'
);

[
  'index.html',
  'case-exec.html',
  'case-library.html',
  'ai-workflow.html',
  'admin.html',
  'ai-tools.html',
  'settings.html',
].forEach(function(entryFile) {
  var html = fs.readFileSync(path.join(projectRoot, entryFile), 'utf8');
  var identityIndex = html.indexOf('./scripts/core/uiIdentityCore.js');
  var geometryIndex = html.indexOf('./scripts/core/overlayGeometryCore.js');
  var tempExecIndex = html.indexOf('./scripts/core/tempexecCore.js');
  var caseLibraryIndex = html.indexOf('./scripts/modules/caseLibrary.js');
  assert.ok(identityIndex !== -1, entryFile + ' should load uiIdentityCore');
  assert.ok(geometryIndex !== -1, entryFile + ' should load overlayGeometryCore');
  assert.ok(identityIndex < tempExecIndex, entryFile + ' should load uiIdentityCore before tempexecCore');
  assert.ok(geometryIndex < tempExecIndex, entryFile + ' should load overlayGeometryCore before tempexecCore');
  assert.ok(identityIndex < caseLibraryIndex, entryFile + ' should load uiIdentityCore before caseLibrary');
  assert.ok(geometryIndex < caseLibraryIndex, entryFile + ' should load overlayGeometryCore before caseLibrary');
});

console.log('ui_foundation_cores.test.js passed');
