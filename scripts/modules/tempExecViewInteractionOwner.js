(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecViewInteractionOwner = api;
  }
})(function() {
  function parseIndexList(raw) {
    return String(raw || '').split(',').map(function(value) {
      var number = Number(value);
      return Number.isFinite(number) ? number : null;
    }).filter(function(value) { return value !== null; });
  }

  function normalizeEditableText(target, trimPriority) {
    if (!target || !target.dataset) return '';
    var multiline = String(target.dataset.tempEditMultiline || '').toLowerCase() === 'true';
    var raw = typeof target.innerText === 'string' ? target.innerText : (target.textContent || '');
    var normalized = raw.replace(/\r\n/g, '\n');
    if (!multiline) normalized = normalized.replace(/\n/g, ' ').trim();
    if (target.dataset.tempEditField === 'priority') {
      normalized = normalized.toUpperCase();
      if (trimPriority) normalized = normalized.trim();
    }
    return normalized;
  }

  function getAnchorRect(element) {
    var rect = null;
    try {
      rect = element && element.getBoundingClientRect ? element.getBoundingClientRect() : null;
    } catch (error) {
      rect = null;
    }
    if (!rect) return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
    };
  }

  function closest(event, selector) {
    var target = event && event.target ? event.target : null;
    return target && typeof target.closest === 'function' ? target.closest(selector) : null;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var browser = opts.window || (typeof window !== 'undefined' ? window : {});
    var document = opts.document || (browser && browser.document ? browser.document : null);
    var view = opts.viewElement || (document ? document.getElementById('tempExecView') : null);
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var statusElement = opts.statusElement || null;
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var switchTab = typeof opts.switchTab === 'function' ? opts.switchTab : function() {};
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var reuseLifecycle = opts.reuseLifecycle && typeof opts.reuseLifecycle === 'object'
      ? opts.reuseLifecycle
      : {};
    var bound = false;

    function promptPresetName(configValue) {
      var config = configValue && typeof configValue === 'object' ? configValue : {};
      var drawerApi = browser.app && browser.app.confirmDrawer ? browser.app.confirmDrawer : null;
      if (drawerApi && typeof drawerApi.open === 'function') {
        return drawerApi.open({
          title: config.title || '编辑预设子项',
          message: config.message || '请输入新的预设子项名称',
          confirmText: config.confirmText || '保存',
          cancelText: config.cancelText || '取消',
          previousDrawer: config.previousDrawer || null,
          input: {
            label: config.label || '预设子项',
            placeholder: config.placeholder || '请输入预设子项名称',
            required: true,
            requiredMessage: config.requiredMessage || '请输入预设子项名称',
            maxLength: Number.isFinite(config.maxLength) ? Number(config.maxLength) : 60,
            value: config.value || '',
            validate: config.validate,
          },
        });
      }
      var raw = typeof browser.prompt === 'function'
        ? browser.prompt(config.prompt || '请输入预设子项名称', config.value || '')
        : null;
      if (raw === null) return Promise.resolve({ ok: false });
      var trimmed = String(raw || '').trim();
      if (!trimmed) return Promise.resolve({ ok: false, reason: 'empty' });
      return Promise.resolve({ ok: true, value: trimmed });
    }

    function openMissingReminder() {
      var requestKey = 'tap-case-library-missing-drawer-request';
      try {
        if (browser.app) {
          browser.app.__drawerSkipRestoreOnce = true;
          browser.app.__drawerSkipCloseId = 'caseLibraryMissingDrawer';
        }
      } catch (error) {
        // Ignore compatibility state failures and continue with navigation.
      }
      if (browser.app && browser.app.caseLibraryApi &&
        typeof browser.app.caseLibraryApi.requestMissingDrawer === 'function') {
        browser.app.caseLibraryApi.requestMissingDrawer();
      } else {
        var storage = browser.sessionStorage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
        if (storage) {
          try { storage.setItem(requestKey, '1'); } catch (error) {}
        }
      }
      switchTab('case-library');
    }

    function handleClick(event) {
      var reminderLink = closest(event, '[data-missing-reminder-link]');
      if (reminderLink) {
        openMissingReminder();
        return;
      }
      var reminderAi = closest(event, '[data-missing-reminder-ai]');
      if (reminderAi) {
        if (!reminderAi.disabled && typeof api.triggerTempExecMissingReminderAiRecommend === 'function') {
          api.triggerTempExecMissingReminderAiRecommend();
        }
        return;
      }
      var presetAddButton = closest(event, '[data-temp-reuse-preset-add]');
      if (presetAddButton && typeof api.startTempExecPresetDraft === 'function') {
        var presetFileId = presetAddButton.dataset.tempReusePresetAdd;
        var presetFile = typeof api.getTempExecFile === 'function' ? api.getTempExecFile(presetFileId) : null;
        if (presetFile && presetFile.reuseEnabled) api.startTempExecPresetDraft(presetFileId);
        else if (statusElement) setStatus(statusElement, '请先开启用例复用再添加预设子项', 'warn');
        return;
      }
      var applicabilityApplyButton = closest(event, '[data-temp-reuse-applicability-apply]');
      if (applicabilityApplyButton && typeof api.applyTempExecReuseApplicability === 'function') {
        api.applyTempExecReuseApplicability(applicabilityApplyButton.dataset.tempReuseApplicabilityApply);
        return;
      }
      var presetCancelButton = closest(event, '[data-temp-reuse-preset-cancel]');
      if (presetCancelButton && typeof api.cancelTempExecPresetDraft === 'function') {
        api.cancelTempExecPresetDraft();
        return;
      }
      var presetConfirmButton = closest(event, '[data-temp-reuse-preset-confirm]');
      if (presetConfirmButton && typeof api.confirmTempExecPresetDraft === 'function') {
        api.confirmTempExecPresetDraft(presetConfirmButton.dataset.tempReusePresetConfirm);
        return;
      }
      var presetEditButton = closest(event, '[data-temp-reuse-preset-edit]');
      if (presetEditButton && typeof api.renameTempExecPreset === 'function') {
        var editFileId = presetEditButton.dataset.tempReusePresetEdit;
        var editPresetId = presetEditButton.dataset.preset;
        var editFile = typeof api.getTempExecFile === 'function' ? api.getTempExecFile(editFileId) : null;
        var editPresets = editFile
          ? (typeof api.ensureReusePresets === 'function' ? api.ensureReusePresets(editFile) : (editFile.reusePresets || []))
          : [];
        var editPreset = editPresets.find(function(item) { return item && item.id === editPresetId; });
        if (editFileId && editPresetId && editPreset) {
          promptPresetName({
            value: editPreset.text || '',
            maxLength: 80,
            validate: function(nextValue) {
              var trimmed = String(nextValue || '').trim();
              if (!trimmed) return '请输入预设子项名称';
              var duplicated = editPresets.some(function(item) {
                return item && item.id !== editPresetId && item.text === trimmed;
              });
              return duplicated ? '已存在相同的预设子项' : '';
            },
          }).then(function(result) {
            if (result && result.ok === true) {
              api.renameTempExecPreset(editFileId, editPresetId, result.value);
            }
          });
        }
        return;
      }
      var presetRemoveButton = closest(event, '[data-temp-reuse-preset-remove]');
      if (presetRemoveButton && typeof api.removeTempExecPreset === 'function') {
        var removePresetFileId = presetRemoveButton.dataset.tempReusePresetRemove;
        var removePresetId = presetRemoveButton.dataset.preset;
        if (removePresetFileId && removePresetId) {
          openConfirmDrawer({
            title: '删除预设子项',
            message: '确定删除该预设子项吗？删除后将同步移除关联的复用子项。',
            confirmText: '确认删除',
            cancelText: '取消',
            danger: true,
          }).then(function(result) {
            if (result && result.ok === true) api.removeTempExecPreset(removePresetFileId, removePresetId);
          });
        }
        return;
      }
      var pageButton = closest(event, '[data-temp-page-action]');
      if (pageButton && typeof api.changeTempExecPage === 'function') {
        api.changeTempExecPage(pageButton.dataset.tempPageAction, pageButton.dataset.action);
        return;
      }
      var defectToggleButton = closest(event, '[data-temp-defect-toggle]');
      if (defectToggleButton && typeof api.ensureTempExecSelection === 'function' &&
        typeof api.toggleTempExecDefectPanel === 'function') {
        var defectToggleFileId = defectToggleButton.dataset.tempDefectToggle;
        var defectToggleIndex = Number(defectToggleButton.dataset.index);
        if (!Number.isNaN(defectToggleIndex)) {
          var defectSelection = api.ensureTempExecSelection(defectToggleFileId);
          var defectTargets = defectSelection.size ? Array.from(defectSelection) : [defectToggleIndex];
          api.toggleTempExecDefectPanel(defectToggleFileId, defectTargets);
        }
        return;
      }
      var defectAddButton = closest(event, '[data-temp-defect-add]');
      if (defectAddButton && typeof api.addTempExecDefectLink === 'function') {
        var defectAddIndex = Number(defectAddButton.dataset.index);
        if (!Number.isNaN(defectAddIndex)) {
          api.addTempExecDefectLink(defectAddButton.dataset.tempDefectAdd, defectAddIndex);
        }
        return;
      }
      var removeCaseButton = closest(event, '[data-temp-case-remove]');
      if (removeCaseButton && typeof api.removeTempExecCase === 'function') {
        var removeCaseIndex = Number(removeCaseButton.dataset.index);
        if (!Number.isNaN(removeCaseIndex)) {
          api.removeTempExecCase(
            removeCaseButton.dataset.tempCaseRemove,
            removeCaseIndex,
            getAnchorRect(removeCaseButton)
          );
        }
        return;
      }
      var statusPill = closest(event, '[data-temp-status-filter]');
      if (statusPill) {
        var statusFileId = statusPill.dataset.tempStatusFile;
        var statusValue = statusPill.dataset.tempStatusFilter;
        if (typeof api.setTempExecStatusFilter === 'function') {
          api.setTempExecStatusFilter(statusFileId, statusValue);
        } else {
          var currentFilter = state.tempExecStatusFilter || { fileId: '', status: '' };
          var nextFilter = { fileId: '', status: '' };
          if (statusFileId && statusValue &&
            (currentFilter.fileId !== statusFileId || currentFilter.status !== statusValue)) {
            nextFilter = { fileId: statusFileId, status: statusValue };
          }
          state.tempExecStatusFilter = nextFilter;
          if (typeof api.renderTempExecView === 'function') api.renderTempExecView();
        }
        return;
      }
      var insertCaseButton = closest(event, '[data-temp-case-insert]');
      if (insertCaseButton && typeof api.insertTempExecCase === 'function') {
        var insertCaseIndex = Number(insertCaseButton.dataset.index);
        if (!Number.isNaN(insertCaseIndex)) {
          api.insertTempExecCase(
            insertCaseButton.dataset.tempCaseInsert,
            insertCaseIndex,
            getAnchorRect(insertCaseButton)
          );
        }
        return;
      }
      var defectOpenButton = closest(event, '[data-temp-defect-open]');
      if (defectOpenButton && typeof api.openTempExecDefectLink === 'function') {
        var defectOpenIndex = Number(defectOpenButton.dataset.index);
        if (!Number.isNaN(defectOpenIndex) && defectOpenButton.dataset.link) {
          api.openTempExecDefectLink(
            defectOpenButton.dataset.tempDefectOpen,
            defectOpenIndex,
            defectOpenButton.dataset.link
          );
        }
        return;
      }
      var defectRemoveButton = closest(event, '[data-temp-defect-remove]');
      if (defectRemoveButton && typeof api.removeTempExecDefectLink === 'function') {
        var defectRemoveIndex = Number(defectRemoveButton.dataset.index);
        if (!Number.isNaN(defectRemoveIndex) && defectRemoveButton.dataset.link) {
          api.removeTempExecDefectLink(
            defectRemoveButton.dataset.tempDefectRemove,
            defectRemoveIndex,
            defectRemoveButton.dataset.link
          );
        }
        return;
      }
      var reuseToggleAllButton = closest(event, '[data-temp-reuse-toggle-all]');
      if (reuseToggleAllButton && typeof api.ensureTempExecReuseOpen === 'function' &&
        typeof api.renderTempExecView === 'function') {
        if (typeof reuseLifecycle.markManualToggle === 'function') reuseLifecycle.markManualToggle();
        var toggleAllFileId = reuseToggleAllButton.dataset.tempReuseToggleAll;
        var visibleIndexes = parseIndexList(reuseToggleAllButton.dataset.tempVisible);
        if (visibleIndexes.length) {
          if (!state.tempExecReuseBatchExpanded || typeof state.tempExecReuseBatchExpanded !== 'object') {
            state.tempExecReuseBatchExpanded = {};
          }
          var reuseOpenSet = api.ensureTempExecReuseOpen(toggleAllFileId);
          var allExpanded = reuseToggleAllButton.dataset.tempExpanded === '1';
          state.tempExecPreserveScrollOnce = true;
          if (typeof reuseLifecycle.clearPlaceholders === 'function') {
            reuseLifecycle.clearPlaceholders(toggleAllFileId, visibleIndexes);
          }
          visibleIndexes.forEach(function(index) {
            if (allExpanded) reuseOpenSet.delete(index);
            else reuseOpenSet.add(index);
          });
          state.tempExecReuseBatchExpanded[toggleAllFileId] = !allExpanded;
          api.renderTempExecView();
          if (!allExpanded && typeof reuseLifecycle.schedulePanelHeightRecord === 'function') {
            reuseLifecycle.schedulePanelHeightRecord(toggleAllFileId, visibleIndexes);
          }
        }
        return;
      }
      var reusePanelButton = closest(event, '[data-temp-reuse-panel]');
      if (reusePanelButton && typeof api.ensureTempExecSelection === 'function' &&
        typeof api.toggleTempExecReusePanel === 'function') {
        if (typeof reuseLifecycle.markManualToggle === 'function') reuseLifecycle.markManualToggle();
        var reusePanelFileId = reusePanelButton.dataset.tempReusePanel;
        var reusePanelIndex = Number(reusePanelButton.dataset.index);
        if (!Number.isNaN(reusePanelIndex)) {
          var reuseSelection = api.ensureTempExecSelection(reusePanelFileId);
          var reuseTargets = reuseSelection.size ? Array.from(reuseSelection) : [reusePanelIndex];
          if (typeof reuseLifecycle.clearPlaceholders === 'function') {
            reuseLifecycle.clearPlaceholders(reusePanelFileId, reuseTargets);
          }
          api.toggleTempExecReusePanel(reusePanelFileId, reuseTargets);
          if (typeof reuseLifecycle.schedulePanelHeightRecord === 'function') {
            reuseLifecycle.schedulePanelHeightRecord(reusePanelFileId, reuseTargets);
          }
        }
        return;
      }
      var reuseAddButton = closest(event, '[data-temp-reuse-add]');
      if (reuseAddButton && typeof api.addTempExecReuseEntry === 'function') {
        var reuseAddIndex = Number(reuseAddButton.dataset.index);
        if (!Number.isNaN(reuseAddIndex)) {
          api.addTempExecReuseEntry(reuseAddButton.dataset.tempReuseAdd, reuseAddIndex);
        }
        return;
      }
      var reuseSyncButton = closest(event, '[data-temp-reuse-sync]');
      if (reuseSyncButton && typeof api.syncTempExecReuseStatusFromFirst === 'function') {
        var reuseSyncIndex = Number(reuseSyncButton.dataset.index);
        if (!Number.isNaN(reuseSyncIndex)) {
          api.syncTempExecReuseStatusFromFirst(
            reuseSyncButton.dataset.tempReuseSync,
            reuseSyncIndex,
            reuseSyncButton
          );
        }
        return;
      }
      var reuseRemoveButton = closest(event, '[data-temp-reuse-remove]');
      if (reuseRemoveButton && typeof api.removeTempExecReuseEntry === 'function') {
        var reuseRemoveIndex = Number(reuseRemoveButton.dataset.index);
        if (!Number.isNaN(reuseRemoveIndex) && reuseRemoveButton.dataset.detail) {
          api.removeTempExecReuseEntry(
            reuseRemoveButton.dataset.tempReuseRemove,
            reuseRemoveIndex,
            reuseRemoveButton.dataset.detail
          );
        }
        return;
      }
      var remarkToggleButton = closest(event, '[data-temp-remark-toggle]');
      if (remarkToggleButton && typeof api.ensureTempExecRemarkOpen === 'function' &&
        typeof api.ensureTempExecSelection === 'function') {
        var remarkFileId = remarkToggleButton.dataset.tempRemarkToggle;
        var remarkIndex = Number(remarkToggleButton.dataset.index);
        if (!Number.isNaN(remarkIndex)) {
          var remarkOpenSet = api.ensureTempExecRemarkOpen(remarkFileId);
          var selected = api.ensureTempExecSelection(remarkFileId);
          var remarkTargets = selected.size ? Array.from(selected) : [remarkIndex];
          var shouldOpen = !remarkTargets.every(function(index) { return remarkOpenSet.has(index); });
          remarkTargets.forEach(function(index) {
            if (shouldOpen) remarkOpenSet.add(index);
            else remarkOpenSet.delete(index);
          });
          if (typeof api.renderTempExecView === 'function') api.renderTempExecView();
        }
      }
    }

    function handleChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.dataset) return;
      if (target.dataset.tempSelectAll !== undefined && typeof api.toggleTempExecSelectAll === 'function') {
        api.toggleTempExecSelectAll(
          target.dataset.tempSelectAll,
          target.checked,
          parseIndexList(target.dataset.tempVisible)
        );
        return;
      }
      if (target.dataset.tempPageInput !== undefined && typeof api.getTempExecFile === 'function' &&
        typeof api.getTempExecPageSize === 'function' && typeof api.setTempExecPage === 'function') {
        var fileId = target.dataset.tempPageInput;
        var file = api.getTempExecFile(fileId);
        if (!file) {
          target.value = '1';
          return;
        }
        var pageSize = api.getTempExecPageSize();
        var totalPages = Math.max(1, Math.ceil(file.cases.length / pageSize));
        var requested = Math.round(Number(target.value));
        if (!Number.isFinite(requested)) requested = 1;
        requested = Math.min(Math.max(1, requested), totalPages);
        target.value = requested;
        api.setTempExecPage(fileId, requested - 1);
        if (typeof api.scrollTempExecViewTop === 'function') api.scrollTempExecViewTop();
        return;
      }
      if (target.dataset.tempSelect !== undefined && typeof api.toggleTempExecSelection === 'function') {
        var selectionIndex = Number(target.dataset.index);
        if (!Number.isNaN(selectionIndex)) {
          api.toggleTempExecSelection(target.dataset.tempSelect, selectionIndex, target.checked);
        }
        return;
      }
      if (target.dataset.tempResult !== undefined && typeof api.updateTempExecResult === 'function') {
        var resultIndex = Number(target.dataset.index);
        if (!Number.isNaN(resultIndex)) {
          api.updateTempExecResult(target.dataset.tempResult, resultIndex, target.value);
          target.dataset.status = target.value;
        }
        return;
      }
      if (target.dataset.tempReuseToggle !== undefined && typeof api.handleTempExecReuseToggle === 'function') {
        api.handleTempExecReuseToggle(target.dataset.tempReuseToggle, target.checked, target);
        return;
      }
      if (target.dataset.tempReusePresetApplicability !== undefined &&
        typeof api.updateTempExecPresetApplicability === 'function') {
        api.updateTempExecPresetApplicability(
          target.dataset.tempReusePresetApplicability,
          target.dataset.preset,
          target.value
        );
        return;
      }
      if (target.dataset.tempReuseStatus !== undefined && typeof api.updateTempExecReuseStatus === 'function') {
        var reuseStatusIndex = Number(target.dataset.index);
        if (!Number.isNaN(reuseStatusIndex) && target.dataset.detail) {
          api.updateTempExecReuseStatus(
            target.dataset.tempReuseStatus,
            reuseStatusIndex,
            target.dataset.detail,
            target.value
          );
        }
      }
    }

    function handleFocusIn(event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.dataset) return;
      if (target.dataset.tempEditField !== undefined) {
        target.dataset.tempEditOrigin = normalizeEditableText(target, true);
        return;
      }
      if (target.dataset.tempRemark !== undefined || target.dataset.tempReuseText !== undefined ||
        target.dataset.tempReuseNote !== undefined || target.dataset.tempDefectLink !== undefined) {
        target.dataset.tempInputOrigin = target.value || '';
      }
    }

    function applyInputChange(target, dataKey, apiMethod, idKey) {
      if (target.dataset[dataKey] === undefined || typeof api[apiMethod] !== 'function') return false;
      var index = Number(target.dataset.index);
      var detailId = idKey ? target.dataset[idKey] : null;
      var origin = target.dataset.tempInputOrigin;
      if (origin !== undefined) delete target.dataset.tempInputOrigin;
      if (Number.isNaN(index) || (idKey && !detailId)) return true;
      var value = target.value || '';
      if (origin !== undefined && origin === value) return true;
      var args = [target.dataset[dataKey], index];
      if (idKey) args.push(detailId);
      args.push(value);
      api[apiMethod].apply(api, args);
      return true;
    }

    function handleFocusOut(event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.dataset) return;
      if (target.dataset.tempEditField !== undefined && typeof api.updateTempExecCaseField === 'function') {
        var editIndex = Number(target.dataset.tempEditIndex);
        var editField = target.dataset.tempEditField;
        var normalized = normalizeEditableText(target, false);
        var editOrigin = target.dataset.tempEditOrigin;
        if (editOrigin !== undefined) delete target.dataset.tempEditOrigin;
        if (!Number.isNaN(editIndex) && editField && (editOrigin === undefined || editOrigin !== normalized)) {
          api.updateTempExecCaseField(
            target.dataset.tempEditFile,
            editIndex,
            editField,
            normalized
          );
        }
        return;
      }
      if (applyInputChange(target, 'tempRemark', 'updateTempExecRemark', null)) return;
      if (applyInputChange(target, 'tempReuseText', 'updateTempExecReuseText', 'detail')) return;
      if (applyInputChange(target, 'tempReuseNote', 'updateTempExecReuseNote', 'detail')) return;
      applyInputChange(target, 'tempDefectLink', 'updateTempExecDefectLink', 'link');
    }

    function handleInput(event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.dataset) return;
      if (target.dataset.tempSearchInput !== undefined) return;
      if (target.dataset.tempEditField !== undefined) {
        if (target.dataset.tempEditField !== 'priority') return;
        var selection = browser.getSelection && browser.getSelection();
        var caretPosition = null;
        if (selection && selection.anchorNode && target.contains(selection.anchorNode)) {
          caretPosition = selection.anchorOffset;
        }
        var normalized = normalizeEditableText(target, false);
        target.textContent = normalized;
        if (caretPosition !== null && target.firstChild && document && typeof document.createRange === 'function') {
          var position = Math.min(caretPosition, target.firstChild.textContent.length);
          var range = document.createRange();
          range.setStart(target.firstChild, position);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        return;
      }
      if (target.dataset.tempReusePresetInput !== undefined && typeof api.updateTempExecPresetDraft === 'function') {
        api.updateTempExecPresetDraft(target.value);
      }
    }

    function handleKeyDown(event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.dataset) return;
      if (target.dataset.tempEditField !== undefined) {
        var multiline = String(target.dataset.tempEditMultiline || '').toLowerCase() === 'true';
        if (!multiline && event.key === 'Enter') {
          event.preventDefault();
          if (target.blur) target.blur();
        }
      }
      if (target.dataset.tempSearchInput !== undefined && event.key === 'Enter' &&
        typeof api.applyTempExecSearch === 'function') {
        var value = target.value || '';
        api.applyTempExecSearch(target.dataset.tempSearchInput, value, value);
        event.preventDefault();
      }
    }

    var listeners = {
      click: handleClick,
      change: handleChange,
      focusin: handleFocusIn,
      focusout: handleFocusOut,
      input: handleInput,
      keydown: handleKeyDown,
    };

    function init() {
      if (bound || !view || typeof api.renderTempExecView !== 'function') return false;
      bound = true;
      Object.keys(listeners).forEach(function(name) {
        view.addEventListener(name, listeners[name]);
      });
      return true;
    }

    function destroy() {
      if (!bound || !view) return;
      bound = false;
      Object.keys(listeners).forEach(function(name) {
        view.removeEventListener(name, listeners[name]);
      });
    }

    return {
      init: init,
      destroy: destroy,
      isBound: function() { return bound; },
    };
  }

  return {
    create: create,
    parseIndexList: parseIndexList,
    normalizeEditableText: normalizeEditableText,
    getAnchorRect: getAnchorRect,
  };
});
