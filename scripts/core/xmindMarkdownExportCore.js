(function() {
  function init(deps) {
    var formatCompactTimestamp = deps && deps.formatCompactTimestamp
      ? deps.formatCompactTimestamp
      : function() { return Date.now().toString(); };
    var normalizeRequirementName = deps && deps.normalizeRequirementName
      ? deps.normalizeRequirementName
      : function(text) { return text || ''; };
    var getSafeFileBaseName = deps && deps.getSafeFileBaseName
      ? deps.getSafeFileBaseName
      : function(name, fallback) {
        var raw = '';
        if (typeof name === 'string') raw = name;
        else if (name && typeof name.toString === 'function') raw = name.toString();
        raw = String(raw || '').trim().replace(/\.[^.]+$/, '');
        raw = raw.replace(/[\\/:*?"<>|]/g, '_');
        return raw || String(fallback || 'usecase');
      };

    function normalizeText(value) {
      if (value === null || value === undefined) return '';
      return String(value).replace(/\r\n?/g, '\n').trim();
    }

    function dedupeStringList(list) {
      var source = Array.isArray(list) ? list : [];
      var result = [];
      var seen = Object.create(null);
      source.forEach(function(item) {
        var text = normalizeText(item);
        if (!text) return;
        if (seen[text]) return;
        seen[text] = true;
        result.push(text);
      });
      return result;
    }

    function escapeTableCell(value) {
      var text = normalizeText(value);
      if (!text) return 'none';
      return text.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
    }

    function stripOrderedPrefix(text) {
      return normalizeText(text)
        .replace(/^(?:[-*+]\s+)?(?:\d+|[一二三四五六七八九十]+)[、.．)\]\s-]+/, '')
        .trim();
    }

    function normalizeStringList(value) {
      var list = [];
      if (Array.isArray(value)) {
        list = value;
      } else {
        var text = normalizeText(value);
        if (!text) return [];
        list = text.split(/\n+/);
      }
      return list
        .map(function(item) { return normalizeText(item); })
        .filter(Boolean);
    }

    function normalizeMarkdownLines(value) {
      return dedupeStringList(normalizeStringList(value)
        .map(function(item) { return stripOrderedPrefix(item); })
        .filter(Boolean));
    }

    function normalizeCasePriority(priority) {
      var text = normalizeText(priority).toUpperCase();
      if (text === 'P0' || text === 'P1' || text === 'P2') return text;
      return 'P1';
    }

    function normalizeModuleRecord(item, index) {
      var source = item && typeof item === 'object' ? item : {};
      var moduleTitle = normalizeText(source.module || source.title || ('模块' + String(index + 1))) || ('模块' + String(index + 1));
      var cases = Array.isArray(source.cases) ? source.cases : [];
      return {
        module: moduleTitle,
        key_scenarios: dedupeStringList(normalizeStringList(source.key_scenarios || source.scenarios)),
        test_points: dedupeStringList(normalizeStringList(source.test_points || source.points)),
        coupled_modules: dedupeStringList(normalizeStringList(source.coupled_modules || source.coupled)),
        cases: cases.map(function(caseItem) {
          return normalizeCaseRecord(caseItem, moduleTitle);
        }).filter(Boolean),
      };
    }

    function normalizeCaseRecord(item, fallbackModule) {
      if (!item || typeof item !== 'object') return null;
      var moduleTitle = normalizeText(item.module || fallbackModule || '未命名模块') || '未命名模块';
      var title = normalizeText(item.title || item.case_title || item.name || '未命名用例') || '未命名用例';
      return {
        module: moduleTitle,
        title: title,
        priority: normalizeCasePriority(item.priority || item.level),
        preconditions: normalizeText(item.preconditions || item.precondition),
        steps: Array.isArray(item.steps) ? item.steps.slice() : normalizeText(item.steps || item.actions),
        expected: normalizeText(item.expected || item.result) || '',
      };
    }

    function formatHumanDateTime(value) {
      var time = value;
      if (typeof time === 'string' && /^\d+$/.test(time)) {
        time = Number(time);
      }
      var date = time instanceof Date ? time : new Date(time || Date.now());
      if (!date || isNaN(date.getTime())) {
        date = new Date();
      }
      var year = String(date.getFullYear());
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      var hour = String(date.getHours()).padStart(2, '0');
      var minute = String(date.getMinutes()).padStart(2, '0');
      var second = String(date.getSeconds()).padStart(2, '0');
      return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
    }

    function formatFileTimestamp(value) {
      var time = value;
      if (typeof time === 'string' && /^\d+$/.test(time)) {
        time = Number(time);
      }
      var date = time instanceof Date ? time : new Date(time || Date.now());
      if (!date || isNaN(date.getTime())) {
        var fallback = formatCompactTimestamp();
        return String(fallback || '').replace(/\D/g, '') || Date.now().toString();
      }
      var year = String(date.getFullYear());
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      var hour = String(date.getHours()).padStart(2, '0');
      var minute = String(date.getMinutes()).padStart(2, '0');
      var second = String(date.getSeconds()).padStart(2, '0');
      return year + month + day + hour + minute + second;
    }

    function summarizeText(value, maxLength) {
      var text = normalizeText(value).replace(/\s+/g, ' ');
      var limit = Number(maxLength);
      if (!Number.isFinite(limit) || limit <= 0) limit = 80;
      if (!text) return 'none';
      if (text.length <= limit) return text;
      return text.slice(0, limit).trim() + '…';
    }

    function formatInlineList(value, emptyText) {
      var list = normalizeStringList(value);
      return list.length ? list.join(', ') : String(emptyText || 'none');
    }

    function joinSummaryList(value) {
      var list = normalizeMarkdownLines(value);
      return list.length ? list.join('；') : 'none';
    }

    function buildPrioritySummary(cases) {
      var counts = { P0: 0, P1: 0, P2: 0 };
      (Array.isArray(cases) ? cases : []).forEach(function(item) {
        var key = normalizeCasePriority(item && item.priority);
        counts[key] += 1;
      });
      return 'P0 ' + counts.P0 + ' 条，P1 ' + counts.P1 + ' 条，P2 ' + counts.P2 + ' 条';
    }

    function buildCoverageSummary(moduleRecord) {
      var cases = moduleRecord && Array.isArray(moduleRecord.cases) ? moduleRecord.cases : [];
      if (!cases.length) return '当前模块暂无用例';
      return '共 ' + String(cases.length) + ' 条用例；优先级分布：' + buildPrioritySummary(cases);
    }

    function buildInferenceText(parts) {
      return normalizeText((Array.isArray(parts) ? parts : []).join('\n'));
    }

    function inferCheckTargets(parts) {
      var text = buildInferenceText(parts);
      var rules = [
        { tag: 'permission_or_auth', keywords: ['登录', '鉴权', '权限', '角色', 'token', '会话', '认证'] },
        { tag: 'integration_or_external', keywords: ['支付', '短信', '邮件', '消息', '通知', '第三方', 'webhook', '队列', '知识库'] },
        { tag: 'api_or_backend', keywords: ['接口', 'api', '请求', '响应', '返回', 'http', 'endpoint', '状态码', '提交'] },
        { tag: 'frontend_or_ui', keywords: ['页面', '界面', '按钮', '输入', '点击', '展示', '显示', '跳转', '弹窗', '抽屉', '表单', 'toast'] },
        { tag: 'validation_or_error', keywords: ['校验', '校验提示', '错误', '异常', '失败', '边界', '限制', '必填', '格式', '拦截'] },
        { tag: 'state_or_flow', keywords: ['状态', '流程', '步骤', '切换', '刷新', '恢复', '同步', '更新', '生成', '进入', '执行'] },
        { tag: 'data_or_storage', keywords: ['数据库', '落库', '存储', '缓存', '保存', '导出', '导入', '记录', '持久化'] },
        { tag: 'config_or_flag', keywords: ['配置', '开关', '参数', '环境变量', '设置', '模型'] },
      ];
      var tags = [];
      rules.forEach(function(rule) {
        var matched = false;
        rule.keywords.forEach(function(keyword) {
          if (matched) return;
          if (text.indexOf(keyword) !== -1) {
            matched = true;
            tags.push(rule.tag);
          }
        });
      });
      if (!tags.length) {
        tags.push('service_or_domain_logic');
      }
      return dedupeStringList(tags);
    }

    function appendJsonBlock(lines, payload) {
      lines.push('```json');
      lines.push(JSON.stringify(payload, null, 2));
      lines.push('```');
      lines.push('');
    }

    function buildExportMetadataSection(lines, metadata) {
      lines.push('## 导出元数据');
      lines.push('');
      appendJsonBlock(lines, metadata);
    }

    function buildAiReviewSection(lines) {
      lines.push('## AI 审核骨架');
      lines.push('');
      appendJsonBlock(lines, {
        review_goal: '基于当前项目实现，判断导出的测试模块与测试用例是否具备用例通过条件。',
        recommended_reading_order: [
          '导出元数据',
          '全局用例索引视图',
          '模块详情视图',
        ],
        review_dimensions: [
          'implementation_presence',
          'execution_path',
          'preconditions_and_test_data',
          'expected_behavior_alignment',
          'cross_module_dependencies',
        ],
        output_contract: {
          verdict_enum: ['可通过', '部分可通过', '不可通过'],
          required_sections: [
            'covered_implementation',
            'risks',
            'missing_implementation',
            'needs_confirmation',
          ],
        },
        parsing_rules: {
          case_id_format: 'Mxx-Cxx',
          module_id_format: 'Mxx',
          structured_payload_format: 'json_code_blocks',
          empty_array_means: 'source field is empty after normalization',
          null_means: 'scalar field is absent or empty after normalization',
          suggested_check_targets: 'heuristic hints only, must be verified against the actual project',
        },
      });
    }

    function buildModuleOverviewSection(lines, modulesWithMeta) {
      lines.push('## 模块视图');
      lines.push('');
      lines.push('| Module ID | 模块 | 用例数 | 建议核对目标 | 耦合模块 | 覆盖摘要 |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      modulesWithMeta.forEach(function(moduleMeta) {
        var moduleRecord = moduleMeta.moduleRecord;
        lines.push(
          '| ' + escapeTableCell(moduleMeta.moduleId)
            + ' | ' + escapeTableCell(moduleRecord.module)
            + ' | ' + escapeTableCell(String(moduleMeta.caseCount))
            + ' | ' + escapeTableCell(formatInlineList(moduleMeta.suggestedCheckTargets))
            + ' | ' + escapeTableCell(formatInlineList(moduleRecord.coupled_modules))
            + ' | ' + escapeTableCell(buildCoverageSummary(moduleRecord))
            + ' |'
        );
      });
      lines.push('');
    }

    function buildCaseIndexSection(lines, indexedCases) {
      lines.push('## 全局用例索引视图');
      lines.push('');
      if (!indexedCases.length) {
        lines.push('当前没有可导出的用例。');
        lines.push('');
        return;
      }
      lines.push('| Case ID | 模块 | 优先级 | 标题 | 预期摘要 | 建议核对目标 |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      indexedCases.forEach(function(item) {
        lines.push(
          '| ' + escapeTableCell(item.caseId)
            + ' | ' + escapeTableCell(item.module)
            + ' | ' + escapeTableCell(item.priority)
            + ' | ' + escapeTableCell(item.title)
            + ' | ' + escapeTableCell(item.expectedSummary)
            + ' | ' + escapeTableCell(formatInlineList(item.suggestedCheckTargets))
            + ' |'
        );
      });
      lines.push('');
    }

    function buildStructuredModuleRecord(moduleMeta) {
      var moduleRecord = moduleMeta.moduleRecord;
      return {
        module_record: {
          module_id: moduleMeta.moduleId,
          module: moduleRecord.module,
          key_scenarios: moduleRecord.key_scenarios.slice(),
          test_points: moduleRecord.test_points.slice(),
          coupled_modules: moduleRecord.coupled_modules.slice(),
          case_count: moduleMeta.caseCount,
          coverage_summary: buildCoverageSummary(moduleRecord),
          suggested_check_targets: moduleMeta.suggestedCheckTargets.slice(),
        },
        cases: moduleMeta.cases.map(function(caseMeta) {
          return {
            case_id: caseMeta.caseId,
            module_id: caseMeta.moduleId,
            module: caseMeta.module,
            title: caseMeta.title,
            priority: caseMeta.priority,
            depends_on_modules: caseMeta.coupledModules.slice(),
            suggested_check_targets: caseMeta.suggestedCheckTargets.slice(),
            preconditions: caseMeta.preconditions.slice(),
            steps: caseMeta.steps.slice(),
            expected: caseMeta.expectedLines.slice(),
            expected_summary: caseMeta.expectedSummary,
            source_scope: 'current_active_workspace_visible_nodes',
          };
        }),
        empty_case_records: moduleMeta.cases.length === 0,
      };
    }

    function buildModuleDetailSection(lines, modulesWithMeta) {
      lines.push('## 模块详情视图');
      lines.push('');
      modulesWithMeta.forEach(function(moduleMeta) {
        lines.push('### ' + moduleMeta.moduleId + ' ' + moduleMeta.moduleRecord.module);
        lines.push('');
        appendJsonBlock(lines, buildStructuredModuleRecord(moduleMeta));
        if (!moduleMeta.cases.length) {
          lines.push('当前模块暂无用例。');
          lines.push('');
        }
      });
    }

    function buildIndexedModules(modules) {
      var indexedCases = [];
      var modulesWithMeta = modules.map(function(moduleRecord, moduleIndex) {
        var moduleId = 'M' + String(moduleIndex + 1).padStart(2, '0');
        var normalizedCases = (Array.isArray(moduleRecord.cases) ? moduleRecord.cases : []).map(function(item) {
          return normalizeCaseRecord(item, moduleRecord.module);
        }).filter(Boolean);
        var baseTargets = inferCheckTargets(
          [moduleRecord.module]
            .concat(moduleRecord.key_scenarios || [])
            .concat(moduleRecord.test_points || [])
            .concat(moduleRecord.coupled_modules || [])
        );
        var cases = normalizedCases.map(function(caseRecord, caseIndex) {
          var caseId = moduleId + '-C' + String(caseIndex + 1).padStart(2, '0');
          var preconditions = normalizeMarkdownLines(caseRecord.preconditions);
          var steps = normalizeMarkdownLines(caseRecord.steps);
          var expectedLines = normalizeMarkdownLines(caseRecord.expected);
          var expectedSummary = summarizeText((expectedLines.length ? expectedLines.join('；') : caseRecord.expected), 60);
          var inferredTargets = dedupeStringList(baseTargets.concat(inferCheckTargets(
            [caseRecord.title, caseRecord.module]
              .concat(preconditions)
              .concat(steps)
              .concat(expectedLines)
          )));
          var caseMeta = {
            caseId: caseId,
            moduleId: moduleId,
            module: moduleRecord.module,
            title: caseRecord.title,
            priority: normalizeCasePriority(caseRecord.priority),
            expected: caseRecord.expected,
            expectedSummary: expectedSummary,
            preconditions: preconditions,
            steps: steps,
            expectedLines: expectedLines,
            suggestedCheckTargets: inferredTargets,
            coupledModules: moduleRecord.coupled_modules.slice(),
            caseRecord: caseRecord,
          };
          indexedCases.push(caseMeta);
          return caseMeta;
        });
        var moduleTargets = baseTargets.slice();
        cases.forEach(function(caseMeta) {
          moduleTargets = dedupeStringList(moduleTargets.concat(caseMeta.suggestedCheckTargets));
        });
        return {
          moduleId: moduleId,
          caseCount: cases.length,
          moduleRecord: moduleRecord,
          cases: cases,
          suggestedCheckTargets: moduleTargets,
        };
      });
      return {
        modulesWithMeta: modulesWithMeta,
        indexedCases: indexedCases,
      };
    }

    function buildMarkdownExportFromSnapshot(snapshot, options) {
      var opts = options || {};
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var requirementLabel = normalizeText(source.requirementLabel || opts.requirementLabel || '');
      var displayRequirement = requirementLabel || '当前可见XMind用例';
      var modules = (Array.isArray(source.modules) ? source.modules : []).map(function(item, index) {
        return normalizeModuleRecord(item, index);
      }).filter(Boolean);
      var exportedAt = source.exportedAt || Date.now();
      var indexed = buildIndexedModules(modules);
      var moduleCount = indexed.modulesWithMeta.length;
      var caseCount = indexed.indexedCases.length;
      var compactTs = formatFileTimestamp(exportedAt);
      var safeName = getSafeFileBaseName(normalizeRequirementName(displayRequirement) || displayRequirement, 'usecase');
      var lines = [];

      lines.push('# XMind AI 测试用例导出');
      lines.push('');
      buildExportMetadataSection(lines, {
        export_type: 'xmind_ai_usecases',
        schema_version: '2.0',
        requirement_label: displayRequirement,
        exported_at: formatHumanDateTime(exportedAt),
        module_count: moduleCount,
        case_count: caseCount,
        source_scope: 'current_active_workspace_visible_nodes',
        excluded_nodes: ['hidden', 'deleted'],
        embedded_full_requirement: false,
        embedded_full_baseline: false,
        usage_purpose: 'AI-first review for implementation verification against exported XMind use cases',
      });
      buildAiReviewSection(lines);
      buildModuleOverviewSection(lines, indexed.modulesWithMeta);
      buildCaseIndexSection(lines, indexed.indexedCases);
      buildModuleDetailSection(lines, indexed.modulesWithMeta);

      return {
        fileName: safeName + '_ai_usecases_' + compactTs + '.md',
        content: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n',
        moduleCount: moduleCount,
        caseCount: caseCount,
      };
    }

    return {
      buildMarkdownExportFromSnapshot: buildMarkdownExportFromSnapshot,
    };
  }

  window.app = window.app || {};
  window.app.xmindMarkdownExportCore = { init: init };
})();
