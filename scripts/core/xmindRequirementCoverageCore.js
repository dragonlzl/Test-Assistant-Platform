(function() {
  'use strict';

  function init(options) {
    var opts = options || {};
    var cloneJson = window.app.jsonCloneCore.cloneJson;

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

    function normalizeCaseTitle(item, fallback) {
      var source = item && typeof item === 'object' ? item : {};
      return normalizeText(
        source.title || source.caseTitle || source.case_title || source.name || source['标题'] || fallback || '未命名用例'
      ) || '未命名用例';
    }

    function normalizeCaseSteps(item) {
      if (!item || typeof item !== 'object') return [];
      if (Array.isArray(item.steps)) {
        return item.steps.map(function(step) { return normalizeText(step); }).filter(Boolean);
      }
      var text = normalizeText(item.steps || item.step || item['步骤'] || '');
      return text ? [text] : [];
    }

    function padNumber(value, size) {
      var text = String(Math.max(0, Number(value || 0) || 0));
      while (text.length < size) text = '0' + text;
      return text;
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

    function isBulletLine(line) {
      return /^\s*(?:[-*+]|\d+[.、)]|[（(]?\d+[）)]|[一二三四五六七八九十]+[、.．]|[A-Za-z][.、)])\s+/.test(String(line || ''));
    }

    function splitLongTextBlock(text, maxChars) {
      var raw = String(text || '');
      var limit = Math.max(160, Number(maxChars || 360) || 360);
      if (raw.length <= limit) return [raw];
      var result = [];
      var rest = raw;
      while (rest.length > limit) {
        var cut = -1;
        var searchStart = Math.max(80, Math.floor(limit * 0.55));
        var windowText = rest.slice(searchStart, limit + 1);
        var match = windowText.match(/[。！？；;.!?]\s*/g);
        if (match && match.length) {
          var last = match[match.length - 1];
          cut = rest.lastIndexOf(last, limit);
          if (cut >= 0) cut += last.length;
        }
        if (cut <= 0) {
          var commaCut = Math.max(rest.lastIndexOf('，', limit), rest.lastIndexOf(',', limit));
          cut = commaCut > searchStart ? commaCut + 1 : limit;
        }
        result.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) result.push(rest);
      return result.filter(Boolean);
    }

    function splitRequirementText(text) {
      var raw = String(text || '').replace(/\r\n?/g, '\n').trim();
      if (!raw) return [];
      var lines = raw.split('\n');
      var blocks = [];
      var buffer = [];

      function flush() {
        var textBlock = buffer.join('\n').trim();
        buffer = [];
        if (!textBlock) return;
        splitLongTextBlock(textBlock, 420).forEach(function(part) {
          if (part) blocks.push(part);
        });
      }

      lines.forEach(function(line) {
        var current = String(line || '');
        if (!current.trim()) {
          flush();
          return;
        }
        if (isBulletLine(current)) {
          flush();
          buffer.push(current.trim());
          flush();
          return;
        }
        buffer.push(current);
      });
      flush();

      return blocks.map(function(block, index) {
        return {
          id: 'REQ-' + padNumber(index + 1, 3),
          index: index,
          text: block,
        };
      });
    }

    function normalizeCaseEntry(item, moduleTitle, moduleKey, caseIndex) {
      if (!item || typeof item !== 'object') return null;
      var title = normalizeCaseTitle(item, '用例' + String(caseIndex + 1));
      var steps = normalizeCaseSteps(item);
      var normalized = {
        id: 'TC-' + padNumber(caseIndex + 1, 3),
        module: normalizeModuleTitle(item.module || item.moduleName || moduleTitle),
        moduleKey: moduleKey || normalizeModuleKey(item.module || item.moduleName || moduleTitle),
        title: title,
        priority: normalizeText(item.priority || item['优先级'] || ''),
        preconditions: normalizeText(item.preconditions || item.precondition || item['前置条件'] || ''),
        steps: steps,
        expected: normalizeText(item.expected || item.expect || item['预期结果'] || ''),
        source: normalizeText(item.source || item.sourceType || item.source_type || ''),
      };
      return normalized.title ? normalized : null;
    }

    function normalizeCaseEntries(input) {
      var source = input && typeof input === 'object' ? input : {};
      var modules = Array.isArray(source.modules) ? source.modules : [];
      var cases = [];
      modules.forEach(function(moduleItem, moduleIndex) {
        if (!moduleItem || typeof moduleItem !== 'object') return;
        var moduleTitle = normalizeModuleTitle(
          moduleItem.module || moduleItem.moduleName || moduleItem.module_name || moduleItem.title || ('模块' + String(moduleIndex + 1))
        );
        var moduleKey = normalizeModuleKey(moduleItem.moduleKey || moduleItem.module_key || moduleTitle);
        (Array.isArray(moduleItem.cases) ? moduleItem.cases : []).forEach(function(caseItem) {
          var normalized = normalizeCaseEntry(caseItem, moduleTitle, moduleKey, cases.length);
          if (normalized) cases.push(normalized);
        });
      });
      if (!modules.length && Array.isArray(source.cases)) {
        source.cases.forEach(function(caseItem) {
          var moduleTitle = normalizeModuleTitle(caseItem && (caseItem.module || caseItem.moduleName) || '未命名模块');
          var normalized = normalizeCaseEntry(caseItem, moduleTitle, normalizeModuleKey(moduleTitle), cases.length);
          if (normalized) cases.push(normalized);
        });
      }
      return cases;
    }

    function hashString(text) {
      var hash = 2166136261;
      var raw = String(text || '');
      for (var i = 0; i < raw.length; i += 1) {
        hash ^= raw.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
      return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
    }

    function buildCoverageSignature(requirementText, cases) {
      var normalizedCases = (Array.isArray(cases) ? cases : []).map(function(item) {
        return {
          module: item.module,
          title: item.title,
          preconditions: item.preconditions,
          steps: item.steps,
          expected: item.expected,
        };
      });
      return hashString(JSON.stringify({
        requirementText: String(requirementText || '').replace(/\s+/g, ' ').trim(),
        cases: normalizedCases,
      }));
    }

    function buildCoveragePrompt() {
      return [
        '你是资深测试覆盖审查专家，请分析当前可见用例与“需求原文内容本身”的直接覆盖和关联对应关系。',
        '目标：建立需求原文片段与测试用例之间的映射，让用户能一眼看出哪些原文没有被用例覆盖，同时看到与原文相关的补充验证用例。',
        '重要边界：',
        '1. 先判断需求原文直接表达或强约束的内容是否被覆盖，再判断用例是否与该片段存在明确业务、流程、数据、状态、异常或系统联动关联。',
        '2. 不要改写、拆分、合并或总结需求片段；只能引用输入中的 segmentId。',
        '3. 只引用输入中的 caseId，不得发明用例。',
        '4. 一个片段可以对应多条用例，一条用例也可以覆盖多个片段；直接验证该片段关键约束的用例放入 caseIds，只是与该片段有关联但不是直接验证关键约束的用例放入 relatedCaseIds。',
        '5. 如果片段是背景、标题、上下文、纯说明且不需要测试验证，status 返回 "context"。',
        '6. 如果片段只有关联用例或只有部分关键约束被覆盖，status 返回 "partial"；关键约束被直接且充分覆盖才返回 "covered"；没有直接或关联对应用例返回 "uncovered"。',
        '7. 不要把纯经验扩展、探索性测试、与原文没有明确语义关系的用例强行挂到片段上。',
        '8. 未能从用例中看到明确验证点或明确关联依据时，不要乐观判定覆盖或关联。',
        '只返回 JSON，不要输出解释文本。',
        '返回格式：{"segments":[{"segmentId":"REQ-001","status":"covered|partial|uncovered|context","caseIds":["TC-001"],"relatedCaseIds":["TC-002"],"reason":"20字内说明"}],"unmapped_case_ids":["TC-009"],"summary":{"note":"可选"}}',
      ].join('\n');
    }

    function buildCoverageRequest(input) {
      var source = input && typeof input === 'object' ? input : {};
      var requirementText = String(source.requirementText || '').replace(/\r\n?/g, '\n').trim();
      var segments = splitRequirementText(requirementText);
      var cases = normalizeCaseEntries(source);
      var signature = buildCoverageSignature(requirementText, cases);
      var contract = {
        scope: 'xmind_requirement_coverage',
        mode: 'requirement_coverage',
        requirement_text_must_remain_unchanged: true,
        case_scope: 'current_visible_cases',
        direct_requirement_coverage_only: false,
        include_related_requirement_cases: true,
        relation_scope: 'direct_and_related_requirement_cases',
        allowed_statuses: ['covered', 'partial', 'uncovered', 'context'],
      };
      var requestCases = cases.map(function(item) {
        return {
          caseId: item.id,
          module: item.module,
          title: item.title,
          priority: item.priority,
          preconditions: item.preconditions,
          steps: item.steps,
          expected: item.expected,
        };
      });
      var requestText = [
        '【operation_contract(JSON)】',
        JSON.stringify(contract, null, 2),
        '',
        '【需求原文完整文本】',
        requirementText || '（无需求原文）',
        '',
        '【需求片段(JSON)】',
        JSON.stringify(segments, null, 2),
        '',
        '【当前可见用例(JSON)】',
        JSON.stringify(requestCases, null, 2),
      ].join('\n');
      return {
        prompt: buildCoveragePrompt(),
        requestText: requestText,
        requirementText: requirementText,
        segments: segments,
        cases: cases,
        signature: signature,
        segmentCount: segments.length,
        caseCount: cases.length,
      };
    }

    function normalizeCoverageStatus(value, directCaseIds, relatedCaseIds) {
      var raw = normalizeText(value).toLowerCase();
      var hasDirect = Array.isArray(directCaseIds) && directCaseIds.length > 0;
      var hasRelated = Array.isArray(relatedCaseIds) && relatedCaseIds.length > 0;
      if (raw === 'covered' || raw === 'full' || raw.indexOf('已覆盖') !== -1 || raw.indexOf('完全') !== -1) {
        return hasDirect ? 'covered' : (hasRelated ? 'partial' : 'uncovered');
      }
      if (raw === 'partial' || raw.indexOf('部分') !== -1 || raw.indexOf('关联') !== -1) return (hasDirect || hasRelated) ? 'partial' : 'uncovered';
      if (raw === 'context' || raw === 'non_test' || raw === 'not_testable' || raw.indexOf('上下文') !== -1 || raw.indexOf('无需') !== -1) return 'context';
      if (raw === 'uncovered' || raw === 'missing' || raw.indexOf('未覆盖') !== -1 || raw.indexOf('缺失') !== -1) return hasRelated ? 'partial' : 'uncovered';
      if (hasDirect) return 'covered';
      if (hasRelated) return 'partial';
      return 'uncovered';
    }

    function truncateReason(value) {
      var text = normalizeText(value);
      if (!text) return '';
      return text.length > 36 ? text.slice(0, 36).trim() + '…' : text;
    }

    function normalizeCaseIds(rawValue, caseMap, caseTitleMap, diagnostics) {
      var source = Array.isArray(rawValue)
        ? rawValue
        : (rawValue === undefined || rawValue === null || rawValue === '' ? [] : [rawValue]);
      var seen = {};
      var result = [];
      source.forEach(function(item) {
        var id = '';
        if (item && typeof item === 'object') {
          id = normalizeText(item.caseId || item.case_id || item.id || item.case || '');
          if (!id) {
            var moduleTitle = normalizeModuleTitle(item.module || item.moduleName || '');
            var caseTitle = normalizeCaseTitle(item, '');
            id = caseTitleMap[normalizeModuleKey(moduleTitle) + '::' + caseTitle.toLowerCase()] || '';
          }
        } else {
          id = normalizeText(item);
          if (!caseMap[id]) id = caseTitleMap[id.toLowerCase()] || id;
        }
        if (!id || !caseMap[id]) {
          if (id) diagnostics.push('模型返回了未知用例标识：' + id);
          return;
        }
        if (seen[id]) return;
        seen[id] = true;
        result.push(id);
      });
      return result;
    }

    function mergeUniqueCaseIds(primary, secondary) {
      var seen = {};
      var result = [];
      (Array.isArray(primary) ? primary : []).concat(Array.isArray(secondary) ? secondary : []).forEach(function(id) {
        var stableId = normalizeText(id);
        if (!stableId || seen[stableId]) return;
        seen[stableId] = true;
        result.push(stableId);
      });
      return result;
    }

    function readRawSegmentList(payload) {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.segments)) return payload.segments;
      if (Array.isArray(payload.coverage)) return payload.coverage;
      if (Array.isArray(payload.mappings)) return payload.mappings;
      if (payload.result && Array.isArray(payload.result.segments)) return payload.result.segments;
      return [];
    }

    function findDefaultSelectedSegmentId(segments) {
      var list = Array.isArray(segments) ? segments : [];
      var order = ['uncovered', 'partial', 'covered', 'context'];
      for (var i = 0; i < order.length; i += 1) {
        for (var j = 0; j < list.length; j += 1) {
          if (list[j] && list[j].status === order[i]) return list[j].id;
        }
      }
      return list[0] && list[0].id ? list[0].id : '';
    }

    function normalizeCoverageResult(rawText, request) {
      var source = request && typeof request === 'object' ? request : {};
      var segments = Array.isArray(source.segments) ? cloneJson(source.segments, []) : [];
      var cases = Array.isArray(source.cases) ? cloneJson(source.cases, []) : [];
      var segmentMap = {};
      var caseMap = {};
      var caseTitleMap = {};
      var diagnostics = [];
      segments.forEach(function(item) {
        if (item && item.id) segmentMap[item.id] = item;
      });
      cases.forEach(function(item) {
        if (!item || !item.id) return;
        caseMap[item.id] = item;
        caseTitleMap[String(item.title || '').toLowerCase()] = item.id;
        caseTitleMap[String(item.moduleKey || normalizeModuleKey(item.module || '')) + '::' + String(item.title || '').toLowerCase()] = item.id;
      });

      var payload = extractJsonPayload(rawText);
      if (!payload) diagnostics.push('模型未返回有效 JSON，已按未覆盖展示');
      var rawSegmentList = readRawSegmentList(payload);
      var rawMap = {};
      rawSegmentList.forEach(function(item, index) {
        if (!item || typeof item !== 'object') return;
        var id = normalizeText(item.segmentId || item.segment_id || item.id || item.requirementId || item.requirement_id || '');
        if (!id && Number.isFinite(Number(item.index))) {
          id = segments[Number(item.index)] && segments[Number(item.index)].id ? segments[Number(item.index)].id : '';
        }
        if (!id && segments[index]) id = segments[index].id;
        if (!id || !segmentMap[id]) {
          if (id) diagnostics.push('模型返回了未知需求片段：' + id);
          return;
        }
        rawMap[id] = item;
      });

      var referencedCaseIds = {};
      var resultSegments = segments.map(function(segment) {
        var raw = rawMap[segment.id] || null;
        var directCaseIds = raw
          ? normalizeCaseIds(raw.caseIds || raw.case_ids || raw.directCaseIds || raw.direct_case_ids || raw.directCases || raw.direct_cases || raw.coveredCases || raw.covered_cases, caseMap, caseTitleMap, diagnostics)
          : [];
        var relatedCaseIds = raw
          ? normalizeCaseIds(raw.relatedCaseIds || raw.related_case_ids || raw.associatedCaseIds || raw.associated_case_ids || raw.relatedCases || raw.related_cases || raw.associatedCases || raw.associated_cases, caseMap, caseTitleMap, diagnostics)
          : [];
        if (relatedCaseIds.length) {
          var directSeen = {};
          directCaseIds.forEach(function(id) { directSeen[id] = true; });
          relatedCaseIds = relatedCaseIds.filter(function(id) { return !directSeen[id]; });
        }
        var caseIds = mergeUniqueCaseIds(directCaseIds, relatedCaseIds);
        var status = raw
          ? normalizeCoverageStatus(raw.status || raw.coverageStatus || raw.coverage_status || raw.result || '', directCaseIds, relatedCaseIds)
          : 'uncovered';
        if (status === 'context') {
          directCaseIds = [];
          relatedCaseIds = [];
          caseIds = [];
        }
        caseIds.forEach(function(id) { referencedCaseIds[id] = true; });
        return {
          id: segment.id,
          index: segment.index,
          text: segment.text,
          status: status,
          caseIds: caseIds,
          directCaseIds: directCaseIds,
          relatedCaseIds: relatedCaseIds,
          reason: raw ? truncateReason(raw.reason || raw.note || raw.summary || '') : '',
        };
      });

      var unmappedCaseIds = [];
      cases.forEach(function(item) {
        if (item && item.id && !referencedCaseIds[item.id]) unmappedCaseIds.push(item.id);
      });

      var summary = {
        total: resultSegments.length,
        covered: 0,
        partial: 0,
        uncovered: 0,
        context: 0,
        caseCount: cases.length,
      };
      resultSegments.forEach(function(item) {
        if (summary[item.status] !== undefined) summary[item.status] += 1;
      });
      summary.coveragePercent = summary.total - summary.context > 0
        ? Math.round(((summary.covered + summary.partial * 0.5) / (summary.total - summary.context)) * 100)
        : 100;

      return {
        status: 'done',
        signature: source.signature || buildCoverageSignature(source.requirementText || '', cases),
        requirementText: String(source.requirementText || ''),
        segments: resultSegments,
        cases: cases,
        unmappedCaseIds: unmappedCaseIds,
        selectedSegmentId: findDefaultSelectedSegmentId(resultSegments),
        summary: summary,
        diagnostics: diagnostics,
        updatedAt: Date.now(),
      };
    }

    return {
      splitRequirementText: splitRequirementText,
      normalizeCaseEntries: normalizeCaseEntries,
      buildCoverageSignature: buildCoverageSignature,
      buildCoverageRequest: buildCoverageRequest,
      normalizeCoverageResult: normalizeCoverageResult,
      findDefaultSelectedSegmentId: findDefaultSelectedSegmentId,
    };
  }

  window.app = window.app || {};
  window.app.xmindRequirementCoverageCore = { init: init };
})();
