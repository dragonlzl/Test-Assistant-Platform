(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.xmindModel = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var normalizePriority = typeof opts.normalizePriority === 'function'
      ? opts.normalizePriority
      : function(value) { return normalizeText(value); };
    var cleanFileName = typeof opts.cleanFileName === 'function'
      ? opts.cleanFileName
      : function(value) { return normalizeText(value); };
    var buildImportItems = typeof opts.buildImportItems === 'function'
      ? opts.buildImportItems
      : function(items) { return Array.isArray(items) ? items : []; };

    function normalizeText(value) {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    }

    function normalizeCase(item) {
      var row = item && typeof item === 'object' ? item : {};
      var precondition = normalizeText(row.preconditions || row.precondition || row['前提条件']);
      return {
        module: normalizeText(row.module || row.module_name || row['模块']),
        title: normalizeText(row.title || row.case_title || row['用例标题']),
        priority: normalizeText(row.priority || row.level || row['优先级']) || 'P1',
        precondition: precondition,
        preconditions: precondition,
        steps: normalizeText(row.steps || row.actions || row['操作步骤']),
        expected: normalizeText(row.expected || row.result || row['预期结果']),
      };
    }

    function buildStrictKey(item) {
      var row = normalizeCase(item || {});
      return [row.module, row.title, row.priority, row.precondition, row.steps, row.expected]
        .map(function(segment) { return normalizeText(segment).toLowerCase(); })
        .join('::');
    }

    function buildLooseKey(item) {
      var row = normalizeCase(item || {});
      return [row.module, row.title, row.expected]
        .map(function(segment) { return normalizeText(segment).toLowerCase(); })
        .join('::');
    }

    function isStructSame(previous, next) {
      var left = normalizeCase(previous || {});
      var right = normalizeCase(next || {});
      return left.module === right.module
        && left.title === right.title
        && left.priority === right.priority
        && left.precondition === right.precondition
        && left.steps === right.steps
        && left.expected === right.expected;
    }

    function buildPatchDiff(existingItems, nextCases) {
      var oldSlots = (Array.isArray(existingItems) ? existingItems : []).map(function(item, index) {
        return { index: index, item: item, normalized: normalizeCase(item), matched: false };
      });
      var nextSlots = (Array.isArray(nextCases) ? nextCases : []).map(function(item, index) {
        return { index: index, normalized: normalizeCase(item), matchedOld: null };
      });

      function matchBy(keyBuilder) {
        nextSlots.forEach(function(nextSlot) {
          if (nextSlot.matchedOld) return;
          var targetKey = keyBuilder(nextSlot.normalized);
          for (var i = 0; i < oldSlots.length; i += 1) {
            var oldSlot = oldSlots[i];
            if (oldSlot.matched || keyBuilder(oldSlot.normalized) !== targetKey) continue;
            oldSlot.matched = true;
            nextSlot.matchedOld = oldSlot;
            break;
          }
        });
      }

      matchBy(buildStrictKey);
      matchBy(buildLooseKey);

      var updates = [];
      var creates = [];
      var deletes = [];
      nextSlots.forEach(function(nextSlot) {
        var normalized = nextSlot.normalized;
        var payload = {
          module: normalized.module,
          title: normalized.title,
          priority: normalized.priority,
          precondition: normalized.precondition,
          steps: normalized.steps,
          expected: normalized.expected,
        };
        if (nextSlot.matchedOld) {
          var oldItem = nextSlot.matchedOld.item || {};
          if (!isStructSame(oldItem, normalized)) updates.push({ id: oldItem.id, payload: payload });
          return;
        }
        payload.remark = '';
        creates.push({ payload: payload });
      });
      oldSlots.forEach(function(oldSlot) {
        if (oldSlot.matched || !oldSlot.item || !oldSlot.item.id) return;
        deletes.push({ id: oldSlot.item.id });
      });
      return { updates: updates, creates: creates, deletes: deletes };
    }

    function normalizeLocatePath(path) {
      if (!Array.isArray(path)) return [];
      return path.map(normalizeText);
    }

    function buildLocatePaths(items, pathBuilder) {
      var list = Array.isArray(items) ? items : [];
      if (typeof pathBuilder === 'function') {
        try {
          var built = pathBuilder(list, { fallbackModule: '用例模块' });
          if (Array.isArray(built) && built.length) return built.map(normalizeLocatePath);
        } catch (err) {
          // fall back to the normalized case shape
        }
      }
      return list.map(function(item) {
        var row = normalizeCase(item || {});
        return normalizeLocatePath([
          row.module,
          row.title,
          row.priority,
          row.precondition,
          row.steps,
          row.expected,
        ]);
      });
    }

    function isLocatePathMatch(targetPath, fullPath) {
      var target = Array.isArray(targetPath) ? targetPath : [];
      var full = Array.isArray(fullPath) ? fullPath : [];
      if (!target.length || full.length < target.length) return false;
      for (var i = 0; i < target.length; i += 1) {
        if (target[i] !== full[i]) return false;
      }
      return true;
    }

    function findIndexByPath(path, items, pathBuilder) {
      var targetPath = normalizeLocatePath(path);
      if (!targetPath.length) return -1;
      var locatePaths = buildLocatePaths(items, pathBuilder);
      for (var i = 0; i < locatePaths.length; i += 1) {
        if (isLocatePathMatch(targetPath, locatePaths[i])) return i;
      }
      return -1;
    }

    function resolveDirection(items) {
      var modules = {};
      var count = 0;
      (Array.isArray(items) ? items : []).forEach(function(item) {
        var key = normalizeText(item && item.module ? item.module : '').replace(/\s+/g, ' ');
        if (!key || modules[key]) return;
        modules[key] = true;
        count += 1;
      });
      return count > 2 ? 'side' : 'right';
    }

    function resolveRootNodeId(mindData) {
      return mindData && mindData.nodeData && mindData.nodeData.id
        ? String(mindData.nodeData.id)
        : '';
    }

    function getWriterDefaultPath() {
      return [
        '子模块：修改此处以确定子模块',
        '用例名：修改此处以确定用例名',
        '优先级：修改此处以确定优先级（如P1）',
        '前置条件：修改此处以确定前置条件',
        '执行步骤：修改此处以确定执行步骤',
        '预期结果：修改此处以确定预期结果',
      ];
    }

    function getWriterRootTitle() {
      return '用例：修改此处以确定用例的文件名';
    }

    function getWriterSessionKey(userId) {
      return 'tap-case-library-writer-xmind-edit-' + String(userId || 'guest');
    }

    function isLegacyWriterSchemaData(data) {
      if (!data || !data.nodeData) return false;
      var firstChild = Array.isArray(data.nodeData.children) && data.nodeData.children.length
        ? data.nodeData.children[0]
        : null;
      var firstTopic = firstChild && firstChild.topic !== undefined && firstChild.topic !== null
        ? String(firstChild.topic).trim()
        : '';
      return firstTopic.indexOf('父模块') === 0
        || firstTopic.indexOf('用例名：修改此处以确定用例名') === 0;
    }

    function migrateWriterSessionPayload(payload) {
      if (!payload || typeof payload !== 'object') return { action: 'none', payload: null };
      var hasLegacySchema = isLegacyWriterSchemaData(payload.baseData)
        || isLegacyWriterSchemaData(payload.currentData)
        || (Array.isArray(payload.history) && payload.history.some(isLegacyWriterSchemaData));
      if (hasLegacySchema) return { action: 'remove', payload: null };

      var next = null;
      try {
        next = JSON.parse(JSON.stringify(payload));
      } catch (err) {
        return { action: 'none', payload: payload };
      }
      var changed = false;
      function updateRoot(data) {
        if (!data || !data.nodeData) return;
        var topic = String(data.nodeData.topic || '').trim();
        if (topic !== '编写用例' && topic !== '用例名：修改此处以确定用例名' && topic !== '用例') return;
        data.nodeData.topic = getWriterRootTitle();
        changed = true;
      }
      updateRoot(next.baseData);
      updateRoot(next.currentData);
      if (Array.isArray(next.history)) next.history.forEach(updateRoot);
      return { action: changed ? 'update' : 'none', payload: changed ? next : payload };
    }

    function collectWriterLeafPaths(node, depth, pathTopics, output) {
      if (!node) return;
      var topics = Array.isArray(pathTopics) ? pathTopics.slice() : [];
      if (depth > 0) topics.push(normalizeText(node.topic));
      var children = Array.isArray(node.children) ? node.children : [];
      if (!children.length) {
        if (depth > 0) output.push(topics);
        return;
      }
      children.forEach(function(child) {
        collectWriterLeafPaths(child, depth + 1, topics, output);
      });
    }

    function normalizeWriterTopic(value) {
      var text = normalizeText(value);
      return !text || text === '-' ? '' : text;
    }

    function buildWriterExportCases(mindData) {
      var root = mindData && mindData.nodeData ? mindData.nodeData : null;
      if (!root) return [];
      var leafPaths = [];
      collectWriterLeafPaths(root, 0, [], leafPaths);
      return leafPaths.map(function(path) {
        var precondition = normalizeWriterTopic(path[3]);
        return {
          module: normalizeWriterTopic(path[0]) || '-',
          title: normalizeWriterTopic(path[1]) || '-',
          priority: normalizePriority(normalizeWriterTopic(path[2])) || 'P1',
          precondition: precondition || '-',
          preconditions: precondition || '-',
          steps: normalizeWriterTopic(path[4]) || '-',
          expected: normalizeWriterTopic(path[5]) || '-',
          remark: '',
        };
      });
    }

    function deriveWriterExportBaseName(mindData) {
      var rootTopic = mindData && mindData.nodeData && mindData.nodeData.topic !== undefined
        ? normalizeText(mindData.nodeData.topic)
        : '';
      if (rootTopic.indexOf('用例：') === 0) rootTopic = normalizeText(rootTopic.slice(3));
      return cleanFileName(rootTopic || '编写用例');
    }

    function parseWriterTopics(topics) {
      var segments = Array.isArray(topics) ? topics : [];
      var values = [
        normalizeWriterTopic(segments[0]),
        normalizeWriterTopic(segments[1]),
        normalizePriority(normalizeWriterTopic(segments[2])),
        normalizeWriterTopic(segments[3]),
        normalizeWriterTopic(segments[4]),
        normalizeWriterTopic(segments[5]),
      ];
      var emptyIndexes = [];
      values.forEach(function(value, index) {
        if (!value) emptyIndexes.push(index);
      });
      if (emptyIndexes.length) return { caseItem: null, emptyIndexes: emptyIndexes };
      return {
        caseItem: {
          module: values[0],
          title: values[1],
          priority: values[2],
          precondition: values[3],
          preconditions: values[3],
          steps: values[4],
          expected: values[5],
          remark: '',
        },
        emptyIndexes: [],
      };
    }

    function mapWriterCasesToImportItems(cases) {
      var mapped = (Array.isArray(cases) ? cases : []).map(function(item) {
        var row = normalizeCase(item || {});
        var precondition = normalizeWriterTopic(row.precondition || row.preconditions);
        return {
          module: normalizeWriterTopic(row.module),
          title: normalizeWriterTopic(row.title),
          priority: normalizePriority(normalizeWriterTopic(row.priority)),
          precondition: precondition,
          preconditions: precondition,
          steps: normalizeWriterTopic(row.steps),
          expected: normalizeWriterTopic(row.expected),
          remark: '',
        };
      });
      return buildImportItems(mapped);
    }

    function deriveWriterImportFileName(items) {
      var list = Array.isArray(items) ? items : [];
      var raw = list.length ? normalizeText(list[0].title || list[0].module || '') : '';
      var clean = cleanFileName(raw || '编写用例') || '编写用例';
      return clean + '.xmind';
    }

    return {
      normalizeText: normalizeText,
      normalizeCase: normalizeCase,
      buildPatchDiff: buildPatchDiff,
      findIndexByPath: findIndexByPath,
      resolveDirection: resolveDirection,
      resolveRootNodeId: resolveRootNodeId,
      getWriterDefaultPath: getWriterDefaultPath,
      getWriterRootTitle: getWriterRootTitle,
      getWriterSessionKey: getWriterSessionKey,
      migrateWriterSessionPayload: migrateWriterSessionPayload,
      buildWriterExportCases: buildWriterExportCases,
      deriveWriterExportBaseName: deriveWriterExportBaseName,
      parseWriterTopics: parseWriterTopics,
      mapWriterCasesToImportItems: mapWriterCasesToImportItems,
      deriveWriterImportFileName: deriveWriterImportFileName,
    };
  }

  return { create: create };
});
