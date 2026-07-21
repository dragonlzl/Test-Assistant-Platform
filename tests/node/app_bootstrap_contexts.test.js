'use strict';

var assert = require('assert');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var configApi = require(path.join(projectRoot, 'scripts/modules/app/appConfigContext.js'));
var domApi = require(path.join(projectRoot, 'scripts/modules/app/appDomContext.js'));
var lifecycleApi = require(path.join(projectRoot, 'scripts/modules/app/appTaskLifecycleController.js'));

function verifyConfigContext() {
  var defaults = configApi.create({});
  assert.strictEqual(defaults.defaultTempExecPageSize, 20);
  assert.strictEqual(defaults.defaultSettings.timeoutSec, 300);
  assert.strictEqual(defaults.defaultSettings.caseViewFontSize, 13);
  assert.notStrictEqual(defaults.defaultSettings.tempExecColumns, defaults.defaultTempExecColumns);
  assert.deepStrictEqual(defaults.tempExecResultOptions, ['未执行', '通过', '失败', '阻塞', '不适用']);

  var customSettings = { timeoutSec: 90, caseViewFontSize: 15 };
  var customColumns = { title: true };
  var custom = configApi.create({
    defaultSettings: customSettings,
    defaultTempExecColumns: customColumns,
    defaultTempExecPageSize: '50',
    defaultMaxTokens: 4096,
    minModelTimeoutSec: '45',
    maxModelTimeoutSec: '900',
  });
  assert.strictEqual(custom.defaultSettings, customSettings);
  assert.strictEqual(custom.defaultTempExecColumns, customColumns);
  assert.strictEqual(custom.defaultTempExecPageSize, 50);
  assert.strictEqual(custom.defaultMaxTokens, 4096);
  assert.strictEqual(custom.defaultCaseViewFontSize, 15);
  assert.strictEqual(custom.minModelTimeoutSec, 45);
  assert.strictEqual(custom.maxModelTimeoutSec, 900);
}

function createFakeDocument() {
  var elements = Object.create(null);

  function createElement(tagName) {
    return {
      tagName: String(tagName || '').toUpperCase(),
      id: '',
      style: {},
      children: [],
      attributes: {},
      setAttribute: function(name, value) {
        this.attributes[name] = String(value);
      },
      appendChild: function(child) {
        this.children.push(child);
        if (child && child.id) elements[child.id] = child;
        return child;
      },
      querySelector: function(selector) {
        return { ownerId: this.id, selector: selector };
      },
    };
  }

  var document = {
    body: createElement('body'),
    createElement: createElement,
    getElementById: function(id) { return elements[id] || null; },
    querySelector: function(selector) { return { selector: selector }; },
    querySelectorAll: function(selector) { return [{ selector: selector }]; },
  };
  document.body.appendChild = function(child) {
    this.children.push(child);
    if (child && child.id) elements[child.id] = child;
    return child;
  };
  elements.rawText = createElement('textarea');
  elements.rawText.id = 'rawText';
  elements.tempFocusBlock = createElement('div');
  elements.tempFocusBlock.id = 'tempFocusBlock';
  elements.tempExecViewFocusBlock = createElement('div');
  elements.tempExecViewFocusBlock.id = 'tempExecViewFocusBlock';

  return { document: document, elements: elements };
}

function verifyDomContext() {
  var fake = createFakeDocument();
  var originalRaw = fake.elements.rawText;
  var result = domApi.create({
    document: fake.document,
    domConfig: {
      ids: ['rawText', 'tempFocusBlock'],
      alias: [
        { name: 'cleanedTextEl', id: 'cleanedText' },
        { name: 'splitResultEl', id: 'splitResult' },
        { name: 'caseTextEl', id: 'caseText' },
      ],
    },
    buildDom: function(ids, aliases) {
      var dom = {};
      ids.forEach(function(id) { dom[id] = fake.document.getElementById(id); });
      aliases.forEach(function(item) { dom[item.name] = fake.document.getElementById(item.id); });
      return dom;
    },
  });

  assert.strictEqual(fake.document.getElementById('rawText'), originalRaw);
  assert.strictEqual(fake.document.getElementById('autoWorkflowGhostFields').style.display, 'none');
  assert.strictEqual(fake.document.getElementById('reviewResult').attributes['data-ghost'], 'true');
  assert.strictEqual(result.dom.cleanedTextEl, fake.document.getElementById('cleanedText'));
  assert.strictEqual(result.dom.tempFocusZone.ownerId, 'tempFocusBlock');
  assert.strictEqual(result.dom.tempExecViewFocusZone.ownerId, 'tempExecViewFocusBlock');
  assert.strictEqual(result.debugNodes.raw.textarea, originalRaw);
  assert.strictEqual(result.debugNodes.cleaned.textarea, result.dom.cleanedTextEl);
}

function verifyTaskLifecycle() {
  var listeners = Object.create(null);
  var scheduled = [];
  var clearedScenes = [];
  var missingResumeCount = 0;
  var autoResumeCount = 0;
  var loadModelsCount = 0;
  var loadAssignmentsCount = 0;
  var appliedTasks = [];
  var root = {
    app: { settingsReady: true, _inited: false },
    addEventListener: function(name, listener) { listeners[name] = listener; },
  };
  var state = { settings: { missingCaseReminderAiEnabled: 'off' } };
  var controller = lifecycleApi.create({
    root: root,
    state: state,
    missingReminderAiManager: {
      resumeTasks: function(options) {
        assert.strictEqual(options.force, true);
        missingResumeCount += 1;
      },
      clearTask: function(scene) { clearedScenes.push(scene); },
    },
    autoWorkflowManager: {
      resumeTask: function(options) {
        assert.strictEqual(options.force, true);
        autoResumeCount += 1;
      },
      getTask: function() { return { id: 'auto-1' }; },
    },
    applyAutoWorkflowTaskState: function(task) { appliedTasks.push(task); },
    loadModels: function() { loadModelsCount += 1; },
    loadAssignments: function() { loadAssignmentsCount += 1; },
    setTimeout: function(callback, delay) {
      scheduled.push({ callback: callback, delay: delay });
      return scheduled.length;
    },
    resumeDelayMs: 25,
  });

  assert.deepStrictEqual(clearedScenes, ['case-library', 'temp-exec']);
  assert.strictEqual(scheduled.length, 1);
  assert.strictEqual(scheduled[0].delay, 25);
  state.settings.missingCaseReminderAiEnabled = 'on';
  listeners['app-settings-updated']({ detail: { keys: ['theme'] } });
  assert.strictEqual(missingResumeCount, 0);
  listeners['app-settings-updated']({ detail: { keys: ['missingCaseReminderAiEnabled'] } });
  assert.strictEqual(missingResumeCount, 1);

  root.app._inited = true;
  scheduled.shift().callback();
  assert.strictEqual(autoResumeCount, 1);
  assert.strictEqual(loadModelsCount, 1);
  assert.strictEqual(loadAssignmentsCount, 1);
  assert.deepStrictEqual(appliedTasks.shift(), { id: 'auto-1' });

  listeners['auto-workflow-task']({ detail: { task: { id: 'auto-2' } } });
  assert.deepStrictEqual(appliedTasks.shift(), { id: 'auto-2' });
  controller.syncAutoWorkflowTaskState(null);
  assert.strictEqual(appliedTasks.shift(), null);
}

verifyConfigContext();
verifyDomContext();
verifyTaskLifecycle();
console.log('app bootstrap context tests passed');
