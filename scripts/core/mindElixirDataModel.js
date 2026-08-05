(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirDataModel = api;
  }
})(function() {
  function defaultIdFactory() {
    var cryptoObj = typeof crypto !== 'undefined' ? crypto : null;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      return cryptoObj.randomUUID().replace(/-/g, '').slice(0, 16);
    }
    return (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 16);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var xmindApi = opts.xmindApi || null;
    var idFactory = typeof opts.idFactory === 'function' ? opts.idFactory : defaultIdFactory;

    function generateNodeId() {
      return idFactory();
    }

    function stringifyCaseField(value, formatOptions) {
      var formatOpts = formatOptions || {};
      var arraySeparator = typeof formatOpts.arraySeparator === 'string'
        ? formatOpts.arraySeparator
        : ' / ';
      if (Array.isArray(value)) {
        return value.map(function(item) {
          var base = item === undefined || item === null ? '' : item;
          return base.toString().trim();
        }).filter(Boolean).join(arraySeparator);
      }
      if (value && typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (err) {
          return '';
        }
      }
      if (value === undefined || value === null) return '';
      return value.toString().trim();
    }

    function formatCaseText(value, formatOptions) {
      var formatOpts = formatOptions || {};
      if (xmindApi && typeof xmindApi.formatXmindNodeValue === 'function') {
        return xmindApi.formatXmindNodeValue(value, formatOpts);
      }
      var text = stringifyCaseField(value, formatOpts);
      if (!text) return '-';
      if (formatOpts.preserveLineBreaks) {
        return text.replace(/\r\n?/g, '\n').replace(/[ \t]*\n+[ \t]*/g, '\n').trim() || '-';
      }
      return text.replace(/\s*\n+\s*/g, ' / ').trim() || '-';
    }

    function buildCaseFieldsFallback(item, fallbackModule) {
      var row = item || {};
      var moduleName = formatCaseText(
        row.module || row.module_name || row['模块'] || fallbackModule || '模块'
      );
      var title = formatCaseText(row.title || row.case_title || row['用例标题'] || moduleName);
      var priority = formatCaseText(row.priority || row.level || row['优先级'] || 'P1');
      var preconditions = formatCaseText(
        row.preconditions || row.precondition || row['前提条件']
      );
      var steps = formatCaseText(row.steps || row.actions || row['操作步骤'], {
        preserveLineBreaks: true,
        arraySeparator: '\n',
      });
      var expected = formatCaseText(row.expected || row.result || row['预期结果']);
      return [moduleName, title, priority, preconditions, steps, expected];
    }

    function buildCaseFields(item, fallbackModule) {
      if (xmindApi && typeof xmindApi.buildCaseFieldsForXmind === 'function') {
        return xmindApi.buildCaseFieldsForXmind(item || {}, fallbackModule || '模块');
      }
      return buildCaseFieldsFallback(item, fallbackModule);
    }

    function createNode(topic) {
      return {
        id: generateNodeId(),
        topic: topic || '-',
        expanded: true,
        children: [],
        _childIndex: Object.create(null),
      };
    }

    function getOrCreateChild(parent, topic) {
      var key = topic || '-';
      if (!parent._childIndex) parent._childIndex = Object.create(null);
      var child = parent._childIndex[key];
      if (!child) {
        child = createNode(key);
        parent.children.push(child);
        parent._childIndex[key] = child;
      }
      return child;
    }

    function cleanupTree(node) {
      if (!node) return null;
      var children = Array.isArray(node.children) ? node.children : [];
      children.forEach(cleanupTree);
      if (!children.length) delete node.children;
      delete node._childIndex;
      return node;
    }

    function buildPathsFromCases(cases, buildOptions) {
      var buildOpts = buildOptions || {};
      var list = Array.isArray(cases) ? cases : [];
      var fallbackModule = buildOpts.fallbackModule || '模块';
      return list.map(function(item) {
        var fields = buildCaseFields(item || {}, fallbackModule);
        if (!Array.isArray(fields)) return [];
        return fields.map(function(segment) {
          var text = typeof segment === 'string' ? segment.trim() : formatCaseText(segment);
          return text || '-';
        });
      }).filter(function(path) {
        return Array.isArray(path) && path.length > 0;
      });
    }

    function buildNodeData(paths, rootTitle) {
      var rootNode = createNode(rootTitle || '用例');
      var list = Array.isArray(paths) ? paths : [];
      list.forEach(function(path) {
        var cursor = rootNode;
        (path || []).forEach(function(segment) {
          cursor = getOrCreateChild(cursor, segment || '-');
        });
      });
      return cleanupTree(rootNode);
    }

    function buildMindDataFromCases(cases, buildOptions) {
      var buildOpts = buildOptions || {};
      var rootTitle = String(buildOpts.rootTitle || '').trim() || '用例';
      return {
        nodeData: buildNodeData(buildPathsFromCases(cases, buildOpts), rootTitle),
      };
    }

    function buildMindDataFromPaths(paths, buildOptions) {
      var buildOpts = buildOptions || {};
      var rootTitle = String(buildOpts.rootTitle || '').trim() || '用例';
      return {
        nodeData: buildNodeData(Array.isArray(paths) ? paths : [], rootTitle),
      };
    }

    function cloneMindDataObject(value) {
      if (!value || typeof value !== 'object') return null;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return null;
      }
    }

    function readMindDataFromInstance(instance) {
      if (!instance) return null;
      try {
        if (typeof instance.getData === 'function') {
          var data = instance.getData();
          if (data && data.nodeData) {
            var cloned = cloneMindDataObject(data);
            if (cloned && cloned.nodeData) return cloned;
          }
        }
      } catch (err0) {
        // Ignore and try the string snapshot fallback.
      }
      try {
        if (typeof instance.getDataString === 'function') {
          var raw = instance.getDataString();
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && parsed.nodeData) {
              var parsedCloned = cloneMindDataObject(parsed);
              if (parsedCloned && parsedCloned.nodeData) return parsedCloned;
            }
          }
        }
      } catch (err1) {
        // Ignore and try the exposed node tree fallback.
      }
      try {
        if (instance.nodeData) {
          var fallback = JSON.parse(JSON.stringify({ nodeData: instance.nodeData }, function(key, value) {
            if (key === 'parent') return undefined;
            return value;
          }));
          if (fallback && fallback.nodeData) return fallback;
        }
      } catch (err2) {
        // Ignore invalid or cyclic instance data.
      }
      return null;
    }

    function buildMindDataSignature(data) {
      if (!data || !data.nodeData) return '';
      try {
        return JSON.stringify(data.nodeData);
      } catch (err) {
        return '';
      }
    }

    function buildNodeMeta(nodeObj, rootTopic, nodeEl) {
      if (!nodeObj || typeof nodeObj !== 'object') return null;
      var path = [];
      var cursor = nodeObj;
      var guard = 0;
      while (cursor && guard < 64) {
        var topic = cursor.topic === null || cursor.topic === undefined
          ? ''
          : String(cursor.topic).trim();
        path.unshift(topic);
        cursor = cursor.parent || null;
        guard += 1;
      }
      var normalizedRootTopic = rootTopic === null || rootTopic === undefined
        ? ''
        : String(rootTopic).trim();
      if (normalizedRootTopic && path.length && path[0] === normalizedRootTopic) {
        path = path.slice(1);
      }
      return {
        nodeId: nodeObj.id === undefined || nodeObj.id === null ? '' : String(nodeObj.id),
        topic: nodeObj.topic === undefined || nodeObj.topic === null ? '' : String(nodeObj.topic),
        path: path,
        meta: nodeObj.xmindMeta && typeof nodeObj.xmindMeta === 'object' ? nodeObj.xmindMeta : {},
        nodeObj: nodeObj,
        nodeEl: nodeEl || null,
      };
    }

    function normalizeMindTopic(value) {
      if (value === undefined || value === null) return '';
      return String(value).trim();
    }

    function decodeMindTopicForSave(value) {
      var text = normalizeMindTopic(value);
      if (!text || text === '-') return '';
      return text;
    }

    function countLeadingIndentWidth(value) {
      var text = value === undefined || value === null ? '' : String(value);
      if (!text) return 0;
      var width = 0;
      for (var index = 0; index < text.length; index += 1) {
        var character = text.charAt(index);
        if (character === '\t') width += 4;
        else if (character === ' ') width += 1;
        else if (character === '\u3000') width += 2;
        else break;
      }
      return width;
    }

    function isMindElixirInternalClipboardText(rawText) {
      var text = rawText === undefined || rawText === null ? '' : String(rawText);
      if (!text) return false;
      var parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        parsed = null;
      }
      return Boolean(
        parsed
        && typeof parsed === 'object'
        && String(parsed.magic || '') === 'MIND-ELIXIR-WAIT-COPY'
        && Array.isArray(parsed.data)
      );
    }

    function parseIndentedTextToMindData(rawText) {
      var text = rawText === undefined || rawText === null ? '' : String(rawText);
      if (!text) return null;
      var normalized = text
        .replace(/\r\n?/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/\u200b/g, '');
      var lines = normalized.split('\n');
      if (!lines.length) return null;

      var entries = [];
      for (var index = 0; index < lines.length; index += 1) {
        var line = String(lines[index] || '');
        if (!line) continue;
        var leadingMatch = line.match(/^[\t \u3000]*/);
        var leading = leadingMatch && leadingMatch[0] ? leadingMatch[0] : '';
        var topic = line.slice(leading.length).trim();
        if (!topic) continue;
        entries.push({
          indent: countLeadingIndentWidth(leading),
          topic: topic,
        });
      }

      if (entries.length < 2) return null;
      var rootIndent = Number(entries[0].indent || 0);
      var hasNested = false;
      for (var nestedIndex = 1; nestedIndex < entries.length; nestedIndex += 1) {
        if (Number(entries[nestedIndex].indent || 0) > rootIndent) {
          hasNested = true;
          break;
        }
      }
      if (!hasNested) return null;

      var rootNode = createNode(entries[0].topic);
      var stack = [{ node: rootNode, indent: rootIndent }];
      var nodeCount = 1;
      for (var entryIndex = 1; entryIndex < entries.length; entryIndex += 1) {
        var entry = entries[entryIndex];
        var indent = Number(entry && entry.indent);
        if (!isFinite(indent)) indent = rootIndent;
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
          stack.pop();
        }
        var parent = indent <= rootIndent ? rootNode : stack[stack.length - 1].node;
        if (!parent || typeof parent !== 'object') parent = rootNode;
        if (!Array.isArray(parent.children)) parent.children = [];
        var nextNode = createNode(entry && entry.topic ? entry.topic : '-');
        parent.children.push(nextNode);
        stack.push({ node: nextNode, indent: indent });
        nodeCount += 1;
      }

      return {
        mindData: { nodeData: cleanupTree(rootNode) },
        nodeCount: nodeCount,
        rootTopic: normalizeMindTopic(rootNode.topic),
      };
    }

    function normalizeClipboardPlainNodeTopic(rawText) {
      var text = rawText === undefined || rawText === null ? '' : String(rawText);
      if (!text) return '';
      return text
        .replace(/\r\n?/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/\u200b/g, '')
        .trim();
    }

    function cloneMindNodeTree(node) {
      if (!node || typeof node !== 'object') return null;
      var cloned = cloneMindDataObject({ nodeData: node });
      return cloned && cloned.nodeData ? cloned.nodeData : null;
    }

    function collectCaseLeafKeys(node, depth, pathTopics, output) {
      if (!node) return;
      var topics = Array.isArray(pathTopics) ? pathTopics.slice() : [];
      if (depth > 0) topics.push(normalizeMindTopic(node.topic));
      var children = Array.isArray(node.children) ? node.children : [];
      if (!children.length) {
        if (depth > 0) output.push(topics.join('\u0001') + '|len=' + String(topics.length));
        return;
      }
      for (var index = 0; index < children.length; index += 1) {
        collectCaseLeafKeys(children[index], depth + 1, topics, output);
      }
    }

    function calculateCaseChangeSummary(baseData, currentData) {
      var baseKeys = [];
      var currentKeys = [];
      collectCaseLeafKeys(baseData && baseData.nodeData, 0, [], baseKeys);
      collectCaseLeafKeys(currentData && currentData.nodeData, 0, [], currentKeys);

      function buildCounter(keys) {
        var result = Object.create(null);
        (keys || []).forEach(function(rawKey) {
          var key = String(rawKey || '');
          result[key] = (result[key] || 0) + 1;
        });
        return result;
      }

      var baseCounter = buildCounter(baseKeys);
      var currentCounter = buildCounter(currentKeys);
      var keys = Object.keys(baseCounter).concat(Object.keys(currentCounter));
      var seen = Object.create(null);
      var baseRemain = 0;
      var currentRemain = 0;
      keys.forEach(function(rawKey) {
        var key = String(rawKey || '');
        if (!key || seen[key]) return;
        seen[key] = true;
        var oldCount = Number(baseCounter[key] || 0);
        var newCount = Number(currentCounter[key] || 0);
        var matched = oldCount < newCount ? oldCount : newCount;
        baseRemain += oldCount - matched;
        currentRemain += newCount - matched;
      });

      var modified = baseRemain < currentRemain ? baseRemain : currentRemain;
      var added = currentRemain - modified;
      var deleted = baseRemain - modified;
      if (modified < 0) modified = 0;
      if (added < 0) added = 0;
      if (deleted < 0) deleted = 0;
      return {
        modified: modified,
        added: added,
        deleted: deleted,
        total: modified + added + deleted,
      };
    }

    function validateMindDataCases(mindData, validateOptions) {
      var validationOpts = validateOptions || {};
      var fieldCount = Number(validationOpts.fieldCount);
      if (!isFinite(fieldCount) || fieldCount <= 0) fieldCount = 6;
      var topicCaseParser = typeof validationOpts.topicCaseParser === 'function'
        ? validationOpts.topicCaseParser
        : null;
      var emptyMap = Object.create(null);
      var structMap = Object.create(null);
      var cases = [];

      function mark(map, id) {
        if (id === undefined || id === null) return;
        map[String(id)] = true;
      }

      function parseTopicsToCase(topics) {
        var segments = Array.isArray(topics) ? topics : [];
        if (topicCaseParser) {
          try {
            var parsed = topicCaseParser(segments.slice());
            if (parsed && typeof parsed === 'object') {
              return {
                caseItem: parsed.caseItem && typeof parsed.caseItem === 'object'
                  ? parsed.caseItem
                  : null,
                emptyIndexes: Array.isArray(parsed.emptyIndexes) ? parsed.emptyIndexes : [],
              };
            }
          } catch (err) {
            // ignore
          }
          return { caseItem: null, emptyIndexes: [] };
        }

        var moduleValue = decodeMindTopicForSave(segments[0]);
        var titleValue = decodeMindTopicForSave(segments[1]);
        var priorityValue = decodeMindTopicForSave(segments[2]) || 'P1';
        var priorityHead = priorityValue.charAt(0);
        if (priorityHead === 'p' || priorityHead === 'P') {
          priorityValue = 'P' + priorityValue.slice(1);
        }
        var preconditionValue = decodeMindTopicForSave(segments[3]);
        var stepsValue = decodeMindTopicForSave(segments[4]);
        var expectedValue = decodeMindTopicForSave(segments[5]);
        var missingIndexes = [];
        if (!moduleValue) missingIndexes.push(0);
        if (!titleValue) missingIndexes.push(1);
        if (!expectedValue) missingIndexes.push(5);
        if (missingIndexes.length) {
          return { caseItem: null, emptyIndexes: missingIndexes };
        }
        return {
          caseItem: {
            module: moduleValue,
            title: titleValue,
            priority: priorityValue,
            preconditions: preconditionValue,
            precondition: preconditionValue,
            steps: stepsValue,
            expected: expectedValue,
            remark: '',
          },
          emptyIndexes: [],
        };
      }

      function walk(node, depth, pathTopics, pathNodeIds) {
        if (!node) return;
        var topics = Array.isArray(pathTopics) ? pathTopics.slice() : [];
        var nodeIds = Array.isArray(pathNodeIds) ? pathNodeIds.slice() : [];
        var topic = normalizeMindTopic(node.topic);
        if (depth > 0) {
          topics.push(topic);
          if (node.id || node.id === 0) nodeIds.push(String(node.id));
          if (!topic) mark(emptyMap, node.id);
        }

        var children = Array.isArray(node.children) ? node.children : [];
        if (!children.length) {
          if (depth <= 0) return;
          if (topics.length !== fieldCount) {
            nodeIds.forEach(function(id) { mark(structMap, id); });
            return;
          }
          var parsed = parseTopicsToCase(topics);
          var caseItem = parsed && parsed.caseItem ? parsed.caseItem : null;
          var emptyIndexes = parsed && Array.isArray(parsed.emptyIndexes)
            ? parsed.emptyIndexes
            : [];
          if (!caseItem) {
            nodeIds.forEach(function(id) { mark(structMap, id); });
            emptyIndexes.forEach(function(indexValue) {
              var index = Number(indexValue);
              if (!isFinite(index) || index < 0) return;
              if (nodeIds[index]) mark(emptyMap, nodeIds[index]);
            });
            return;
          }
          cases.push(caseItem);
          return;
        }
        for (var index = 0; index < children.length; index += 1) {
          walk(children[index], depth + 1, topics, nodeIds);
        }
      }

      walk(mindData && mindData.nodeData, 0, [], []);
      var emptyNodeIds = Object.keys(emptyMap);
      var structuralNodeIds = Object.keys(structMap);
      var errors = [];
      if (emptyNodeIds.length) errors.push('存在空节点，无法保存');
      if (structuralNodeIds.length) errors.push('存在结构不完整的用例路径，无法保存');
      return {
        ok: errors.length === 0,
        cases: cases,
        emptyNodeIds: emptyNodeIds,
        structuralNodeIds: structuralNodeIds,
        errors: errors,
      };
    }

    return {
      generateNodeId: generateNodeId,
      createNode: createNode,
      buildPathsFromCases: buildPathsFromCases,
      buildMindDataFromCases: buildMindDataFromCases,
      buildMindDataFromPaths: buildMindDataFromPaths,
      cloneMindDataObject: cloneMindDataObject,
      readMindDataFromInstance: readMindDataFromInstance,
      buildMindDataSignature: buildMindDataSignature,
      buildNodeMeta: buildNodeMeta,
      normalizeMindTopic: normalizeMindTopic,
      decodeMindTopicForSave: decodeMindTopicForSave,
      isMindElixirInternalClipboardText: isMindElixirInternalClipboardText,
      parseIndentedTextToMindData: parseIndentedTextToMindData,
      normalizeClipboardPlainNodeTopic: normalizeClipboardPlainNodeTopic,
      cloneMindNodeTree: cloneMindNodeTree,
      calculateCaseChangeSummary: calculateCaseChangeSummary,
      validateMindDataCases: validateMindDataCases,
    };
  }

  return { create: create };
});
