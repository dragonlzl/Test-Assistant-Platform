(function() {
  'use strict';

  function init(options) {
    var opts = options || {};

    function normalizeText(value) {
      return String(value === null || value === undefined ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function normalizeModuleTitle(value) {
      var impl = opts.normalizeModuleTitle;
      if (typeof impl === 'function') return normalizeText(impl(value));
      return normalizeText(value || '未命名模块') || '未命名模块';
    }

    function normalizeModuleKey(value) {
      var impl = opts.normalizeModuleKey;
      if (typeof impl === 'function') return normalizeText(impl(value));
      return normalizeModuleTitle(value).toLowerCase();
    }

    function cloneJson(value, fallback) {
      if (value === undefined || value === null) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    }

    function normalizeCaseList(list) {
      return (Array.isArray(list) ? list : []).map(function(item) {
        return item && typeof item === 'object' ? cloneJson(item, {}) : null;
      }).filter(Boolean);
    }

    function normalizeModuleInput(item) {
      if (!item || typeof item !== 'object') return null;
      var title = normalizeModuleTitle(item.module || item.title || item.moduleTitle || '');
      var key = normalizeModuleKey(item.moduleKey || title);
      var cases = normalizeCaseList(item.cases);
      if (!key || !title || !cases.length) return null;
      return {
        moduleId: item.moduleId ? String(item.moduleId || '') : '',
        moduleKey: key,
        module: title,
        key_scenarios: Array.isArray(item.key_scenarios) ? item.key_scenarios.slice() : [],
        test_points: Array.isArray(item.test_points) ? item.test_points.slice() : [],
        coupled_modules: Array.isArray(item.coupled_modules) ? item.coupled_modules.slice() : [],
        cases: cases,
      };
    }

    function normalizeModulesInput(list) {
      var result = [];
      var seen = {};
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var normalized = normalizeModuleInput(item);
        if (!normalized || seen[normalized.moduleKey]) return;
        seen[normalized.moduleKey] = true;
        result.push(normalized);
      });
      return result;
    }

    function stripCodeFence(text) {
      var raw = String(text || '').trim();
      if (!raw) return '';
      var fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      return fence ? String(fence[1] || '').trim() : raw;
    }

    function extractJsonPayload(text) {
      var raw = stripCodeFence(text);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (err) {}
      var objStart = raw.indexOf('{');
      var objEnd = raw.lastIndexOf('}');
      if (objStart >= 0 && objEnd > objStart) {
        try {
          return JSON.parse(raw.slice(objStart, objEnd + 1));
        } catch (err2) {}
      }
      var arrStart = raw.indexOf('[');
      var arrEnd = raw.lastIndexOf(']');
      if (arrStart >= 0 && arrEnd > arrStart) {
        try {
          return JSON.parse(raw.slice(arrStart, arrEnd + 1));
        } catch (err3) {}
      }
      return null;
    }

    function normalizeCaseTitle(item, fallback) {
      if (!item || typeof item !== 'object') return normalizeText(fallback || '未命名用例') || '未命名用例';
      return normalizeText(item.title || item.caseTitle || item.case_title || item.name || item['标题'] || fallback || '未命名用例') || '未命名用例';
    }

    function normalizeCaseSteps(item) {
      if (!item || typeof item !== 'object') return '';
      if (Array.isArray(item.steps)) return item.steps.map(normalizeText).join('|');
      return normalizeText(item.steps || item.step || item['步骤'] || '');
    }

    function buildCaseSignature(item, moduleTitle) {
      var source = item && typeof item === 'object' ? item : {};
      return [
        normalizeModuleKey(moduleTitle || source.module || source.moduleName || ''),
        normalizeCaseTitle(source, ''),
        normalizeText(source.preconditions || source.precondition || source['前置条件'] || ''),
        normalizeCaseSteps(source),
        normalizeText(source.expected || source.expect || source['预期结果'] || ''),
      ].join('::').toLowerCase();
    }

    function buildCaseTitleKey(moduleKey, title) {
      return String(moduleKey || '') + '::' + normalizeText(title || '').toLowerCase();
    }

    function buildCaseSignatureCounter(list, moduleTitle) {
      var map = {};
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var signature = buildCaseSignature(item, moduleTitle);
        if (!signature) return;
        map[signature] = Number(map[signature] || 0) + 1;
      });
      return map;
    }

    function readRemovedCaseList(payload) {
      if (!payload || typeof payload !== 'object') return [];
      if (Array.isArray(payload.removed_cases)) return payload.removed_cases;
      if (Array.isArray(payload.removedCases)) return payload.removedCases;
      if (payload.summary && typeof payload.summary === 'object') {
        if (Array.isArray(payload.summary.removed_cases)) return payload.summary.removed_cases;
        if (Array.isArray(payload.summary.removedCases)) return payload.summary.removedCases;
      }
      return [];
    }

    function normalizeRemovedCaseRecord(item, moduleMap) {
      if (!item || typeof item !== 'object') return null;
      var rawCase = item.case && typeof item.case === 'object' ? item.case : item;
      var moduleTitle = normalizeModuleTitle(
        item.module || item.moduleName || item.module_title || rawCase.module || rawCase.moduleName || ''
      );
      var moduleKey = normalizeModuleKey(item.moduleKey || moduleTitle);
      var sourceModule = moduleMap[moduleKey];
      if (!sourceModule) return null;
      var title = normalizeCaseTitle(rawCase, item.title || item.caseTitle || item.case_title || item.name || '');
      if (!title) return null;
      var reason = normalizeDedupeReason(
        item.reason || item.removeReason || item.remove_reason || item.dedupeReason || item.dedupe_reason || item.cause || ''
      );
      var mergedInto = normalizeText(
        item.mergedInto || item.merged_into || item.keepTitle || item.keep_title || item.keptCase || item.kept_case || item.targetTitle || item.target_title || ''
      );
      return {
        moduleId: sourceModule.moduleId,
        moduleKey: sourceModule.moduleKey,
        module: sourceModule.module,
        title: title,
        reason: reason,
        mergedInto: mergedInto,
        signature: buildCaseSignature(rawCase, sourceModule.module),
      };
    }

    function normalizeDedupeReason(value) {
      var text = normalizeText(value);
      text = text.replace(/^原因[：:]\s*/, '').replace(/^因为\s*/, '').trim();
      if (!text) return '覆盖高度重叠';
      var cutAt = -1;
      ['，', '。', '；', ';', '.', '、'].forEach(function(mark) {
        var index = text.indexOf(mark);
        if (index > 0 && (cutAt === -1 || index < cutAt)) cutAt = index;
      });
      if (cutAt > 0) text = text.slice(0, cutAt).trim();
      if (text.length > 24) text = text.slice(0, 24).trim() + '…';
      return text || '覆盖高度重叠';
    }

    function collectExplicitRemovedCases(payload, moduleMap) {
      var result = [];
      var seen = {};
      readRemovedCaseList(payload).forEach(function(item) {
        var record = normalizeRemovedCaseRecord(item, moduleMap);
        if (!record) return;
        var key = record.moduleKey + '::' + (record.signature || buildCaseTitleKey(record.moduleKey, record.title)) + '::' + record.reason;
        if (seen[key]) return;
        seen[key] = true;
        result.push(record);
      });
      return result;
    }

    function buildDedupePrompt() {
      return [
        '你是资深测试用例评审专家，请对 XMind AI 生成用例做保守去重与精简。',
        '最终目标：这些用例会被用于保障项目产品质量，帮助团队更早发现缺陷、降低回归风险、提升用户体验稳定性。',
        '目标：在覆盖全面、质量稳定的前提下，删除或合并明显重复、高度重叠、表达冗余的用例。',
        '质量优先级高于数量压缩：不要为了让用例更少而削弱关键业务路径、用户高频路径、异常路径、边界条件、权限/安全、数据一致性、兼容性和状态流转覆盖。',
        '精简后的用例必须仍然有足够的缺陷发现能力和回归验证价值；如果不确定某条用例是否冗余，应保留。',
        '约束：',
        '1. 只能处理输入模块中已有的用例，不得新增模块。',
        '2. 不要为了减少数量牺牲关键功能、异常、边界、权限、数据校验、状态流转覆盖。',
        '3. 可以重写标题、步骤、预期，使合并后的用例更清晰完整。',
        '4. 每个原本有用例的模块都必须返回该模块的 cases 数组。',
        '5. 只返回 JSON，不要输出解释文本。',
        '6. 必须在 removed_cases 中逐条列出去掉或合并的原用例标题、原因，以及合并到哪个保留用例；没有去掉则返回空数组。',
        '7. removed_cases.reason 必须言简意赅，控制在 20 个中文字以内，只写核心原因，如“覆盖高度重叠”“步骤重复”“场景已合并”。',
        '返回格式：{"modules":[{"module":"模块名","cases":[{"module":"模块名","title":"用例标题","priority":"P1","preconditions":"前置条件","steps":["1、步骤"],"expected":"预期结果"}]}],"removed_cases":[{"module":"模块名","title":"被去掉的原用例标题","reason":"去掉原因","merged_into":"合并到的保留用例标题"}],"summary":{"removed":0,"reason":"简述"}}',
      ].join('\n');
    }

    function buildDedupeRequest(input) {
      var source = input && typeof input === 'object' ? input : {};
      var modules = normalizeModulesInput(source.modules);
      var requirementText = String(source.requirementText || '').trim();
      var requirementSupplement = String(source.requirementSupplement || '').trim();
      var payload = {
        operation_contract: {
          scope: 'xmind_ai_cases',
          mode: 'ai_dedupe_simplify',
          strength: source.strength || 'conservative',
          source: source.source || 'manual-toolbar',
          return_full_replacement: true,
          editable_scope: 'ai_generated_cases_only',
          quality_goal: 'improve_product_quality_without_reducing_coverage_or_defect_detection_value',
        },
        requirement: {
          label: String(source.requirementLabel || ''),
          text: requirementText || '（无文本需求）',
          supplement: requirementSupplement,
        },
        modules: modules,
      };
      var requestText = [
        '【operation_contract(JSON)】',
        JSON.stringify(payload.operation_contract, null, 2),
        '',
        '【原始需求文档/需求描述】',
        payload.requirement.text,
        '',
        '【需求补充】',
        payload.requirement.supplement || '（无）',
        '',
        '【需要去重精简的 AI 生成用例(JSON)】',
        JSON.stringify(payload.modules, null, 2),
      ].join('\n');
      return {
        prompt: buildDedupePrompt(),
        requestText: requestText,
        modules: modules,
        beforeCaseCount: modules.reduce(function(total, item) {
          return total + (Array.isArray(item.cases) ? item.cases.length : 0);
        }, 0),
      };
    }

    function normalizeDedupeResult(rawText, inputModules) {
      var modules = normalizeModulesInput(inputModules);
      var moduleMap = {};
      modules.forEach(function(item) {
        moduleMap[item.moduleKey] = item;
      });
      var payload = extractJsonPayload(rawText);
      var explicitRemovedCases = collectExplicitRemovedCases(payload, moduleMap);
      var explicitRemovedByModule = {};
      var explicitRemovedKeyMap = {};
      explicitRemovedCases.forEach(function(item) {
        if (!explicitRemovedByModule[item.moduleKey]) explicitRemovedByModule[item.moduleKey] = [];
        explicitRemovedByModule[item.moduleKey].push(item);
        explicitRemovedKeyMap[buildCaseTitleKey(item.moduleKey, item.title)] = true;
        if (item.signature) explicitRemovedKeyMap[item.moduleKey + '::' + item.signature] = true;
      });
      var rawModules = [];
      if (payload && Array.isArray(payload.modules)) rawModules = payload.modules;
      else if (Array.isArray(payload)) rawModules = payload;
      var outputMap = {};
      (Array.isArray(rawModules) ? rawModules : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var title = normalizeModuleTitle(item.module || item.title || item.moduleTitle || '');
        var key = normalizeModuleKey(item.moduleKey || title);
        if (!key || !moduleMap[key] || outputMap[key]) return;
        outputMap[key] = normalizeCaseList(item.cases);
      });
      var diagnostics = [];
      var removedCases = [];
      var resultModules = modules.map(function(source) {
        var outputCases = outputMap[source.moduleKey];
        var usedFallback = false;
        if (!Array.isArray(outputCases) || !outputCases.length) {
          outputCases = normalizeCaseList(source.cases);
          usedFallback = true;
          diagnostics.push('模块「' + source.module + '」未返回有效精简结果，已保留原用例');
        }
        var result = {
          moduleId: source.moduleId,
          moduleKey: source.moduleKey,
          module: source.module,
          beforeCount: source.cases.length,
          afterCount: outputCases.length,
          usedFallback: usedFallback,
          cases: outputCases,
        };
        var moduleRemovedCases = (explicitRemovedByModule[source.moduleKey] || []).slice();
        if (!usedFallback && Math.max(0, source.cases.length - outputCases.length) > moduleRemovedCases.length) {
          var afterCounter = buildCaseSignatureCounter(outputCases, source.module);
          var expectedRemoved = Math.max(0, source.cases.length - outputCases.length);
          source.cases.forEach(function(caseItem, caseIndex) {
            if (moduleRemovedCases.length >= expectedRemoved) return;
            var signature = buildCaseSignature(caseItem, source.module);
            if (afterCounter[signature] > 0) {
              afterCounter[signature] -= 1;
              return;
            }
            var title = normalizeCaseTitle(caseItem, '用例' + String(caseIndex + 1));
            var titleKey = buildCaseTitleKey(source.moduleKey, title);
            var signatureKey = source.moduleKey + '::' + signature;
            if (explicitRemovedKeyMap[titleKey] || explicitRemovedKeyMap[signatureKey]) return;
            moduleRemovedCases.push({
              moduleId: source.moduleId,
              moduleKey: source.moduleKey,
              module: source.module,
              title: title,
              reason: '模型精简后未保留，判断为重复、重叠或可被其他用例覆盖',
              mergedInto: '',
              signature: signature,
            });
          });
        }
        moduleRemovedCases.forEach(function(item) {
          removedCases.push(item);
        });
        return result;
      });
      var beforeCount = resultModules.reduce(function(total, item) {
        return total + Number(item.beforeCount || 0);
      }, 0);
      var afterCount = resultModules.reduce(function(total, item) {
        return total + Number(item.afterCount || 0);
      }, 0);
      return {
        modules: resultModules,
        beforeCount: beforeCount,
        afterCount: afterCount,
        removedCount: Math.max(0, beforeCount - afterCount, removedCases.length),
        removedCases: removedCases,
        diagnostics: diagnostics,
      };
    }

    return {
      buildDedupeRequest: buildDedupeRequest,
      normalizeDedupeResult: normalizeDedupeResult,
    };
  }

  window.app = window.app || {};
  window.app.xmindCaseDedupeCore = { init: init };
})();
