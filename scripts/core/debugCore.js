(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var debugNodes = ctx.debugNodes || {};
    var dom = ctx.dom || {};
    var handlers = ctx.handlers || {};
    var utils = ctx.utils || {};
    var skipAutoBind = ctx.skipAutoBind;

    var setStatus = handlers.setStatus || utils.setStatus || function() {};
    var downloadText = utils.downloadText || function() {};
    var extractRequirementLabelFromText = handlers.extractRequirementLabelFromText || function() { return ''; };
    var promptRequirementLabel = handlers.promptRequirementLabel || function() { return ''; };
    var wrapTextWithRequirement = handlers.wrapTextWithRequirement || function(text) { return text; };
    var renderAutoRawInfo = handlers.renderAutoRawInfo || function() {};
    var renderCleanView = handlers.renderCleanView || function() {};
    var renderCleanRawView = handlers.renderCleanRawView || function() {};
    var renderCaseGeneration = handlers.renderCaseGeneration || function() {};
    var renderCaseGenProgressBoard = handlers.renderCaseGenProgressBoard || function() {};
    var refreshMissingSmartFillButton = handlers.refreshMissingSmartFillButton || function() {};
    var syncCaseTextWithImports = handlers.syncCaseTextWithImports || function() {};
    var renderImportedCaseList = handlers.renderImportedCaseList || function() {};
    var resetImportedCaseView = handlers.resetImportedCaseView || function() {};
    var setCaseViewHint = handlers.setCaseViewHint || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var setRequirementLabel = handlers.setRequirementLabel || function() {};
    var getRequirementLabel = handlers.getRequirementLabel || function() { return ''; };
    var stripRequirementHeader = handlers.stripRequirementHeader || function(text) {
      if (!text) return '';
      var lines = text.split(/\r?\n/);
      if (lines.length && /^#需求标识：/.test(lines[0].trim())) {
        return lines.slice(1).join('\n');
      }
      return text;
    };
    var stripCodeFence = utils.stripCodeFence || function(text) { return text || ''; };

    var casesCoverageStatus = dom.casesCoverageStatus;
    var caseGenStatus = dom.caseGenStatus;
    var splitResultEl = dom.splitResultEl;
    var saveRawDebugBtn = dom.saveRawDebugBtn;
    var importRawDebugBtn = dom.importRawDebugBtn;
    var rawDebugFileInput = dom.rawDebugFileInput;
    var saveCleanDebugBtn = dom.saveCleanDebugBtn;
    var importCleanDebugBtn = dom.importCleanDebugBtn;
    var cleanDebugFileInput = dom.cleanDebugFileInput;
    var saveSplitDebugBtn = dom.saveSplitDebugBtn;
    var importSplitDebugBtn = dom.importSplitDebugBtn;
    var splitDebugFileInput = dom.splitDebugFileInput;
    var saveCaseDebugBtn = dom.saveCaseDebugBtn;
    var importCaseDebugBtn = dom.importCaseDebugBtn;
    var caseDebugFileInput = dom.caseDebugFileInput;

    function normalizeResponseContent(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value.trim();
      if (Array.isArray(value)) {
        var joined = value.map(function(part) { return normalizeResponseContent(part); }).filter(Boolean).join('\n').trim();
        return joined;
      }
      if (typeof value === 'object') {
        var directKeys = ['text', 'content', 'value', 'output_text', 'response', 'result'];
        for (var i = 0; i < directKeys.length; i += 1) {
          var key = directKeys[i];
          if (value[key]) {
            var normalized = normalizeResponseContent(value[key]);
            if (normalized) return normalized;
          }
        }
        if (Array.isArray(value.parts)) {
          var parts = normalizeResponseContent(value.parts);
          if (parts) return parts;
        }
        if (Array.isArray(value.messages)) {
          var msgs = normalizeResponseContent(value.messages);
          if (msgs) return msgs;
        }
        if (Array.isArray(value.responses)) {
          var resps = normalizeResponseContent(value.responses);
          if (resps) return resps;
        }
        if (value.delta && typeof value.delta === 'object') {
          var delta = normalizeResponseContent(value.delta);
          if (delta) return delta;
        }
      }
      return '';
    }

    function buildDebugContent(tag, text) {
      var normalized = normalizeResponseContent(text);
      var body = normalized || text || '';
      return '#NODE:' + tag + '\n' + body;
    }

    function ensureRequirementLabelForDebug(promptText) {
      var current = typeof getRequirementLabel === 'function' ? getRequirementLabel(false) : '';
      if (current) return current;
      if (typeof promptRequirementLabel === 'function') {
        var prompted = promptRequirementLabel(promptText || '请输入本次需求标识后再导入数据');
        if (prompted) return prompted;
      }
      return '';
    }

    function wrapWithRequirementIfNeeded(type, text) {
      var trimmed = text && text.trim ? text.trim() : '';
      if (!trimmed) return '';
      var needsWrap = type === 'cleaned' || type === 'split' || type === 'cases';
      if (!needsWrap) return trimmed;
      var ensured = ensureRequirementLabelForDebug('请输入本次需求标识后再保存调试数据');
      if (!ensured) return '';
      if (typeof setRequirementLabel === 'function') {
        setRequirementLabel(ensured, 'debug-save');
      }
      var wrapType = type === 'cleaned' ? 'clean' : type;
      var normalized = stripCodeFence(stripRequirementHeader(trimmed));
      try {
        var parsed = JSON.parse(normalized);
        return JSON.stringify({ requirement: ensured, data: parsed, type: wrapType }, null, 2);
      } catch (err) {
        try {
          var patchedNormalized = normalized.replace(/}\\s*,\\s*\"/g, '],\n  \"');
          var patchedParsed = JSON.parse(patchedNormalized);
          return JSON.stringify({ requirement: ensured, data: patchedParsed, type: wrapType }, null, 2);
        } catch (err2) {
          // ignore and fall back
        }
      }
      if (typeof wrapTextWithRequirement !== 'function') return trimmed;
      return wrapTextWithRequirement(trimmed, wrapType);
    }

    function saveDebugText(type) {
      var cfg = debugNodes[type];
      if (!cfg) return;
      var text = cfg.textarea && cfg.textarea.value ? cfg.textarea.value.trim() : '';
      if (!text) {
        setStatus(cfg.status, cfg.label + '为空，无法保存调试文件', 'warn');
        return;
      }
      if (type === 'cleaned' || type === 'split' || type === 'cases') {
        text = wrapWithRequirementIfNeeded(type, text);
        if (!text) {
          setStatus(cfg.status, '已取消保存（需求标识为空）', 'warn');
          return;
        }
      }
      var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      downloadText('debug_' + cfg.tag + '_' + stamp + '.txt', buildDebugContent(cfg.tag, text));
      setStatus(cfg.status, '已保存' + cfg.label + '调试 TXT', 'ok');
    }

    async function importDebugText(type, file) {
      var cfg = debugNodes[type];
      if (!cfg || !file) return;
      try {
        var text = await file.text();
        var lines = text.split('\n');
        var firstLine = lines[0];
        var rest = lines.slice(1);
        if (!(firstLine && firstLine.indexOf('#NODE:') === 0)) {
          setStatus(cfg.status, '调试 TXT 缺少节点标识，无法导入', 'err');
          return;
        }
        var tag = firstLine.replace('#NODE:', '').trim();
        if (tag !== cfg.tag) {
          setStatus(cfg.status, '标识为 ' + tag + '，与 ' + cfg.label + ' 不匹配', 'err');
          return;
        }
        var payload = rest.join('\n');
        var requirementFromPayload = extractRequirementLabelFromText(payload);
        var candidateRequirement = requirementFromPayload || ensureRequirementLabelForDebug('请输入本次需求标识后再导入数据');
        if (!candidateRequirement) {
          setStatus(cfg.status, '已取消导入（需求标识为空）', 'warn');
          return;
        }
        if (type === 'cleaned' || type === 'split' || type === 'cases') {
          if (requirementFromPayload) {
            setRequirementLabel(requirementFromPayload, 'import');
          } else if (typeof setRequirementLabel === 'function') {
            setRequirementLabel(candidateRequirement, 'import');
          }
        }
        cfg.textarea.value = type === 'cleaned' || type === 'split' || type === 'cases'
          ? wrapWithRequirementIfNeeded(type, payload)
          : payload.trim();
        if (type === 'raw') {
          state.lastRawImportName = '';
          renderAutoRawInfo();
        }
        if (type === 'cleaned') {
          state.cleanEntries = [];
          state.cleanViewSelection = -1;
          state.cleanHighlightAll = false;
          state.cleanActiveHighlights = {};
          renderCleanView();
          renderCleanRawView(null);
        }
        if (type === 'split') {
          state.caseGenModules = [];
          state.caseGenResults = {};
          state.caseGenSource = '';
          state.caseGenModuleStatus = {};
          state.caseGenProgress = {};
          state.caseGenRunning = new Set();
          renderCaseGeneration();
          renderCaseGenProgressBoard();
          setStatus(casesCoverageStatus, '', '');
          setStatus(caseGenStatus, '', '');
          refreshMissingSmartFillButton();
          if (splitResultEl && typeof splitResultEl.dispatchEvent === 'function') {
            splitResultEl.dispatchEvent(new Event('input'));
          }
        }
        if (type === 'cases') {
          state.importedCases = [];
          renderImportedCaseList();
          resetImportedCaseView();
          syncCaseTextWithImports();
          if (payload.trim()) {
            setCaseViewHint('');
          } else {
            setCaseViewHint('请先上传或输入 XMind 测试用例');
          }
        }
        setStatus(cfg.status, '已从调试 TXT 导入' + cfg.label, 'ok');
        updateFlowStatus();
      } catch (err) {
        console.error(err);
        setStatus(cfg.status, '导入失败：' + err.message, 'err');
      }
    }

    function bindDebugControls(type, saveBtn, importBtn, fileInput) {
      if (saveBtn) saveBtn.addEventListener('click', function() { saveDebugText(type); });
      if (importBtn && fileInput) {
        importBtn.addEventListener('click', function() { fileInput.click(); });
        fileInput.addEventListener('change', function(e) {
          var files = e.target && e.target.files;
          var file = files && files[0];
          if (file) importDebugText(type, file);
          fileInput.value = '';
        });
      }
    }

    if (!skipAutoBind) {
      [
        { type: 'raw', saveBtn: saveRawDebugBtn, importBtn: importRawDebugBtn, fileInput: rawDebugFileInput },
        { type: 'cleaned', saveBtn: saveCleanDebugBtn, importBtn: importCleanDebugBtn, fileInput: cleanDebugFileInput },
        { type: 'split', saveBtn: saveSplitDebugBtn, importBtn: importSplitDebugBtn, fileInput: splitDebugFileInput },
        { type: 'cases', saveBtn: saveCaseDebugBtn, importBtn: importCaseDebugBtn, fileInput: caseDebugFileInput },
      ].forEach(function(cfg) {
        if (cfg && cfg.type) bindDebugControls(cfg.type, cfg.saveBtn, cfg.importBtn, cfg.fileInput);
      });
    }

    return {
      saveDebugText: saveDebugText,
      importDebugText: importDebugText,
      bindDebugControls: bindDebugControls,
      buildDebugContent: buildDebugContent,
    };
  }

  window.app = window.app || {};
  window.app.debugCore = { init: init };
})();
