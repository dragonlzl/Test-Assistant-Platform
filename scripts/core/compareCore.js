(function() {
  function init(deps) {
    var stripCodeFence = deps && deps.stripCodeFence ? deps.stripCodeFence : function(text) { return text; };
    var extractJsonPayload = deps && deps.extractJsonPayload ? deps.extractJsonPayload : function(text) { return text; };
    var unwrapRequirementPayload = deps && deps.unwrapRequirementPayload ? deps.unwrapRequirementPayload : function(text) { return { payload: text }; };
    var config = deps && deps.config ? deps.config : {};
    var utils = deps && deps.utils ? deps.utils : {};
    var defaultPrompts = config.defaultPrompts || {};
    var escapeHtml = utils.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var extractJsonObjects = utils.extractJsonObjects || function() { return []; };
    var appendPromptHint = utils.appendPromptHint || function(basePrompt, hint) {
      var base = basePrompt === undefined || basePrompt === null ? '' : String(basePrompt).trim();
      var extra = hint === undefined || hint === null ? '' : String(hint).trim();
      if (!extra) return base;
      var note = '【补充要求】' + extra + '\n【注意】不得改变输出格式，只能在原格式内满足要求。';
      if (!base) return note;
      return base + '\n\n' + note;
    };
    var repairLooseNewlines = utils.repairLooseNewlines || function(text) { return text || ''; };
    var state = deps && deps.state ? deps.state : {};
    var dom = deps && deps.dom ? deps.dom : {};
    var pickEl = function(el, id) {
      if (el) return el;
      if (typeof document !== 'undefined') return document.getElementById(id);
      return null;
    };
    var handlers = deps && deps.handlers ? deps.handlers : {};
    var setStatus = deps && deps.setStatus ? deps.setStatus : function() {};
    var rawText = pickEl(dom.rawText, 'rawText');
    var missingViewBtn = pickEl(dom.missingViewBtn, 'missingViewBtn');
    var copyMissingBtn = pickEl(dom.copyMissingBtn, 'copyMissingBtn');
    var missingViewContainer = pickEl(dom.missingViewContainer, 'missingViewContainer');
    var missingSmartFillBtn = pickEl(dom.missingSmartFillBtn, 'missingSmartFillBtn');
    var missingViewDrawerBody = pickEl(dom.missingViewDrawerBody, 'missingViewDrawerBody');
    var missingViewDrawerTitle = pickEl(dom.missingViewDrawerTitle, 'missingViewDrawerTitle');
    var missingViewDrawer = null;
    var casesCompareResultEl = pickEl(dom.casesCompareResultEl, 'casesCompareResult');
    var casesCoverageStatus = pickEl(dom.casesCoverageStatus, 'casesCoverageStatus');
    var casesTimingEl = pickEl(dom.casesTimingEl, 'casesTiming');
    var casesCompareBtnEl = pickEl(dom.casesCompareBtnEl, 'casesCompareBtn');
    var casesModuleProgress = pickEl(dom.casesModuleProgress, 'casesModuleProgress');
    var casesGoUsecaseGenBtn = pickEl(dom.casesGoUsecaseGenBtn, 'casesGoUsecaseGen');
    var compareResultEl = pickEl(dom.compareResultEl, 'compareResult');
    var compareStatus = pickEl(dom.compareStatus, 'compareStatus');
    var compareTimingEl = pickEl(dom.compareTimingEl, 'compareTiming');
    var compareBtnEl = pickEl(dom.compareBtnEl, 'compareBtn');
    var splitResultEl = pickEl(dom.splitResultEl, 'splitResult');
    var updateAutoMissingCard = handlers.updateAutoMissingCard || function() {};
    var ensureRequirementLabel = handlers.ensureRequirementLabel || function() { return ''; };
    var getSafeRequirementSlug = handlers.getSafeRequirementSlug || function() { return 'requirement'; };
    var downloadText = handlers.downloadText || function() {};
    var wrapTextWithRequirement = handlers.wrapTextWithRequirement || function(text) { return text; };
    var promptRequirementLabel = handlers.promptRequirementLabel || function() { return ''; };
    var setRequirementLabel = handlers.setRequirementLabel || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var wrapDataWithRequirement = handlers.wrapDataWithRequirement || function(data) { return data; };
    var extractRequirementLabelFromText = handlers.extractRequirementLabelFromText || function() { return ''; };
    var resetAutoCompareUserInputs = handlers.resetAutoCompareUserInputs || function() {};
    var syncAutoCompareStatus = handlers.syncAutoCompareStatus || function() { return null; };
    var getCleanedTextForModel = handlers.getCleanedTextForModel || function() { return ''; };
    var getAssignedModel = handlers.getAssignedModel || function() { throw new Error('缺少模型配置'); };
    var getReasoningForType = handlers.getReasoningForType || function() { return ''; };
    var getTemperatureForType = handlers.getTemperatureForType || function() { return 0.2; };
    var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
    var updateModelTiming = handlers.updateModelTiming || function() {};
    var formatJsonOrText = handlers.formatJsonOrText || function(text) { return text; };
    var buildCasesComparePayload = handlers.buildCasesComparePayload || function() { return { text: '', isJson: false }; };
    var parseSplitModules = handlers.parseSplitModules || function() { return []; };
    var ensureCaseGenModulesFromSplit = handlers.ensureCaseGenModulesFromSplit || function() { return false; };
    var setStepInProgress = handlers.setStepInProgress || function() {};
    var clearStepInProgress = handlers.clearStepInProgress || function() {};
    var persistWorkflowState = handlers.persistWorkflowState || function() {};
    var persistWorkflowStateNow = handlers.persistWorkflowStateNow || null;
    var runConcurrent = handlers.runConcurrent || function(items, concurrency, worker) {
      if (!Array.isArray(items) || !items.length) return Promise.resolve([]);
      var limit = Math.max(1, Number(concurrency) || 1);
      var results = new Array(items.length);
      var index = 0;
      function workerLoop() {
        return new Promise(function(resolve, reject) {
          (function next() {
            if (index >= items.length) {
              resolve();
              return;
            }
            var currentIndex = index;
            index += 1;
            Promise.resolve(worker(items[currentIndex], currentIndex))
              .then(function(res) {
                results[currentIndex] = res;
                next();
              })
              .catch(reject);
          })();
        });
      }
      var workers = Array.from({ length: Math.min(limit, items.length) }, function() { return workerLoop(); });
      return Promise.all(workers).then(function() { return results; });
    };

    function clampCoveragePercent(value) {
      var num = Number(value);
      if (!Number.isFinite(num)) return null;
      return Math.max(0, Math.min(100, Math.round(num)));
    }

    function stripControlChars(text) {
      if (!text) return '';
      return String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    }

    function buildSingleModulePayload(module, idx) {
      var title = module && module.title ? module.title : '模块' + (idx + 1);
      var scenarios = module && Array.isArray(module.scenarios) ? module.scenarios : [];
      var points = module && Array.isArray(module.points) ? module.points : [];
      var coupled = module && Array.isArray(module.coupled) ? module.coupled : [];
      return {
        json: JSON.stringify([{
          module: title,
          key_scenarios: scenarios,
          test_points: points,
          coupled_modules: coupled,
        }], null, 2),
        title: title,
      };
    }

    function normalizeExtraModuleKey(entry) {
      if (entry === null || entry === undefined) return '';
      if (typeof entry === 'string') {
        var text = entry.trim();
        return text ? text.toLowerCase() : '';
      }
      if (typeof entry !== 'object') return '';
      var candidates = ['module', '模块', 'module_name', 'name', 'title'];
      for (var i = 0; i < candidates.length; i += 1) {
        var key = candidates[i];
        var value = entry[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim().toLowerCase();
        }
      }
      return '';
    }

    function persistWorkflowSnapshot() {
      if (typeof persistWorkflowStateNow === 'function') {
        persistWorkflowStateNow();
        return;
      }
      if (typeof persistWorkflowState === 'function') {
        persistWorkflowState();
      }
    }

    function aggregateModuleCompareResults(results, moduleList) {
      var summary = { coverage: null, missing: [], extra: [] };
      var coverageSum = 0;
      var coverageCount = 0;
      var validModules = new Set(
        (moduleList || [])
          .map(function(mod) { return mod && mod.title ? mod.title.trim().toLowerCase() : ''; })
          .filter(Boolean)
      );
      (results || []).forEach(function(item) {
        if (!item) return;
        if (typeof item.coverage === 'number') {
          coverageSum += item.coverage;
          coverageCount += 1;
        }
        if (Array.isArray(item.missing) && item.missing.length) {
          summary.missing = summary.missing.concat(item.missing);
        }
        if (Array.isArray(item.extra) && item.extra.length) {
          item.extra.forEach(function(extraItem) {
            if (!validModules.size) {
              summary.extra.push(extraItem);
              return;
            }
            var moduleKey = normalizeExtraModuleKey(extraItem);
            if (!moduleKey || !validModules.has(moduleKey)) {
              summary.extra.push(extraItem);
            }
          });
        }
      });
      if (coverageCount) {
        summary.coverage = Math.max(0, Math.min(100, Math.round(coverageSum / coverageCount)));
      }
      if (Array.isArray(summary.extra) && summary.extra.length) {
        var unique = [];
        var seen = new Set();
        summary.extra.forEach(function(entry) {
          var signature = typeof entry === 'string' ? entry : JSON.stringify(entry);
          if (!seen.has(signature)) {
            seen.add(signature);
            unique.push(entry);
          }
        });
        summary.extra = unique;
      }
      return summary;
    }

    function parseModuleCompareResponse(content, moduleTitle) {
      var rawContent = stripControlChars(stripCodeFence(content));
      var jsonOnly = extractJsonPayload(rawContent);
      var payload = repairLooseNewlines(stripControlChars(jsonOnly || rawContent));
      var data;
      try {
        data = JSON.parse(payload);
      } catch (err) {
        throw new Error('模块「' + moduleTitle + '」结果无法解析：' + (err && err.message ? err.message : 'JSON 格式错误'));
      }
      var coverage = clampCoveragePercent(data.coverage);
      var missing = normalizeMissingModuleList(data.missing, moduleTitle);
      var extra = Array.isArray(data.extra) ? data.extra : [];
      return { module: moduleTitle, coverage: coverage, missing: missing, extra: extra };
    }

    function isCoveragePayload(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
      var hasCoverage = Object.prototype.hasOwnProperty.call(data, 'coverage');
      var hasMissing = Object.prototype.hasOwnProperty.call(data, 'missing');
      var hasExtra = Object.prototype.hasOwnProperty.call(data, 'extra');
      return hasCoverage && (hasMissing || hasExtra);
    }

    function pickBestCompareCandidate(list) {
      if (!Array.isArray(list) || !list.length) return null;
      var best = null;
      list.forEach(function(item, idx) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        if (!isCoveragePayload(item)) return;
        var coverage = clampCoveragePercent(item.coverage);
        if (!Number.isFinite(coverage)) return;
        if (!best || coverage > best.coverage || (coverage === best.coverage && idx > best.index)) {
          best = { index: idx, coverage: coverage, value: item };
        }
      });
      if (best) return best.value;
      return list[list.length - 1];
    }

    function extractCompareResultData() {
      var raw = compareResultEl && compareResultEl.value ? compareResultEl.value.trim() : '';
      if (!raw) return null;
      var result = unwrapRequirementPayload(repairLooseNewlines(raw));
      if (result.type && result.type !== 'compare') {
        setStatus(compareStatus, '导入内容类型不匹配（非对比完整性结果）', 'warn');
        return null;
      }
      var payload = typeof result.payload === 'string' ? repairLooseNewlines(result.payload) : result.payload;
      try {
        var parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (typeof parsed === 'string' && /^[\[{]/.test(parsed.trim())) {
          try {
            parsed = JSON.parse(parsed);
          } catch (err) {
            // ignore
          }
        }
        return parsed;
      } catch (err) {
        if (typeof payload === 'string' && extractJsonObjects) {
          var candidates = extractJsonObjects(payload);
          var bestCandidate = pickBestCompareCandidate(candidates);
          if (bestCandidate) return bestCandidate;
        }
        if (extractJsonObjects) {
          var rawCandidates = extractJsonObjects(raw);
          var rawBest = pickBestCompareCandidate(rawCandidates);
          if (rawBest) return rawBest;
        }
        if (typeof payload === 'string' && extractJsonPayload) {
          try {
            var extracted = extractJsonPayload(payload);
            if (extracted) return JSON.parse(extracted);
          } catch (inner) {
            // ignore
          }
        }
        if (extractJsonPayload) {
          try {
            var rawExtracted = extractJsonPayload(raw);
            if (rawExtracted) return JSON.parse(rawExtracted);
          } catch (inner2) {
            // ignore
          }
        }
        console.warn('对比结果解析失败', err);
        return null;
      }
    }

    function formatMissingRequirement(item) {
      if (item === undefined || item === null) return '-';
      if (typeof item === 'string') return item.trim() || '-';
      if (typeof item === 'object') {
        try {
          if (item.module || item.title) {
            var parts = [];
            if (item.module || item.title) parts.push('模块：' + (item.module || item.title));
            if (Array.isArray(item.key_scenarios) && item.key_scenarios.length) parts.push('场景：' + item.key_scenarios.join('，'));
            if (Array.isArray(item.test_points) && item.test_points.length) parts.push('要点：' + item.test_points.join('，'));
            if (Array.isArray(item.coupled_modules) && item.coupled_modules.length) parts.push('耦合：' + item.coupled_modules.join('，'));
            return parts.join('；') || JSON.stringify(item);
          }
          return JSON.stringify(item);
        } catch (err) {
          return String(item);
        }
      }
      return String(item);
    }

    function normalizeMissingTextValue(value) {
      var base = value === undefined || value === null ? '' : value;
      var str = base.toString().trim();
      if (!str || /^(undefined|null)$/i.test(str)) return '';
      return str;
    }

    function coerceMissingList(value) {
      if (Array.isArray(value)) {
        return value.map(normalizeMissingTextValue).filter(Boolean);
      }
      if (value && typeof value === 'object') {
        return Object.values(value).reduce(function(acc, item) {
          return acc.concat(coerceMissingList(item));
        }, []);
      }
      var text = normalizeMissingTextValue(value);
      return text ? [text] : [];
    }

    function toModuleObject(entry, fallbackTitle) {
      var moduleName = fallbackTitle || '';
      var scenarios = [];
      var points = [];
      var coupled = [];
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        if (entry.module) moduleName = normalizeMissingTextValue(entry.module) || moduleName;
        else if (entry.title) moduleName = normalizeMissingTextValue(entry.title) || moduleName;
        else if (entry['模块']) moduleName = normalizeMissingTextValue(entry['模块']) || moduleName;
        else if (entry['模块名']) moduleName = normalizeMissingTextValue(entry['模块名']) || moduleName;
        if (Array.isArray(entry.key_scenarios)) scenarios = entry.key_scenarios.slice();
        if (Array.isArray(entry.test_points)) points = entry.test_points.slice();
        if (Array.isArray(entry.coupled_modules)) coupled = entry.coupled_modules.slice();
      }
      return {
        module: moduleName,
        key_scenarios: Array.isArray(scenarios) ? scenarios : [],
        test_points: Array.isArray(points) ? points : [],
        coupled_modules: Array.isArray(coupled) ? coupled : [],
      };
    }

    function normalizeMissingModuleList(list, fallbackTitle) {
      var rawList = Array.isArray(list) ? list : (list ? [list] : []);
      var normalized = [];
      rawList.forEach(function(entry) {
        if (!entry && entry !== 0) return;
        if (Array.isArray(entry)) {
          var moduleFromArray = toModuleObject({}, fallbackTitle);
          moduleFromArray.test_points = coerceMissingList(entry);
          normalized.push(moduleFromArray);
          return;
        }
        if (typeof entry === 'string' || typeof entry === 'number') {
          var moduleFromText = toModuleObject({}, fallbackTitle);
          moduleFromText.test_points = coerceMissingList(entry);
          normalized.push(moduleFromText);
          return;
        }
        if (entry && typeof entry === 'object') {
          var keys = Object.keys(entry);
          if (keys.length === 1 && !/^(module|模块)$/i.test(keys[0])) {
            var singleKey = keys[0];
            var singleValue = entry[singleKey];
            var moduleObj = toModuleObject({}, normalizeMissingTextValue(singleKey) || fallbackTitle);
            moduleObj.test_points = coerceMissingList(singleValue);
            normalized.push(moduleObj);
            return;
          }
          var moduleItem = toModuleObject(entry, fallbackTitle);
          moduleItem.key_scenarios = coerceMissingList(moduleItem.key_scenarios);
          moduleItem.test_points = coerceMissingList(moduleItem.test_points);
          moduleItem.coupled_modules = coerceMissingList(moduleItem.coupled_modules);
          normalized.push(moduleItem);
        }
      });
      return normalized.filter(function(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
      });
    }

    function isStrictMissingModuleItem(item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      if (!item.module || !String(item.module).trim()) return false;
      if (!Array.isArray(item.key_scenarios)) return false;
      if (!Array.isArray(item.test_points)) return false;
      if (!Array.isArray(item.coupled_modules)) return false;
      return true;
    }

    function isPlaceholderModuleName(name) {
      if (!name) return true;
      var text = String(name).trim();
      if (!text) return true;
      return /^(模块|module)\\s*\\d+$/i.test(text);
    }

    function hasPlaceholderModules(list) {
      if (!Array.isArray(list)) return false;
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        if (!item || typeof item !== 'object') continue;
        if (isPlaceholderModuleName(item.module)) return true;
      }
      return false;
    }

    function normalizeMissingModule(entry) {
      if (!entry || typeof entry !== 'object') return null;
      var normalized = {
        module: '',
        scenarios: [],
        points: [],
        coupled: [],
        special: [],
      };
      var entries = Object.entries(entry);
      if (!entries.length) return null;
      if (entries.length === 1) {
        var onlyKey = entries[0][0];
        var onlyValue = entries[0][1];
        if (/^(module|模块)$/i.test(onlyKey)) {
          normalized.module = normalizeMissingTextValue(onlyValue) || '';
          return normalized.module ? normalized : null;
        }
        if (Array.isArray(onlyValue) || typeof onlyValue === 'string' || typeof onlyValue === 'number') {
          normalized.module = normalizeMissingTextValue(onlyKey) || '模块';
          normalized.points = coerceMissingList(onlyValue);
          return normalized.points.length ? normalized : null;
        }
      }
      function appendList(target, value) {
        var list = coerceMissingList(value);
        if (list.length) target.push.apply(target, list);
      }

      if (entries.length === 1 && !/module|模块/.test(entries[0][0])) {
        var singleKey = entries[0][0];
        var singleValue = entries[0][1];
        var pointsOnly = coerceMissingList(singleValue);
        if (pointsOnly.length) {
          normalized.module = normalizeMissingTextValue(singleKey) || '模块';
          normalized.points = pointsOnly;
          return normalized;
        }
      }

      var maybeBlocks = [];
      entries.forEach(function(pair, idx) {
        var key = pair[0];
        var value = pair[1];
        if (!normalized.module && /module|模块/.test(key)) {
          var text = normalizeMissingTextValue(value);
          if (text) normalized.module = text;
        }
        if (/场景/.test(key)) appendList(normalized.scenarios, value);
        else if (/要点|测点|测试点|缺失|test[_\\s-]*points?/i.test(key)) appendList(normalized.points, value);
        else if (/耦合|相关/.test(key)) appendList(normalized.coupled, value);
        else if (/特殊|边界/.test(key)) appendList(normalized.special, value);
        else if (idx === 0 && (Array.isArray(value) || (value && typeof value === 'object'))) {
          maybeBlocks.push(value);
        } else if (!normalized.module && (Array.isArray(value) || typeof value === 'string')) {
          var pointList = coerceMissingList(value);
          if (pointList.length) {
            normalized.module = normalizeMissingTextValue(key) || ('模块' + (idx + 1));
            normalized.points = pointList;
          }
        }
      });

      if (!normalized.module && entries.length) {
        var firstVal = entries[0][1];
        normalized.module = normalizeMissingTextValue(entries[0][0]) || normalizeMissingTextValue(firstVal);
      }

      maybeBlocks.forEach(function(blocks) {
        var arr = Array.isArray(blocks) ? blocks : [blocks];
        arr.forEach(function(block) {
          if (!block || typeof block !== 'object') return;
          Object.entries(block).forEach(function(inner) {
            var key = inner[0];
            var value = inner[1];
            if (/场景/.test(key)) appendList(normalized.scenarios, value);
            else if (/要点|测点|测试点|缺失|test[_\\s-]*points?/i.test(key)) appendList(normalized.points, value);
            else if (/耦合|相关/.test(key)) appendList(normalized.coupled, value);
            else if (/特殊|边界/.test(key)) appendList(normalized.special, value);
            else if (!normalized.module && /module|模块/.test(key)) {
              var text = normalizeMissingTextValue(value);
              if (text) normalized.module = text;
            }
          });
        });
      });

      if (!normalized.points.length && entries.length > 1) {
        normalized.points = coerceMissingList(entries[1][1]);
      }
      if (!normalized.points.length && normalized.special.length) {
        normalized.points = normalized.special.slice();
      }

      return normalized.module || normalized.points.length ? normalized : null;
    }

    function pickCoveragePayload(data) {
      if (!data || typeof data !== 'object') return null;
      if (isCoveragePayload(data)) return data;
      if (data && typeof data === 'object' && !Array.isArray(data) && isCoveragePayload(data.data)) {
        return data.data;
      }
      var stack = [];
      Object.keys(data).forEach(function(key) {
        var value = data[key];
        if (value && typeof value === 'object') stack.push(value);
      });
      while (stack.length) {
        var current = stack.pop();
        if (!current || typeof current !== 'object') continue;
        if (isCoveragePayload(current)) return current;
        Object.keys(current).forEach(function(key) {
          var value = current[key];
          if (value && typeof value === 'object') stack.push(value);
        });
      }
      return null;
    }

    function normalizeMissingPayload(rawMissing) {
      if (!rawMissing) return [];
      if (Array.isArray(rawMissing)) {
        return rawMissing.map(function(item) {
          if (item && typeof item === 'object') return item;
          var text = normalizeMissingTextValue(item);
          if (text) return { module: text, points: [] };
          return null;
        }).filter(Boolean);
      }
      if (typeof rawMissing !== 'object') return [];
      var keys = Object.keys(rawMissing);
      if (!keys.length) return [];
      if (keys.length === 1 && /模块|module|缺失/.test(keys[0])) {
        var wrapped = rawMissing[keys[0]];
        if (Array.isArray(wrapped)) return normalizeMissingPayload(wrapped);
        if (wrapped && typeof wrapped === 'object') {
          return Object.keys(wrapped).map(function(moduleName) {
            return { module: moduleName, points: wrapped[moduleName] };
          });
        }
      }
      var hasModuleKey = keys.some(function(key) { return /module|模块/.test(key); });
      var hasPointKey = keys.some(function(key) { return /要点|测点|测试点|缺失|test[_\s-]*points?/i.test(key); });
      if (hasModuleKey || hasPointKey) return [rawMissing];
      return keys.map(function(moduleName) {
        return { module: moduleName, points: rawMissing[moduleName] };
      });
    }

    function parseMissingModules(jsonText) {
      var result = unwrapRequirementPayload(repairLooseNewlines(jsonText || ''));
      var payload = typeof result.payload === 'string' ? result.payload : result.payload;
      if (!payload) return [];
      try {
        var data = typeof payload === 'string' ? JSON.parse(repairLooseNewlines(payload)) : payload;
        var coverage = pickCoveragePayload(data);
        var missing = coverage ? normalizeMissingPayload(coverage.missing) : [];
        return (missing || []).map(function(entry) { return normalizeMissingModule(entry); }).filter(Boolean);
      } catch (err) {
        if (typeof payload === 'string' && extractJsonPayload) {
          try {
            var extracted = extractJsonPayload(payload);
            if (extracted) {
              var parsed = JSON.parse(extracted);
              var parsedCoverage = pickCoveragePayload(parsed);
              var parsedMissing = parsedCoverage ? normalizeMissingPayload(parsedCoverage.missing) : [];
              return (parsedMissing || []).map(function(entry) { return normalizeMissingModule(entry); }).filter(Boolean);
            }
          } catch (inner) {
            // ignore
          }
        }
        if (extractJsonPayload) {
          try {
            var rawExtracted = extractJsonPayload(jsonText || '');
            if (rawExtracted) {
              var rawParsed = JSON.parse(rawExtracted);
              var rawCoverage = pickCoveragePayload(rawParsed);
              var rawMissing = rawCoverage ? normalizeMissingPayload(rawCoverage.missing) : [];
              return (rawMissing || []).map(function(entry) { return normalizeMissingModule(entry); }).filter(Boolean);
            }
          } catch (inner2) {
            // ignore
          }
        }
        console.warn('缺失模块 JSON 解析失败', err);
        return [];
      }
    }

    function buildMissingRows(list) {
      var rows = [];
      (list || []).forEach(function(item, moduleIdx) {
        if (!item) return;
        var moduleName = normalizeMissingTextValue(item.module) || ('模块' + (moduleIdx + 1));
        var points = Array.isArray(item.points)
          ? item.points.map(normalizeMissingTextValue).filter(Boolean)
          : [];
        if (!points.length) return;
        var entries = points;
        entries.forEach(function(pt, pointIdx) {
          rows.push({
            moduleIndex: moduleIdx,
            moduleName: moduleName,
            pointIndex: pointIdx,
            text: normalizeMissingTextValue(pt) || '（缺失测试点未解析）',
          });
        });
      });
      return rows;
    }

    function buildMissingViewHtml(state) {
      var rows = state && state.missingRowCache ? state.missingRowCache : [];
      if ((!rows || !rows.length) && state && state.missingLastList && state.missingLastList.length) {
        state.missingRowCache = buildMissingRows(state.missingLastList);
        rows = state.missingRowCache;
      }
      if (!rows || !rows.length) {
        var hasList = state && state.missingLastList && state.missingLastList.length;
        var hintText = hasList ? '当前没有缺失测试点' : '未解析到缺失模块';
        return '<p class="hint" style="padding:12px;">' + hintText + '</p>';
      }
      var selections = state && state.missingSelections instanceof Set ? state.missingSelections : new Set();
      var selectAllChecked = selections.size === rows.length;
      var body = rows.map(function(row, idx) {
        return '' +
          '<tr>' +
            '<td class="check"><input type="checkbox" data-missing-index="' + idx + '" ' + (selections.has(idx) ? 'checked' : '') + '></td>' +
            '<td class="index">' + (idx + 1) + '</td>' +
            '<td>' + normalizeMissingTextValue(row.moduleName || '-') + '</td>' +
            '<td>' + normalizeMissingTextValue(row.text || '-') + '；</td>' +
          '</tr>';
      }).join('');
      return '' +
        '<table class="table-view">' +
          '<thead>' +
            '<tr>' +
              '<th class="check"><input type="checkbox" data-missing-select-all ' + (selectAllChecked ? 'checked' : '') + '></th>' +
              '<th class="index">编号</th>' +
              '<th>缺失模块</th>' +
              '<th>缺失测试点</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + body + '</tbody>' +
        '</table>';
    }

    function pickMissingSelections(state) {
      if (!state) return [];
      var list = state.missingLastList && state.missingLastList.length ? state.missingLastList : [];
      if (!state.missingSelections || !state.missingSelections.size) return list;
      var rows = state.missingRowCache || [];
      if (!rows.length) return [];
      var grouped = new Map();
      state.missingSelections.forEach(function(idx) {
        var row = rows[idx];
        if (!row) return;
        if (!grouped.has(row.moduleIndex)) grouped.set(row.moduleIndex, []);
        grouped.get(row.moduleIndex).push(row);
      });
      var result = [];
      list.forEach(function(item, moduleIdx) {
        if (!grouped.has(moduleIdx)) return;
        var rowGroup = grouped.get(moduleIdx) || [];
        var points = rowGroup.map(function(r) { return r.text; }).filter(Boolean);
        var clone = Object.assign({}, item, { points: points });
        result.push(clone);
      });
      return result;
    }

    function ensureMissingState() {
      if (!(state.missingSelections instanceof Set)) state.missingSelections = new Set();
      if (!Array.isArray(state.missingLastList)) state.missingLastList = [];
      if (!Array.isArray(state.missingRowCache)) state.missingRowCache = [];
      if (!Array.isArray(state.caseGenModules)) state.caseGenModules = [];
    }

    function ensureMissingDrawer() {
      if (missingViewDrawer) return missingViewDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      missingViewDrawer = window.app.drawer.createDrawer({
        drawerId: 'missingViewDrawer',
        closeButtons: ['closeMissingViewDrawerBtn'],
        onClose: function() {
          if (missingViewContainer) {
          missingViewContainer.classList.add('hidden');
          missingViewContainer.classList.remove('visible');
          missingViewContainer.innerHTML = '';
        }
        if (missingViewBtn) missingViewBtn.textContent = '前往勾选缺失模块生成缺失用例';
      },
    });
    return missingViewDrawer;
    }

    function syncCasesGoUsecaseGenButton() {
      if (!casesGoUsecaseGenBtn) return;
      var hasSplit = Boolean(splitResultEl && splitResultEl.value && splitResultEl.value.trim());
      casesGoUsecaseGenBtn.disabled = !hasSplit;
    }

    if (splitResultEl && typeof splitResultEl.addEventListener === 'function') {
      splitResultEl.addEventListener('input', syncCasesGoUsecaseGenButton);
    }
    syncCasesGoUsecaseGenButton();

    function refreshMissingSmartFillButton() {
      if (!missingSmartFillBtn) return;
      ensureMissingState();
      if (!state.caseGenModules.length && typeof ensureCaseGenModulesFromSplit === 'function') {
        ensureCaseGenModulesFromSplit();
      }
      var list = state.missingLastList.length
        ? state.missingLastList
        : parseMissingModules(casesCompareResultEl && casesCompareResultEl.value ? casesCompareResultEl.value : '');
      var hasFillable = (list || []).some(function(item) {
        return item && (
          (item.scenarios && item.scenarios.length) ||
          (item.points && item.points.length) ||
          (item.coupled && item.coupled.length) ||
          (item.special && item.special.length)
        );
      });
      missingSmartFillBtn.disabled = !hasFillable || !state.caseGenModules.length;
    }

    function refreshMissingSelectionUI() {
      if (!missingViewContainer) return;
      ensureMissingState();
      var length = state.missingRowCache.length;
      var checkboxes = missingViewContainer.querySelectorAll('input[data-missing-index]');
      checkboxes.forEach(function(cb) {
        var idx = Number(cb.dataset.missingIndex);
        cb.checked = state.missingSelections.has(idx);
      });
      var master = missingViewContainer.querySelector('input[data-missing-select-all]');
      if (master) {
        master.checked = length > 0 && state.missingSelections.size === length;
        master.indeterminate = state.missingSelections.size > 0 && state.missingSelections.size < length;
      }
    }

    function bindMissingViewCheckboxEvents() {
      if (!missingViewContainer) return;
      var header = missingViewContainer.querySelector('input[data-missing-select-all]');
      if (header) {
        header.addEventListener('change', function(e) {
          handleMissingSelectAll(e && e.target ? e.target.checked : false);
        });
      }
      var rows = missingViewContainer.querySelectorAll('input[data-missing-index]');
      rows.forEach(function(cb) {
        cb.addEventListener('change', function(e) {
          var target = e && e.target ? e.target : cb;
          handleMissingSelectionChange(Number(target.dataset.missingIndex), target.checked);
        });
      });
    }

    function updateMissingView() {
      if (!missingViewBtn || !copyMissingBtn || !missingViewContainer || !casesCompareResultEl) return;
      ensureMissingState();
      var list = parseMissingModules(casesCompareResultEl.value || '');
      state.missingLastList = list;
      state.missingRowCache = buildMissingRows(list);
      var rowLength = state.missingRowCache.length;
      state.missingSelections = new Set(Array.from(state.missingSelections).filter(function(idx) { return idx < rowLength; }));
      var hasData = list.length > 0;
      var hasRawText = Boolean(casesCompareResultEl && casesCompareResultEl.value && casesCompareResultEl.value.trim());
      missingViewBtn.disabled = !hasData && !hasRawText;
      copyMissingBtn.disabled = !hasData;
      syncCasesGoUsecaseGenButton();
      refreshMissingSmartFillButton();
      if (!hasData) {
        if (hasRawText && missingViewContainer.classList.contains('visible')) {
          missingViewContainer.innerHTML = buildMissingViewHtml(state);
          bindMissingViewCheckboxEvents();
          refreshMissingSelectionUI();
        } else {
          missingViewContainer.classList.add('hidden');
          missingViewContainer.classList.remove('visible');
          missingViewContainer.innerHTML = '';
          missingViewBtn.textContent = '前往勾选缺失模块生成缺失用例';
          var drawer = missingViewDrawer || ensureMissingDrawer();
          if (drawer && drawer.element && drawer.element.classList.contains('open')) drawer.close();
        }
      } else if (missingViewContainer.classList.contains('visible')) {
        missingViewContainer.innerHTML = buildMissingViewHtml(state);
        bindMissingViewCheckboxEvents();
        refreshMissingSelectionUI();
      }
      if (typeof updateAutoMissingCard === 'function') updateAutoMissingCard();
    }

    function toggleMissingView() {
      if (!missingViewContainer || !missingViewBtn || missingViewBtn.disabled || !casesCompareResultEl) return;
      var drawer = ensureMissingDrawer();
      if (!drawer) return;
      var isOpen = drawer.element && drawer.element.classList.contains('open');
      if (isOpen) {
        drawer.close();
        return;
      }
      ensureMissingState();
      var list = parseMissingModules(casesCompareResultEl.value || '');
      state.missingLastList = list;
      state.missingRowCache = buildMissingRows(list);
      var rowLength = state.missingRowCache.length;
      state.missingSelections = new Set(Array.from(state.missingSelections).filter(function(idx) { return idx < rowLength; }));
      syncCasesGoUsecaseGenButton();
      refreshMissingSmartFillButton();
      missingViewContainer.innerHTML = buildMissingViewHtml(state);
      missingViewContainer.classList.add('visible');
      missingViewContainer.classList.remove('hidden');
      missingViewBtn.textContent = '收起缺失视图';
      if (missingViewDrawerTitle) missingViewDrawerTitle.textContent = '缺失模块视图';
      bindMissingViewCheckboxEvents();
      refreshMissingSelectionUI();
      drawer.open();
    }

    function handleMissingSelectionChange(index, checked) {
      ensureMissingState();
      if (checked) state.missingSelections.add(index);
      else state.missingSelections.delete(index);
      refreshMissingSelectionUI();
      refreshMissingSmartFillButton();
      if (typeof updateAutoMissingCard === 'function') updateAutoMissingCard();
      persistWorkflowState();
    }

    function handleMissingSelectAll(checked) {
      ensureMissingState();
      if (missingViewContainer) {
        var nodes = missingViewContainer.querySelectorAll('input[data-missing-index]');
        state.missingSelections.clear();
        nodes.forEach(function(cb) {
          var idx = Number(cb.dataset.missingIndex);
          if (checked) state.missingSelections.add(idx);
          cb.checked = checked;
        });
        if (missingViewContainer.classList.contains('visible')) {
          missingViewContainer.innerHTML = buildMissingViewHtml(state);
          bindMissingViewCheckboxEvents();
        }
      }
      refreshMissingSelectionUI();
      refreshMissingSmartFillButton();
      if (typeof updateAutoMissingCard === 'function') updateAutoMissingCard();
      persistWorkflowState();
    }

    function copyMissingJson() {
      if (!copyMissingBtn || copyMissingBtn.disabled) return;
      ensureMissingState();
      var fullList = state.missingLastList.length ? state.missingLastList : parseMissingModules(casesCompareResultEl && casesCompareResultEl.value ? casesCompareResultEl.value : '');
      if (!fullList.length) {
        setStatus(casesCoverageStatus, '当前结果缺少 missing 字段', 'warn');
        return;
      }
      if (!state.missingRowCache.length) {
        state.missingRowCache = buildMissingRows(fullList);
      }
      var modules = state.missingSelections.size ? pickMissingSelections(state) : fullList;
      if (!modules.length) {
        setStatus(casesCoverageStatus, '未找到可复制的缺失测试点', 'warn');
        return;
      }
      var payload = JSON.stringify({ missing: modules }, null, 2);
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(payload).then(function() {
          setStatus(casesCoverageStatus, state.missingSelections.size ? '已复制所选缺失测试点 JSON' : '缺失模块 JSON 已复制', 'ok');
        }).catch(function() {
          setStatus(casesCoverageStatus, '复制失败，请手动复制', 'warn');
        });
      } else {
        setStatus(casesCoverageStatus, '当前浏览器不支持自动复制，请手动复制', 'warn');
      }
    }

    function exportCasesCoverage() {
      if (!casesCompareResultEl) return;
      var text = wrapTextWithRequirement(casesCompareResultEl.value.trim());
      if (!text) {
        setStatus(casesCoverageStatus, '当前没有可导出的对比结果', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出覆盖对比结果');
      if (!requirementLabel) {
        setStatus(casesCoverageStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      var payload = wrapTextWithRequirement(text, 'cases_compare');
      downloadText('cases_compare_' + getSafeRequirementSlug() + '_' + stamp + '.txt', payload);
      setStatus(casesCoverageStatus, '覆盖对比结果已导出', 'ok');
    }

    async function importCasesCoverage(file) {
      if (!file || !casesCompareResultEl) return;
      try {
        var text = (await file.text()).trim();
        if (!text) {
          setStatus(casesCoverageStatus, '导入文件内容为空', 'warn');
          return;
        }
        var unwrap = unwrapRequirementPayload(text);
        if (unwrap.requirement) setRequirementLabel(unwrap.requirement, 'import');
        if (!unwrap.requirement) {
          var ensured = promptRequirementLabel('请输入本次需求标识后再导入覆盖对比结果');
          if (!ensured) {
            setStatus(casesCoverageStatus, '已取消导入（需求标识为空）', 'warn');
            return;
          }
        }
        var type = unwrap.type;
        if (type !== 'cases_compare') {
          setStatus(casesCoverageStatus, '导入内容类型不匹配（非用例覆盖对比结果）', 'warn');
          return;
        }
        var payloadText = typeof unwrap.payload === 'string'
          ? unwrap.payload
          : unwrap.payload
          ? JSON.stringify(unwrap.payload)
          : '';
        if (!payloadText) {
          setStatus(casesCoverageStatus, '导入内容为空', 'warn');
          return;
        }
        payloadText = repairLooseNewlines(payloadText);
        var parsed;
        try {
          parsed = JSON.parse(payloadText);
        } catch (err) {
          setStatus(casesCoverageStatus, '导入内容不是有效 JSON，请确认文件格式', 'warn');
          return;
        }
        if (!isCoveragePayload(parsed)) {
          setStatus(casesCoverageStatus, '导入内容不是用例覆盖对比结果，请确认文件', 'warn');
          return;
        }
        casesCompareResultEl.value = JSON.stringify(wrapDataWithRequirement(parsed, 'cases_compare'), null, 2);
        setStatus(casesCoverageStatus, '已导入覆盖对比结果', 'ok');
        updateMissingView();
        persistWorkflowSnapshot();
        updateFlowStatus();
      } catch (err) {
        console.error(err);
        setStatus(casesCoverageStatus, '导入失败：' + err.message, 'err');
      } finally {
        updateFlowStatus();
      }
    }

    function exportCompareResult() {
      if (!compareResultEl || !compareStatus) return;
      var text = compareResultEl.value.trim();
      if (!text) {
        setStatus(compareStatus, '暂无可导出的对比结果', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出覆盖对比结果');
      if (!requirementLabel) {
        setStatus(compareStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      var payload = wrapTextWithRequirement(text, 'compare');
      downloadText('compare_' + getSafeRequirementSlug() + '_' + stamp + '.json', payload);
      setStatus(compareStatus, '对比结果已导出', 'ok');
    }

    async function importCompareResult(file) {
      if (!file || !compareResultEl || !compareStatus) return;
      try {
        var text = (await file.text()).trim();
        if (!text) {
          setStatus(compareStatus, '导入内容为空', 'warn');
          return;
        }
        var parsedLabel = extractRequirementLabelFromText(text);
        if (parsedLabel) {
          setRequirementLabel(parsedLabel, 'import');
        } else {
          var ensured = promptRequirementLabel('请输入本次需求标识后再导入对比结果');
          if (!ensured) {
            setStatus(compareStatus, '已取消导入（需求标识为空）', 'warn');
            return;
          }
        }
        var unwrap = unwrapRequirementPayload(text);
        var type = unwrap.type;
        if (type !== 'compare') {
          setStatus(compareStatus, '导入内容类型不匹配（非对比完整性结果）', 'warn');
          return;
        }
        var payloadText = typeof unwrap.payload === 'string'
          ? unwrap.payload
          : unwrap.payload
          ? JSON.stringify(unwrap.payload)
          : '';
        payloadText = repairLooseNewlines(payloadText);
        var parsed;
        try {
          parsed = JSON.parse(payloadText);
        } catch (err) {
          setStatus(compareStatus, '导入内容不是有效 JSON，请确认文件格式', 'warn');
          return;
        }
        if (!isCoveragePayload(parsed)) {
          setStatus(compareStatus, '导入内容不是对比完整性结果，请确认文件', 'warn');
          return;
        }
        compareResultEl.value = JSON.stringify(wrapDataWithRequirement(parsed, 'compare'), null, 2);
        setStatus(compareStatus, '已导入对比结果', 'ok');
        if (typeof resetAutoCompareUserInputs === 'function') resetAutoCompareUserInputs();
        if (typeof syncAutoCompareStatus === 'function') syncAutoCompareStatus();
        persistWorkflowSnapshot();
      } catch (err) {
        console.error(err);
        setStatus(compareStatus, '导入失败：' + err.message, 'err');
      } finally {
        updateFlowStatus();
      }
    }

    function resolveCasesCompareConcurrency(moduleCount) {
      var count = Number(moduleCount);
      if (!Number.isFinite(count) || count <= 0) return 1;
      return Math.max(1, Math.min(20, Math.round(count)));
    }

    function renderCasesModuleProgress(modules, states) {
      if (!casesModuleProgress) return;
      if (!Array.isArray(modules) || !modules.length) {
        casesModuleProgress.innerHTML = '';
        return;
      }
      var items = modules.map(function(mod, idx) {
        var stateVal = states && states[idx] ? states[idx] : 'pending';
        var name = mod && mod.title ? mod.title : '模块' + (idx + 1);
        var marker = stateVal === 'done' ? '✅' : stateVal === 'error' ? '⚠️' : '⏳';
        var text = stateVal === 'done'
          ? '完成'
          : stateVal === 'error'
          ? '失败'
          : stateVal === 'running'
          ? '执行中...'
          : '待处理';
        return '<div class="module-item ' + stateVal + '"><span>' + marker + '</span><span class="name">' + escapeHtml(name) + '</span><span class="state">' + text + '</span></div>';
      }).join('');
      casesModuleProgress.innerHTML = '<div class="module-progress-list">' + items + '</div>';
    }

    async function compareCoverage(options) {
      if (options === void 0) options = {};
      var raw = rawText && rawText.value ? rawText.value.trim() : '';
      var cleaned = getCleanedTextForModel();
      if (!raw) {
        setStatus(compareStatus, '请先导入原始需求', 'warn');
        return;
      }
      if (!cleaned) {
        setStatus(compareStatus, '请先完成清洗并生成结果', 'warn');
        return;
      }
      if (compareBtnEl) compareBtnEl.setAttribute('disabled', 'disabled');
      setStepInProgress('compare');
      var model;
      try {
        model = getAssignedModel('compare');
      } catch (err) {
        setStatus(compareStatus, err && err.message ? err.message : '未配置模型', 'warn');
        updateModelTiming(compareTimingEl);
        clearStepInProgress('compare');
        updateFlowStatus();
        if (compareBtnEl) compareBtnEl.removeAttribute('disabled');
        return;
      }
      if (compareResultEl) compareResultEl.value = '';
      setStatus(compareStatus, '正在对比覆盖率...', '');
      try {
        var comparePrompt = state.assignments && state.assignments.comparePrompt ? state.assignments.comparePrompt.trim() : '';
        var prompt = comparePrompt || defaultPrompts.compare;
        var hint = options && options.promptHint ? String(options.promptHint).trim() : '';
        prompt = appendPromptHint(prompt, hint);
        var reasoning = getReasoningForType('compare');
        var temperature = getTemperatureForType('compare');
        var startTime = Date.now();
        var content = await callModelWithConfig(
          model,
          '原始需求：\n' + raw + '\n\n清洗后的需求：\n' + cleaned,
          prompt,
          reasoning,
          temperature
        );
        updateModelTiming(compareTimingEl, Date.now() - startTime);
        var rawContent = stripCodeFence(content);
        var normalizedText = '';
        if (extractJsonObjects) {
          var outputCandidates = extractJsonObjects(rawContent);
          var outputBest = pickBestCompareCandidate(outputCandidates);
          if (outputBest) normalizedText = JSON.stringify(outputBest, null, 2);
        }
        var formatted = normalizedText || formatJsonOrText(rawContent);
        if (compareResultEl) compareResultEl.value = formatted;
        resetAutoCompareUserInputs();
        syncAutoCompareStatus();
        setStatus(compareStatus, '对比完成', 'ok');
        updateFlowStatus();
        persistWorkflowSnapshot();
      } catch (err) {
        console.error(err);
        updateModelTiming(compareTimingEl);
        setStatus(compareStatus, '对比失败：' + (err && err.message ? err.message : '请重试'), 'err');
      } finally {
        clearStepInProgress('compare');
        updateFlowStatus();
        if (compareBtnEl) compareBtnEl.removeAttribute('disabled');
      }
    }

    async function compareSingleModuleWithCases(module, idx, casesPayload, isJson, model, prompt, reasoning, temperature) {
      var payload = buildSingleModulePayload(module, idx);
      var label = isJson ? '测试用例列表（JSON）' : '测试用例内容';
      var userText = '仅针对以下单个模块进行覆盖对比，请返回 {coverage, missing, extra} JSON：\n' + payload.json + '\n\n' + label + '：\n' + casesPayload;
      var content;
      try {
        content = await callModelWithConfig(model, userText, prompt, reasoning, temperature);
      } catch (err) {
        throw new Error('模块「' + payload.title + '」对比失败：' + (err && err.message ? err.message : err));
      }
      var parsed = parseModuleCompareResponse(content, payload.title);
      var missingInvalid = parsed.missing.length && !parsed.missing.every(isStrictMissingModuleItem);
      var placeholderInvalid = parsed.missing.length && hasPlaceholderModules(parsed.missing);
      if (missingInvalid || placeholderInvalid) {
        var strictPrompt = prompt + '\n\n【强制输出格式】missing 必须为模块 JSON 数组，且每项包含 module/key_scenarios/test_points/coupled_modules 字段（字段必须存在且为数组），禁止输出 {模块名:[...]} 或纯字符串列表；missing 中 module 必须使用拆分结果里的模块名称，禁止输出“模块1/模块2/Module 1”等占位命名；仅输出 JSON。';
        try {
          content = await callModelWithConfig(model, userText, strictPrompt, reasoning, temperature);
          parsed = parseModuleCompareResponse(content, payload.title);
        } catch (err2) {
          // fallback to normalized result from the first pass
        }
      }
      var stillInvalid = parsed.missing.length && !parsed.missing.every(isStrictMissingModuleItem);
      var stillPlaceholder = parsed.missing.length && hasPlaceholderModules(parsed.missing);
      if (stillInvalid || stillPlaceholder) {
        throw new Error('模块「' + payload.title + '」覆盖对比缺失结果格式异常（含占位模块名或字段不完整）');
      }
      return parsed;
    }

    async function compareCasesCoverage(options) {
      if (options === void 0) options = {};
      var modulesText = splitResultEl && splitResultEl.value ? splitResultEl.value.trim() : '';
      var casesPayloadResult = buildCasesComparePayload();
      var casesPayload = casesPayloadResult.text;
      var isJson = casesPayloadResult.isJson;
      if (!modulesText) {
        setStatus(casesCoverageStatus, '请先运行“测试模块拆分”获取模块清单', 'warn');
        return;
      }
      if (!casesPayload) {
        setStatus(casesCoverageStatus, '请先上传或输入 XMind 测试用例', 'warn');
        return;
      }
      var parsedModules = parseSplitModules();
      if (!parsedModules.length) {
        setStatus(casesCoverageStatus, '拆分结果解析失败，请先重新运行“测试模块拆分”', 'warn');
        return;
      }
      if (casesCompareResultEl) casesCompareResultEl.value = '';
      if (casesCompareBtnEl) casesCompareBtnEl.setAttribute('disabled', 'disabled');
      renderCasesModuleProgress(parsedModules, parsedModules.map(function() { return 'pending'; }));
      setStepInProgress('cases');
      var model;
      try {
        model = getAssignedModel('cases');
      } catch (err) {
        setStatus(casesCoverageStatus, err && err.message ? err.message : '未配置模型', 'warn');
        updateModelTiming(casesTimingEl);
        clearStepInProgress('cases');
        updateFlowStatus();
        if (casesCompareBtnEl) casesCompareBtnEl.removeAttribute('disabled');
        return;
      }
      var concurrency = resolveCasesCompareConcurrency(parsedModules.length);
      setStatus(casesCoverageStatus, '正在并发对比 ' + parsedModules.length + ' 个模块（并发上限 ' + concurrency + '）...', '');
      var casesPrompt = state.assignments && state.assignments.casesPrompt ? state.assignments.casesPrompt.trim() : '';
      var prompt = casesPrompt || defaultPrompts.cases;
      var hint = options && options.promptHint ? String(options.promptHint).trim() : '';
      prompt = appendPromptHint(prompt, hint);
      var reasoning = getReasoningForType('cases');
      var temperature = getTemperatureForType('cases');
      var startTime = Date.now();
      try {
        var states = parsedModules.map(function() { return 'pending'; });
        var perModule = await runConcurrent(parsedModules, concurrency, function(module, idx) {
          states[idx] = 'running';
          renderCasesModuleProgress(parsedModules, states);
          return compareSingleModuleWithCases(module, idx, casesPayload, isJson, model, prompt, reasoning, temperature)
            .then(function(result) {
              states[idx] = 'done';
              renderCasesModuleProgress(parsedModules, states);
              return result;
            })
            .catch(function(err) {
              states[idx] = 'error';
              renderCasesModuleProgress(parsedModules, states);
              throw err;
            });
        });
        var summary = aggregateModuleCompareResults(perModule, parsedModules);
        if (casesCompareResultEl) casesCompareResultEl.value = JSON.stringify(summary, null, 2);
        setStatus(casesCoverageStatus, '覆盖对比完成', 'ok');
        updateMissingView();
        persistWorkflowSnapshot();
      } catch (err) {
        console.error(err);
        setStatus(casesCoverageStatus, '覆盖对比失败：' + (err && err.message ? err.message : '请重试'), 'err');
      } finally {
        renderCasesModuleProgress([], []);
        updateModelTiming(casesTimingEl, Date.now() - startTime);
        clearStepInProgress('cases');
        updateFlowStatus();
        if (casesCompareBtnEl) casesCompareBtnEl.removeAttribute('disabled');
      }
    }

    function extractCoverageFromCompareResult() {
      var data = extractCompareResultData();
      if (!data) return null;
      return clampCoveragePercent(data.coverage);
    }

    return {
      clampCoveragePercent: clampCoveragePercent,
      buildSingleModulePayload: buildSingleModulePayload,
      normalizeExtraModuleKey: normalizeExtraModuleKey,
      aggregateModuleCompareResults: aggregateModuleCompareResults,
      parseModuleCompareResponse: parseModuleCompareResponse,
      isCoveragePayload: isCoveragePayload,
      formatMissingRequirement: formatMissingRequirement,
      normalizeMissingTextValue: normalizeMissingTextValue,
      coerceMissingList: coerceMissingList,
      normalizeMissingModule: normalizeMissingModule,
      parseMissingModules: parseMissingModules,
      buildMissingRows: buildMissingRows,
      buildMissingViewHtml: buildMissingViewHtml,
      pickMissingSelections: pickMissingSelections,
      refreshMissingSmartFillButton: refreshMissingSmartFillButton,
      updateMissingView: updateMissingView,
      toggleMissingView: toggleMissingView,
      refreshMissingSelectionUI: refreshMissingSelectionUI,
      handleMissingSelectionChange: handleMissingSelectionChange,
      handleMissingSelectAll: handleMissingSelectAll,
      copyMissingJson: copyMissingJson,
      extractCompareResultData: extractCompareResultData,
      extractCoverageFromCompareResult: extractCoverageFromCompareResult,
      exportCasesCoverage: exportCasesCoverage,
      importCasesCoverage: importCasesCoverage,
      exportCompareResult: exportCompareResult,
      importCompareResult: importCompareResult,
      renderCasesModuleProgress: renderCasesModuleProgress,
      compareCoverage: compareCoverage,
      compareCasesCoverage: compareCasesCoverage,
    };
  }

  window.app = window.app || {};
  window.app.compareCore = { init: init };
})();
