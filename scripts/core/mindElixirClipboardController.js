(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirClipboardController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var viewerEl = opts.viewerEl || null;
    var controlsEl = opts.controlsEl || null;
    var getInstance = typeof opts.getInstance === 'function'
      ? opts.getInstance
      : function() { return null; };
    var isEditing = typeof opts.isEditing === 'function'
      ? opts.isEditing
      : function() { return false; };
    var isPendingSave = typeof opts.isPendingSave === 'function'
      ? opts.isPendingSave
      : function() { return false; };
    var isTypingTarget = typeof opts.isTypingTarget === 'function'
      ? opts.isTypingTarget
      : function() { return false; };
    var isInternalClipboardText = typeof opts.isInternalClipboardText === 'function'
      ? opts.isInternalClipboardText
      : function() { return false; };
    var parseIndentedTextToMindData = typeof opts.parseIndentedTextToMindData === 'function'
      ? opts.parseIndentedTextToMindData
      : function() { return null; };
    var normalizeClipboardPlainNodeTopic = typeof opts.normalizeClipboardPlainNodeTopic === 'function'
      ? opts.normalizeClipboardPlainNodeTopic
      : function(text) { return text ? String(text).trim() : ''; };
    var getCurrentMindData = typeof opts.getCurrentMindData === 'function'
      ? opts.getCurrentMindData
      : function() { return null; };
    var createNode = typeof opts.createNode === 'function'
      ? opts.createNode
      : function(topic) {
          return { id: String(Date.now()), topic: topic || '-', expanded: true, children: [] };
        };
    var cloneMindDataObject = typeof opts.cloneMindDataObject === 'function'
      ? opts.cloneMindDataObject
      : function(value) { return value; };
    var cloneMindNodeTree = typeof opts.cloneMindNodeTree === 'function'
      ? opts.cloneMindNodeTree
      : function(value) { return value; };
    var collectSelectedNodes = typeof opts.collectSelectedNodes === 'function'
      ? opts.collectSelectedNodes
      : function() { return []; };
    var findNodeWithParentById = typeof opts.findNodeWithParentById === 'function'
      ? opts.findNodeWithParentById
      : function() { return null; };
    var normalizeMindTopic = typeof opts.normalizeMindTopic === 'function'
      ? opts.normalizeMindTopic
      : function(value) { return value === null || value === undefined ? '' : String(value).trim(); };
    var clearValidationMarks = typeof opts.clearValidationMarks === 'function'
      ? opts.clearValidationMarks
      : function() {};
    var setApplyingHistory = typeof opts.setApplyingHistory === 'function'
      ? opts.setApplyingHistory
      : function() {};
    var pushHistorySnapshot = typeof opts.pushHistorySnapshot === 'function'
      ? opts.pushHistorySnapshot
      : function() {};
    var runSearch = typeof opts.runSearch === 'function'
      ? opts.runSearch
      : function() {};
    var updateEditButtons = typeof opts.updateEditButtons === 'function'
      ? opts.updateEditButtons
      : function() {};
    var showToast = typeof opts.showToast === 'function'
      ? opts.showToast
      : function() {};
    var bound = false;

    function readClipboardPlainText(event) {
      if (!event) return '';
      var clipboard = event.clipboardData || null;
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

    function onPaste(event) {
      if (!isEditing() || isPendingSave()) return;
      if (!event) return;
      if (controlsEl && controlsEl.contains && controlsEl.contains(event.target)) return;
      if (isTypingTarget(event.target || null)) return;

      var rawText = readClipboardPlainText(event);
      if (!rawText || isInternalClipboardText(rawText)) return;

      var parsed = parseIndentedTextToMindData(rawText);
      var parsedRoot = parsed && parsed.mindData && parsed.mindData.nodeData
        ? parsed.mindData.nodeData
        : null;
      var plainTopic = '';
      if (!parsedRoot) {
        plainTopic = normalizeClipboardPlainNodeTopic(rawText);
        if (!plainTopic) return;
      }

      var instance = getInstance();
      if (!instance || typeof instance.refresh !== 'function') return;
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();

      var currentData = getCurrentMindData();
      var fallbackMindData = parsed && parsed.mindData && parsed.mindData.nodeData
        ? parsed.mindData
        : { nodeData: createNode(plainTopic) };
      var nextData = cloneMindDataObject(
        currentData && currentData.nodeData ? currentData : fallbackMindData
      );
      if (!nextData || !nextData.nodeData) return;
      var nextRoot = nextData.nodeData;
      if (!parsedRoot && plainTopic) parsedRoot = createNode(plainTopic);
      if (!parsedRoot) return;

      var selectedNodes = collectSelectedNodes();
      var selectedNodeId = selectedNodes.length === 1
        && selectedNodes[0]
        && selectedNodes[0].nodeObj
        && selectedNodes[0].nodeObj.id
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
      var allowFlattenByRoot = targetNode === nextRoot
        && parsedChildren.length > 0
        && parsedRootTopic === normalizeMindTopic(nextRoot.topic);
      var allowFlattenBySelection = targetNode !== nextRoot
        && parsedChildren.length > 0
        && parsedRootTopic === targetTopic;
      if (allowFlattenByRoot || allowFlattenBySelection) nodesToAppend = parsedChildren;
      else nodesToAppend = [parsedRoot];
      if (!nodesToAppend.length) return;
      if (!Array.isArray(targetNode.children)) targetNode.children = [];
      for (var i = 0; i < nodesToAppend.length; i += 1) {
        var nextNode = cloneMindNodeTree(nodesToAppend[i]);
        if (nextNode) targetNode.children.push(nextNode);
      }
      targetNode.expanded = true;

      var refreshed = false;
      clearValidationMarks();
      setApplyingHistory(true);
      try {
        instance.refresh(nextData);
        refreshed = true;
      } catch (err2) {
        refreshed = false;
      }
      setApplyingHistory(false);

      if (!refreshed) {
        showToast('粘贴失败，请检查层级格式后重试', 'err', 3200);
        return;
      }

      pushHistorySnapshot(nextData);
      runSearch({ keepIndex: false });
      updateEditButtons();

      var rootTopic = parsed && parsed.rootTopic ? String(parsed.rootTopic) : '节点';
      if (parsed && parsed.mindData && parsed.mindData.nodeData) {
        var nodeCount = Number(parsed.nodeCount);
        if (!isFinite(nodeCount) || nodeCount <= 0) nodeCount = 0;
        showToast('已拼接结构：' + rootTopic + '（' + String(nodeCount) + ' 节点）', '', 2200);
        return;
      }
      var previewTopic = plainTopic || rootTopic || '文本';
      if (previewTopic.indexOf('\n') >= 0) previewTopic = previewTopic.split('\n')[0] + '...';
      if (previewTopic.length > 16) previewTopic = previewTopic.slice(0, 16) + '...';
      showToast('已新增子节点：' + previewTopic, '', 2200);
    }

    function bind() {
      if (bound || !viewerEl || typeof viewerEl.addEventListener !== 'function') return;
      viewerEl.addEventListener('paste', onPaste, true);
      bound = true;
    }

    function destroy() {
      if (!bound || !viewerEl || typeof viewerEl.removeEventListener !== 'function') return;
      viewerEl.removeEventListener('paste', onPaste, true);
      bound = false;
    }

    return {
      bind: bind,
      destroy: destroy,
      onPaste: onPaste,
      readClipboardPlainText: readClipboardPlainText,
    };
  }

  return { create: create };
});
