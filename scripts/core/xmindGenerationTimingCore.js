(function() {
  window.app = window.app || {};

  function normalizePositiveNumber(value) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return number;
  }

  function normalizeDurations(values) {
    return (Array.isArray(values) ? values : []).map(normalizePositiveNumber).filter(function(value) {
      return value > 0;
    }).sort(function(left, right) {
      return left - right;
    });
  }

  function selectPercentile(values, percentile) {
    var list = normalizeDurations(values);
    if (!list.length) return 0;
    var ratio = Number(percentile);
    if (!Number.isFinite(ratio)) ratio = 0.8;
    ratio = Math.max(0, Math.min(1, ratio));
    var index = Math.ceil((list.length - 1) * ratio);
    return list[index];
  }

  function evaluateTailRequest(input) {
    var source = input && typeof input === 'object' ? input : {};
    var timeoutMs = normalizePositiveNumber(source.timeoutMs);
    var requestStartedAt = normalizePositiveNumber(source.requestStartedAt);
    var now = normalizePositiveNumber(source.now);
    var remainingCount = Math.max(0, Math.round(Number(source.remainingCount || 0)));
    var fallbackCaseCount = Math.max(0, Math.round(Number(source.fallbackCaseCount || 0)));
    var peerDurations = normalizeDurations(source.peerDurationsMs);
    var minPeerCount = 3;
    var peerMultiplier = 4;
    var timeoutFloorRatio = 0.1;
    var baselineMs = selectPercentile(peerDurations, 0.8);
    var thresholdMs = timeoutMs > 0 && baselineMs > 0
      ? Math.round(Math.min(timeoutMs, Math.max(baselineMs * peerMultiplier, timeoutMs * timeoutFloorRatio)))
      : 0;
    var elapsedMs = requestStartedAt > 0 && now >= requestStartedAt
      ? now - requestStartedAt
      : 0;
    var eligible = Boolean(
      timeoutMs > 0
      && requestStartedAt > 0
      && remainingCount === 1
      && fallbackCaseCount > 0
      && peerDurations.length >= minPeerCount
      && thresholdMs > 0
      && thresholdMs < timeoutMs
    );
    return {
      eligible: eligible,
      shouldRescue: eligible && elapsedMs >= thresholdMs,
      elapsedMs: Math.round(elapsedMs),
      thresholdMs: thresholdMs,
      timeoutMs: Math.round(timeoutMs),
      baselineMs: Math.round(baselineMs),
      peerCount: peerDurations.length,
      peerMultiplier: peerMultiplier,
      timeoutFloorRatio: timeoutFloorRatio,
    };
  }

  window.app.xmindGenerationTimingCore = {
    evaluateTailRequest: evaluateTailRequest,
    selectPercentile: selectPercentile,
  };
})();
