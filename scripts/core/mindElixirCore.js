(function() {
  function init(deps) {
    var xmindApi = deps && deps.xmindApi
      ? deps.xmindApi
      : (window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null);
    var renderPolicyCore = deps && deps.renderPolicyCore
      ? deps.renderPolicyCore
      : (window.app && window.app.xmindRenderPolicyCore ? window.app.xmindRenderPolicyCore : null);
    var drawerFullscreenPort = window.app && window.app.ui && window.app.ui.DrawerShell
      ? window.app.ui.DrawerShell.fullscreen
      : null;
    var defaultScaleStep = 0.15;
    var minScale = 0.1;
    var maxScale = 2.5;

    function getRenderPolicyCore() {
      if (renderPolicyCore) return renderPolicyCore;
      if (window.app && window.app.xmindRenderPolicyCore) {
        renderPolicyCore = window.app.xmindRenderPolicyCore;
      }
      return renderPolicyCore;
    }
    var activeContextMenuHider = function() {};

    function forceHideAllNodeContextMenus() {
      if (typeof document === 'undefined' || !document || typeof document.querySelectorAll !== 'function') return;
      var menus = document.querySelectorAll('.xmind-node-context-menu');
      if (!menus || !menus.length) return;
      Array.prototype.forEach.call(menus, function(menu) {
        if (!menu || !menu.classList) return;
        menu.classList.remove('is-open');
        if (menu.setAttribute) menu.setAttribute('aria-hidden', 'true');
      });
    }

    function hideOpenContextMenu() {
      try {
        activeContextMenuHider();
      } catch (err) {
        activeContextMenuHider = function() {};
      }
      forceHideAllNodeContextMenus();
    }

    function getMindCtor() {
      var source = null;
      if (typeof MindElixir !== 'undefined') {
        source = MindElixir;
      } else if (typeof window !== 'undefined' && window && window.MindElixir) {
        source = window.MindElixir;
      }
      if (!source) return null;
      if (typeof source === 'function') return source;
      if (source && typeof source.default === 'function') return source.default;
      return null;
    }

    function generateNodeId() {
      var cryptoObj = typeof crypto !== 'undefined' ? crypto : null;
      if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID().replace(/-/g, '').slice(0, 16);
      }
      return (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 16);
    }

    function stringifyCaseField(value, options) {
      var opts = options || {};
      var arraySeparator = typeof opts.arraySeparator === 'string' ? opts.arraySeparator : ' / ';
      if (Array.isArray(value)) {
        var textArr = value
          .map(function(v) {
            var base = v === undefined || v === null ? '' : v;
            return base.toString().trim();
          })
          .filter(Boolean);
        return textArr.join(arraySeparator);
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

    function formatCaseText(value, options) {
      var opts = options || {};
      if (xmindApi && typeof xmindApi.formatXmindNodeValue === 'function') {
        return xmindApi.formatXmindNodeValue(value, opts);
      }
      var text = stringifyCaseField(value, opts);
      if (!text) return '-';
      if (opts.preserveLineBreaks) {
        return text.replace(/\r\n?/g, '\n').replace(/[ \t]*\n+[ \t]*/g, '\n').trim() || '-';
      }
      return text.replace(/\s*\n+\s*/g, ' / ').trim() || '-';
    }

    function buildCaseFieldsFallback(item, fallbackModule) {
      var row = item || {};
      var moduleName = formatCaseText(row.module || row.module_name || row['模块'] || fallbackModule || '模块');
      var title = formatCaseText(row.title || row.case_title || row['用例标题'] || moduleName);
      var priority = formatCaseText(row.priority || row.level || row['优先级'] || 'P1');
      var preconditions = formatCaseText(row.preconditions || row.precondition || row['前提条件']);
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
      var list = Array.isArray(node.children) ? node.children : [];
      list.forEach(cleanupTree);
      if (!list.length) delete node.children;
      delete node._childIndex;
      return node;
    }

    function buildPathsFromCases(cases, options) {
      var opts = options || {};
      var list = Array.isArray(cases) ? cases : [];
      var fallbackModule = opts.fallbackModule || '模块';
      return list.map(function(item) {
        var fields = buildCaseFields(item || {}, fallbackModule);
        if (!Array.isArray(fields)) return [];
        return fields.map(function(seg) {
          var text = typeof seg === 'string' ? seg.trim() : formatCaseText(seg);
          return text || '-';
        });
      }).filter(function(path) {
        return Array.isArray(path) && path.length > 0;
      });
    }

    function buildNodeData(paths, rootTitle) {
      var root = createNode(rootTitle || '用例');
      var list = Array.isArray(paths) ? paths : [];
      list.forEach(function(path) {
        var cursor = root;
        (path || []).forEach(function(seg) {
          cursor = getOrCreateChild(cursor, seg || '-');
        });
      });
      return cleanupTree(root);
    }

    function cloneTheme(source, fallbackName, fallbackType) {
      var src = source || {};
      var baseCss = src.cssVar && typeof src.cssVar === 'object' ? src.cssVar : {};
      var basePalette = Array.isArray(src.palette) ? src.palette.slice() : [];
      return {
        name: src.name || fallbackName,
        type: src.type || fallbackType,
        palette: basePalette,
        cssVar: Object.assign({}, baseCss),
      };
    }

    function buildTheme(darkMode) {
      var ctor = getMindCtor();
      if (!ctor) return null;
      var isDark = darkMode === true;
      var base = isDark ? ctor.DARK_THEME : ctor.THEME;
      var theme = cloneTheme(base, isDark ? 'Dark' : 'Latte', isDark ? 'dark' : 'light');
      if (!theme.cssVar) theme.cssVar = {};
      if (isDark) {
        theme.cssVar['--root-bgcolor'] = '#3b82f6';
        theme.cssVar['--main-bgcolor'] = '#1f2937';
        theme.cssVar['--main-bgcolor-transparent'] = 'rgba(31, 41, 55, 0.82)';
        theme.cssVar['--main-color'] = '#e5e7eb';
        theme.cssVar['--bgcolor'] = '#111827';
        theme.cssVar['--panel-bgcolor'] = '#0f172a';
        theme.cssVar['--panel-border-color'] = '#334155';
        theme.cssVar['--selected'] = '#60a5fa';
      } else {
        theme.cssVar['--root-bgcolor'] = '#2563eb';
        theme.cssVar['--main-bgcolor'] = '#ffffff';
        theme.cssVar['--main-bgcolor-transparent'] = 'rgba(255, 255, 255, 0.88)';
        theme.cssVar['--main-color'] = '#1f2937';
        theme.cssVar['--bgcolor'] = '#f8fafc';
        theme.cssVar['--panel-bgcolor'] = '#ffffff';
        theme.cssVar['--panel-border-color'] = '#dbe2ea';
        theme.cssVar['--selected'] = '#3b82f6';
      }
      return theme;
    }

    function resolveDarkMode() {
      var root = document && document.documentElement ? document.documentElement : null;
      if (!root) return false;
      var theme = '';
      if (root.dataset && root.dataset.theme) {
        theme = String(root.dataset.theme || '').toLowerCase();
      } else {
        theme = String(root.getAttribute('data-theme') || '').toLowerCase();
      }
      return theme === 'dark';
    }

    function normalizeDirection(raw, ctor) {
      var name = String(raw || '').toLowerCase();
      if (name === 'left') return ctor.LEFT;
      if (name === 'right') return ctor.RIGHT;
      return ctor.SIDE;
    }

    function buildMindDataFromCases(cases, options) {
      var opts = options || {};
      var rootTitle = String(opts.rootTitle || '').trim() || '用例';
      var paths = buildPathsFromCases(cases, opts);
      return {
        nodeData: buildNodeData(paths, rootTitle),
      };
    }

    function buildMindDataFromPaths(paths, options) {
      var opts = options || {};
      var rootTitle = String(opts.rootTitle || '').trim() || '用例';
      var list = Array.isArray(paths) ? paths : [];
      return {
        nodeData: buildNodeData(list, rootTitle),
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

    function buildMindDataSignature(data) {
      if (!data || !data.nodeData) return '';
      try {
        return JSON.stringify(data.nodeData);
      } catch (err) {
        return '';
      }
    }

    function readMindEditSession(storageKey) {
      if (!storageKey || typeof localStorage === 'undefined') return null;
      try {
        var raw = localStorage.getItem(String(storageKey));
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
      } catch (err) {
        return null;
      }
    }

    function writeMindEditSession(storageKey, payload) {
      if (!storageKey || typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(String(storageKey), JSON.stringify(payload || {}));
      } catch (err) {
        // ignore
      }
    }

    function clearMindEditSession(storageKey) {
      if (!storageKey || typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem(String(storageKey));
      } catch (err) {
        // ignore
      }
    }

    function normalizeMindTopic(value) {
      if (value === undefined || value === null) return '';
      return String(value).trim();
    }

    function decodeMindTopicForSave(value) {
      var text = normalizeMindTopic(value);
      if (!text) return '';
      if (text === '-') return '';
      return text;
    }

    function countLeadingIndentWidth(value) {
      var text = value === undefined || value === null ? '' : String(value);
      if (!text) return 0;
      var width = 0;
      for (var i = 0; i < text.length; i += 1) {
        var ch = text.charAt(i);
        if (ch === '\t') width += 4;
        else if (ch === ' ') width += 1;
        else if (ch === '\u3000') width += 2;
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
      if (!parsed || typeof parsed !== 'object') return false;
      if (String(parsed.magic || '') !== 'MIND-ELIXIR-WAIT-COPY') return false;
      return Array.isArray(parsed.data);
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
      for (var i = 0; i < lines.length; i += 1) {
        var line = String(lines[i] || '');
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
      for (var j = 1; j < entries.length; j += 1) {
        if (Number(entries[j].indent || 0) > rootIndent) {
          hasNested = true;
          break;
        }
      }
      if (!hasNested) return null;

      var rootNode = createNode(entries[0].topic);
      var stack = [{
        node: rootNode,
        indent: rootIndent,
      }];
      var nodeCount = 1;

      for (var k = 1; k < entries.length; k += 1) {
        var item = entries[k];
        var indent = Number(item && item.indent);
        if (!isFinite(indent)) indent = rootIndent;
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
          stack.pop();
        }
        var parent = indent <= rootIndent
          ? rootNode
          : stack[stack.length - 1].node;
        if (!parent || typeof parent !== 'object') parent = rootNode;
        if (!Array.isArray(parent.children)) parent.children = [];
        var nextNode = createNode(item && item.topic ? item.topic : '-');
        parent.children.push(nextNode);
        stack.push({
          node: nextNode,
          indent: indent,
        });
        nodeCount += 1;
      }

      return {
        mindData: {
          nodeData: cleanupTree(rootNode),
        },
        nodeCount: nodeCount,
        rootTopic: normalizeMindTopic(rootNode.topic),
      };
    }

    function normalizeClipboardPlainNodeTopic(rawText) {
      var text = rawText === undefined || rawText === null ? '' : String(rawText);
      if (!text) return '';
      var normalized = text
        .replace(/\r\n?/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/\u200b/g, '');
      normalized = normalized.trim();
      if (!normalized) return '';
      return normalized;
    }

    function cloneMindNodeTree(node) {
      if (!node || typeof node !== 'object') return null;
      var cloned = cloneMindDataObject({ nodeData: node });
      return cloned && cloned.nodeData ? cloned.nodeData : null;
    }

    function collectCaseLeafKeys(node, depth, pathTopics, output) {
      if (!node) return;
      var topics = Array.isArray(pathTopics) ? pathTopics.slice() : [];
      if (depth > 0) {
        topics.push(normalizeMindTopic(node.topic));
      }
      var children = Array.isArray(node.children) ? node.children : [];
      if (!children.length) {
        if (depth > 0) {
          var key = topics.join('\u0001') + '|len=' + String(topics.length);
          output.push(key);
        }
        return;
      }
      for (var i = 0; i < children.length; i += 1) {
        collectCaseLeafKeys(children[i], depth + 1, topics, output);
      }
    }

    function calculateCaseChangeSummary(baseData, currentData) {
      var baseNode = baseData && baseData.nodeData ? baseData.nodeData : null;
      var currentNode = currentData && currentData.nodeData ? currentData.nodeData : null;
      var baseKeys = [];
      var currentKeys = [];
      collectCaseLeafKeys(baseNode, 0, [], baseKeys);
      collectCaseLeafKeys(currentNode, 0, [], currentKeys);

      function buildCounter(keys) {
        var map = Object.create(null);
        (keys || []).forEach(function(key) {
          var k = String(key || '');
          map[k] = (map[k] || 0) + 1;
        });
        return map;
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


    function validateMindDataCases(mindData, options) {
      var opts = options || {};
      var fieldCount = Number(opts.fieldCount);
      if (!isFinite(fieldCount) || fieldCount <= 0) fieldCount = 6;
      var topicCaseParser = opts && typeof opts.topicCaseParser === 'function'
        ? opts.topicCaseParser
        : null;
      var nodeData = mindData && mindData.nodeData ? mindData.nodeData : null;
      var emptyMap = Object.create(null);
      var structMap = Object.create(null);
      var cases = [];

      function mark(map, id) {
        if (id === undefined || id === null) return;
        map[String(id)] = true;
      }

      function parseTopicsToCase(topics) {
        var segs = Array.isArray(topics) ? topics : [];
        if (topicCaseParser) {
          try {
            var parsed = topicCaseParser(segs.slice());
            if (parsed && typeof parsed === 'object') {
              var parsedCaseItem = parsed.caseItem && typeof parsed.caseItem === 'object'
                ? parsed.caseItem
                : null;
              var parsedEmptyIndexes = Array.isArray(parsed.emptyIndexes)
                ? parsed.emptyIndexes
                : [];
              return {
                caseItem: parsedCaseItem,
                emptyIndexes: parsedEmptyIndexes,
              };
            }
          } catch (err) {
            // ignore
          }
          return {
            caseItem: null,
            emptyIndexes: [],
          };
        }

        var moduleRaw = normalizeMindTopic(segs[0]);
        var titleRaw = normalizeMindTopic(segs[1]);
        var priorityRaw = normalizeMindTopic(segs[2]);
        var preRaw = normalizeMindTopic(segs[3]);
        var stepsRaw = normalizeMindTopic(segs[4]);
        var expectedRaw = normalizeMindTopic(segs[5]);

        var moduleValue = decodeMindTopicForSave(moduleRaw);
        var titleValue = decodeMindTopicForSave(titleRaw);
        var priorityValue = decodeMindTopicForSave(priorityRaw) || 'P1';
        if (priorityValue) {
          var priorityHead = priorityValue.charAt(0);
          if (priorityHead === 'p' || priorityHead === 'P') {
            priorityValue = 'P' + priorityValue.slice(1);
          }
        }
        var preValue = decodeMindTopicForSave(preRaw);
        var stepsValue = decodeMindTopicForSave(stepsRaw);
        var expectedValue = decodeMindTopicForSave(expectedRaw);

        var missingIndexes = [];
        if (!moduleValue) missingIndexes.push(0);
        if (!titleValue) missingIndexes.push(1);
        if (!expectedValue) missingIndexes.push(5);
        if (missingIndexes.length) {
          return {
            caseItem: null,
            emptyIndexes: missingIndexes,
          };
        }

        return {
          caseItem: {
            module: moduleValue,
            title: titleValue,
            priority: priorityValue,
            preconditions: preValue,
            precondition: preValue,
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
            emptyIndexes.forEach(function(indexNum) {
              var idx = Number(indexNum);
              if (!isFinite(idx) || idx < 0) return;
              if (nodeIds[idx]) mark(emptyMap, nodeIds[idx]);
            });
            return;
          }

          cases.push(caseItem);
          return;
        }

        for (var i = 0; i < children.length; i += 1) {
          walk(children[i], depth + 1, topics, nodeIds);
        }
      }

      walk(nodeData, 0, [], []);
      var emptyNodeIds = Object.keys(emptyMap);
      var structuralNodeIds = Object.keys(structMap);
      var errors = [];
      if (emptyNodeIds.length) {
        errors.push('存在空节点，无法保存');
      }
      if (structuralNodeIds.length) {
        errors.push('存在结构不完整的用例路径，无法保存');
      }

      return {
        ok: errors.length === 0,
        cases: cases,
        emptyNodeIds: emptyNodeIds,
        structuralNodeIds: structuralNodeIds,
        errors: errors,
      };
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
        // ignore
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
        // ignore
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
        // ignore
      }
      return null;
    }

    function resolveMindUtilsApi() {
      if (typeof window === 'undefined' || !window) return null;
      return window.app && window.app.utils ? window.app.utils : null;
    }

    function openMindConfirmDrawer(options) {
      var opts = options || {};
      var utilsApi = resolveMindUtilsApi();
      if (utilsApi && typeof utilsApi.openConfirmDrawer === 'function') {
        return utilsApi.openConfirmDrawer(opts);
      }
      var msg = opts && opts.message ? String(opts.message) : '';
      var ok = true;
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        ok = window.confirm(msg);
      }
      return Promise.resolve({ ok: ok });
    }

    function showMindToast(message, type, durationMs) {
      var text = message ? String(message) : '';
      if (!text) return;
      var utilsApi = resolveMindUtilsApi();
      if (utilsApi && typeof utilsApi.showCenterToast === 'function') {
        utilsApi.showCenterToast(text, type || '', durationMs || 3000);
      }
    }

    function buildMindChangeConfirmMessage(summary, suffix) {
      var meta = summary && typeof summary === 'object' ? summary : {};
      var modified = Number(meta.modified || 0);
      var added = Number(meta.added || 0);
      var deleted = Number(meta.deleted || 0);
      if (!isFinite(modified) || modified < 0) modified = 0;
      if (!isFinite(added) || added < 0) added = 0;
      if (!isFinite(deleted) || deleted < 0) deleted = 0;
      return '修改' + modified + '条、新增' + added + '条、删除' + deleted + '条，' + String(suffix || '确认继续吗？');
    }

    function clampScale(value, minValue, maxValue) {
      var num = Number(value);
      if (!isFinite(num)) return 1;
      var lower = Number(minValue);
      var upper = Number(maxValue);
      if (!isFinite(lower) || lower <= 0) lower = minScale;
      if (!isFinite(upper) || upper <= 0) upper = maxScale;
      if (upper < lower) {
        var swap = upper;
        upper = lower;
        lower = swap;
      }
      if (num < lower) return lower;
      if (num > upper) return upper;
      return num;
    }

    function resolveScale(instance) {
      if (!instance) return 1;
      var num = Number(instance.scaleVal);
      if (!isFinite(num) || num <= 0) return 1;
      return num;
    }

    function updateViewerDragState(viewerEl, instance, dragging) {
      if (!viewerEl || !viewerEl.classList) return;
      var canDrag = resolveScale(instance) > 1.01;
      if (canDrag) viewerEl.classList.add('is-draggable');
      else viewerEl.classList.remove('is-draggable');
      if (canDrag && dragging) viewerEl.classList.add('is-dragging');
      else viewerEl.classList.remove('is-dragging');
    }

    function syncDetachedGhostTheme(ghostEl, instance) {
      if (!ghostEl || !instance || !instance.container) return;
      if (typeof window === 'undefined' || !window || typeof window.getComputedStyle !== 'function') return;
      var styles = null;
      try {
        styles = window.getComputedStyle(instance.container);
      } catch (err) {
        styles = null;
      }
      if (!styles) return;
      var mainBg = styles.getPropertyValue('--main-bgcolor');
      var mainColor = styles.getPropertyValue('--main-color');
      if (mainBg) ghostEl.style.backgroundColor = String(mainBg).trim();
      if (mainColor) {
        var color = String(mainColor).trim();
        if (color) {
          ghostEl.style.borderColor = color;
          ghostEl.style.color = color;
        }
      }
    }

    function detachMindDragGhost(instance) {
      if (!instance || !instance.container || !instance.container.querySelectorAll) return;
      if (typeof document === 'undefined' || !document || !document.body || !document.body.appendChild) return;
      var list = instance.container.querySelectorAll('.mind-elixir-ghost');
      if (!list || !list.length) return;
      var detached = Array.isArray(instance.__tapDetachedNodes) ? instance.__tapDetachedNodes : [];
      Array.prototype.forEach.call(list, function(ghostEl) {
        if (!ghostEl) return;
        if (ghostEl.classList) ghostEl.classList.add('xmind-floating-ghost');
        syncDetachedGhostTheme(ghostEl, instance);
        try {
          document.body.appendChild(ghostEl);
          detached.push(ghostEl);
        } catch (err) {
          // ignore
        }
      });
      instance.__tapDetachedNodes = detached;
    }

    function normalizeSearchKeyword(value) {
      var text = value === undefined || value === null ? '' : String(value);
      return text.trim().toLowerCase();
    }

    function isMindNodeSearchable(node) {
      var meta = node && node.xmindMeta && typeof node.xmindMeta === 'object' ? node.xmindMeta : null;
      var type = meta && meta.type ? String(meta.type || '') : '';
      if (
        type === 'priority'
        || type === 'preconditions'
        || type === 'steps'
        || type === 'expected'
      ) {
        return false;
      }
      return true;
    }

    function collectSearchNodeIds(node, keyword, output) {
      if (!node || !keyword) return;
      var list = Array.isArray(output) ? output : [];
      var topicText = node && node.topic !== undefined && node.topic !== null
        ? String(node.topic)
        : '';
      if (isMindNodeSearchable(node) && topicText.toLowerCase().indexOf(keyword) !== -1 && node.id) {
        list.push(String(node.id));
      }
      var children = Array.isArray(node.children) ? node.children : [];
      for (var i = 0; i < children.length; i += 1) {
        collectSearchNodeIds(children[i], keyword, list);
      }
    }

    function findMindNodeElement(instance, nodeId) {
      if (!instance || !nodeId || typeof instance.findEle !== 'function') return null;
      try {
        return instance.findEle(String(nodeId));
      } catch (err) {
        return null;
      }
    }

    function bindViewerInteractions(viewerEl, canvasEl, instance, options) {
      if (!viewerEl || !canvasEl || !instance) return null;

      var opts = options || {};
      if (viewerEl.setAttribute && !viewerEl.getAttribute('tabindex')) {
        viewerEl.setAttribute('tabindex', '0');
      }
      var controlsEl = viewerEl.querySelector ? viewerEl.querySelector('[data-mind-controls]') : null;
      var searchInputEl = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-search-input]')
        : null;
      var searchCountEl = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-search-count]')
        : null;
      var editEnterBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="edit-enter"]')
        : null;
      var editCancelBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="edit-cancel"]')
        : null;
      var editSaveBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="edit-save"]')
        : null;
      var editAddBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="node-add"]')
        : null;
      var editDeleteBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="node-delete"]')
        : null;
      var editUndoBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="undo"]')
        : null;
      var editRedoBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="redo"]')
        : null;
      var fullscreenToggleBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="drawer-fullscreen"]')
        : null;

      var editableSessionKey = opts && opts.editableSessionKey ? String(opts.editableSessionKey) : '';
      var restoredSession = opts && opts.restoredSession && typeof opts.restoredSession === 'object'
        ? opts.restoredSession
        : null;
      var restoreNoticeSignature = opts && opts.restoreNoticeSignature
        ? String(opts.restoreNoticeSignature)
        : '';
      var allowEdit = !(opts && opts.allowEdit === false);
      var editing = allowEdit && opts && opts.initialEditing === true;
      var pendingSave = false;
      var applyingHistory = false;
      var recordTimer = 0;
      var baseMindData = cloneMindDataObject(opts && opts.baseMindData)
        || cloneMindDataObject(opts && opts.initialMindData)
        || readMindDataFromInstance(instance)
        || null;

      var historyEntries = [];
      var historyIndex = -1;

      var searchState = {
        keyword: '',
        ids: [],
        index: -1,
      };
      var searchFocusRestoreTimer = 0;
      var exportState = {
        pending: false,
      };

      function focusViewerForKeyboard() {
        var inst = getInstance();
        var focusEl = inst && inst.container && typeof inst.container.focus === 'function'
          ? inst.container
          : viewerEl;
        if (!focusEl || typeof focusEl.focus !== 'function') return;
        try {
          focusEl.focus({ preventScroll: true });
        } catch (err) {
          try {
            focusEl.focus();
          } catch (err2) {
            // ignore
          }
        }
      }

      var enableCustomBoxSelection = Boolean(opts && opts.enableCustomBoxSelection === true);
      var boxPending = false;
      var boxSelecting = false;
      var boxMoved = false;
      var boxStartX = 0;
      var boxStartY = 0;
      var boxRectEl = null;
      var boxSelectionCommitTimer = 0;
      var boxMinDragDistance = 4;
      var boxSuppressClickUntil = 0;
      var customSelectionNodes = [];
      var modifierSelectionSuppressClickUntil = 0;
      var modifierSelectionPointerGuard = {
        until: 0,
        nodeKey: '',
      };
      var editNodePointerSelection = {
        active: false,
        nodeId: '',
        startX: 0,
        startY: 0,
      };
      var editNodePointerSuppressCanvasClearUntil = 0;

      var rightDragGestureBlock = {
        active: false,
        pointerId: null,
        captureTarget: null,
        suppressContextUntil: 0,
      };

      var ctrlLeftCanvasDrag = {
        active: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
      };
      var ctrlModifierPressed = false;
      var zoomMinScale = minScale;
      var ctrlWheelMinScale = minScale;
      var nodeContextMenuEl = null;
      var nodeContextMenuMeta = null;
      var clickNodeEditTimer = 0;
      var clickNodeEditDelay = 220;
      var beginEditSelectionMode = 'end';
      var beginEditCaretPoint = null;
      var beginEditSelectionResetTimer = 0;
      var pendingKeyboardNodeEditPayload = null;
      var editInputPointerState = {
        active: false,
        startX: 0,
        startY: 0,
        moved: false,
        multiClick: false,
      };
      var inputSelectionScheduleToken = 0;
      var lastEditingInputBoxEl = null;
      var inputSelectionGuardTimer = 0;
      var inputSelectionGuardUntil = 0;
      var inputSelectionGuardToken = 0;
      var inputSelectionGuardPoint = null;
      var nodeDecorateTimer = 0;
      var nodeDecorateObserver = null;
      var nodeDecorationApplying = false;
      var drawerEl = viewerEl && typeof viewerEl.closest === 'function' ? viewerEl.closest('.drawer') : null;
      var drawerPanelEl = viewerEl && typeof viewerEl.closest === 'function' ? viewerEl.closest('.drawer-panel') : null;

      function getInstance() {
        return instance;
      }

      function markViewportInteraction() {
        var inst = getInstance();
        if (inst && typeof inst === 'object') {
          inst.__tapViewportInteracted = true;
        }
      }

      function getCurrentMindData() {
        return readMindDataFromInstance(getInstance());
      }

      function callOpenConfirm(options) {
        if (opts && typeof opts.openConfirmDrawer === 'function') {
          return opts.openConfirmDrawer(options || {});
        }
        return openMindConfirmDrawer(options || {});
      }

      function callShowToast(message, type, durationMs) {
        if (opts && typeof opts.showToast === 'function') {
          opts.showToast(message, type || '', durationMs || 3000);
          return;
        }
        showMindToast(message, type || '', durationMs || 3000);
      }

      function buildNodeMeta(nodeEl) {
        var nodeObj = nodeEl && nodeEl.nodeObj ? nodeEl.nodeObj : null;
        if (!nodeObj) return null;
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
        var inst = getInstance();
        var rootTopic = inst && inst.nodeData && inst.nodeData.topic !== null && inst.nodeData.topic !== undefined
          ? String(inst.nodeData.topic).trim()
          : '';
        if (rootTopic && path.length && path[0] === rootTopic) {
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

      function buildDefaultSelectionGroupDescriptor(nodeMeta) {
        if (!enableCustomBoxSelection || !nodeMeta) return null;
        var path = Array.isArray(nodeMeta.path) ? nodeMeta.path.map(function(seg) {
          return seg === null || seg === undefined ? '' : String(seg).trim();
        }).filter(function(seg) {
          return Boolean(seg);
        }) : [];
        if (!path.length) {
          var rootTopic = nodeMeta.topic === null || nodeMeta.topic === undefined
            ? ''
            : String(nodeMeta.topic).trim();
          if (!rootTopic) return null;
          return {
            key: 'root::' + encodeURIComponent(rootTopic),
            preferred: true,
          };
        }
        if (path.length === 1) {
          return {
            key: 'module::' + encodeURIComponent(path[0]),
            preferred: true,
          };
        }
        return {
          key: 'case::' + encodeURIComponent(path[0]) + '::' + encodeURIComponent(path[1]),
          preferred: path.length === 2,
        };
      }

      function applyDefaultSelectionGroup(nodeEl, nodeMeta) {
        if (!enableCustomBoxSelection || !nodeEl || !nodeEl.getAttribute || !nodeEl.setAttribute) return;
        var existingGroup = String(nodeEl.getAttribute('data-xmind-select-group') || '').trim();
        if (existingGroup) return;
        var descriptor = buildDefaultSelectionGroupDescriptor(nodeMeta);
        if (!descriptor || !descriptor.key) return;
        nodeEl.setAttribute('data-xmind-select-group', String(descriptor.key));
        nodeEl.setAttribute('data-xmind-select-preferred', descriptor.preferred ? '1' : '0');
      }

      function normalizeActionList(list) {
        if (!Array.isArray(list)) return [];
        return list.map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var actionId = item.id === undefined || item.id === null ? '' : String(item.id);
          if (!actionId) return null;
          return {
            id: actionId,
            label: item.label === undefined || item.label === null ? actionId : String(item.label),
            disabled: item.disabled === true,
          };
        }).filter(Boolean);
      }

      function collectSelectedNodeMetas(preferredNodeEl) {
        var selectedNodes = collectSelectedNodes().slice();
        if (preferredNodeEl) {
          var exists = selectedNodes.some(function(node) {
            return node === preferredNodeEl;
          });
          if (!exists) selectedNodes.unshift(preferredNodeEl);
        }
        return selectedNodes.map(function(node) {
          return buildNodeMeta(node);
        }).filter(Boolean);
      }

      function ensureActionContext(nodeMeta) {
        if (!nodeMeta) return null;
        if (Array.isArray(nodeMeta.selection)) return nodeMeta;
        var preferredNodeEl = nodeMeta.nodeEl || null;
        var actionMeta = preferredNodeEl ? buildNodeMeta(preferredNodeEl) : nodeMeta;
        if (!actionMeta) return null;
        actionMeta.selection = collectSelectedNodeMetas(preferredNodeEl);
        actionMeta.selectionCount = actionMeta.selection.length;
        return actionMeta;
      }

      function getNodeActionsForMeta(nodeMeta) {
        if (!nodeMeta || !opts || typeof opts.getNodeActions !== 'function') return [];
        try {
          return normalizeActionList(opts.getNodeActions(ensureActionContext(nodeMeta)));
        } catch (err) {
          return [];
        }
      }

      function requestNodeAction(actionId, nodeMeta) {
        if (!actionId || !opts || typeof opts.onNodeAction !== 'function') return false;
        try {
          opts.onNodeAction(String(actionId), ensureActionContext(nodeMeta) || null);
          return true;
        } catch (err) {
          return false;
        }
      }

      function requestDeleteSelection(nodeMeta) {
        if (!opts || typeof opts.onDeleteSelection !== 'function') return false;
        try {
          opts.onDeleteSelection(ensureActionContext(nodeMeta) || null);
          return true;
        } catch (err) {
          return false;
        }
      }

      function notifyEditStateChange() {
        if (opts && typeof opts.onEditStateChange === 'function') {
          try {
            opts.onEditStateChange({ editing: editing, pendingSave: pendingSave });
          } catch (err) {
            // ignore
          }
        }
      }

      function snapshotSignature(data) {
        return buildMindDataSignature(data);
      }

      function buildHistoryEntry(data) {
        var cloned = cloneMindDataObject(data);
        if (!cloned || !cloned.nodeData) return null;
        return {
          data: cloned,
          signature: snapshotSignature(cloned),
        };
      }

      function persistEditSession() {
        if (!editableSessionKey) return;
        if (!editing) {
          clearMindEditSession(editableSessionKey);
          return;
        }
        var currentData = getCurrentMindData();
        if (!currentData || !currentData.nodeData) return;

        var historyCap = 80;
        var start = 0;
        if (historyEntries.length > historyCap) {
          start = historyEntries.length - historyCap;
        }
        var sliced = historyEntries.slice(start);
        var payloadHistory = sliced.map(function(entry) {
          return cloneMindDataObject(entry.data);
        }).filter(function(entry) {
          return Boolean(entry && entry.nodeData);
        });
        var nextIndex = historyIndex - start;
        if (nextIndex < 0) nextIndex = 0;
        if (nextIndex >= payloadHistory.length) nextIndex = payloadHistory.length - 1;
        if (nextIndex < 0) nextIndex = 0;

        writeMindEditSession(editableSessionKey, {
          version: 1,
          editing: true,
          baseData: cloneMindDataObject(baseMindData),
          currentData: cloneMindDataObject(currentData),
          history: payloadHistory,
          historyIndex: nextIndex,
          restoreNoticeSignature: restoreNoticeSignature,
          updatedAt: Date.now(),
        });
      }

      function pushHistorySnapshot(data, options) {
        var opts1 = options || {};
        var entry = buildHistoryEntry(data);
        if (!entry) return;

        if (opts1.reset === true) {
          historyEntries = [entry];
          historyIndex = 0;
          if (opts1.persist !== false) persistEditSession();
          return;
        }

        var current = historyEntries[historyIndex] || null;
        if (current && current.signature === entry.signature) {
          if (opts1.persist !== false) persistEditSession();
          return;
        }

        historyEntries = historyEntries.slice(0, historyIndex + 1);
        historyEntries.push(entry);
        historyIndex = historyEntries.length - 1;
        if (opts1.persist !== false) persistEditSession();
      }

      function recordSnapshotNow() {
        if (!editing || applyingHistory) return false;
        var snapshot = getCurrentMindData();
        if (!snapshot || !snapshot.nodeData) return false;
        pushHistorySnapshot(snapshot);
        return true;
      }

      function flushPendingEditSnapshot() {
        if (recordTimer) {
          clearTimeout(recordTimer);
          recordTimer = 0;
        }
        if (!editing || applyingHistory) return;
        if (!recordSnapshotNow()) persistEditSession();
      }

      function initializeHistory() {
        var restoredHistory = restoredSession && Array.isArray(restoredSession.history)
          ? restoredSession.history
          : [];
        if (editing && restoredHistory.length) {
          var list = restoredHistory.map(function(entry) {
            return buildHistoryEntry(entry);
          }).filter(Boolean);
          if (list.length) {
            historyEntries = list;
            var restoredIndex = Number(restoredSession && restoredSession.historyIndex);
            if (!isFinite(restoredIndex)) restoredIndex = list.length - 1;
            if (restoredIndex < 0) restoredIndex = 0;
            if (restoredIndex >= list.length) restoredIndex = list.length - 1;
            historyIndex = restoredIndex;
            return;
          }
        }
        var initial = getCurrentMindData() || cloneMindDataObject(opts && opts.initialMindData);
        if (initial && initial.nodeData) {
          pushHistorySnapshot(initial, { reset: true, persist: false });
        }
      }

      function scheduleRecordSnapshot() {
        if (!editing || applyingHistory) return;
        if (recordTimer) clearTimeout(recordTimer);
        recordTimer = setTimeout(function() {
          recordTimer = 0;
          recordSnapshotNow();
          updateEditButtons();
        }, 20);
      }

      function clearValidationMarks() {
        if (!viewerEl || !viewerEl.querySelectorAll) return;
        var nodes = viewerEl.querySelectorAll('me-tpc.xmind-node-empty-error, me-tpc.xmind-node-struct-error');
        if (!nodes || !nodes.length) return;
        Array.prototype.forEach.call(nodes, function(node) {
          if (!node || !node.classList) return;
          node.classList.remove('xmind-node-empty-error');
          node.classList.remove('xmind-node-struct-error');
        });
      }

      function applyValidationMarks(emptyIds, structIds) {
        clearValidationMarks();
        var inst = getInstance();
        if (!inst) return;
        var empty = Array.isArray(emptyIds) ? emptyIds : [];
        var struct = Array.isArray(structIds) ? structIds : [];
        empty.forEach(function(id) {
          var el = findMindNodeElement(inst, id);
          if (!el || !el.classList) return;
          el.classList.add('xmind-node-empty-error');
        });
        struct.forEach(function(id2) {
          var el2 = findMindNodeElement(inst, id2);
          if (!el2 || !el2.classList) return;
          el2.classList.add('xmind-node-struct-error');
        });
      }

      function setSearchCount() {
        if (!searchCountEl) return;
        var total = Array.isArray(searchState.ids) ? searchState.ids.length : 0;
        var current = total > 0 && searchState.index >= 0 ? (searchState.index + 1) : 0;
        searchCountEl.textContent = String(current) + '/' + String(total);
        if (searchCountEl.classList) {
          if (total > 0) searchCountEl.classList.remove('is-empty');
          else searchCountEl.classList.add('is-empty');
        }
      }

      function clearSearchFocusRestoreTimer() {
        if (!searchFocusRestoreTimer) return;
        clearTimeout(searchFocusRestoreTimer);
        searchFocusRestoreTimer = 0;
      }

      function readSearchInputSelection() {
        if (!searchInputEl) return null;
        var start = typeof searchInputEl.selectionStart === 'number'
          ? Number(searchInputEl.selectionStart)
          : NaN;
        var end = typeof searchInputEl.selectionEnd === 'number'
          ? Number(searchInputEl.selectionEnd)
          : NaN;
        return {
          start: isFinite(start) ? start : NaN,
          end: isFinite(end) ? end : NaN,
        };
      }

      function applySearchInputFocus(selection) {
        if (!searchInputEl || typeof searchInputEl.focus !== 'function') return;
        var ownerDoc = searchInputEl.ownerDocument || document;
        if (!ownerDoc || !ownerDoc.body || !ownerDoc.body.contains || !ownerDoc.body.contains(searchInputEl)) return;
        try {
          searchInputEl.focus({ preventScroll: true });
        } catch (err) {
          try {
            searchInputEl.focus();
          } catch (err2) {
            return;
          }
        }
        if (typeof searchInputEl.setSelectionRange !== 'function') return;
        var range = selection && typeof selection === 'object' ? selection : null;
        var length = String(searchInputEl.value || '').length;
        var start = range && isFinite(Number(range.start)) ? Number(range.start) : length;
        var end = range && isFinite(Number(range.end)) ? Number(range.end) : start;
        if (start < 0) start = 0;
        if (end < 0) end = 0;
        if (start > length) start = length;
        if (end > length) end = length;
        try {
          searchInputEl.setSelectionRange(start, end);
        } catch (err3) {
          // ignore
        }
      }

      function scheduleSearchInputFocus(selection) {
        if (!searchInputEl || typeof searchInputEl.focus !== 'function') return;
        clearSearchFocusRestoreTimer();
        var range = selection && typeof selection === 'object' ? selection : null;
        applySearchInputFocus(range);
        searchFocusRestoreTimer = setTimeout(function() {
          searchFocusRestoreTimer = 0;
          applySearchInputFocus(range);
        }, 0);
      }

      function clearSearchClasses() {
        if (!viewerEl || !viewerEl.querySelectorAll) return;
        var marked = viewerEl.querySelectorAll('me-tpc.xmind-search-hit, me-tpc.xmind-search-active');
        if (!marked || !marked.length) return;
        Array.prototype.forEach.call(marked, function(node) {
          if (!node || !node.classList) return;
          node.classList.remove('xmind-search-hit');
          node.classList.remove('xmind-search-active');
        });
      }

      function applySearchClasses() {
        clearSearchClasses();
        var ids = Array.isArray(searchState.ids) ? searchState.ids : [];
        var inst = getInstance();
        for (var i = 0; i < ids.length; i += 1) {
          var target = findMindNodeElement(inst, ids[i]);
          if (!target || !target.classList) continue;
          target.classList.add('xmind-search-hit');
        }
        if (ids.length && searchState.index >= 0 && searchState.index < ids.length) {
          var active = findMindNodeElement(inst, ids[searchState.index]);
          if (active && active.classList) {
            active.classList.add('xmind-search-active');
          }
        }
        setSearchCount();
      }

      function filterRenderedSearchNodeIds(inst, ids) {
        var result = [];
        var seen = {};
        (Array.isArray(ids) ? ids : []).forEach(function(id) {
          var stableId = String(id || '');
          if (!stableId || seen[stableId]) return;
          var nodeEl = findMindNodeElement(inst, stableId);
          if (!nodeEl || !nodeEl.getBoundingClientRect) return;
          var rect = nodeEl.getBoundingClientRect();
          if (!rect || rect.width <= 0 || rect.height <= 0) return;
          seen[stableId] = true;
          result.push(stableId);
        });
        return result;
      }

      function centerSearchResultNode(nodeId) {
        var inst = getInstance();
        if (!inst || !nodeId || !inst.map) return false;
        var nodeEl = findMindNodeElement(inst, nodeId);
        var anchorEl = resolveMindAnchorElement(nodeEl);
        var viewportEl = canvasEl && canvasEl.getBoundingClientRect
          ? canvasEl
          : (inst.container && inst.container.getBoundingClientRect ? inst.container : null);
        if (!anchorEl || !anchorEl.getBoundingClientRect || !viewportEl) return false;
        var nodeRect = anchorEl.getBoundingClientRect();
        var viewportRect = viewportEl.getBoundingClientRect();
        var currentCenterX = Number(nodeRect.left + (nodeRect.width / 2));
        var currentCenterY = Number(nodeRect.top + (nodeRect.height / 2));
        var desiredCenterX = Number(viewportRect.left + (viewportRect.width / 2));
        var desiredCenterY = Number(viewportRect.top + (viewportRect.height / 2));
        if (
          !isFinite(currentCenterX)
          || !isFinite(currentCenterY)
          || !isFinite(desiredCenterX)
          || !isFinite(desiredCenterY)
        ) {
          return false;
        }
        var deltaX = desiredCenterX - currentCenterX;
        var deltaY = desiredCenterY - currentCenterY;
        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
        var transformState = parseMindTransformState(inst.map && inst.map.style ? inst.map.style.transform : '');
        transformState.x += deltaX;
        transformState.y += deltaY;
        if (writeMindTransformState(inst, transformState)) {
          inst.__tapViewportInteracted = true;
          return true;
        }
        return false;
      }

      function scheduleSearchResultCenter(nodeId) {
        var stableId = String(nodeId || '');
        if (!stableId) return;
        var run = function() {
          centerSearchResultNode(stableId);
        };
        run();
        if (typeof window !== 'undefined' && window && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(run);
        }
        [16, 64, 140].forEach(function(delayMs) {
          setTimeout(run, delayMs);
        });
      }

      function focusSearchIndex(index, options) {
        var opts2 = options || {};
        var ids = Array.isArray(searchState.ids) ? searchState.ids : [];
        if (!ids.length) {
          searchState.index = -1;
          applySearchClasses();
          if (opts2.preserveInputFocus) {
            scheduleSearchInputFocus(opts2.selection);
          }
          return;
        }
        var nextIndex = Number(index);
        if (!isFinite(nextIndex)) nextIndex = 0;
        if (nextIndex < 0) {
          nextIndex = ((nextIndex % ids.length) + ids.length) % ids.length;
        } else {
          nextIndex = nextIndex % ids.length;
        }
        searchState.index = nextIndex;
        applySearchClasses();
        var activeId = ids[nextIndex];
        scheduleSearchResultCenter(activeId);
        if (opts2.preserveInputFocus) {
          scheduleSearchInputFocus(opts2.selection);
        }
      }

      function runSearch(options) {
        var opts2 = options || {};
        var keepIndex = opts2.keepIndex === true;
        var selection = opts2.preserveInputFocus ? readSearchInputSelection() : null;
        var keyword = normalizeSearchKeyword(searchInputEl ? searchInputEl.value : '');
        searchState.keyword = keyword;
        if (!keyword) {
          searchState.ids = [];
          searchState.index = -1;
          applySearchClasses();
          if (opts2.preserveInputFocus) {
            scheduleSearchInputFocus(selection);
          }
          return;
        }
        var matchedIds = [];
        var inst = getInstance();
        collectSearchNodeIds(inst ? inst.nodeData : null, keyword, matchedIds);
        var renderedIds = filterRenderedSearchNodeIds(inst, matchedIds);
        searchState.ids = renderedIds;
        if (!renderedIds.length) {
          searchState.index = -1;
          applySearchClasses();
          if (opts2.preserveInputFocus) {
            scheduleSearchInputFocus(selection);
          }
          return;
        }
        if (keepIndex && searchState.index >= 0 && searchState.index < renderedIds.length) {
          focusSearchIndex(searchState.index, {
            preserveInputFocus: opts2.preserveInputFocus,
            selection: selection,
          });
        } else {
          focusSearchIndex(0, {
            preserveInputFocus: opts2.preserveInputFocus,
            selection: selection,
          });
        }
      }

      function moveSearch(step, options) {
        if (!Array.isArray(searchState.ids) || !searchState.ids.length) return;
        var delta = Number(step);
        if (!isFinite(delta) || delta === 0) return;
        var base = searchState.index >= 0 ? searchState.index : 0;
        focusSearchIndex(base + delta, options);
      }

      function clearSearch(options) {
        var opts2 = options || {};
        if (searchInputEl) searchInputEl.value = '';
        searchState.keyword = '';
        searchState.ids = [];
        searchState.index = -1;
        applySearchClasses();
        if (opts2.focusInput) {
          scheduleSearchInputFocus({ start: 0, end: 0 });
        }
      }

      function onSearchInput() {
        runSearch({ keepIndex: false, preserveInputFocus: true });
      }

      function onSearchKeydown(e) {
        if (!e) return;
        if (e.stopPropagation) e.stopPropagation();
        if (e.key !== 'Enter') return;
        if (e.preventDefault) e.preventDefault();
        if (e.shiftKey) moveSearch(-1, { preserveInputFocus: true, selection: readSearchInputSelection() });
        else moveSearch(1, { preserveInputFocus: true, selection: readSearchInputSelection() });
      }

      function getCanvasCenterPoint() {
        var rect = canvasEl.getBoundingClientRect();
        return {
          x: rect.left + (rect.width / 2),
          y: rect.top + (rect.height / 2),
        };
      }

      function syncInstanceScaleBounds(inst, minValue) {
        var target = inst || getInstance();
        if (!target || typeof target !== 'object') return;
        var lower = Number(minValue);
        if (!isFinite(lower) || lower <= 0) lower = zoomMinScale;
        if (!isFinite(lower) || lower <= 0) lower = minScale;
        if (lower < 0.05) lower = 0.05;
        var upper = Number(maxScale);
        if (!isFinite(upper) || upper <= 0) upper = 2.5;
        if (upper < lower) upper = lower;
        try {
          target.scaleMin = lower;
        } catch (err) {
          // ignore
        }
        try {
          target.scaleMax = upper;
        } catch (err2) {
          // ignore
        }
      }

      function syncZoomMinScaleWithCurrent(inst) {
        var current = resolveScale(inst || getInstance());
        if (!isFinite(current) || current <= 0) return;
        var normalized = Number(current);
        if (!isFinite(normalized)) return;
        if (normalized > maxScale) normalized = maxScale;
        if (normalized < minScale) normalized = minScale;
        if (normalized < zoomMinScale) {
          zoomMinScale = normalized;
          syncInstanceScaleBounds(inst || getInstance(), zoomMinScale);
        }
      }

      function syncCtrlWheelMinScaleWithCurrent(inst, forceReset) {
        var current = resolveScale(inst || getInstance());
        if (!isFinite(current) || current <= 0) return;
        var normalized = Number(current);
        if (!isFinite(normalized)) return;
        if (normalized > maxScale) normalized = maxScale;
        if (normalized < minScale) normalized = minScale;
        if (forceReset === true || normalized > ctrlWheelMinScale) {
          ctrlWheelMinScale = normalized;
          return;
        }
        if (normalized < ctrlWheelMinScale) {
          ctrlWheelMinScale = normalized;
        }
      }

      function canToggleDrawerFullscreen() {
        return Boolean(
          drawerEl &&
          drawerPanelEl &&
          drawerEl.classList &&
          drawerPanelEl.classList &&
          drawerFullscreenPort &&
          typeof drawerFullscreenPort.is === 'function' &&
          typeof drawerFullscreenPort.set === 'function'
        );
      }

      function isDrawerFullscreen() {
        if (!canToggleDrawerFullscreen()) return false;
        return drawerFullscreenPort.is(drawerEl);
      }

      function syncFullscreenButtonState() {
        if (!fullscreenToggleBtn) return;
        if (!canToggleDrawerFullscreen()) {
          fullscreenToggleBtn.disabled = true;
          if (fullscreenToggleBtn.classList) fullscreenToggleBtn.classList.add('hidden');
          return;
        }
        if (fullscreenToggleBtn.classList) fullscreenToggleBtn.classList.remove('hidden');
        fullscreenToggleBtn.disabled = false;
        var fullscreen = isDrawerFullscreen();
        fullscreenToggleBtn.textContent = fullscreen ? '复原' : '全屏';
        fullscreenToggleBtn.title = fullscreen ? '复原' : '全屏';
        fullscreenToggleBtn.setAttribute('aria-pressed', fullscreen ? 'true' : 'false');
      }

      function notifyViewportStateChange(reason) {
        if (!opts || typeof opts.onViewStateChange !== 'function') return;
        try {
          opts.onViewStateChange({
            reason: reason ? String(reason || '') : '',
          });
        } catch (err) {
          // ignore
        }
      }

      var pendingViewportPan = {
        frameId: 0,
        deltaX: 0,
        deltaY: 0,
        reason: '',
        dragging: false,
      };

      function requestViewportFrame(callback) {
        if (typeof window !== 'undefined' && window && typeof window.requestAnimationFrame === 'function') {
          return window.requestAnimationFrame(callback);
        }
        return setTimeout(callback, 16);
      }

      function flushPendingViewportPan() {
        var deltaX = pendingViewportPan.deltaX;
        var deltaY = pendingViewportPan.deltaY;
        var reason = pendingViewportPan.reason || 'pan';
        var dragging = pendingViewportPan.dragging === true;
        pendingViewportPan.frameId = 0;
        pendingViewportPan.deltaX = 0;
        pendingViewportPan.deltaY = 0;
        pendingViewportPan.reason = '';
        pendingViewportPan.dragging = false;
        if (deltaX === 0 && deltaY === 0) return;
        var inst = getInstance();
        if (!inst || typeof inst.move !== 'function') return;
        try {
          inst.move(deltaX, deltaY);
        } catch (err) {
          return;
        }
        updateViewerDragState(viewerEl, inst, dragging);
        notifyViewportStateChange(reason);
      }

      function queueViewportPan(deltaX, deltaY, reason, dragging) {
        var x = Number(deltaX);
        var y = Number(deltaY);
        if (!isFinite(x)) x = 0;
        if (!isFinite(y)) y = 0;
        if (x === 0 && y === 0) return false;
        pendingViewportPan.deltaX += x;
        pendingViewportPan.deltaY += y;
        pendingViewportPan.reason = reason ? String(reason || '') : 'pan';
        pendingViewportPan.dragging = pendingViewportPan.dragging === true || dragging === true;
        if (!pendingViewportPan.frameId) {
          pendingViewportPan.frameId = requestViewportFrame(flushPendingViewportPan);
        }
        return true;
      }

      function setDrawerFullscreen(enabled) {
        if (!canToggleDrawerFullscreen()) {
          syncFullscreenButtonState();
          return false;
        }
        drawerFullscreenPort.set(drawerEl, enabled === true);
        return enabled === true;
      }

      function onDrawerFullscreenChange() {
        syncFullscreenButtonState();
        updateViewerDragState(viewerEl, getInstance(), false);
        notifyViewportStateChange('drawer-fullscreen');
      }

      function zoomBy(step) {
        var inst = getInstance();
        if (!inst || typeof inst.scale !== 'function') return;
        markViewportInteraction();
        syncInstanceScaleBounds(inst, zoomMinScale);
        var current = resolveScale(inst);
        var next = clampScale(current + step, zoomMinScale, maxScale);
        var center = getCanvasCenterPoint();
        inst.scale(next, center);
        updateViewerDragState(viewerEl, inst, false);
        notifyViewportStateChange(step > 0 ? 'zoom-in' : 'zoom-out');
      }

      function zoomByWheelEvent(e) {
        if (!e) return false;
        var inst = getInstance();
        if (!inst || typeof inst.scale !== 'function') return false;
        var deltaY = Number(e.deltaY);
        if (!isFinite(deltaY) || deltaY === 0) return false;
        markViewportInteraction();
        syncInstanceScaleBounds(inst, zoomMinScale);
        var sensitivity = Number(inst.scaleSensitivity);
        if (!isFinite(sensitivity) || sensitivity <= 0) sensitivity = defaultScaleStep;
        var step = deltaY < 0 ? sensitivity : -sensitivity;
        var current = resolveScale(inst);
        var lowerBound = ctrlWheelMinScale;
        if (!isFinite(lowerBound) || lowerBound <= 0) lowerBound = zoomMinScale;
        if (!isFinite(lowerBound) || lowerBound <= 0) lowerBound = minScale;
        if (current < lowerBound) lowerBound = current;
        var next = clampScale(current + step, lowerBound, maxScale);
        var center = {
          x: isFinite(Number(e.clientX)) ? Number(e.clientX) : getCanvasCenterPoint().x,
          y: isFinite(Number(e.clientY)) ? Number(e.clientY) : getCanvasCenterPoint().y,
        };
        inst.scale(next, center);
        updateViewerDragState(viewerEl, inst, false);
        notifyViewportStateChange('zoom-wheel');
        return true;
      }

      function panByWheelEvent(e) {
        if (!e) return false;
        var inst = getInstance();
        if (!inst || typeof inst.move !== 'function') return false;
        var deltaX = Number(e.deltaX);
        var deltaY = Number(e.deltaY);
        if (!isFinite(deltaX)) deltaX = 0;
        if (!isFinite(deltaY)) deltaY = 0;
        if (deltaX === 0 && deltaY === 0) return false;
        markViewportInteraction();
        if (e.shiftKey && deltaX === 0 && deltaY !== 0) {
          deltaX = deltaY;
          deltaY = 0;
        }
        return queueViewportPan(-deltaX, -deltaY, 'pan-wheel', false);
      }

      function zoomFit() {
        var inst = getInstance();
        markViewportInteraction();
        var fitCenterNodeId = '';
        if (inst && inst.nodeData && inst.nodeData.id !== undefined && inst.nodeData.id !== null) {
          fitCenterNodeId = String(inst.nodeData.id);
        }
        if (inst && typeof inst.scaleFit === 'function') {
          inst.scaleFit();
          syncZoomMinScaleWithCurrent(inst);
          syncCtrlWheelMinScaleWithCurrent(inst, true);
          if (fitCenterNodeId) {
            centerMindNode(inst, fitCenterNodeId);
            [0, 16, 48].forEach(function(delayMs) {
              setTimeout(function() {
                if (!viewerEl || !viewerEl.isConnected) return;
                centerMindNode(inst, fitCenterNodeId);
              }, delayMs);
            });
          }
        }
        updateViewerDragState(viewerEl, inst, false);
        notifyViewportStateChange('zoom-fit');
      }

      function clearBoxSelectionCommitTimer() {
        if (!boxSelectionCommitTimer) return;
        clearTimeout(boxSelectionCommitTimer);
        boxSelectionCommitTimer = 0;
      }

      function ensureBoxRectEl() {
        if (boxRectEl) {
          var sameParent = boxRectEl.parentNode === viewerEl;
          if (boxRectEl.isConnected && sameParent) return boxRectEl;
          if (boxRectEl.parentNode && boxRectEl.parentNode.removeChild) {
            try {
              boxRectEl.parentNode.removeChild(boxRectEl);
            } catch (err0) {
              // ignore
            }
          }
          boxRectEl = null;
        }
        if (!viewerEl || !viewerEl.appendChild) return null;
        if (typeof document === 'undefined' || !document.createElement) return null;
        boxRectEl = document.createElement('div');
        boxRectEl.className = 'xmind-box-select-rect';
        boxRectEl.style.display = 'none';
        viewerEl.appendChild(boxRectEl);
        return boxRectEl;
      }

      function clearBoxSelectionClasses() {
        if (!viewerEl || !viewerEl.querySelectorAll) return;
        var selected = viewerEl.querySelectorAll('me-tpc.xmind-box-selected');
        if (!selected || !selected.length) return;
        Array.prototype.forEach.call(selected, function(node) {
          if (!node || !node.classList) return;
          node.classList.remove('xmind-box-selected');
        });
      }

      function getBoxSelectedNodes() {
        if (!viewerEl || !viewerEl.querySelectorAll) return [];
        var selected = viewerEl.querySelectorAll('me-tpc.xmind-box-selected');
        var out = [];
        Array.prototype.forEach.call(selected, function(node) {
          if (!node || !node.tagName || String(node.tagName).toLowerCase() !== 'me-tpc') return;
          out.push(node);
        });
        return out;
      }

      function collectNodeIds(nodes) {
        return (Array.isArray(nodes) ? nodes : []).map(function(node) {
          if (!node || !node.nodeObj || node.nodeObj.id === undefined || node.nodeObj.id === null) return '';
          return String(node.nodeObj.id);
        }).filter(Boolean);
      }

      function setCustomSelectionNodes(nodes) {
        customSelectionNodes = Array.isArray(nodes) ? nodes.filter(function(node) {
          return Boolean(node && node.tagName && String(node.tagName).toLowerCase() === 'me-tpc');
        }) : [];
      }

      function findViewerNodesByIds(nodeIds) {
        var ids = Array.isArray(nodeIds) ? nodeIds : [];
        var map = Object.create(null);
        var out = [];
        ids.forEach(function(id) {
          var key = String(id || '');
          if (!key || map[key]) return;
          map[key] = true;
          var node = findViewerNodeById(key);
          if (node) out.push(node);
        });
        return out;
      }

      function findViewerNodeBySelectionGroup(groupKey) {
        var key = groupKey === null || groupKey === undefined ? '' : String(groupKey);
        if (!key || !viewerEl || !viewerEl.querySelectorAll) return null;
        var nodes = viewerEl.querySelectorAll('me-tpc[data-xmind-select-group]');
        var fallback = null;
        for (var i = 0; i < nodes.length; i += 1) {
          var node = nodes[i];
          if (!node || !node.getAttribute) continue;
          if (String(node.getAttribute('data-xmind-select-group') || '') !== key) continue;
          if (!fallback) fallback = node;
          if (node.getAttribute('data-xmind-select-preferred') === '1') return node;
        }
        return fallback;
      }

      function resolveSelectionAnchorNode(node) {
        if (!node || !node.tagName || String(node.tagName).toLowerCase() !== 'me-tpc') return null;
        var selectionGroupKey = node.getAttribute ? String(node.getAttribute('data-xmind-select-group') || '') : '';
        if (!selectionGroupKey) return node;
        return findViewerNodeBySelectionGroup(selectionGroupKey) || node;
      }

      function shouldPreserveActualSelectionNode(options) {
        return editing === true || Boolean(options && options.preserveActualNodes === true);
      }

      function resolveSelectionNode(node, options) {
        if (!node || !node.tagName || String(node.tagName).toLowerCase() !== 'me-tpc') return null;
        if (shouldPreserveActualSelectionNode(options)) return node;
        return resolveSelectionAnchorNode(node) || node;
      }

      function getSelectionIdentityKey(node, options) {
        if (!node || !node.tagName || String(node.tagName).toLowerCase() !== 'me-tpc') return '';
        var useSelectionGroup = !shouldPreserveActualSelectionNode(options);
        var key = useSelectionGroup && node.getAttribute && node.getAttribute('data-xmind-select-group')
          ? String(node.getAttribute('data-xmind-select-group'))
          : '';
        if (!key) {
          key = node.getAttribute && node.getAttribute('data-nodeid')
            ? String(node.getAttribute('data-nodeid'))
            : '';
        }
        if (!key) {
          var nodeId = node.nodeObj && node.nodeObj.id ? String(node.nodeObj.id) : '';
          var locatePath = collectNodeLocatePath(node).join('>');
          if (nodeId || locatePath) key = nodeId + '::' + locatePath;
        }
        return key;
      }

      function resetModifierSelectionPointerGuard() {
        modifierSelectionPointerGuard.until = 0;
        modifierSelectionPointerGuard.nodeKey = '';
      }

      function resetEditNodePointerSelection() {
        editNodePointerSelection.active = false;
        editNodePointerSelection.nodeId = '';
        editNodePointerSelection.startX = 0;
        editNodePointerSelection.startY = 0;
      }

      function markModifierSelectionPointerGuard(node) {
        var anchorNode = resolveSelectionNode(node) || node;
        var key = getSelectionIdentityKey(anchorNode);
        if (!key) {
          resetModifierSelectionPointerGuard();
          return;
        }
        modifierSelectionPointerGuard.until = Date.now() + 320;
        modifierSelectionPointerGuard.nodeKey = key;
      }

      function shouldSkipModifierSelectionMouseEvent(e, node) {
        if (!e || e.type !== 'mousedown') return false;
        if (!modifierSelectionPointerGuard.nodeKey) return false;
        if (Date.now() > Number(modifierSelectionPointerGuard.until || 0)) {
          resetModifierSelectionPointerGuard();
          return false;
        }
        var anchorNode = resolveSelectionNode(node) || node;
        var key = getSelectionIdentityKey(anchorNode);
        if (!key || key !== modifierSelectionPointerGuard.nodeKey) return false;
        resetModifierSelectionPointerGuard();
        return true;
      }

      function normalizeSelectionNodeList(nodes, options) {
        var list = Array.isArray(nodes) ? nodes : [];
        var out = [];
        var seen = Object.create(null);
        list.forEach(function(node) {
          var anchorNode = resolveSelectionNode(node, options) || node;
          if (!anchorNode || !anchorNode.tagName || String(anchorNode.tagName).toLowerCase() !== 'me-tpc') return;
          var key = getSelectionIdentityKey(anchorNode, options);
          if (!key) {
            key = String(out.length + 1);
          }
          if (seen[key]) return;
          seen[key] = true;
          out.push(anchorNode);
        });
        return out;
      }

      function syncMindSelectionWithNodes(nodes) {
        var inst = getInstance();
        if (!inst) return;
        var selected = Array.isArray(nodes) ? nodes.filter(function(node) {
          return Boolean(node && node.tagName && String(node.tagName).toLowerCase() === 'me-tpc');
        }) : [];
        try {
          if (typeof inst.clearSelection === 'function') inst.clearSelection();
        } catch (err) {
          // ignore
        }
        if (!selected.length) return;
        if (typeof inst.selectNodes === 'function') {
          try {
            inst.selectNodes(selected);
            return;
          } catch (err2) {
            // ignore
          }
        }
        if (selected.length === 1 && typeof inst.selectNode === 'function') {
          try {
            inst.selectNode(selected[0]);
          } catch (err3) {
            // ignore
          }
        }
      }

      function applyCustomSelectionNodes(nodes) {
        var selected = normalizeSelectionNodeList((Array.isArray(nodes) ? nodes : []).filter(function(node) {
          return Boolean(node && node.tagName && String(node.tagName).toLowerCase() === 'me-tpc');
        }));
        setCustomSelectionNodes(selected);
        clearBoxSelectionClasses();
        syncMindSelectionWithNodes(selected);
        var displayNodes = [];
        selected.forEach(function(node) {
          if (!node) return;
          var liveNode = node;
          var selectionGroupKey = node.getAttribute ? String(node.getAttribute('data-xmind-select-group') || '') : '';
          if (selectionGroupKey) {
            liveNode = findViewerNodeBySelectionGroup(selectionGroupKey) || liveNode;
          } else if (node.nodeObj && node.nodeObj.id) {
            liveNode = findViewerNodeById(String(node.nodeObj.id)) || liveNode;
          }
          if (!liveNode || displayNodes.indexOf(liveNode) !== -1) return;
          displayNodes.push(liveNode);
        });
        if (!displayNodes.length) displayNodes = selected;
        displayNodes.forEach(function(node) {
          if (!node || !node.classList) return;
          node.classList.add('xmind-box-selected');
        });
      }

      function resolveBoxSelectableNode(node) {
        var current = node || null;
        while (current) {
          if (current.tagName && String(current.tagName).toLowerCase() === 'me-tpc') {
            var key = current.getAttribute ? String(current.getAttribute('data-xmind-select-group') || '') : '';
            if (key) {
              return {
                node: current,
                key: key,
                preferred: current.getAttribute && current.getAttribute('data-xmind-select-preferred') === '1',
              };
            }
          }
          if (!current.parentElement || current.parentElement === viewerEl) break;
          current = current.parentElement.closest ? current.parentElement.closest('me-tpc') : null;
        }
        return null;
      }

      function updateBoxSelection(currentX, currentY) {
        if (!viewerEl) return;
        var left = boxStartX < currentX ? boxStartX : currentX;
        var right = boxStartX > currentX ? boxStartX : currentX;
        var top = boxStartY < currentY ? boxStartY : currentY;
        var bottom = boxStartY > currentY ? boxStartY : currentY;

        if (boxRectEl) {
          var viewerRect = viewerEl.getBoundingClientRect();
          var drawLeft = left - viewerRect.left;
          var drawTop = top - viewerRect.top;
          var drawRight = right - viewerRect.left;
          var drawBottom = bottom - viewerRect.top;
          if (drawLeft < 0) drawLeft = 0;
          if (drawTop < 0) drawTop = 0;
          if (drawRight > viewerRect.width) drawRight = viewerRect.width;
          if (drawBottom > viewerRect.height) drawBottom = viewerRect.height;
          if (drawRight < drawLeft) {
            var swapX = drawRight;
            drawRight = drawLeft;
            drawLeft = swapX;
          }
          if (drawBottom < drawTop) {
            var swapY = drawBottom;
            drawBottom = drawTop;
            drawTop = swapY;
          }
          boxRectEl.style.display = 'block';
          boxRectEl.style.left = drawLeft + 'px';
          boxRectEl.style.top = drawTop + 'px';
          boxRectEl.style.width = (drawRight - drawLeft) + 'px';
          boxRectEl.style.height = (drawBottom - drawTop) + 'px';
        }

        if (!viewerEl.querySelectorAll) return;
        var nodes = viewerEl.querySelectorAll('me-tpc');
        if (!nodes || !nodes.length) return;
        var hitMap = Object.create(null);
        var hitNodes = [];
        Array.prototype.forEach.call(nodes, function(node) {
          if (!node || !node.classList || !node.getBoundingClientRect) return;
          var rect = node.getBoundingClientRect();
          var hit = !(rect.right < left || rect.left > right || rect.bottom < top || rect.top > bottom);
          if (!hit) return;
          var resolved = resolveBoxSelectableNode(node);
          if (!resolved || !resolved.node || !resolved.key) return;
          if (!hitMap[resolved.key]) {
            hitMap[resolved.key] = resolved;
            hitNodes.push(resolved.node);
            return;
          }
          if (resolved.preferred && !hitMap[resolved.key].preferred) {
            var index = hitNodes.indexOf(hitMap[resolved.key].node);
            hitMap[resolved.key] = resolved;
            if (index >= 0) hitNodes[index] = resolved.node;
          }
        });
        clearBoxSelectionClasses();
        hitNodes.forEach(function(node) {
          if (!node || !node.classList) return;
          node.classList.add('xmind-box-selected');
        });
      }

      function collectSelectedNodes(options) {
        var selectionOptions = options || {};
        var inst = getInstance();
        var out = [];
        var seen = Object.create(null);

        function pushNode(node) {
          var anchorNode = resolveSelectionNode(node, selectionOptions) || node;
          if (!anchorNode || !anchorNode.tagName || String(anchorNode.tagName).toLowerCase() !== 'me-tpc') return;
          var key = getSelectionIdentityKey(anchorNode, selectionOptions);
          if (!key) return;
          if (seen[key]) return;
          seen[key] = true;
          out.push(anchorNode);
        }

        var useCustomSelectionOnly = enableCustomBoxSelection && !editing && customSelectionNodes.length > 0;
        var current = inst && Array.isArray(inst.currentNodes) ? inst.currentNodes : [];
        if (!useCustomSelectionOnly) {
          current.forEach(pushNode);
        }

        customSelectionNodes.forEach(function(node) {
          if (!node) return;
          var liveNode = node;
          var hasViewerContains = viewerEl && typeof viewerEl.contains === 'function';
          if (
            (!liveNode.isConnected || (hasViewerContains && !viewerEl.contains(liveNode)))
          ) {
            var selectionGroupKey = liveNode.getAttribute ? String(liveNode.getAttribute('data-xmind-select-group') || '') : '';
            if (!shouldPreserveActualSelectionNode(selectionOptions) && selectionGroupKey) {
              liveNode = findViewerNodeBySelectionGroup(selectionGroupKey) || liveNode;
            } else if (liveNode.nodeObj && liveNode.nodeObj.id) {
              liveNode = findViewerNodeById(String(liveNode.nodeObj.id)) || liveNode;
            }
          }
          pushNode(liveNode);
        });

        if (viewerEl && viewerEl.querySelectorAll) {
          var nativeSelected = viewerEl.querySelectorAll('.selected');
          Array.prototype.forEach.call(nativeSelected, function(node) {
            var hostNode = node && node.closest ? node.closest('me-tpc') : null;
            pushNode(hostNode);
          });
          var boxed = viewerEl.querySelectorAll('me-tpc.xmind-box-selected');
          Array.prototype.forEach.call(boxed, pushNode);
        }
        return out;
      }

      function applyNodeDecorations() {
        if (!viewerEl || !viewerEl.querySelectorAll) return;
        if (nodeDecorationApplying) return;
        var nodes = viewerEl.querySelectorAll('me-tpc');
        if (!nodes || !nodes.length) return;
        nodeDecorationApplying = true;
        if (nodeDecorateObserver && typeof nodeDecorateObserver.disconnect === 'function') {
          nodeDecorateObserver.disconnect();
        }
        try {
          Array.prototype.forEach.call(nodes, function(nodeEl) {
            if (!nodeEl || !nodeEl.nodeObj) return;
            var nodeMeta = buildNodeMeta(nodeEl);
            if (!nodeMeta) return;
            if (opts && typeof opts.decorateNodeElement === 'function') {
              try {
                opts.decorateNodeElement(nodeEl, nodeMeta);
              } catch (err) {
                // ignore
              }
            }
            applyDefaultSelectionGroup(nodeEl, nodeMeta);
          });
        } finally {
          nodeDecorationApplying = false;
          observeNodeDecorationMutations();
        }
      }

      function scheduleNodeDecorations() {
        if (nodeDecorateTimer) clearTimeout(nodeDecorateTimer);
        nodeDecorateTimer = setTimeout(function() {
          nodeDecorateTimer = 0;
          applyNodeDecorations();
        }, 0);
      }

      function syncMindSelectionFromBox() {
        applyCustomSelectionNodes(getBoxSelectedNodes());
      }

      function scheduleCommitBoxSelection(nodes) {
        var selected = normalizeSelectionNodeList(Array.isArray(nodes) ? nodes : []);
        clearBoxSelectionCommitTimer();
        if (!selected.length) return;
        boxSelectionCommitTimer = setTimeout(function() {
          boxSelectionCommitTimer = 0;
          if (!enableCustomBoxSelection || editing || pendingSave) return;
          applyCustomSelectionNodes(selected);
          updateEditButtons();
        }, 0);
      }

      function toggleNodeInCustomSelection(nodeEl) {
        if (!enableCustomBoxSelection || !nodeEl) return [];
        var targetNode = resolveSelectionNode(nodeEl) || nodeEl;
        var targetKey = getSelectionIdentityKey(targetNode);
        if (!targetKey) return [];
        var current = collectSelectedNodes();
        var next = [];
        var exists = false;
        current.forEach(function(node) {
          if (!node) return;
          if (getSelectionIdentityKey(node) === targetKey) {
            exists = true;
            return;
          }
          next.push(node);
        });
        if (!exists) next.push(targetNode);
        if (editing) {
          setCustomSelectionNodes([]);
          clearBoxSelectionClasses();
          syncMindSelectionWithNodes(next);
        } else {
          applyCustomSelectionNodes(next);
        }
        return next;
      }

      function clearCustomSelection(syncMindSelection) {
        clearBoxSelectionCommitTimer();
        setCustomSelectionNodes([]);
        clearBoxSelectionClasses();
        if (syncMindSelection === true) {
          syncMindSelectionWithNodes([]);
        }
      }

      function resetCustomSelectionInteractionState(syncMindSelection) {
        boxPending = false;
        boxSelecting = false;
        boxMoved = false;
        boxSuppressClickUntil = 0;
        modifierSelectionSuppressClickUntil = 0;
        clearClickNodeEditTimer();
        clearCustomSelection(syncMindSelection === true);
        if (viewerEl && viewerEl.classList) viewerEl.classList.remove('is-box-selecting');
        if (boxRectEl && boxRectEl.style) {
          boxRectEl.style.display = 'none';
          boxRectEl.style.width = '0px';
          boxRectEl.style.height = '0px';
        }
      }

      function isEventInsideMindControls(target) {
        if (!target) return false;
        if (controlsEl && controlsEl.contains && controlsEl.contains(target)) return true;
        if (target.closest && target.closest('[data-mind-controls]')) return true;
        return false;
      }

      function isEventInsideMindCanvas(target) {
        if (!target) return false;
        if (canvasEl && canvasEl.contains && canvasEl.contains(target)) return true;
        if (target.closest && target.closest('[data-mind-canvas]')) return true;
        return false;
      }

      function isMindNodeExpanderTarget(target) {
        return Boolean(target && target.closest && target.closest('me-epd'));
      }

      function ensureNodeContextMenuEl() {
        if (nodeContextMenuEl && nodeContextMenuEl.parentNode) return nodeContextMenuEl;
        if (typeof document === 'undefined' || !document.createElement) return null;
        if (!document.body || !document.body.appendChild) return null;
        var el = document.createElement('div');
        el.className = 'xmind-node-context-menu';
        el.setAttribute('aria-hidden', 'true');
        el.addEventListener('mousedown', onNodeContextMenuMouseDown, true);
        el.addEventListener('click', onNodeContextMenuClick);
        document.body.appendChild(el);
        nodeContextMenuEl = el;
        return nodeContextMenuEl;
      }

      function isNodeWithinViewerSelection(selectionNode) {
        if (!selectionNode) return false;
        var current = selectionNode.nodeType === 1 ? selectionNode : selectionNode.parentNode;
        while (current) {
          if (current === viewerEl) return true;
          current = current.parentNode;
        }
        return false;
      }

      function clearViewerNativeTextSelection() {
        if (typeof window === 'undefined' || !window || typeof window.getSelection !== 'function') return false;
        var selection = null;
        try {
          selection = window.getSelection();
        } catch (err) {
          selection = null;
        }
        if (!selection || selection.rangeCount <= 0 || selection.isCollapsed) return false;
        var anchorNode = selection.anchorNode || null;
        var focusNode = selection.focusNode || null;
        if (!isNodeWithinViewerSelection(anchorNode) && !isNodeWithinViewerSelection(focusNode)) return false;
        try {
          selection.removeAllRanges();
          return true;
        } catch (err2) {
          return false;
        }
      }

      function hideNodeContextMenu(options) {
        var preserveNativeSelection = Boolean(options && options.preserveNativeSelection === true);
        if (!preserveNativeSelection) clearViewerNativeTextSelection();
        nodeContextMenuMeta = null;
        forceHideAllNodeContextMenus();
        if (!nodeContextMenuEl || !nodeContextMenuEl.classList) return;
        nodeContextMenuEl.classList.remove('is-open');
        nodeContextMenuEl.setAttribute('aria-hidden', 'true');
      }
      activeContextMenuHider = hideNodeContextMenu;

      function showNodeContextMenu(clientX, clientY, payload) {
        var menu = ensureNodeContextMenuEl();
        if (!menu || !menu.style) return;
        clearViewerNativeTextSelection();
        var items = payload && Array.isArray(payload.items) ? payload.items : [];
        if (!items.length) {
          hideNodeContextMenu();
          return;
        }
        nodeContextMenuMeta = payload && payload.meta ? payload.meta : null;
        menu.innerHTML = items.map(function(item) {
          var disabledAttr = item && item.disabled ? ' disabled' : '';
          var label = item && item.label ? String(item.label) : '';
          var actionId = item && item.id ? String(item.id) : '';
          return '<button type="button" class="xmind-node-context-menu-btn" data-mind-node-menu="' + actionId + '"' + disabledAttr + '>' + label + '</button>';
        }).join('');
        menu.style.left = '0px';
        menu.style.top = '0px';
        menu.classList.add('is-open');
        menu.setAttribute('aria-hidden', 'false');
        var menuRect = menu.getBoundingClientRect ? menu.getBoundingClientRect() : null;
        var width = menuRect && menuRect.width ? menuRect.width : 120;
        var height = menuRect && menuRect.height ? menuRect.height : 40;
        var viewportWidth = typeof window !== 'undefined' && window ? (window.innerWidth || 0) : 0;
        var viewportHeight = typeof window !== 'undefined' && window ? (window.innerHeight || 0) : 0;
        var left = Number(clientX);
        var top = Number(clientY);
        if (!isFinite(left)) left = 0;
        if (!isFinite(top)) top = 0;
        if (viewportWidth > 0 && left + width > viewportWidth - 4) left = viewportWidth - width - 4;
        if (viewportHeight > 0 && top + height > viewportHeight - 4) top = viewportHeight - height - 4;
        if (left < 4) left = 4;
        if (top < 4) top = 4;
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
      }

      function isNodeContextMenuOpen() {
        if (!nodeContextMenuEl || !nodeContextMenuEl.classList) return false;
        return nodeContextMenuEl.classList.contains('is-open');
      }

      function isNodeCurrentlySelected(nodeEl) {
        if (!nodeEl) return false;
        var selected = collectSelectedNodes();
        if (!selected || !selected.length) return false;
        for (var i = 0; i < selected.length; i += 1) {
          if (selected[i] === nodeEl) return true;
        }
        return false;
      }

      function selectSingleNodeForContextMenu(nodeEl, preserveExistingSelection) {
        if (!nodeEl) return;
        nodeEl = resolveSelectionNode(nodeEl) || nodeEl;
        if (preserveExistingSelection === true && isNodeCurrentlySelected(nodeEl)) {
          focusViewerForKeyboard();
          return;
        }
        var selected = collectSelectedNodes();
        if (selected.length === 1 && selected[0] === nodeEl) {
          focusViewerForKeyboard();
          return;
        }
        var inst = getInstance();
        if (enableCustomBoxSelection) {
          clearCustomSelection(false);
        }
        if (inst && typeof inst.clearSelection === 'function') {
          try {
            inst.clearSelection();
          } catch (err0) {
            // ignore
          }
        }
        if (inst && typeof inst.selectNode === 'function') {
          try {
            inst.selectNode(nodeEl);
            focusViewerForKeyboard();
            return;
          } catch (err1) {
            // ignore
          }
        }
        if (inst && typeof inst.selectNodes === 'function') {
          try {
            inst.selectNodes([nodeEl]);
            focusViewerForKeyboard();
          } catch (err2) {
            // ignore
          }
        }
      }

      function selectActualNodeForEditing(nodeEl) {
        if (!editing || pendingSave || !nodeEl || !nodeEl.nodeObj) return false;
        var nodeId = nodeEl.nodeObj.id === null || nodeEl.nodeObj.id === undefined
          ? ''
          : String(nodeEl.nodeObj.id);

        clearCustomSelection(false);
        setCustomSelectionNodes([nodeEl]);
        clearBoxSelectionClasses();
        if (nodeEl.classList) nodeEl.classList.add('xmind-box-selected');
        syncMindSelectionWithNodes([nodeEl]);
        focusViewerForKeyboard();
        updateEditButtons();

        setTimeout(function() {
          if (!editing || pendingSave) return;
          var liveNode = nodeId ? findViewerNodeById(nodeId) : nodeEl;
          if (!liveNode || !liveNode.nodeObj) return;
          setCustomSelectionNodes([liveNode]);
          clearBoxSelectionClasses();
          if (liveNode.classList) liveNode.classList.add('xmind-box-selected');
          syncMindSelectionWithNodes([liveNode]);
          updateEditButtons();
        }, 0);
        return true;
      }

      function shouldUsePlainEditNodePointer(e) {
        if (!editing || pendingSave || !e) return false;
        if (e.button !== undefined && e.button !== 0) return false;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || isCtrlModifierActive(e)) return false;
        if (isEventInsideMindControls(e.target)) return false;
        if (isMindNodeExpanderTarget(e.target)) return false;
        return true;
      }

      function beginEditNodePointerSelection(e) {
        resetEditNodePointerSelection();
        if (!shouldUsePlainEditNodePointer(e)) return;
        var nodeEl = resolveViewerEventNode(e);
        editNodePointerSelection.active = true;
        editNodePointerSelection.nodeId = nodeEl && nodeEl.nodeObj && nodeEl.nodeObj.id !== null && nodeEl.nodeObj.id !== undefined
          ? String(nodeEl.nodeObj.id)
          : '';
        editNodePointerSelection.startX = typeof e.clientX === 'number' ? e.clientX : 0;
        editNodePointerSelection.startY = typeof e.clientY === 'number' ? e.clientY : 0;
      }

      function finishEditNodePointerSelection(e) {
        if (!editNodePointerSelection.active) return;
        var nodeId = editNodePointerSelection.nodeId;
        var startX = editNodePointerSelection.startX;
        var startY = editNodePointerSelection.startY;
        resetEditNodePointerSelection();
        if (!shouldUsePlainEditNodePointer(e)) return;
        var endX = typeof e.clientX === 'number' ? e.clientX : startX;
        var endY = typeof e.clientY === 'number' ? e.clientY : startY;
        if (Math.abs(endX - startX) > 6 || Math.abs(endY - startY) > 6) {
          editNodePointerSuppressCanvasClearUntil = Date.now() + 360;
          return;
        }
        setTimeout(function() {
          if (!editing || pendingSave) return;
          var liveNode = nodeId ? findViewerNodeById(nodeId) : resolveViewerEventNode(e);
          if (!liveNode || !liveNode.nodeObj) return;
          scheduleBeginEditSelectionMode('point', {
            x: endX,
            y: endY,
          });
          selectActualNodeForEditing(liveNode);
        }, 0);
      }

      function resolveContextMenuTargetNode(target) {
        var nodeEl = target && target.closest ? target.closest('me-tpc') : null;
        if (nodeEl) {
          nodeEl = resolveSelectionNode(nodeEl) || nodeEl;
          selectSingleNodeForContextMenu(nodeEl, true);
          return nodeEl;
        }
        var selectedNodes = collectSelectedNodes();
        if (selectedNodes && selectedNodes.length === 1) return selectedNodes[0];
        return null;
      }

      function resolveContextMenuPayload(nodeEl) {
        var nodeMeta = ensureActionContext(buildNodeMeta(nodeEl));
        if (!nodeMeta) return null;
        var customActions = getNodeActionsForMeta(nodeMeta);
        if (customActions.length) {
          return {
            meta: nodeMeta,
            items: customActions,
          };
        }
        if (!allowEdit || !editing || pendingSave) return null;
        var selected = collectSelectedNodes();
        var canAdd = selected.length === 1;
        var canDelete = selected.some(function(node) {
          return Boolean(node && node.nodeObj && node.nodeObj.parent);
        });
        var items = [];
        items.push({ id: 'node-add', label: '新增节点', disabled: !canAdd });
        if (canDelete) {
          items.push({ id: 'node-delete', label: '删除节点', disabled: !canDelete });
        }
        return items.length ? {
          meta: nodeMeta,
          items: items,
        } : null;
      }

      function onNodeContextMenuClick(e) {
        var target = e && e.target && e.target.closest
          ? e.target.closest('[data-mind-node-menu]')
          : null;
        if (!target || !target.dataset) return;
        var action = String(target.dataset.mindNodeMenu || '');
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
        if (action === 'node-add') {
          hideNodeContextMenu();
          setTimeout(function() {
            runAddNode();
          }, 0);
        } else if (action === 'node-delete') {
          hideNodeContextMenu();
          setTimeout(function() {
            runDeleteNodes();
          }, 0);
        } else if (action) {
          var meta = nodeContextMenuMeta;
          hideNodeContextMenu();
          setTimeout(function() {
            requestNodeAction(action, meta);
          }, 0);
        }
      }

      function onNodeContextMenuMouseDown(e) {
        var target = e && e.target && e.target.closest
          ? e.target.closest('[data-mind-node-menu]')
          : null;
        if (!target) return;
        clearViewerNativeTextSelection();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
      }

      function isCtrlModifierActive(e) {
        if (e && e.ctrlKey) return true;
        return ctrlModifierPressed;
      }

      function stopCtrlLeftCanvasDragEvent(e) {
        if (!e) return;
        if (e.cancelable !== false && e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
      }

      function findScrollableWheelAncestor() {
        if (!viewerEl || !viewerEl.parentElement || typeof window === 'undefined' || !window.getComputedStyle) {
          return null;
        }
        var current = viewerEl.parentElement;
        while (current && current !== document.body) {
          var style = window.getComputedStyle(current);
          var overflowY = style && style.overflowY ? String(style.overflowY) : '';
          var canScrollY = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
          if (canScrollY && current.scrollHeight > current.clientHeight + 1) {
            return current;
          }
          current = current.parentElement;
        }
        return null;
      }

      function shouldAllowAncestorWheelScroll(e) {
        if (!e || e.ctrlKey || e.metaKey) return false;
        var deltaY = Number(e.deltaY);
        if (!isFinite(deltaY) || deltaY === 0) return false;
        var scrollAncestor = findScrollableWheelAncestor();
        if (!scrollAncestor) return false;
        var maxScrollTop = Number(scrollAncestor.scrollHeight - scrollAncestor.clientHeight);
        var currentScrollTop = Number(scrollAncestor.scrollTop || 0);
        if (!isFinite(maxScrollTop) || maxScrollTop <= 1) return false;
        if (!isFinite(currentScrollTop)) currentScrollTop = 0;
        if (deltaY > 0) {
          return currentScrollTop < maxScrollTop - 1;
        }
        return currentScrollTop > 1;
      }

      function applyAncestorWheelScroll(e) {
        if (!shouldAllowAncestorWheelScroll(e)) return false;
        var scrollAncestor = findScrollableWheelAncestor();
        if (!scrollAncestor) return false;
        var deltaY = Number(e.deltaY);
        if (!isFinite(deltaY) || deltaY === 0) return false;
        var nextScrollTop = Number(scrollAncestor.scrollTop || 0) + deltaY;
        var maxScrollTop = Number(scrollAncestor.scrollHeight - scrollAncestor.clientHeight);
        if (!isFinite(nextScrollTop)) nextScrollTop = Number(scrollAncestor.scrollTop || 0);
        if (!isFinite(maxScrollTop) || maxScrollTop < 0) maxScrollTop = 0;
        if (nextScrollTop < 0) nextScrollTop = 0;
        if (nextScrollTop > maxScrollTop) nextScrollTop = maxScrollTop;
        scrollAncestor.scrollTop = nextScrollTop;
        return true;
      }

      function blockCanvasNativeGesture(e) {
        if (!e) return;
        if (isEventInsideMindControls(e.target)) return;
        var insideCanvas = isEventInsideMindCanvas(e.target);
        var insideViewer = Boolean(viewerEl && viewerEl.contains && viewerEl.contains(e.target));
        if (!insideCanvas && !insideViewer) return;
        if (e.cancelable === false) return;
        if (e.type === 'wheel') {
          if (!insideCanvas && applyAncestorWheelScroll(e)) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            else if (e.stopPropagation) e.stopPropagation();
            return;
          }
          var usedWheelAction = false;
          if (e.ctrlKey || e.metaKey) {
            usedWheelAction = zoomByWheelEvent(e);
          } else {
            usedWheelAction = panByWheelEvent(e);
          }
          if (usedWheelAction) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            else if (e.stopPropagation) e.stopPropagation();
            return;
          }
        }
        if (e.preventDefault) e.preventDefault();
      }

      function shouldSuppressRightDragContextMenu() {
        if (rightDragGestureBlock.active) return true;
        return Date.now() <= Number(rightDragGestureBlock.suppressContextUntil || 0);
      }

      function resetRightDragGestureBlock() {
        var pointerId = rightDragGestureBlock.pointerId;
        var captureTarget = rightDragGestureBlock.captureTarget;
        if (
          captureTarget &&
          pointerId !== null &&
          typeof captureTarget.releasePointerCapture === 'function'
        ) {
          try {
            var hasCapture = true;
            if (typeof captureTarget.hasPointerCapture === 'function') {
              hasCapture = captureTarget.hasPointerCapture(pointerId);
            }
            if (hasCapture) captureTarget.releasePointerCapture(pointerId);
          } catch (err) {
            // ignore
          }
        }
        rightDragGestureBlock.active = false;
        rightDragGestureBlock.pointerId = null;
        rightDragGestureBlock.captureTarget = null;
        if (viewerEl && viewerEl.classList) viewerEl.classList.remove('is-right-dragging');
      }

      function beginRightDragGestureBlock(e) {
        if (!e || e.button !== 2) return;
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (isEventInsideMindControls(e.target)) return;
        if (enableCustomBoxSelection && (isCtrlModifierActive(e) || e.metaKey)) {
          var modifierNode = resolveViewerEventNode(e);
          if (modifierNode) {
            hideNodeContextMenu();
            clearClickNodeEditTimer();
            toggleNodeInCustomSelection(modifierNode);
            focusViewerForKeyboard();
            modifierSelectionSuppressClickUntil = Date.now() + 220;
            updateEditButtons();
            if (e.preventDefault) e.preventDefault();
            return;
          }
        }

        if (rightDragGestureBlock.active) {
          rightDragGestureBlock.suppressContextUntil = Date.now() + 1800;
          if (e.preventDefault) e.preventDefault();
          return;
        }

        var pointerId = typeof e.pointerId === 'number' ? e.pointerId : null;
        rightDragGestureBlock.active = true;
        rightDragGestureBlock.pointerId = pointerId;
        rightDragGestureBlock.captureTarget = null;
        rightDragGestureBlock.suppressContextUntil = Date.now() + 1800;

        if (pointerId !== null) {
          var captureTarget = null;
          if (e.target && typeof e.target.setPointerCapture === 'function') captureTarget = e.target;
          else if (viewerEl && typeof viewerEl.setPointerCapture === 'function') captureTarget = viewerEl;
          if (captureTarget) {
            try {
              captureTarget.setPointerCapture(pointerId);
              rightDragGestureBlock.captureTarget = captureTarget;
            } catch (err) {
              // ignore
            }
          }
        }

        if (viewerEl && viewerEl.classList) viewerEl.classList.add('is-right-dragging');
        if (e.preventDefault) e.preventDefault();
      }

      function onViewerMouseDownGestureGuard(e) {
        if (!e || e.button !== 2) return;
        if (isEventInsideMindControls(e.target)) return;
        if (enableCustomBoxSelection && (isCtrlModifierActive(e) || e.metaKey)) {
          var modifierNode = resolveViewerEventNode(e);
          if (modifierNode) {
            hideNodeContextMenu();
            clearClickNodeEditTimer();
            toggleNodeInCustomSelection(modifierNode);
            focusViewerForKeyboard();
            modifierSelectionSuppressClickUntil = Date.now() + 220;
            updateEditButtons();
            if (e.preventDefault) e.preventDefault();
            return;
          }
        }
        var nodeEl = resolveContextMenuTargetNode(e.target);
        var menuPayload = nodeEl ? resolveContextMenuPayload(nodeEl) : null;
        if (menuPayload && nodeEl && isNodeCurrentlySelected(nodeEl)) {
          showNodeContextMenu(e.clientX, e.clientY, menuPayload);
          if (e.preventDefault) e.preventDefault();
          return;
        }
        if (!isEventInsideMindCanvas(e.target)) return;
        hideNodeContextMenu();
        rightDragGestureBlock.suppressContextUntil = Date.now() + 1800;
        if (!rightDragGestureBlock.active) {
          rightDragGestureBlock.active = true;
          rightDragGestureBlock.pointerId = null;
          rightDragGestureBlock.captureTarget = null;
          if (viewerEl && viewerEl.classList) viewerEl.classList.add('is-right-dragging');
        }
        if (e.preventDefault) e.preventDefault();
      }

      function moveRightDragGestureBlock(e) {
        if (!rightDragGestureBlock.active) return;
        if (!e) return;
        if (
          rightDragGestureBlock.pointerId !== null &&
          typeof e.pointerId === 'number' &&
          e.pointerId !== rightDragGestureBlock.pointerId
        ) {
          return;
        }
        if (typeof e.buttons === 'number' && (e.buttons & 2) !== 2) {
          resetRightDragGestureBlock();
          return;
        }
        rightDragGestureBlock.suppressContextUntil = Date.now() + 1800;
        if (e.preventDefault) e.preventDefault();
      }

      function endRightDragGestureBlock(e) {
        if (!rightDragGestureBlock.active) return;
        if (
          rightDragGestureBlock.pointerId !== null &&
          e &&
          typeof e.pointerId === 'number' &&
          e.pointerId !== rightDragGestureBlock.pointerId
        ) {
          return;
        }
        if (e && typeof e.buttons === 'number' && (e.buttons & 2) === 2) return;
        rightDragGestureBlock.suppressContextUntil = Date.now() + 1800;
        if (e && e.preventDefault) e.preventDefault();
        resetRightDragGestureBlock();
      }

      function onViewerContextMenu(e) {
        if (!e) return;
        if (enableCustomBoxSelection && modifierSelectionSuppressClickUntil && Date.now() <= modifierSelectionSuppressClickUntil) {
          modifierSelectionSuppressClickUntil = 0;
          hideNodeContextMenu();
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          return;
        }
        if (isEventInsideMindControls(e.target)) return;
        if (enableCustomBoxSelection && (e.ctrlKey || e.metaKey)) {
          var modifierNodeEl = resolveViewerEventNode(e);
          if (modifierNodeEl) {
            hideNodeContextMenu();
            clearClickNodeEditTimer();
            toggleNodeInCustomSelection(modifierNodeEl);
            focusViewerForKeyboard();
            modifierSelectionSuppressClickUntil = Date.now() + 220;
            updateEditButtons();
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            return;
          }
        }
        var nodeEl = resolveContextMenuTargetNode(e.target);
        var menuPayload = nodeEl ? resolveContextMenuPayload(nodeEl) : null;
        if (menuPayload && nodeEl && isNodeCurrentlySelected(nodeEl)) {
          focusViewerForKeyboard();
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          showNodeContextMenu(e.clientX, e.clientY, menuPayload);
          return;
        }
        if (isEventInsideMindCanvas(e.target)) {
          hideNodeContextMenu();
          if (e.preventDefault) e.preventDefault();
          return;
        }
        if (shouldSuppressRightDragContextMenu() && e.preventDefault) e.preventDefault();
      }

      function onWindowContextMenu(e) {
        if (!e) return;
        if (enableCustomBoxSelection && modifierSelectionSuppressClickUntil && Date.now() <= modifierSelectionSuppressClickUntil) {
          modifierSelectionSuppressClickUntil = 0;
          hideNodeContextMenu();
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          return;
        }
        if (isEventInsideMindControls(e.target)) return;
        if (isEventInsideMindCanvas(e.target)) {
          if (isNodeContextMenuOpen()) {
            if (e.preventDefault) e.preventDefault();
            return;
          }
          if (!(editing && e.target && e.target.closest && e.target.closest('me-tpc'))) {
            hideNodeContextMenu();
          }
          if (e.preventDefault) e.preventDefault();
          return;
        }
        hideNodeContextMenu();
        if (!shouldSuppressRightDragContextMenu()) return;
        if (e.preventDefault) e.preventDefault();
      }

      function onWindowDragStartWhenRightDragging(e) {
        if (!rightDragGestureBlock.active) return;
        if (e && e.preventDefault) e.preventDefault();
      }

      function onWindowSelectStartWhenRightDragging(e) {
        if (!rightDragGestureBlock.active) return;
        if (e && e.preventDefault) e.preventDefault();
      }

      function isCtrlLeftCanvasDragEvent(e) {
        if (!e || e.button !== 0) return false;
        if (e.pointerType && e.pointerType !== 'mouse') return false;
        if (!isCtrlModifierActive(e)) return false;
        if (isEventInsideMindControls(e.target)) return false;
        if (isMindNodeExpanderTarget(e.target)) return false;
        if (enableCustomBoxSelection && e.target && e.target.closest && e.target.closest('me-tpc')) return false;
        if (!isEventInsideMindCanvas(e.target)) return false;
        return true;
      }

      function resetCtrlLeftCanvasDrag() {
        ctrlModifierPressed = false;
        if (!ctrlLeftCanvasDrag.active) return;
        ctrlLeftCanvasDrag.active = false;
        ctrlLeftCanvasDrag.pointerId = null;
        ctrlLeftCanvasDrag.lastX = 0;
        ctrlLeftCanvasDrag.lastY = 0;
        if (viewerEl && viewerEl.classList) viewerEl.classList.remove('is-ctrl-left-dragging');
        updateViewerDragState(viewerEl, getInstance(), false);
      }

      function beginCtrlLeftCanvasDrag(e) {
        if (!isCtrlLeftCanvasDragEvent(e)) return;
        stopCtrlLeftCanvasDragEvent(e);
        ctrlModifierPressed = true;
        if (ctrlLeftCanvasDrag.active) return;
        var inst = getInstance();
        if (!inst || typeof inst.move !== 'function') return;
        ctrlLeftCanvasDrag.active = true;
        ctrlLeftCanvasDrag.pointerId = typeof e.pointerId === 'number' ? e.pointerId : null;
        ctrlLeftCanvasDrag.lastX = typeof e.clientX === 'number' ? e.clientX : 0;
        ctrlLeftCanvasDrag.lastY = typeof e.clientY === 'number' ? e.clientY : 0;
        if (viewerEl && viewerEl.classList) viewerEl.classList.add('is-ctrl-left-dragging');
        clearCustomPointerDragState();
        resetDragGhostPreview();
        updateViewerDragState(viewerEl, inst, true);
      }

      function beginModifierNodeSelection(e) {
        if (!enableCustomBoxSelection || pendingSave) return false;
        if (!e || e.button !== 0) return false;
        if (!(isCtrlModifierActive(e) || e.metaKey)) return false;
        if (isEventInsideMindControls(e.target)) return false;
        if (isMindNodeExpanderTarget(e.target)) return false;
        var nodeEl = resolveViewerEventNode(e);
        if (!nodeEl) return false;
        if (shouldSkipModifierSelectionMouseEvent(e, nodeEl)) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          else if (e.stopPropagation) e.stopPropagation();
          return true;
        }
        hideNodeContextMenu();
        clearClickNodeEditTimer();
        toggleNodeInCustomSelection(nodeEl);
        if (e.type === 'pointerdown') markModifierSelectionPointerGuard(nodeEl);
        else resetModifierSelectionPointerGuard();
        focusViewerForKeyboard();
        modifierSelectionSuppressClickUntil = Date.now() + 220;
        updateEditButtons();
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
        return true;
      }

      function moveCtrlLeftCanvasDrag(e) {
        if (!ctrlLeftCanvasDrag.active) return;
        if (!e) return;
        if (
          ctrlLeftCanvasDrag.pointerId !== null &&
          typeof e.pointerId === 'number' &&
          e.pointerId !== ctrlLeftCanvasDrag.pointerId
        ) {
          return;
        }
        if (typeof e.buttons === 'number' && (e.buttons & 1) !== 1) {
          resetCtrlLeftCanvasDrag();
          return;
        }
        if (!isCtrlModifierActive(e)) {
          resetCtrlLeftCanvasDrag();
          return;
        }
        if (typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return;
        var inst = getInstance();
        if (!inst || typeof inst.move !== 'function') {
          resetCtrlLeftCanvasDrag();
          return;
        }
        var deltaX = e.clientX - ctrlLeftCanvasDrag.lastX;
        var deltaY = e.clientY - ctrlLeftCanvasDrag.lastY;
        ctrlLeftCanvasDrag.lastX = e.clientX;
        ctrlLeftCanvasDrag.lastY = e.clientY;
        if (deltaX !== 0 || deltaY !== 0) {
          markViewportInteraction();
          queueViewportPan(deltaX, deltaY, 'pan-drag', true);
        }
        stopCtrlLeftCanvasDragEvent(e);
      }

      function endCtrlLeftCanvasDrag(e) {
        if (!ctrlLeftCanvasDrag.active) return;
        if (
          ctrlLeftCanvasDrag.pointerId !== null &&
          e &&
          typeof e.pointerId === 'number' &&
          e.pointerId !== ctrlLeftCanvasDrag.pointerId
        ) {
          return;
        }
        if (e && typeof e.buttons === 'number' && (e.buttons & 1) === 1 && isCtrlModifierActive(e)) return;
        resetCtrlLeftCanvasDrag();
      }

      function onWindowKeydownForCtrlLeftCanvasDrag(e) {
        if (!e) return;
        if (e.ctrlKey || String(e.key || '') === 'Control') {
          ctrlModifierPressed = true;
        }
      }

      function onWindowKeyupForCtrlLeftCanvasDrag(e) {
        var key = e && e.key ? String(e.key) : '';
        if (key === 'Control') {
          ctrlModifierPressed = false;
          resetModifierSelectionPointerGuard();
        }
        if (ctrlLeftCanvasDrag.active && key === 'Control') {
          resetCtrlLeftCanvasDrag();
        }
      }

      function onWindowPointerDownForCtrlLeftCanvasDrag(e) {
        var menuTarget = e && e.target && e.target.closest
          ? e.target.closest('.xmind-node-context-menu')
          : null;
        if (!menuTarget) hideNodeContextMenu();
        beginCtrlLeftCanvasDrag(e);
      }

      function onWindowMouseDownForCtrlLeftCanvasDrag(e) {
        beginCtrlLeftCanvasDrag(e);
      }

      function startBoxSelection(e) {
        if (!enableCustomBoxSelection) return;
        if (editing || pendingSave) return;
        if (!e || e.button !== 0) return;
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (boxPending || boxSelecting) return;
        if (isCtrlModifierActive(e) || e.metaKey) return;
        if (isEventInsideMindControls(e.target)) return;
        if (isMindNodeExpanderTarget(e.target)) return;
        hideNodeContextMenu();
        clearClickNodeEditTimer();
        focusViewerForKeyboard();
        boxPending = true;
        boxSelecting = false;
        boxMoved = false;
        boxStartX = e.clientX;
        boxStartY = e.clientY;
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
      }

      function moveBoxSelection(e) {
        if (!enableCustomBoxSelection) return;
        if (editing || pendingSave) {
          stopBoxSelection(e);
          return;
        }
        if (!boxPending && !boxSelecting) return;
        var deltaX = Math.abs(e.clientX - boxStartX);
        var deltaY = Math.abs(e.clientY - boxStartY);
        if (!boxSelecting) {
          if (deltaX < boxMinDragDistance && deltaY < boxMinDragDistance) return;
          boxSelecting = true;
          boxMoved = true;
          ensureBoxRectEl();
          clearBoxSelectionClasses();
          if (viewerEl && viewerEl.classList) viewerEl.classList.add('is-box-selecting');
        }

        updateBoxSelection(e.clientX, e.clientY);
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
      }

      function stopBoxSelection(e) {
        if (!enableCustomBoxSelection) return;
        if (!boxPending && !boxSelecting) return;
        if (editing || pendingSave) {
          boxPending = false;
          boxSelecting = false;
          boxMoved = false;
          if (viewerEl && viewerEl.classList) viewerEl.classList.remove('is-box-selecting');
          if (boxRectEl && boxRectEl.style) {
            boxRectEl.style.display = 'none';
            boxRectEl.style.width = '0px';
            boxRectEl.style.height = '0px';
          }
          return;
        }
        var endX = e && typeof e.clientX === 'number' ? e.clientX : boxStartX;
        var endY = e && typeof e.clientY === 'number' ? e.clientY : boxStartY;
        if (!boxSelecting) {
          var pendingDeltaX = Math.abs(endX - boxStartX);
          var pendingDeltaY = Math.abs(endY - boxStartY);
          if (pendingDeltaX >= boxMinDragDistance || pendingDeltaY >= boxMinDragDistance) {
            boxSelecting = true;
            boxMoved = true;
            ensureBoxRectEl();
            clearBoxSelectionClasses();
            if (viewerEl && viewerEl.classList) viewerEl.classList.add('is-box-selecting');
            updateBoxSelection(endX, endY);
          }
        }
        boxPending = false;
        if (!boxSelecting) return;
        boxSelecting = false;
        if (viewerEl && viewerEl.classList) viewerEl.classList.remove('is-box-selecting');
        if (boxRectEl) {
          boxRectEl.style.display = 'none';
        }
        if (!boxMoved) {
          clearBoxSelectionClasses();
          return;
        }
        var boxedNodes = normalizeSelectionNodeList(getBoxSelectedNodes());
        syncMindSelectionFromBox();
        scheduleCommitBoxSelection(boxedNodes);
        boxSuppressClickUntil = Date.now() + 360;
        updateEditButtons();
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e && e.stopPropagation) e.stopPropagation();
      }

      function setButtonVisible(button, visible) {
        if (!button || !button.classList) return;
        if (visible) button.classList.remove('hidden');
        else button.classList.add('hidden');
      }

      function setButtonDisabled(button, disabled) {
        if (!button) return;
        button.disabled = Boolean(disabled);
      }

      function updateEditButtons() {
        var selected = collectSelectedNodes();
        var canAdd = editing && selected.length === 1 && !pendingSave;
        var canDelete = editing && selected.some(function(node) {
          return Boolean(node && node.nodeObj && node.nodeObj.parent);
        }) && !pendingSave;
        var canUndo = editing && historyIndex > 0 && !pendingSave;
        var canRedo = editing && historyEntries.length > 0 && historyIndex >= 0 && historyIndex < historyEntries.length - 1 && !pendingSave;

        setButtonVisible(editEnterBtn, !editing);
        setButtonVisible(editCancelBtn, editing);
        setButtonVisible(editSaveBtn, editing);
        setButtonVisible(editAddBtn, editing);
        setButtonVisible(editDeleteBtn, editing);
        setButtonVisible(editUndoBtn, editing);
        setButtonVisible(editRedoBtn, editing);

        setButtonDisabled(editAddBtn, !canAdd);
        setButtonDisabled(editDeleteBtn, !canDelete);
        setButtonDisabled(editUndoBtn, !canUndo);
        setButtonDisabled(editRedoBtn, !canRedo);
        setButtonDisabled(editSaveBtn, pendingSave);
        setButtonDisabled(editCancelBtn, pendingSave);

        if (viewerEl && viewerEl.classList) {
          if (editing) viewerEl.classList.add('is-editing');
          else viewerEl.classList.remove('is-editing');
          if (pendingSave) viewerEl.classList.add('is-saving');
          else viewerEl.classList.remove('is-saving');
        }

        notifyEditStateChange();
      }

      function scheduleUpdateEditButtons() {
        setTimeout(function() {
          updateEditButtons();
        }, 0);
        setTimeout(function() {
          updateEditButtons();
        }, 80);
      }

      function enterEditMode() {
        if (!allowEdit) return;
        if (editing) return;
        editing = true;
        pendingSave = false;
        clearValidationMarks();
        resetCustomSelectionInteractionState(true);
        var inst = getInstance();
        if (inst && typeof inst.enableEdit === 'function') {
          try {
            inst.enableEdit();
          } catch (err) {
            // ignore
          }
        }
        var snapshot = getCurrentMindData();
        if (snapshot && snapshot.nodeData) {
          baseMindData = cloneMindDataObject(snapshot);
          pushHistorySnapshot(snapshot, { reset: true, persist: false });
        }
        persistEditSession();
        updateEditButtons();
      }

      function applyHistoryAt(index) {
        var nextIndex = Number(index);
        if (!isFinite(nextIndex)) return;
        if (nextIndex < 0 || nextIndex >= historyEntries.length) return;
        var entry = historyEntries[nextIndex];
        if (!entry || !entry.data || !entry.data.nodeData) return;
        var inst = getInstance();
        if (!inst || typeof inst.refresh !== 'function') return;
        applyingHistory = true;
        try {
          inst.refresh(cloneMindDataObject(entry.data));
        } catch (err) {
          // ignore
        }
        // MindElixir refresh 可能重置主题变量，撤回/恢复后强制与当前页面主题保持一致。
        refreshMindTheme(inst);
        setTimeout(function() {
          refreshMindTheme(inst);
        }, 0);
        applyingHistory = false;
        historyIndex = nextIndex;
        clearValidationMarks();
        runSearch({ keepIndex: true });
        persistEditSession();
        updateEditButtons();
      }

      function runUndo() {
        if (!editing || pendingSave) return;
        if (historyIndex <= 0) return;
        applyHistoryAt(historyIndex - 1);
      }

      function runRedo() {
        if (!editing || pendingSave) return;
        if (historyEntries.length <= 0) return;
        if (historyIndex >= historyEntries.length - 1) return;
        applyHistoryAt(historyIndex + 1);
      }

      function runAddNode() {
        if (!editing || pendingSave) return;
        var inst = getInstance();
        if (!inst || typeof inst.addChild !== 'function') return;
        var selected = collectSelectedNodes();
        if (selected.length !== 1) return;
        clearValidationMarks();
        try {
          inst.addChild(selected[0], {
            id: generateNodeId(),
            topic: '',
            expanded: true,
            children: [],
          });
          scheduleRecordSnapshot();
        } catch (err) {
          // ignore
        }
      }

      function collectRemovableSelectedNodes() {
        var selected = normalizeSelectionNodeList(collectSelectedNodes()).filter(function(node) {
          return Boolean(node && node.nodeObj && node.nodeObj.parent);
        });
        if (!selected.length) return [];
        selected.sort(function(a, b) {
          var depthA = Array.isArray(collectNodeLocatePath(a)) ? collectNodeLocatePath(a).length : 0;
          var depthB = Array.isArray(collectNodeLocatePath(b)) ? collectNodeLocatePath(b).length : 0;
          if (depthA !== depthB) return depthA - depthB;
          var keyA = getSelectionIdentityKey(a);
          var keyB = getSelectionIdentityKey(b);
          if (keyA < keyB) return -1;
          if (keyA > keyB) return 1;
          return 0;
        });
        var kept = [];
        var keptIds = Object.create(null);
        selected.forEach(function(node) {
          var cursor = node && node.nodeObj ? node.nodeObj.parent : null;
          while (cursor) {
            if (cursor.id !== undefined && cursor.id !== null && keptIds[String(cursor.id)]) return;
            cursor = cursor.parent || null;
          }
          kept.push(node);
          if (node && node.nodeObj && node.nodeObj.id !== undefined && node.nodeObj.id !== null) {
            keptIds[String(node.nodeObj.id)] = true;
          }
        });
        return kept;
      }

      function runDeleteNodes() {
        if (!editing || pendingSave) return;
        var inst = getInstance();
        if (!inst || typeof inst.removeNodes !== 'function') return;
        var selected = collectRemovableSelectedNodes();
        if (!selected.length) return;
        var viewState = captureMindViewState(inst);
        clearValidationMarks();
        try {
          inst.removeNodes(selected);
          clearBoxSelectionClasses();
          scheduleMindViewRestore(inst, viewState, null, { force: true });
          scheduleRecordSnapshot();
        } catch (err) {
          // ignore
        }
      }

      function exitEditMode(clearSession) {
        editing = false;
        pendingSave = false;
        clearValidationMarks();
        clearBoxSelectionClasses();
        var inst = getInstance();
        if (inst && typeof inst.disableEdit === 'function') {
          try {
            inst.disableEdit();
          } catch (err) {
            // ignore
          }
        }
        if (clearSession === true) {
          clearMindEditSession(editableSessionKey);
        } else {
          persistEditSession();
        }
        updateEditButtons();
      }

      function cancelEditMode() {
        if (!editing || pendingSave) return;
        var current = getCurrentMindData();
        var base = cloneMindDataObject(baseMindData) || cloneMindDataObject(opts && opts.initialMindData);
        if (!base || !base.nodeData) {
          exitEditMode(true);
          return;
        }
        var currentData = current || base;
        var snapshotChanged = snapshotSignature(base) !== snapshotSignature(currentData);
        var summary = calculateCaseChangeSummary(base, currentData);
        if (snapshotChanged && (!summary || Number(summary.total || 0) <= 0)) {
          summary = { modified: 1, added: 0, deleted: 0, total: 1 };
        }
        var hasChange = Boolean(snapshotChanged || (summary && Number(summary.total || 0) > 0));

        function applyCancel() {
          var inst = getInstance();
          if (inst && typeof inst.refresh === 'function') {
            applyingHistory = true;
            try {
              inst.refresh(cloneMindDataObject(base));
            } catch (err) {
              // ignore
            }
            applyingHistory = false;
          }
          pushHistorySnapshot(base, { reset: true, persist: false });
          runSearch({ keepIndex: false });
          exitEditMode(true);
        }

        if (!hasChange) {
          applyCancel();
          return;
        }

        var cancelSuffix = opts && opts.cancelConfirmSuffix
          ? String(opts.cancelConfirmSuffix)
          : '确认要取消保存吗？';
        callOpenConfirm({
          title: '取消编辑',
          message: buildMindChangeConfirmMessage(summary, cancelSuffix),
          confirmText: '确认取消',
          cancelText: '继续编辑',
          danger: true,
        }).then(function(res) {
          if (!res || res.ok !== true) return;
          applyCancel();
        });
      }

      function saveEditMode() {
        if (!editing || pendingSave) return;
        var saveFn = opts && typeof opts.onSaveCases === 'function' ? opts.onSaveCases : null;
        var current = getCurrentMindData();
        if (!current || !current.nodeData) {
          callShowToast('当前导图数据为空，无法保存', 'err', 3000);
          return;
        }
        var saveFieldCount = Number(opts && opts.fieldCount);
        if (!isFinite(saveFieldCount) || saveFieldCount <= 0) saveFieldCount = 6;
        var validation = validateMindDataCases(current, {
          fieldCount: saveFieldCount,
          topicCaseParser: opts && typeof opts.topicCaseParser === 'function' ? opts.topicCaseParser : null,
        });
        if (!validation || validation.ok !== true) {
          var msg = validation && Array.isArray(validation.errors) && validation.errors.length
            ? validation.errors[0]
            : '结构校验失败，请检查节点';
          applyValidationMarks(
            validation && Array.isArray(validation.emptyNodeIds) ? validation.emptyNodeIds : [],
            validation && Array.isArray(validation.structuralNodeIds) ? validation.structuralNodeIds : []
          );
          callShowToast(msg, 'err', 3000);
          return;
        }

        clearValidationMarks();
        var base = cloneMindDataObject(baseMindData) || cloneMindDataObject(opts && opts.initialMindData) || current;
        var snapshotChanged = snapshotSignature(base) !== snapshotSignature(current);
        var summary = calculateCaseChangeSummary(base, current);
        if (snapshotChanged && (!summary || Number(summary.total || 0) <= 0)) {
          summary = { modified: 1, added: 0, deleted: 0, total: 1 };
        }
        var hasChange = Boolean(snapshotChanged || (summary && Number(summary.total || 0) > 0));

        function runSave() {
          pendingSave = true;
          updateEditButtons();
          var savePromise = null;
          try {
            if (saveFn) {
              savePromise = saveFn(validation.cases || [], summary || {}, {
                mindData: cloneMindDataObject(current),
                baseMindData: cloneMindDataObject(base),
                validation: validation,
              });
            } else {
              savePromise = Promise.resolve(true);
            }
          } catch (err) {
            savePromise = Promise.reject(err);
          }

          Promise.resolve(savePromise).then(function(res) {
            pendingSave = false;
            var latest = getCurrentMindData() || cloneMindDataObject(current);
            baseMindData = cloneMindDataObject(latest);
            pushHistorySnapshot(latest, { reset: true, persist: false });
            exitEditMode(true);
            if (opts && typeof opts.onSaveSuccess === 'function') {
              try {
                opts.onSaveSuccess(res || null);
              } catch (err2) {
                // ignore
              }
            }
          }).catch(function(err) {
            pendingSave = false;
            updateEditButtons();
            if (err && err.silent === true) return;
            var msg = err && err.message ? String(err.message) : '保存失败';
            callShowToast(msg, 'err', 3000);
          });
        }

        if (!hasChange) {
          runSave();
          return;
        }

        callOpenConfirm({
          title: '确认保存',
          message: buildMindChangeConfirmMessage(summary, '确认要保存吗？'),
          confirmText: '确认保存',
          cancelText: '继续编辑',
        }).then(function(res) {
          if (!res || res.ok !== true) return;
          runSave();
        });
      }

      function onControlsClick(e) {
        hideNodeContextMenu();
        var target = e && e.target && e.target.closest ? e.target.closest('[data-mind-action]') : null;
        if (!target || !target.dataset) return;
        var action = String(target.dataset.mindAction || '');
        if (action === 'zoom-in') {
          zoomBy(defaultScaleStep);
        } else if (action === 'zoom-out') {
          zoomBy(-defaultScaleStep);
        } else if (action === 'zoom-fit') {
          zoomFit();
        } else if (action === 'drawer-fullscreen') {
          setDrawerFullscreen(!isDrawerFullscreen());
        } else if (action === 'search-prev') {
          moveSearch(-1);
        } else if (action === 'search-next') {
          moveSearch(1);
        } else if (action === 'search-clear') {
          clearSearch({ focusInput: true });
        } else if (action === 'export-xmind') {
          if (exportState.pending) return;
          if (!opts || typeof opts.onExportXmind !== 'function') return;
          var resetExportState = function() {
            exportState.pending = false;
            if (target && target.disabled) {
              target.disabled = false;
            }
          };
          try {
            var exportResult = opts.onExportXmind();
            if (exportResult && typeof exportResult.then === 'function') {
              exportState.pending = true;
              target.disabled = true;
              Promise.resolve(exportResult).then(function() {
                resetExportState();
              }).catch(function() {
                resetExportState();
              });
            }
          } catch (err2) {
            resetExportState();
          }
        } else if (action === 'edit-enter') {
          enterEditMode();
        } else if (action === 'edit-cancel') {
          cancelEditMode();
        } else if (action === 'edit-save') {
          saveEditMode();
        } else if (action === 'node-add') {
          runAddNode();
        } else if (action === 'node-delete') {
          runDeleteNodes();
        } else if (action === 'undo') {
          runUndo();
        } else if (action === 'redo') {
          runRedo();
        }
      }

      function resolveElementTarget(target) {
        if (!target) return null;
        if (target.nodeType === 1) return target;
        if (target.parentElement) return target.parentElement;
        if (target.parentNode && target.parentNode.nodeType === 1) return target.parentNode;
        return null;
      }

      function isEditableContentElement(el) {
        if (!el) return false;
        if (el.isContentEditable) return true;
        var editableEl = el.closest ? el.closest('[contenteditable]') : null;
        if (!editableEl || !editableEl.getAttribute) return false;
        var attr = String(editableEl.getAttribute('contenteditable') || '').toLowerCase();
        return attr !== 'false';
      }

      function isTypingTarget(target) {
        var el = resolveElementTarget(target);
        if (!el) return false;
        if (el.id === 'input-box') return true;
        if (el.closest && el.closest('#input-box')) return true;
        var tag = el.tagName ? String(el.tagName).toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        if (isEditableContentElement(el)) return true;
        return false;
      }

      function isEditingInputBoxTarget(target) {
        return Boolean(resolveEditingInputBoxElement(target));
      }

      function resolveEditingInputBoxElement(target) {
        if (!editing || !target) return null;
        var el = resolveElementTarget(target);
        if (!el) return null;
        if (el.id === 'input-box') return el;
        if (el.closest) return el.closest('#input-box');
        return null;
      }

      function stopEditingInputBoxMouseBubble(e) {
        if (!e || !isEditingInputBoxTarget(e.target)) return;
        if (e.stopPropagation) e.stopPropagation();
      }

      function ensureEditingInputBoxMouseIsolation(target) {
        var inputEl = resolveEditingInputBoxElement(target);
        if (!inputEl || inputEl.__tapXmindInputMouseIsolated === true) return;
        inputEl.__tapXmindInputMouseIsolated = true;
        var events = ['pointerdown', 'mousedown', 'pointermove', 'mousemove', 'pointerup', 'mouseup', 'click', 'dblclick', 'selectstart'];
        for (var i = 0; i < events.length; i += 1) {
          inputEl.addEventListener(events[i], stopEditingInputBoxMouseBubble, false);
        }
      }

      function readInputBoxSelectionState(inputEl) {
        if (!inputEl || typeof window === 'undefined' || !window || typeof window.getSelection !== 'function') return null;
        var selection = null;
        try {
          selection = window.getSelection();
        } catch (err0) {
          selection = null;
        }
        if (!selection || selection.rangeCount <= 0) return null;
        var range = null;
        try {
          range = selection.getRangeAt(0);
        } catch (err1) {
          range = null;
        }
        if (!range) return null;
        var startContainer = range.startContainer || null;
        var endContainer = range.endContainer || null;
        var startInside = startContainer === inputEl || Boolean(inputEl.contains && inputEl.contains(startContainer));
        var endInside = endContainer === inputEl || Boolean(inputEl.contains && inputEl.contains(endContainer));
        return {
          inside: startInside && endInside,
          collapsed: Boolean(selection.isCollapsed),
          selectedText: String(selection.toString() || ''),
          text: String(inputEl.textContent || ''),
        };
      }

      function isInputBoxFullySelected(inputEl) {
        var state = readInputBoxSelectionState(inputEl);
        if (!state || !state.inside || state.collapsed) return false;
        if (!state.text) return false;
        return state.selectedText === state.text;
      }

      function collapseFullInputBoxSelectionToEnd(inputEl) {
        if (!editing || pendingSave || !inputEl || inputEl !== document.getElementById('input-box')) return false;
        if (editInputPointerState.active) return false;
        if (!isInputBoxFullySelected(inputEl)) return false;
        return placeInputCaretToEnd();
      }

      function scheduleCollapseFullInputBoxSelection(inputEl) {
        if (!inputEl) return;
        var token = createInputSelectionScheduleToken();
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          collapseFullInputBoxSelectionToEnd(inputEl);
        }, 32);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          collapseFullInputBoxSelectionToEnd(inputEl);
        }, 96);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          collapseFullInputBoxSelectionToEnd(inputEl);
        }, 160);
      }

      function syncEditingInputBoxElement() {
        if (!editing || typeof document === 'undefined' || !document || typeof document.getElementById !== 'function') return;
        var inputEl = document.getElementById('input-box');
        if (!inputEl) {
          lastEditingInputBoxEl = null;
          return;
        }
        ensureEditingInputBoxMouseIsolation(inputEl);
        if (lastEditingInputBoxEl === inputEl) return;
        lastEditingInputBoxEl = inputEl;
        scheduleCollapseFullInputBoxSelection(inputEl);
      }

      function resetEditInputPointerState() {
        editInputPointerState.active = false;
        editInputPointerState.startX = 0;
        editInputPointerState.startY = 0;
        editInputPointerState.moved = false;
        editInputPointerState.multiClick = false;
      }

      function cancelScheduledInputSelection() {
        inputSelectionScheduleToken += 1;
        clearInputSelectionGuard();
      }

      function createInputSelectionScheduleToken() {
        inputSelectionScheduleToken += 1;
        return inputSelectionScheduleToken;
      }

      function isInputSelectionScheduleCurrent(token) {
        return token === inputSelectionScheduleToken;
      }

      function clearInputSelectionGuard() {
        if (inputSelectionGuardTimer) {
          clearTimeout(inputSelectionGuardTimer);
          inputSelectionGuardTimer = 0;
        }
        inputSelectionGuardUntil = 0;
        inputSelectionGuardToken = 0;
        inputSelectionGuardPoint = null;
      }

      function runInputSelectionGuard() {
        inputSelectionGuardTimer = 0;
        if (
          !editing
          || pendingSave
          || !inputSelectionGuardUntil
          || Date.now() > inputSelectionGuardUntil
          || !isInputSelectionScheduleCurrent(inputSelectionGuardToken)
        ) {
          clearInputSelectionGuard();
          return;
        }
        if (!editInputPointerState.active) {
          var inputEl = document.getElementById('input-box');
          if (inputEl && isInputBoxFullySelected(inputEl)) {
            if (inputSelectionGuardPoint) placeInputCaretAtPoint(inputSelectionGuardPoint);
            else placeInputCaretToEnd();
          }
        }
        if (
          inputSelectionGuardUntil
          && Date.now() <= inputSelectionGuardUntil
          && isInputSelectionScheduleCurrent(inputSelectionGuardToken)
        ) {
          inputSelectionGuardTimer = setTimeout(runInputSelectionGuard, 32);
        } else {
          clearInputSelectionGuard();
        }
      }

      function startInputSelectionGuard(point, token) {
        if (!token) return;
        inputSelectionGuardPoint = normalizeClientPoint(point);
        inputSelectionGuardToken = token;
        inputSelectionGuardUntil = Date.now() + 180;
        if (inputSelectionGuardTimer) {
          clearTimeout(inputSelectionGuardTimer);
          inputSelectionGuardTimer = 0;
        }
        inputSelectionGuardTimer = setTimeout(runInputSelectionGuard, 0);
      }

      function onDocumentSelectionChangeForInputBox() {
        if (!editing || !inputSelectionGuardUntil || inputSelectionGuardTimer) return;
        if (Date.now() > inputSelectionGuardUntil) {
          clearInputSelectionGuard();
          return;
        }
        inputSelectionGuardTimer = setTimeout(runInputSelectionGuard, 0);
      }

      function trackEditingInputBoxMouseEvent(e) {
        if (!e) return;
        var type = e.type ? String(e.type) : '';
        var x = typeof e.clientX === 'number' ? e.clientX : 0;
        var y = typeof e.clientY === 'number' ? e.clientY : 0;
        var isMultiClick = Number(e.detail || 0) > 1 || type === 'dblclick';
        if (type === 'pointerdown' || type === 'mousedown') {
          cancelScheduledInputSelection();
          editInputPointerState.active = true;
          editInputPointerState.startX = x;
          editInputPointerState.startY = y;
          editInputPointerState.moved = false;
          editInputPointerState.multiClick = isMultiClick;
          return;
        }
        if (!editInputPointerState.active) return;
        if (isMultiClick) editInputPointerState.multiClick = true;
        if (Math.abs(x - editInputPointerState.startX) > 5 || Math.abs(y - editInputPointerState.startY) > 5) {
          editInputPointerState.moved = true;
        }
        if (type === 'pointerup' || type === 'mouseup' || type === 'click') {
          var shouldPlaceCaret = !editInputPointerState.moved && !editInputPointerState.multiClick;
          resetEditInputPointerState();
          if (shouldPlaceCaret) {
            scheduleInputCaretAtPoint({ x: x, y: y });
          }
        }
      }

      function protectEditingInputBoxMouseEvent(e) {
        if (!e || !isEditingInputBoxTarget(e.target)) return;
        ensureEditingInputBoxMouseIsolation(e.target);
        trackEditingInputBoxMouseEvent(e);
        hideNodeContextMenu({ preserveNativeSelection: true });
        clearClickNodeEditTimer();
        clearCustomPointerDragState();
      }

      function isMutationKeyEvent(e) {
        if (!e) return false;
        var key = e.key ? String(e.key) : '';
        var lower = key.toLowerCase();
        if (key === 'Tab' || key === 'Enter' || key === 'Delete' || key === 'Backspace') return true;
        if ((e.ctrlKey || e.metaKey) && (lower === 'c' || lower === 'v' || lower === 'x' || lower === 'z' || lower === 'y')) return true;
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && lower === 'z') return true;
        return false;
      }

      function onViewerKeydown(e) {
        if (!e) return;
        var eventTarget = e.target || null;
        var typing = isTypingTarget(eventTarget);
        if (typing) hideNodeContextMenu({ preserveNativeSelection: true });
        else hideNodeContextMenu();
        if (e.key === 'Escape' && isDrawerFullscreen()) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          setDrawerFullscreen(false);
          return;
        }
        if (controlsEl && controlsEl.contains && controlsEl.contains(e.target)) return;
        var lower = e.key ? String(e.key).toLowerCase() : '';

        if (!editing) {
          if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
            var deleteSelectedReadonly = collectRemovableSelectedNodes();
            if (deleteSelectedReadonly.length && requestDeleteSelection(buildNodeMeta(deleteSelectedReadonly[0]))) {
              if (e.preventDefault) e.preventDefault();
              if (e.stopPropagation) e.stopPropagation();
              return;
            }
          }
          if (isMutationKeyEvent(e)) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
          }
          return;
        }

        if (!typing && (e.ctrlKey || e.metaKey) && !e.shiftKey && lower === 'z') {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          runUndo();
          return;
        }

        if (!typing && (((e.ctrlKey || e.metaKey) && lower === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && lower === 'z'))) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          runRedo();
          return;
        }

        if (!typing && e.key === 'Delete') {
          var deleteSelected = collectRemovableSelectedNodes();
          if (deleteSelected.length) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            runDeleteNodes();
            return;
          }
        }

        if (!typing && beginNodeEditByKeyboard(e)) {
          return;
        }

        if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
          var selected = collectRemovableSelectedNodes();
          if (selected.length) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            runDeleteNodes();
          }
        }
      }

      function findViewerNodeById(nodeId) {
        var normalized = nodeId === null || nodeId === undefined ? '' : String(nodeId);
        if (!normalized || !viewerEl || !viewerEl.querySelectorAll) return null;
        var nodes = viewerEl.querySelectorAll('me-tpc');
        for (var i = 0; i < nodes.length; i += 1) {
          var node = nodes[i];
          if (!node || !node.nodeObj || node.nodeObj.id === null || node.nodeObj.id === undefined) continue;
          if (String(node.nodeObj.id) === normalized) return node;
        }
        return null;
      }

      function clearClickNodeEditTimer() {
        if (!clickNodeEditTimer) return;
        clearTimeout(clickNodeEditTimer);
        clickNodeEditTimer = 0;
      }

      function normalizeBeginEditSelectionMode(mode) {
        if (mode === 'select-all') return 'select-all';
        if (mode === 'point') return 'point';
        return 'end';
      }

      function normalizeClientPoint(point) {
        if (!point) return null;
        var x = Number(point.x);
        var y = Number(point.y);
        if (!isFinite(x) || !isFinite(y)) return null;
        return { x: x, y: y };
      }

      function scheduleBeginEditSelectionMode(mode, point) {
        var nextMode = normalizeBeginEditSelectionMode(mode);
        beginEditSelectionMode = nextMode;
        beginEditCaretPoint = nextMode === 'point' ? normalizeClientPoint(point) : null;
        if (beginEditSelectionResetTimer) {
          clearTimeout(beginEditSelectionResetTimer);
          beginEditSelectionResetTimer = 0;
        }
        beginEditSelectionResetTimer = setTimeout(function() {
          beginEditSelectionResetTimer = 0;
          beginEditSelectionMode = 'end';
          beginEditCaretPoint = null;
        }, 360);
      }

      function consumeBeginEditSelectionRequest() {
        var mode = normalizeBeginEditSelectionMode(beginEditSelectionMode);
        var point = beginEditCaretPoint;
        beginEditSelectionMode = 'end';
        beginEditCaretPoint = null;
        if (beginEditSelectionResetTimer) {
          clearTimeout(beginEditSelectionResetTimer);
          beginEditSelectionResetTimer = 0;
        }
        return {
          mode: mode,
          point: point,
        };
      }

      function clearPendingKeyboardNodeEdit() {
        pendingKeyboardNodeEditPayload = null;
      }

      function queuePendingKeyboardNodeEdit(payload) {
        if (!payload || typeof payload !== 'object') {
          clearPendingKeyboardNodeEdit();
          return;
        }
        var mode = payload.mode === 'clear' ? 'clear' : (payload.mode === 'insert' ? 'insert' : 'compose');
        pendingKeyboardNodeEditPayload = {
          mode: mode,
          text: payload.text === undefined || payload.text === null ? '' : String(payload.text),
        };
      }

      function resolveKeyboardNodeEditPayload(e) {
        if (!e) return null;
        if (e.ctrlKey || e.metaKey || e.altKey) return null;
        var key = e.key === undefined || e.key === null ? '' : String(e.key);
        if (!key) return null;
        if (key === 'Backspace') {
          return { mode: 'clear', text: '' };
        }
        if (key === 'Process' || key === 'Unidentified') {
          return { mode: 'compose', text: '' };
        }
        if (key.length === 1) {
          return { mode: 'insert', text: key };
        }
        return null;
      }

      function findViewerNodeAtPoint(clientX, clientY) {
        if (!viewerEl || !viewerEl.querySelectorAll) return null;
        var x = Number(clientX);
        var y = Number(clientY);
        if (!isFinite(x) || !isFinite(y)) return null;
        var nodes = viewerEl.querySelectorAll('me-tpc');
        var matched = null;
        var matchedArea = 0;
        Array.prototype.forEach.call(nodes || [], function(node) {
          if (!node || !node.nodeObj || !node.getBoundingClientRect) return;
          var rect = node.getBoundingClientRect();
          if (!rect || rect.width <= 0 || rect.height <= 0) return;
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
          var area = rect.width * rect.height;
          if (!matched || area < matchedArea) {
            matched = node;
            matchedArea = area;
          }
        });
        return matched;
      }

      function resolveViewerEventNode(e) {
        var target = e && e.target ? e.target : null;
        if (!target || isTypingTarget(target)) return null;
        if (isEventInsideMindControls(target)) return null;
        if (isMindNodeExpanderTarget(target)) return null;
        if (target.closest && target.closest('.xmind-node-context-menu')) return null;
        if (
          e
          && typeof e.clientX === 'number'
          && typeof e.clientY === 'number'
          && typeof document !== 'undefined'
          && document
          && typeof document.elementsFromPoint === 'function'
        ) {
          var pointed = document.elementsFromPoint(e.clientX, e.clientY) || [];
          for (var i = 0; i < pointed.length; i += 1) {
            var pointedEl = pointed[i];
            if (!pointedEl || !pointedEl.closest) continue;
            if (isEventInsideMindControls(pointedEl)) continue;
            var pointedNode = pointedEl.closest('me-tpc');
            if (!pointedNode || !pointedNode.nodeObj) continue;
            if (pointedNode.getAttribute && pointedNode.getAttribute('data-xmind-select-group')) {
              return pointedNode;
            }
          }
          var pointedFallbackNode = findViewerNodeAtPoint(e.clientX, e.clientY);
          if (pointedFallbackNode) return pointedFallbackNode;
        }
        var nodeEl = target.closest ? target.closest('me-tpc') : null;
        if (!nodeEl || !nodeEl.nodeObj) return null;
        return nodeEl;
      }

      function triggerNodeEditWithMode(nodeEl, mode, point) {
        if (!nodeEl || !nodeEl.nodeObj) return;
        var nodeId = nodeEl.nodeObj.id === null || nodeEl.nodeObj.id === undefined
          ? ''
          : String(nodeEl.nodeObj.id);
        setTimeout(function() {
          var inst = getInstance();
          if (!inst || typeof inst.beginEdit !== 'function') return;
          var liveNodeEl = nodeId ? findViewerNodeById(nodeId) : nodeEl;
          if (!liveNodeEl) return;
          selectSingleNodeForContextMenu(liveNodeEl);
          scheduleBeginEditSelectionMode(mode, point);
          try {
            inst.beginEdit(liveNodeEl);
          } catch (err) {
            // ignore
          }
        }, 0);
      }

      function beginNodeEditBySingleClick(e) {
        clearClickNodeEditTimer();
        resetModifierSelectionPointerGuard();
        if (!editing || pendingSave || !e) return;
        if (e.button !== undefined && e.button !== 0) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        if (Number(e.detail) > 1) return;

        var nodeEl = resolveViewerEventNode(e);
        if (!nodeEl) return;

        clickNodeEditTimer = setTimeout(function() {
          clickNodeEditTimer = 0;
          triggerNodeEditWithMode(nodeEl, 'point', {
            x: e.clientX,
            y: e.clientY,
          });
        }, clickNodeEditDelay);
      }

      function beginNodeEditByKeyboard(e) {
        if (!editing || pendingSave || !e) return false;
        if (isTypingTarget(e.target)) return false;
        var payload = resolveKeyboardNodeEditPayload(e);
        if (!payload) return false;

        var selected = collectSelectedNodes().filter(function(nodeEl) {
          return Boolean(nodeEl && nodeEl.nodeObj);
        });
        if (selected.length !== 1) return false;

        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        queuePendingKeyboardNodeEdit(payload);
        triggerNodeEditWithMode(selected[0], 'select-all');
        return true;
      }

      function onViewerClick(e) {
        resetModifierSelectionPointerGuard();
        if (e && isMindNodeExpanderTarget(e.target)) {
          hideNodeContextMenu();
          clearClickNodeEditTimer();
          updateEditButtons();
          return;
        }
        if (e && isTypingTarget(e.target)) {
          hideNodeContextMenu({ preserveNativeSelection: true });
          clearClickNodeEditTimer();
          updateEditButtons();
          return;
        }
        if (enableCustomBoxSelection && modifierSelectionSuppressClickUntil && Date.now() <= modifierSelectionSuppressClickUntil) {
          if (e && e.preventDefault) e.preventDefault();
          if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
          else if (e && e.stopPropagation) e.stopPropagation();
          updateEditButtons();
          return;
        }
        if (enableCustomBoxSelection && boxSuppressClickUntil && Date.now() <= boxSuppressClickUntil) {
          if (e && e.preventDefault) e.preventDefault();
          if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
          else if (e && e.stopPropagation) e.stopPropagation();
          boxSuppressClickUntil = 0;
          updateEditButtons();
          return;
        }
        var nodeEl = resolveViewerEventNode(e);
        if (editing && !pendingSave && e && !isCtrlModifierActive(e) && !e.metaKey && !e.shiftKey && !e.altKey) {
          if (nodeEl) {
            scheduleBeginEditSelectionMode('point', {
              x: e.clientX,
              y: e.clientY,
            });
            selectActualNodeForEditing(nodeEl);
          } else if (isEventInsideMindCanvas(e.target) && Date.now() > editNodePointerSuppressCanvasClearUntil) {
            clearCustomSelection(true);
            focusViewerForKeyboard();
          }
        }
        if (enableCustomBoxSelection && !editing && e && (isCtrlModifierActive(e) || e.metaKey) && !e.shiftKey && !e.altKey && nodeEl) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          hideNodeContextMenu();
          clearClickNodeEditTimer();
          toggleNodeInCustomSelection(nodeEl);
          focusViewerForKeyboard();
          updateEditButtons();
          return;
        }
        if (enableCustomBoxSelection && !editing && e && !isCtrlModifierActive(e) && !e.metaKey && !e.shiftKey && !e.altKey) {
          if (nodeEl) {
            applyCustomSelectionNodes([nodeEl]);
            focusViewerForKeyboard();
          } else if (isEventInsideMindCanvas(e.target)) {
            clearCustomSelection(true);
            focusViewerForKeyboard();
          }
        }
        hideNodeContextMenu();
        clearClickNodeEditTimer();
        updateEditButtons();
        scheduleUpdateEditButtons();
      }

      function normalizeLocatePath(pathArr) {
        if (!Array.isArray(pathArr)) return [];
        return pathArr.map(function(seg) {
          if (seg === null || seg === undefined) return '';
          return String(seg).trim();
        });
      }

      function collectNodeLocatePath(nodeEl) {
        if (!nodeEl || !nodeEl.nodeObj) return [];
        var topics = [];
        var cursor = nodeEl.nodeObj;
        var guard = 0;
        while (cursor && guard < 64) {
          var topic = cursor.topic === null || cursor.topic === undefined
            ? ''
            : String(cursor.topic).trim();
          topics.unshift(topic);
          cursor = cursor.parent || null;
          guard += 1;
        }

        var inst = getInstance();
        var rootTopic = inst && inst.nodeData && inst.nodeData.topic !== null && inst.nodeData.topic !== undefined
          ? String(inst.nodeData.topic).trim()
          : '';
        if (rootTopic && topics.length && topics[0] === rootTopic) {
          topics = topics.slice(1);
        }
        while (topics.length > 6) {
          topics = topics.slice(topics.length - 6);
        }
        return normalizeLocatePath(topics);
      }

      function onViewerDblClick(e) {
        if (e && isMindNodeExpanderTarget(e.target)) return;
        if (editing) {
          clearClickNodeEditTimer();
          var rawTarget = e && e.target ? e.target : null;
          if (rawTarget && isTypingTarget(rawTarget)) {
            hideNodeContextMenu({ preserveNativeSelection: true });
            return;
          }
          var editingTargetNode = resolveViewerEventNode(e);
          if (!editingTargetNode) return;
          if (e && e.preventDefault) e.preventDefault();
          if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
          else if (e && e.stopPropagation) e.stopPropagation();
          triggerNodeEditWithMode(editingTargetNode, 'point', {
            x: e && typeof e.clientX === 'number' ? e.clientX : 0,
            y: e && typeof e.clientY === 'number' ? e.clientY : 0,
          });
          return;
        }
        if (!opts || typeof opts.onNodeDblClickLocate !== 'function') return;
        if (controlsEl && controlsEl.contains && controlsEl.contains(e && e.target)) return;
        if (e && e.target && e.target.closest && e.target.closest('[data-mind-controls]')) return;

        var nodeEl = e && e.target && e.target.closest ? e.target.closest('me-tpc') : null;
        if (!nodeEl || !nodeEl.nodeObj) return;

        var path = collectNodeLocatePath(nodeEl);
        if (!path.length) return;

        try {
          opts.onNodeDblClickLocate({
            path: path,
            topic: path[path.length - 1] || '',
            nodeId: nodeEl.nodeObj && nodeEl.nodeObj.id ? String(nodeEl.nodeObj.id) : '',
            depth: path.length,
          });
        } catch (err) {
          // ignore
        }
      }

      function onViewerBlur(e) {
        if (!editing) return;
        var target = e && e.target ? e.target : null;
        if (!target) return;
        if (target.id !== 'input-box') return;
        scheduleRecordSnapshot();
      }

      function onViewerInput(e) {
        if (!editing) return;
        var target = e && e.target ? e.target : null;
        if (!target) return;
        if (target.id !== 'input-box') return;
        scheduleRecordSnapshot();
      }

      function readClipboardPlainText(e) {
        if (!e) return '';
        var clipboard = e.clipboardData ? e.clipboardData : null;
        if (!clipboard || typeof clipboard.getData !== 'function') return '';
        var text = '';
        try {
          text = clipboard.getData('text/plain');
        } catch (err0) {
          text = '';
        }
        if (!text) {
          try {
            text = clipboard.getData('text');
          } catch (err1) {
            text = '';
          }
        }
        return text ? String(text) : '';
      }

      function onViewerPaste(e) {
        if (!editing || pendingSave) return;
        if (!e) return;
        if (controlsEl && controlsEl.contains && controlsEl.contains(e.target)) return;
        var target = e.target || null;
        if (isTypingTarget(target)) return;

        var rawText = readClipboardPlainText(e);
        if (!rawText) return;
        if (isMindElixirInternalClipboardText(rawText)) return;

        var parsed = parseIndentedTextToMindData(rawText);
        var parsedRoot = parsed && parsed.mindData && parsed.mindData.nodeData
          ? parsed.mindData.nodeData
          : null;
        var plainTopic = '';
        if (!parsedRoot) {
          plainTopic = normalizeClipboardPlainNodeTopic(rawText);
          if (!plainTopic) return;
        }

        var inst = getInstance();
        if (!inst || typeof inst.refresh !== 'function') return;

        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();

        var currentData = getCurrentMindData();
        var fallbackMindData = parsed && parsed.mindData && parsed.mindData.nodeData
          ? parsed.mindData
          : { nodeData: createNode(plainTopic) };
        var nextData = cloneMindDataObject(currentData && currentData.nodeData ? currentData : fallbackMindData);
        if (!nextData || !nextData.nodeData) return;
        var nextRoot = nextData.nodeData;
        if (!parsedRoot && plainTopic) parsedRoot = createNode(plainTopic);
        if (!parsedRoot) return;

        var selectedNodes = collectSelectedNodes();
        var selectedNodeId = selectedNodes.length === 1 && selectedNodes[0] && selectedNodes[0].nodeObj && selectedNodes[0].nodeObj.id
          ? String(selectedNodes[0].nodeObj.id)
          : '';
        var targetNode = nextRoot;
        if (selectedNodeId) {
          var foundSelected = findNodeWithParentById(nextRoot, selectedNodeId, null);
          if (foundSelected && foundSelected.node) targetNode = foundSelected.node;
        }
        if (!targetNode || typeof targetNode !== 'object') targetNode = nextRoot;

        var parsedRootTopic = normalizeMindTopic(parsedRoot.topic);
        var targetTopic = normalizeMindTopic(targetNode.topic);
        var parsedChildren = Array.isArray(parsedRoot.children) ? parsedRoot.children : [];
        var nodesToAppend = [];
        var allowFlattenByRoot = targetNode === nextRoot && parsedChildren.length > 0 && parsedRootTopic === normalizeMindTopic(nextRoot.topic);
        var allowFlattenBySelection = targetNode !== nextRoot && parsedChildren.length > 0 && parsedRootTopic === targetTopic;
        if (allowFlattenByRoot || allowFlattenBySelection) {
          nodesToAppend = parsedChildren;
        } else {
          nodesToAppend = [parsedRoot];
        }
        if (!nodesToAppend.length) return;
        if (!Array.isArray(targetNode.children)) targetNode.children = [];
        for (var i = 0; i < nodesToAppend.length; i += 1) {
          var nextNode = cloneMindNodeTree(nodesToAppend[i]);
          if (!nextNode) continue;
          targetNode.children.push(nextNode);
        }
        targetNode.expanded = true;

        var refreshed = false;
        clearValidationMarks();
        applyingHistory = true;
        try {
          inst.refresh(nextData);
          refreshed = true;
        } catch (err) {
          refreshed = false;
        }
        applyingHistory = false;

        if (!refreshed) {
          callShowToast('粘贴失败，请检查层级格式后重试', 'err', 3200);
          return;
        }

        pushHistorySnapshot(nextData);
        runSearch({ keepIndex: false });
        updateEditButtons();

        var rootTopic = parsed && parsed.rootTopic ? String(parsed.rootTopic) : '节点';
        if (parsed && parsed.mindData && parsed.mindData.nodeData) {
          var nodeCount = Number(parsed.nodeCount);
          if (!isFinite(nodeCount) || nodeCount <= 0) nodeCount = 0;
          callShowToast('已拼接结构：' + rootTopic + '（' + String(nodeCount) + ' 节点）', '', 2200);
          return;
        }
        var previewTopic = plainTopic || rootTopic || '文本';
        if (previewTopic.indexOf('\n') >= 0) {
          previewTopic = previewTopic.split('\n')[0] + '...';
        }
        if (previewTopic.length > 16) {
          previewTopic = previewTopic.slice(0, 16) + '...';
        }
        callShowToast('已新增子节点：' + previewTopic, '', 2200);
      }

      function onWindowPageHide() {
        flushPendingEditSnapshot();
      }

      function insertInputBoxLineBreak(inputEl) {
        if (!inputEl) return false;
        if (typeof document !== 'undefined' && document && typeof document.execCommand === 'function') {
          try {
            if (document.execCommand('insertLineBreak')) return true;
          } catch (err0) {
            // ignore
          }
          try {
            if (document.execCommand('insertText', false, '\n')) return true;
          } catch (err1) {
            // ignore
          }
        }
        if (typeof window === 'undefined' || !window || typeof window.getSelection !== 'function') return false;
        if (typeof document === 'undefined' || !document || typeof document.createTextNode !== 'function') return false;
        var selection = null;
        try {
          selection = window.getSelection();
        } catch (err2) {
          selection = null;
        }
        if (!selection || selection.rangeCount <= 0) return false;
        try {
          var range = selection.getRangeAt(0);
          range.deleteContents();
          var breakEl = document.createElement ? document.createElement('br') : null;
          if (breakEl) {
            range.insertNode(breakEl);
            range.setStartAfter(breakEl);
          } else {
            var textNode = document.createTextNode('\n');
            range.insertNode(textNode);
            range.setStartAfter(textNode);
          }
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        } catch (err3) {
          return false;
        }
      }

      function onViewerInputBoxEnterKeydown(e) {
        if (!editing) return;
        if (!e || e.key !== 'Enter') return;
        var target = e.target || null;
        if (!target || target.id !== 'input-box') return;
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
        insertInputBoxLineBreak(target);
      }

      function selectInputBoxText() {
        if (typeof document === 'undefined') return false;
        var inputEl = document.getElementById('input-box');
        if (!inputEl) return false;
        if (typeof inputEl.focus === 'function' && document.activeElement !== inputEl) {
          try {
            inputEl.focus();
          } catch (err0) {
            // ignore
          }
        }

        if (typeof inputEl.select === 'function') {
          try {
            inputEl.select();
            return true;
          } catch (err1) {
            // ignore
          }
        }

        if (typeof window === 'undefined' || !window || typeof window.getSelection !== 'function') return false;
        if (typeof document.createRange !== 'function') return false;

        var selection = null;
        try {
          selection = window.getSelection();
        } catch (err2) {
          selection = null;
        }
        if (!selection) return false;

        try {
          var range = document.createRange();
          range.selectNodeContents(inputEl);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        } catch (err3) {
          return false;
        }
      }

      function placeInputCaretToEnd() {
        if (typeof document === 'undefined') return false;
        var inputEl = document.getElementById('input-box');
        if (!inputEl) return false;
        if (typeof inputEl.focus === 'function' && document.activeElement !== inputEl) {
          try {
            inputEl.focus();
          } catch (err0) {
            // ignore
          }
        }

        if (typeof inputEl.setSelectionRange === 'function') {
          try {
            var valueLen = String(inputEl.value || '').length;
            inputEl.setSelectionRange(valueLen, valueLen);
            return true;
          } catch (err1) {
            // ignore
          }
        }

        if (typeof window === 'undefined' || !window || typeof window.getSelection !== 'function') return false;
        if (typeof document.createRange !== 'function') return false;

        var selection = null;
        try {
          selection = window.getSelection();
        } catch (err2) {
          selection = null;
        }
        if (!selection) return false;

        try {
          var range = document.createRange();
          range.selectNodeContents(inputEl);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        } catch (err3) {
          return false;
        }
      }

      function placeInputCaretAtPoint(point) {
        if (typeof document === 'undefined') return false;
        var inputEl = document.getElementById('input-box');
        if (!inputEl) return false;
        var normalizedPoint = normalizeClientPoint(point);
        if (!normalizedPoint) return placeInputCaretToEnd();
        if (typeof inputEl.focus === 'function' && document.activeElement !== inputEl) {
          try {
            inputEl.focus();
          } catch (err0) {
            // ignore
          }
        }

        var range = null;
        if (typeof document.caretRangeFromPoint === 'function') {
          try {
            range = document.caretRangeFromPoint(normalizedPoint.x, normalizedPoint.y);
          } catch (err1) {
            range = null;
          }
        }
        if (!range && typeof document.caretPositionFromPoint === 'function' && typeof document.createRange === 'function') {
          try {
            var position = document.caretPositionFromPoint(normalizedPoint.x, normalizedPoint.y);
            if (position && position.offsetNode) {
              range = document.createRange();
              range.setStart(position.offsetNode, position.offset);
              range.collapse(true);
            }
          } catch (err2) {
            range = null;
          }
        }

        if (!range) {
          var currentStateWithoutRange = readInputBoxSelectionState(inputEl);
          if (currentStateWithoutRange && currentStateWithoutRange.inside && currentStateWithoutRange.collapsed) return true;
          return placeInputCaretToEnd();
        }
        var startContainer = range.startContainer || null;
        if (startContainer !== inputEl && !(inputEl.contains && inputEl.contains(startContainer))) {
          var currentStateOutside = readInputBoxSelectionState(inputEl);
          if (currentStateOutside && currentStateOutside.inside && currentStateOutside.collapsed) return true;
          return placeInputCaretToEnd();
        }
        if (typeof window === 'undefined' || !window || typeof window.getSelection !== 'function') return false;

        var selection = null;
        try {
          selection = window.getSelection();
        } catch (err3) {
          selection = null;
        }
        if (!selection) return false;

        try {
          if (typeof range.collapse === 'function') range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        } catch (err4) {
          return false;
        }
      }

      function scheduleInputTextSelection() {
        var token = createInputSelectionScheduleToken();
        clearInputSelectionGuard();
        selectInputBoxText();
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          selectInputBoxText();
        }, 0);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          selectInputBoxText();
        }, 24);
      }

      function scheduleInputCaretAtPoint(point) {
        var normalizedPoint = normalizeClientPoint(point);
        if (!normalizedPoint) {
          scheduleInputCaretToEnd();
          return;
        }
        var token = createInputSelectionScheduleToken();
        startInputSelectionGuard(normalizedPoint, token);
        placeInputCaretAtPoint(normalizedPoint);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          placeInputCaretAtPoint(normalizedPoint);
        }, 0);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          placeInputCaretAtPoint(normalizedPoint);
        }, 24);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          placeInputCaretAtPoint(normalizedPoint);
        }, 72);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          placeInputCaretAtPoint(normalizedPoint);
        }, 144);
      }

      function replaceInputBoxText(text) {
        if (typeof document === 'undefined') return false;
        var inputEl = document.getElementById('input-box');
        if (!inputEl) return false;
        var nextText = text === undefined || text === null ? '' : String(text);
        if (typeof inputEl.focus === 'function' && document.activeElement !== inputEl) {
          try {
            inputEl.focus();
          } catch (err0) {
            // ignore
          }
        }

        var replaced = false;
        if (typeof document.execCommand === 'function') {
          try {
            replaced = document.execCommand('insertText', false, nextText);
          } catch (err1) {
            replaced = false;
          }
        }

        if (!replaced) {
          try {
            if (inputEl.value !== undefined) inputEl.value = nextText;
            if (inputEl.textContent !== undefined) inputEl.textContent = nextText;
            replaced = true;
          } catch (err2) {
            replaced = false;
          }
        }

        if (replaced && typeof inputEl.dispatchEvent === 'function') {
          var evt = null;
          try {
            evt = new Event('input', { bubbles: true, cancelable: false });
          } catch (err3) {
            if (typeof document.createEvent === 'function') {
              evt = document.createEvent('Event');
              evt.initEvent('input', true, false);
            }
          }
          if (evt) {
            try {
              inputEl.dispatchEvent(evt);
            } catch (err4) {
              // ignore
            }
          }
        }

        return replaced;
      }

      function applyPendingKeyboardNodeEdit() {
        if (!pendingKeyboardNodeEditPayload) return true;
        var payload = pendingKeyboardNodeEditPayload;
        if (!payload || payload.mode === 'compose') {
          clearPendingKeyboardNodeEdit();
          return true;
        }
        if (!selectInputBoxText()) return false;
        var nextText = payload.mode === 'clear' ? '' : payload.text;
        if (!replaceInputBoxText(nextText)) return false;
        scheduleInputCaretToEnd();
        clearPendingKeyboardNodeEdit();
        return true;
      }

      function scheduleApplyPendingKeyboardNodeEdit() {
        if (!pendingKeyboardNodeEditPayload) return;
        var retries = 0;
        var run = function(delayMs) {
          setTimeout(function() {
            if (!pendingKeyboardNodeEditPayload) return;
            if (applyPendingKeyboardNodeEdit()) return;
            retries += 1;
            if (retries >= 4) {
              clearPendingKeyboardNodeEdit();
              return;
            }
            run(24);
          }, delayMs);
        };
        run(0);
      }

      function scheduleInputCaretToEnd() {
        var token = createInputSelectionScheduleToken();
        startInputSelectionGuard(null, token);
        placeInputCaretToEnd();
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          placeInputCaretToEnd();
        }, 0);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          placeInputCaretToEnd();
        }, 24);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          placeInputCaretToEnd();
        }, 72);
        setTimeout(function() {
          if (!isInputSelectionScheduleCurrent(token)) return;
          placeInputCaretToEnd();
        }, 144);
      }

      var customDragGhostEl = null;
      var customPointerDragState = {
        active: false,
        moving: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        previewText: '',
        nodeId: '',
      };
      var customPointerDragThreshold = 3;

      function clearCustomPointerDragState() {
        customPointerDragState.active = false;
        customPointerDragState.moving = false;
        customPointerDragState.pointerId = null;
        customPointerDragState.startX = 0;
        customPointerDragState.startY = 0;
        customPointerDragState.previewText = '';
        customPointerDragState.nodeId = '';
      }

      function extractNodePreviewTopic(nodeEl) {
        if (!nodeEl || !nodeEl.nodeObj) return '';
        if (nodeEl.nodeObj.topic === undefined || nodeEl.nodeObj.topic === null) return '';
        return String(nodeEl.nodeObj.topic || '').trim();
      }

      function resolvePointerDragPreviewText(fallbackNodeEl) {
        var selected = collectSelectedNodes();
        if (selected.length > 1) return String(selected.length) + ' 个节点';
        if (selected.length === 1) {
          var selectedTopic = extractNodePreviewTopic(selected[0]);
          if (selectedTopic) return selectedTopic;
        }
        var fallback = extractNodePreviewTopic(fallbackNodeEl);
        if (fallback) return fallback;
        return '拖拽节点';
      }

      function getDraggedPreviewText(inst) {
        var dragged = inst && Array.isArray(inst.dragged) ? inst.dragged : [];
        if (!dragged.length) return '拖拽节点';
        if (dragged.length > 1) return String(dragged.length) + ' 个节点';
        var node = dragged[0];
        if (node && node.nodeObj && node.nodeObj.topic !== undefined && node.nodeObj.topic !== null) {
          var topic = String(node.nodeObj.topic || '').trim();
          if (topic) return topic;
        }
        return '拖拽节点';
      }

      function onViewerPointerDownForDragPreview(e) {
        clearClickNodeEditTimer();
        if (isMindNodeExpanderTarget(e && e.target)) {
          clearCustomPointerDragState();
          return;
        }
        if (isTypingTarget(e && e.target)) {
          clearCustomPointerDragState();
          return;
        }
        if (!editing) {
          clearCustomPointerDragState();
          return;
        }
        if (!e || e.button !== 0) {
          clearCustomPointerDragState();
          return;
        }
        if (e.ctrlKey) {
          clearCustomPointerDragState();
          return;
        }
        if (isEventInsideMindControls(e.target)) {
          clearCustomPointerDragState();
          return;
        }
        var nodeEl = e.target && e.target.closest ? e.target.closest('me-tpc') : null;
        if (!nodeEl || !nodeEl.nodeObj) {
          clearCustomPointerDragState();
          return;
        }
        customPointerDragState.active = true;
        customPointerDragState.moving = false;
        customPointerDragState.pointerId = typeof e.pointerId === 'number' ? e.pointerId : null;
        customPointerDragState.startX = typeof e.clientX === 'number' ? e.clientX : 0;
        customPointerDragState.startY = typeof e.clientY === 'number' ? e.clientY : 0;
        customPointerDragState.previewText = resolvePointerDragPreviewText(nodeEl);
        customPointerDragState.nodeId = nodeEl.nodeObj && nodeEl.nodeObj.id ? String(nodeEl.nodeObj.id) : '';
      }

      function canUsePointerDragPreview(e) {
        if (!customPointerDragState.active) return false;
        if (!e) return false;
        if (customPointerDragState.pointerId !== null && typeof e.pointerId === 'number' && e.pointerId !== customPointerDragState.pointerId) {
          return false;
        }
        if (typeof e.buttons === 'number' && (e.buttons & 1) !== 1) return false;
        if (typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return false;
        return true;
      }

      function syncCustomPointerDragPreview(e) {
        if (!canUsePointerDragPreview(e)) return false;
        var deltaX = Math.abs(e.clientX - customPointerDragState.startX);
        var deltaY = Math.abs(e.clientY - customPointerDragState.startY);
        if (!customPointerDragState.moving) {
          if (deltaX < customPointerDragThreshold && deltaY < customPointerDragThreshold) return false;
          customPointerDragState.moving = true;
        }
        var preview = customPointerDragState.previewText || '拖拽节点';
        showCustomDragGhost(e.clientX, e.clientY, preview);
        return true;
      }

      function ensureCustomDragGhostEl() {
        if (customDragGhostEl && customDragGhostEl.parentNode) return customDragGhostEl;
        if (typeof document === 'undefined' || !document || !document.createElement) return null;
        if (!document.body || !document.body.appendChild) return null;
        var el = document.createElement('div');
        el.className = 'xmind-custom-drag-ghost';
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
        customDragGhostEl = el;
        return customDragGhostEl;
      }

      function updateCustomDragGhostPosition(clientX, clientY) {
        var el = ensureCustomDragGhostEl();
        if (!el) return;
        var x = Number(clientX);
        var y = Number(clientY);
        if (!isFinite(x) || !isFinite(y)) return;
        var offset = 12;
        var left = x + offset;
        var top = y + offset;
        el.style.transform = 'translate(' + left + 'px, ' + top + 'px)';
      }

      function showCustomDragGhost(clientX, clientY, text) {
        var el = ensureCustomDragGhostEl();
        if (!el) return;
        var preview = text === undefined || text === null ? '' : String(text).trim();
        if (!preview) preview = '拖拽节点';
        el.textContent = preview;
        if (el.classList) el.classList.add('is-visible');
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '0.98';
        updateCustomDragGhostPosition(clientX, clientY);
      }

      function hideCustomDragGhost() {
        var el = customDragGhostEl;
        if (!el) return;
        if (el.classList) el.classList.remove('is-visible');
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
        el.style.display = 'none';
      }

      function releaseCustomDragGhost() {
        var el = customDragGhostEl;
        if (!el) return;
        hideCustomDragGhost();
        if (!el.parentNode) {
          customDragGhostEl = null;
          return;
        }
        try {
          el.parentNode.removeChild(el);
        } catch (err0) {
          // ignore
        }
        customDragGhostEl = null;
      }

      function getDragGhostElement(includeHidden) {
        var inst = getInstance();
        var ghost = null;
        var list = inst && Array.isArray(inst.__tapDetachedNodes) ? inst.__tapDetachedNodes : [];
        if (list && list.length) ghost = list[0];
        if (!ghost && typeof document !== 'undefined' && document && document.querySelector) {
          ghost = document.querySelector('.xmind-floating-ghost, .mind-elixir-ghost');
        }
        if (!ghost || !ghost.style) return null;

        if (includeHidden) return ghost;

        var visible = ghost.style.display !== 'none';
        if (!visible && typeof window !== 'undefined' && window && typeof window.getComputedStyle === 'function') {
          try {
            var style = window.getComputedStyle(ghost);
            visible = Boolean(style && style.display !== 'none');
          } catch (err1) {
            visible = false;
          }
        }
        return visible ? ghost : null;
      }

      function setDragGhostPreviewContent(ghost, inst) {
        var previewText = getDraggedPreviewText(inst);
        if (!ghost) return previewText;
        var text = String(ghost.textContent || '').trim();
        if (text) {
          if (ghost.removeAttribute) ghost.removeAttribute('data-drag-placeholder');
          return text;
        }

        var textEl = ghost.querySelector ? ghost.querySelector('.text') : null;
        if (textEl) textEl.textContent = previewText;
        else ghost.textContent = previewText;
        if (ghost.setAttribute) ghost.setAttribute('data-drag-placeholder', '1');
        return previewText;
      }

      function markDragGhostIdle() {
        var ghost = getDragGhostElement(true);
        if (!ghost) return;
        if (ghost.classList) ghost.classList.remove('xmind-floating-ghost-active');
        if (ghost.removeAttribute) ghost.removeAttribute('data-drag-placeholder');
      }

      function resetDragGhostPreview() {
        markDragGhostIdle();
        hideCustomDragGhost();
        clearCustomPointerDragState();
      }

      function syncDragGhostFollowPointer(e) {
        if (!e) return;
        var inst = getInstance();
        var innerDragging = Boolean(inst && inst.dragged && inst.dragged.length);
        var outerDragging = syncCustomPointerDragPreview(e);

        if (!innerDragging && !outerDragging) {
          if (!canUsePointerDragPreview(e)) {
            resetDragGhostPreview();
          }
          return;
        }

        if (innerDragging) {
          if (typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return;
          var previewText = getDraggedPreviewText(inst);
          showCustomDragGhost(e.clientX, e.clientY, previewText);

          var ghost = getDragGhostElement(false);
          if (!ghost) return;
          if (ghost.classList) ghost.classList.add('xmind-floating-ghost-active');
          ghost.style.display = 'block';
          ghost.style.visibility = 'visible';
          ghost.style.opacity = '0.96';
          setDragGhostPreviewContent(ghost, inst);
          var rect = ghost.getBoundingClientRect();
          var offsetX = rect && rect.width > 0 ? (rect.width / 2) : 0;
          var offsetY = rect && rect.height > 0 ? (rect.height / 2) : 0;
          var left = e.clientX - offsetX;
          var top = e.clientY - offsetY;
          ghost.style.transform = 'translate(' + left + 'px, ' + top + 'px)';
        }
      }

      function findNodeWithParentById(rootNode, nodeId, parentNode) {
        if (!rootNode || !nodeId) return null;
        var idText = rootNode.id === undefined || rootNode.id === null ? '' : String(rootNode.id);
        if (idText && idText === String(nodeId)) {
          return {
            node: rootNode,
            parent: parentNode || null,
          };
        }
        var children = Array.isArray(rootNode.children) ? rootNode.children : [];
        for (var i = 0; i < children.length; i += 1) {
          var found = findNodeWithParentById(children[i], nodeId, rootNode);
          if (found) return found;
        }
        return null;
      }

      function applyDirectionToNodeTree(node, directionValue) {
        if (!node) return;
        node.direction = directionValue;
        var children = Array.isArray(node.children) ? node.children : [];
        for (var i = 0; i < children.length; i += 1) {
          applyDirectionToNodeTree(children[i], directionValue);
        }
      }

      function resolveNodeVisualDirection(nodeId, inst, nodeElFallback) {
        var leftDirection = inst && typeof inst.LEFT === 'number' ? inst.LEFT : 0;
        var rightDirection = inst && typeof inst.RIGHT === 'number' ? inst.RIGHT : 1;
        var nodeEl = nodeElFallback || findMindNodeElement(inst, nodeId);
        if (nodeEl && nodeEl.closest) {
          var mainEl = nodeEl.closest('me-main');
          if (mainEl && mainEl.classList) {
            if (mainEl.classList.contains('lhs')) return leftDirection;
            if (mainEl.classList.contains('rhs')) return rightDirection;
          }
        }
        var currentData = getCurrentMindData();
        var found = currentData && currentData.nodeData
          ? findNodeWithParentById(currentData.nodeData, nodeId, null)
          : null;
        if (found && found.node && found.node.direction !== undefined && found.node.direction !== null) {
          return Number(found.node.direction);
        }
        return rightDirection;
      }

      function moveRootNodeAcrossSide(nodeId, pointerClientX) {
        if (!editing || pendingSave) return;
        if (!nodeId) return;
        var inst = getInstance();
        if (!inst || typeof inst.refresh !== 'function') return;
        if (!inst.nodeData) return;
        if (typeof pointerClientX !== 'number' || !isFinite(pointerClientX)) return;
        var rootTopicEl = inst.container && inst.container.querySelector
          ? inst.container.querySelector('me-root > me-tpc')
          : null;
        if (!rootTopicEl || !rootTopicEl.getBoundingClientRect) return;

        var rootRect = rootTopicEl.getBoundingClientRect();
        var rootCenterX = rootRect.left + (rootRect.width / 2);
        var leftDirection = typeof inst.LEFT === 'number' ? inst.LEFT : 0;
        var rightDirection = typeof inst.RIGHT === 'number' ? inst.RIGHT : 1;
        var sideDirection = typeof inst.SIDE === 'number' ? inst.SIDE : 2;
        var nextDirection = pointerClientX < rootCenterX ? leftDirection : rightDirection;

        var currentDirection = resolveNodeVisualDirection(nodeId, inst, null);
        if (Number(currentDirection) === Number(nextDirection)) return;

        var nextData = getCurrentMindData();
        if (!nextData || !nextData.nodeData) return;
        var target = findNodeWithParentById(nextData.nodeData, nodeId, null);
        if (!target || !target.node || !target.parent || target.parent !== nextData.nodeData) return;

        if (typeof inst.initSide === 'function' && Number(inst.direction) !== Number(sideDirection)) {
          try {
            inst.initSide();
          } catch (err0) {
            // ignore
          }
        }

        applyDirectionToNodeTree(target.node, nextDirection);
        applyingHistory = true;
        try {
          inst.refresh(nextData);
        } catch (err1) {
          // ignore
        }
        applyingHistory = false;
        runSearch({ keepIndex: true });
        scheduleRecordSnapshot();
        updateEditButtons();
      }

      function onWindowPointerUpForRootSideSwitch(e) {
        if (!editing || pendingSave) return;
        if (!customPointerDragState.active || !customPointerDragState.moving) return;
        if (
          customPointerDragState.pointerId !== null &&
          e &&
          typeof e.pointerId === 'number' &&
          e.pointerId !== customPointerDragState.pointerId
        ) {
          return;
        }
        var nodeId = customPointerDragState.nodeId ? String(customPointerDragState.nodeId) : '';
        var pointerClientX = Number(e && e.clientX);
        if (!nodeId || !isFinite(pointerClientX)) return;
        setTimeout(function() {
          moveRootNodeAcrossSide(nodeId, pointerClientX);
        }, 0);
      }

      function operationListener(payload) {
        if (!editing || applyingHistory) return;
        var op = payload && payload.name ? String(payload.name) : '';
        if (op === 'beginEdit') {
          syncEditingInputBoxElement();
          var selectionRequest = consumeBeginEditSelectionRequest();
          if (pendingKeyboardNodeEditPayload) {
            scheduleApplyPendingKeyboardNodeEdit();
            return;
          }
          if (selectionRequest.mode === 'point') scheduleInputCaretAtPoint(selectionRequest.point);
          else if (selectionRequest.mode === 'end') scheduleInputCaretToEnd();
          else scheduleInputTextSelection();
          scheduleApplyPendingKeyboardNodeEdit();
          return;
        }
        clearValidationMarks();
        scheduleRecordSnapshot();
        scheduleNodeDecorations();
      }

      initializeHistory();

      if (controlsEl && typeof controlsEl.addEventListener === 'function') {
        controlsEl.addEventListener('click', onControlsClick);
      }
      if (drawerEl && typeof drawerEl.addEventListener === 'function') {
        drawerEl.addEventListener('tap:drawer-fullscreen-change', onDrawerFullscreenChange);
      }
      if (searchInputEl && typeof searchInputEl.addEventListener === 'function') {
        searchInputEl.addEventListener('input', onSearchInput);
        searchInputEl.addEventListener('keydown', onSearchKeydown);
      }
      if (viewerEl && typeof viewerEl.addEventListener === 'function') {
        viewerEl.addEventListener('pointerdown', protectEditingInputBoxMouseEvent, true);
        viewerEl.addEventListener('mousedown', protectEditingInputBoxMouseEvent, true);
        viewerEl.addEventListener('pointerup', protectEditingInputBoxMouseEvent, true);
        viewerEl.addEventListener('mouseup', protectEditingInputBoxMouseEvent, true);
        viewerEl.addEventListener('click', protectEditingInputBoxMouseEvent, true);
        viewerEl.addEventListener('dblclick', protectEditingInputBoxMouseEvent, true);
        viewerEl.addEventListener('pointerdown', beginEditNodePointerSelection, true);
        viewerEl.addEventListener('mousedown', beginEditNodePointerSelection, true);
        viewerEl.addEventListener('pointerup', finishEditNodePointerSelection, true);
        viewerEl.addEventListener('mouseup', finishEditNodePointerSelection, true);
        viewerEl.addEventListener('contextmenu', onViewerContextMenu, true);
        viewerEl.addEventListener('wheel', blockCanvasNativeGesture, { capture: true, passive: false });
        viewerEl.addEventListener('touchstart', blockCanvasNativeGesture, { capture: true, passive: false });
        viewerEl.addEventListener('touchmove', blockCanvasNativeGesture, { capture: true, passive: false });
        viewerEl.addEventListener('gesturestart', blockCanvasNativeGesture, true);
        viewerEl.addEventListener('gesturechange', blockCanvasNativeGesture, true);
        viewerEl.addEventListener('gestureend', blockCanvasNativeGesture, true);
        viewerEl.addEventListener('pointerdown', beginRightDragGestureBlock, true);
        viewerEl.addEventListener('mousedown', onViewerMouseDownGestureGuard, true);
        if (enableCustomBoxSelection) {
          viewerEl.addEventListener('pointerdown', beginModifierNodeSelection, true);
          viewerEl.addEventListener('mousedown', beginModifierNodeSelection, true);
        }
        viewerEl.addEventListener('pointerdown', beginCtrlLeftCanvasDrag, true);
        viewerEl.addEventListener('pointerdown', onViewerPointerDownForDragPreview, true);
        if (enableCustomBoxSelection) {
          viewerEl.addEventListener('pointerdown', startBoxSelection, true);
          viewerEl.addEventListener('mousedown', startBoxSelection, true);
          viewerEl.addEventListener('pointermove', moveBoxSelection, true);
          viewerEl.addEventListener('mousemove', moveBoxSelection, true);
          viewerEl.addEventListener('pointerup', stopBoxSelection, true);
          viewerEl.addEventListener('mouseup', stopBoxSelection, true);
        }
        viewerEl.addEventListener('keydown', onViewerInputBoxEnterKeydown, true);
        viewerEl.addEventListener('keydown', onViewerKeydown, true);
        viewerEl.addEventListener('click', onViewerClick, true);
        viewerEl.addEventListener('dblclick', onViewerDblClick, true);
        viewerEl.addEventListener('blur', onViewerBlur, true);
        viewerEl.addEventListener('input', onViewerInput, true);
        viewerEl.addEventListener('paste', onViewerPaste, true);
      }
      if (enableCustomBoxSelection && typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
        window.addEventListener('pointermove', moveBoxSelection);
        window.addEventListener('pointerup', stopBoxSelection);
        window.addEventListener('pointercancel', stopBoxSelection);
        window.addEventListener('mousemove', moveBoxSelection);
        window.addEventListener('mouseup', stopBoxSelection);
      }
      if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
        window.addEventListener('pagehide', onWindowPageHide);
        window.addEventListener('beforeunload', onWindowPageHide);
        window.addEventListener('pointerdown', onWindowPointerDownForCtrlLeftCanvasDrag, true);
        window.addEventListener('mousedown', onWindowMouseDownForCtrlLeftCanvasDrag, true);
        window.addEventListener('contextmenu', onWindowContextMenu, true);
        window.addEventListener('pointermove', moveRightDragGestureBlock, true);
        window.addEventListener('mousemove', moveRightDragGestureBlock, true);
        window.addEventListener('pointerup', endRightDragGestureBlock, true);
        window.addEventListener('mouseup', endRightDragGestureBlock, true);
        window.addEventListener('pointercancel', endRightDragGestureBlock, true);
        window.addEventListener('pointermove', moveCtrlLeftCanvasDrag, true);
        window.addEventListener('mousemove', moveCtrlLeftCanvasDrag, true);
        window.addEventListener('pointerup', endCtrlLeftCanvasDrag, true);
        window.addEventListener('mouseup', endCtrlLeftCanvasDrag, true);
        window.addEventListener('pointercancel', endCtrlLeftCanvasDrag, true);
        window.addEventListener('keydown', onWindowKeydownForCtrlLeftCanvasDrag, true);
        window.addEventListener('keyup', onWindowKeyupForCtrlLeftCanvasDrag, true);
        window.addEventListener('dragstart', onWindowDragStartWhenRightDragging, true);
        window.addEventListener('selectstart', onWindowSelectStartWhenRightDragging, true);
        window.addEventListener('blur', resetRightDragGestureBlock);
        window.addEventListener('blur', resetCtrlLeftCanvasDrag);
        window.addEventListener('pointermove', syncDragGhostFollowPointer);
        window.addEventListener('mousemove', syncDragGhostFollowPointer);
        window.addEventListener('pointerup', onWindowPointerUpForRootSideSwitch, true);
        window.addEventListener('pointerup', resetDragGhostPreview, true);
        window.addEventListener('mouseup', resetDragGhostPreview, true);
        window.addEventListener('pointercancel', resetDragGhostPreview, true);
      }
      if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
        document.addEventListener('selectionchange', onDocumentSelectionChangeForInputBox);
      }
      if (instance && instance.bus && typeof instance.bus.addListener === 'function') {
        instance.bus.addListener('operation', operationListener);
      }
      if (instance && typeof instance === 'object') {
        instance.__tapViewportInteracted = false;
        instance.__tapSyncZoomMinScale = function() {
          syncZoomMinScaleWithCurrent(getInstance());
        };
        instance.__tapSyncCtrlWheelMinScale = function(forceReset) {
          syncCtrlWheelMinScaleWithCurrent(getInstance(), forceReset === true);
        };
        instance.__tapCaptureViewState = function() {
          return captureMindViewState(getInstance());
        };
        instance.__tapCaptureViewportAnchorState = function() {
          return captureViewportCenterAnchorState(getInstance());
        };
        instance.__tapCaptureDrawerState = function() {
          return captureMindDrawerState(getInstance());
        };
        instance.__tapSetDrawerFullscreen = function(enabled) {
          return setDrawerFullscreen(enabled === true);
        };
      }
      function getDecorationNodeClassName(node) {
        if (!node) return '';
        if (typeof node.className === 'string') return node.className;
        if (node.className && typeof node.className.baseVal === 'string') return node.className.baseVal;
        return '';
      }

      function isManagedDecorationNode(node) {
        var policyCore = getRenderPolicyCore();
        if (!node || Number(node.nodeType) !== 1) return false;
        if (node.matches && node.matches('[data-xmind-casegen-topup-layer]')) return true;
        if (node.closest && node.closest('[data-xmind-casegen-topup-layer]')) return true;
        if (!policyCore || typeof policyCore.isManagedDecorationClassName !== 'function') return false;
        return policyCore.isManagedDecorationClassName(getDecorationNodeClassName(node));
      }

      function isManagedDecorationMutationOnly(mutation) {
        var nodes = [];
        Array.prototype.forEach.call(mutation && mutation.addedNodes ? mutation.addedNodes : [], function(node) {
          nodes.push(node);
        });
        Array.prototype.forEach.call(mutation && mutation.removedNodes ? mutation.removedNodes : [], function(node) {
          nodes.push(node);
        });
        var elementNodes = nodes.filter(function(node) {
          return Boolean(node && Number(node.nodeType) === 1);
        });
        return Boolean(elementNodes.length && elementNodes.every(isManagedDecorationNode));
      }

      function buildNodeDecorationMutationChanges(mutations) {
        return Array.prototype.map.call(mutations || [], function(mutation) {
          return {
            type: mutation && mutation.type ? String(mutation.type || '') : '',
            targetRole: isManagedDecorationNode(mutation && mutation.target ? mutation.target : null) ? 'managed' : 'tree',
            insideManaged: isManagedDecorationNode(mutation && mutation.target ? mutation.target : null),
            managedOnly: isManagedDecorationMutationOnly(mutation),
          };
        });
      }

      function shouldScheduleNodeDecorationsForMutations(mutations) {
        var policyCore = getRenderPolicyCore();
        if (!policyCore || typeof policyCore.shouldScheduleNodeDecorations !== 'function') return true;
        return policyCore.shouldScheduleNodeDecorations(buildNodeDecorationMutationChanges(mutations));
      }

      function observeNodeDecorationMutations() {
        if (!nodeDecorateObserver || !canvasEl || nodeDecorationApplying) return;
        nodeDecorateObserver.observe(canvasEl, { childList: true, subtree: true });
      }

      if (typeof MutationObserver !== 'undefined' && canvasEl) {
        nodeDecorateObserver = new MutationObserver(function(mutations) {
          if (nodeDecorationApplying || !shouldScheduleNodeDecorationsForMutations(mutations)) return;
          syncEditingInputBoxElement();
          scheduleNodeDecorations();
        });
        try {
          observeNodeDecorationMutations();
        } catch (err3) {
          nodeDecorateObserver = null;
        }
      }

      setSearchCount();
      syncInstanceScaleBounds(instance, zoomMinScale);
      updateViewerDragState(viewerEl, instance, false);
      syncFullscreenButtonState();
      scheduleNodeDecorations();

      if (editing) {
        if (instance && typeof instance.enableEdit === 'function') {
          try {
            instance.enableEdit();
          } catch (err) {
            // ignore
          }
        }
        persistEditSession();
      } else if (instance && typeof instance.disableEdit === 'function') {
        try {
          instance.disableEdit();
        } catch (err2) {
          // ignore
        }
      }
      updateEditButtons();

      return function cleanup() {
        // Flush pending snapshots before unbinding to avoid losing the latest unsaved edits.
        flushPendingEditSnapshot();
        var preserveDrawerFullscreen = Boolean(
          instance &&
          instance.__tapPreserveDrawerFullscreenOnDestroy === true
        );
        if (!preserveDrawerFullscreen) {
          setDrawerFullscreen(false);
        }
        if (recordTimer) {
          clearTimeout(recordTimer);
          recordTimer = 0;
        }
        clearSearchFocusRestoreTimer();
        if (nodeDecorateTimer) {
          clearTimeout(nodeDecorateTimer);
          nodeDecorateTimer = 0;
        }
        clearClickNodeEditTimer();
        if (beginEditSelectionResetTimer) {
          clearTimeout(beginEditSelectionResetTimer);
          beginEditSelectionResetTimer = 0;
        }
        beginEditSelectionMode = 'end';
        beginEditCaretPoint = null;
        resetEditInputPointerState();
        cancelScheduledInputSelection();
        clearInputSelectionGuard();
        lastEditingInputBoxEl = null;
        clearPendingKeyboardNodeEdit();
        stopBoxSelection();
        clearSearchClasses();
        clearBoxSelectionClasses();
        clearValidationMarks();
        if (controlsEl && typeof controlsEl.removeEventListener === 'function') {
          controlsEl.removeEventListener('click', onControlsClick);
        }
        if (drawerEl && typeof drawerEl.removeEventListener === 'function') {
          drawerEl.removeEventListener('tap:drawer-fullscreen-change', onDrawerFullscreenChange);
        }
        if (searchInputEl && typeof searchInputEl.removeEventListener === 'function') {
          searchInputEl.removeEventListener('input', onSearchInput);
          searchInputEl.removeEventListener('keydown', onSearchKeydown);
        }
        if (viewerEl && typeof viewerEl.removeEventListener === 'function') {
          viewerEl.removeEventListener('pointerdown', protectEditingInputBoxMouseEvent, true);
          viewerEl.removeEventListener('mousedown', protectEditingInputBoxMouseEvent, true);
          viewerEl.removeEventListener('pointerup', protectEditingInputBoxMouseEvent, true);
          viewerEl.removeEventListener('mouseup', protectEditingInputBoxMouseEvent, true);
          viewerEl.removeEventListener('click', protectEditingInputBoxMouseEvent, true);
          viewerEl.removeEventListener('dblclick', protectEditingInputBoxMouseEvent, true);
          viewerEl.removeEventListener('pointerdown', beginEditNodePointerSelection, true);
          viewerEl.removeEventListener('mousedown', beginEditNodePointerSelection, true);
          viewerEl.removeEventListener('pointerup', finishEditNodePointerSelection, true);
          viewerEl.removeEventListener('mouseup', finishEditNodePointerSelection, true);
          viewerEl.removeEventListener('contextmenu', onViewerContextMenu, true);
          viewerEl.removeEventListener('wheel', blockCanvasNativeGesture, true);
          viewerEl.removeEventListener('touchstart', blockCanvasNativeGesture, true);
          viewerEl.removeEventListener('touchmove', blockCanvasNativeGesture, true);
          viewerEl.removeEventListener('gesturestart', blockCanvasNativeGesture, true);
          viewerEl.removeEventListener('gesturechange', blockCanvasNativeGesture, true);
          viewerEl.removeEventListener('gestureend', blockCanvasNativeGesture, true);
          viewerEl.removeEventListener('pointerdown', beginRightDragGestureBlock, true);
          viewerEl.removeEventListener('mousedown', onViewerMouseDownGestureGuard, true);
          if (enableCustomBoxSelection) {
            viewerEl.removeEventListener('pointerdown', beginModifierNodeSelection, true);
            viewerEl.removeEventListener('mousedown', beginModifierNodeSelection, true);
          }
          viewerEl.removeEventListener('pointerdown', beginCtrlLeftCanvasDrag, true);
          viewerEl.removeEventListener('pointerdown', onViewerPointerDownForDragPreview, true);
          if (enableCustomBoxSelection) {
            viewerEl.removeEventListener('pointerdown', startBoxSelection, true);
            viewerEl.removeEventListener('mousedown', startBoxSelection, true);
            viewerEl.removeEventListener('pointermove', moveBoxSelection, true);
            viewerEl.removeEventListener('mousemove', moveBoxSelection, true);
            viewerEl.removeEventListener('pointerup', stopBoxSelection, true);
            viewerEl.removeEventListener('mouseup', stopBoxSelection, true);
          }
          viewerEl.removeEventListener('keydown', onViewerInputBoxEnterKeydown, true);
          viewerEl.removeEventListener('keydown', onViewerKeydown, true);
          viewerEl.removeEventListener('click', onViewerClick, true);
          viewerEl.removeEventListener('dblclick', onViewerDblClick, true);
          viewerEl.removeEventListener('blur', onViewerBlur, true);
          viewerEl.removeEventListener('input', onViewerInput, true);
          viewerEl.removeEventListener('paste', onViewerPaste, true);
        }
        if (enableCustomBoxSelection && typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function') {
          window.removeEventListener('pointermove', moveBoxSelection);
          window.removeEventListener('pointerup', stopBoxSelection);
          window.removeEventListener('pointercancel', stopBoxSelection);
          window.removeEventListener('mousemove', moveBoxSelection);
          window.removeEventListener('mouseup', stopBoxSelection);
        }
        if (typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function') {
          window.removeEventListener('pagehide', onWindowPageHide);
          window.removeEventListener('beforeunload', onWindowPageHide);
          window.removeEventListener('pointerdown', onWindowPointerDownForCtrlLeftCanvasDrag, true);
          window.removeEventListener('mousedown', onWindowMouseDownForCtrlLeftCanvasDrag, true);
          window.removeEventListener('contextmenu', onWindowContextMenu, true);
          window.removeEventListener('pointermove', moveRightDragGestureBlock, true);
          window.removeEventListener('mousemove', moveRightDragGestureBlock, true);
          window.removeEventListener('pointerup', endRightDragGestureBlock, true);
          window.removeEventListener('mouseup', endRightDragGestureBlock, true);
          window.removeEventListener('pointercancel', endRightDragGestureBlock, true);
          window.removeEventListener('pointermove', moveCtrlLeftCanvasDrag, true);
          window.removeEventListener('mousemove', moveCtrlLeftCanvasDrag, true);
          window.removeEventListener('pointerup', endCtrlLeftCanvasDrag, true);
          window.removeEventListener('mouseup', endCtrlLeftCanvasDrag, true);
          window.removeEventListener('pointercancel', endCtrlLeftCanvasDrag, true);
          window.removeEventListener('keydown', onWindowKeydownForCtrlLeftCanvasDrag, true);
          window.removeEventListener('keyup', onWindowKeyupForCtrlLeftCanvasDrag, true);
          window.removeEventListener('dragstart', onWindowDragStartWhenRightDragging, true);
          window.removeEventListener('selectstart', onWindowSelectStartWhenRightDragging, true);
          window.removeEventListener('blur', resetRightDragGestureBlock);
          window.removeEventListener('blur', resetCtrlLeftCanvasDrag);
          window.removeEventListener('pointermove', syncDragGhostFollowPointer);
          window.removeEventListener('mousemove', syncDragGhostFollowPointer);
          window.removeEventListener('pointerup', onWindowPointerUpForRootSideSwitch, true);
          window.removeEventListener('pointerup', resetDragGhostPreview, true);
          window.removeEventListener('mouseup', resetDragGhostPreview, true);
          window.removeEventListener('pointercancel', resetDragGhostPreview, true);
        }
        if (typeof document !== 'undefined' && document && typeof document.removeEventListener === 'function') {
          document.removeEventListener('selectionchange', onDocumentSelectionChangeForInputBox);
        }
        if (instance && instance.bus && typeof instance.bus.removeListener === 'function') {
          instance.bus.removeListener('operation', operationListener);
        }
        if (instance && typeof instance === 'object') {
          try {
            delete instance.__tapPreserveDrawerFullscreenOnDestroy;
          } catch (err4a) {
            instance.__tapPreserveDrawerFullscreenOnDestroy = null;
          }
          try {
            delete instance.__tapSyncZoomMinScale;
          } catch (err4) {
            instance.__tapSyncZoomMinScale = null;
          }
          try {
            delete instance.__tapSyncCtrlWheelMinScale;
          } catch (err4b) {
            instance.__tapSyncCtrlWheelMinScale = null;
          }
          try {
            delete instance.__tapCaptureViewState;
          } catch (err4c) {
            instance.__tapCaptureViewState = null;
          }
          try {
            delete instance.__tapCaptureDrawerState;
          } catch (err4d) {
            instance.__tapCaptureDrawerState = null;
          }
          try {
            delete instance.__tapSetDrawerFullscreen;
          } catch (err4e) {
            instance.__tapSetDrawerFullscreen = null;
          }
          try {
            delete instance.__tapViewportInteracted;
          } catch (err4f) {
            instance.__tapViewportInteracted = null;
          }
        }
        if (nodeDecorateObserver && typeof nodeDecorateObserver.disconnect === 'function') {
          nodeDecorateObserver.disconnect();
          nodeDecorateObserver = null;
        }
        if (boxRectEl && boxRectEl.parentNode) {
          boxRectEl.parentNode.removeChild(boxRectEl);
        }
        boxRectEl = null;
        if (nodeContextMenuEl) {
          if (typeof nodeContextMenuEl.removeEventListener === 'function') {
            nodeContextMenuEl.removeEventListener('mousedown', onNodeContextMenuMouseDown, true);
            nodeContextMenuEl.removeEventListener('click', onNodeContextMenuClick);
          }
          if (nodeContextMenuEl.parentNode) {
            nodeContextMenuEl.parentNode.removeChild(nodeContextMenuEl);
          }
          nodeContextMenuEl = null;
        }
        if (activeContextMenuHider === hideNodeContextMenu) {
          activeContextMenuHider = function() {};
        }
        resetRightDragGestureBlock();
        resetCtrlLeftCanvasDrag();
        resetModifierSelectionPointerGuard();
        releaseCustomDragGhost();
      };
    }

    function destroyMindMap(instance) {
      if (!instance) return;
      var cleanups = Array.isArray(instance.__tapXmindCleanupList) ? instance.__tapXmindCleanupList : [];
      cleanups.forEach(function(fn) {
        if (typeof fn !== 'function') return;
        try {
          fn();
        } catch (err) {
          // ignore
        }
      });
      instance.__tapXmindCleanupList = [];
      var detachedNodes = Array.isArray(instance.__tapDetachedNodes) ? instance.__tapDetachedNodes : [];
      detachedNodes.forEach(function(node) {
        if (!node || !node.parentNode) return;
        try {
          node.parentNode.removeChild(node);
        } catch (err0) {
          // ignore
        }
      });
      instance.__tapDetachedNodes = [];
      if (typeof instance.destroy !== 'function') return;
      try {
        instance.destroy();
      } catch (err) {
        // ignore
      }
    }

    function captureMindViewState(instance) {
      if (!instance || !instance.map || !instance.container) return null;
      var transform = '';
      if (instance.map.style && instance.map.style.transform) {
        transform = String(instance.map.style.transform || '');
      }
      return {
        transform: transform,
        scaleVal: resolveScale(instance),
        scrollLeft: Number(instance.container.scrollLeft || 0),
        scrollTop: Number(instance.container.scrollTop || 0),
      };
    }

    function resolveMindAnchorElement(nodeEl) {
      if (!nodeEl) return null;
      if (nodeEl.querySelector) {
        var topicText = nodeEl.querySelector('.text');
        if (topicText && topicText.getBoundingClientRect) {
          return topicText;
        }
      }
      return nodeEl && nodeEl.getBoundingClientRect ? nodeEl : null;
    }

    function parseMindTransformState(transformText) {
      var text = transformText === undefined || transformText === null ? '' : String(transformText);
      var translateMatch = text.match(/translate3d\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*,\s*[^)]*\)/i);
      if (!translateMatch) {
        translateMatch = text.match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/i);
      }
      var scaleMatch = text.match(/scale\(\s*(-?\d+(?:\.\d+)?)\s*\)/i);
      return {
        x: translateMatch ? Number(translateMatch[1] || 0) : 0,
        y: translateMatch ? Number(translateMatch[2] || 0) : 0,
        scale: scaleMatch ? Number(scaleMatch[1] || 1) : 1,
      };
    }

    function writeMindTransformState(instance, transformState) {
      if (!instance || !instance.map || !instance.map.style || !transformState) return false;
      var scaleVal = Number(transformState.scale);
      if (!isFinite(scaleVal) || scaleVal <= 0) {
        scaleVal = resolveScale(instance);
      }
      if (!isFinite(scaleVal) || scaleVal <= 0) scaleVal = 1;
      var x = Number(transformState.x);
      var y = Number(transformState.y);
      if (!isFinite(x)) x = 0;
      if (!isFinite(y)) y = 0;
      instance.map.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0px) scale(' + scaleVal + ')';
      return true;
    }

    function captureMindAnchorState(instance, anchorNodeId) {
      if (!instance || !anchorNodeId) return null;
      var nodeEl = findMindNodeElement(instance, anchorNodeId);
      var anchorEl = resolveMindAnchorElement(nodeEl);
      if (!anchorEl || !anchorEl.getBoundingClientRect) return null;
      var nodeRect = anchorEl.getBoundingClientRect();
      return {
        nodeId: String(anchorNodeId),
        centerX: Number(nodeRect.left + (nodeRect.width / 2)),
        centerY: Number(nodeRect.top + (nodeRect.height / 2)),
      };
    }

    function captureViewportCenterAnchorState(instance) {
      if (!instance) return null;
      var viewerEl = instance.el && instance.el.getBoundingClientRect
        ? instance.el
        : (instance.container && instance.container.getBoundingClientRect ? instance.container : null);
      if (!viewerEl || !viewerEl.getBoundingClientRect || !viewerEl.querySelectorAll) return null;
      var viewerRect = viewerEl.getBoundingClientRect();
      var viewerCenterX = Number(viewerRect.left + (viewerRect.width / 2));
      var viewerCenterY = Number(viewerRect.top + (viewerRect.height / 2));
      if (!isFinite(viewerCenterX) || !isFinite(viewerCenterY)) return null;
      var nodeEls = viewerEl.querySelectorAll('me-tpc');
      var best = null;
      Array.prototype.forEach.call(nodeEls, function(nodeEl) {
        if (!nodeEl || !nodeEl.nodeObj || nodeEl.nodeObj.id === undefined || nodeEl.nodeObj.id === null) return;
        var anchorEl = resolveMindAnchorElement(nodeEl);
        if (!anchorEl || !anchorEl.getBoundingClientRect) return;
        var rect = anchorEl.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        var centerX = Number(rect.left + (rect.width / 2));
        var centerY = Number(rect.top + (rect.height / 2));
        if (!isFinite(centerX) || !isFinite(centerY)) return;
        var dx = centerX - viewerCenterX;
        var dy = centerY - viewerCenterY;
        var distance = Math.sqrt((dx * dx) + (dy * dy));
        if (!best || distance < best.distance) {
          best = {
            nodeId: String(nodeEl.nodeObj.id),
            centerX: centerX,
            centerY: centerY,
            distance: distance,
          };
        }
      });
      if (!best || !best.nodeId) return null;
      return {
        nodeId: best.nodeId,
        centerX: best.centerX,
        centerY: best.centerY,
      };
    }

    function captureMindDrawerState(instance) {
      if (!instance || !instance.container || typeof instance.container.closest !== 'function') return null;
      var drawerEl = instance.container.closest('.drawer');
      if (!drawerEl || !drawerEl.classList) return null;
      return {
        fullscreen: Boolean(
          drawerFullscreenPort &&
          typeof drawerFullscreenPort.is === 'function' &&
          drawerFullscreenPort.is(drawerEl)
        ),
      };
    }

    function restoreMindViewState(instance, viewState) {
      if (!instance || !instance.map || !instance.container || !viewState) return false;
      if (instance.container) {
        instance.container.scrollLeft = Number(viewState.scrollLeft || 0);
        instance.container.scrollTop = Number(viewState.scrollTop || 0);
      }
      if (viewState.transform && instance.map.style) {
        instance.map.style.transform = String(viewState.transform);
      }
      var scaleVal = Number(viewState.scaleVal);
      if (isFinite(scaleVal) && scaleVal > 0) {
        instance.scaleVal = scaleVal;
      }
      if (typeof instance.__tapSyncZoomMinScale === 'function') {
        instance.__tapSyncZoomMinScale();
      }
      if (typeof instance.__tapSyncCtrlWheelMinScale === 'function') {
        instance.__tapSyncCtrlWheelMinScale(true);
      }
      return true;
    }

    function restoreMindAnchorState(instance, anchorState) {
      if (!instance || !anchorState || !anchorState.nodeId) {
        return false;
      }
      var nodeEl = findMindNodeElement(instance, anchorState.nodeId);
      var anchorEl = resolveMindAnchorElement(nodeEl);
      if (!anchorEl || !anchorEl.getBoundingClientRect) return false;
      var nodeRect = anchorEl.getBoundingClientRect();
      var currentCenterX = Number(nodeRect.left + (nodeRect.width / 2));
      var currentCenterY = Number(nodeRect.top + (nodeRect.height / 2));
      var desiredCenterX = Number(anchorState.centerX);
      var desiredCenterY = Number(anchorState.centerY);
      if (!isFinite(currentCenterX) || !isFinite(currentCenterY) || !isFinite(desiredCenterX) || !isFinite(desiredCenterY)) {
        return false;
      }
      var deltaX = desiredCenterX - currentCenterX;
      var deltaY = desiredCenterY - currentCenterY;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
      var transformState = parseMindTransformState(instance.map && instance.map.style ? instance.map.style.transform : '');
      transformState.x += deltaX;
      transformState.y += deltaY;
      return writeMindTransformState(instance, transformState);
    }

    function scheduleMindViewRestore(instance, viewState, anchorState, options) {
      if (!instance || !viewState) return;
      var forceRestore = Boolean(options && options.force === true);
      var shouldRestoreAnchor = !(viewState && viewState.skipAnchorAlign === true) && Boolean(anchorState);
      [0, 16, 48, 96, 180, 320, 520].forEach(function(delayMs) {
        setTimeout(function() {
          if (!isActiveMindRenderInstance(instance)) return;
          if (!forceRestore && delayMs > 0 && instance.__tapViewportInteracted === true) return;
          restoreMindViewState(instance, viewState);
          if (shouldRestoreAnchor) {
            restoreMindAnchorState(instance, anchorState);
          }
        }, delayMs);
      });
    }

    function scheduleMindAnchorRestore(instance, anchorState) {
      if (!instance || !anchorState) return;
      [0, 16, 48, 96, 180, 320, 520, 760, 1080].forEach(function(delayMs) {
        setTimeout(function() {
          if (!isActiveMindRenderInstance(instance)) return;
          if (delayMs > 0 && instance.__tapViewportInteracted === true) return;
          restoreMindAnchorState(instance, anchorState);
        }, delayMs);
      });
    }

    function isActiveMindRenderInstance(instance) {
      if (!instance || !instance.map || !instance.el || !instance.el.isConnected) return false;
      var host = instance.__tapHostContainer || null;
      var token = instance.__tapRenderSessionToken ? String(instance.__tapRenderSessionToken || '') : '';
      if (host && token) {
        var activeToken = host.__tapActiveMindRenderToken ? String(host.__tapActiveMindRenderToken || '') : '';
        if (activeToken && activeToken !== token) return false;
      }
      return true;
    }

    function centerMindNode(instance, nodeId) {
      if (!instance || !nodeId || !instance.map) {
        return false;
      }
      var nodeEl = findMindNodeElement(instance, nodeId);
      var anchorEl = resolveMindAnchorElement(nodeEl);
      if (!anchorEl || !anchorEl.getBoundingClientRect) return false;
      var viewerEl = instance.el && instance.el.getBoundingClientRect
        ? instance.el
        : (instance.container && instance.container.getBoundingClientRect ? instance.container : null);
      if (!viewerEl || !viewerEl.getBoundingClientRect) return false;
      var nodeRect = anchorEl.getBoundingClientRect();
      var viewerRect = viewerEl.getBoundingClientRect();
      var currentCenterX = Number(nodeRect.left + (nodeRect.width / 2));
      var currentCenterY = Number(nodeRect.top + (nodeRect.height / 2));
      var desiredCenterX = Number(viewerRect.left + (viewerRect.width / 2));
      var desiredCenterY = Number(viewerRect.top + (viewerRect.height / 2));
      if (!isFinite(currentCenterX) || !isFinite(currentCenterY) || !isFinite(desiredCenterX) || !isFinite(desiredCenterY)) {
        return false;
      }
      var deltaX = desiredCenterX - currentCenterX;
      var deltaY = desiredCenterY - currentCenterY;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
      var transformState = parseMindTransformState(instance.map && instance.map.style ? instance.map.style.transform : '');
      transformState.x += deltaX;
      transformState.y += deltaY;
      return writeMindTransformState(instance, transformState);
    }

    function renderMindMap(container, mindData, options) {
      var opts = options || {};
      var ctor = getMindCtor();
      if (!ctor) throw new Error('MindElixir 依赖未就绪');
      if (!container) throw new Error('缺少思维导图容器');
      if (!mindData || !mindData.nodeData) throw new Error('缺少思维导图数据');

      var preservedViewState = opts && opts.preserveViewState === true
        ? captureMindViewState(opts.instance || null)
        : null;
      var preservedAnchorState = opts && opts.preserveViewState === true && opts.preserveAnchorNodeId
        ? captureMindAnchorState(opts.instance || null, opts.preserveAnchorNodeId)
        : null;
      var preservedAutoAnchorState = !preservedAnchorState && opts && opts.preserveViewState === true && opts.preserveAutoAnchor === true
        ? captureViewportCenterAnchorState(opts.instance || null)
        : null;
      var effectivePreservedAnchorState = preservedAnchorState || preservedAutoAnchorState;
      var preservedDrawerState = opts && opts.preserveViewState === true
        ? captureMindDrawerState(opts.instance || null)
        : null;
      var explicitInitialViewState = opts && opts.initialViewState && typeof opts.initialViewState === 'object'
        ? opts.initialViewState
        : null;
      var explicitInitialAnchorState = explicitInitialViewState && explicitInitialViewState.skipAnchorAlign === true
        ? null
        : (explicitInitialViewState && explicitInitialViewState.anchorState
        ? explicitInitialViewState.anchorState
        : (opts && opts.initialAnchorState && typeof opts.initialAnchorState === 'object'
          ? opts.initialAnchorState
          : null));
      var explicitInitialDrawerState = opts && opts.initialDrawerState && typeof opts.initialDrawerState === 'object'
        ? opts.initialDrawerState
        : null;
      if (
        opts &&
        opts.instance &&
        preservedDrawerState &&
        preservedDrawerState.fullscreen === true
      ) {
        opts.instance.__tapPreserveDrawerFullscreenOnDestroy = true;
      }
      destroyMindMap(opts.instance || null);
      container.innerHTML = '';

      var allowEdit = !(opts && opts.allowEdit === false);
      var exportEnabled = Boolean(opts && typeof opts.onExportXmind === 'function');
      var exportDisabledAttr = exportEnabled ? '' : ' disabled';
      var editGroupClass = allowEdit ? 'xmind-edit-group' : 'xmind-edit-group is-disabled';
      var controlsHtml = ''
        + '<div class="xmind-structure-controls" data-mind-controls>'
        + '<div class="xmind-controls-leading">'
        + '<div class="xmind-controls-leading-host" data-mind-leading-host></div>'
        + '</div>'
        + '<div class="xmind-controls-trailing">'
        + '<div class="xmind-controls-utility-host" data-mind-utility-host></div>'
        + '<div class="xmind-search-group">'
        + '<input class="xmind-search-input" type="search" data-mind-search-input placeholder="搜索节点内容" aria-label="搜索节点内容" />'
        + '<span class="xmind-search-count is-empty" data-mind-search-count>0/0</span>'
        + '<button class="secondary xmind-search-btn" type="button" data-mind-action="search-prev" title="上一个">↑</button>'
        + '<button class="secondary xmind-search-btn" type="button" data-mind-action="search-next" title="下一个">↓</button>'
        + '<button class="secondary xmind-search-btn" type="button" data-mind-action="search-clear" title="清空搜索">清空</button>'
        + '</div>'
        + '<div class="xmind-action-group">'
        + '<div class="xmind-zoom-group">'
        + '<button class="secondary xmind-zoom-btn" type="button" data-mind-action="zoom-out" title="缩小">-</button>'
        + '<button class="secondary xmind-zoom-btn" type="button" data-mind-action="zoom-fit" title="全览">全览</button>'
        + '<button class="secondary xmind-zoom-btn" type="button" data-mind-action="zoom-in" title="放大">+</button>'
        + '<button class="secondary xmind-zoom-btn xmind-fullscreen-btn" type="button" data-mind-action="drawer-fullscreen" title="全屏" aria-pressed="false">全屏</button>'
        + '<button class="secondary xmind-zoom-btn xmind-export-btn" type="button" data-mind-action="export-xmind" title="导出当前XMind"' + exportDisabledAttr + '>导出XMind</button>'
        + '</div>'
        + '<div class="' + editGroupClass + '">'
        + '<button class="secondary xmind-edit-btn" type="button" data-mind-action="edit-enter">编辑</button>'
        + '<button class="secondary xmind-edit-btn hidden" type="button" data-mind-action="edit-cancel">取消</button>'
        + '<button class="secondary xmind-edit-btn hidden" type="button" data-mind-action="edit-save">确认保存</button>'
        + '<button class="secondary xmind-edit-op-btn hidden" type="button" data-mind-action="node-add" disabled>增加节点</button>'
        + '<button class="secondary xmind-edit-op-btn hidden" type="button" data-mind-action="node-delete" disabled>删除节点</button>'
        + '<button class="secondary xmind-edit-op-btn hidden" type="button" data-mind-action="undo" disabled>撤回改动</button>'
        + '<button class="secondary xmind-edit-op-btn hidden" type="button" data-mind-action="redo" disabled>恢复改动</button>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
      var canvasHtml = '<div class="xmind-structure-canvas" data-mind-canvas></div>';
      container.innerHTML = controlsHtml + canvasHtml;
      var canvasEl = container.querySelector('[data-mind-canvas]');
      if (!canvasEl) throw new Error('思维导图画布初始化失败');

      var sessionKey = opts && opts.editableSessionKey ? String(opts.editableSessionKey) : '';
      var restoredSession = sessionKey ? readMindEditSession(sessionKey) : null;
      var restoredCurrent = restoredSession && restoredSession.currentData && restoredSession.currentData.nodeData
        ? cloneMindDataObject(restoredSession.currentData)
        : null;
      var initialMindData = restoredCurrent || cloneMindDataObject(mindData) || mindData;
      var restoredEditing = Boolean(restoredSession && restoredSession.editing === true && restoredCurrent && restoredCurrent.nodeData);
      var forcedEditing = Boolean(opts && opts.initialEditing === true && initialMindData && initialMindData.nodeData);
      var initialEditing = Boolean(allowEdit && (restoredEditing || forcedEditing));
      var restoreCurrentSignature = buildMindDataSignature(restoredCurrent);
      var restoreNoticeSignature = restoredSession && restoredSession.restoreNoticeSignature
        ? String(restoredSession.restoreNoticeSignature)
        : '';
      var showRestoreNotice = Boolean(
        restoredEditing &&
        restoreCurrentSignature &&
        restoreCurrentSignature !== restoreNoticeSignature &&
        !(opts && opts.showRestoreNotice === false)
      );
      var restoreNoticeSignatureForSession = showRestoreNotice ? restoreCurrentSignature : restoreNoticeSignature;
      var baseMindData = restoredSession && restoredSession.baseData && restoredSession.baseData.nodeData
        ? cloneMindDataObject(restoredSession.baseData)
        : cloneMindDataObject(mindData);
      var initialCenterNodeId = opts && opts.initialCenterNodeId ? String(opts.initialCenterNodeId) : '';
      var eagerInitialCenter = Boolean(opts && opts.eagerInitialCenter === true && initialCenterNodeId);
      var disableDeferredInitialCenterRetry = Boolean(opts && opts.disableDeferredInitialCenterRetry === true && initialCenterNodeId);
      var renderSessionToken = 'mind-render-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

      var darkMode = typeof opts.darkMode === 'boolean' ? opts.darkMode : resolveDarkMode();
      var theme = buildTheme(darkMode);
      var direction = normalizeDirection(opts.direction, ctor);
      var instance = new ctor({
        el: canvasEl,
        direction: direction,
        editable: true,
        contextMenu: false,
        toolBar: false,
        keypress: true,
        selectionContainer: (typeof document !== 'undefined' && document && document.body) ? document.body : undefined,
        mouseSelectionButton: 0,
        allowUndo: true,
        overflowHidden: false,
        alignment: 'nodes',
        theme: theme || undefined,
      });
      container.__tapActiveMindRenderToken = renderSessionToken;
      instance.__tapRenderSessionToken = renderSessionToken;
      instance.__tapHostContainer = container;
      instance.newTopicName = '';
      instance.init({
        nodeData: initialMindData.nodeData,
        direction: direction,
      });
      detachMindDragGhost(instance);
      if (initialEditing) {
        if (typeof instance.enableEdit === 'function') {
          try {
            instance.enableEdit();
          } catch (err0) {
            // ignore
          }
        }
      } else if (typeof instance.disableEdit === 'function') {
        try {
          instance.disableEdit();
        } catch (err1) {
          // ignore
        }
      }

      var cleanup = bindViewerInteractions(container, canvasEl, instance, Object.assign({}, opts, {
        direction: direction,
        allowEdit: allowEdit,
        editableSessionKey: sessionKey,
        restoredSession: restoredSession,
        restoreNoticeSignature: restoreNoticeSignatureForSession,
        initialEditing: initialEditing,
        initialMindData: cloneMindDataObject(initialMindData),
        baseMindData: cloneMindDataObject(baseMindData),
      }));
      if (cleanup) {
        instance.__tapXmindCleanupList = [cleanup];
      } else {
        instance.__tapXmindCleanupList = [];
      }

      if (opts && typeof opts.onInstanceChange === 'function') {
        try {
          opts.onInstanceChange(instance);
        } catch (err2) {
          // ignore
        }
      }
      instance.getSelectedNodeMetas = function() {
        return collectSelectedNodeMetas();
      };

      var restoredViewState = false;
      if (preservedViewState && !initialEditing) {
        restoredViewState = restoreMindViewState(instance, preservedViewState);
        if (effectivePreservedAnchorState) {
          restoreMindAnchorState(instance, effectivePreservedAnchorState);
        }
        scheduleMindViewRestore(instance, preservedViewState, effectivePreservedAnchorState);
        if (effectivePreservedAnchorState) {
          scheduleMindAnchorRestore(instance, effectivePreservedAnchorState);
        }
      } else if (explicitInitialViewState && !initialEditing) {
        restoredViewState = restoreMindViewState(instance, explicitInitialViewState);
        if (explicitInitialAnchorState) {
          restoreMindAnchorState(instance, explicitInitialAnchorState);
        }
        scheduleMindViewRestore(instance, explicitInitialViewState, explicitInitialAnchorState);
        if (explicitInitialAnchorState) {
          scheduleMindAnchorRestore(instance, explicitInitialAnchorState);
        }
      }
      if (
        explicitInitialDrawerState
        && explicitInitialDrawerState.fullscreen === true
        && instance
        && typeof instance.__tapSetDrawerFullscreen === 'function'
      ) {
        instance.__tapSetDrawerFullscreen(true);
      }
      if (showRestoreNotice) {
        setTimeout(function() {
          var restoreMsg = '检测到上次未保存的内容编辑，已进行恢复，请继续完成编辑。';
          if (sessionKey && restoreNoticeSignatureForSession) {
            writeMindEditSession(sessionKey, Object.assign({}, restoredSession || {}, {
              restoreNoticeSignature: restoreNoticeSignatureForSession,
              restoreNoticeAt: Date.now(),
            }));
          }
          if (opts && typeof opts.showToast === 'function') {
            opts.showToast(restoreMsg, 'warn', 3000);
            return;
          }
          showMindToast(restoreMsg, 'warn', 3000);
        }, 0);
      }

      var initialAutoFitScale = 0;
      function runAutoScaleFitIfStable(forceRun) {
        if (!isActiveMindRenderInstance(instance) || typeof instance.scaleFit !== 'function') return false;
        if (!forceRun) {
          var current = resolveScale(instance);
          if (initialAutoFitScale > 0 && Math.abs(current - initialAutoFitScale) > 0.03) {
            return false;
          }
        }
        try {
          instance.scaleFit();
          if (typeof instance.__tapSyncZoomMinScale === 'function') {
            instance.__tapSyncZoomMinScale();
          }
          if (typeof instance.__tapSyncCtrlWheelMinScale === 'function') {
            instance.__tapSyncCtrlWheelMinScale(true);
          }
          initialAutoFitScale = resolveScale(instance);
          updateViewerDragState(container, instance, false);
          return true;
        } catch (err3) {
          // ignore
        }
        return false;
      }

      if (eagerInitialCenter && !initialEditing && !restoredViewState && isActiveMindRenderInstance(instance)) {
        runAutoScaleFitIfStable(true);
        centerMindNode(instance, initialCenterNodeId);
      }

      setTimeout(function() {
        if (!isActiveMindRenderInstance(instance)) return;
        if (initialEditing) {
          updateViewerDragState(container, instance, false);
          return;
        }
        if (restoredViewState) {
          updateViewerDragState(container, instance, false);
          return;
        }
        if (instance && instance.__tapViewportInteracted === true) {
          updateViewerDragState(container, instance, false);
          return;
        }
        runAutoScaleFitIfStable(true);
        if (initialCenterNodeId) {
          centerMindNode(instance, initialCenterNodeId);
        }
      }, 0);

      setTimeout(function() {
        if (!isActiveMindRenderInstance(instance)) return;
        if (initialEditing || restoredViewState) return;
        if (instance && instance.__tapViewportInteracted === true) return;
        if (disableDeferredInitialCenterRetry) return;
        runAutoScaleFitIfStable(false);
        if (initialCenterNodeId) {
          centerMindNode(instance, initialCenterNodeId);
        }
      }, 420);
      return instance;
    }

    function refreshMindTheme(instance, darkMode) {
      var ctor = getMindCtor();
      if (!instance || !ctor || typeof instance.changeTheme !== 'function') return false;
      var resolvedDark = typeof darkMode === 'boolean' ? darkMode : resolveDarkMode();
      var nextTheme = buildTheme(resolvedDark);
      if (!nextTheme) return false;
      try {
        instance.changeTheme(nextTheme, true);
        var detachedNodes = Array.isArray(instance.__tapDetachedNodes) ? instance.__tapDetachedNodes : [];
        detachedNodes.forEach(function(node) {
          syncDetachedGhostTheme(node, instance);
        });
        return true;
      } catch (err) {
        return false;
      }
    }

    return {
      getMindCtor: getMindCtor,
      resolveDarkMode: resolveDarkMode,
      buildPathsFromCases: buildPathsFromCases,
      buildMindDataFromCases: buildMindDataFromCases,
      buildMindDataFromPaths: buildMindDataFromPaths,
      centerMindNode: centerMindNode,
      renderMindMap: renderMindMap,
      hideOpenContextMenu: hideOpenContextMenu,
      refreshMindTheme: refreshMindTheme,
      destroyMindMap: destroyMindMap,
    };
  }

  window.app = window.app || {};
  window.app.mindElixirCore = { init: init };
})();
