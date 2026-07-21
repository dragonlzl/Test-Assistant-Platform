(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.aiGenViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var ensureDrawer = typeof opts.ensureDrawer === 'function' ? opts.ensureDrawer : function() { return null; };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var escapeHtml = typeof opts.escapeHtml === 'function' ? opts.escapeHtml : function(value) {
      return value === null || value === undefined ? '' : String(value);
    };
    var escapeHtmlPreserve = typeof opts.escapeHtmlPreserve === 'function'
      ? opts.escapeHtmlPreserve
      : escapeHtml;
    var countModuleCases = typeof opts.countModuleCases === 'function'
      ? opts.countModuleCases
      : function() { return 0; };
    var countSelectableCases = typeof opts.countSelectableCases === 'function'
      ? opts.countSelectableCases
      : function() { return 0; };
    var normalizeCount = typeof opts.normalizeCount === 'function'
      ? opts.normalizeCount
      : function(value) {
        var number = Number(value);
        return isFinite(number) && number >= 0 ? Math.round(number) : null;
      };
    var drawerInstance = null;

    function syncCoverageColumn(hidden) {
      if (!dom.aiGenResultBody || !dom.aiGenResultBody.parentNode) return;
      var table = dom.aiGenResultBody.parentNode;
      if (!table || !table.querySelectorAll) return;
      var nodes = table.querySelectorAll('th.coverage');
      for (var i = 0; i < nodes.length; i += 1) {
        if (hidden) nodes[i].classList.add('hidden');
        else nodes[i].classList.remove('hidden');
      }
    }

    function syncResultSummary(ai) {
      if (!dom.aiGenResultSummary) return;
      var modules = ai && Array.isArray(ai.modules) ? ai.modules : [];
      if ((!ai || ai.generated !== true) && !countModuleCases(modules)) {
        dom.aiGenResultSummary.textContent = '';
        return;
      }
      var generatedCount = normalizeCount(ai ? ai.resultGeneratedCount : null);
      var dedupeCount = normalizeCount(ai ? ai.resultDedupeCount : null);
      dom.aiGenResultSummary.textContent = '生成 ' + (generatedCount === null ? 0 : generatedCount)
        + ' 条，去重 ' + (dedupeCount === null ? 0 : dedupeCount) + ' 条';
    }

    function syncSelection(ai, totalCount) {
      var selection = ai && ai.selection instanceof Set ? ai.selection : new Set();
      var count = selection.size;
      var modules = ai && Array.isArray(ai.modules) ? ai.modules : [];
      var total = typeof totalCount === 'number' ? totalCount : countSelectableCases(modules);
      if (dom.aiGenSelectionHint) {
        dom.aiGenSelectionHint.textContent = '已选 ' + count + (total ? (' / ' + total) : '') + ' 条';
      }
      if (dom.aiGenAppendBtn) dom.aiGenAppendBtn.disabled = !count;
      if (dom.aiGenSelectAllToggle) {
        dom.aiGenSelectAllToggle.checked = total > 0 && count === total;
      }
    }

    function renderResult(ai) {
      if (!dom.aiGenResult || !dom.aiGenResultBody) return;
      var modules = ai && Array.isArray(ai.modules) ? ai.modules : [];
      var selection = ai && ai.selection instanceof Set ? ai.selection : new Set();
      var rows = [];
      var selectableCases = 0;
      var hideCoverage = Boolean(ai && ai.generationMode === 'enhanced');
      syncCoverageColumn(hideCoverage);
      modules.forEach(function(mod) {
        var list = mod && Array.isArray(mod.cases) ? mod.cases : [];
        if (!list.length) return;
        list.forEach(function(item, idx) {
          var appended = item && item.__aiAppended === true;
          if (!appended) selectableCases += 1;
          var checked = selection.has(item.__aiKey) && !appended ? 'checked' : '';
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
              coverageCell = '<td class="coverage' + (mod.missing ? ' missing' : '')
                + '" rowspan="' + list.length + '">' + escapeHtml(coverageText) + '</td>';
            }
            moduleCell = '<td class="module" rowspan="' + list.length + '">'
              + escapeHtml(mod.module) + '</td>';
          }
          rows.push(
            '<tr>' +
              '<td class="check' + appendedClass + '"><input type="checkbox" data-case-lib-ai-select="'
                + escapeHtml(item.__aiKey) + '"' + appendedData + disabledAttr + ' ' + checked + '></td>' +
              coverageCell +
              moduleCell +
              '<td' + appendedAttr + '>' + escapeHtml(item.title) + '</td>' +
              '<td' + appendedAttr + '>' + escapeHtml(item.priority || '') + '</td>' +
              '<td' + appendedAttr + '>' + escapeHtmlPreserve(item.precondition || '') + '</td>' +
              '<td' + appendedAttr + '>' + escapeHtmlPreserve(item.steps || '') + '</td>' +
              '<td' + appendedAttr + '>' + escapeHtmlPreserve(item.expected || '') + '</td>' +
            '</tr>'
          );
        });
      });
      if (!rows.length) {
        dom.aiGenResultBody.innerHTML = '<tr><td colspan="' + (hideCoverage ? '7' : '8')
          + '"><p class="hint">暂无生成结果</p></td></tr>';
        if (dom.aiGenResult.classList) dom.aiGenResult.classList.add('hidden');
      } else {
        dom.aiGenResultBody.innerHTML = rows.join('');
        if (dom.aiGenResult.classList) dom.aiGenResult.classList.remove('hidden');
      }
      syncResultSummary(ai);
      syncSelection(ai, selectableCases);
    }

    function syncRunButton(viewState) {
      if (!dom.aiGenRunBtn) return;
      var next = viewState && typeof viewState === 'object' ? viewState : {};
      dom.aiGenRunBtn.disabled = Boolean(next.loading || !next.hasRequirement || next.disabledReason);
    }

    function syncFeatureButton(viewState) {
      var next = viewState && typeof viewState === 'object' ? viewState : {};
      var loading = next.loading === true;
      var reason = next.disabledReason ? String(next.disabledReason) : '';
      var showBadge = next.showBadge === true && !loading;
      if (dom.aiGenBtn) {
        var label = loading ? '正在生成' : 'AI 用例生成';
        if (dom.aiGenBtn.textContent !== label) dom.aiGenBtn.textContent = label;
        dom.aiGenBtn.disabled = false;
        if (dom.aiGenBtn.removeAttribute) dom.aiGenBtn.removeAttribute('disabled');
        if (dom.aiGenBtn.classList) {
          if (reason) dom.aiGenBtn.classList.add('is-disabled');
          else dom.aiGenBtn.classList.remove('is-disabled');
          if (loading) dom.aiGenBtn.classList.add('loading');
          else dom.aiGenBtn.classList.remove('loading');
          if (showBadge) dom.aiGenBtn.classList.add('has-badge');
          else dom.aiGenBtn.classList.remove('has-badge');
        }
        dom.aiGenBtn.setAttribute('data-disabled-reason', reason);
      }
      setXmindAvailable(next.canOpenXmind === true);
    }

    function syncNavBadge(visible) {
      if (!dom.editDrawerOpenBtn || !dom.editDrawerOpenBtn.classList) return;
      if (visible) dom.editDrawerOpenBtn.classList.add('case-library-ai-gen-dot');
      else dom.editDrawerOpenBtn.classList.remove('case-library-ai-gen-dot');
    }

    function setXmindAvailable(available) {
      if (dom.xmindViewBtn) dom.xmindViewBtn.disabled = available !== true;
    }

    function getRequirementText(fallback) {
      if (dom.aiGenRequirementInput) return dom.aiGenRequirementInput.value;
      return fallback === null || fallback === undefined ? '' : String(fallback);
    }

    function hasRequirementInput() {
      return Boolean(dom.aiGenRequirementInput);
    }

    function setRequirementText(value) {
      if (dom.aiGenRequirementInput) {
        dom.aiGenRequirementInput.value = value === null || value === undefined ? '' : String(value);
      }
    }

    function setRequirementFileName(value) {
      if (!dom.aiGenFileName) return;
      var text = value === null || value === undefined ? '' : String(value);
      dom.aiGenFileName.textContent = text || '未选择文件';
    }

    function setGenerationStatus(message, type) {
      setStatus(dom.aiGenStatus, message || '', type || '');
    }

    function setImportStatus(message, type) {
      setStatus(dom.aiGenImportStatus, message || '', type || '');
    }

    function setEditStatus(message, type) {
      setStatus(dom.editStatus, message || '', type || '');
    }

    function ensureAiGenDrawer(onOpen) {
      if (drawerInstance) return drawerInstance;
      drawerInstance = ensureDrawer('caseLibraryAiGenDrawer', [], onOpen);
      return drawerInstance;
    }

    function openDrawer(onOpen) {
      var drawer = ensureAiGenDrawer(onOpen);
      if (drawer && typeof drawer.open === 'function') {
        drawer.open();
        return;
      }
      if (dom.aiGenDrawer && dom.aiGenDrawer.classList) dom.aiGenDrawer.classList.add('open');
    }

    function closeDrawer(onOpen) {
      var drawer = ensureAiGenDrawer(onOpen);
      if (drawer && typeof drawer.close === 'function') {
        drawer.close();
        return;
      }
      if (dom.aiGenDrawer && dom.aiGenDrawer.classList) dom.aiGenDrawer.classList.remove('open');
    }

    function getDrawerReference() {
      return drawerInstance || dom.aiGenDrawer || null;
    }

    function hasNativeLabelTrigger(zone, input) {
      if (!zone || !input || !zone.tagName) return false;
      return zone.tagName.toLowerCase() === 'label' && zone.contains(input);
    }

    return {
      renderResult: renderResult,
      syncSelection: syncSelection,
      syncRunButton: syncRunButton,
      syncFeatureButton: syncFeatureButton,
      syncNavBadge: syncNavBadge,
      setXmindAvailable: setXmindAvailable,
      getRequirementText: getRequirementText,
      hasRequirementInput: hasRequirementInput,
      setRequirementText: setRequirementText,
      setRequirementFileName: setRequirementFileName,
      setGenerationStatus: setGenerationStatus,
      setImportStatus: setImportStatus,
      setEditStatus: setEditStatus,
      openDrawer: openDrawer,
      closeDrawer: closeDrawer,
      getDrawerReference: getDrawerReference,
      hasNativeLabelTrigger: hasNativeLabelTrigger,
    };
  }

  return { create: create };
});
