(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecAiGenViewOwner = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var model = opts.model || null;
    var document = opts.document || null;
    var windowObject = opts.window || null;
    var escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : function(value) { return value === null || value === undefined ? '' : String(value); };
    var escapeHtmlPreserve = typeof opts.escapeHtmlPreserve === 'function'
      ? opts.escapeHtmlPreserve
      : function(value) { return escapeHtml(value).replace(/\n/g, '<br/>'); };
    var getState = typeof opts.getState === 'function'
      ? opts.getState
      : function() {
        if (model && typeof model.ensureState === 'function') {
          var host = { aiGen: state.tempExecAiGen };
          var next = model.ensureState(host);
          state.tempExecAiGen = next;
          return next;
        }
        return state.tempExecAiGen || {};
      };
    var callbacks = opts.callbacks && typeof opts.callbacks === 'object' ? opts.callbacks : {};
    var onDrawerOpen = typeof callbacks.onDrawerOpen === 'function' ? callbacks.onDrawerOpen : function() {};
    var drawerInstance = null;
    var dom = {
      button: getElement('tempExecAiGenBtn'),
      drawer: getElement('tempExecAiGenDrawer'),
      dropZone: getElement('tempExecAiGenDropZone'),
      fileInput: getElement('tempExecAiGenFileInput'),
      fileName: getElement('tempExecAiGenFileName'),
      importStatus: getElement('tempExecAiGenImportStatus'),
      requirementInput: getElement('tempExecAiGenRequirementInput'),
      clearRequirementBtn: getElement('tempExecAiGenClearRequirement'),
      runBtn: getElement('tempExecAiGenRunBtn'),
      status: getElement('tempExecAiGenStatus'),
      result: getElement('tempExecAiGenResult'),
      resultBody: getElement('tempExecAiGenResultBody'),
      selectAllBtn: getElement('tempExecAiGenSelectAllBtn'),
      selectNoneBtn: getElement('tempExecAiGenSelectNoneBtn'),
      discardBtn: getElement('tempExecAiGenDiscardBtn'),
      regenerateBtn: getElement('tempExecAiGenRegenerateBtn'),
      resultSummary: getElement('tempExecAiGenResultSummary'),
      selectionHint: getElement('tempExecAiGenSelectionHint'),
      selectAllToggle: getElement('tempExecAiGenSelectAllToggle'),
      appendBtn: getElement('tempExecAiGenAppendBtn'),
      assignDrawerBtn: getElement('openTempExecAssignDrawerBtn'),
    };

    function getElement(id) {
      return document && typeof document.getElementById === 'function'
        ? document.getElementById(id)
        : null;
    }

    function syncCoverageColumn(hidden) {
      if (!dom.resultBody || !dom.resultBody.parentNode) return;
      var table = dom.resultBody.parentNode;
      if (!table || typeof table.querySelectorAll !== 'function') return;
      var nodes = table.querySelectorAll('th.coverage');
      for (var i = 0; i < nodes.length; i += 1) {
        if (hidden) nodes[i].classList.add('hidden');
        else nodes[i].classList.remove('hidden');
      }
    }

    function syncResultSummary() {
      var ai = getState();
      if (!dom.resultSummary || !model) return;
      if (!ai.generated && !model.countModuleCases(ai.modules)) {
        dom.resultSummary.textContent = '';
        return;
      }
      dom.resultSummary.textContent = model.formatResultStats(ai);
    }

    function getTotalCount() {
      var ai = getState();
      return model ? model.countSelectableCases(ai.modules) : 0;
    }

    function syncSelectionHint(totalCount) {
      var ai = getState();
      var selection = ai.selection instanceof Set ? ai.selection : new Set();
      var count = selection.size;
      var total = typeof totalCount === 'number' ? totalCount : getTotalCount();
      if (dom.selectionHint) {
        dom.selectionHint.textContent = '已选 ' + count + (total ? (' / ' + total) : '') + ' 条';
      }
      if (dom.appendBtn) dom.appendBtn.disabled = !count;
      if (dom.selectAllToggle) dom.selectAllToggle.checked = total > 0 && count === total;
    }

    function renderResult() {
      var ai = getState();
      if (!dom.result || !dom.resultBody || !model) return;
      var modules = Array.isArray(ai.modules) ? ai.modules : [];
      var rows = [];
      var selection = ai.selection instanceof Set ? ai.selection : new Set();
      var selectableCases = 0;
      var hideCoverage = ai.generationMode === 'enhanced';
      syncCoverageColumn(hideCoverage);
      modules.forEach(function(mod) {
        var list = Array.isArray(mod.cases) ? mod.cases : [];
        if (!list.length) return;
        list.forEach(function(item, idx) {
          var appended = item && item.__aiAppended === true;
          if (!appended) selectableCases += 1;
          var checked = selection.has(item.__aiKey) && !appended ? 'checked' : '';
          if (appended && selection.has(item.__aiKey)) selection.delete(item.__aiKey);
          var appendedClass = appended ? ' ai-gen-appended-cell' : '';
          var appendedAttr = appended ? ' class="ai-gen-appended-cell"' : '';
          var appendedData = appended ? ' data-ai-appended="1"' : '';
          var disabledAttr = appended ? ' disabled' : '';
          var coverageText = mod.missing
            ? '缺失'
            : (isFinite(Number(mod.coverage)) ? String(Math.round(Number(mod.coverage))) + '%' : '--');
          var coverageCell = '';
          var moduleCell = '';
          if (idx === 0) {
            if (!hideCoverage) {
              coverageCell = '<td class="coverage' + (mod.missing ? ' missing' : '') + '" rowspan="' + list.length + '">' + escapeHtml(coverageText) + '</td>';
            }
            moduleCell = '<td class="module" rowspan="' + list.length + '">' + escapeHtml(mod.module) + '</td>';
          }
          rows.push(
            '<tr>' +
              '<td class="check' + appendedClass + '"><input type="checkbox" data-temp-exec-ai-select="' + escapeHtml(item.__aiKey) + '"' + appendedData + disabledAttr + ' ' + checked + '></td>' +
              coverageCell +
              moduleCell +
              '<td' + appendedAttr + '>' + escapeHtml(item.title) + '</td>' +
              '<td' + appendedAttr + '>' + escapeHtml(item.priority || '') + '</td>' +
              '<td' + appendedAttr + '>' + escapeHtmlPreserve(item.preconditions || '') + '</td>' +
              '<td' + appendedAttr + '>' + escapeHtmlPreserve(item.steps || '') + '</td>' +
              '<td' + appendedAttr + '>' + escapeHtmlPreserve(item.expected || '') + '</td>' +
            '</tr>'
          );
        });
      });
      if (!rows.length) {
        dom.resultBody.innerHTML = '<tr><td colspan="' + (hideCoverage ? '7' : '8') + '"><p class="hint">暂无生成结果</p></td></tr>';
        if (dom.result.classList) dom.result.classList.add('hidden');
      } else {
        dom.resultBody.innerHTML = rows.join('');
        if (dom.result.classList) dom.result.classList.remove('hidden');
      }
      syncResultSummary();
      syncSelectionHint(selectableCases);
    }

    function selectAll() {
      var ai = getState();
      ai.selection = model ? model.buildSelection(ai.modules) : new Set();
      renderResult();
      syncSelectionHint(ai.selection.size);
    }

    function clearSelection() {
      var ai = getState();
      ai.selection = new Set();
      renderResult();
      syncSelectionHint(0);
    }

    function setSelection(key, checked) {
      if (!key) return;
      var ai = getState();
      ai.selection = ai.selection instanceof Set ? ai.selection : new Set();
      if (checked) ai.selection.add(key);
      else ai.selection.delete(key);
      syncSelectionHint(getTotalCount());
    }

    function ensureDrawer(onOpen) {
      if (drawerInstance) return drawerInstance;
      if (!windowObject || !windowObject.app || !windowObject.app.drawer
        || typeof windowObject.app.drawer.createDrawer !== 'function') return null;
      drawerInstance = windowObject.app.drawer.createDrawer({
        drawerId: 'tempExecAiGenDrawer',
        openButtons: [],
        closeButtons: [],
        onOpen: typeof onOpen === 'function' ? onOpen : onDrawerOpen,
      });
      return drawerInstance;
    }

    function openDrawer(onOpen) {
      var drawer = ensureDrawer(onOpen);
      if (drawer && typeof drawer.open === 'function') {
        drawer.open();
        return;
      }
      if (dom.drawer && dom.drawer.classList) dom.drawer.classList.add('open');
    }

    function closeDrawer() {
      var drawer = ensureDrawer();
      if (drawer && typeof drawer.close === 'function') {
        drawer.close();
        return;
      }
      if (dom.drawer && dom.drawer.classList) dom.drawer.classList.remove('open');
    }

    function getDrawerReference() {
      return drawerInstance || dom.drawer || null;
    }

    function hasNativeLabelTrigger(zone, input) {
      if (!zone || !input || !zone.tagName) return false;
      return zone.tagName.toLowerCase() === 'label' && zone.contains(input);
    }

    function bindEvents() {
      if (dom.button) dom.button.addEventListener('click', function() {
        if (typeof callbacks.onOpen === 'function') callbacks.onOpen();
      });
      if (dom.fileInput) dom.fileInput.addEventListener('change', function(event) {
        var files = event && event.target && event.target.files ? event.target.files : null;
        var file = files && files[0] ? files[0] : null;
        if (file && typeof callbacks.onFile === 'function') callbacks.onFile(file);
        try { event.target.value = ''; } catch (_) {}
      });
      if (dom.dropZone) {
        dom.dropZone.addEventListener('click', function() {
          if (!dom.fileInput || hasNativeLabelTrigger(dom.dropZone, dom.fileInput)) return;
          dom.fileInput.click();
        });
        dom.dropZone.addEventListener('dragover', function(event) {
          event.preventDefault();
          dom.dropZone.classList.add('dragover');
        });
        dom.dropZone.addEventListener('dragleave', function() {
          dom.dropZone.classList.remove('dragover');
        });
        dom.dropZone.addEventListener('drop', function(event) {
          event.preventDefault();
          dom.dropZone.classList.remove('dragover');
          var files = event.dataTransfer ? event.dataTransfer.files : null;
          if (files && files[0] && typeof callbacks.onFile === 'function') callbacks.onFile(files[0]);
        });
      }
      if (dom.requirementInput) dom.requirementInput.addEventListener('input', function() {
        if (typeof callbacks.onRequirementChange === 'function') callbacks.onRequirementChange(dom.requirementInput.value || '');
      });
      if (dom.clearRequirementBtn) dom.clearRequirementBtn.addEventListener('click', function() {
        if (typeof callbacks.onClearRequirement === 'function') callbacks.onClearRequirement();
      });
      if (dom.runBtn) dom.runBtn.addEventListener('click', function() {
        if (typeof callbacks.onRun === 'function') callbacks.onRun();
      });
      if (dom.selectAllBtn) dom.selectAllBtn.addEventListener('click', selectAll);
      if (dom.selectNoneBtn) dom.selectNoneBtn.addEventListener('click', clearSelection);
      if (dom.discardBtn) dom.discardBtn.addEventListener('click', function() {
        if (typeof callbacks.onDiscard === 'function') callbacks.onDiscard();
      });
      if (dom.regenerateBtn) dom.regenerateBtn.addEventListener('click', function() {
        if (typeof callbacks.onRegenerate === 'function') callbacks.onRegenerate();
      });
      if (dom.selectAllToggle) dom.selectAllToggle.addEventListener('change', function() {
        if (dom.selectAllToggle.checked) selectAll();
        else clearSelection();
      });
      if (dom.result) dom.result.addEventListener('change', function(event) {
        var target = event && event.target ? event.target : null;
        if (!target || !target.getAttribute) return;
        var key = target.getAttribute('data-temp-exec-ai-select');
        if (!key) return;
        if (target.getAttribute('data-ai-appended') === '1') {
          target.checked = false;
          return;
        }
        setSelection(key, target.checked);
        if (typeof callbacks.onSelectionChange === 'function') callbacks.onSelectionChange(key, target.checked);
      });
      if (dom.appendBtn) dom.appendBtn.addEventListener('click', function() {
        if (typeof callbacks.onAppend === 'function') callbacks.onAppend(dom.appendBtn);
      });
    }

    return {
      dom: dom,
      renderResult: renderResult,
      syncResultSummary: syncResultSummary,
      getTotalCount: getTotalCount,
      syncSelectionHint: syncSelectionHint,
      selectAll: selectAll,
      clearSelection: clearSelection,
      setSelection: setSelection,
      ensureDrawer: ensureDrawer,
      openDrawer: openDrawer,
      closeDrawer: closeDrawer,
      getDrawerReference: getDrawerReference,
      bindEvents: bindEvents,
    };
  }

  return { create: create };
});
