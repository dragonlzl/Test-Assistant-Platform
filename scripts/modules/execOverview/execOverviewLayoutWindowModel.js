(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.execOverview = window.app.execOverview || {};
    window.app.execOverview.layoutWindowModel = api;
  }
})(function() {
  function finiteNumber(value, fallback) {
    var number = Number(value);
    return isFinite(number) ? number : fallback;
  }

  function positiveInteger(value, fallback) {
    var number = Math.floor(finiteNumber(value, fallback));
    return number > 0 ? number : fallback;
  }

  function resolveWindowRange(options) {
    var source = options && typeof options === 'object' ? options : {};
    var total = Math.max(0, Math.floor(finiteNumber(source.total, 0)));
    if (!total) {
      return { startIndex: 0, endIndex: -1, atEnd: false };
    }

    var windowSize = Math.min(total, positiveInteger(source.windowSize, 1));
    var overscan = Math.max(0, Math.floor(finiteNumber(source.overscan, 1)));
    var scrollLeft = Math.max(0, finiteNumber(source.scrollLeft, 0));
    var scrollWidth = Math.max(0, finiteNumber(source.scrollWidth, 0));
    var clientWidth = Math.max(0, finiteNumber(source.clientWidth, 0));
    var unit = Math.max(0, finiteNumber(source.unit, 0));
    var endTolerance = Math.max(0, finiteNumber(source.endTolerance, 1));
    var maxScroll = Math.max(0, scrollWidth - clientWidth);
    var atEnd = maxScroll > 0 && scrollLeft >= maxScroll - endTolerance;
    var startIndex = unit > 0 ? Math.floor(scrollLeft / unit) : 0;

    startIndex = Math.max(0, startIndex - overscan);
    if (atEnd) startIndex = Math.max(0, total - windowSize);

    var endIndex = Math.min(total - 1, startIndex + windowSize - 1);
    if (endIndex - startIndex + 1 < windowSize) {
      startIndex = Math.max(0, endIndex - windowSize + 1);
    }

    return {
      startIndex: startIndex,
      endIndex: endIndex,
      atEnd: atEnd,
    };
  }

  return {
    resolveWindowRange: resolveWindowRange,
  };
});
