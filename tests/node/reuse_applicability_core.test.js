'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var context = vm.createContext({
  window: { app: {} },
  Array: Array,
  Boolean: Boolean,
  Object: Object,
  String: String,
});
var source = fs.readFileSync(path.join(projectRoot, 'scripts/core/reuseApplicabilityCore.js'), 'utf8');
vm.runInContext(source, context, { filename: 'scripts/core/reuseApplicabilityCore.js' });

var core = context.window.app.reuseApplicabilityCore;

function buildDetail(id, presetId, status, extra) {
  return Object.assign({
    id: id,
    presetId: presetId,
    text: presetId,
    note: '',
    status: status || '未执行',
    removed: false,
  }, extra || {});
}

var characterCases = [
  { id: 1, module: '付费皮肤', title: '付费解锁', steps: '尝试解锁', reuseDetails: [] },
  { id: 2, module: '小鱼干皮肤', title: '小鱼干足够时解锁', steps: '尝试解锁', reuseDetails: [] },
  { id: 3, module: '通用', title: '皮肤外形', steps: '观察', reuseDetails: [] },
];
var characterProfile = core.detectProfile({
  projectName: '元气骑士',
  cases: characterCases.concat([{ module: '宝石皮肤', title: '解锁方式' }]),
  presets: [],
});
assert.strictEqual(characterProfile && characterProfile.key, 'character-skin-unlock-v1');
assert.strictEqual(core.detectProfile({ projectName: '其他项目', cases: characterCases, presets: [] }), null);

var presets = [
  { id: 'preset-a', text: 'A皮肤', applicability: { profile: characterProfile.key, value: 'paid' } },
  { id: 'preset-b', text: 'B皮肤', applicability: { profile: characterProfile.key, value: 'fish' } },
];
characterCases[0].reuseDetails = [
  buildDetail('detail-a-1', 'preset-a'),
  buildDetail('detail-b-1', 'preset-b'),
];
characterCases[1].reuseDetails = [
  buildDetail('detail-a-2', 'preset-a'),
  buildDetail('detail-b-2', 'preset-b'),
];
characterCases[2].reuseDetails = [
  buildDetail('detail-a-3', 'preset-a'),
  buildDetail('detail-b-3', 'preset-b'),
];

var planned = core.planApplication({
  profileKey: characterProfile.key,
  presets: presets,
  cases: characterCases,
});
assert.strictEqual(planned.summary.autoSet, 2);
assert.strictEqual(planned.summary.changedCases, 2);
assert.strictEqual(planned.cases[0].reuseDetails[0].status, '未执行');
assert.strictEqual(planned.cases[0].reuseDetails[1].status, '不适用');
assert.strictEqual(planned.cases[0].reuseDetails[1].statusOrigin, 'auto-applicability');
assert.strictEqual(planned.cases[1].reuseDetails[0].status, '不适用');
assert.strictEqual(planned.cases[1].reuseDetails[1].status, '未执行');
assert.strictEqual(planned.cases[2].reuseDetails[0].status, '未执行');
assert.strictEqual(planned.cases[2].reuseDetails[1].status, '未执行');

var conflictCases = [{
  id: 4,
  module: '付费皮肤',
  title: '付费解锁',
  reuseDetails: [buildDetail('detail-b-4', 'preset-b', '通过')],
}];
var conflictPlan = core.planApplication({
  profileKey: characterProfile.key,
  presets: presets,
  cases: conflictCases,
});
assert.strictEqual(conflictPlan.summary.conflicts, 1);
assert.strictEqual(conflictPlan.summary.changedCases, 0);
assert.strictEqual(conflictPlan.cases[0].reuseDetails[0].status, '通过');

var changedPreset = [{
  id: 'preset-a',
  text: 'A皮肤',
  applicability: { profile: characterProfile.key, value: 'paid' },
}];
var switchedCases = [{
  id: 5,
  module: '付费皮肤',
  title: '付费解锁',
  reuseDetails: [buildDetail('detail-a-5', 'preset-a', '不适用', {
    statusOrigin: 'auto-applicability',
    statusOriginProfile: characterProfile.key,
  })],
}];
var switchedPlan = core.planApplication({
  profileKey: characterProfile.key,
  presets: changedPreset,
  cases: switchedCases,
});
assert.strictEqual(switchedPlan.summary.autoCleared, 1);
assert.strictEqual(switchedPlan.cases[0].reuseDetails[0].status, '未执行');
assert.strictEqual(switchedPlan.cases[0].reuseDetails[0].statusOrigin, undefined);

var weaponCases = [
  { id: 10, module: '皮肤碎片', title: '获取途径', steps: '通过扭蛋观察能否获得', reuseDetails: [] },
  { id: 11, module: '皮肤碎片', title: '获取途径', steps: '通过小鱼干商店配置观察能否获得', reuseDetails: [] },
  { id: 12, module: '皮肤操作', title: '皮肤更换', steps: '尝试选择对应皮肤', reuseDetails: [] },
];
var weaponProfile = core.detectProfile({
  projectName: '元气骑士',
  cases: weaponCases,
  presets: [],
});
assert.strictEqual(weaponProfile && weaponProfile.key, 'weapon-evolution-skin-acquisition-v1');
assert.strictEqual(core.classifyCase(weaponProfile.key, weaponCases[0]), 'gashapon');
assert.strictEqual(core.classifyCase(weaponProfile.key, weaponCases[1]), 'fish-store');
assert.strictEqual(core.classifyCase(weaponProfile.key, weaponCases[2]), '');

console.log('reuse_applicability_core.test.js passed');
