const assert = require('assert');
const model = require('../../scripts/modules/execOverview/execOverviewLayoutWindowModel.js');

assert.deepStrictEqual(
  model.resolveWindowRange({ total: 0, windowSize: 4 }),
  { startIndex: 0, endIndex: -1, atEnd: false }
);

assert.deepStrictEqual(
  model.resolveWindowRange({
    total: 6,
    windowSize: 4,
    scrollLeft: 500,
    scrollWidth: 1320,
    clientWidth: 400,
    unit: 200,
  }),
  { startIndex: 1, endIndex: 4, atEnd: false }
);

assert.deepStrictEqual(
  model.resolveWindowRange({
    total: 6,
    windowSize: 4,
    scrollLeft: 919.5,
    scrollWidth: 1320,
    clientWidth: 400,
    unit: 220,
  }),
  { startIndex: 2, endIndex: 5, atEnd: true }
);

assert.deepStrictEqual(
  model.resolveWindowRange({
    total: 3,
    windowSize: 4,
    scrollLeft: 900,
    scrollWidth: 1200,
    clientWidth: 300,
    unit: 220,
  }),
  { startIndex: 0, endIndex: 2, atEnd: true }
);

console.log('exec overview layout window model tests passed');
