(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.casesGenResultOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var runtime = opts.runtime || {};
    var state = opts.state;
    var sanitizeCasesForExport = opts.sanitizeCasesForExport;
    var wrapDataWithRequirement = opts.wrapDataWithRequirement;
    var getSafeRequirementSlug = opts.getSafeRequirementSlug;
    var normalizeRequirementName = opts.normalizeRequirementName;
    var formatCompactTimestamp = opts.formatCompactTimestamp;
    var getSafeFileBaseName = opts.getSafeFileBaseName;
    var casesGenerationContainer = opts.casesGenerationContainer;
    var caseGenStatus = opts.caseGenStatus;
    var tempExecStatus = opts.tempExecStatus;
    var exportCaseGenBtn = opts.exportCaseGenBtn;
    var appendTargetSelect = opts.appendTargetSelect;
    var caseGenStoreNewBtn = opts.caseGenStoreNewBtn;
    var caseGenStoreAppendBtn = opts.caseGenStoreAppendBtn;
    var caseGenXmindModulesContainer = opts.caseGenXmindModulesContainer;
    var caseGenWorkspaceMirrorSection = opts.caseGenWorkspaceMirrorSection;
    var caseGenWorkspaceMirrorList = opts.caseGenWorkspaceMirrorList;
    var caseGenViewDrawerBody = opts.caseGenViewDrawerBody;
    var caseGenViewDrawerTitle = opts.caseGenViewDrawerTitle;
    var caseGenAllSelectBtn = opts.caseGenAllSelectBtn;
    var setStatus = opts.setStatus;
    var downloadText = opts.downloadText;
    var downloadBlob = opts.downloadBlob;
    var stripCodeFence = opts.stripCodeFence;
    var extractRequirementLabelFromText = opts.extractRequirementLabelFromText;
    var setRequirementLabel = opts.setRequirementLabel;
    var ensureRequirementLabel = opts.ensureRequirementLabel;
    var getRequirementLabel = opts.getRequirementLabel;
    var hasImportedCases = opts.hasImportedCases;
    var renderImportedCaseList = opts.renderImportedCaseList;
    var refreshImportedCaseView = opts.refreshImportedCaseView;
    var syncCaseTextWithImports = opts.syncCaseTextWithImports;
    var getTempExecFiles = opts.getTempExecFiles;
    var normalizeTempExecCases = opts.normalizeTempExecCases;
    var deriveCaseListFromText = opts.deriveCaseListFromText;
    var buildXmindPackageFromCases = opts.buildXmindPackageFromCases;
    var createTempExecFile = opts.createTempExecFile;
    var ensureTempExecReplacement = opts.ensureTempExecReplacement;
    var syncTempExecFocus = opts.syncTempExecFocus;
    var persistTempExecState = opts.persistTempExecState;
    var setTempExecActive = opts.setTempExecActive;
    var renderTempExecView = opts.renderTempExecView;
    var switchTab = opts.switchTab;
    var scrollElementIntoView = opts.scrollElementIntoView;
    var renderCaseGenProgressBoard = opts.renderCaseGenProgressBoard;
    var renderCaseModuleProgress = opts.renderCaseModuleProgress;
    var updateCaseProgressView = opts.updateCaseProgressView;
    var clearCaseProgress = opts.clearCaseProgress;
    var persistWorkflowState = opts.persistWorkflowState;
    var isCaseModuleRunning = opts.isCaseModuleRunning;
    var syncCaseModuleStatus = opts.syncCaseModuleStatus;
    var setCaseModuleStatus = opts.setCaseModuleStatus;
    var clearCaseModuleStatus = opts.clearCaseModuleStatus;
    var refreshExportCaseGenButton = opts.refreshExportCaseGenButton;
    var refreshExportCaseGenXmindButton = opts.refreshExportCaseGenXmindButton;
    var parseCaseList = opts.parseCaseList;
    var escapeHtml = opts.escapeHtml;
    var escapeHtmlPreserve = opts.escapeHtmlPreserve;
    var stringifyCaseField = opts.stringifyCaseField;
    var hasPendingXmindDrawerRestoreIntent = typeof opts.hasPendingXmindDrawerRestoreIntent === 'function' ? opts.hasPendingXmindDrawerRestoreIntent : noop;
    var shouldDeferXmindCasegenMirrorRender = typeof opts.shouldDeferXmindCasegenMirrorRender === 'function' ? opts.shouldDeferXmindCasegenMirrorRender : noop;
    var queueDeferredXmindCasegenMirrorRender = typeof opts.queueDeferredXmindCasegenMirrorRender === 'function' ? opts.queueDeferredXmindCasegenMirrorRender : noop;
    var isDbStoreReady = typeof opts.isDbStoreReady === 'function' ? opts.isDbStoreReady : noop;
    var promptRequirementLabelByDrawer = typeof opts.promptRequirementLabelByDrawer === 'function' ? opts.promptRequirementLabelByDrawer : noop;
    var ensureCaseModuleTimingState = typeof opts.ensureCaseModuleTimingState === 'function' ? opts.ensureCaseModuleTimingState : noop;
    var syncCaseModuleTiming = typeof opts.syncCaseModuleTiming === 'function' ? opts.syncCaseModuleTiming : noop;
    var setPendingCaseGenDbStoreAction = typeof opts.setPendingCaseGenDbStoreAction === 'function' ? opts.setPendingCaseGenDbStoreAction : noop;
    var consumePendingCaseGenDbStoreAction = typeof opts.consumePendingCaseGenDbStoreAction === 'function' ? opts.consumePendingCaseGenDbStoreAction : noop;
    var ensureCaseGenSettings = typeof opts.ensureCaseGenSettings === 'function' ? opts.ensureCaseGenSettings : noop;
    var setCaseGenStoreMode = typeof opts.setCaseGenStoreMode === 'function' ? opts.setCaseGenStoreMode : noop;
    var resolveModuleTitle = typeof opts.resolveModuleTitle === 'function' ? opts.resolveModuleTitle : noop;
    var normalizeModuleKey = typeof opts.normalizeModuleKey === 'function' ? opts.normalizeModuleKey : noop;
    var normalizeCaseTitle = typeof opts.normalizeCaseTitle === 'function' ? opts.normalizeCaseTitle : noop;
    var normalizeCaseListWithModules = typeof opts.normalizeCaseListWithModules === 'function' ? opts.normalizeCaseListWithModules : noop;
    var parseGeneratedCases = typeof opts.parseGeneratedCases === 'function' ? opts.parseGeneratedCases : noop;
    var hasGeneratedCases = typeof opts.hasGeneratedCases === 'function' ? opts.hasGeneratedCases : noop;
    var hasRunningCaseModules = typeof opts.hasRunningCaseModules === 'function' ? opts.hasRunningCaseModules : noop;
    var refreshCaseGenBatchButtons = typeof opts.refreshCaseGenBatchButtons === 'function' ? opts.refreshCaseGenBatchButtons : noop;
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function' ? opts.openConfirmDrawer : noop;
    var openCaseGenDbStoreNewDrawer = typeof opts.openCaseGenDbStoreNewDrawer === 'function' ? opts.openCaseGenDbStoreNewDrawer : noop;
    var openCaseGenDbStoreAppendDrawer = typeof opts.openCaseGenDbStoreAppendDrawer === 'function' ? opts.openCaseGenDbStoreAppendDrawer : noop;
    var shouldRestoreLegacyCaseGenForRender = typeof opts.shouldRestoreLegacyCaseGenForRender === 'function' ? opts.shouldRestoreLegacyCaseGenForRender : noop;
    var syncLegacyCaseGenState = typeof opts.syncLegacyCaseGenState === 'function' ? opts.syncLegacyCaseGenState : noop;
    var restoreLegacyCaseGenState = typeof opts.restoreLegacyCaseGenState === 'function' ? opts.restoreLegacyCaseGenState : noop;
    var normalizeStaleCaseProgress = typeof opts.normalizeStaleCaseProgress === 'function' ? opts.normalizeStaleCaseProgress : noop;

    function ensureCaseGenDrawer() {
      if (runtime.caseGenViewDrawer) return runtime.caseGenViewDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      runtime.caseGenViewDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenViewDrawer',
        closeButtons: ['closeCaseGenViewDrawerBtn'],
        onClose: function() {
          if (runtime.activeCaseViewModuleId) resetCaseViewButton(runtime.activeCaseViewModuleId);
          runtime.activeCaseViewModuleId = '';
          if (caseGenViewDrawerBody) caseGenViewDrawerBody.innerHTML = '';
          if (caseGenViewDrawerTitle) caseGenViewDrawerTitle.textContent = '用例视图';
          toggleCaseGenAllSelectButton(false);
          var pending = consumePendingCaseGenDbStoreAction();
          if (!pending) return;
          if (!hasSelectedGeneratedCases()) return;
          setTimeout(function() {
            if (pending === 'append') {
              openCaseGenDbStoreAppendDrawer();
            } else if (pending === 'new') {
              openCaseGenDbStoreNewDrawer();
            }
          }, 0);
        },
      });
      return runtime.caseGenViewDrawer;
    }

    function resetCaseViewButton(moduleId) {
      if (!moduleId) return;
      var selector = '[data-view="' + moduleId + '"], [data-xmind-mirror-view="' + moduleId + '"]';
      var buttons = [];
      if (casesGenerationContainer && casesGenerationContainer.querySelectorAll) {
        buttons = buttons.concat(Array.prototype.slice.call(casesGenerationContainer.querySelectorAll(selector)));
      }
      if (caseGenXmindModulesContainer && caseGenXmindModulesContainer.querySelectorAll) {
        buttons = buttons.concat(Array.prototype.slice.call(caseGenXmindModulesContainer.querySelectorAll(selector)));
      }
      buttons.forEach(function(btn) {
        if (!btn) return;
        btn.textContent = '用例视图';
      });
    }

    function closeCaseViewIfActive(moduleId) {
      if (!runtime.activeCaseViewModuleId) return;
      if (moduleId && runtime.activeCaseViewModuleId !== moduleId) return;
      var drawer = ensureCaseGenDrawer();
      if (drawer) drawer.close();
    }

    function getCaseViewContainer(moduleId) {
      var selector = '[data-view-container="' + moduleId + '"]';
      var container = caseGenViewDrawerBody && caseGenViewDrawerBody.querySelector(selector);
      if (!container && casesGenerationContainer) container = casesGenerationContainer.querySelector(selector);
      if (!container && typeof document !== 'undefined') container = document.querySelector(selector);
      return container;
    }

    function renderCaseGenWorkspaceMirrorTabs(itemsOverride) {
      if (!caseGenWorkspaceMirrorSection || !caseGenWorkspaceMirrorList) return false;
      var xmindCasegenApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var items = Array.isArray(itemsOverride)
        ? itemsOverride
        : (xmindCasegenApi && typeof xmindCasegenApi.getWorkspaceProgressItems === 'function'
          ? xmindCasegenApi.getWorkspaceProgressItems()
          : []);
      if (!Array.isArray(items) || !items.length) {
        caseGenWorkspaceMirrorSection.classList.add('hidden');
        caseGenWorkspaceMirrorSection.setAttribute('aria-hidden', 'true');
        caseGenWorkspaceMirrorList.innerHTML = '';
        return false;
      }
      caseGenWorkspaceMirrorSection.classList.remove('hidden');
      caseGenWorkspaceMirrorSection.setAttribute('aria-hidden', 'false');
      caseGenWorkspaceMirrorList.innerHTML = items.map(function(item) {
        var tabCls = 'xmind-casegen-tab casegen-xmind-workspace-tab' + (item && item.active ? ' active' : '');
        return ''
          + '<button type="button" class="' + tabCls + '"'
          +   ' data-casegen-module-workspace="' + escapeHtml(item && item.id ? item.id : '') + '"'
          +   ' aria-selected="' + (item && item.active ? 'true' : 'false') + '"'
          +   ' aria-current="' + (item && item.active ? 'page' : 'false') + '"'
          +   ' title="' + escapeHtml(item && item.title ? item.title : '') + '">'
          +   '<span class="memo-tab-label xmind-casegen-tab-label">'
          +     '<span class="xmind-casegen-tab-title-row">'
          +       '<span class="xmind-casegen-tab-title">' + escapeHtml(item && item.title ? item.title : '未命名页签') + '</span>'
          +     '</span>'
          +     '<span class="xmind-casegen-tab-meta">'
          +       '<span class="xmind-casegen-tab-state-pill ' + escapeHtml(item && item.statusCls ? item.statusCls : 'is-idle') + '">' + escapeHtml(item && item.statusText ? item.statusText : '待准备') + '</span>'
          +       '<span class="xmind-casegen-tab-dot" aria-hidden="true"></span>'
          +       '<span class="xmind-casegen-tab-metric">' + String(item && Number.isFinite(Number(item.moduleCount)) ? Number(item.moduleCount) : 0) + ' 模块</span>'
          +       '<span class="xmind-casegen-tab-dot" aria-hidden="true"></span>'
          +       '<span class="xmind-casegen-tab-metric">' + String(item && Number.isFinite(Number(item.caseCount)) ? Number(item.caseCount) : 0) + ' 用例</span>'
          +     '</span>'
          +   '</span>'
          + '</button>';
      }).join('');
      return true;
    }

    function computeAppendTargetOptions() {
      var options = [{ value: '', label: '未选择' }];
      var requirementLabel = getRequirementLabel(true) || '';
      var targetName = stringifyCaseField(requirementLabel).toLowerCase();
      var workflowEntries = Array.isArray(state.importedCases) ? state.importedCases : [];
      var workflowOptions = [];
      workflowEntries.forEach(function(entry, idx) {
        var list = Array.isArray(entry && entry.list) ? entry.list : [];
        if (!list.length && deriveCaseListFromText && entry && entry.text) {
          list = deriveCaseListFromText(entry.text);
        }
        if (!list || !list.length) return;
        workflowOptions.push({
          value: 'workflow:' + (entry.id || entry.name || ('wf-' + idx)),
          label: stringifyCaseField(entry.name) || '功能流程导入用例',
        });
      });
      var hasWorkflowCases = workflowOptions.length > 0;
      var execCandidates = (getTempExecFiles() || []).filter(function(file) {
        return file && Array.isArray(file.cases) && file.cases.length;
      });
      if (!hasWorkflowCases) {
        var importedExec = execCandidates.filter(function(file) { return file && file.fromImport === true; });
        execCandidates = importedExec.length ? importedExec : execCandidates;
        if (!execCandidates.length) return options;
      }
      if (hasWorkflowCases) {
        workflowOptions.forEach(function(opt) { options.push(opt); });
        if (options.length > 1) return options;
      }
      if (!execCandidates.length) return options;
      var exact = [];
      var similar = [];
      execCandidates.forEach(function(file) {
        var name = stringifyCaseField(file && file.name);
        var normName = name.toLowerCase();
        if (targetName && normName === targetName) {
          exact.push(file);
        } else if (targetName && (normName.indexOf(targetName) !== -1 || targetName.indexOf(normName) !== -1)) {
          similar.push(file);
        }
      });
      var chosen = exact.length ? exact : (similar.length ? similar : execCandidates);
      chosen.forEach(function(file) {
        options.push({
          value: 'exec:' + file.id,
          label: stringifyCaseField(file.name) || '执行用例',
        });
      });
      return options;
    }

    function hasValidAppendTargetSelection() {
      if (!appendTargetSelect) return false;
      var val = appendTargetSelect.value || '';
      var opts = appendTargetSelect.options || [];
      if (!opts.length) return false;
      if (!val) return false;
      return true;
    }

    function renderAppendTargetOptions() {
      if (!appendTargetSelect) return;
      var opts = computeAppendTargetOptions();
      appendTargetSelect.innerHTML = opts.map(function(opt) {
        return '<option value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + '</option>';
      }).join('');
      var desired = state.caseGenAppendTarget || '';
      var hasDesired = opts.some(function(opt) { return opt.value === desired; });
      appendTargetSelect.value = hasDesired ? desired : '';
      state.caseGenAppendTarget = appendTargetSelect.value || '';
      refreshAppendExistingButton();
    }

    function collectAdditionsForBuckets(buckets, selectedEntries) {
      var additions = [];
      var duplicateCount = 0;
      var moduleCount = 0;
      selectedEntries.forEach(function(entry) {
        var bucketKey = entry.moduleKey;
        var bucket = buckets[bucketKey];
        if (!bucket) {
          bucket = { title: entry.moduleTitle, list: [] };
          buckets[bucketKey] = bucket;
        }
        moduleCount += 1;
        var existingTitleSet = new Set();
        bucket.list.forEach(function(item) {
          var key = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
          if (key) existingTitleSet.add(key);
        });
        entry.cases.forEach(function(item) {
          var titleKey = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
          if (titleKey && existingTitleSet.has(titleKey)) {
            duplicateCount += 1;
            return;
          }
          var mergedItem = Object.assign({}, item);
          mergedItem.module = resolveModuleTitle(bucket.title || entry.moduleTitle);
          additions.push(mergedItem);
          bucket.list.push(mergedItem);
          if (titleKey) existingTitleSet.add(titleKey);
        });
      });
      return { additions: additions, duplicateCount: duplicateCount, moduleCount: moduleCount };
    }

    function promptTempExecTarget(candidates) {
      if (!candidates || !candidates.length) return null;
      var lines = candidates.map(function(file, idx) {
        var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
        var count = file && file.cases && file.cases.length ? file.cases.length : 0;
        return (idx + 1) + '：' + (file && file.name ? file.name : '用例') + '（需求：' + req + '，' + count + ' 条）';
      });
      var input = window.prompt('请选择要追加的用例执行文件编号：\n' + lines.join('\n'), '1');
      if (input === null) return null;
      var index = Number(input);
      if (!Number.isFinite(index) || index < 1 || index > candidates.length) return null;
      return candidates[index - 1];
    }

    function normalizeExecCaseList(list, fileId) {
      if (typeof normalizeTempExecCases === 'function') {
        return normalizeTempExecCases(list, fileId);
      }
      return list;
    }

    function hasExecutionData(file) {
      if (!file || !Array.isArray(file.cases)) return false;
      return file.cases.some(function(item) {
        if (!item) return false;
        var actual = item.actual || '';
        var remark = item.remark || '';
        var hasDefect = item.defectLinks && item.defectLinks.length;
        var hasReuse = item.reuseDetails && item.reuseDetails.length;
        return (actual && actual !== '未执行') || remark || hasDefect || hasReuse;
      });
    }

    function convertCaseForExec(item, fileId, idx, existing) {
      var merged = Object.assign({}, item || {});
      merged.module = resolveModuleTitle(merged.module || (existing && existing.module));
      if (existing && existing.id) {
        merged.id = existing.id;
      } else {
        merged.id = merged.id || (fileId ? (fileId + '-' + idx) : ('case-' + idx));
      }
      if (existing) {
        merged.actual = existing.actual || '未执行';
        merged.remark = existing.remark || '';
        merged.reuseDetails = Array.isArray(existing.reuseDetails) ? existing.reuseDetails.slice() : [];
        merged.defectLinks = Array.isArray(existing.defectLinks) ? existing.defectLinks.slice() : [];
      } else {
        merged.actual = merged.actual || '未执行';
        merged.remark = merged.remark || '';
        merged.reuseDetails = Array.isArray(merged.reuseDetails) ? merged.reuseDetails : [];
        merged.defectLinks = Array.isArray(merged.defectLinks) ? merged.defectLinks : [];
      }
      return merged;
    }

    function renderCaseTable(mod, list, options) {
      options = options || {};
      var selectable = Boolean(options.selectable);
      var moduleId = options.moduleId || '';
      var includeRemark = Boolean(options.showRemark);
      var selection = moduleId ? ensureCaseSelectionSet(moduleId) : new Set();
      var safeList = Array.isArray(list) ? list : [];
      var toolbar = selectable
        ? '<div class="caseview-toolbar">' +
            '<button class="secondary" data-export-selected="' + moduleId + '" ' + (selection.size ? '' : 'disabled') + '>导出所选用例</button>' +
            '<button class="secondary" data-xmind-selected="' + moduleId + '" ' + (selection.size ? '' : 'disabled') + '>转 XMind</button>' +
          '</div>'
        : '';
      var headerCheckbox = selectable ? '<th class="check"><input type="checkbox" data-case-select-all="' + moduleId + '"></th>' : '';
      var indexHeader = '<th class="index">编号</th>';
      var remarkHeader = includeRemark ? '<th class="remark">备注</th>' : '';
      var rows = safeList.map(function(item, idx) {
        var moduleTitle = mod && mod.title ? mod.title : '';
        var moduleName = item.module || moduleTitle || item.module_name || item['模块'] || '模块' + (idx + 1);
        var title = stringifyCaseField(item.title || item.case_title || moduleName);
        var priority = stringifyCaseField(item.priority || item.level);
        var preconditions = stringifyCaseField(item.preconditions || item.precondition);
        var steps = '';
        if (Array.isArray(item.steps)) {
          steps = item.steps.map(function(step) {
            return stringifyCaseField(step);
          }).filter(Boolean).join('\n');
        } else if (Array.isArray(item.actions)) {
          steps = item.actions.map(function(step) {
            return stringifyCaseField(step);
          }).filter(Boolean).join('\n');
        } else {
          steps = stringifyCaseField(item.steps || item.actions);
        }
        var expected = stringifyCaseField(item.expected || item.result);
        var checkboxCell = selectable
          ? '<td class="check"><input type="checkbox" data-case-select="' + moduleId + '" data-index="' + idx + '" ' + (selection.has(idx) ? 'checked' : '') + '></td>'
          : '';
        var indexCell = '<td class="index">' + (idx + 1) + '</td>';
        var remarkCell = includeRemark ? '<td class="remark">' + escapeHtml(item.remark || '') + '</td>' : '';
        return '' +
          '<tr>' +
            checkboxCell +
            indexCell +
            '<td class="module">' + escapeHtml(moduleName || '-') + '</td>' +
            '<td class="title">' + escapeHtml(title || '-') + '</td>' +
            '<td>' + escapeHtml(priority || '-') + '</td>' +
            '<td>' + escapeHtmlPreserve(preconditions || '-') + '</td>' +
            '<td>' + escapeHtmlPreserve(steps || '-') + '</td>' +
            '<td>' + escapeHtmlPreserve(expected || '-') + '</td>' +
            remarkCell +
          '</tr>';
      }).join('');
      var baseCols = 7 + (selectable ? 1 : 0) + (includeRemark ? 1 : 0);
      var emptyRow = '<tr><td colspan="' + baseCols + '">未解析到有效用例</td></tr>';
      return '' +
        '<table class="table-view">' +
          '<thead>' +
            '<tr>' +
              headerCheckbox +
              indexHeader +
              '<th class="module">模块</th>' +
              '<th class="title">用例标题</th>' +
              '<th>优先级</th>' +
              '<th>前提条件</th>' +
              '<th>操作步骤</th>' +
              '<th>预期结果</th>' +
              remarkHeader +
            '</tr>' +
          '</thead>' +
          '<tbody>' + (rows || emptyRow) + '</tbody>' +
        '</table>' +
        toolbar;
    }

    function updateSupplementButtons(moduleId, hasResult) {
      if (!casesGenerationContainer) return;
      var transferBtn = casesGenerationContainer.querySelector('[data-tempexec="' + moduleId + '"]');
      var busy = isCaseModuleRunning(moduleId);
      var selection = state.caseSelections[moduleId];
      var hasSelection = selection && selection.size > 0;
      var transferDisabled = !hasResult || busy || !hasSelection;
      if (transferBtn) transferBtn.disabled = transferDisabled;
    }

    function ensureCaseSelectionSet(moduleId) {
      if (!state.caseSelections[moduleId]) {
        state.caseSelections[moduleId] = new Set();
      }
      return state.caseSelections[moduleId];
    }

    function refreshCaseSelectionUI(moduleId) {
      var container = getCaseViewContainer(moduleId);
      if (!container) return;
      var selection = ensureCaseSelectionSet(moduleId);
      var rowCheckboxes = container.querySelectorAll('input[data-case-select="' + moduleId + '"]');
      rowCheckboxes.forEach(function(cb) {
        cb.checked = selection.has(Number(cb.dataset.index));
      });
      var master = container.querySelector('input[data-case-select-all="' + moduleId + '"]');
      if (master) {
        var total = rowCheckboxes.length;
        master.checked = total > 0 && selection.size === total;
        master.indeterminate = selection.size > 0 && selection.size < total;
      }
      var exportBtn = container.querySelector('button[data-export-selected="' + moduleId + '"]');
      if (exportBtn) exportBtn.disabled = selection.size === 0;
      var xmindBtn = container.querySelector('button[data-xmind-selected="' + moduleId + '"]');
      if (xmindBtn) xmindBtn.disabled = selection.size === 0;
      applyCaseGenSelectionHint(moduleId);
      refreshAppendExistingButton();
      refreshExportCaseGenXmindButton();
    }

    function hasSelectedGeneratedCases() {
      if (!state.caseGenModules || !state.caseGenModules.length) return false;
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        var selection = state.caseSelections[mod.id];
        if (!selection || !selection.size) continue;
        var list = getCaseListForModule(mod.id);
        var raw = state.caseGenResults && state.caseGenResults[mod.id];
        var trimmed = raw && raw.trim ? raw.trim() : '';
        if (list.length) {
          var matched = false;
          selection.forEach(function(idx) {
            if (!matched && list[idx]) matched = true;
          });
          if (matched) return true;
        } else if (trimmed) {
          return true;
        }
      }
      return false;
    }

    function refreshAppendExistingButton() {
      var hasGenerated = hasGeneratedCases();
      if (caseGenStoreNewBtn) caseGenStoreNewBtn.disabled = !hasGenerated || !isDbStoreReady();
      if (caseGenStoreAppendBtn) caseGenStoreAppendBtn.disabled = !hasGenerated || !isDbStoreReady();
      refreshExportCaseGenXmindButton();
    }

    function ensureCaseGenSelectionHintState() {
      if (!state.caseGenSelectionHints || typeof state.caseGenSelectionHints !== 'object') {
        state.caseGenSelectionHints = {};
      }
      return state.caseGenSelectionHints;
    }

    function setCaseGenSelectionHint(moduleId, enabled) {
      if (!moduleId) return;
      var map = ensureCaseGenSelectionHintState();
      if (enabled) map[moduleId] = true;
      else delete map[moduleId];
      applyCaseGenSelectionHint(moduleId);
    }

    function applyCaseGenSelectionHint(moduleId) {
      var container = getCaseViewContainer(moduleId);
      if (!container || !container.classList) return;
      var map = ensureCaseGenSelectionHintState();
      var selection = state.caseSelections[moduleId];
      var hasSelection = selection && selection.size > 0;
      var shouldShow = Boolean(map[moduleId] && !hasSelection);
      container.classList.toggle('caseview-selection-hint', shouldShow);
    }

    function clearAllCaseGenSelectionHints() {
      var map = ensureCaseGenSelectionHintState();
      var cleared = false;
      for (var key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
        delete map[key];
        cleared = true;
      }
      if (cleared && Array.isArray(state.caseGenModules)) {
        state.caseGenModules.forEach(function(mod) {
          if (mod && mod.id) applyCaseGenSelectionHint(mod.id);
        });
      }
    }

    function setCaseGenSelectionHintsForAllModules() {
      var map = ensureCaseGenSelectionHintState();
      for (var key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
        delete map[key];
      }
      if (!Array.isArray(state.caseGenModules)) return;
      state.caseGenModules.forEach(function(mod) {
        if (!mod || !mod.id) return;
        var list = getCaseListForModule(mod.id);
        if (list && list.length) map[mod.id] = true;
      });
      state.caseGenModules.forEach(function(mod) {
        if (mod && mod.id) applyCaseGenSelectionHint(mod.id);
      });
    }

    function getCaseGenAllSelectionStats() {
      var items = collectGeneratedModules();
      var total = 0;
      var selected = 0;
      items.forEach(function(entry) {
        var list = entry.list || [];
        var selection = state.caseSelections[entry.mod.id];
        total += list.length;
        if (selection && selection.size) {
          selection.forEach(function(idx) {
            if (list[idx]) selected += 1;
          });
        }
      });
      return { total: total, selected: selected, moduleCount: items.length };
    }

    function toggleCaseGenAllSelectButton(show) {
      if (!caseGenAllSelectBtn || !caseGenAllSelectBtn.classList) return;
      caseGenAllSelectBtn.classList.toggle('hidden', !show);
    }

    function updateCaseGenAllSelectionButton() {
      var buttons = [];
      if (caseGenAllSelectBtn) buttons.push(caseGenAllSelectBtn);
      if (caseGenViewDrawerBody) {
        var innerBtn = caseGenViewDrawerBody.querySelector('[data-case-select-all-modules]');
        if (innerBtn) buttons.push(innerBtn);
      }
      if (!buttons.length) return;
      var stats = getCaseGenAllSelectionStats();
      var hintMap = ensureCaseGenSelectionHintState();
      var hasHint = false;
      for (var key in hintMap) {
        if (Object.prototype.hasOwnProperty.call(hintMap, key)) {
          hasHint = true;
          break;
        }
      }
      var disabled = stats.total === 0;
      var text = stats.total > 0 && stats.selected >= stats.total
        ? '取消全选所有模块用例'
        : '全选所有模块用例';
      buttons.forEach(function(btn) {
        btn.disabled = disabled;
        btn.textContent = text;
        if (btn.classList) btn.classList.toggle('casegen-select-all-hint', hasHint);
      });
    }

    function findFirstGeneratedModuleId() {
      if (!state.caseGenModules || !state.caseGenModules.length) return '';
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        var list = getCaseListForModule(mod.id);
        if (list && list.length) return mod.id;
      }
      return '';
    }

    function collectGeneratedModules() {
      var modules = [];
      if (!Array.isArray(state.caseGenModules)) return modules;
      state.caseGenModules.forEach(function(mod) {
        if (!mod || !mod.id) return;
        var list = getCaseListForModule(mod.id);
        if (list && list.length) modules.push({ mod: mod, list: list });
      });
      return modules;
    }

    function openCaseViewForModule(moduleId) {
      if (!moduleId) return false;
      var drawer = ensureCaseGenDrawer();
      if (!drawer || !drawer.element) return false;
      var drawerEl = drawer.element;
      var isOpenCurrent = drawerEl.classList.contains('open') && runtime.activeCaseViewModuleId === moduleId;
      if (isOpenCurrent) return true;
      toggleCaseView(moduleId);
      return true;
    }

    function openCaseGenAllView(options) {
      options = options || {};
      var withHint = Boolean(options.selectionHint);
      var forceOpen = Boolean(options.force);
      if (hasRunningCaseModules() && hasGeneratedCases()) {
        setStatus(caseGenStatus, '当前仍有用例生成中，请等待生成完毕后再查看全模块用例视图', 'warn');
        return { opened: false, blocked: true };
      }
      var drawer = ensureCaseGenDrawer();
      if (!drawer || !drawer.element || !caseGenViewDrawerBody) return { opened: false, blocked: false };
      var drawerEl = drawer.element;
      var isOpenAll = drawerEl.classList.contains('open') && runtime.activeCaseViewModuleId === runtime.ALL_CASE_VIEW_ID;
      if (isOpenAll && !forceOpen) {
        drawer.close();
        return { opened: false, blocked: false };
      }
      if (runtime.activeCaseViewModuleId && runtime.activeCaseViewModuleId !== runtime.ALL_CASE_VIEW_ID) {
        resetCaseViewButton(runtime.activeCaseViewModuleId);
      }
      runtime.activeCaseViewModuleId = runtime.ALL_CASE_VIEW_ID;
      var items = collectGeneratedModules();
      if (!items.length) {
        caseGenViewDrawerBody.innerHTML = '' +
          '<div class="caseview drawer-view visible caseview-all-section">' +
            '<p class="hint" style="margin:0;">当前没有生成用例，请先进行用例生成</p>' +
          '</div>';
        toggleCaseGenAllSelectButton(false);
      } else {
        caseGenViewDrawerBody.innerHTML = items.map(function(entry, idx) {
          var mod = entry.mod;
          var list = entry.list;
          var moduleTitle = resolveModuleTitle(mod && (mod.title || mod.module)) || ('模块' + (idx + 1));
          return '' +
            '<div class="caseview drawer-view visible caseview-all-section" data-view-container="' + mod.id + '">' +
              '<div class="caseview-module-title">' + escapeHtml(moduleTitle) + '</div>' +
              renderCaseTable(mod, list, { selectable: true, moduleId: mod.id, showRemark: true }) +
            '</div>';
        }).join('');
        items.forEach(function(entry) {
          refreshCaseSelectionUI(entry.mod.id);
        });
        if (withHint) {
          setCaseGenSelectionHintsForAllModules();
        } else {
          items.forEach(function(entry) { applyCaseGenSelectionHint(entry.mod.id); });
        }
        toggleCaseGenAllSelectButton(true);
        updateCaseGenAllSelectionButton();
      }
      if (caseGenViewDrawerTitle) {
        caseGenViewDrawerTitle.textContent = '全模块用例视图';
      }
      drawer.open();
      return { opened: true, blocked: false };
    }

    function openCaseViewForSelectionHint(action) {
      if (action === 'new' || action === 'append') {
        setCaseGenStoreMode(action, { persist: false });
      }
      if (runtime.caseGenDbStoreDrawer && runtime.caseGenDbStoreDrawer.element && runtime.caseGenDbStoreDrawer.element.classList.contains('open')) {
        runtime.caseGenDbStoreDrawer.close();
      }
      var result = openCaseGenAllView({ selectionHint: true, force: true });
      if (action && result && result.opened) {
        setPendingCaseGenDbStoreAction(action);
      }
      return result;
    }

    function listCaseGenModulesMissingSelectionOrGeneration() {
      var out = [];
      if (!Array.isArray(state.caseGenModules)) return out;
      state.caseGenModules.forEach(function(mod) {
        if (!mod || !mod.id) return;
        var title = resolveModuleTitle(mod.title || mod.module || '');
        var list = getCaseListForModule(mod.id);
        var hasGenerated = Boolean(list && list.length);
        var selection = state.caseSelections[mod.id];
        var hasSelected = false;
        if (hasGenerated && selection && selection.size) {
          selection.forEach(function(idx) {
            if (!hasSelected && list && list[idx]) hasSelected = true;
          });
        }
        if (!hasGenerated || !hasSelected) out.push(title);
      });
      return out;
    }

    function resolveCaseGenActiveDrawer() {
      var candidates = [runtime.caseGenActionDrawer, runtime.caseGenModuleGenerateDrawer, runtime.caseGenDbStoreDrawer, runtime.caseGenViewDrawer];
      for (var i = 0; i < candidates.length; i += 1) {
        var drawer = candidates[i];
        var el = drawer && drawer.element ? drawer.element : null;
        if (el && el.classList && el.classList.contains('open')) return drawer;
      }
      return null;
    }

    function collectSelectedCaseEntries() {
      var results = [];
      if (!state.caseGenModules || !state.caseGenModules.length) return results;
      state.caseGenModules.forEach(function(mod) {
        var selection = state.caseSelections[mod.id];
        if (!selection || !selection.size) return;
        var list = getCaseListForModule(mod.id);
        if (!list.length) return;
        var moduleTitle = resolveModuleTitle(mod && (mod.title || mod.module));
        var selectedList = [];
        selection.forEach(function(idx) {
          if (list[idx]) {
            var cloned = Object.assign({}, list[idx]);
            if (!cloned.module) cloned.module = moduleTitle;
            selectedList.push(cloned);
          }
        });
        if (selectedList.length) {
          results.push({
            moduleId: mod.id,
            moduleKey: normalizeModuleKey(moduleTitle),
            moduleTitle: moduleTitle,
            cases: sanitizeCasesForExport(selectedList),
          });
        }
      });
      return results;
    }

    function getCaseListForModule(moduleId) {
      var raw = state.caseGenResults[moduleId] || '';
      if (!raw.trim()) return [];
      var list = parseCaseList(raw);
      if (list.length) return list;
      try {
        var parsed = JSON.parse(stripCodeFence(raw) || '[]');
        var parsedCasesField = parsed && parsed.cases;
        var parsedDataField = parsed && parsed.data;
        list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsedCasesField)
          ? parsedCasesField
          : Array.isArray(parsedDataField)
          ? parsedDataField
          : [];
      } catch (err) {
        list = [];
      }
      return list.filter(function(item) { return item && typeof item === 'object'; });
    }

    function renderLegacyCaseGeneration() {
      if (!casesGenerationContainer) return;
      var moduleList = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      var resultMap = state.caseGenResults && typeof state.caseGenResults === 'object'
        ? state.caseGenResults
        : {};
      var suggestionMap = state.caseGenSuggestions && typeof state.caseGenSuggestions === 'object'
        ? state.caseGenSuggestions
        : {};
      if (!moduleList.length) {
        casesGenerationContainer.innerHTML = '<p class="hint">请先在“测试模块拆分”中生成模块（JSON），然后点击“生成用例”进入本页。</p>';
        return;
      }
      casesGenerationContainer.innerHTML = moduleList.map(function(mod, idx) {
        normalizeStaleCaseProgress(mod.id, mod.title || mod.module || '');
        var rawResult = String(resultMap[mod.id] || '').trim();
        var hasResult = Boolean(rawResult && !/^\[\s*\]$/.test(rawResult));
        var moduleBusy = isCaseModuleRunning(mod.id);
        var generateLabel = moduleBusy ? '生成中...' : '生成用例';
        var resultInfo = parseGeneratedCases(resultMap[mod.id] || '');
        var resultText = resultInfo.normalized || '';
        var timing = ensureCaseModuleTimingState()[mod.id];
        var timingText = Number.isFinite(timing) ? (timing / 1000).toFixed(2) : '--';
        return '' +
        '<div class="usecase-card" data-module-id="' + mod.id + '">' +
          '<h3>' + (idx + 1) + '. ' + mod.title + '</h3>' +
          '<div class="actions module-actions">' +
            '<button class="secondary" data-generate="' + mod.id + '" ' + (moduleBusy ? 'disabled' : '') + '>' + generateLabel + '</button>' +
            '<button class="secondary" data-export="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + '>导出json</button>' +
            '<button class="secondary" data-import="' + mod.id + '">导入json</button>' +
            '<button class="secondary" data-clear="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + '>清除用例</button>' +
            '<button class="pill primary case-view-btn" data-view="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + ' style="margin-left:auto;">用例视图</button>' +
          '</div>' +
          '<p class="hint timing" data-case-timing="' + mod.id + '">模型用时：<strong data-case-timing-value="' + mod.id + '">' + timingText + '</strong> 秒</p>' +
          '<p class="status" data-case-status="' + mod.id + '"></p>' +
          '<div class="case-progress" data-progress="' + mod.id + '">' + renderCaseModuleProgress(mod.id) + '</div>' +
          '<textarea data-result="' + mod.id + '" placeholder="JSON 测试用例输出..." readonly>' + resultText + '</textarea>' +
          '<input type="file" data-import-input="' + mod.id + '" accept=".txt,.json" hidden>' +
          '<div class="suggestion-panel">' +
            '<label>生成建议</label>' +
            '<textarea data-suggestion="' + mod.id + '" placeholder="可输入补充说明/限制条件...">' + escapeHtml(suggestionMap[mod.id] || '') + '</textarea>' +
            '<p class="hint suggestion-panel-hint">如需补全生成，请点击上方【生成用例】后，在抽屉的【补全生成】页签中执行。</p>' +
          '</div>' +
        '</div>';
      }).join('');
      moduleList.forEach(function(mod) {
        syncCaseModuleStatus(mod.id);
        syncCaseModuleTiming(mod.id);
        updateCaseProgressView(mod.id);
        var rawResult = String(resultMap[mod.id] || '').trim();
        var hasResult = Boolean(rawResult && !/^\[\s*\]$/.test(rawResult));
        updateSupplementButtons(mod.id, hasResult);
        var viewBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view="' + mod.id + '"]');
        if (viewBtn && runtime.activeCaseViewModuleId === mod.id && runtime.caseGenViewDrawer && runtime.caseGenViewDrawer.element && runtime.caseGenViewDrawer.element.classList.contains('open')) {
          viewBtn.textContent = '收起用例视图';
        }
      });
    }

    function renderXmindModuleMirror() {
      if (!caseGenXmindModulesContainer) return;
      var xmindCasegenApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var workspaceItems = xmindCasegenApi && typeof xmindCasegenApi.getWorkspaceProgressItems === 'function'
        ? xmindCasegenApi.getWorkspaceProgressItems()
        : [];
      var selectedWorkspaceId = '';
      if (Array.isArray(workspaceItems)) {
        workspaceItems.some(function(item) {
          if (!item || item.active !== true || !item.id) return false;
          selectedWorkspaceId = String(item.id || '');
          return true;
        });
      }
      var payload = xmindCasegenApi && typeof xmindCasegenApi.getWorkspaceModuleMirrorPayload === 'function'
        ? xmindCasegenApi.getWorkspaceModuleMirrorPayload(selectedWorkspaceId || undefined)
        : null;
      renderCaseGenWorkspaceMirrorTabs(workspaceItems);
      if (!payload || payload.hasWorkspaces !== true) {
        caseGenXmindModulesContainer.innerHTML = '<div class="casegen-mirror-empty"><p class="hint">当前还没有 XMind 生成页签，请先点击上方【XMind用例生成】开始生成。</p></div>';
        return;
      }
      var modules = Array.isArray(payload.modules) ? payload.modules : [];
      if (!modules.length) {
        caseGenXmindModulesContainer.innerHTML = '<div class="casegen-mirror-empty"><p class="hint">当前 XMind 页签暂时还没有模块数据，可切换页签查看，或打开 XMind 用例生成继续执行。</p></div>';
        return;
      }
      var statusMap = payload.moduleStatus && typeof payload.moduleStatus === 'object' ? payload.moduleStatus : {};
      var timingMap = payload.timing && typeof payload.timing === 'object' ? payload.timing : {};
      var progressMap = payload.progress && typeof payload.progress === 'object' ? payload.progress : {};
      var resultMap = payload.results && typeof payload.results === 'object' ? payload.results : {};
      caseGenXmindModulesContainer.innerHTML = modules.map(function(mod, idx) {
        var moduleId = mod && mod.id ? String(mod.id || '') : '';
        var rawResult = moduleId && resultMap[moduleId] ? String(resultMap[moduleId] || '') : '';
        var hasResult = Boolean(rawResult.trim() && !/^\[\s*\]$/.test(rawResult.trim()));
        var resultInfo = parseGeneratedCases(rawResult);
        var timing = moduleId && Number.isFinite(Number(timingMap[moduleId])) ? Number(timingMap[moduleId]) : null;
        var timingText = Number.isFinite(timing) ? (timing / 1000).toFixed(2) : '--';
        var statusInfo = moduleId && statusMap[moduleId] && typeof statusMap[moduleId] === 'object'
          ? statusMap[moduleId]
          : null;
        return ''
          + '<div class="usecase-card usecase-card-xmind" data-xmind-module-id="' + escapeHtml(moduleId) + '">'
          +   '<h3>' + (idx + 1) + '. ' + escapeHtml(resolveModuleTitle(mod.title || mod.module || '未命名模块')) + '</h3>'
          +   '<div class="actions module-actions">'
          +     '<button class="pill secondary" type="button" data-open-xmind-workspace="' + escapeHtml(payload.workspaceId || '') + '">打开XMind页签</button>'
          +     '<button class="pill primary case-view-btn" type="button" data-xmind-mirror-view="' + escapeHtml(moduleId) + '" data-xmind-mirror-workspace="' + escapeHtml(payload.workspaceId || '') + '" ' + (hasResult ? '' : 'disabled') + '>用例视图</button>'
          +   '</div>'
          +   '<p class="hint timing">模型用时：<strong>' + timingText + '</strong> 秒</p>'
          +   '<p class="status ' + escapeHtml(statusInfo && statusInfo.type ? String(statusInfo.type || '') : '') + '">' + escapeHtml(statusInfo && statusInfo.text ? String(statusInfo.text || '') : '') + '</p>'
          +   '<div class="case-progress">' + renderCaseModuleProgress(moduleId, progressMap) + '</div>'
          +   '<textarea readonly placeholder="XMind 镜像结果...">' + escapeHtml(resultInfo.normalized || '') + '</textarea>'
          + '</div>';
      }).join('');
    }

    function renderCaseGeneration() {
      if (shouldDeferXmindCasegenMirrorRender()) {
        queueDeferredXmindCasegenMirrorRender();
        return;
      }
      var activeView = ensureCaseGenSettings().activeTab;
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var xmindDrawerOpen = Boolean(xmindApi && typeof xmindApi.isOpen === 'function' && xmindApi.isOpen());
      var pendingXmindDrawerRestore = !xmindDrawerOpen && hasPendingXmindDrawerRestoreIntent();
      if (
        (activeView === 'settings' || activeView === 'legacy-modules')
        && !xmindDrawerOpen
        && !pendingXmindDrawerRestore
        && !hasRunningCaseModules()
        && shouldRestoreLegacyCaseGenForRender()
      ) {
        restoreLegacyCaseGenState({ render: false, persist: false });
      }
      renderLegacyCaseGeneration();
      renderXmindModuleMirror();
      refreshExportCaseGenButton();
      refreshExportCaseGenXmindButton();
      renderCaseGenProgressBoard();
      refreshAppendExistingButton();
      refreshCaseGenBatchButtons();
      renderAppendTargetOptions();
      persistWorkflowState();
    }

    function exportCaseGenerationResults() {
      if (!casesGenerationContainer) return;
      if (!state.caseGenModules || !state.caseGenModules.length) {
        setStatus(caseGenStatus, '请先生成测试用例', 'warn');
        return;
      }
      try {
        var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出用例');
        if (!requirementLabel) {
          setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
          return;
        }
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var allCases = [];
        state.caseGenModules.forEach(function(mod) {
          var list = getCaseListForModule(mod.id);
          if (!Array.isArray(list) || !list.length) return;
          var moduleTitle = resolveModuleTitle(mod && (mod.title || mod.module));
          list.forEach(function(item) {
            var clone = Object.assign({}, item);
            if (!clone.module) clone.module = moduleTitle;
            allCases.push(clone);
          });
        });
        if (!allCases.length) {
          setStatus(caseGenStatus, '未找到可导出的用例，请先生成用例', 'warn');
          return;
        }
        var sanitized = sanitizeCasesForExport(allCases);
        buildXmindPackageFromCases(sanitized, requirementLabel, requirementLabel).then(function(exported) {
          downloadBlob(exported.fileName, exported.blob);
          setStatus(caseGenStatus, '已导出 ' + exported.count + ' 条用例为 XMind', 'ok');
        }).catch(function(err) {
          setStatus(caseGenStatus, err && err.message ? err.message : '导出失败', 'err');
        });
      } catch (err) {
        setStatus(caseGenStatus, err.message || '导出失败', 'err');
      }
    }

    function exportModuleCases(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      var list = getCaseListForModule(moduleId);
      if (!list.length) {
        setStatus(caseGenStatus, '【' + mod.title + '】还没有用例，无法导出', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      try {
        var rawResult = state.caseGenResults[moduleId] || JSON.stringify(list, null, 2);
        var exported = exportSingleModuleData(mod, rawResult, requirementLabel);
        var content = '#CASE_MODULE:' + mod.title + '\n' + JSON.stringify(exported.payload, null, 2);
        downloadText(exported.fileName, content);
        setStatus(caseGenStatus, '已导出【' + mod.title + '】用例（' + exported.count + ' 条）', 'ok');
      } catch (err) {
        setStatus(caseGenStatus, err.message || '导出失败', 'err');
      }
    }

    async function importModuleCases(moduleId, file) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod || !file) return;
      var moduleTitle = mod.title || '当前模块';
      try {
        var text = await file.text();
        var parts = text.split('\n');
        var firstLine = parts[0];
        var rest = parts.slice(1);
        if (!(firstLine && firstLine.indexOf('#CASE_MODULE:') === 0)) {
          setCaseModuleStatus(moduleId, '导入文件缺少 CASE MODULE 标识', 'err');
          return;
        }
        var tag = firstLine.replace('#CASE_MODULE:', '').trim();
        if (tag && tag !== mod.title) {
          setCaseModuleStatus(moduleId, '导入文件属于【' + tag + '】，与【' + moduleTitle + '】不匹配', 'err');
          return;
        }
        var payload = rest.join('\n').trim();
        var parsedLabel = extractRequirementLabelFromText(payload);
        if (!parsedLabel) {
          var reqMatch = payload.match(/"requir[e]?ment"\s*:\s*"([^"]+)"/i);
          if (reqMatch && reqMatch[1]) parsedLabel = normalizeRequirementName(reqMatch[1]);
        }
        if (parsedLabel) {
          setRequirementLabel(parsedLabel, 'import');
        } else {
          var ensured = await promptRequirementLabelByDrawer('请输入本次需求标识后再导入用例');
          if (!ensured) {
            setCaseModuleStatus(moduleId, '已取消导入（需求标识为空）', 'warn');
            return;
          }
        }
        if (!payload) {
          setCaseModuleStatus(moduleId, '导入文件内容为空', 'warn');
          return;
        }
        var normalized = stripCodeFence(payload);
        var parsedInfo = parseGeneratedCases(normalized);
        normalized = parsedInfo.normalized || normalized;
        state.caseGenResults[moduleId] = normalized;
        state.caseSelections[moduleId] = new Set();
        var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
        if (textarea) textarea.value = normalized;
        if (exportCaseGenBtn) exportCaseGenBtn.disabled = false;
        var viewBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
        if (viewBtn) {
          viewBtn.disabled = false;
          viewBtn.textContent = '用例视图';
        }
        var exportBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-export="' + moduleId + '"]');
        if (exportBtn) exportBtn.disabled = false;
        var clearBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-clear="' + moduleId + '"]');
        if (clearBtn) clearBtn.disabled = false;
        closeCaseViewIfActive(moduleId);
        updateSupplementButtons(moduleId, true);
        setCaseModuleStatus(moduleId, '已导入【' + moduleTitle + '】的用例', 'ok');
        refreshAppendExistingButton();
        syncLegacyCaseGenState({ persist: false });
        persistWorkflowState();
      } catch (err) {
        console.error(err);
        setCaseModuleStatus(moduleId, '导入失败：' + err.message, 'err');
      }
    }

    async function appendSelectedCasesToImported() {
      var selectedEntries = collectSelectedCaseEntries();
      if (!selectedEntries.length) {
        setStatus(caseGenStatus, '请先在用例视图勾选需要追加的用例', 'warn');
        refreshAppendExistingButton();
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再追加到已有用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消追加（需求标识为空）', 'warn');
        return;
      }
      var workflowEntries = Array.isArray(state.importedCases) ? state.importedCases : [];
      var workflowTargets = [];
      workflowEntries.forEach(function(entry, idx) {
        var list = Array.isArray(entry && entry.list) ? entry.list : [];
        if (!list.length && deriveCaseListFromText && entry && entry.text) {
          list = deriveCaseListFromText(entry.text);
        }
        if (!list || !list.length) return;
        workflowTargets.push({
          entry: entry,
          list: list,
          value: 'workflow:' + (entry.id || entry.name || ('wf-' + idx)),
        });
      });
      var hasWorkflowCases = workflowTargets.length > 0;
      var execCandidates = (getTempExecFiles() || []).filter(function(file) {
        return file && Array.isArray(file.cases) && file.cases.length;
      });
      if (!hasWorkflowCases && !execCandidates.length) {
        setStatus(caseGenStatus, '请先在“功能流程”或“用例执行”导入用例后再追加', 'warn');
        return;
      }
      var targetValue = appendTargetSelect ? appendTargetSelect.value : '';
      var targetOptions = computeAppendTargetOptions();
      var targetItem = targetOptions.find(function(opt) { return opt.value === targetValue; });
      if (!targetItem || !targetValue) {
        setStatus(caseGenStatus, '请选择目标用例后再确认新增', 'warn');
        return;
      }

      async function appendToTempExecOnly(targetFile) {
        var execInfo = normalizeCaseListWithModules(targetFile && targetFile.cases ? targetFile.cases : []);
        var additionInfo = collectAdditionsForBuckets(execInfo.buckets, selectedEntries);
        if (!additionInfo.additions.length) {
          var emptyMsgExec = additionInfo.duplicateCount
            ? '用例已经包含将要导入的用例，无需重复新增'
            : '未找到可追加的用例，请重新选择';
          setStatus(caseGenStatus, emptyMsgExec, 'warn');
          return;
        }
        var confirmPartsExec = ['将向【' + (targetFile.name || '用例') + '】追加 ' + additionInfo.additions.length + ' 条用例'];
        if (additionInfo.moduleCount) confirmPartsExec.push('涉及 ' + additionInfo.moduleCount + ' 个模块');
        if (additionInfo.duplicateCount) confirmPartsExec.push('其余 ' + additionInfo.duplicateCount + ' 条因标题重复将跳过');
        var confirmMsgExec = confirmPartsExec.join('，') + '，是否继续？';
        var prevDrawer = resolveCaseGenActiveDrawer();
        var resExec = await openConfirmDrawer({
          title: '确认追加',
          message: confirmMsgExec,
          confirmText: '确认追加',
          cancelText: '取消',
          previousDrawer: prevDrawer || null,
        });
        if (!resExec || resExec.ok !== true) {
          setStatus(caseGenStatus, '已取消追加到用例执行', 'warn');
          return;
        }
        var mergedCasesRaw = execInfo.normalized.slice();
        var startIdx = mergedCasesRaw.length;
        additionInfo.additions.forEach(function(item, idx) {
          mergedCasesRaw.push(convertCaseForExec(item, targetFile.id, startIdx + idx));
        });
        var normalizedCases = normalizeExecCaseList(mergedCasesRaw, targetFile.id);
        targetFile.cases = normalizedCases;
        targetFile.requirement = targetFile.requirement || requirementLabel;
        persistTempExecState();
        setTempExecActive(targetFile.id);
        syncTempExecFocus();
        renderTempExecView();
        if (tempExecStatus) {
          setStatus(tempExecStatus, '【' + (targetFile.name || '用例') + '】已追加 ' + additionInfo.additions.length + ' 条用例', 'ok');
        }
        var statusExec = ['成功新增到【' + (targetFile.name || '用例') + '】'];
        if (additionInfo.duplicateCount) statusExec.push('含 ' + additionInfo.duplicateCount + ' 条重复已跳过');
        setStatus(caseGenStatus, statusExec.join('，'), additionInfo.duplicateCount ? 'warn' : 'ok');
        switchTab('tempexec');
        var tempSection = document.querySelector('[data-section-id="tempexec-view"]');
        if (tempSection) scrollElementIntoView(tempSection, 'smooth', 140);
      }

      var normRequirement = normalizeRequirementName(requirementLabel);
      if (!hasWorkflowCases) {
        if (targetValue.indexOf('exec:') !== 0) {
          setStatus(caseGenStatus, '请选择执行页用例后再追加', 'warn');
          return;
        }
        var targetExecOnly = execCandidates.find(function(file) { return ('exec:' + file.id) === targetValue; });
        if (!targetExecOnly) {
          setStatus(caseGenStatus, '未找到选择的执行用例，请重新选择', 'warn');
          renderAppendTargetOptions();
          return;
        }
        await appendToTempExecOnly(targetExecOnly);
        if (appendTargetSelect) appendTargetSelect.value = '';
        state.caseGenAppendTarget = '';
        renderAppendTargetOptions();
        return;
      }
      if (targetValue.indexOf('workflow:') !== 0) {
        setStatus(caseGenStatus, '当前仅支持追加到功能流程已导入的用例', 'warn');
        return;
      }
      var targetWorkflow = workflowTargets.find(function(item) { return item.value === targetValue; });
      if (!targetWorkflow) {
        setStatus(caseGenStatus, '未找到匹配的功能流程用例，请重新选择', 'warn');
        renderAppendTargetOptions();
        return;
      }

      var workflowInfo = normalizeCaseListWithModules(targetWorkflow.list);
      var additionInfoWorkflow = collectAdditionsForBuckets(workflowInfo.buckets, selectedEntries);
      if (!additionInfoWorkflow.additions.length) {
        var emptyMsg = additionInfoWorkflow.duplicateCount
          ? '用例已经包含将要导入的用例，无需重复新增'
          : '未找到可追加的用例，请重新选择';
        setStatus(caseGenStatus, emptyMsg, 'warn');
        return;
      }

      var targetWorkflowName = stringifyCaseField(targetWorkflow.entry && targetWorkflow.entry.name) || '功能流程导入用例';
      var confirmParts = ['将向【' + targetWorkflowName + '】追加 ' + additionInfoWorkflow.additions.length + ' 条新用例'];
      if (additionInfoWorkflow.moduleCount) confirmParts.push('涉及 ' + additionInfoWorkflow.moduleCount + ' 个模块');
      if (additionInfoWorkflow.duplicateCount) confirmParts.push('其余 ' + additionInfoWorkflow.duplicateCount + ' 条因标题重复将跳过');
      var confirmMsg = confirmParts.join('，') + '，是否继续？';
      var prevDrawer2 = resolveCaseGenActiveDrawer();
      var resWorkflow = await openConfirmDrawer({
        title: '确认追加',
        message: confirmMsg,
        confirmText: '确认追加',
        cancelText: '取消',
        previousDrawer: prevDrawer2 || null,
      });
      if (!resWorkflow || resWorkflow.ok !== true) {
        setStatus(caseGenStatus, '已取消追加到已有用例', 'warn');
        return;
      }

      var mergedList = workflowInfo.normalized.concat(additionInfoWorkflow.additions);
      try {
        var mergedText = '';
        try {
          mergedText = JSON.stringify(wrapDataWithRequirement(mergedList), null, 2);
        } catch (errWrap) {
          mergedText = JSON.stringify(mergedList, null, 2);
        }
        targetWorkflow.entry.list = mergedList;
        targetWorkflow.entry.text = mergedText;
        renderImportedCaseList();
        syncCaseTextWithImports();
        refreshImportedCaseView();

        var execTarget = null;
        var sameRequirementExec = execCandidates.filter(function(file) {
          return normalizeRequirementName(file && file.requirement) === normRequirement;
        });
        if (sameRequirementExec && sameRequirementExec.length) {
          execTarget = sameRequirementExec[0];
        }

        if (execTarget) {
          var existingCases = Array.isArray(execTarget.cases) ? execTarget.cases.slice() : [];
          var existingMap = new Map();
          existingCases.forEach(function(item) {
            if (!item) return;
            var mKey = normalizeModuleKey(item.module || item.module_name || item['模块']);
            var tKey = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
            var key = mKey + '::' + tKey;
            if (!existingMap.has(key)) existingMap.set(key, item);
          });
          var usedKeys = new Set();
          var mergedExec = mergedList.map(function(item, idx) {
            var mKey = normalizeModuleKey(item.module || item.module_name || item['模块']);
            var tKey = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
            var key = mKey + '::' + tKey;
            var existing = existingMap.get(key);
            usedKeys.add(key);
            return convertCaseForExec(item, execTarget.id, idx, existing);
          });
          existingCases.forEach(function(item) {
            if (!item) return;
            var mKey = normalizeModuleKey(item.module || item.module_name || item['模块']);
            var tKey = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
            var key = mKey + '::' + tKey;
            if (usedKeys.has(key)) return;
            mergedExec.push(convertCaseForExec(item, execTarget.id, mergedExec.length, item));
          });
          execTarget.cases = normalizeExecCaseList(mergedExec, execTarget.id);
          execTarget.requirement = execTarget.requirement || requirementLabel;
          execTarget.reuseEnabled = Boolean(execTarget.reuseEnabled);
          persistTempExecState();
          setTempExecActive(execTarget.id);
          syncTempExecFocus();
          renderTempExecView();
          if (tempExecStatus) {
            var execMsg = hasExecutionData(execTarget)
              ? '【' + (execTarget.name || '用例') + '】已同步新用例并保留执行记录'
              : '【' + (execTarget.name || '用例') + '】已同步新用例';
            setStatus(tempExecStatus, execMsg, 'ok');
          }
          var statusParts = ['成功新增到【' + targetWorkflowName + '】并同步到执行'];
          if (additionInfoWorkflow.duplicateCount) statusParts.push('含 ' + additionInfoWorkflow.duplicateCount + ' 条重复已跳过');
          setStatus(caseGenStatus, statusParts.join('，'), additionInfoWorkflow.duplicateCount ? 'warn' : 'ok');
        } else {
          var fallbackName = targetWorkflowName || '导入用例';
          var baseName = getSafeFileBaseName(
            targetWorkflow.entry && (targetWorkflow.entry.name || targetWorkflow.entry.fileName || fallbackName),
            fallbackName
          );
          var compactTs = formatCompactTimestamp ? formatCompactTimestamp() : '';
          var entryName = baseName + (compactTs ? ('_' + compactTs) : '');
          var entry = createTempExecFile(entryName, mergedList, 'current', null, null, requirementLabel);
          if (!entry) {
            setStatus(caseGenStatus, '未构建出可同步的用例，请检查数据格式', 'err');
            return;
          }
          entry.fromCaseGen = true;
          if (!ensureTempExecReplacement(entry)) {
            setStatus(caseGenStatus, '已取消转到用例执行', 'warn');
            return;
          }
          state.tempExecFiles.push(entry);
          syncTempExecFocus();
          state.tempExecPages[entry.id] = 0;
          persistTempExecState();
          setTempExecActive(entry.id);
          if (tempExecStatus) {
            setStatus(tempExecStatus, '【' + entry.name + '】已同步 ' + entry.cases.length + ' 条用例', 'ok');
          }
          var statusNew = ['成功新增到【' + targetWorkflowName + '】并同步到执行'];
          if (additionInfoWorkflow.duplicateCount) statusNew.push('含 ' + additionInfoWorkflow.duplicateCount + ' 条重复已跳过');
          setStatus(caseGenStatus, statusNew.join('，'), additionInfoWorkflow.duplicateCount ? 'warn' : 'ok');
        }

        switchTab('tempexec');
        var tempViewSection = document.querySelector('[data-section-id="tempexec-view"]');
        if (tempViewSection) scrollElementIntoView(tempViewSection, 'smooth', 140);
        if (appendTargetSelect) appendTargetSelect.value = '';
        state.caseGenAppendTarget = '';
        renderAppendTargetOptions();
        persistWorkflowState();
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, '追加失败：' + err.message, 'err');
      }
    }

    async function transferSelectedCasesToExec() {
      if (!state.caseGenModules || !state.caseGenModules.length) {
        setStatus(caseGenStatus, '请先前往“测试模块拆分”完成拆分后再转到执行页', 'warn');
        return;
      }
      var hasGenerated = state.caseGenModules.some(function(mod) {
        var list = getCaseListForModule(mod.id);
        return list && list.length;
      });
      if (!hasGenerated) {
        setStatus(caseGenStatus, '当前尚未生成用例，请先生成用例后再转到执行页', 'warn');
        return;
      }
      var selectedEntries = collectSelectedCaseEntries();
      if (!selectedEntries.length) {
        var autoOpened = false;
        state.caseGenModules.some(function(mod) {
          var list = getCaseListForModule(mod.id);
          if (!list || !list.length) return false;
          toggleCaseView(mod.id);
          autoOpened = true;
          return true;
        });
        setStatus(
          caseGenStatus,
          autoOpened ? '请先勾选用例后再转到执行页（已自动打开首个模块）' : '请到各个模块的用例视图中勾选用例（点击右侧“用例视图”按钮）',
          'warn'
        );
        refreshAppendExistingButton();
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再转到用例执行');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消转到执行页（需求标识为空）', 'warn');
        return;
      }
      var hasWorkflow = hasImportedCases && hasImportedCases();
      var execFiles = getTempExecFiles() || [];
      var hasExec = execFiles && execFiles.length > 0;
      if (hasWorkflow || hasExec) {
        var confirmed = window.confirm('可进行用例合并，确认不进行合并直接使用所选用例？');
        if (!confirmed) {
          setStatus(caseGenStatus, '已取消直接转到执行页，请在上方选择目标用例后再试', 'warn');
          try {
            if (typeof window !== 'undefined' && window.scrollTo) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          } catch (errScroll) {
            // ignore
          }
          return;
        }
      }
      var combinedCases = [];
      selectedEntries.forEach(function(entry) {
        if (entry && Array.isArray(entry.cases)) combinedCases = combinedCases.concat(entry.cases);
      });
      var sanitized = sanitizeCasesForExport(combinedCases);
      if (!sanitized.length) {
        setStatus(caseGenStatus, '未找到可转移的用例，请重新选择', 'warn');
        return;
      }
      var entryName = getSafeFileBaseName(requirementLabel || '勾选用例', '勾选用例');
      var entry = createTempExecFile(entryName, sanitized, 'current', null, null, requirementLabel);
      if (!entry) {
        setStatus(caseGenStatus, '未生成可执行的用例，请检查数据格式', 'err');
        return;
      }
      entry.fromCaseGen = true;
      if (!ensureTempExecReplacement(entry)) {
        setStatus(caseGenStatus, '已取消转到用例执行', 'warn');
        return;
      }
      state.tempExecFiles.push(entry);
      syncTempExecFocus();
      state.tempExecPages[entry.id] = 0;
      persistTempExecState();
      setTempExecActive(entry.id);
      if (tempExecStatus) {
        setStatus(tempExecStatus, '【' + (entry.name || '用例') + '】已导入 ' + entry.cases.length + ' 条用例', 'ok');
      }
      setStatus(caseGenStatus, '已将 ' + entry.cases.length + ' 条勾选用例转到执行页', 'ok');
      switchTab('tempexec');
      var tempViewSection = document.querySelector('[data-section-id="tempexec-view"]');
      if (tempViewSection) scrollElementIntoView(tempViewSection, 'smooth', 140);
      refreshAppendExistingButton();
    }

    async function transferModuleToTempExec(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      if (isCaseModuleRunning(moduleId)) {
        setStatus(caseGenStatus, '【' + mod.title + '】正在生成，请稍后再试', 'warn');
        return;
      }
      var list = getCaseListForModule(moduleId);
      var selection = state.caseSelections[moduleId];
      if (!list.length) {
        setStatus(caseGenStatus, '【' + mod.title + '】暂无可转移的用例', 'warn');
        updateSupplementButtons(moduleId, false);
        return;
      }
      if (!selection || !selection.size) {
        setStatus(caseGenStatus, '请先在用例视图中勾选需要转移的用例', 'warn');
        updateSupplementButtons(moduleId, true);
        return;
      }
      var selectedList = list.filter(function(_, idx) { return selection.has(idx); });
      if (!selectedList.length) {
        setStatus(caseGenStatus, '当前未勾选可转移的用例', 'warn');
        updateSupplementButtons(moduleId, true);
        return;
      }
      var transferBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-tempexec="' + moduleId + '"]');
      var originalLabel = transferBtn ? transferBtn.textContent : '';
      if (transferBtn) {
        transferBtn.disabled = true;
        transferBtn.textContent = '准备中...';
      }
      try {
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var exported = await buildXmindPackageFromCases(selectedList, mod.title, getRequirementLabel(true));
        downloadBlob(exported.fileName, exported.blob);
        var entryName = mod.title || '测试用例';
        var entry = createTempExecFile(entryName, selectedList, 'current', null, null, getRequirementLabel(true));
        if (!entry) {
          setStatus(caseGenStatus, '转移失败：未构建出有效的执行用例', 'err');
          return;
        }
        if (!ensureTempExecReplacement(entry)) {
          setStatus(caseGenStatus, '已取消转到用例执行', 'warn');
          return;
        }
        state.tempExecFiles.push(entry);
        syncTempExecFocus();
        state.tempExecPages[entry.id] = 0;
        persistTempExecState();
        setTempExecActive(entry.id);
        if (tempExecStatus) {
          setStatus(tempExecStatus, '【' + entry.name + '】已导入 ' + entry.cases.length + ' 条用例', 'ok');
        }
        setStatus(caseGenStatus, '已导出 ' + exported.count + ' 条用例为 XMind，并同步到用例执行', 'ok');
        switchTab('tempexec');
        var tempViewSection = document.querySelector('[data-section-id="tempexec-view"]');
        if (tempViewSection) scrollElementIntoView(tempViewSection, 'smooth', 140);
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, '转到用例执行失败：' + err.message, 'err');
      } finally {
        if (transferBtn) {
          transferBtn.textContent = originalLabel || '转到用例执行';
        }
        updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
      }
    }

    function clearModuleCases(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      if (!state.caseGenResults[moduleId]) {
        setCaseModuleStatus(moduleId, '【' + mod.title + '】暂无可清除的用例', 'warn');
        return;
      }
      var moduleTitle = resolveModuleTitle(mod.title || mod.module || '');
      openConfirmDrawer({
        title: '确认清除用例',
        message: '确定要清除【' + moduleTitle + '】的用例吗？',
        confirmText: '清除',
        cancelText: '取消',
        previousDrawer: resolveCaseGenActiveDrawer(),
      }).then(function(res) {
        if (!res || res.ok !== true) return;
        delete state.caseGenResults[moduleId];
        delete state.caseSelections[moduleId];
        var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
        if (textarea) textarea.value = '';
        var viewBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
        if (viewBtn) {
          viewBtn.disabled = true;
          viewBtn.textContent = '用例视图';
        }
        var exportBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-export="' + moduleId + '"]');
        if (exportBtn) exportBtn.disabled = true;
        var clearBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-clear="' + moduleId + '"]');
        if (clearBtn) clearBtn.disabled = true;
        closeCaseViewIfActive(moduleId);
        updateSupplementButtons(moduleId, false);
        clearCaseModuleStatus(moduleId);
        clearCaseProgress(moduleId);
        setCaseModuleStatus(moduleId, '已清除【' + moduleTitle + '】的用例', 'ok');
        refreshExportCaseGenButton();
        refreshAppendExistingButton();
        refreshExportCaseGenXmindButton();
        refreshCaseGenBatchButtons();
        syncLegacyCaseGenState({ persist: false });
        persistWorkflowState();
      });
    }

    function toggleCaseView(moduleId) {
      if (!moduleId) return;
      var viewBtn = null;
      if (casesGenerationContainer && casesGenerationContainer.querySelector) {
        viewBtn = casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
      }
      if (!viewBtn && caseGenXmindModulesContainer && caseGenXmindModulesContainer.querySelector) {
        viewBtn = caseGenXmindModulesContainer.querySelector('[data-xmind-mirror-view="' + moduleId + '"]');
      }
      var drawer = ensureCaseGenDrawer();
      if (!viewBtn || !drawer || !caseGenViewDrawerBody) return;
      var drawerEl = drawer.element;
      var isOpenCurrent = drawerEl && drawerEl.classList.contains('open') && runtime.activeCaseViewModuleId === moduleId;
      if (isOpenCurrent) {
        drawer.close();
        return;
      }
      var content = state.caseGenResults[moduleId];
      if (!content) {
        setStatus(caseGenStatus, '该模块尚未生成用例', 'warn');
        return;
      }
      var list = parseCaseList(content);
      if (!list.length) {
        setStatus(caseGenStatus, '解析到的用例列表为空，请确认模型输出 JSON', 'warn');
        return;
      }
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      var moduleTitle = resolveModuleTitle(mod && (mod.title || mod.module));
      caseGenViewDrawerBody.innerHTML = '' +
        '<div class="caseview drawer-view visible" data-view-container="' + moduleId + '">' +
          renderCaseTable(mod, list, { selectable: true, moduleId: moduleId, showRemark: true }) +
        '</div>';
      if (caseGenViewDrawerTitle) {
        caseGenViewDrawerTitle.textContent = '用例视图 - ' + moduleTitle;
      }
      if (runtime.activeCaseViewModuleId && runtime.activeCaseViewModuleId !== moduleId) {
        resetCaseViewButton(runtime.activeCaseViewModuleId);
      }
      runtime.activeCaseViewModuleId = moduleId;
      viewBtn.textContent = '收起用例视图';
      toggleCaseGenAllSelectButton(false);
      drawer.open();
      refreshCaseSelectionUI(moduleId);
    }

    function openXmindMirrorCaseView(workspaceId, moduleId) {
      var targetModuleId = String(moduleId || '');
      if (!targetModuleId) return false;
      var viewBtn = caseGenXmindModulesContainer && caseGenXmindModulesContainer.querySelector
        ? caseGenXmindModulesContainer.querySelector('[data-xmind-mirror-view="' + targetModuleId + '"]')
        : null;
      var drawer = ensureCaseGenDrawer();
      if (!viewBtn || !drawer || !caseGenViewDrawerBody) return false;
      var drawerEl = drawer.element;
      var isOpenCurrent = drawerEl && drawerEl.classList.contains('open') && runtime.activeCaseViewModuleId === targetModuleId;
      if (isOpenCurrent) {
        drawer.close();
        return true;
      }
      var xmindCasegenApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var payload = xmindCasegenApi && typeof xmindCasegenApi.getWorkspaceModuleMirrorPayload === 'function'
        ? xmindCasegenApi.getWorkspaceModuleMirrorPayload(workspaceId)
        : null;
      if (!payload) {
        setStatus(caseGenStatus, '当前 XMind 镜像数据未就绪，请稍后重试', 'warn');
        return false;
      }
      var modules = Array.isArray(payload.modules) ? payload.modules : [];
      var targetModule = null;
      for (var i = 0; i < modules.length; i += 1) {
        if (!modules[i]) continue;
        if (String(modules[i].id || '') === targetModuleId) {
          targetModule = modules[i];
          break;
        }
      }
      var rawResult = payload.results && typeof payload.results === 'object'
        ? String(payload.results[targetModuleId] || '')
        : '';
      if (!rawResult.trim()) {
        setStatus(caseGenStatus, '该模块尚未生成用例', 'warn');
        return false;
      }
      var list = parseCaseList(rawResult);
      if (!list.length) {
        try {
          var parsed = JSON.parse(stripCodeFence(rawResult) || '[]');
          list = Array.isArray(parsed) ? parsed : [];
        } catch (err) {
          list = [];
        }
      }
      if (!list.length) {
        setStatus(caseGenStatus, '解析到的用例列表为空，请确认模型输出 JSON', 'warn');
        return false;
      }
      var moduleInfo = targetModule || { id: targetModuleId, title: '' };
      var moduleTitle = resolveModuleTitle(moduleInfo && (moduleInfo.title || moduleInfo.module));
      caseGenViewDrawerBody.innerHTML = '' +
        '<div class="caseview drawer-view visible" data-view-container="' + targetModuleId + '">' +
          renderCaseTable(moduleInfo, list, { selectable: false, moduleId: targetModuleId, showRemark: true }) +
        '</div>';
      if (caseGenViewDrawerTitle) {
        caseGenViewDrawerTitle.textContent = '用例视图 - ' + moduleTitle;
      }
      if (runtime.activeCaseViewModuleId && runtime.activeCaseViewModuleId !== targetModuleId) {
        resetCaseViewButton(runtime.activeCaseViewModuleId);
      }
      runtime.activeCaseViewModuleId = targetModuleId;
      viewBtn.textContent = '收起用例视图';
      toggleCaseGenAllSelectButton(false);
      drawer.open();
      return true;
    }

    function handleCaseSelectionChange(moduleId, index, checked) {
      var selection = ensureCaseSelectionSet(moduleId);
      if (checked) selection.add(index);
      else selection.delete(index);
      if (selection.size > 0) clearAllCaseGenSelectionHints();
      refreshCaseSelectionUI(moduleId);
      updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
      updateCaseGenAllSelectionButton();
      syncLegacyCaseGenState({ persist: false });
      persistWorkflowState();
    }

    function handleCaseSelectAll(moduleId, checked) {
      var container = getCaseViewContainer(moduleId);
      if (!container) return;
      var selection = ensureCaseSelectionSet(moduleId);
      selection.clear();
      if (checked) {
        var rowCheckboxes = container.querySelectorAll('input[data-case-select="' + moduleId + '"]');
        rowCheckboxes.forEach(function(cb) { selection.add(Number(cb.dataset.index)); });
      }
      if (selection.size > 0) clearAllCaseGenSelectionHints();
      refreshCaseSelectionUI(moduleId);
      updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
      updateCaseGenAllSelectionButton();
      syncLegacyCaseGenState({ persist: false });
      persistWorkflowState();
    }

    function handleCaseSelectAllModules() {
      var items = collectGeneratedModules();
      if (!items.length) return;
      var stats = getCaseGenAllSelectionStats();
      var shouldSelect = stats.selected < stats.total;
      items.forEach(function(entry) {
        var moduleId = entry.mod.id;
        var list = entry.list || [];
        var selection = ensureCaseSelectionSet(moduleId);
        selection.clear();
        if (shouldSelect) {
          for (var i = 0; i < list.length; i += 1) selection.add(i);
        }
      });
      if (shouldSelect) clearAllCaseGenSelectionHints();
      items.forEach(function(entry) {
        refreshCaseSelectionUI(entry.mod.id);
        updateSupplementButtons(entry.mod.id, (entry.list || []).length > 0);
      });
      refreshExportCaseGenXmindButton();
      updateCaseGenAllSelectionButton();
      syncLegacyCaseGenState({ persist: false });
      persistWorkflowState();
    }

    function exportSelectedCases(moduleId) {
      var selection = state.caseSelections[moduleId];
      if (!selection || !selection.size) {
        setStatus(caseGenStatus, '请选择需要导出的用例', 'warn');
        return;
      }
      var list = getCaseListForModule(moduleId);
      if (!list.length) {
        setStatus(caseGenStatus, '当前模块没有可导出的用例', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      var name = mod && mod.title ? mod.title : '模块';
      try {
        var exported = exportSelectedCasesData(selection, list, name, requirementLabel);
        downloadText(exported.fileName, JSON.stringify(exported.payload, null, 2));
        setStatus(caseGenStatus, '已导出【' + name + '】选中的 ' + exported.count + ' 条用例', 'ok');
      } catch (err) {
        setStatus(caseGenStatus, err.message || '导出失败', 'err');
      }
    }

    async function exportSelectedCasesToXmind(moduleId) {
      var selection = state.caseSelections[moduleId];
      if (!selection || !selection.size) {
        setStatus(caseGenStatus, '请选择需要转换的用例', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出 XMind 用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var list = getCaseListForModule(moduleId);
      if (!list.length) {
        setStatus(caseGenStatus, '当前用例无法解析，请重新生成后再导出', 'warn');
        return;
      }
      var selectedCases = list.filter(function(_, idx) { return selection.has(idx); });
      if (!selectedCases.length) {
        setStatus(caseGenStatus, '请选择至少一条用例后再导出', 'warn');
        return;
      }
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      try {
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var exported = await buildXmindPackageFromCases(selectedCases, mod && mod.title ? mod.title : '模块', requirementLabel);
        downloadBlob(exported.fileName, exported.blob);
        setStatus(caseGenStatus, '已导出 ' + exported.count + ' 条用例为 XMind', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, 'XMind 导出失败：' + err.message, 'err');
      }
    }

    async function exportSelectedModulesToXmind() {
      var selectedEntries = collectSelectedCaseEntries();
      if (!selectedEntries.length) {
        setStatus(caseGenStatus, '请先在用例视图勾选需要导出的用例', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出所选 XMind 用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var aggregated = [];
      selectedEntries.forEach(function(entry) {
        var moduleTitle = resolveModuleTitle(entry && entry.moduleTitle);
        (entry.cases || []).forEach(function(item) {
          var clone = Object.assign({}, item);
          if (!clone.module) clone.module = moduleTitle;
          aggregated.push(clone);
        });
      });
      if (!aggregated.length) {
        setStatus(caseGenStatus, '未找到可导出的用例，请检查勾选内容', 'warn');
        return;
      }
      try {
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var exported = await buildXmindPackageFromCases(aggregated, requirementLabel, requirementLabel);
        downloadBlob(exported.fileName, exported.blob);
        setStatus(caseGenStatus, '已导出选中用例为 XMind（' + exported.count + ' 条）', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, 'XMind 导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      }
    }

    function exportSelectedCasesData(selection, list, moduleTitle, requirementLabel) {
      if (!selection || !selection.size) throw new Error('未选中用例');
      if (!Array.isArray(list) || !list.length) throw new Error('当前模块没有可导出的用例');
      var selectedList = list.filter(function(_, idx) { return selection.has(idx); });
      if (!selectedList.length) throw new Error('请选择至少一条用例');
      var sanitized = sanitizeCasesForExport(selectedList);
      var name = moduleTitle || '模块';
      var payload = wrapDataWithRequirement({ module: name, cases: sanitized });
      var fileName = 'selected_' + getSafeRequirementSlug() + '_' + name + '_' + formatCompactTimestamp() + '.json';
      return { payload: payload, fileName: fileName, count: selectedList.length };
    }

    function exportAllModulesData(modules, caseGenResults, requirementLabel) {
      if (!Array.isArray(modules) || !modules.length) throw new Error('尚未生成任何用例，无法导出');
      var payload = modules.map(function(mod) {
        var raw = caseGenResults[mod.id] || '';
        var cases = [];
        try {
          cases = JSON.parse(raw || '[]');
        } catch (err) {
          cases = [];
        }
        return {
          module: normalizeRequirementName(mod.title || mod.module || ''),
          cases: sanitizeCasesForExport(cases),
        };
      });
      var fileName = 'usecases_' + getSafeRequirementSlug() + '_' + formatCompactTimestamp() + '.json';
      var count = payload.reduce(function(sum, mod) { return sum + (mod.cases ? mod.cases.length : 0); }, 0);
      return { payload: payload, fileName: fileName, count: count };
    }

    function exportSingleModuleData(mod, rawResult, requirementLabel) {
      if (!mod) throw new Error('未找到模块');
      var raw = rawResult || '';
      var parsed = [];
      try {
        parsed = JSON.parse(raw || '[]');
      } catch (err) {
        parsed = [];
      }
      if (!parsed.length) throw new Error('该模块尚未生成用例');
      var sanitized = sanitizeCasesForExport(parsed);
      var fileName = 'usecases_' + normalizeRequirementName(mod.title || mod.module || 'module') + '_' + formatCompactTimestamp();
      return { payload: sanitized, fileName: fileName, count: sanitized.length };
    }

    return {
      ensureCaseGenDrawer: ensureCaseGenDrawer,
      resetCaseViewButton: resetCaseViewButton,
      closeCaseViewIfActive: closeCaseViewIfActive,
      getCaseViewContainer: getCaseViewContainer,
      renderCaseGenWorkspaceMirrorTabs: renderCaseGenWorkspaceMirrorTabs,
      computeAppendTargetOptions: computeAppendTargetOptions,
      hasValidAppendTargetSelection: hasValidAppendTargetSelection,
      renderAppendTargetOptions: renderAppendTargetOptions,
      collectAdditionsForBuckets: collectAdditionsForBuckets,
      promptTempExecTarget: promptTempExecTarget,
      normalizeExecCaseList: normalizeExecCaseList,
      hasExecutionData: hasExecutionData,
      convertCaseForExec: convertCaseForExec,
      renderCaseTable: renderCaseTable,
      updateSupplementButtons: updateSupplementButtons,
      ensureCaseSelectionSet: ensureCaseSelectionSet,
      refreshCaseSelectionUI: refreshCaseSelectionUI,
      hasSelectedGeneratedCases: hasSelectedGeneratedCases,
      refreshAppendExistingButton: refreshAppendExistingButton,
      ensureCaseGenSelectionHintState: ensureCaseGenSelectionHintState,
      setCaseGenSelectionHint: setCaseGenSelectionHint,
      applyCaseGenSelectionHint: applyCaseGenSelectionHint,
      clearAllCaseGenSelectionHints: clearAllCaseGenSelectionHints,
      setCaseGenSelectionHintsForAllModules: setCaseGenSelectionHintsForAllModules,
      getCaseGenAllSelectionStats: getCaseGenAllSelectionStats,
      toggleCaseGenAllSelectButton: toggleCaseGenAllSelectButton,
      updateCaseGenAllSelectionButton: updateCaseGenAllSelectionButton,
      findFirstGeneratedModuleId: findFirstGeneratedModuleId,
      collectGeneratedModules: collectGeneratedModules,
      openCaseViewForModule: openCaseViewForModule,
      openCaseGenAllView: openCaseGenAllView,
      openCaseViewForSelectionHint: openCaseViewForSelectionHint,
      listCaseGenModulesMissingSelectionOrGeneration: listCaseGenModulesMissingSelectionOrGeneration,
      resolveCaseGenActiveDrawer: resolveCaseGenActiveDrawer,
      collectSelectedCaseEntries: collectSelectedCaseEntries,
      getCaseListForModule: getCaseListForModule,
      renderLegacyCaseGeneration: renderLegacyCaseGeneration,
      renderXmindModuleMirror: renderXmindModuleMirror,
      renderCaseGeneration: renderCaseGeneration,
      exportCaseGenerationResults: exportCaseGenerationResults,
      exportModuleCases: exportModuleCases,
      importModuleCases: importModuleCases,
      appendSelectedCasesToImported: appendSelectedCasesToImported,
      transferSelectedCasesToExec: transferSelectedCasesToExec,
      transferModuleToTempExec: transferModuleToTempExec,
      clearModuleCases: clearModuleCases,
      toggleCaseView: toggleCaseView,
      openXmindMirrorCaseView: openXmindMirrorCaseView,
      handleCaseSelectionChange: handleCaseSelectionChange,
      handleCaseSelectAll: handleCaseSelectAll,
      handleCaseSelectAllModules: handleCaseSelectAllModules,
      exportSelectedCases: exportSelectedCases,
      exportSelectedCasesToXmind: exportSelectedCasesToXmind,
      exportSelectedModulesToXmind: exportSelectedModulesToXmind,
      exportSelectedCasesData: exportSelectedCasesData,
      exportAllModulesData: exportAllModulesData,
      exportSingleModuleData: exportSingleModuleData,
    };
  }

  return { create: create };
});
