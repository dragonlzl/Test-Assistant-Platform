(function() {
  function init(ctx) {
    ctx = ctx || {};
    var deps = ctx.deps || ctx;
    var extractJsonObjects = deps && deps.extractJsonObjects ? deps.extractJsonObjects : function() { return []; };
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var handlers = ctx.handlers || {};
    var utils = ctx.utils || {};
    var escapeHtml = utils.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var setStatus = handlers.setStatus || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var refreshImportedCaseView = handlers.refreshImportedCaseView || function() {};
    var renderCaseTable = handlers.renderCaseTable || function() { return ''; };
    var caseFileListEl = dom.caseFileListEl;
    var autoCaseFileListEl = dom.autoCaseFileListEl;
    var caseTextEl = dom.caseTextEl;
    var caseViewContainer = dom.caseViewContainer;
    var caseViewBtn = dom.caseViewBtn;
    var caseViewHint = dom.caseViewHint;
    var caseViewDrawerBody = dom.caseViewDrawerBody;
    var caseViewDrawerTitle = dom.caseViewDrawerTitle;
    var caseViewDrawer = null;

    function setCaseViewHint(text) {
      if (handlers.setCaseViewHint) {
        handlers.setCaseViewHint(text);
        return;
      }
      if (!caseViewHint) return;
      caseViewHint.textContent = text;
      caseViewHint.classList.toggle('hidden', !text);
    }

    function parseCaseList(text) {
      if (!text || typeof text !== 'string') return [];
      var trimmed = text.trim();
      if (!trimmed) return [];
      var codeMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i);
      var primary = codeMatch ? codeMatch[1].trim() : trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      var snippets = [primary];
      var arraySlice = (function() {
        var start = primary.indexOf('[');
        var end = primary.lastIndexOf(']');
        return start >= 0 && end > start ? primary.slice(start, end + 1) : '';
      })();
      var objectSlice = (function() {
        var start = primary.indexOf('{');
        var end = primary.lastIndexOf('}');
        return start >= 0 && end > start ? primary.slice(start, end + 1) : '';
      })();
      if (arraySlice && arraySlice !== primary) snippets.push(arraySlice.trim());
      if (objectSlice && objectSlice !== primary) snippets.push(objectSlice.trim());
      for (var i = 0; i < snippets.length; i += 1) {
        var snippet = snippets[i];
        if (!snippet) continue;
        try {
          var data = JSON.parse(snippet);
          var casesField = data && data.cases;
          var dataField = data && data.data;
          var arr = Array.isArray(data)
            ? data
            : Array.isArray(casesField)
            ? casesField
            : Array.isArray(dataField)
            ? dataField
            : [];
          if (arr.length) {
            return arr.filter(function(item) { return item && typeof item === 'object'; });
          }
        } catch (err) {
          continue;
        }
      }
      var recovered = extractJsonObjects(primary);
      if (recovered.length) return recovered;
      console.warn('用例 JSON 解析失败', text);
      return [];
    }

    function parseIndentedXmindCases(text) {
      var lines = text.split(/\r?\n/);
      var stack = [];
      var results = [];
      lines.forEach(function(raw) {
        var line = raw.replace(/\t/g, '  ');
        var match = line.match(/^(\s*)[-\u2022]\s*(.+)$/);
        if (!match) return;
        var depth = Math.max(0, Math.floor(match[1].length / 2));
        var value = match[2].trim();
        if (!value) return;
        stack[depth] = value;
        stack.length = depth + 1;
        if (stack.length >= 6) {
          var trimmed = stack.slice(-6);
          results.push({
            module: trimmed[0] || '',
            title: trimmed[1] || '',
            priority: trimmed[2] || '',
            preconditions: trimmed[3] || '',
            steps: trimmed[4] || '',
            expected: trimmed[5] || '',
          });
        }
      });
      return results;
    }

    function deriveCaseListFromText(text) {
      if (!text) return [];
      var list = parseCaseList(text);
      if (list.length) return list;
      return parseIndentedXmindCases(text);
    }

    async function importCaseFiles(fileList) {
      var files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) return;
      if (setStatus && dom.caseStatus) setStatus(dom.caseStatus, '正在解析测试用例...', '');
      if (handlers.setStepInProgress) handlers.setStepInProgress('cases-upload');
      try {
        for (var i = 0; i < files.length; i += 1) {
          var file = files[i];
          var ext = (file.name.split('.').pop() || '').toLowerCase();
          var text = '';
          var list = [];
          if (ext === 'xmind') {
            var ensured = handlers.ensureRequirementLabel
              ? handlers.ensureRequirementLabel('请输入本次需求标识后再导入 XMind 测试用例')
              : true;
            if (!ensured) {
              if (setStatus && dom.caseStatus) setStatus(dom.caseStatus, '已取消导入（需求标识为空）', 'warn');
              break;
            }
            var result = await (handlers.parseXmindFile ? handlers.parseXmindFile(file) : Promise.resolve({ text: '', list: [] }));
            text = result.text || '';
            list = result.list || [];
          } else if (ext === 'json') {
            text = (await file.text()).trim();
            try {
              var parsed = JSON.parse(text);
              if (Array.isArray(parsed)) {
                list = parsed;
              } else if (parsed && Array.isArray(parsed.cases)) {
                list = parsed.cases;
              } else {
                list = deriveCaseListFromText(text);
              }
            } catch (err) {
              list = deriveCaseListFromText(text);
            }
          } else {
            text = await file.text();
            list = deriveCaseListFromText(text);
            if (!list.length) {
              var start = text.indexOf('{');
              var end = text.lastIndexOf('}');
              if (start !== -1 && end > start) {
                try {
                  var sliced = text.slice(start, end + 1);
                  var parsedPayload = JSON.parse(sliced);
                  if (Array.isArray(parsedPayload)) {
                    list = parsedPayload;
                  } else if (parsedPayload && Array.isArray(parsedPayload.cases)) {
                    list = parsedPayload.cases;
                  }
                } catch (err2) {
                  // ignore
                }
              }
            }
          }
          if (handlers.extractRequirementLabelFromText && handlers.setRequirementLabel && !state.requirementLabel) {
            var extracted = handlers.extractRequirementLabelFromText(text);
            if (extracted) handlers.setRequirementLabel(extracted, 'import');
          }
          addImportedCase(file.name, text.trim(), list, {
            sourceType: 'external-import',
            fileName: file && file.name ? String(file.name) : '',
          });
        }
        if (setStatus && dom.caseStatus) setStatus(dom.caseStatus, '已导入 ' + files.length + ' 份测试用例', 'ok');
        if (setStatus && dom.casesCoverageStatus) setStatus(dom.casesCoverageStatus, '', '');
        setCaseViewHint('');
      } catch (err) {
        console.error(err);
        if (setStatus && dom.caseStatus) setStatus(dom.caseStatus, '解析失败：' + err.message, 'err');
      } finally {
        if (handlers.clearStepInProgress) handlers.clearStepInProgress('cases-upload');
        if (handlers.updateFlowStatus) handlers.updateFlowStatus();
      }
    }

    function renderImportedCaseList() {
      var placeholder = '<span class="hint" data-placeholder>未导入文件</span>';
      var html = state.importedCases && state.importedCases.length
        ? state.importedCases.map(function(item) {
            return '' +
              '<span class="file-chip" data-case-file="' + (item.id || '') + '">' +
                escapeHtml(item.name || '测试用例') +
                '<button type="button" aria-label="移除" data-remove-case-file="' + (item.id || '') + '">×</button>' +
              '</span>';
          }).join('')
        : placeholder;
      if (caseFileListEl) caseFileListEl.innerHTML = html;
      if (autoCaseFileListEl) autoCaseFileListEl.innerHTML = html;
    }

    function getImportedCaseObjects() {
      if (!state.importedCases || !state.importedCases.length) return [];
      var collected = [];
      state.importedCases.forEach(function(item) {
        if (Array.isArray(item.list) && item.list.length) {
          collected = collected.concat(item.list.filter(Boolean));
        } else if (item.text && item.text.trim()) {
          var derived = deriveCaseListFromText(item.text);
          if (derived.length) collected = collected.concat(derived);
        }
      });
      return collected;
    }

    function hasImportedCases() {
      return getImportedCaseObjects().length > 0;
    }

    function hasCaseSource() {
      return hasImportedCases() || Boolean(caseTextEl && caseTextEl.value && caseTextEl.value.trim());
    }

    function getCombinedCaseList() {
      if (hasImportedCases()) {
        return state.importedCases.reduce(function(acc, item) {
          var list = Array.isArray(item.list) ? item.list : [];
          return acc.concat(list);
        }, []);
      }
      return deriveCaseListFromText(caseTextEl && caseTextEl.value ? caseTextEl.value.trim() : '');
    }

    function getCombinedCaseText() {
      if (hasImportedCases()) {
        return state.importedCases.map(function(item) {
          return '【文件】' + (item.name || '') + '\n' + (item.text || '');
        }).join('\n\n-----\n\n').trim();
      }
      return caseTextEl && caseTextEl.value ? caseTextEl.value.trim() : '';
    }

    function syncCaseTextWithImports() {
      if (!caseTextEl) return;
      if (hasImportedCases()) {
        caseTextEl.value = getCombinedCaseText();
      } else if (!caseTextEl.value.trim()) {
        caseTextEl.value = '';
      }
    }

    function resetImportedCaseView() {
      if (caseViewContainer) {
        caseViewContainer.classList.remove('visible');
        caseViewContainer.classList.add('hidden');
        caseViewContainer.innerHTML = '';
      }
      if (caseViewBtn) caseViewBtn.textContent = '打开用例视图';
      var drawer = caseViewDrawer || ensureCaseViewDrawer();
      if (drawer && drawer.element && drawer.element.classList.contains('open')) drawer.close();
      if (!hasCaseSource()) {
        setCaseViewHint('请先上传或输入 XMind 测试用例');
      } else {
        setCaseViewHint('');
      }
    }

    function refreshImportedCaseViewInternal() {
      if (!caseViewContainer || !caseViewContainer.classList.contains('visible')) return;
      var list = getCombinedCaseList();
      if (!list.length) {
        resetImportedCaseView();
        return;
      }
      caseViewContainer.innerHTML = renderCaseTable(null, list);
    }
    refreshImportedCaseView = refreshImportedCaseViewInternal;

    function ensureCaseViewDrawer() {
      if (caseViewDrawer) return caseViewDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      caseViewDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseViewDrawer',
        closeButtons: ['closeCaseViewDrawerBtn'],
        onClose: function() {
          if (caseViewContainer) {
            caseViewContainer.classList.remove('visible');
            caseViewContainer.classList.add('hidden');
            caseViewContainer.innerHTML = '';
          }
          if (caseViewBtn) caseViewBtn.textContent = '打开用例视图';
        },
      });
      return caseViewDrawer;
    }

    function toggleImportedCaseView() {
      if (!caseViewContainer || !caseViewBtn) return;
      var drawer = ensureCaseViewDrawer();
      if (!drawer) return;
      var isOpen = drawer.element && drawer.element.classList.contains('open');
      if (isOpen) {
        drawer.close();
        return;
      }
      if (!hasCaseSource()) {
        setStatus(dom.caseStatus, '请先上传或输入 XMind 测试用例', 'warn');
        setCaseViewHint('请先上传或输入 XMind 测试用例');
        return;
      }
      var list = getCombinedCaseList();
      if (!list.length) {
        setStatus(dom.caseStatus, '无法解析当前用例，请检查格式', 'warn');
        setCaseViewHint('请先上传或输入 XMind 测试用例');
        return;
      }
      caseViewContainer.innerHTML = renderCaseTable(null, list);
      caseViewContainer.classList.remove('hidden');
      caseViewContainer.classList.add('visible');
      if (caseViewDrawerTitle) caseViewDrawerTitle.textContent = '测试用例视图';
      caseViewBtn.textContent = '收起用例视图';
      setCaseViewHint('');
      setStatus(dom.caseStatus, '', '');
      drawer.open();
    }

    function addImportedCase(name, text, list, meta) {
      if (list === void 0) list = [];
      var entry = {
        id: 'case-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2),
        name: name || ('测试用例' + ((state.importedCases && state.importedCases.length) ? state.importedCases.length + 1 : 1)),
        text: (text || '').trim(),
        list: Array.isArray(list) ? list : [],
        meta: meta && typeof meta === 'object' ? JSON.parse(JSON.stringify(meta)) : null,
      };
      if (!state.importedCases) state.importedCases = [];
      state.importedCases.push(entry);
      renderImportedCaseList();
      syncCaseTextWithImports();
      refreshImportedCaseView();
    }

    function removeImportedCase(id) {
      if (!state.importedCases || !state.importedCases.length) return;
      var idx = state.importedCases.findIndex(function(item) { return item.id === id; });
      if (idx === -1) return;
      state.importedCases.splice(idx, 1);
      renderImportedCaseList();
      syncCaseTextWithImports();
      refreshImportedCaseView();
      if (!hasCaseSource()) {
        setCaseViewHint('请先上传或输入 XMind 测试用例');
        setStatus(dom.caseStatus, '已移除全部导入的测试用例', 'warn');
      }
      updateFlowStatus();
    }

    function buildCasesComparePayload() {
      var list = getCombinedCaseList();
      if (list.length) {
        var payload = { cases: list };
        if (hasImportedCases()) {
          payload.files = state.importedCases.map(function(item) {
            return { name: item.name, count: Array.isArray(item.list) ? item.list.length : 0 };
          });
        }
        return { text: JSON.stringify(payload, null, 2), isJson: true };
      }
      return { text: getCombinedCaseText(), isJson: false };
    }

    return {
      parseCaseList: parseCaseList,
      parseIndentedXmindCases: parseIndentedXmindCases,
      deriveCaseListFromText: deriveCaseListFromText,
      renderImportedCaseList: renderImportedCaseList,
      addImportedCase: addImportedCase,
      removeImportedCase: removeImportedCase,
      hasImportedCases: hasImportedCases,
      hasCaseSource: hasCaseSource,
      getCombinedCaseList: getCombinedCaseList,
        getCombinedCaseText: getCombinedCaseText,
        syncCaseTextWithImports: syncCaseTextWithImports,
        getImportedCaseObjects: getImportedCaseObjects,
        resetImportedCaseView: resetImportedCaseView,
        refreshImportedCaseView: refreshImportedCaseViewInternal,
        toggleImportedCaseView: toggleImportedCaseView,
        buildCasesComparePayload: buildCasesComparePayload,
        importCaseFiles: importCaseFiles,
      };
  }

  window.app = window.app || {};
  window.app.casesCore = { init: init };
})();
