'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenImagePipeline.js'
);

function createReaderFactory(resultByBlob) {
  return function() {
    return {
      result: '',
      error: null,
      readAsDataURL: function(blob) {
        if (blob && blob.fail) {
          this.error = new Error('read failed');
          this.onerror();
          return;
        }
        this.result = resultByBlob(blob);
        this.onload();
      },
    };
  };
}

async function verifyBlobReadingAndSizing(factory) {
  var pipeline = factory.create({
    createFileReader: createReaderFactory(function(blob) { return blob.dataUrl; }),
  });
  var dataUrl = await pipeline.readBlobAsDataUrl({ dataUrl: 'data:image/png;base64,QUJDRA==' });
  assert.strictEqual(dataUrl, 'data:image/png;base64,QUJDRA==');
  assert.strictEqual(pipeline.estimateDataUrlBytes(dataUrl), 4);
  assert.strictEqual(pipeline.estimateDataUrlBytes('invalid'), 0);
  await assert.rejects(function() {
    return pipeline.readBlobAsDataUrl({ fail: true });
  }, /read failed/);
}

async function verifyResizeAndFallback(factory) {
  var drawArgs = null;
  var canvas = {
    width: 0,
    height: 0,
    getContext: function() {
      return {
        drawImage: function() { drawArgs = Array.prototype.slice.call(arguments); },
      };
    },
    toDataURL: function(type, quality) {
      return 'data:' + type + ';quality=' + quality + ';base64,QQ==';
    },
  };
  var pipeline = factory.create({
    canCreateCanvas: function() { return true; },
    createCanvas: function() { return canvas; },
    createImage: function() {
      return {
        naturalWidth: 2400,
        naturalHeight: 1200,
        set src(value) {
          this.loadedValue = value;
          this.onload();
        },
      };
    },
  });
  var resized = await pipeline.resizeDataUrl('data:image/png;base64,AAAA', 1200, 'image/webp', 0.8);
  assert.strictEqual(canvas.width, 1200);
  assert.strictEqual(canvas.height, 600);
  assert.strictEqual(drawArgs[3], 1200);
  assert.strictEqual(drawArgs[4], 600);
  assert.strictEqual(resized, 'data:image/webp;quality=0.8;base64,QQ==');

  var passthrough = factory.create({
    canCreateCanvas: function() { return false; },
  });
  assert.strictEqual(
    await passthrough.resizeDataUrl('data:image/png;base64,AAAA', 1200, 'image/jpeg', 0.8),
    'data:image/png;base64,AAAA'
  );
}

async function verifyPreprocessingAndBlockLimits(factory) {
  var smallDataUrl = 'data:image/png;base64,QUJDRA==';
  var pipeline = factory.create({
    maxImages: 2,
    maxBytes: 8,
    canCreateCanvas: function() { return false; },
  });
  assert.deepStrictEqual(await pipeline.preprocessImageToDataUrl(null), {
    ok: false,
    reason: 'missing_blob',
  });
  assert.deepStrictEqual(await pipeline.preprocessImageToDataUrl(smallDataUrl), {
    ok: true,
    dataUrl: smallDataUrl,
  });
  assert.deepStrictEqual(
    await pipeline.preprocessImageToDataUrl('data:image/png;base64,QUJDREVGR0hJSg=='),
    { ok: false, reason: 'too_large' }
  );

  var blocks = await pipeline.buildImageContentBlocks([
    { dataUrl: smallDataUrl },
    { dataUrl: smallDataUrl },
    { dataUrl: smallDataUrl },
  ], true);
  assert.strictEqual(blocks.blocks.length, 2);
  assert.deepStrictEqual(blocks.stats, { total: 3, sent: 2, skipped: 1 });
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  [
    'readBlobAsDataUrl',
    'estimateDataUrlBytes',
    'loadImageByDataUrl',
    'resizeDataUrl',
    'preprocessImageToDataUrl',
    'buildImageContentBlocks',
  ].forEach(function(name) {
    assert.match(ownerSource, new RegExp('function\\s+' + name + '\\s*\\('));
    assert.doesNotMatch(parentSource, new RegExp('function\\s+' + name + '\\s*\\('));
  });
  assert.match(parentSource, /xmindCasegenImagePipeline/);

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var pipelineIndex = html.indexOf('xmindCasegenImagePipeline.js');
    var contentIndex = html.indexOf('xmindCasegenRequirementContentModel.js');
    var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(pipelineIndex >= 0, fileName + ' must load the image pipeline');
    assert.ok(contentIndex > pipelineIndex, fileName + ' must load the image pipeline before requirement content');
    assert.ok(parentIndex > contentIndex, fileName + ' must load requirement content before xmindCasegen.js');
  });
}

async function run() {
  var factory = require(ownerPath);
  await verifyBlobReadingAndSizing(factory);
  await verifyResizeAndFallback(factory);
  await verifyPreprocessingAndBlockLimits(factory);
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen image pipeline tests passed');
}

run().catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
