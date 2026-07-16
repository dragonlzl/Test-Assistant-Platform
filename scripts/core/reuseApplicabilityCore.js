(function() {
  window.app = window.app || {};

  var TARGET_PROJECT_NAME = '元气骑士';
  var AUTO_STATUS_ORIGIN = 'auto-applicability';
  var PENDING_STATUS = '未执行';
  var NOT_APPLICABLE_STATUS = '不适用';

  var PROFILES = {
    'character-skin-unlock-v1': {
      key: 'character-skin-unlock-v1',
      label: '角色皮肤解锁方式',
      options: [
        { value: 'fragment', label: '碎片' },
        { value: 'gem', label: '宝石' },
        { value: 'paid', label: '付费' },
        { value: 'fish', label: '小鱼干' },
        { value: 'season-store', label: '赛季商店' },
        { value: 'legacy-skin-gift', label: '老皮肤赠送' },
        { value: 'condition', label: '条件解锁' },
      ],
      moduleValues: {
        '碎片皮肤': 'fragment',
        '宝石皮肤': 'gem',
        '付费皮肤': 'paid',
        '小鱼干皮肤': 'fish',
        '赛季币皮肤': 'season-store',
        '通过购买老皮肤送的新皮肤': 'legacy-skin-gift',
        '条件皮肤': 'condition',
      },
    },
    'weapon-evolution-skin-acquisition-v1': {
      key: 'weapon-evolution-skin-acquisition-v1',
      label: '武器进化皮肤获取方式',
      options: [
        { value: 'gashapon', label: '扭蛋' },
        { value: 'fish-store', label: '小鱼干商店' },
        { value: 'blind-box', label: '盲盒' },
        { value: 'mail', label: '邮箱' },
      ],
    },
  };

  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function cloneOptions(options) {
    return (Array.isArray(options) ? options : []).map(function(item) {
      return { value: item.value, label: item.label };
    });
  }

  function toPublicProfile(profile) {
    if (!profile) return null;
    return {
      key: profile.key,
      label: profile.label,
      options: cloneOptions(profile.options),
    };
  }

  function isKnownProfileValue(profileKey, value) {
    var profile = PROFILES[profileKey];
    if (!profile) return false;
    return profile.options.some(function(option) {
      return option.value === value;
    });
  }

  function normalizeApplicability(value) {
    if (!value || typeof value !== 'object') return null;
    var profile = normalizeText(value.profile);
    var optionValue = normalizeText(value.value);
    if (!profile || !optionValue || !isKnownProfileValue(profile, optionValue)) return null;
    return { profile: profile, value: optionValue };
  }

  function normalizePreset(preset) {
    var source = preset && typeof preset === 'object' ? preset : {};
    var next = Object.assign({}, source);
    var applicability = normalizeApplicability(source.applicability);
    if (applicability) next.applicability = applicability;
    else delete next.applicability;
    return next;
  }

  function collectModules(cases) {
    var moduleSet = {};
    (Array.isArray(cases) ? cases : []).forEach(function(caseItem) {
      var moduleName = normalizeText(caseItem && caseItem.module);
      if (moduleName) moduleSet[moduleName] = true;
    });
    return moduleSet;
  }

  function detectStoredProfile(presets) {
    var keys = {};
    (Array.isArray(presets) ? presets : []).forEach(function(preset) {
      var applicability = normalizeApplicability(preset && preset.applicability);
      if (applicability) keys[applicability.profile] = true;
    });
    var values = Object.keys(keys);
    return values.length === 1 ? PROFILES[values[0]] || null : null;
  }

  function detectCharacterSkinProfile(moduleSet) {
    var profile = PROFILES['character-skin-unlock-v1'];
    var matched = Object.keys(profile.moduleValues).filter(function(moduleName) {
      return moduleSet[moduleName] === true;
    });
    return matched.length >= 2 ? profile : null;
  }

  function detectWeaponSkinProfile(moduleSet) {
    if (!moduleSet['皮肤碎片']) return null;
    var supportingModules = ['皮肤操作', '皮肤使用', '皮肤存储', '联机同步'];
    var matched = supportingModules.some(function(moduleName) {
      return moduleSet[moduleName] === true;
    });
    return matched ? PROFILES['weapon-evolution-skin-acquisition-v1'] : null;
  }

  function detectProfile(context) {
    var source = context && typeof context === 'object' ? context : {};
    if (normalizeText(source.projectName) !== TARGET_PROJECT_NAME) return null;
    var stored = detectStoredProfile(source.presets);
    if (stored) return toPublicProfile(stored);
    var moduleSet = collectModules(source.cases);
    var character = detectCharacterSkinProfile(moduleSet);
    if (character) return toPublicProfile(character);
    return toPublicProfile(detectWeaponSkinProfile(moduleSet));
  }

  function classifyCharacterSkinCase(caseItem) {
    var profile = PROFILES['character-skin-unlock-v1'];
    var moduleName = normalizeText(caseItem && caseItem.module);
    return profile.moduleValues[moduleName] || '';
  }

  function classifyWeaponSkinCase(caseItem) {
    var moduleName = normalizeText(caseItem && caseItem.module);
    var title = normalizeText(caseItem && caseItem.title);
    if (moduleName !== '皮肤碎片' || title !== '获取途径') return '';
    var steps = normalizeText(caseItem && caseItem.steps);
    if (steps.indexOf('小鱼干商店') !== -1) return 'fish-store';
    if (steps.indexOf('扭蛋') !== -1) return 'gashapon';
    if (steps.indexOf('盲盒') !== -1) return 'blind-box';
    if (steps.indexOf('邮箱') !== -1) return 'mail';
    return '';
  }

  function classifyCase(profileKey, caseItem) {
    if (profileKey === 'character-skin-unlock-v1') return classifyCharacterSkinCase(caseItem);
    if (profileKey === 'weapon-evolution-skin-acquisition-v1') return classifyWeaponSkinCase(caseItem);
    return '';
  }

  function normalizeStatus(value) {
    var text = normalizeText(value);
    if (!text || text === 'pending') return PENDING_STATUS;
    return text;
  }

  function isPendingStatus(value) {
    var status = normalizeStatus(value);
    return status === PENDING_STATUS || status === '变更重跑' || status === '有改动';
  }

  function isAutoStatus(detail, profileKey) {
    if (!detail || detail.statusOrigin !== AUTO_STATUS_ORIGIN) return false;
    var storedProfile = normalizeText(detail.statusOriginProfile);
    return !storedProfile || storedProfile === profileKey;
  }

  function clearAutoStatus(detail) {
    var next = Object.assign({}, detail);
    delete next.statusOrigin;
    delete next.statusOriginProfile;
    return next;
  }

  function applyDetailRule(detail, preset, profileKey, caseValue, summary) {
    var current = detail && typeof detail === 'object' ? detail : {};
    if (current.removed) return { detail: current, changed: false };
    var applicability = normalizeApplicability(preset && preset.applicability);
    var configured = Boolean(applicability && applicability.profile === profileKey);
    var shouldBeNotApplicable = Boolean(caseValue && configured && applicability.value !== caseValue);
    var autoOwned = isAutoStatus(current, profileKey);
    var status = normalizeStatus(current.status);

    if (shouldBeNotApplicable) {
      if (autoOwned || isPendingStatus(status)) {
        var autoDetail = Object.assign({}, current, {
          status: NOT_APPLICABLE_STATUS,
          statusOrigin: AUTO_STATUS_ORIGIN,
          statusOriginProfile: profileKey,
        });
        var autoChanged = status !== NOT_APPLICABLE_STATUS
          || current.statusOrigin !== AUTO_STATUS_ORIGIN
          || current.statusOriginProfile !== profileKey;
        if (autoChanged) summary.autoSet += 1;
        return { detail: autoDetail, changed: autoChanged };
      }
      summary.conflicts += 1;
      return { detail: current, changed: false };
    }

    if (!autoOwned) return { detail: current, changed: false };
    var restored = clearAutoStatus(current);
    if (status === NOT_APPLICABLE_STATUS) restored.status = PENDING_STATUS;
    summary.autoCleared += 1;
    return { detail: restored, changed: true };
  }

  function planApplication(input) {
    var source = input && typeof input === 'object' ? input : {};
    var profileKey = normalizeText(source.profileKey);
    if (!PROFILES[profileKey]) {
      return {
        profile: null,
        presets: [],
        cases: Array.isArray(source.cases) ? source.cases.slice() : [],
        changes: [],
        summary: {
          configuredPresets: 0,
          matchedCases: 0,
          ignoredCases: 0,
          changedCases: 0,
          changedDetails: 0,
          autoSet: 0,
          autoCleared: 0,
          conflicts: 0,
        },
      };
    }

    var presets = (Array.isArray(source.presets) ? source.presets : []).map(normalizePreset);
    var presetById = {};
    var configuredPresets = 0;
    presets.forEach(function(preset) {
      var presetId = normalizeText(preset && preset.id);
      if (presetId) presetById[presetId] = preset;
      var applicability = normalizeApplicability(preset && preset.applicability);
      if (applicability && applicability.profile === profileKey) configuredPresets += 1;
    });

    var summary = {
      configuredPresets: configuredPresets,
      matchedCases: 0,
      ignoredCases: 0,
      changedCases: 0,
      changedDetails: 0,
      autoSet: 0,
      autoCleared: 0,
      conflicts: 0,
    };
    var changes = [];
    var cases = (Array.isArray(source.cases) ? source.cases : []).map(function(caseItem, caseIndex) {
      var caseValue = classifyCase(profileKey, caseItem);
      if (caseValue) summary.matchedCases += 1;
      else summary.ignoredCases += 1;
      var caseChanged = false;
      var details = (caseItem && Array.isArray(caseItem.reuseDetails) ? caseItem.reuseDetails : []).map(function(detail) {
        var presetId = normalizeText(detail && detail.presetId);
        var result = applyDetailRule(detail, presetById[presetId] || null, profileKey, caseValue, summary);
        if (result.changed) {
          caseChanged = true;
          summary.changedDetails += 1;
        }
        return result.detail;
      });
      if (!caseChanged) return caseItem;
      var nextCase = Object.assign({}, caseItem, { reuseDetails: details });
      summary.changedCases += 1;
      changes.push({
        caseIndex: caseIndex,
        caseId: caseItem && (caseItem.execCaseId || caseItem.id) ? (caseItem.execCaseId || caseItem.id) : null,
        reuseDetails: details,
      });
      return nextCase;
    });

    return {
      profile: toPublicProfile(PROFILES[profileKey]),
      presets: presets,
      cases: cases,
      changes: changes,
      summary: summary,
    };
  }

  window.app.reuseApplicabilityCore = {
    AUTO_STATUS_ORIGIN: AUTO_STATUS_ORIGIN,
    TARGET_PROJECT_NAME: TARGET_PROJECT_NAME,
    detectProfile: detectProfile,
    classifyCase: classifyCase,
    normalizeApplicability: normalizeApplicability,
    normalizePreset: normalizePreset,
    planApplication: planApplication,
  };
})();
