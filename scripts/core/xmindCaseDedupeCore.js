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
      var title = normalizeModuleTitle(item.module || item.moduleName || item.module_name || item.title || item.moduleTitle || item.module_title || '');
      var key = normalizeModuleKey(item.moduleKey || item.module_key || item.key || title);
      var cases = normalizeCaseList(item.cases);
      if (!key || !title || !cases.length) return null;
      return {
        moduleId: item.moduleId || item.module_id ? String(item.moduleId || item.module_id || '') : '',
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

    function normalizeDedupeMode(value) {
      return String(value || '') === 'dedupe_simplify' ? 'dedupe_simplify' : 'dedupe_only';
    }

    function isDedupeSimplifyMode(value) {
      return normalizeDedupeMode(value) === 'dedupe_simplify';
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

    function normalizeStringList(value) {
      var seen = {};
      var source = Array.isArray(value)
        ? value
        : (value === null || value === undefined ? [] : [value]);
      return source.map(function(item) {
        if (item && typeof item === 'object') {
          return normalizeCaseTitle(item, item.title || item.name || '');
        }
        return normalizeText(item);
      }).filter(function(item) {
        if (!item || seen[item]) return false;
        seen[item] = true;
        return true;
      });
    }

    function normalizeRemovedActionType(value, detail) {
      var raw = normalizeText(value).toLowerCase();
      if (raw === 'merge' || raw === 'merged' || raw === 'combine' || raw.indexOf('合并') !== -1) return 'merge';
      if (raw === 'duplicate' || raw === 'dup' || raw.indexOf('重复') !== -1) return 'duplicate';
      if (detail && Array.isArray(detail.mergedFrom) && detail.mergedFrom.length) return 'merge';
      if (detail && detail.duplicateOf) return 'duplicate';
      return 'removed';
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

    function normalizeRemovedCaseRecords(item, moduleMap) {
      if (!item || typeof item !== 'object') return null;
      var rawCase = item.case && typeof item.case === 'object' ? item.case : item;
      var moduleTitle = normalizeModuleTitle(
        item.module || item.moduleName || item.module_title || rawCase.module || rawCase.moduleName || ''
      );
      var moduleKey = normalizeModuleKey(item.moduleKey || moduleTitle);
      var sourceModule = moduleMap[moduleKey];
      if (!sourceModule) return null;
      var reason = normalizeDedupeReason(
        item.reason || item.removeReason || item.remove_reason || item.dedupeReason || item.dedupe_reason || item.cause || ''
      );
      var mergedInto = normalizeText(
        item.mergedInto || item.merged_into || item.keepTitle || item.keep_title || item.keptCase || item.kept_case || item.targetTitle || item.target_title || ''
      );
      var duplicateOf = normalizeText(
        item.duplicateOf || item.duplicate_of || item.duplicateWith || item.duplicate_with || item.sameAs || item.same_as || ''
      );
      var duplicatePointSource = item.duplicatePoint || item.duplicate_point || item.overlapPoint || item.overlap_point || item.samePoint || item.same_point || item.overlap || '';
      var duplicatePoint = duplicatePointSource ? normalizeDedupeReason(duplicatePointSource) : '';
      var mergedFrom = normalizeStringList(item.mergedFrom || item.merged_from || item.sourceTitles || item.source_titles || item.beforeTitles || item.before_titles || []);
      var explicitTitleSource = item.title || item.caseTitle || item.case_title || item.name || rawCase.title || rawCase.caseTitle || rawCase.case_title || rawCase.name || '';
      var explicitTitle = explicitTitleSource ? normalizeCaseTitle(rawCase, explicitTitleSource) : '';
      var titles = explicitTitle ? [explicitTitle] : mergedFrom.slice();
      if (mergedInto) {
        titles = titles.filter(function(title) {
          return normalizeText(title).toLowerCase() !== normalizeText(mergedInto).toLowerCase();
        });
      }
      if (!titles.length && explicitTitle) titles = [explicitTitle];
      if (!titles.length) return null;
      var detail = {
        duplicateOf: duplicateOf,
        mergedFrom: mergedFrom,
      };
      var actionType = normalizeRemovedActionType(item.type || item.action || item.actionType || item.action_type || item.kind || '', detail);
      return titles.map(function(title) {
        return {
          moduleId: sourceModule.moduleId,
          moduleKey: sourceModule.moduleKey,
          module: sourceModule.module,
          title: title,
          reason: reason,
          actionType: actionType,
          duplicateOf: duplicateOf,
          duplicatePoint: duplicatePoint,
          mergedInto: mergedInto,
          mergedFrom: mergedFrom,
          signature: buildCaseSignature(rawCase, sourceModule.module),
        };
      });
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
        var records = normalizeRemovedCaseRecords(item, moduleMap);
        (Array.isArray(records) ? records : []).forEach(function(record) {
          if (!record) return;
          var key = record.moduleKey + '::'
            + (record.signature || buildCaseTitleKey(record.moduleKey, record.title))
            + '::' + record.reason
            + '::' + record.actionType
            + '::' + record.duplicateOf
            + '::' + record.mergedInto;
          if (seen[key]) return;
          seen[key] = true;
          result.push(record);
        });
      });
      return result;
    }

    function buildDedupePrompt(mode) {
      var dedupeMode = normalizeDedupeMode(mode);
      var modeLines = isDedupeSimplifyMode(dedupeMode)
        ? [
          '本次策略：去重并精简。',
          '在保证覆盖全面、质量稳定的前提下，删除或合并具体测试目的和测试点基本一致的重复用例，并减少表达冗余。',
          '可以重写标题、步骤、预期，使合并后的用例更清晰完整，但不得降低缺陷发现能力。',
        ]
        : [
          '本次策略：仅去重。',
          '只删除或合并具体测试目的和测试点基本一致、不会降低覆盖的重复用例。',
          '不要主动压缩用例数量，不要为了精简而删除有独立覆盖价值的业务路径、异常路径、边界条件或权限/安全场景。',
          '除必要合并重复用例外，尽量保留原用例标题、步骤、预期。',
        ];
      return [
        '你是资深测试用例评审专家，请对 XMind AI 生成用例做整份用例全局去重。',
        '最终目标：这些用例会被用于保障项目产品质量，帮助团队更早发现缺陷、降低回归风险、提升用户体验稳定性。',
        modeLines.join('\n'),
        '质量优先级高于数量压缩：不要为了让用例更少而削弱关键业务路径、用户高频路径、异常路径、边界条件、权限/安全、数据一致性、兼容性和状态流转覆盖。',
        '处理后的用例必须仍然有足够的缺陷发现能力和回归验证价值；如果不确定某条用例是否冗余，应保留。',
        '去重审查方法：',
        'A. 必须把所有输入模块下的用例视为一份完整用例集，全局审查每个模块和每条用例；先按标题、前置条件、步骤、预期结果、具体测试目的、测试点和校验目标归一化分组，建立重复候选簇，再对候选簇做精审，不能发现少量重复后提前停止。',
        'B. 处理顺序必须先做每个模块内去重，再做跨模块去重；跨模块也属于本次去重范围，不要因为用例归属模块不同就跳过。只要具体测试目的和测试点基本一致，触发条件、核心步骤与预期校验覆盖同一件事，即使标题、模块名、表达方式不同，也应判为重复候选；明显无关的组合不需要机械枚举。',
        'C. 对同义表达保持敏感：例如“禁用/禁止/不可用”、“可发射/可使用/允许触发”、“数量显示/储存显示/显示一致性”等，如果测试目的、测试点、触发条件和预期结果基本一致，应判为重复候选。',
        'D. 只有当两条用例分别验证不同业务对象、不同用户路径、不同状态流转、不同异常/边界/权限/数据风险点时，才应保留为独立覆盖；不能仅因模块不同而保留重复用例。',
        'E. 输出前必须确认整份用例集、每个输入模块以及所有模块内和跨模块重复候选都已完成审查，并把所有明确重复或合并关系写入 removed_cases；不得只返回第一批发现的重复项。',
        'F. modules 允许只返回发生变化的模块；发生删除、合并、改写的模块必须返回该模块完整 cases。未发生变化的模块可以省略，系统会原样保留；如果返回未变化模块，也必须原样带回 moduleId、moduleKey、module 和 cases。',
        '约束：',
        '1. 只能处理输入模块中已有的用例，不得新增模块。',
        '2. 不要为了减少数量牺牲有独立测试目的、独立测试点的关键功能、异常、边界、权限、数据校验、状态流转覆盖。',
        '3. 只有在合并重复用例或开启“去重并精简”时，才允许改写标题、步骤、预期。',
        '4. 发生变化的模块必须返回该模块的 moduleId、moduleKey、module 和完整 cases 数组；未变化模块可以不返回。',
        '5. 只返回 JSON，不要输出解释文本。',
        '6. 必须在 removed_cases 中逐条列出去掉、重复或合并的原用例，并说明处理关系；没有去掉则返回空数组。',
        '7. 如果是重复删除，removed_cases.type 返回 "duplicate"，duplicate_with 写保留的用例标题，duplicate_point 用 12 个中文字以内说明重复点，例如“步骤和预期一致”“校验目标相同”。',
        '8. 如果是合并，removed_cases.type 返回 "merge"，merged_from 写合并前的原用例标题数组，merged_into 写合并后的用例标题。',
        '9. removed_cases.reason 必须言简意赅，控制在 20 个中文字以内，只写核心原因，如“覆盖高度重叠”“步骤重复”“场景已合并”。',
        '返回格式：{"modules":[{"moduleId":"输入中的moduleId","moduleKey":"输入中的moduleKey","module":"发生变化的模块名","cases":[{"module":"模块名","title":"用例标题","priority":"P1","preconditions":"前置条件","steps":["1、步骤"],"expected":"预期结果"}]}],"removed_cases":[{"type":"duplicate","module":"模块名","title":"被去掉的原用例标题","reason":"步骤重复","duplicate_with":"保留用例标题","duplicate_point":"步骤和预期一致"},{"type":"merge","module":"模块名","title":"被合并的原用例标题","reason":"场景已合并","merged_from":["合并前用例1","合并前用例2"],"merged_into":"合并后用例标题"}],"summary":{"removed":0,"reason":"简述"}}',
      ].join('\n');
    }

    function summarizeModuleNames(list) {
      var source = Array.isArray(list) ? list : [];
      var names = source.map(function(item) {
        return normalizeModuleTitle(item || '');
      }).filter(Boolean);
      if (!names.length) return '';
      var preview = names.slice(0, 8).join('、');
      if (names.length > 8) preview += ' 等';
      return preview;
    }

    function buildDedupeRequest(input) {
      var source = input && typeof input === 'object' ? input : {};
      var modules = normalizeModulesInput(source.modules);
      var requirementText = String(source.requirementText || '').trim();
      var requirementSupplement = String(source.requirementSupplement || '').trim();
      var dedupeMode = normalizeDedupeMode(source.dedupeMode || source.mode);
      var payload = {
        operation_contract: {
          scope: 'xmind_ai_cases',
          mode: 'ai_dedupe_simplify',
          dedupe_mode: dedupeMode,
          dedupeMode: dedupeMode,
          simplify: isDedupeSimplifyMode(dedupeMode),
          strength: source.strength || 'conservative',
          source: source.source || 'manual-toolbar',
          return_full_replacement: false,
          return_changed_modules_only_allowed: true,
          editable_scope: 'ai_generated_cases_only',
          quality_goal: 'improve_product_quality_without_reducing_coverage_or_defect_detection_value',
          dedupe_scope: 'all_input_modules_global',
          dedupe_order: ['within_module', 'cross_module'],
          cross_module_dedupe: true,
          module_return_policy: {
            return_all_input_modules: false,
            preserve_module_id_and_key: true,
            unchanged_modules_must_be_returned: false,
            partial_modules_response_allowed: true,
          },
          review_method: 'global_candidate_cluster_scan',
          duplicate_detection_policy: {
            compare_fields: ['module', 'title', 'preconditions', 'steps', 'expected', 'test_purpose', 'test_point', 'validation_goal'],
            require_full_module_scan: true,
            require_global_case_scan: true,
            stop_after_first_duplicate: false,
            treat_synonyms_as_duplicate_candidates: true,
            prefer_same_module_dedupe: false,
            cross_module_dedupe: true,
            duplicate_when_same_test_purpose_and_point: true,
          },
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
        JSON.stringify(payload.modules),
      ].join('\n');
      return {
        prompt: buildDedupePrompt(dedupeMode),
        requestText: requestText,
        modules: modules,
        dedupeMode: dedupeMode,
        partialModulesResponseAllowed: true,
        beforeCaseCount: modules.reduce(function(total, item) {
          return total + (Array.isArray(item.cases) ? item.cases.length : 0);
        }, 0),
      };
    }

    function normalizeDedupeResult(rawText, inputModules, options) {
      var opts = options || {};
      var dedupeMode = normalizeDedupeMode(opts.dedupeMode || opts.mode);
      var resultLabel = isDedupeSimplifyMode(dedupeMode) ? '精简' : '去重';
      var allowPartialModulesResponse = opts.allowPartialModulesResponse === true
        || opts.partialModulesResponseAllowed === true;
      var modules = normalizeModulesInput(inputModules);
      var moduleMap = {};
      var moduleIdMap = {};
      modules.forEach(function(item) {
        moduleMap[item.moduleKey] = item;
        moduleMap[normalizeModuleKey(item.module)] = item;
        if (item.moduleId) moduleIdMap[item.moduleId] = item;
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
      var outputSeenMap = {};
      (Array.isArray(rawModules) ? rawModules : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var title = normalizeModuleTitle(item.module || item.moduleName || item.module_name || item.title || item.moduleTitle || item.module_title || '');
        var key = normalizeModuleKey(item.moduleKey || item.module_key || item.key || title);
        var sourceModule = moduleMap[key] || moduleIdMap[String(item.moduleId || item.module_id || '')];
        if (!sourceModule || outputSeenMap[sourceModule.moduleKey]) return;
        key = sourceModule.moduleKey;
        outputMap[key] = normalizeCaseList(item.cases);
        outputSeenMap[key] = true;
      });
      var diagnostics = [];
      var missingOutputModules = [];
      var emptyOutputModules = [];
      var removedCases = [];
      var resultModules = modules.map(function(source) {
        var outputCases = outputMap[source.moduleKey];
        var usedFallback = false;
        var hasOutputModule = outputSeenMap[source.moduleKey] === true;
        if (!hasOutputModule) {
          outputCases = normalizeCaseList(source.cases);
          usedFallback = true;
          missingOutputModules.push(source.module);
        } else if (!Array.isArray(outputCases) || !outputCases.length) {
          outputCases = normalizeCaseList(source.cases);
          usedFallback = true;
          emptyOutputModules.push(source.module);
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
        var moduleRemovedCases = usedFallback ? [] : (explicitRemovedByModule[source.moduleKey] || []).slice();
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
              reason: isDedupeSimplifyMode(dedupeMode)
                ? '模型精简后未保留，判断为重复、重叠或可被其他用例覆盖'
                : '模型去重后未保留，判断为重复或高度重叠',
              actionType: 'removed',
              duplicateOf: '',
              duplicatePoint: '',
              mergedInto: '',
              mergedFrom: [],
              signature: signature,
            });
          });
        }
        moduleRemovedCases.forEach(function(item) {
          removedCases.push(item);
        });
        return result;
      });
      if (missingOutputModules.length && !allowPartialModulesResponse) {
        diagnostics.push(
          '模型只返回了 ' + String(Math.max(0, modules.length - missingOutputModules.length))
          + '/' + String(modules.length) + ' 个模块的完整' + resultLabel + '结果，'
          + String(missingOutputModules.length) + ' 个未返回模块已保留原用例'
          + (summarizeModuleNames(missingOutputModules) ? '：' + summarizeModuleNames(missingOutputModules) : '')
        );
      }
      if (emptyOutputModules.length) {
        diagnostics.push(
          String(emptyOutputModules.length) + ' 个模块返回空用例，已保留原用例'
          + (summarizeModuleNames(emptyOutputModules) ? '：' + summarizeModuleNames(emptyOutputModules) : '')
        );
      }
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
