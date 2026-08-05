'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirSessionStore.js'));

assert.ok(owner && typeof owner.create === 'function');

var values = Object.create(null);
var calls = [];
var storage = {
  getItem: function(key) {
    calls.push(['get', key]);
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
  },
  setItem: function(key, value) {
    calls.push(['set', key, value]);
    values[key] = value;
  },
  removeItem: function(key) {
    calls.push(['remove', key]);
    delete values[key];
  },
};
var store = owner.create({ storage: storage });

assert.strictEqual(store.read('missing'), null);
assert.deepStrictEqual(calls, [['get', 'missing']]);

store.write('mind-session', { version: 1, editing: true });
assert.strictEqual(values['mind-session'], '{"version":1,"editing":true}');
assert.deepStrictEqual(store.read('mind-session'), { version: 1, editing: true });

store.write('empty-payload');
assert.strictEqual(values['empty-payload'], '{}');

values.invalid = '{broken';
assert.strictEqual(store.read('invalid'), null);
values.primitive = '1';
assert.strictEqual(store.read('primitive'), null);
values.array = '[1,2]';
assert.deepStrictEqual(store.read('array'), [1, 2]);

store.clear('mind-session');
assert.strictEqual(Object.prototype.hasOwnProperty.call(values, 'mind-session'), false);

var callCount = calls.length;
assert.strictEqual(store.read(''), null);
store.write('', { ignored: true });
store.clear('');
assert.strictEqual(calls.length, callCount);

var cyclic = {};
cyclic.self = cyclic;
assert.doesNotThrow(function() { store.write('cyclic', cyclic); });
assert.strictEqual(Object.prototype.hasOwnProperty.call(values, 'cyclic'), false);

var throwingStore = owner.create({
  storage: {
    getItem: function() { throw new Error('read failed'); },
    setItem: function() { throw new Error('write failed'); },
    removeItem: function() { throw new Error('clear failed'); },
  },
});
assert.strictEqual(throwingStore.read('key'), null);
assert.doesNotThrow(function() { throwingStore.write('key', { value: true }); });
assert.doesNotThrow(function() { throwingStore.clear('key'); });

var unavailableStore = owner.create({ storage: null });
assert.strictEqual(unavailableStore.read('key'), null);
assert.doesNotThrow(function() { unavailableStore.write('key', { value: true }); });
assert.doesNotThrow(function() { unavailableStore.clear('key'); });

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.strictEqual(coreSource.indexOf('typeof localStorage'), -1);
assert.strictEqual(coreSource.indexOf('localStorage.getItem'), -1);
assert.strictEqual(coreSource.indexOf('localStorage.setItem'), -1);
assert.strictEqual(coreSource.indexOf('localStorage.removeItem'), -1);
assert.ok(coreSource.indexOf('sessionStoreOwner.create') !== -1);
assert.ok(coreSource.indexOf('var readMindEditSession = sessionStore.read;') !== -1);
assert.ok(coreSource.indexOf('var writeMindEditSession = sessionStore.write;') !== -1);
assert.ok(coreSource.indexOf('var clearMindEditSession = sessionStore.clear;') !== -1);

[
  'index.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
].forEach(function(relativePath) {
  var html = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  var dataModelIndex = html.indexOf('./scripts/core/mindElixirDataModel.js');
  var sessionStoreIndex = html.indexOf('./scripts/core/mindElixirSessionStore.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(sessionStoreIndex !== -1, relativePath + ' should load the session store');
  assert.ok(dataModelIndex !== -1 && dataModelIndex < sessionStoreIndex);
  assert.ok(coreIndex !== -1 && sessionStoreIndex < coreIndex);
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var dynamicDataIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirDataModel.js'");
var dynamicSessionIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirSessionStore.js'");
var dynamicCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(dynamicSessionIndex !== -1);
assert.ok(dynamicDataIndex !== -1 && dynamicDataIndex < dynamicSessionIndex);
assert.ok(dynamicCoreIndex !== -1 && dynamicSessionIndex < dynamicCoreIndex);

console.log('mind_elixir_session_store.test.js passed');
