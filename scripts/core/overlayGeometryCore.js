(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root) return;
  root.app = root.app || {};
  root.app.overlayGeometryCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function() {
  function numberOrZero(value) {
    return Number(value) || 0;
  }

  function clamp(value, lower, upper) {
    return Math.min(Math.max(lower, value), upper);
  }

  function normalizeAnchorRect(rect) {
    if (!rect || typeof rect !== 'object' || rect.left === undefined || rect.top === undefined) return null;
    var left = numberOrZero(rect.left);
    var top = numberOrZero(rect.top);
    var width = numberOrZero(rect.width);
    var height = numberOrZero(rect.height);
    var parsedBottom = Number(rect.bottom);
    return {
      left: left,
      top: top,
      width: width,
      height: height,
      bottom: Number.isFinite(parsedBottom) ? parsedBottom : (top + height),
    };
  }

  function captureAnchorRect(anchor) {
    if (!anchor) return null;
    var direct = normalizeAnchorRect(anchor);
    if (direct) return direct;
    if (typeof anchor.getBoundingClientRect !== 'function') return null;
    try {
      return normalizeAnchorRect(anchor.getBoundingClientRect());
    } catch (err) {
      return null;
    }
  }

  function computeAnchoredOverlayPosition(anchorRect, overlaySize, viewport) {
    if (!anchorRect || !overlaySize || !viewport) return null;
    var margin = 8;
    var gap = 10;
    var overlayWidth = numberOrZero(overlaySize.width) || 260;
    var overlayHeight = numberOrZero(overlaySize.height) || 44;
    var viewportWidth = numberOrZero(viewport.width);
    var viewportHeight = numberOrZero(viewport.height);
    var anchorWidth = numberOrZero(anchorRect.width);
    var anchorHeight = numberOrZero(anchorRect.height);
    var anchorLeft = numberOrZero(anchorRect.left);
    var anchorTop = numberOrZero(anchorRect.top);
    var parsedBottom = Number(anchorRect.bottom);
    var anchorBottom = Number.isFinite(parsedBottom) ? parsedBottom : (anchorTop + anchorHeight);
    var left = anchorLeft + anchorWidth / 2 - overlayWidth / 2;
    if (viewportWidth) {
      left = clamp(left, margin, Math.max(margin, viewportWidth - overlayWidth - margin));
    }
    var aboveTop = anchorTop - gap - overlayHeight;
    var belowTop = anchorBottom + gap;
    var placement = aboveTop >= margin ? 'above' : 'below';
    var top = placement === 'above' ? aboveTop : belowTop;
    if (viewportHeight) {
      top = clamp(top, margin, Math.max(margin, viewportHeight - overlayHeight - margin));
    }
    return {
      left: Math.round(left),
      top: Math.round(top),
      placement: placement,
    };
  }

  return {
    captureAnchorRect: captureAnchorRect,
    computeAnchoredOverlayPosition: computeAnchoredOverlayPosition,
    normalizeAnchorRect: normalizeAnchorRect,
  };
});
