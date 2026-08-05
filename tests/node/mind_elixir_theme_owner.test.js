'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirThemeOwner.js'));

assert.ok(owner && typeof owner.create === 'function');

var lightBase = {
  name: 'Theme',
  type: 'light',
  palette: ['#111111'],
  cssVar: { '--main-bgcolor': '#base', '--main-color': '#base-text' },
};
var darkBase = {
  name: 'Dark Theme',
  type: 'dark',
  palette: ['#222222'],
  cssVar: { '--main-bgcolor': '#dark-base', '--main-color': '#dark-text' },
};
var documentStub = {
  documentElement: {
    dataset: { theme: 'dark' },
    getAttribute: function() { return ''; },
  },
};
var computedStyles = {
  getPropertyValue: function(name) {
    return name === '--main-bgcolor' ? ' #123456 ' : ' #abcdef ';
  },
};
var themeOwner = owner.create({
  ctor: { THEME: lightBase, DARK_THEME: darkBase },
  document: documentStub,
  getComputedStyle: function() { return computedStyles; },
});

assert.strictEqual(themeOwner.resolveDarkMode(), true);
var darkTheme = themeOwner.buildTheme(true);
assert.strictEqual(darkTheme.type, 'dark');
assert.strictEqual(darkTheme.cssVar['--main-bgcolor'], '#1f2937');
assert.strictEqual(darkTheme.cssVar['--main-color'], '#e5e7eb');
assert.notStrictEqual(darkTheme.cssVar, darkBase.cssVar);
assert.deepStrictEqual(darkBase.cssVar, { '--main-bgcolor': '#dark-base', '--main-color': '#dark-text' });

var lightTheme = themeOwner.buildTheme(false);
assert.strictEqual(lightTheme.type, 'light');
assert.strictEqual(lightTheme.cssVar['--main-bgcolor'], '#ffffff');
assert.strictEqual(lightTheme.cssVar['--main-color'], '#1f2937');
assert.notStrictEqual(lightTheme.palette, lightBase.palette);

var ghost = { style: {} };
assert.doesNotThrow(function() {
  themeOwner.syncDetachedGhostTheme(ghost, { container: {} });
});
assert.deepStrictEqual(ghost.style, {
  backgroundColor: '#123456',
  borderColor: '#abcdef',
  color: '#abcdef',
});
assert.doesNotThrow(function() {
  themeOwner.syncDetachedGhostTheme(null, null);
});

var unavailableOwner = owner.create({ ctor: null, document: null, getComputedStyle: null });
assert.strictEqual(unavailableOwner.buildTheme(true), null);
assert.strictEqual(unavailableOwner.resolveDarkMode(), false);
assert.doesNotThrow(function() {
  unavailableOwner.syncDetachedGhostTheme({ style: {} }, { container: {} });
});

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.strictEqual(coreSource.indexOf('function cloneTheme('), -1);
assert.strictEqual(coreSource.indexOf('function buildTheme('), -1);
assert.strictEqual(coreSource.indexOf('function resolveDarkMode('), -1);
assert.strictEqual(coreSource.indexOf('function syncDetachedGhostTheme('), -1);
assert.ok(coreSource.indexOf('themeOwner.create') !== -1);
assert.ok(coreSource.indexOf('var buildTheme = themeApi.buildTheme;') !== -1);
assert.ok(coreSource.indexOf('var resolveDarkMode = themeApi.resolveDarkMode;') !== -1);
assert.ok(coreSource.indexOf('var syncDetachedGhostTheme = themeApi.syncDetachedGhostTheme;') !== -1);

[
  'index.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
].forEach(function(relativePath) {
  var html = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  var sessionIndex = html.indexOf('./scripts/core/mindElixirSessionStore.js');
  var themeIndex = html.indexOf('./scripts/core/mindElixirThemeOwner.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(themeIndex !== -1, relativePath + ' should load the theme owner');
  assert.ok(sessionIndex !== -1 && sessionIndex < themeIndex);
  assert.ok(coreIndex !== -1 && themeIndex < coreIndex);
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var dynamicSessionIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirSessionStore.js'");
var dynamicThemeIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirThemeOwner.js'");
var dynamicCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(dynamicThemeIndex !== -1);
assert.ok(dynamicSessionIndex !== -1 && dynamicSessionIndex < dynamicThemeIndex);
assert.ok(dynamicCoreIndex !== -1 && dynamicThemeIndex < dynamicCoreIndex);

console.log('mind_elixir_theme_owner.test.js passed');
