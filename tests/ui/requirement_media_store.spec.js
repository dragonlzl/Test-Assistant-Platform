const path = require('path');
const { test, expect } = require('@playwright/test');

const servicePath = path.resolve(__dirname, '../../services/requirementMediaStore.js');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+bB9sAAAAASUVORK5CYII=';

test.beforeEach(async ({ page }) => {
  await page.route('**/requirement-media-store-test.html', function(route) {
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>图片缓存测试</title>' });
  });
  await page.goto('/requirement-media-store-test.html');
  await page.addScriptTag({ path: servicePath });
});

test('需求图片通过 JSON 引用、跨页和刷新后仍完整读取', async ({ page }) => {
  const reference = await page.evaluate(async function(imageBase64) {
    var store = window.app.services.requirementMediaStore;
    var binary = atob(imageBase64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    var cacheId = await store.saveDocument('user-a', [
      new Blob([bytes], { type: 'image/png' }),
      new Blob(['second-image-content'], { type: 'image/jpeg' }),
    ]);
    return JSON.parse(JSON.stringify({ ownerId: 'user-a', cacheId: cacheId, imageIndex: 1 }));
  }, png);
  await page.goto('/requirement-media-store-test.html?other-page=1');
  await page.reload();
  await page.addScriptTag({ path: servicePath });
  const restored = await page.evaluate(async function(ref) {
    var store = window.app.services.requirementMediaStore;
    var image = await store.loadImage(ref.ownerId, ref.cacheId, ref.imageIndex);
    var first = await store.loadImage(ref.ownerId, ref.cacheId, 0);
    var bytes = new Uint8Array(await first.arrayBuffer());
    var binary = '';
    for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return { text: await image.text(), type: image.type, size: image.size, first: btoa(binary) };
  }, reference);
  expect(restored).toEqual({
    text: 'second-image-content', type: 'image/jpeg', size: 20, first: png,
  });
});

test('图片缓存按所属账号隔离，错误账号不能读取或删除其他账号图片', async ({ page }) => {
  const result = await page.evaluate(async function() {
    var store = window.app.services.requirementMediaStore;
    var cacheId = await store.saveDocument('user-a', [new Blob(['private-image'])]);
    var foreign = await store.loadImage('user-b', cacheId, 0);
    await store.removeDocument('user-b', cacheId);
    var own = await store.loadImage('user-a', cacheId, 0);
    var outOfRange = await store.loadImage('user-a', cacheId, 1);
    await store.removeDocument('user-a', cacheId);
    return { foreign: foreign, own: await own.text(), outOfRange: outOfRange, removed: await store.loadImage('user-a', cacheId, 0) };
  });
  expect(result).toEqual({ foreign: null, own: 'private-image', outOfRange: null, removed: null });
});

test('清理仅删除当前账号过期且无引用的图片，保留新导入和其他账号数据', async ({ page }) => {
  const result = await page.evaluate(async function() {
    var store = window.app.services.requirementMediaStore;
    var originalNow = Date.now;
    var recent;
    var retained;
    var stale;
    var foreign;
    try {
      Date.now = function() { return originalNow() - 3 * 60 * 1000; };
      retained = await store.saveDocument('user-a', [new Blob(['retained'])]);
      stale = await store.saveDocument('user-a', [new Blob(['stale'])]);
      foreign = await store.saveDocument('user-b', [new Blob(['foreign'])]);
    } finally {
      Date.now = originalNow;
    }
    recent = await store.saveDocument('user-a', [new Blob(['recent'])]);
    var removed = await store.pruneDocuments('user-a', [retained]);
    var retainedImage = await store.loadImage('user-a', retained, 0);
    var recentImage = await store.loadImage('user-a', recent, 0);
    var foreignImage = await store.loadImage('user-b', foreign, 0);
    return {
      removed: removed,
      stale: await store.loadImage('user-a', stale, 0),
      retained: await retainedImage.text(),
      recent: await recentImage.text(),
      foreign: await foreignImage.text(),
    };
  });
  expect(result).toEqual({ removed: 1, stale: null, retained: 'retained', recent: 'recent', foreign: 'foreign' });
});

test('缓存不可用、空间不足和非 Blob 图片给出明确错误，不返回未保存的引用', async ({ page }) => {
  const messages = await page.evaluate(async function() {
    var store = window.app.services.requirementMediaStore;
    var result = [];
    for (var images of [[{}], [new Blob([])], new Array(1)]) {
      try { await store.saveDocument('user-a', images); }
      catch (error) { result.push(error.message); }
    }
    var originalIndexedDB = window.indexedDB;
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
    try { await store.saveDocument('user-a', [new Blob(['valid-image'])]); }
    catch (error) { result.push(error.message); }
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: originalIndexedDB });
    var originalAdd = window.IDBObjectStore.prototype.add;
    try {
      window.IDBObjectStore.prototype.add = function() { throw new DOMException('No space', 'QuotaExceededError'); };
      try { await store.saveDocument('user-a', [new Blob(['valid-image'])]); }
      catch (error) { result.push(error.message); }
    } finally {
      window.IDBObjectStore.prototype.add = originalAdd;
    }
    return result;
  });
  expect(messages).toHaveLength(5);
  expect(messages[0]).toContain('本地图片缓存收到无效图片');
  expect(messages[1]).toContain('本地图片缓存收到无效图片');
  expect(messages[2]).toContain('本地图片缓存收到无效图片');
  expect(messages[3]).toContain('本地图片缓存不可用');
  expect(messages[4]).toContain('本地图片缓存空间不足');
});
