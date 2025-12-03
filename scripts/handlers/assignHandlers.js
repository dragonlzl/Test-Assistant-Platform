(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var defaultPrompts = ctx.defaultPrompts || {};
    var storageKey = ctx.storageKey || 'usecase-default-prompts';
    var setStatus = ctx.setStatus || function noopSetStatus() {};
    var downloadText = ctx.downloadText || function noopDownload() {};
    var dom = ctx.dom || {};
    var saveDefaultPromptsBtn = dom.saveDefaultPromptsBtn;
    var exportDefaultPromptsBtn = dom.exportDefaultPromptsBtn;
    var importDefaultPromptsBtn = dom.importDefaultPromptsBtn;
    var importDefaultPromptsFile = dom.importDefaultPromptsFile;
    if (!state.assignments || typeof state.assignments !== 'object') {
      state.assignments = {};
    }
    var assignments = state.assignments;

    function getStatusEl() {
      return dom.defaultPromptStatus || null;
    }

    function setInputValue(el, value) {
      if (!el) return;
      el.value = value;
    }

    function capturePromptValue(el, assignmentValue, fallback) {
      var direct = el && typeof el.value === 'string' ? el.value.trim() : '';
      if (direct) return direct;
      var stateValue = assignmentValue && typeof assignmentValue === 'string' ? assignmentValue.trim() : '';
      if (stateValue) return stateValue;
      var fallbackValue = fallback && typeof fallback === 'string' ? fallback.trim() : '';
      return fallbackValue;
    }

    function buildCurrentPromptSnapshot() {
      return {
        system: capturePromptValue(dom.cleanPromptEl, assignments.cleanPrompt, defaultPrompts.system),
        review: capturePromptValue(dom.reviewPromptEl, assignments.reviewPrompt, defaultPrompts.review),
        compare: capturePromptValue(dom.comparePromptEl, assignments.comparePrompt, defaultPrompts.compare),
        split: capturePromptValue(dom.splitPromptEl, assignments.splitPrompt, defaultPrompts.split),
        cases: capturePromptValue(dom.casesPromptEl, assignments.casesPrompt, defaultPrompts.cases),
        casegen: capturePromptValue(dom.caseGenPromptEl, assignments.caseGenPrompt, defaultPrompts.casegen),
        casefilter: capturePromptValue(dom.caseFilterPromptEl, assignments.caseFilterPrompt, defaultPrompts.casefilter),
      };
    }

    function persistDefaultPrompts(snapshot) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch (err) {
        console.warn('默认提示词保存失败', err);
      }
    }

    function applyDefaultPromptsOverride(source, persist, updateInputs) {
      if (!source || typeof source !== 'object') return false;
      var changed = false;
      ['system', 'review', 'compare', 'split', 'cases', 'casegen', 'casefilter'].forEach(function(key) {
        if (typeof source[key] === 'string' && source[key].trim()) {
          defaultPrompts[key] = source[key];
          changed = true;
        }
      });
      if (changed && persist) {
        persistDefaultPrompts({
          system: defaultPrompts.system,
          review: defaultPrompts.review,
          compare: defaultPrompts.compare,
          split: defaultPrompts.split,
          cases: defaultPrompts.cases,
          casegen: defaultPrompts.casegen,
          casefilter: defaultPrompts.casefilter,
        });
      }
      if (changed && updateInputs) {
        assignments.cleanPrompt = defaultPrompts.system;
        assignments.reviewPrompt = defaultPrompts.review;
        assignments.comparePrompt = defaultPrompts.compare;
        assignments.splitPrompt = defaultPrompts.split;
        assignments.casesPrompt = defaultPrompts.cases;
        assignments.caseGenPrompt = defaultPrompts.casegen;
        assignments.caseFilterPrompt = defaultPrompts.casefilter;
        setInputValue(dom.cleanPromptEl, assignments.cleanPrompt);
        setInputValue(dom.reviewPromptEl, assignments.reviewPrompt);
        setInputValue(dom.comparePromptEl, assignments.comparePrompt);
        setInputValue(dom.splitPromptEl, assignments.splitPrompt);
        setInputValue(dom.casesPromptEl, assignments.casesPrompt);
        setInputValue(dom.caseGenPromptEl, assignments.caseGenPrompt);
        if (dom.caseFilterPromptEl) setInputValue(dom.caseFilterPromptEl, assignments.caseFilterPrompt);
      }
      return changed;
    }

    function loadCustomDefaultPrompts() {
      try {
        var saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
        applyDefaultPromptsOverride(saved);
      } catch (err) {
        console.warn('自定义默认提示词加载失败', err);
      }
    }

    function saveDefaultPrompts() {
      var snapshot = buildCurrentPromptSnapshot();
      if (!applyDefaultPromptsOverride(snapshot, true)) {
        setStatus(getStatusEl(), '提示词未发生变化，无需更新默认值', 'warn');
        return;
      }
      var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      downloadText('default_prompts_' + stamp + '.json', JSON.stringify(snapshot, null, 2));
      setStatus(getStatusEl(), '已将当前提示词设为默认，并导出 JSON 供其他环境导入', 'ok');
    }

    function exportDefaultPrompts() {
      var payload = JSON.stringify({
        system: defaultPrompts.system,
        review: defaultPrompts.review,
        compare: defaultPrompts.compare,
        split: defaultPrompts.split,
        cases: defaultPrompts.cases,
        casegen: defaultPrompts.casegen,
        casefilter: defaultPrompts.casefilter,
      }, null, 2);
      var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      downloadText('default_prompts_' + stamp + '.json', payload);
      setStatus(getStatusEl(), '默认提示词已导出', 'ok');
    }

    async function importDefaultPrompts(file) {
      if (!file) return;
      try {
        var text = await file.text();
        var data = JSON.parse(text);
        var changed = applyDefaultPromptsOverride(data, true, true);
        if (!changed) {
          setStatus(getStatusEl(), '导入文件未包含有效提示词', 'warn');
          return;
        }
        setStatus(getStatusEl(), '已导入默认提示词并应用到当前界面', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(getStatusEl(), '导入失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      }
    }

    if (saveDefaultPromptsBtn && typeof saveDefaultPrompts === 'function') {
      saveDefaultPromptsBtn.addEventListener('click', function() { saveDefaultPrompts(); });
    }
    if (exportDefaultPromptsBtn && typeof exportDefaultPrompts === 'function') {
      exportDefaultPromptsBtn.addEventListener('click', function() { exportDefaultPrompts(); });
    }
    if (importDefaultPromptsBtn && importDefaultPromptsFile && typeof importDefaultPrompts === 'function') {
      importDefaultPromptsBtn.addEventListener('click', function() { importDefaultPromptsFile.click(); });
      importDefaultPromptsFile.addEventListener('change', async function(event) {
        var file = event.target && event.target.files && event.target.files[0];
        event.target.value = '';
        if (file) await importDefaultPrompts(file);
      });
    }

    return {
      loadCustomDefaultPrompts: loadCustomDefaultPrompts,
      applyDefaultPromptsOverride: applyDefaultPromptsOverride,
      buildCurrentPromptSnapshot: buildCurrentPromptSnapshot,
      saveDefaultPrompts: saveDefaultPrompts,
      exportDefaultPrompts: exportDefaultPrompts,
      importDefaultPrompts: importDefaultPrompts,
    };
  }

  window.app = window.app || {};
  window.app.assignHandlers = { init: init };
})();
