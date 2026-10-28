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

    function normalizeCaseId(value) {
      return normalizeText(value);
    }

    function getCaseDedupeId(item) {
      if (!item || typeof item !== 'object') return '';
      return normalizeCaseId(item.dedupe_id || item.dedupeId || item.dedupeID || item.id || item.caseId || item.case_id || '');
    }

    function stableValue(value, isRoot) {
      if (value === null || value === undefined) return value;
      if (typeof value === 'string') return value.replace(/\r\n?/g, '\n').trim();
      if (typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.map(function(item) { return stableValue(item, false); });
      var result = {};
      Object.keys(value).sort().forEach(function(key) {
        if (isRoot && (key === 'dedupe_id' || key === 'dedupeId' || key === 'dedupeID'
          || key === 'id' || key === 'caseId' || key === 'case_id')) return;
        result[key] = stableValue(value[key], false);
      });
      return result;
    }

    function stableStringify(value, stripIdentity) {
      try {
        return JSON.stringify(stableValue(value, stripIdentity === true));
      } catch (err) {
        return '';
      }
    }

    function assignDedupeIds(modules, options) {
      var activeOptions = options && typeof options === 'object' ? options : {};
      var idPrefix = normalizeText(activeOptions.idPrefix || 'generated') || 'generated';
      var used = Object.create(null);
      return (Array.isArray(modules) ? modules : []).map(function(moduleItem, moduleIndex) {
        var moduleCopy = cloneJson(moduleItem, {});
        if (!moduleCopy || typeof moduleCopy !== 'object') return moduleCopy;
        var moduleTitle = normalizeModuleTitle(moduleCopy.module || moduleCopy.moduleName || moduleCopy.module_name || moduleCopy.title || '');
        var moduleKey = normalizeModuleKey(moduleCopy.moduleKey || moduleCopy.module_key || moduleCopy.key || moduleTitle);
        moduleCopy.module = moduleCopy.module || moduleTitle;
        moduleCopy.moduleKey = moduleCopy.moduleKey || moduleKey;
        moduleCopy.cases = normalizeCaseList(moduleCopy.cases).map(function(caseItem, caseIndex) {
          var item = cloneJson(caseItem, {});
          var existing = getCaseDedupeId(item);
          var candidate = existing || idPrefix + ':' + String(moduleIndex + 1) + ':' + String(caseIndex + 1) + ':' + moduleKey;
          var suffix = 1;
          while (used[candidate]) {
            candidate = (existing || idPrefix + ':' + String(moduleIndex + 1) + ':' + String(caseIndex + 1) + ':' + moduleKey) + ':' + String(suffix);
            suffix += 1;
          }
          used[candidate] = true;
          item.dedupe_id = candidate;
          return item;
        });
        return moduleCopy;
      });
    }

    function prepareDedupeModules(list, options) {
      return assignDedupeIds(normalizeModulesInput(list), options);
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
      if (list !== undefined && list !== null && !Array.isArray(list)) throw new Error('AI去重输入模块列表无效');
      var result = [];
      var seen = Object.create(null);
      (Array.isArray(list) ? Array.from(list) : []).forEach(function(item) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('AI去重输入模块无效');
        if (!Array.isArray(item.cases)) throw new Error('AI去重输入模块 cases 必须是数组');
        if (!item.cases.length) return;
        for (var caseIndex = 0; caseIndex < item.cases.length; caseIndex += 1) {
          var caseItem = item.cases[caseIndex];
          if (!caseItem || typeof caseItem !== 'object' || Array.isArray(caseItem)) throw new Error('AI去重输入用例无效');
          var caseCopy = cloneJson(caseItem, null);
          if (!caseCopy || typeof caseCopy !== 'object' || Array.isArray(caseCopy)) throw new Error('AI去重输入用例无效');
        }
        var normalized = normalizeModuleInput(item);
        if (!normalized) throw new Error('AI去重输入模块无效');
        if (seen[normalized.moduleKey]) throw new Error('AI去重输入模块键重复：' + normalized.moduleKey);
        seen[normalized.moduleKey] = true;
        result.push(normalized);
      });
      return result;
    }

    function normalizeReferenceModulesInput(list) {
      if (list !== undefined && list !== null && !Array.isArray(list)) throw new Error('AI去重只读参考模块列表无效');
      return (Array.isArray(list) ? Array.from(list) : []).map(function(item) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('AI去重只读参考模块无效');
        if (!Array.isArray(item.cases)) throw new Error('AI去重只读参考模块 cases 必须是数组');
        if (!item.cases.length) return null;
        var title = normalizeModuleTitle(item.module || item.moduleName || item.module_name || item.title || '');
        var key = normalizeModuleKey(item.moduleKey || item.module_key || item.key || title);
        var cases = [];
        for (var caseIndex = 0; caseIndex < item.cases.length; caseIndex += 1) {
          var caseItem = item.cases[caseIndex];
          if (!caseItem || typeof caseItem !== 'object' || Array.isArray(caseItem)) throw new Error('AI去重只读参考用例无效');
          var caseCopy = cloneJson(caseItem, null);
          if (!caseCopy || typeof caseCopy !== 'object' || Array.isArray(caseCopy)) throw new Error('AI去重只读参考用例无效');
          cases.push(caseCopy);
        }
        if (!title || !key) throw new Error('AI去重只读参考模块无效');
        return {
          moduleId: item.moduleId || item.module_id ? String(item.moduleId || item.module_id || '') : '',
          moduleKey: key,
          module: title,
          key_scenarios: Array.isArray(item.key_scenarios) ? item.key_scenarios.slice() : [],
          test_points: Array.isArray(item.test_points) ? item.test_points.slice() : [],
          coupled_modules: Array.isArray(item.coupled_modules) ? item.coupled_modules.slice() : [],
          cases: cases,
        };
      }).filter(Boolean);
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
      } catch (err) {
        return null;
      }
    }

    function normalizeCaseTitle(item, fallback) {
      if (!item || typeof item !== 'object') return normalizeText(fallback || '未命名用例') || '未命名用例';
      return normalizeText(item.title || item.caseTitle || item.case_title || item.name || item['标题'] || item['用例标题'] || fallback || '未命名用例') || '未命名用例';
    }

    function normalizeCaseSteps(item) {
      if (!item || typeof item !== 'object') return '';
      if (Array.isArray(item.steps)) return item.steps.map(normalizeText).join('|');
      return normalizeText(item.steps || item.step || item.actions || item['步骤'] || item['操作步骤'] || '');
    }

    function buildCaseSignature(item, moduleTitle) {
      var source = item && typeof item === 'object' ? item : {};
      var normalized = stableValue(source, true);
      if (normalized && typeof normalized === 'object') {
        delete normalized.module;
        delete normalized.moduleName;
        delete normalized.module_name;
      }
      return normalizeModuleKey(moduleTitle || source.module || source.moduleName || '')
        + '::' + stableStringify(normalized, true);
    }

    function buildCaseTitleKey(moduleKey, title) {
      return String(moduleKey || '') + '::' + normalizeText(title || '');
    }

    function normalizeStringList(value) {
      var seen = Object.create(null);
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
      var map = Object.create(null);
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
      var seen = Object.create(null);
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

    function buildDedupePrompt(mode, options) {
      var dedupeMode = normalizeDedupeMode(mode);
      var promptOptions = options && typeof options === 'object' ? options : {};
      var batchMode = promptOptions.batchMode === true;
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
      var batchLines = batchMode
        ? [
          '本次为全局去重的有界批次：target_modules 是本批唯一可编辑用例；readonly_reference_modules 是更早批次的只读用例摘要。',
          '必须把 target_modules 与 readonly_reference_modules 一起用于重复候选审查，但只能删除、合并或改写 target_modules 中的用例。',
          '当目标用例与只读引用重复时，保留只读引用对应覆盖，在目标模块中删除重复项并使用 duplicate 关系；merge 只能指向本批可编辑的保留用例，不得合并到只读引用；不得返回或改写只读引用模块。',
          'modules 必须返回 target_modules 中的全部模块（包括未变化模块），removed_cases 也只能记录 target_modules 中被处理的用例。',
        ]
        : [];
      return [
        '你是资深测试用例评审专家，请对 XMind AI 生成用例做整份用例全局去重。',
        '最终目标：这些用例会被用于保障项目产品质量，帮助团队更早发现缺陷、降低回归风险、提升用户体验稳定性。',
        modeLines.join('\n'),
        batchLines.join('\n'),
        '质量优先级高于数量压缩：不要为了让用例更少而削弱关键业务路径、用户高频路径、异常路径、边界条件、权限/安全、数据一致性、兼容性和状态流转覆盖。',
        '处理后的用例必须仍然有足够的缺陷发现能力和回归验证价值；如果不确定某条用例是否冗余，应保留。',
        '去重审查方法：',
        'A. 必须把所有输入模块下的用例视为一份完整用例集，全局审查每个模块和每条用例；先按标题、前置条件、步骤、预期结果、具体测试目的、测试点和校验目标归一化分组，建立重复候选簇，再对候选簇做精审，不能发现少量重复后提前停止。',
        'B. 处理顺序必须先做每个模块内去重，再做跨模块去重；跨模块也属于本次去重范围，不要因为用例归属模块不同就跳过。只要具体测试目的和测试点基本一致，触发条件、核心步骤与预期校验覆盖同一件事，即使标题、模块名、表达方式不同，也应判为重复候选；明显无关的组合不需要机械枚举。',
        'C. 对同义表达保持敏感：例如“禁用/禁止/不可用”、“可发射/可使用/允许触发”、“数量显示/储存显示/显示一致性”等，如果测试目的、测试点、触发条件和预期结果基本一致，应判为重复候选。',
        'D. 只有当两条用例分别验证不同业务对象、不同用户路径、不同状态流转、不同异常/边界/权限/数据风险点时，才应保留为独立覆盖；不能仅因模块不同而保留重复用例。',
        'E. 输出前必须确认整份用例集、每个输入模块以及所有模块内和跨模块重复候选都已完成审查，并把所有明确重复或合并关系写入 removed_cases；不得只返回第一批发现的重复项。',
        batchMode
          ? 'F. 本批必须返回 target_modules 中的全部模块；每个模块必须带回 moduleId、moduleKey、module 和完整 cases 数组，即使该模块未发生变化也不能省略。'
          : 'F. modules 允许只返回发生变化的模块；发生删除、合并、改写的模块必须返回该模块完整 cases。未发生变化的模块可以省略，系统会原样保留；如果返回未变化模块，也必须原样带回 moduleId、moduleKey、module 和 cases。',
        '约束：',
        '1. 只能处理输入模块中已有的用例，不得新增模块。',
        '2. 不要为了减少数量牺牲有独立测试目的、独立测试点的关键功能、异常、边界、权限、数据校验、状态流转覆盖。',
        '3. 只有在合并重复用例或开启“去重并精简”时，才允许改写标题、步骤、预期。',
        '优先级、前置条件、备注及其他元数据必须原样保留；merge 不得指向只读参考用例。',
        batchMode
          ? '4. 本批所有 target_modules 都必须返回 moduleId、moduleKey、module 和完整 cases 数组。'
          : '4. 发生变化的模块必须返回该模块的 moduleId、moduleKey、module 和完整 cases 数组；未变化模块可以不返回。',
        '5. 只返回 JSON，不要输出解释文本。',
        '6. 必须在 removed_cases 中逐条列出去掉、重复或合并的原用例，并说明处理关系；没有去掉则返回空数组。',
        '7. 如果是重复删除，removed_cases.type 返回 "duplicate"，优先使用 dedupe_id 和 duplicate_with_id 指向原用例与最终保留用例，同时兼容唯一标题 duplicate_with；duplicate_point 用 12 个中文字以内说明重复点，例如“步骤和预期一致”“校验目标相同”。',
        '8. 如果是合并，removed_cases.type 返回 "merge"，使用 merged_from_ids/merged_into_id 指向所有合并源和最终保留用例，同时兼容唯一标题 merged_from/merged_into。',
        '9. removed_cases.reason 必须言简意赅，控制在 20 个中文字以内，只写核心原因，如“覆盖高度重叠”“步骤重复”“场景已合并”。',
        '返回格式：{"modules":[{"moduleId":"输入中的moduleId","moduleKey":"输入中的moduleKey","module":"发生变化的模块名","cases":[{"dedupe_id":"输入用例dedupe_id","module":"模块名","title":"用例标题","priority":"P1","preconditions":"前置条件","steps":["1、步骤"],"expected":"预期结果"}]}],"removed_cases":[{"type":"duplicate","dedupe_id":"被去掉用例ID","duplicate_with_id":"最终保留用例ID","module":"模块名","title":"被去掉的原用例标题","reason":"步骤重复","duplicate_with":"保留用例标题","duplicate_point":"步骤和预期一致"},{"type":"merge","merged_from_ids":["合并源用例ID"],"merged_into_id":"最终保留用例ID","module":"模块名","reason":"场景已合并","merged_from":["合并前用例1"],"merged_into":"合并后用例标题"}],"summary":{"removed":0,"reason":"简述"}}',
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
      var modules = prepareDedupeModules(source.modules, source);
      var referenceModules = assignDedupeIds(normalizeReferenceModulesInput(source.referenceModules), {
        idPrefix: source.referenceIdPrefix || 'reference',
      });
      var batchMode = source.batchMode === true;
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
          batch_mode: batchMode,
          batch_index: Number(source.batchIndex || 0),
          batch_count: Number(source.batchCount || 0),
          return_full_replacement: false,
          return_changed_modules_only_allowed: !batchMode,
          editable_scope: 'ai_generated_cases_only',
          quality_goal: 'improve_product_quality_without_reducing_coverage_or_defect_detection_value',
          dedupe_scope: 'all_input_modules_global',
          dedupe_order: ['within_module', 'cross_module'],
          cross_module_dedupe: true,
          editable_module_keys: modules.map(function(item) { return item.moduleKey; }),
          readonly_reference_module_keys: referenceModules.map(function(item) { return item.moduleKey; }),
          readonly_reference_policy: batchMode ? {
            compare_against_references: true,
            references_are_not_editable: true,
            keep_reference_when_duplicate: true,
            return_reference_modules: false,
          } : null,
          module_return_policy: {
            return_all_input_modules: batchMode,
            preserve_module_id_and_key: true,
            unchanged_modules_must_be_returned: batchMode,
            partial_modules_response_allowed: !batchMode,
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
        referenceModules: referenceModules,
      };
      if (!batchMode) {
        delete payload.operation_contract.batch_mode;
        delete payload.operation_contract.batch_index;
        delete payload.operation_contract.batch_count;
        delete payload.operation_contract.editable_module_keys;
        delete payload.operation_contract.readonly_reference_module_keys;
        delete payload.operation_contract.readonly_reference_policy;
      }
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
      if (batchMode) {
        requestText += [
          '',
          '【只读的跨批次用例摘要(JSON，不得回写)】',
          payload.referenceModules.length ? JSON.stringify(payload.referenceModules) : '[]',
        ].join('\n');
      }
      return {
        prompt: buildDedupePrompt(dedupeMode, { batchMode: batchMode }),
        requestText: requestText,
        modules: modules,
        referenceModules: referenceModules,
        batchMode: batchMode,
        dedupeMode: dedupeMode,
        partialModulesResponseAllowed: !batchMode,
        beforeCaseCount: modules.reduce(function(total, item) {
          return total + (Array.isArray(item.cases) ? item.cases.length : 0);
        }, 0),
      };
    }

    function normalizeDedupeResult(rawText, inputModules, options) {
      var opts = options || {};
      var dedupeMode = normalizeDedupeMode(opts.dedupeMode || opts.mode);
      var allowPartialModulesResponse = opts.allowPartialModulesResponse === true
        || opts.partialModulesResponseAllowed === true;
      var sourceModules = prepareDedupeModules(inputModules, opts);
      var referenceModules = assignDedupeIds(normalizeReferenceModulesInput(opts.referenceModules), {
        idPrefix: opts.referenceIdPrefix || 'reference',
      });
      var moduleMap = Object.create(null);
      var moduleTitleMap = Object.create(null);
      var moduleIdMap = Object.create(null);
      var caseIdMap = Object.create(null);
      var titleMap = Object.create(null);
      var signatureMap = Object.create(null);
      function fail(message) {
        throw new Error('AI去重结果校验失败：' + message);
      }
      function addModuleIndex(moduleItem, editable) {
        if (!moduleItem) fail('模块无效');
        if (moduleMap[moduleItem.moduleKey] && editable) fail('模块重复或模块键冲突');
        if (!moduleMap[moduleItem.moduleKey]) moduleMap[moduleItem.moduleKey] = { module: moduleItem, editable: editable };
        var titleKey = normalizeModuleKey(moduleItem.module);
        if (!moduleTitleMap[titleKey]) moduleTitleMap[titleKey] = { module: moduleItem, editable: editable };
        else if (editable && moduleTitleMap[titleKey].editable) fail('模块标题重复');
        if (moduleItem.moduleId) {
          if (moduleIdMap[moduleItem.moduleId]
            && moduleIdMap[moduleItem.moduleId].module.moduleKey !== moduleItem.moduleKey) fail('模块ID重复');
          if (!moduleIdMap[moduleItem.moduleId]) moduleIdMap[moduleItem.moduleId] = { module: moduleItem, editable: editable };
        }
        moduleItem.cases.forEach(function(caseItem) {
          var id = getCaseDedupeId(caseItem);
          if (!id || caseIdMap[id]) fail('用例 dedupe_id 重复或为空');
          caseIdMap[id] = { caseItem: caseItem, module: moduleItem, editable: editable };
          var titleKey = buildCaseTitleKey(moduleItem.moduleKey, normalizeCaseTitle(caseItem, ''));
          if (!titleMap[titleKey]) titleMap[titleKey] = [];
          titleMap[titleKey].push(caseIdMap[id]);
          var signature = buildCaseSignature(caseItem, moduleItem.module);
          if (!signatureMap[signature]) signatureMap[signature] = [];
          signatureMap[signature].push(caseIdMap[id]);
        });
      }
      sourceModules.forEach(function(item) { addModuleIndex(item, true); });
      referenceModules.forEach(function(item) { addModuleIndex(item, false); });
      var payload = extractJsonPayload(rawText);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('JSON 顶层必须是对象');
      if (payload.error || payload.errors || payload.ok === false || payload.success === false) fail('模型返回错误对象');
      var rawModules = payload.modules;
      if (!Array.isArray(rawModules)) fail('modules 必须是数组');
      var outputMap = Object.create(null);
      rawModules.forEach(function(item) {
        if (!item || typeof item !== 'object') fail('模块项无效');
        var moduleId = normalizeText(item.moduleId || item.module_id || '');
        var title = normalizeModuleTitle(item.module || item.moduleName || item.module_name || item.title || item.moduleTitle || item.module_title || '');
        var key = normalizeModuleKey(item.moduleKey || item.module_key || item.key || title);
        var indexed = moduleMap[key] || moduleTitleMap[normalizeModuleKey(title)] || (moduleId ? moduleIdMap[moduleId] : null);
        if (!indexed || !indexed.editable) fail('未知或只读模块：' + (key || moduleId));
        if (moduleId && moduleId !== indexed.module.moduleId) fail('模块ID被改写');
        if ((item.moduleKey !== undefined || item.module_key !== undefined || item.key !== undefined)
          && key !== indexed.module.moduleKey) fail('模块键被改写');
        var explicitTitle = item.module || item.moduleName || item.module_name || item.title || item.moduleTitle || item.module_title;
        if (explicitTitle && normalizeModuleTitle(explicitTitle) !== indexed.module.module) fail('模块标题被改写');
        if (outputMap[indexed.module.moduleKey]) fail('重复返回模块：' + indexed.module.module);
        if (!Array.isArray(item.cases)) fail('模块 cases 必须是数组');
        outputMap[indexed.module.moduleKey] = { source: indexed.module, cases: item.cases };
      });
      function resolveCase(value, moduleHint, allowReference) {
        var explicitId = value && typeof value === 'object'
          && (value.dedupe_id !== undefined || value.dedupeId !== undefined || value.id !== undefined || value.caseId !== undefined || value.case_id !== undefined);
        var id = normalizeText(value && typeof value === 'object'
          ? (value.dedupe_id || value.dedupeId || value.id || value.caseId || value.case_id || '') : value);
        if (id) {
          var byId = caseIdMap[id];
          if (byId) {
            if (!allowReference && !byId.editable) fail('关系目标不存在：' + id);
            return byId;
          }
          if (explicitId) fail('关系目标不存在：' + id);
        }
        if (explicitId && !id) fail('关系目标ID为空');
        var title = normalizeCaseTitle(value && typeof value === 'object' ? value : { title: value }, '');
        var keys = [];
        if (moduleHint) keys.push(buildCaseTitleKey(normalizeModuleKey(moduleHint), title));
        else Object.keys(titleMap).forEach(function(key) {
          if (key.slice(key.indexOf('::') + 2) === title) keys.push(key);
        });
        var candidates = [];
        keys.forEach(function(key) {
          (titleMap[key] || []).forEach(function(item) {
            if (allowReference || item.editable) candidates.push(item);
          });
        });
        if (candidates.length !== 1) {
          var signature = value && typeof value === 'object' ? buildCaseSignature(value, moduleHint || '') : '';
          var bySignature = signatureMap[signature] || [];
          candidates = bySignature.filter(function(item) { return allowReference || item.editable; });
        }
        if (candidates.length !== 1) fail('关系标题不唯一或目标不存在：' + title);
        return candidates[0];
      }
      function readRelationId(item, names) {
        for (var i = 0; i < names.length; i += 1) {
          if (item[names[i]] !== undefined && item[names[i]] !== null && normalizeText(item[names[i]])) return normalizeText(item[names[i]]);
        }
        return '';
      }
      function relationModuleHint(item, prefix) {
        return item[prefix + '_module_key'] || item[prefix + '_module'] || item[prefix + 'ModuleKey'] || item[prefix + 'Module'] || '';
      }
      var removedRecords = [];
      var removedSourceIds = Object.create(null);
      var mergeTargetIds = Object.create(null);
      var removedItems = payload.removed_cases !== undefined ? payload.removed_cases : payload.removedCases;
      if (removedItems === undefined && payload.summary && typeof payload.summary === 'object') {
        removedItems = payload.summary.removed_cases !== undefined ? payload.summary.removed_cases : payload.summary.removedCases;
      }
      if (!Array.isArray(removedItems)) fail('removed_cases 必须是数组');
      if (!allowPartialModulesResponse) {
        var missingModules = sourceModules.filter(function(item) { return !outputMap[item.moduleKey]; });
        if (missingModules.length) fail('模型未返回全部模块：' + summarizeModuleNames(missingModules.map(function(item) { return item.module; })));
      }
      removedItems.forEach(function(item) {
        if (!item || typeof item !== 'object') fail('删除记录无效');
        var moduleHint = item.moduleKey || item.module_key || item.module || item.moduleName || '';
        var sourceModule = moduleHint ? moduleMap[normalizeModuleKey(moduleHint)] || moduleTitleMap[normalizeModuleKey(moduleHint)] || moduleIdMap[normalizeText(moduleHint)] : null;
        var sourceIds = [];
        var hasMergeIds = item.merged_from_ids !== undefined || item.mergedFromIds !== undefined;
        var mergedIds = item.merged_from_ids || item.mergedFromIds || item.merged_from || item.mergedFrom || [];
        if (!Array.isArray(mergedIds)) mergedIds = [mergedIds];
        mergedIds.forEach(function(value) {
          var resolved = resolveCase(hasMergeIds ? { dedupe_id: value } : value, moduleHint, false);
          sourceIds.push(resolved);
        });
        var sourceId = readRelationId(item, ['dedupe_id', 'dedupeId', 'id']);
        if (!sourceIds.length && sourceId) sourceIds.push(resolveCase({ dedupe_id: sourceId }, moduleHint, false));
        if (!sourceIds.length) {
          var title = item.title || item.caseTitle || item.case_title || item.name || '';
          if (!title) fail('删除记录未说明原用例');
          sourceIds.push(resolveCase(title, sourceModule ? sourceModule.module.moduleKey : moduleHint, false));
        }
        var actionType = normalizeRemovedActionType(item.type || item.action || item.actionType || item.action_type || item.kind || '', {
          duplicateOf: item.duplicate_with_id || item.duplicateWithId || item.duplicate_with || item.duplicateWith || item.duplicate_of || item.duplicateOf,
          mergedFrom: mergedIds,
        });
        var targetId = actionType === 'duplicate'
          ? readRelationId(item, ['duplicate_with_id', 'duplicateWithId', 'duplicate_of_id', 'duplicateOfId'])
          : readRelationId(item, ['merged_into_id', 'mergedIntoId']);
        var targetValue = targetId || item.duplicate_with || item.duplicateWith || item.duplicate_of || item.duplicateOf || item.merged_into || item.mergedInto || item.targetTitle || item.target_title || '';
        if (!targetValue) fail('删除关系未说明保留目标');
        var target = resolveCase(targetId ? { dedupe_id: targetId } : targetValue, relationModuleHint(item, actionType === 'duplicate' ? 'duplicate_with' : 'merged_into') || moduleHint, true);
        if (!target || !target.caseItem) fail('保留目标不存在');
        if (actionType === 'merge' && !target.editable) fail('不能将生成用例合并到只读参考用例');
        if (removedSourceIds[getCaseDedupeId(target.caseItem)]) fail('保留目标也被删除');
        var deletionSources = sourceIds.filter(function(source) {
          return actionType !== 'merge' || getCaseDedupeId(source.caseItem) !== getCaseDedupeId(target.caseItem);
        });
        if (!deletionSources.length) fail('合并关系没有被合并删除的原用例');
        deletionSources.forEach(function(source) {
          if (!source.editable) fail('不能删除只读参考用例');
          var id = getCaseDedupeId(source.caseItem);
          if (id === getCaseDedupeId(target.caseItem)) fail('删除源与保留目标相同');
          if (removedSourceIds[id]) fail('重复删除同一用例：' + id);
          removedSourceIds[id] = true;
          removedRecords.push({
            dedupe_id: id,
            moduleId: source.module.moduleId,
            moduleKey: source.module.moduleKey,
            module: source.module.module,
            title: normalizeCaseTitle(source.caseItem, ''),
            reason: normalizeDedupeReason(item.reason || item.removeReason || item.remove_reason || item.dedupeReason || item.dedupe_reason || item.cause || ''),
            actionType: actionType,
            duplicateOf: normalizeText(item.duplicate_of || item.duplicateOf || item.duplicate_with || item.duplicateWith || ''),
            duplicateWithId: actionType === 'duplicate' ? getCaseDedupeId(target.caseItem) : '',
            duplicatePoint: normalizeDedupeReason(item.duplicate_point || item.duplicatePoint || item.overlapPoint || item.overlap_point || ''),
            mergedInto: actionType === 'merge' ? normalizeCaseTitle(target.caseItem, '') : '',
            mergedIntoId: actionType === 'merge' ? getCaseDedupeId(target.caseItem) : '',
            mergedFrom: actionType === 'merge' ? [normalizeCaseTitle(source.caseItem, '')] : [],
            mergedFromIds: actionType === 'merge' ? [id] : [],
            signature: buildCaseSignature(source.caseItem, source.module.module),
          });
          if (actionType === 'merge') mergeTargetIds[getCaseDedupeId(target.caseItem)] = true;
        });
      });
      removedRecords.forEach(function(record) {
        var targetId = record.duplicateWithId || record.mergedIntoId;
        if (targetId && removedSourceIds[targetId]) fail('保留目标也被删除：' + targetId);
      });
      var resultModules = sourceModules.map(function(source) {
        var output = outputMap[source.moduleKey];
        var usedFallback = !output;
        var rawCases = output ? output.cases : source.cases;
        if (!Array.isArray(rawCases)) fail('输出用例无效');
        if (usedFallback && removedSourceIdsForModule(removedSourceIds, source)) fail('模块未返回但声明了删除：' + source.module);
        var seenOutput = Object.create(null);
        var outputCases = rawCases.map(function(rawCase) {
          if (!rawCase || typeof rawCase !== 'object') fail('输出用例无效');
          var resolved = resolveCase(rawCase, source.moduleKey, false);
          var sourceId = getCaseDedupeId(resolved.caseItem);
          if (removedSourceIds[sourceId]) fail('被删除用例仍在输出中：' + sourceId);
          ['id', 'caseId', 'case_id'].forEach(function(identityKey) {
            if (rawCase[identityKey] !== undefined && resolved.caseItem[identityKey] !== undefined
              && normalizeText(rawCase[identityKey]) !== normalizeText(resolved.caseItem[identityKey])) {
              fail('输出用例标识被改写：' + sourceId);
            }
          });
          if (seenOutput[sourceId]) fail('输出重复用例：' + sourceId);
          seenOutput[sourceId] = true;
          var copy = cloneJson(rawCase, {});
          Object.keys(copy).forEach(function(key) {
            if (key === 'dedupe_id' || key === 'dedupeId' || key === 'dedupeID') return;
            if (!Object.prototype.hasOwnProperty.call(resolved.caseItem, key)) fail('输出包含非法字段：' + key);
          });
          if (rawCase.dedupeId !== undefined && normalizeCaseId(rawCase.dedupeId) !== sourceId) fail('输出用例标识被改写：' + sourceId);
          if (rawCase.dedupeID !== undefined && normalizeCaseId(rawCase.dedupeID) !== sourceId) fail('输出用例标识被改写：' + sourceId);
          var requiredTextKeys = ['title', 'caseTitle', 'case_title', 'name', '标题', '用例标题', 'steps', 'step', 'actions', '步骤', '操作步骤', 'expected', 'expect', 'result', '预期结果'];
          var editableKeys = requiredTextKeys;
          function isValidTextValue(value, allowEmpty) {
            if (typeof value === 'string') return allowEmpty || Boolean(normalizeText(value));
            if (Array.isArray(value)) return (allowEmpty || value.length > 0) && value.every(function(part) {
              return typeof part === 'string' && (allowEmpty || Boolean(normalizeText(part)));
            });
            return false;
          }
          Object.keys(resolved.caseItem).forEach(function(key) {
            var isRequired = requiredTextKeys.indexOf(key) !== -1;
            if (isRequired) {
              if (!Object.prototype.hasOwnProperty.call(copy, key) || !isValidTextValue(copy[key], false)) fail('输出用例缺少或清空关键内容字段：' + key);
              if (['title', 'caseTitle', 'case_title', 'name', '标题', '用例标题'].indexOf(key) !== -1 && typeof copy[key] !== 'string') fail('用例标题必须是字符串');
            } else if (!Object.prototype.hasOwnProperty.call(copy, key)) {
              copy[key] = cloneJson(resolved.caseItem[key], resolved.caseItem[key]);
            }
            if (['priority', 'level', '优先级'].indexOf(key) !== -1 && normalizeText(resolved.caseItem[key]) && !normalizeText(copy[key])) fail('用例优先级不能为空');
            if (['priority', 'level', '优先级'].indexOf(key) !== -1 && copy[key] !== '' && copy[key] !== null && copy[key] !== undefined
              && (typeof copy[key] !== 'string' || ['P0', 'P1', 'P2'].indexOf(copy[key].toUpperCase()) === -1)) fail('用例优先级无效');
            if (['preconditions', 'precondition', '前置条件', '前提条件'].indexOf(key) !== -1 && !isValidTextValue(copy[key], true)) fail('用例前置条件类型无效');
            if (editableKeys.indexOf(key) === -1 && stableStringify(copy[key], false) !== stableStringify(resolved.caseItem[key], false)) fail('输出用例元数据被改写：' + key);
          });
          copy.dedupe_id = sourceId;
          if (!isDedupeSimplifyMode(dedupeMode)
            && !mergeTargetIds[sourceId]
            && stableStringify(copy, true) !== stableStringify(resolved.caseItem, true)) fail('仅去重模式擅自改写用例：' + sourceId);
          return copy;
        });
        var expectedSourceIds = Object.create(null);
        source.cases.forEach(function(caseItem) { expectedSourceIds[getCaseDedupeId(caseItem)] = true; });
        Object.keys(seenOutput).forEach(function(id) {
          if (!expectedSourceIds[id]) fail('输出包含未知用例：' + id);
        });
        source.cases.forEach(function(caseItem) {
          var id = getCaseDedupeId(caseItem);
          if (!seenOutput[id] && !removedSourceIds[id]) fail('用例未返回且未说明删除：' + id);
        });
        if (!outputCases.length && !Object.keys(seenOutput).length && !source.cases.every(function(caseItem) { return removedSourceIds[getCaseDedupeId(caseItem)]; })) {
          fail('空模块没有完整删除关系：' + source.module);
        }
        return {
          moduleId: source.moduleId,
          moduleKey: source.moduleKey,
          module: source.module,
          beforeCount: source.cases.length,
          afterCount: outputCases.length,
          usedFallback: usedFallback,
          cases: outputCases,
        };
      });
      function removedSourceIdsForModule(map, moduleItem) {
        return moduleItem.cases.some(function(caseItem) { return map[getCaseDedupeId(caseItem)]; });
      }
      var beforeCount = resultModules.reduce(function(total, item) { return total + item.beforeCount; }, 0);
      var afterCount = resultModules.reduce(function(total, item) { return total + item.afterCount; }, 0);
      var diagnostics = [];
      return {
        modules: resultModules,
        beforeCount: beforeCount,
        afterCount: afterCount,
        removedCount: Math.max(0, beforeCount - afterCount),
        removedCases: removedRecords,
        diagnostics: diagnostics,
      };
    }

    return {
      buildDedupeRequest: buildDedupeRequest,
      prepareDedupeModules: prepareDedupeModules,
      normalizeDedupeResult: normalizeDedupeResult,
    };
  }

  window.app = window.app || {};
  window.app.xmindCaseDedupeCore = { init: init };
})();
