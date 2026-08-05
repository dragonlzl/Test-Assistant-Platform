(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirSelectionModel = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var isSelectableNode = typeof opts.isSelectableNode === 'function'
      ? opts.isSelectableNode
      : function() { return false; };
    var resolveNode = typeof opts.resolveNode === 'function'
      ? opts.resolveNode
      : function(node) { return node || null; };
    var getIdentityKey = typeof opts.getIdentityKey === 'function'
      ? opts.getIdentityKey
      : function() { return ''; };
    var getParent = typeof opts.getParent === 'function'
      ? opts.getParent
      : function() { return null; };
    var getNodeId = typeof opts.getNodeId === 'function'
      ? opts.getNodeId
      : function() { return ''; };
    var getNodeDepth = typeof opts.getNodeDepth === 'function'
      ? opts.getNodeDepth
      : function() { return 0; };

    function normalizeNodes(nodes, normalizeOptions) {
      var list = Array.isArray(nodes) ? nodes : [];
      var out = [];
      var seen = Object.create(null);
      list.forEach(function(node) {
        var resolved = resolveNode(node, normalizeOptions) || node;
        if (!isSelectableNode(resolved)) return;
        var key = String(getIdentityKey(resolved, normalizeOptions) || '');
        if (!key) key = String(out.length + 1);
        if (seen[key]) return;
        seen[key] = true;
        out.push(resolved);
      });
      return out;
    }

    function toggleNode(nodes, targetNode, toggleOptions) {
      var target = resolveNode(targetNode, toggleOptions) || targetNode;
      if (!isSelectableNode(target)) return null;
      var targetKey = String(getIdentityKey(target, toggleOptions) || '');
      if (!targetKey) return null;
      var exists = false;
      var next = normalizeNodes(nodes, toggleOptions).filter(function(node) {
        if (String(getIdentityKey(node, toggleOptions) || '') !== targetKey) return true;
        exists = true;
        return false;
      });
      if (!exists) next.push(target);
      return next;
    }

    function collectRemovableNodes(nodes, collectOptions) {
      var selected = normalizeNodes(nodes, collectOptions).filter(function(node) {
        return Boolean(getParent(node));
      });
      if (!selected.length) return [];
      selected.sort(function(a, b) {
        var depthA = Number(getNodeDepth(a) || 0);
        var depthB = Number(getNodeDepth(b) || 0);
        if (depthA !== depthB) return depthA - depthB;
        var keyA = String(getIdentityKey(a, collectOptions) || '');
        var keyB = String(getIdentityKey(b, collectOptions) || '');
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        return 0;
      });
      var kept = [];
      var keptIds = Object.create(null);
      selected.forEach(function(node) {
        var cursor = getParent(node);
        while (cursor) {
          var parentId = String(getNodeId(cursor) || '');
          if (parentId && keptIds[parentId]) return;
          cursor = getParent(cursor);
        }
        kept.push(node);
        var nodeId = String(getNodeId(node) || '');
        if (nodeId) keptIds[nodeId] = true;
      });
      return kept;
    }

    function buildDefaultGroupDescriptor(nodeMeta, descriptorOptions) {
      var options = descriptorOptions && typeof descriptorOptions === 'object' ? descriptorOptions : {};
      if (options.enabled !== true || !nodeMeta) return null;
      var path = Array.isArray(nodeMeta.path) ? nodeMeta.path.map(function(segment) {
        return segment === null || segment === undefined ? '' : String(segment).trim();
      }).filter(function(segment) {
        return Boolean(segment);
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

    return {
      normalizeNodes: normalizeNodes,
      toggleNode: toggleNode,
      collectRemovableNodes: collectRemovableNodes,
      buildDefaultGroupDescriptor: buildDefaultGroupDescriptor,
    };
  }

  return {
    create: create,
  };
});
