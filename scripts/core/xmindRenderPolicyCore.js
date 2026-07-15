(function() {
  window.app = window.app || {};

  var MANAGED_DECORATION_CLASSES = [
    'xmind-node-status-badge',
    'xmind-node-status-spinner',
    'xmind-node-topup-spinner',
    'xmind-casegen-topup-highlight-layer',
    'xmind-casegen-topup-highlight-frame',
    'xmind-casegen-topup-highlight-label',
  ];
  var TOPUP_ATTRIBUTE_NAMES = {
    'data-xmind-topup-highlight-token': true,
    'data-xmind-topup-highlight-label': true,
    'data-xmind-topup-highlight-scope': true,
  };

  function normalizeChange(item) {
    var source = item && typeof item === 'object' ? item : {};
    return {
      type: source.type ? String(source.type || '') : '',
      attributeName: source.attributeName ? String(source.attributeName || '') : '',
      targetRole: source.targetRole ? String(source.targetRole || '') : '',
      insideManaged: source.insideManaged === true,
      managedOnly: source.managedOnly === true,
    };
  }

  function isManagedDecorationClassName(className) {
    var values = className === null || className === undefined
      ? []
      : String(className || '').split(/\s+/).filter(Boolean);
    return MANAGED_DECORATION_CLASSES.some(function(name) {
      return values.indexOf(name) !== -1;
    });
  }

  function shouldScheduleNodeDecorations(changes) {
    return (Array.isArray(changes) ? changes : []).some(function(item) {
      var change = normalizeChange(item);
      if (change.type !== 'childList') return false;
      if (change.insideManaged || change.managedOnly) return false;
      return true;
    });
  }

  function shouldScheduleTopupHighlightSync(changes) {
    return (Array.isArray(changes) ? changes : []).some(function(item) {
      var change = normalizeChange(item);
      if (change.insideManaged || change.managedOnly) return false;
      if (change.type === 'childList') return true;
      if (change.type !== 'attributes') return false;
      if (TOPUP_ATTRIBUTE_NAMES[change.attributeName] === true) {
        return change.targetRole === 'topic';
      }
      if (change.attributeName === 'class') {
        return change.targetRole === 'topic' || change.targetRole === 'tree';
      }
      return false;
    });
  }

  window.app.xmindRenderPolicyCore = {
    MANAGED_DECORATION_CLASSES: MANAGED_DECORATION_CLASSES.slice(),
    isManagedDecorationClassName: isManagedDecorationClassName,
    shouldScheduleNodeDecorations: shouldScheduleNodeDecorations,
    shouldScheduleTopupHighlightSync: shouldScheduleTopupHighlightSync,
  };
})();
