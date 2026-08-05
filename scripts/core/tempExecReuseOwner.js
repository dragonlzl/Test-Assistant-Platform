(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecReuseOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var document = opts.document || (root && root.document ? root.document : null);
    var tempExecStatus = opts.tempExecStatus || null;
    var tempExecView = opts.tempExecView || null;
    var tempExecResultOptions = Array.isArray(opts.tempExecResultOptions)
      ? opts.tempExecResultOptions
      : ['未执行', '通过', '失败', '阻塞', '不适用'];
    var reuseApplicabilityCore = opts.reuseApplicabilityCore || null;
    var generateReusePresetId = port('generateReusePresetId', function() { return 'reuse-' + Date.now(); });
    var generateReuseDetailId = port('generateReuseDetailId', function() {
      return 'reuse-detail-' + Date.now() + '-' + Math.random().toString(16).slice(2, 6);
    });
    var resolveProjectName = port('resolveProjectName', function() { return ''; });
    var getTempExecFile = port('getTempExecFile', function() { return null; });
    var setStatus = port('setStatus');
    var isDbMode = port('isDbMode', function() { return false; });
    var queueExecSetPatch = port('queueExecSetPatch');
    var queueExecCasePatchForItem = port('queueExecCasePatchForItem');
    var persistTempExecState = port('persistTempExecState');
    var renderTempExecView = port('renderTempExecView');
    var normalizeReusePresets = port('normalizeReusePresets', function(value) {
      return Array.isArray(value) ? value : [];
    });
    var getApiClient = port('getApiClient', function() { return null; });
    var openConfirmDrawer = port('openConfirmDrawer', function() {
      return Promise.resolve({ ok: true });
    });
    var normalizeReuseApplicability = port('normalizeReuseApplicability', function() { return null; });
    var escapeHtml = port('escapeHtml', function(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    });
    var isReuseDetailRemoved = port('isReuseDetailRemoved', function(detail) {
      return Boolean(detail && detail.removed);
    });
    var ensureTempExecReuseOpen = port('ensureTempExecReuseOpen', function() { return new Set(); });
    var resetTempExecReuseOpen = port('resetTempExecReuseOpen');
    var clearReuseDetailAutoStatus = port('clearReuseDetailAutoStatus', function(detail) {
      if (!detail) return;
      delete detail.statusOrigin;
      delete detail.statusOriginProfile;
    });
    var normalizeExecStatus = port('normalizeExecStatus', function(value) {
      var text = value === null || value === undefined ? '' : String(value).trim();
      return text && text !== 'pending' ? text : '未执行';
    });
    var captureTempExecAnchorRect = port('captureTempExecAnchorRect', function() { return null; });
    var showTempExecBlockHint = port('showTempExecBlockHint');
    var renderTempExecToolbar = port('renderTempExecToolbar');
    var renderTempExecOverview = port('renderTempExecOverview');
    var updateTempExecFileStateClass = port('updateTempExecFileStateClass');

    function ensureReusePresets(file) {
      if (!file) return [];
      if (!Array.isArray(file.reusePresets)) file.reusePresets = [];
      return file.reusePresets;
    }

    function getTempExecReuseApplicabilityProfile(file) {
      if (!file || !reuseApplicabilityCore || typeof reuseApplicabilityCore.detectProfile !== 'function') return null;
      return reuseApplicabilityCore.detectProfile({
        projectName: resolveProjectName(file.projectId),
        cases: Array.isArray(file.cases) ? file.cases : [],
        presets: ensureReusePresets(file),
      });
    }

    function buildReuseDetailsFromPresets(file) {
      if (!file || !file.reuseEnabled) return [];
      var presets = ensureReusePresets(file);
      if (!presets.length) return [];
      return presets.map(function(preset) {
        return {
          id: generateReuseDetailId(),
          text: preset && preset.text ? preset.text : '',
          note: '',
          status: '未执行',
          presetId: preset && preset.id ? preset.id : '',
          removed: false,
        };
      });
    }

    function startTempExecPresetDraft(fileId) {
      state.tempExecPresetDraft = { fileId: fileId, value: '' };
      renderTempExecView();
    }

    function cancelTempExecPresetDraft() {
      state.tempExecPresetDraft = null;
      renderTempExecView();
    }

    function updateTempExecPresetDraft(value) {
      if (!state.tempExecPresetDraft) return;
      state.tempExecPresetDraft.value = value;
    }

    function applyPresetToCases(file, preset) {
      if (!file || !preset) return;
      file.cases.forEach(function(caseItem) {
        if (!caseItem) return;
        if (!Array.isArray(caseItem.reuseDetails)) caseItem.reuseDetails = [];
        var exists = caseItem.reuseDetails.some(function(detail) { return detail && detail.presetId === preset.id; });
        if (!exists) {
          caseItem.reuseDetails.push({
            id: generateReuseDetailId(),
            text: preset.text,
            note: '',
            status: '未执行',
            presetId: preset.id,
            removed: false,
          });
        }
      });
    }

    function applyPresetsToCase(file, caseItem) {
      if (!file || !caseItem) return false;
      if (!file.reuseEnabled) return false;
      var presets = ensureReusePresets(file);
      if (!presets.length) return false;
      if (!Array.isArray(caseItem.reuseDetails)) caseItem.reuseDetails = [];
      var changed = false;
      presets.forEach(function(preset) {
        if (!preset || !preset.id) return;
        var exists = caseItem.reuseDetails.some(function(detail) { return detail && detail.presetId === preset.id; });
        if (!exists) {
          caseItem.reuseDetails.push({
            id: generateReuseDetailId(),
            text: preset.text || '',
            note: '',
            status: '未执行',
            presetId: preset.id,
            removed: false,
          });
          changed = true;
        }
      });
      return changed;
    }

    function removePresetFromCases(file, presetId) {
      if (!file || !presetId) return;
      file.cases.forEach(function(caseItem) {
        if (!caseItem || !Array.isArray(caseItem.reuseDetails)) return;
        caseItem.reuseDetails = caseItem.reuseDetails.filter(function(detail) { return detail && detail.presetId !== presetId; });
      });
    }

    function confirmTempExecPresetDraft(fileId) {
      var draft = state.tempExecPresetDraft;
      if (!draft || !draft.value || draft.value.trim() === '') {
        if (tempExecStatus) setStatus(tempExecStatus, '请先输入复用预设内容', 'warn');
        return;
      }
      var file = getTempExecFile(fileId);
      if (!file) return;
      var presets = ensureReusePresets(file);
      var exists = presets.some(function(item) { return item && item.text === draft.value; });
      if (exists) {
        if (tempExecStatus) setStatus(tempExecStatus, '已存在相同的预设子项', 'warn');
        return;
      }
      var preset = { id: generateReusePresetId(), text: draft.value };
      presets.push(preset);
      applyPresetToCases(file, preset);
      state.tempExecPresetDraft = null;
      if (isDbMode()) {
        var execSetId = file.execSetId || Number(file.id);
        if (execSetId) {
          queueExecSetPatch(execSetId, { reuse_presets: file.reusePresets || [], reuse_enabled: Boolean(file.reuseEnabled) });
        }
        (file.cases || []).forEach(function(item) {
          if (!item) return;
          queueExecCasePatchForItem(item, { reuse_details: item.reuseDetails || [] });
        });
      }
      persistTempExecState();
      renderTempExecView();
    }

    function renameTempExecPreset(fileId, presetId, nextText) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var presets = ensureReusePresets(file);
      var target = presets.find(function(item) { return item && item.id === presetId; });
      if (!target) return;
      var trimmed = (nextText || '').trim();
      if (!trimmed) {
        if (tempExecStatus) setStatus(tempExecStatus, '预设子项内容不能为空', 'warn');
        return;
      }
      if (target.text === trimmed) return;
      var exists = presets.some(function(item) { return item && item.id !== presetId && item.text === trimmed; });
      if (exists) {
        if (tempExecStatus) setStatus(tempExecStatus, '已存在相同的预设子项', 'warn');
        return;
      }
      var oldText = target.text || '';
      target.text = trimmed;
      (file.cases || []).forEach(function(caseItem) {
        if (!caseItem || !Array.isArray(caseItem.reuseDetails)) return;
        caseItem.reuseDetails.forEach(function(detail) {
          if (!detail) return;
          if (detail.text === oldText) detail.text = trimmed;
        });
      });
      if (isDbMode()) {
        var execSetId = file.execSetId || Number(file.id);
        if (execSetId) {
          queueExecSetPatch(execSetId, { reuse_presets: file.reusePresets || [], reuse_enabled: Boolean(file.reuseEnabled) });
        }
        (file.cases || []).forEach(function(item) {
          if (!item) return;
          queueExecCasePatchForItem(item, { reuse_details: item.reuseDetails || [] });
        });
      }
      persistTempExecState();
      renderTempExecView();
    }

    function updateTempExecPresetApplicability(fileId, presetId, value) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var profile = getTempExecReuseApplicabilityProfile(file);
      if (!profile) return;
      var nextValue = value === null || value === undefined ? '' : String(value).trim();
      var valid = !nextValue || profile.options.some(function(option) { return option && option.value === nextValue; });
      if (!valid) return;
      var preset = ensureReusePresets(file).find(function(item) { return item && item.id === presetId; });
      if (!preset) return;
      if (nextValue) preset.applicability = { profile: profile.key, value: nextValue };
      else delete preset.applicability;
      file._reuseApplicabilityDirty = true;
      persistTempExecState();
      renderTempExecView();
      if (tempExecStatus) setStatus(tempExecStatus, '获取/解锁方式已修改，请应用不适用规则', 'warn');
    }

    function buildTempExecReuseApplicabilityMessage(profile, summary) {
      var parts = [
        '将按“' + profile.label + '”设置不适用 ' + String(summary.autoSet || 0) + ' 项',
        '恢复未执行 ' + String(summary.autoCleared || 0) + ' 项',
      ];
      if (summary.conflicts) parts.push('保留人工结果 ' + String(summary.conflicts) + ' 项');
      return parts.join('，') + '。是否应用？';
    }

    function applyTempExecReuseApplicability(fileId) {
      var file = getTempExecFile(fileId);
      if (!file || !file.reuseEnabled) return Promise.resolve(false);
      var profile = getTempExecReuseApplicabilityProfile(file);
      if (!profile || !reuseApplicabilityCore || typeof reuseApplicabilityCore.planApplication !== 'function') {
        if (tempExecStatus) setStatus(tempExecStatus, '当前用例不支持获取/解锁方式自动匹配', 'warn');
        return Promise.resolve(false);
      }
      var plan = reuseApplicabilityCore.planApplication({
        profileKey: profile.key,
        presets: ensureReusePresets(file),
        cases: Array.isArray(file.cases) ? file.cases : [],
      });
      if (!plan.summary.configuredPresets) {
        if (tempExecStatus) setStatus(tempExecStatus, '请至少为一个预设子项选择获取/解锁方式', 'warn');
        return Promise.resolve(false);
      }
      if (!plan.changes.length && !file._reuseApplicabilityDirty) {
        if (tempExecStatus) setStatus(tempExecStatus, '当前不适用结果已是最新', 'ok');
        return Promise.resolve(true);
      }

      var preparedChanges = plan.changes.map(function(change) {
        var nextCase = plan.cases[change.caseIndex];
        var aggregateStatus = resolveReuseAggregateStatus(change.reuseDetails);
        nextCase.actual = aggregateStatus;
        return {
          case_id: Number(change.caseId),
          reuse_details: change.reuseDetails,
          status: aggregateStatus,
        };
      });
      if (isDbMode()) {
        var hasPendingCase = preparedChanges.some(function(change) {
          return !Number.isFinite(change.case_id) || change.case_id <= 0;
        });
        if (hasPendingCase) {
          if (tempExecStatus) setStatus(tempExecStatus, '部分用例仍在保存，请稍后再应用', 'warn');
          return Promise.resolve(false);
        }
      }

      return openConfirmDrawer({
        title: '应用不适用规则',
        message: buildTempExecReuseApplicabilityMessage(profile, plan.summary),
        hint: plan.summary.conflicts ? '已有人工执行结果不会被覆盖' : '',
        confirmText: '确认应用',
        cancelText: '取消',
      }).then(function(result) {
        if (!result || result.ok !== true) return false;
        var finalize = function(serverResult) {
          file.reusePresets = serverResult && Array.isArray(serverResult.reuse_presets)
            ? normalizeReusePresets(serverResult.reuse_presets)
            : plan.presets;
          file.cases = plan.cases;
          file._reuseApplicabilityDirty = false;
          persistTempExecState();
          renderTempExecView();
          if (tempExecStatus) {
            var text = '已设置不适用 ' + String(plan.summary.autoSet || 0) + ' 项';
            if (plan.summary.autoCleared) text += '，恢复未执行 ' + String(plan.summary.autoCleared) + ' 项';
            if (plan.summary.conflicts) text += '，保留人工结果 ' + String(plan.summary.conflicts) + ' 项';
            setStatus(tempExecStatus, text, 'ok');
          }
          return true;
        };
        if (!isDbMode()) return finalize(null);
        var client = getApiClient();
        var execSetId = Number(file.execSetId || file.id);
        if (!client || typeof client.applyExecReuseApplicability !== 'function' || !execSetId) {
          if (tempExecStatus) setStatus(tempExecStatus, '批量保存接口不可用', 'err');
          return false;
        }
        if (tempExecStatus) setStatus(tempExecStatus, '正在应用不适用规则...', '');
        return client.applyExecReuseApplicability(execSetId, {
          reuse_presets: plan.presets,
          cases: preparedChanges,
        }).then(finalize).catch(function(err) {
          var message = err && err.message ? err.message : '应用失败';
          if (tempExecStatus) setStatus(tempExecStatus, message, 'err');
          return false;
        });
      });
    }

    function removeTempExecPreset(fileId, presetId) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var presets = ensureReusePresets(file);
      var before = presets.length;
      file.reusePresets = presets.filter(function(item) { return item && item.id !== presetId; });
      if (before !== file.reusePresets.length) {
        removePresetFromCases(file, presetId);
        if (isDbMode()) {
          var execSetId = file.execSetId || Number(file.id);
          if (execSetId) {
            queueExecSetPatch(execSetId, { reuse_presets: file.reusePresets || [], reuse_enabled: Boolean(file.reuseEnabled) });
          }
          (file.cases || []).forEach(function(item) {
            if (!item) return;
            queueExecCasePatchForItem(item, { reuse_details: item.reuseDetails || [] });
          });
        }
        persistTempExecState();
        renderTempExecView();
      }
    }

    function getCaseExecutionStatus(file, caseItem) {
      if (!file || !caseItem) return '未执行';
      // 系统态：后端可能标记为“变更重跑/有改动”，该状态统计与过滤均按“未执行”处理。
      var raw = caseItem.actual || '未执行';
      try { raw = String(raw).trim(); } catch (err) { raw = raw || '未执行'; }
      if (raw === 'pending') raw = '未执行';
      if (raw === '变更重跑' || raw === '有改动') return '未执行';
      if (!file.reuseEnabled) return raw;
      return resolveReuseAggregateStatus(caseItem.reuseDetails);
    }

    function aggregateReuseDetails(details) {
      var stats = { pending: 0, passed: 0, failed: 0, blocked: 0, unspecified: 0 };
      if (!Array.isArray(details)) return stats;
      details.forEach(function(detail) {
        if (!detail) return;
        if (isReuseDetailRemoved(detail)) return;
        var status = detail.status || '未执行';
        try { status = String(status).trim(); } catch (err) { status = status || '未执行'; }
        if (status === '通过') stats.passed += 1;
        else if (status === '失败') stats.failed += 1;
        else if (status === '阻塞') stats.blocked += 1;
        else if (status === '不适用') stats.unspecified += 1;
        else stats.pending += 1;
      });
      return stats;
    }

    function resolveReuseAggregateStatus(details) {
      var aggregate = aggregateReuseDetails(details);
      var total = aggregate.passed + aggregate.failed + aggregate.blocked + aggregate.unspecified + aggregate.pending;
      if (!total) return '未执行';
      if (aggregate.failed) return '失败';
      if (aggregate.blocked) return '阻塞';
      if (aggregate.pending) return '未执行';
      if (aggregate.passed) return '通过';
      if (aggregate.unspecified && !aggregate.passed) return '不适用';
      return '未执行';
    }
    function mapStatusToClass(status) {
      var text = status === null || status === undefined ? '' : String(status);
      text = text.trim();
      if (text === '通过') return 'passed';
      if (text === '失败') return 'failed';
      if (text === '阻塞') return 'blocked';
      if (text === '不适用') return 'unspecified';
      return 'pending';
    }

    function getCaseExecutionDisplay(file, caseItem) {
      var raw = caseItem && caseItem.actual ? String(caseItem.actual) : '未执行';
      raw = raw.trim();
      if (raw === 'pending') raw = '未执行';
      if (raw === '变更重跑' || raw === '有改动') {
        return { label: raw, className: 'changed' };
      }
      var status = getCaseExecutionStatus(file, caseItem);
      var className = mapStatusToClass(status);
      var label = status || '未执行';
      return { label: label, className: className || 'pending' };
    }

    function renderReusePresetPanel(file) {
      var presets = ensureReusePresets(file);
      var applicabilityProfile = getTempExecReuseApplicabilityProfile(file);
      var draft = state.tempExecPresetDraft && state.tempExecPresetDraft.fileId === file.id
        ? state.tempExecPresetDraft.value || ''
        : null;
      var chips = presets.map(function(preset) {
        var presetText = preset && preset.text ? preset.text : '';
        var applicability = normalizeReuseApplicability(preset && preset.applicability);
        var selectedValue = applicability && applicabilityProfile && applicability.profile === applicabilityProfile.key
          ? applicability.value
          : '';
        var applicabilitySelect = '';
        if (applicabilityProfile) {
          var applicabilityOptions = ['<option value="">未设置</option>'].concat(applicabilityProfile.options.map(function(option) {
            return '<option value="' + escapeHtml(option.value) + '" ' + (selectedValue === option.value ? 'selected' : '') + '>' + escapeHtml(option.label) + '</option>';
          })).join('');
          applicabilitySelect = '<select class="preset-applicability-select" data-temp-reuse-preset-applicability="' + file.id + '" data-preset="' + preset.id + '" title="获取/解锁方式">' + applicabilityOptions + '</select>';
        }
        return (
          '<span class="preset-chip">' +
            '<span class="preset-text" data-temp-reuse-preset-edit="' + file.id + '" data-preset="' + preset.id + '" title="点击编辑">' + escapeHtml(presetText) + '</span>' +
            applicabilitySelect +
            '<span class="remove" data-temp-reuse-preset-remove="' + file.id + '" data-preset="' + preset.id + '" title="删除预设子项">×</span>' +
          '</span>'
        );
      }).join('');
      var inputHtml = draft !== null
        ? (
          '<span class="preset-input">' +
            '<input data-temp-reuse-preset-input="' + file.id + '" value="' + escapeHtml(draft) + '" placeholder="输入预设子项..." />' +
            '<button type="button" data-temp-reuse-preset-confirm="' + file.id + '">保存</button>' +
            '<button type="button" data-temp-reuse-preset-cancel>取消</button>' +
          '</span>'
        )
        : '';
      var placeholder = !chips && draft === null
        ? '<span class="hint">暂无预设子项，可提前配置常用测试项</span>'
        : '';
      var applicabilityActions = applicabilityProfile
        ? (
          '<span class="preset-profile-label">' + escapeHtml(applicabilityProfile.label) + '</span>' +
          '<button type="button" class="preset-apply" data-temp-reuse-applicability-apply="' + file.id + '">应用不适用</button>'
        )
        : '';
      return (
        '<div class="reuse-presets">' +
          '<button type="button" class="preset-add" data-temp-reuse-preset-add="' + file.id + '">＋ 预设子项</button>' +
          applicabilityActions +
          inputHtml +
          (chips || placeholder) +
        '</div>'
      );
    }

    function renderReuseEntries(file, caseItem, caseIndex) {
      var details = Array.isArray(caseItem.reuseDetails) ? caseItem.reuseDetails : [];
      var visibleDetails = details.filter(function(detail) { return detail && !isReuseDetailRemoved(detail); });
      if (!visibleDetails.length) {
        return '<p class="reuse-empty">暂无复用测试项，点击下方“＋ 添加测试项”。</p>';
      }
      return (
        '<div class="reuse-list">' +
          visibleDetails.map(function(detail) {
            var currentStatus = detail && detail.status ? String(detail.status) : '未执行';
            currentStatus = currentStatus.trim();
            if (currentStatus === 'pending') currentStatus = '未执行';
            var statusClass = mapStatusToClass(currentStatus);
            var optionsHtml = '';
            // 系统态：展示为当前值，但不允许用户主动选择（不出现在常规选项中）。
            if (currentStatus === '变更重跑' || currentStatus === '有改动') {
              statusClass = 'changed';
              optionsHtml += '<option value="' + escapeHtml(currentStatus) + '" selected disabled>' + escapeHtml(currentStatus) + '</option>';
            }
            optionsHtml += tempExecResultOptions.map(function(opt) {
              return '<option value="' + opt + '" ' + (currentStatus === opt ? 'selected' : '') + '>' + opt + '</option>';
            }).join('');
            return (
              '<div class="reuse-entry" data-detail="' + detail.id + '">' +
                '<input class="reuse-input" data-temp-reuse-text="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '" placeholder="输入测试项..." value="' + escapeHtml(detail.text || '') + '"/>' +
                '<input class="reuse-note" data-temp-reuse-note="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '" placeholder="输入独立备注..." value="' + escapeHtml(detail.note || '') + '"/>' +
                '<select class="status-select ' + statusClass + '" data-temp-reuse-status="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '">' +
                  optionsHtml +
                '</select>' +
                '<button type="button" class="reuse-remove" data-temp-reuse-remove="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '" title="删除测试项">删除</button>' +
              '</div>'
            );
          }).join('') +
        '</div>'
      );
    }
    function toggleTempExecReusePanel(fileId, indexes) {
      if (!fileId) return;
      var file = getTempExecFile(fileId);
      if (!file) return;
      var openSet = ensureTempExecReuseOpen(fileId);
      var list = Array.isArray(indexes) ? indexes : [indexes];
      var valid = list
        .map(function(idx) { return Number(idx); })
        .filter(function(idx) { return Number.isInteger(idx); });
      if (!valid.length) return;
      var shouldOpen = !valid.every(function(idx) { return openSet.has(idx); });
      valid.forEach(function(idx) {
        if (shouldOpen) openSet.add(idx);
        else openSet.delete(idx);
      });
      renderTempExecView();
    }

    function addTempExecReuseEntry(fileId, index) {
      var file = getTempExecFile(fileId);
      if (!file || !file.reuseEnabled) return;
      if (!file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      targetCase.reuseDetails.push({ id: generateReuseDetailId(), text: '', note: '', status: '未执行', removed: false });
      // 复用模式下同时维护 exec_case.status，方便总览统计与清除“变更重跑”系统态。
      targetCase.actual = resolveReuseAggregateStatus(targetCase.reuseDetails);
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails, status: targetCase.actual });
      }
      persistTempExecState();
      renderTempExecView();
    }

    function removeTempExecReuseEntry(fileId, index, detailId) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) return;
      openConfirmDrawer({
        title: '删除复用测试项',
        message: '确定删除该复用测试项吗？该操作不可撤销。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (!result || result.ok !== true) return;
        var nextFile = getTempExecFile(fileId);
        if (!nextFile || !nextFile.cases[index]) return;
        var nextCase = nextFile.cases[index];
        if (!Array.isArray(nextCase.reuseDetails)) return;
        var details = nextCase.reuseDetails;
        var updated = false;
        for (var i = 0; i < details.length; i += 1) {
          var detail = details[i];
          if (!detail || detail.id !== detailId) continue;
          if (detail.presetId) {
            if (!detail.removed) {
              detail.removed = true;
              detail.status = '未执行';
              detail.note = '';
              updated = true;
            }
          } else {
            details.splice(i, 1);
            updated = true;
          }
          break;
        }
        if (!updated) return;
        nextCase.reuseDetails = details;
        nextCase.actual = resolveReuseAggregateStatus(nextCase.reuseDetails);
        if (isDbMode()) {
          queueExecCasePatchForItem(nextCase, { reuse_details: nextCase.reuseDetails, status: nextCase.actual });
        }
        persistTempExecState();
        renderTempExecView();
      });
    }

    function updateTempExecReuseStatus(fileId, index, detailId, value) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      var entry = targetCase.reuseDetails.find(function(item) { return item.id === detailId; });
      if (!entry) return;
      if (isReuseDetailRemoved(entry)) return;
      var nextStatus = tempExecResultOptions.indexOf(value) !== -1 ? value : '未执行';
      entry.status = nextStatus;
      clearReuseDetailAutoStatus(entry);
      targetCase.actual = resolveReuseAggregateStatus(targetCase.reuseDetails);
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails, status: targetCase.actual });
      }
      persistTempExecState();
      updateTempExecReuseStatusUi(fileId, index, detailId, nextStatus);
    }

    // 仅刷新复用子项结果的局部 UI，避免整页重绘导致抖动。
    function updateTempExecReuseStatusUi(fileId, index, detailId, status) {
      if (!tempExecView || !tempExecView.querySelectorAll) return;
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      var normalized = normalizeReuseDetailStatus(status);
      var statusClass = mapStatusToClass(normalized);
      var selectEl = null;
      var selects = tempExecView.querySelectorAll('select[data-temp-reuse-status]');
      for (var i = 0; i < selects.length; i += 1) {
        var node = selects[i];
        if (!node || !node.dataset) continue;
        if (String(node.dataset.tempReuseStatus || '') !== String(fileId)) continue;
        if (String(node.dataset.index || '') !== String(index)) continue;
        if (String(node.dataset.detail || '') !== String(detailId)) continue;
        selectEl = node;
        break;
      }
      if (selectEl) {
        if (selectEl.value !== normalized) selectEl.value = normalized;
        if (selectEl.classList) {
          selectEl.classList.remove('passed', 'failed', 'blocked', 'unspecified', 'pending', 'changed');
          if (statusClass) selectEl.classList.add(statusClass);
        } else if (selectEl.className !== undefined) {
          var cls = String(selectEl.className || '').split(/\s+/).filter(Boolean);
          cls = cls.filter(function(name) {
            return ['passed', 'failed', 'blocked', 'unspecified', 'pending', 'changed'].indexOf(name) === -1;
          });
          if (statusClass) cls.push(statusClass);
          selectEl.className = cls.join(' ');
        }
      }
      var buttonEl = null;
      var buttons = tempExecView.querySelectorAll('button[data-temp-reuse-panel]');
      for (var j = 0; j < buttons.length; j += 1) {
        var btn = buttons[j];
        if (!btn || !btn.dataset) continue;
        if (String(btn.dataset.tempReusePanel || '') !== String(fileId)) continue;
        if (String(btn.dataset.index || '') !== String(index)) continue;
        buttonEl = btn;
        break;
      }
      if (buttonEl) {
        var display = getCaseExecutionDisplay(file, targetCase);
        if (buttonEl.classList) {
          buttonEl.classList.remove('passed', 'failed', 'blocked', 'unspecified', 'pending', 'changed');
          if (display && display.className) buttonEl.classList.add(display.className);
        } else if (buttonEl.className !== undefined) {
          var btnCls = String(buttonEl.className || '').split(/\s+/).filter(Boolean);
          btnCls = btnCls.filter(function(name) {
            return ['passed', 'failed', 'blocked', 'unspecified', 'pending', 'changed'].indexOf(name) === -1;
          });
          if (display && display.className) btnCls.push(display.className);
          buttonEl.className = btnCls.join(' ');
        }
        while (buttonEl.firstChild) buttonEl.removeChild(buttonEl.firstChild);
        var label = display && display.label ? display.label : '未执行';
        buttonEl.appendChild(document.createTextNode(label));
        var openSet = ensureTempExecReuseOpen(fileId);
        var showPending = Boolean(file.reuseEnabled) && !openSet.has(index);
        if (showPending) {
          var summary = aggregateReuseDetails(targetCase.reuseDetails);
          var pendingCount = summary && summary.pending ? summary.pending : 0;
          if (pendingCount > 0) {
            var badge = document.createElement('span');
            badge.className = 'reuse-pending-badge';
            badge.setAttribute('data-reuse-pending', String(pendingCount));
            badge.textContent = String(pendingCount);
            buttonEl.appendChild(badge);
          }
        }
      }
      renderTempExecToolbar(file);
      renderTempExecOverview();
      updateTempExecFileStateClass(fileId);
    }

    function normalizeReuseDetailStatus(value) {
      var text = value === null || value === undefined ? '' : String(value);
      text = text.trim();
      if (!text || text === 'pending') return '未执行';
      return text;
    }

    function syncTempExecReuseStatusFromFirst(fileId, index, anchorEl) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails) || !targetCase.reuseDetails.length) {
        var anchorRect = captureTempExecAnchorRect(anchorEl);
        if (anchorRect) {
          showTempExecBlockHint(anchorRect, '暂无可同步的复用子项');
        }
        if (tempExecStatus) setStatus(tempExecStatus, '暂无可同步的复用子项', 'warn');
        return;
      }
      var details = targetCase.reuseDetails;
      var visibleDetails = details.filter(function(detail) { return detail && !isReuseDetailRemoved(detail); });
      if (!visibleDetails.length) {
        var anchorRect2 = captureTempExecAnchorRect(anchorEl);
        if (anchorRect2) {
          showTempExecBlockHint(anchorRect2, '暂无可同步的复用子项');
        }
        if (tempExecStatus) setStatus(tempExecStatus, '暂无可同步的复用子项', 'warn');
        return;
      }
      var blockedStatuses = {
        '失败': true,
        '通过': true,
        '阻塞': true,
        '不适用': true,
      };
      var syncStatus = '';
      for (var i = 0; i < visibleDetails.length; i += 1) {
        var entry = visibleDetails[i];
        var entryStatus = normalizeReuseDetailStatus(entry.status);
        if (!blockedStatuses[entryStatus]) continue;
        if (!syncStatus) {
          syncStatus = entryStatus;
          continue;
        }
        if (syncStatus !== entryStatus) {
          var anchorRect3 = captureTempExecAnchorRect(anchorEl);
          if (anchorRect3) {
            showTempExecBlockHint(anchorRect3, '其他子项已有执行结果，无法直接同步');
          }
          if (tempExecStatus) setStatus(tempExecStatus, '其他子项已有执行结果，无法直接同步', 'warn');
          return;
        }
      }
      if (!syncStatus) {
        var first = visibleDetails[0];
        syncStatus = normalizeReuseDetailStatus(first.status);
      }
      var changed = false;
      for (var i = 0; i < visibleDetails.length; i += 1) {
        var detail = visibleDetails[i];
        var hadAutoStatus = Boolean(detail.statusOrigin || detail.statusOriginProfile);
        if (detail.status !== syncStatus || hadAutoStatus) {
          detail.status = syncStatus;
          clearReuseDetailAutoStatus(detail);
          changed = true;
        }
      }
      if (!changed) {
        if (tempExecStatus) setStatus(tempExecStatus, '子项结果已一致', 'ok');
        return;
      }
      targetCase.actual = resolveReuseAggregateStatus(details);
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails, status: targetCase.actual });
      }
      persistTempExecState();
      renderTempExecView();
      if (tempExecStatus) setStatus(tempExecStatus, '已同步结果', 'ok');
    }

    function updateTempExecReuseText(fileId, index, detailId, text) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      var entry = targetCase.reuseDetails.find(function(item) { return item.id === detailId; });
      if (!entry) return;
      if (isReuseDetailRemoved(entry)) return;
      entry.text = text || '';
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails });
      }
      persistTempExecState();
    }

    function updateTempExecReuseNote(fileId, index, detailId, text) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      var entry = targetCase.reuseDetails.find(function(item) { return item.id === detailId; });
      if (!entry) return;
      if (isReuseDetailRemoved(entry)) return;
      entry.note = text || '';
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails });
      }
      persistTempExecState();
    }

    function handleTempExecReuseToggle(fileId, enabled, checkboxEl) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      if (enabled === Boolean(file.reuseEnabled)) return;
      function applyReuseToggle(nextEnabled) {
        if (!state.tempExecReuseBatchExpanded || typeof state.tempExecReuseBatchExpanded !== 'object') {
          state.tempExecReuseBatchExpanded = {};
        }
        if (nextEnabled) {
          file.reuseEnabled = true;
          ensureReusePresets(file);
          delete state.tempExecReuseBatchExpanded[fileId];
        } else {
          file.reuseEnabled = false;
          file.cases.forEach(function(item) {
            item.reuseDetails = [];
          });
          file.reusePresets = [];
          if (state.tempExecPresetDraft && state.tempExecPresetDraft.fileId === fileId) {
            state.tempExecPresetDraft = null;
          }
          resetTempExecReuseOpen(fileId);
          delete state.tempExecReuseBatchExpanded[fileId];
        }
        if (isDbMode()) {
          var execSetId = file.execSetId || Number(file.id);
          if (execSetId) {
            queueExecSetPatch(execSetId, { reuse_enabled: Boolean(file.reuseEnabled), reuse_presets: file.reusePresets || [] });
          }
          if (nextEnabled) {
            file.cases.forEach(function(item) {
              if (!item) return;
              queueExecCasePatchForItem(item, { status: '未执行', remark: '' });
            });
          } else {
            file.cases.forEach(function(item) {
              if (!item) return;
              queueExecCasePatchForItem(item, { reuse_details: [], status: normalizeExecStatus(item.actual) });
            });
          }
        }
        persistTempExecState();
        renderTempExecView();
      }

      if (enabled) {
        var hasExecution = file.cases.some(function(item) {
          var status = getCaseExecutionStatus(file, item);
          return (status && status !== '未执行') || (item.remark && item.remark.trim());
        });
        if (hasExecution) {
          var confirmMsg = '开启“用例复用”会清空当前执行结果与备注，是否继续？';
          openConfirmDrawer({
            title: '开启用例复用',
            message: confirmMsg,
            danger: true,
          }).then(function(res) {
            if (!res || res.ok !== true) {
              if (checkboxEl) checkboxEl.checked = false;
              return;
            }
            file.cases.forEach(function(item) {
              item.actual = '未执行';
              item.remark = '';
            });
            applyReuseToggle(true);
          });
          return;
        }
        applyReuseToggle(true);
        return;
      }

      var hasReuse = file.cases.some(function(item) {
        var details = Array.isArray(item.reuseDetails) ? item.reuseDetails : [];
        return details.some(function(detail) { return detail && !isReuseDetailRemoved(detail); });
      });
      if (hasReuse) {
        var confirmClose = '关闭“用例复用”会删除所有复用测试项与预设子项，是否继续？';
        openConfirmDrawer({
          title: '关闭用例复用',
          message: confirmClose,
          danger: true,
        }).then(function(res2) {
          if (!res2 || res2.ok !== true) {
            if (checkboxEl) checkboxEl.checked = true;
            return;
          }
          applyReuseToggle(false);
        });
        return;
      }
      applyReuseToggle(false);
    }

    return {
      ensureReusePresets: ensureReusePresets,
      getTempExecReuseApplicabilityProfile: getTempExecReuseApplicabilityProfile,
      buildReuseDetailsFromPresets: buildReuseDetailsFromPresets,
      startTempExecPresetDraft: startTempExecPresetDraft,
      cancelTempExecPresetDraft: cancelTempExecPresetDraft,
      updateTempExecPresetDraft: updateTempExecPresetDraft,
      applyPresetToCases: applyPresetToCases,
      applyPresetsToCase: applyPresetsToCase,
      removePresetFromCases: removePresetFromCases,
      confirmTempExecPresetDraft: confirmTempExecPresetDraft,
      renameTempExecPreset: renameTempExecPreset,
      updateTempExecPresetApplicability: updateTempExecPresetApplicability,
      buildTempExecReuseApplicabilityMessage: buildTempExecReuseApplicabilityMessage,
      applyTempExecReuseApplicability: applyTempExecReuseApplicability,
      removeTempExecPreset: removeTempExecPreset,
      getCaseExecutionStatus: getCaseExecutionStatus,
      aggregateReuseDetails: aggregateReuseDetails,
      resolveReuseAggregateStatus: resolveReuseAggregateStatus,
      mapStatusToClass: mapStatusToClass,
      getCaseExecutionDisplay: getCaseExecutionDisplay,
      renderReusePresetPanel: renderReusePresetPanel,
      renderReuseEntries: renderReuseEntries,
      toggleTempExecReusePanel: toggleTempExecReusePanel,
      addTempExecReuseEntry: addTempExecReuseEntry,
      removeTempExecReuseEntry: removeTempExecReuseEntry,
      updateTempExecReuseStatus: updateTempExecReuseStatus,
      updateTempExecReuseStatusUi: updateTempExecReuseStatusUi,
      normalizeReuseDetailStatus: normalizeReuseDetailStatus,
      syncTempExecReuseStatusFromFirst: syncTempExecReuseStatusFromFirst,
      updateTempExecReuseText: updateTempExecReuseText,
      updateTempExecReuseNote: updateTempExecReuseNote,
      handleTempExecReuseToggle: handleTempExecReuseToggle,
    };
  }

  return { create: create };
});

