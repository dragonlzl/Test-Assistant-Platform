'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenRequirementContentModel.js'
);

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return fallback;
  }
}

function createHarness(factory) {
  var prep = {
    requirementMode: 'manual',
    requirementSupplement: '补充条件',
    manualRequirementBlocks: [
      { type: 'text', text: '登录正文' },
      { type: 'image', name: 'login.png', dataUrl: 'data:image/png;base64,QQ==' },
    ],
    caseImportMode: 'import',
    completed: true,
  };
  var state = {
    lastRawImportName: 'requirement.docx',
    requirementMedia: {
      lastDocxImageCount: 3,
      docxImages: [{ blob: { id: 'docx-1' }, index: 2, textOffset: 4, name: 'docx.png' }],
      pastedImages: [{ file: { id: 'paste-1' }, name: 'paste.png' }],
    },
    xmindCaseGen: { prep: prep },
  };
  var documentText = '文档需求正文';
  var shadowDepth = 0;
  var shadowShared = null;
  var combinedCases = [
    { module: '登录', title: '成功登录' },
    { module: '支付', title: '成功支付' },
    { module: '登录', title: '失败登录' },
  ];
  var deletedModules = { '支付': true };
  var deletedCases = { '登录::登录::失败登录': true };
  var fieldChanges = [];
  var model = factory.create({
    getState: function() { return state; },
    getPrepState: function() { return prep; },
    setPrepField: function(key, value) {
      fieldChanges.push([key, value]);
      prep[key] = value;
      return true;
    },
    cloneJson: cloneJson,
    readBlobAsDataUrl: function(file) {
      if (file.fail) return Promise.reject(new Error('failed'));
      return Promise.resolve(file.dataUrl || 'data:image/png;base64,Qg==');
    },
    getDocumentRequirementLabelText: function() { return '文档需求'; },
    getManualRequirementLabelText: function() { return '手填需求'; },
    getRawTextElement: function() { return { value: documentText }; },
    getWorkspaceShadowDepth: function() { return shadowDepth; },
    getShadowWorkspaceSharedState: function() { return shadowShared; },
    normalizeWorkspaceSharedState: function(value) { return value; },
    getCombinedCaseList: function() { return combinedCases; },
    getDeletedBaselineModuleMap: function() { return deletedModules; },
    getDeletedBaselineCaseMap: function() { return deletedCases; },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeModuleKey: function(value) { return String(value || '').trim(); },
    buildCaseSignature: function(item, moduleTitle) { return moduleTitle + '::' + item.title; },
    buildBaselineCaseDeleteKey: function(moduleTitle, signature) { return moduleTitle + '::' + signature; },
    now: function() { return 1234; },
  });
  return {
    model: model,
    prep: prep,
    state: state,
    fieldChanges: fieldChanges,
    setDocumentText: function(value) { documentText = value; },
    setShadow: function(depth, value) { shadowDepth = depth; shadowShared = value; },
    setCombinedCases: function(value) { combinedCases = value; },
  };
}

function verifyModelCapabilities(factory) {
  var model = createHarness(factory).model;
  assert.deepStrictEqual(
    model.normalizeModelCapabilityList({ capabilities: 'text, Vision / text' }),
    ['text', 'Vision']
  );
  assert.deepStrictEqual(
    model.normalizeModelCapabilityList({ tags: { text: true, image_input: true, audio: false } }),
    ['text', 'image_input']
  );
  assert.strictEqual(model.modelSupportsVision({ modelCapabilities: ['TEXT', 'multi-modal'] }), true);
  assert.strictEqual(model.modelSupportsVision({ capabilities: ['text', 'audio'] }), false);
}

function verifyRequirementSources(factory) {
  var harness = createHarness(factory);
  var model = harness.model;
  var manual = model.getSelectedRequirementSource();
  assert.strictEqual(manual.mode, 'manual');
  assert.strictEqual(manual.label, '手填需求');
  assert.strictEqual(manual.text, '登录正文');
  assert.strictEqual(manual.imageCount, 1);
  assert.strictEqual(manual.isReady, true);

  harness.prep.requirementMode = 'document';
  var documentSource = model.getSelectedRequirementSource();
  assert.strictEqual(documentSource.text, '文档需求正文');
  assert.strictEqual(documentSource.label, '文档需求');
  assert.strictEqual(documentSource.importName, 'requirement.docx');
  assert.strictEqual(documentSource.imageCount, 2);
  assert.strictEqual(documentSource.isReady, true);
  assert.strictEqual(model.getDocumentRequirementImageCount(), 4);
  assert.strictEqual(model.collectDocumentRequirementImages()[0].source, 'docx');
  assert.strictEqual(model.collectDocumentRequirementImages()[1].source, 'paste');

  harness.setShadow(1, { rawText: '影子工作区正文' });
  assert.strictEqual(model.getSelectedRequirementSource().text, '影子工作区正文');
  harness.setShadow(0, null);
  harness.setDocumentText('');
  assert.strictEqual(model.getSelectedRequirementSource().isReady, false);
}

async function verifyManualContentEditing(factory) {
  var harness = createHarness(factory);
  var model = harness.model;
  model.setManualRequirementText('更新正文');
  assert.deepStrictEqual(harness.prep.manualRequirementBlocks, [
    { type: 'text', text: '更新正文' },
    { type: 'image', name: 'login.png', dataUrl: 'data:image/png;base64,QQ==' },
  ]);
  assert.strictEqual(await model.appendManualRequirementImages([
    { type: 'text/plain', name: 'skip.txt' },
    { type: 'image/png', name: 'added.png' },
    { type: 'image/png', name: '', dataUrl: 'data:image/png;base64,Qw==' },
    { type: 'image/png', name: 'failed.png', fail: true },
  ]), true);
  assert.strictEqual(model.getManualRequirementImages().length, 3);
  assert.strictEqual(model.getManualRequirementImages()[2].name, 'image-1234-2');
  model.removeManualRequirementImage(1);
  assert.deepStrictEqual(model.getManualRequirementImages().map(function(item) { return item.name; }), [
    'login.png',
    'image-1234-2',
  ]);
}

function verifyBaselineAndReadiness(factory) {
  var harness = createHarness(factory);
  var model = harness.model;
  assert.strictEqual(model.hasImportedBaselineCases(), true);
  assert.deepStrictEqual(model.getVisibleBaselineCaseList().map(function(item) { return item.title; }), [
    '成功登录',
  ]);
  assert.strictEqual(model.hasVisibleImportedBaselineCases(), true);
  assert.strictEqual(model.hasRequirementReady(), true);
  assert.strictEqual(model.hasCaseStepReady(), true);
  assert.strictEqual(model.isPrepCompleted(), true);

  harness.prep.caseImportMode = 'skip';
  harness.setCombinedCases([]);
  assert.strictEqual(model.hasImportedBaselineCases(), false);
  assert.strictEqual(model.hasCaseStepReady(), true);
  harness.prep.completed = false;
  assert.strictEqual(model.isPrepCompleted(), false);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  [
    'normalizeModelCapabilityList',
    'modelSupportsVision',
    'collectDocumentRequirementImages',
    'getDocumentRequirementImageCount',
    'getManualRequirementBlocks',
    'getManualRequirementText',
    'getManualRequirementImages',
    'getSelectedRequirementSource',
    'setManualRequirementText',
    'appendManualRequirementImages',
    'removeManualRequirementImage',
    'hasImportedBaselineCases',
    'getVisibleBaselineCaseList',
    'hasVisibleImportedBaselineCases',
    'hasRequirementReady',
    'hasCaseStepReady',
    'isPrepCompleted',
  ].forEach(function(name) {
    assert.match(ownerSource, new RegExp('function\\s+' + name + '\\s*\\('));
    assert.doesNotMatch(parentSource, new RegExp('function\\s+' + name + '\\s*\\('));
  });
  assert.match(parentSource, /xmindCasegenRequirementContentModel/);

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('xmindCasegenRequirementContentModel.js');
    var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load requirement content first');
  });
}

async function run() {
  var factory = require(ownerPath);
  verifyModelCapabilities(factory);
  verifyRequirementSources(factory);
  await verifyManualContentEditing(factory);
  verifyBaselineAndReadiness(factory);
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen requirement content model tests passed');
}

run().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
