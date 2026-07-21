const assert = require('assert');
const contract = require('../../scripts/ui/tableContract.js');
const theme = require('../../scripts/ui/vtableTheme.js');
const host = require('../../scripts/ui/vtableHost.js');
const editorRegistry = require('../../scripts/ui/vtableEditorRegistry.js');
const semanticMirror = require('../../scripts/ui/tableSemanticMirror.js');

function FakeElement(tagName) {
  this.tagName = String(tagName || '').toLowerCase();
  this.children = [];
  this.attributes = Object.create(null);
  this.listeners = Object.create(null);
  this.className = '';
  this.textContent = '';
  this.value = '';
  this.type = '';
  this.name = '';
  this.checked = false;
  this.disabled = false;
}

FakeElement.prototype.appendChild = function(child) {
  this.children.push(child);
  return child;
};

FakeElement.prototype.replaceChildren = function() {
  this.children = Array.prototype.slice.call(arguments);
};

FakeElement.prototype.setAttribute = function(name, value) {
  this.attributes[name] = String(value);
};

FakeElement.prototype.getAttribute = function(name) {
  return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
};

FakeElement.prototype.addEventListener = function(type, listener) {
  if (!this.listeners[type]) this.listeners[type] = [];
  this.listeners[type].push(listener);
};

FakeElement.prototype.dispatchEvent = function(event) {
  const payload = event || {};
  payload.target = payload.target || this;
  (this.listeners[payload.type] || []).slice().forEach(function(listener) {
    listener(payload);
  });
};

function testAdapterContract() {
  assert.throws(function() {
    contract.normalizeAdapter({ columns: [] });
  }, /id/);
  assert.throws(function() {
    contract.normalizeAdapter({ id: 'cases' });
  }, /columns/);

  const source = [
    { id: 'same', title: 'Alpha', selected: true, secret: 'x' },
    { id: 'same', title: 'Beta', selected: false, secret: 'y' },
  ];
  const adapter = {
    id: 'case-list',
    caption: '用例列表',
    rowKey: function(record) { return record.id; },
    columns: [
      { key: 'title', title: '标题', width: 240 },
      { key: 'selected', title: '选择', kind: 'checkbox' },
      { key: 'secret', title: '隐藏', visible: false },
      {
        key: 'actions',
        title: '操作',
        kind: 'actions',
        actions: [
          { id: 'open', label: '查看' },
          { id: 'remove', label: '删除', disabled: function(record) { return record.selected; } },
        ],
      },
    ],
    records: source,
  };

  const model = contract.buildTableModel(adapter);
  assert.strictEqual(model.id, 'case-list');
  assert.strictEqual(model.caption, '用例列表');
  assert.deepStrictEqual(model.columns.map(function(column) { return column.key; }), [
    'title',
    'selected',
    'actions',
  ]);
  assert.strictEqual(model.records[0].__rowKey, 'same');
  assert.strictEqual(model.records[1].__rowKey, 'same--2');
  assert.strictEqual(model.records[0].title, 'Alpha');
  assert.strictEqual(model.records[0].selected, true);
  assert.strictEqual(model.records[0].actions, '查看 / 删除');
  assert.strictEqual(model.records[0].__source, source[0]);
  assert.deepStrictEqual(source[0], { id: 'same', title: 'Alpha', selected: true, secret: 'x' });
  assert.strictEqual(model.columns[2].actions[1].disabled(source[0], 0), true);
}

function testThemeContract() {
  assert.strictEqual(theme.tokens.headerHeight, 36);
  assert.strictEqual(theme.tokens.rowHeight, 38);
  assert.strictEqual(theme.tokens.fontSize, 14);
  assert.strictEqual(theme.tokens.mutedFontSize, 13);
  assert.strictEqual(theme.tokens.accent, '#155eef');
  assert.strictEqual(theme.tokens.border, '#edf1f7');

  const light = theme.buildTheme('light');
  const dark = theme.buildTheme('dark');
  assert.strictEqual(light.bodyStyle.bgColor, '#ffffff');
  assert.strictEqual(light.headerStyle.color, '#344054');
  assert.strictEqual(dark.bodyStyle.bgColor, '#182231');
  assert.notStrictEqual(dark.bodyStyle.color, light.bodyStyle.color);
}

function testEditorContract() {
  const canEdit = function(record) { return record.locked !== true; };
  const editorAttributes = function(record) { return { 'data-editor-row': record.id }; };
  const adapter = contract.normalizeAdapter({
    id: 'editable-cases',
    columns: [
      { key: 'title', title: '标题', editable: canEdit, editor: { attributes: editorAttributes } },
      { key: 'steps', title: '步骤', editable: true, multiline: true },
      { key: 'date', title: '日期', editor: 'date' },
      { key: 'status', title: '状态', editor: { type: 'list', values: ['新建', '完成'] } },
    ],
  });

  assert.strictEqual(adapter.columns[0].editor.type, 'input');
  assert.strictEqual(adapter.columns[0].editor.name, 'tap-editor-editable-cases-title');
  assert.strictEqual(adapter.columns[0].editor.canEdit, canEdit);
  assert.strictEqual(adapter.columns[0].editor.attributes, editorAttributes);
  assert.strictEqual(adapter.columns[1].editor.type, 'textarea');
  assert.strictEqual(adapter.columns[2].editor.type, 'date');
  assert.deepStrictEqual(adapter.columns[3].editor.options.values, ['新建', '完成']);
  assert.deepStrictEqual(editorRegistry.collect({ columns: adapter.columns }).map(function(item) {
    return item.type;
  }), ['input', 'textarea', 'date', 'list']);
  assert.throws(function() {
    contract.normalizeAdapter({
      id: 'invalid-editor',
      columns: [{ key: 'title', editor: 'unknown' }],
    });
  }, /Unsupported VTable editor type/);
  assert.throws(function() {
    contract.normalizeAdapter({
      id: 'invalid-list-editor',
      columns: [{ key: 'status', editor: 'list' }],
    });
  }, /values are required/);
}

function testSelectionContract() {
  const source = [
    { id: 'case-a', title: 'Alpha' },
    { id: 'case-b', title: 'Beta' },
    { id: 'case-c', title: 'Gamma' },
  ];
  const model = contract.buildTableModel({
    id: 'selection-cases',
    strictRowKey: true,
    rowKey: function(record) { return record.id; },
    columns: [
      { key: 'title', title: '标题' },
      { key: 'status', title: '状态' },
    ],
    records: source,
  });
  const payload = host.buildSelectionPayload(model, {
    col: 1,
    row: 2,
    ranges: [{ start: { col: 0, row: 1 }, end: { col: 1, row: 2 } }],
  });

  assert.deepStrictEqual(payload.rowKeys, ['case-a', 'case-b']);
  assert.deepStrictEqual(payload.records, [source[0], source[1]]);
  assert.deepStrictEqual(payload.active, {
    rowKey: 'case-b',
    recordIndex: 1,
    columnKey: 'status',
    columnIndex: 1,
  });
  assert.strictEqual(payload.ranges[0].start.rowKey, 'case-a');
  assert.strictEqual(payload.ranges[0].end.rowKey, 'case-b');
  assert.deepStrictEqual(host.buildSelectionPayload(model, { ranges: [] }).rowKeys, []);
}

function testRadioColumnContract() {
  const disabled = function(record) { return record.locked === true; };
  const source = [
    { id: 'radio-a', selected: true, locked: false },
    { id: 'radio-b', selected: false, locked: false },
    { id: 'radio-c', selected: 'true', locked: true },
  ];
  const adapter = contract.normalizeAdapter({
    id: 'radio-cases',
    strictRowKey: true,
    rowKey: function(record) { return record.id; },
    columns: [
      { key: 'selected', title: '默认', kind: 'radio', disabled: disabled },
    ],
    records: source,
  });
  const column = adapter.columns[0];
  assert.strictEqual(column.kind, 'radio');
  assert.strictEqual(column.align, 'center');
  assert.strictEqual(column.disabled, disabled);

  const model = contract.buildTableModel(adapter);
  assert.strictEqual(model.records[0].selected, true);
  assert.strictEqual(model.records[1].selected, false);
  assert.strictEqual(model.records[2].selected, false);

  const definition = host.buildColumns(model)[0];
  const firstArgs = {
    col: 0,
    row: 1,
    dataValue: true,
    table: { getRecordByCell: function() { return model.records[0]; } },
  };
  const thirdArgs = {
    col: 0,
    row: 3,
    dataValue: false,
    table: { getRecordByCell: function() { return model.records[2]; } },
  };
  assert.strictEqual(definition.cellType, 'radio');
  assert.strictEqual(definition.radioCheckType, 'column');
  assert.strictEqual(definition.checked(firstArgs), true);
  assert.strictEqual(definition.checked(thirdArgs), false);
  assert.strictEqual(definition.disable(firstArgs), false);
  assert.strictEqual(definition.disable(thirdArgs), true);
}

function testProgrammaticCellFocusContract() {
  const model = contract.buildTableModel({
    id: 'programmatic-focus',
    strictRowKey: true,
    rowKey: function(record) { return record.id; },
    columns: [
      { key: 'title', title: '标题' },
      { key: 'type', title: '状态' },
    ],
    records: [
      { id: 'case-a', title: 'Alpha', type: 'added' },
      { id: 'case-b', title: 'Beta', type: 'changed' },
    ],
  });
  const target = host.resolveFocusTarget(model, { rowKey: 'case-b', columnKey: 'type' });
  const calls = [];
  const table = {
    scrollToCell: function(position) { calls.push(['scroll', position]); },
    selectCell: function(col, row) { calls.push(['select', col, row]); },
    clearSelected: function() { calls.push(['clear']); },
  };

  assert.strictEqual(host.scrollToFocus(table, target), true);
  assert.deepStrictEqual(calls, [
    ['scroll', { row: 2, col: 1 }],
    ['select', 1, 2],
  ]);
  assert.strictEqual(host.scrollToFocus(table, null), true);
  assert.deepStrictEqual(calls[calls.length - 1], ['clear']);

  table.startEditCell = function(col, row) { calls.push(['edit', col, row]); };
  const editTarget = host.resolveFocusTarget(model, {
    rowKey: 'case-a',
    columnKey: 'title',
    edit: true,
  });
  assert.strictEqual(host.scrollToFocus(table, editTarget), true);
  assert.deepStrictEqual(calls.slice(-3), [
    ['scroll', { row: 1, col: 0 }],
    ['select', 0, 1],
    ['edit', 0, 1],
  ]);
}

function testSemanticFocusSelectionContract() {
  const model = contract.buildTableModel({
    id: 'semantic-focus',
    strictRowKey: true,
    rowKey: function(record) { return record.id; },
    columns: [{ key: 'title', title: '标题' }],
    records: [
      { id: 'case-a', title: 'Alpha' },
      { id: 'case-b', title: 'Beta' },
    ],
  });
  const previousDocument = global.document;
  global.document = {
    createElement: function(tagName) { return new FakeElement(tagName); },
  };
  try {
    const container = new FakeElement('div');
    semanticMirror.render(container, model, { focusRowKey: 'case-b' });
    const table = container.children[0];
    const tbody = table.children.filter(function(child) { return child.tagName === 'tbody'; })[0];
    assert.strictEqual(tbody.children[0].getAttribute('aria-selected'), 'false');
    assert.strictEqual(tbody.children[1].getAttribute('aria-selected'), 'true');

    semanticMirror.render(container, model, {});
    const clearedTable = container.children[0];
    const clearedBody = clearedTable.children.filter(function(child) {
      return child.tagName === 'tbody';
    })[0];
    assert.strictEqual(clearedBody.children[0].getAttribute('aria-selected'), 'false');
    assert.strictEqual(clearedBody.children[1].getAttribute('aria-selected'), 'false');
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
}

function testSemanticRadioContract() {
  const changes = [];
  const model = contract.buildTableModel({
    id: 'semantic-radio',
    strictRowKey: true,
    rowKey: function(record) { return record.id; },
    columns: [
      {
        key: 'selected',
        title: '默认',
        kind: 'radio',
        disabled: function(record) { return record.locked === true; },
      },
    ],
    records: [
      { id: 'radio-a', selected: true, locked: false },
      { id: 'radio-b', selected: false, locked: false },
      { id: 'radio-c', selected: false, locked: true },
    ],
    onCellChange: function(payload) {
      changes.push({
        rowKey: payload.record.id,
        value: payload.value,
        source: payload.source,
      });
    },
  });
  const previousDocument = global.document;
  global.document = {
    createElement: function(tagName) { return new FakeElement(tagName); },
  };
  try {
    const container = new FakeElement('div');
    semanticMirror.render(container, model, {});
    const table = container.children[0];
    const tbody = table.children.filter(function(child) { return child.tagName === 'tbody'; })[0];
    const firstRadio = tbody.children[0].children[0].children[0];
    const secondRadio = tbody.children[1].children[0].children[0];
    const thirdRadio = tbody.children[2].children[0].children[0];

    assert.strictEqual(firstRadio.type, 'radio');
    assert.strictEqual(secondRadio.type, 'radio');
    assert.strictEqual(thirdRadio.type, 'radio');
    assert.ok(firstRadio.name);
    assert.strictEqual(firstRadio.name, secondRadio.name);
    assert.strictEqual(firstRadio.name, thirdRadio.name);
    assert.strictEqual(firstRadio.checked, true);
    assert.strictEqual(secondRadio.checked, false);
    assert.strictEqual(thirdRadio.checked, false);
    assert.strictEqual(firstRadio.disabled, false);
    assert.strictEqual(secondRadio.disabled, false);
    assert.strictEqual(thirdRadio.disabled, true);

    secondRadio.checked = false;
    secondRadio.dispatchEvent({ type: 'change' });
    assert.deepStrictEqual(changes, []);
    secondRadio.checked = true;
    secondRadio.dispatchEvent({ type: 'change' });
    assert.deepStrictEqual(changes, [
      { rowKey: 'radio-b', value: true, source: 'semantic' },
    ]);
    thirdRadio.checked = true;
    thirdRadio.dispatchEvent({ type: 'change' });
    assert.strictEqual(changes.length, 1);
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
}

function testSemanticMetadataContract() {
  const model = contract.buildTableModel({
    id: 'semantic-metadata',
    strictRowKey: true,
    rowKey: function(record) { return record.id; },
    columns: [
      {
        key: 'selected',
        title: '选择',
        kind: 'checkbox',
        semanticCellClass: 'selection-cell',
        semanticControlAttributes: function(record) {
          return { 'data-case-select': record.id };
        },
      },
      {
        key: 'status',
        title: '状态',
        semanticCellClass: function(record) {
          return record.active ? 'status-active' : 'status-idle';
        },
        semanticCellAttributes: function(record) {
          return { 'data-case-status': record.id };
        },
      },
      {
        key: 'actions',
        title: '操作',
        kind: 'actions',
        actions: [
          {
            id: 'open',
            label: '打开',
            semanticClass: 'open-action',
            semanticAttributes: function(record) {
              return { 'data-case-open': record.id };
            },
          },
        ],
      },
    ],
    records: [{ id: 'case-a', selected: true, status: '执行中', active: true }],
  });
  const previousDocument = global.document;
  global.document = {
    createElement: function(tagName) { return new FakeElement(tagName); },
  };
  try {
    const container = new FakeElement('div');
    semanticMirror.render(container, model, {});
    const table = container.children[0];
    const tbody = table.children.filter(function(child) { return child.tagName === 'tbody'; })[0];
    const row = tbody.children[0];
    const checkboxCell = row.children[0];
    const statusCell = row.children[1];
    const actionButton = row.children[2].children[0];

    assert.strictEqual(checkboxCell.className, 'selection-cell');
    assert.strictEqual(checkboxCell.children[0].getAttribute('data-case-select'), 'case-a');
    assert.strictEqual(statusCell.className, 'status-active');
    assert.strictEqual(statusCell.getAttribute('data-case-status'), 'case-a');
    assert.strictEqual(actionButton.className, 'open-action');
    assert.strictEqual(actionButton.getAttribute('data-case-open'), 'case-a');
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
}

function testSemanticEditorContract() {
  const changes = [];
  const model = contract.buildTableModel({
    id: 'semantic-editor',
    strictRowKey: true,
    rowKey: function(record) { return record.id; },
    semanticRowClass: function(record) { return record.added ? 'case-row new-added' : 'case-row'; },
    columns: [
      {
        key: 'title',
        title: '标题',
        editable: true,
        semanticControlAttributes: function(record) {
          return { 'data-case-title': record.id };
        },
      },
      {
        key: 'steps',
        title: '步骤',
        editable: true,
        multiline: true,
      },
    ],
    records: [{ id: 'case-a', title: 'Alpha', steps: 'step 1', added: true }],
    onCellChange: function(payload) { changes.push(payload); },
  });
  const previousDocument = global.document;
  global.document = {
    createElement: function(tagName) { return new FakeElement(tagName); },
  };
  try {
    const container = new FakeElement('div');
    semanticMirror.render(container, model, {});
    const table = container.children[0];
    const tbody = table.children.filter(function(child) { return child.tagName === 'tbody'; })[0];
    const row = tbody.children[0];
    const titleCell = row.children[0];
    const titleControl = titleCell.children[1];
    const stepsControl = row.children[1].children[1];

    assert.strictEqual(row.className, 'case-row new-added');
    assert.strictEqual(titleCell.children[0].textContent, 'Alpha');
    assert.strictEqual(titleControl.tagName, 'input');
    assert.strictEqual(titleControl.value, 'Alpha');
    assert.strictEqual(titleControl.getAttribute('data-case-title'), 'case-a');
    assert.strictEqual(stepsControl.tagName, 'textarea');
    titleControl.value = 'Beta';
    titleControl.dispatchEvent({ type: 'change' });
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].value, 'Beta');
    assert.strictEqual(changes[0].previousValue, 'Alpha');
    assert.strictEqual(changes[0].source, 'semantic-editor');
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
}

testAdapterContract();
testThemeContract();
testEditorContract();
testSelectionContract();
testRadioColumnContract();
testProgrammaticCellFocusContract();
testSemanticFocusSelectionContract();
testSemanticRadioContract();
testSemanticMetadataContract();
testSemanticEditorContract();
console.log('ui table contract tests passed');
