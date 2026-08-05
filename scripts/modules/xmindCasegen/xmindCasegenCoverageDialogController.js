(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenCoverageDialogController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var summaryDialogBodyEl = opts.summaryDialogBodyEl || null;
    var coverageBtn = opts.coverageBtn || null;
    var escapeHtml = port('escapeHtml', function(value) { return String(value || ''); });
    var ensureCoverageUiState = port('ensureCoverageUiState', function() { return {}; });
    var buildCoverageSourceRequest = port('buildCoverageSourceRequest', function() { return null; });
    var getSelectedRequirementSource = port('getSelectedRequirementSource', function() { return {}; });
    var getCoverageCaseTooltipCore = port('getCoverageCaseTooltipCore', function() { return null; });
    var getUrlApi = port('getUrlApi', function() {
      return typeof URL !== 'undefined' ? URL : null;
    });
    var persistXmindState = port('persistXmindState');
    var hasActiveWorkspace = port('hasActiveWorkspace', function() { return false; });
    var notifyFloatingStatus = port('notifyFloatingStatus');
    var collectRunningGenerationOperations = port('collectRunningGenerationOperations', function() { return []; });
    var notifyStatus = port('notifyStatus');
    var hideOpenMindContextMenu = port('hideOpenMindContextMenu');
    var openCoverageDialogShell = port('openCoverageDialogShell');
    var isCoverageDialogOpen = port('isCoverageDialogOpen', function() { return false; });
    var closeSummaryDialog = port('closeSummaryDialog');
    var startRequirementCoverageTask = port('startRequirementCoverageTask');
    var scheduleFrame = port('scheduleFrame', function(handler) {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(handler);
      }
    });
    var now = port('now', function() { return Date.now(); });
    var coverageHighlightedCaseId = '';
    var coverageCaseTooltipController = null;
    var coverageRequirementImageObjectUrls = [];
    var listenerBound = false;
    var coverageButtonClickHandler = null;
    var coverageBodyClickHandler = null;
    function getCoverageStatusMeta(status) {
      var stable = String(status || '');
      if (stable === 'covered') return { key: 'covered', label: '已覆盖', className: 'is-covered' };
      if (stable === 'partial') return { key: 'partial', label: '部分覆盖', className: 'is-partial' };
      if (stable === 'context') return { key: 'context', label: '非测试需求/上下文', className: 'is-context' };
      return { key: 'uncovered', label: '未覆盖', className: 'is-uncovered' };
    }

    function buildCoverageCaseMap(result) {
      var map = {};
      (result && Array.isArray(result.cases) ? result.cases : []).forEach(function(item) {
        if (!item || !item.id) return;
        map[String(item.id || '')] = item;
      });
      return map;
    }

    function getCoverageCaseDetail(caseId) {
      var coverageState = ensureCoverageUiState();
      var result = coverageState.result && typeof coverageState.result === 'object' ? coverageState.result : null;
      return buildCoverageCaseMap(result)[String(caseId || '')] || null;
    }

    function ensureCoverageCaseDetailTooltip() {
      if (coverageCaseTooltipController || !summaryDialogBodyEl) return coverageCaseTooltipController;
      var coverageCaseTooltipCore = getCoverageCaseTooltipCore();
      if (!coverageCaseTooltipCore || typeof coverageCaseTooltipCore.init !== 'function') return null;
      coverageCaseTooltipController = coverageCaseTooltipCore.init({
        root: summaryDialogBodyEl,
        getCaseDetail: getCoverageCaseDetail,
      });
      return coverageCaseTooltipController;
    }

    function hideCoverageCaseDetailTooltip() {
      var controller = coverageCaseTooltipController;
      if (controller && typeof controller.hide === 'function') controller.hide();
    }

    function getCoverageSegmentCaseIds(segment) {
      var direct = Array.isArray(segment && segment.directCaseIds) ? segment.directCaseIds : [];
      var related = Array.isArray(segment && segment.relatedCaseIds) ? segment.relatedCaseIds : [];
      var fallback = Array.isArray(segment && segment.caseIds) ? segment.caseIds : [];
      var seen = {};
      var result = [];
      direct.concat(related).forEach(function(id) {
        var stableId = String(id || '');
        if (!stableId || seen[stableId]) return;
        seen[stableId] = true;
        result.push(stableId);
      });
      if (!result.length) {
        fallback.forEach(function(id) {
          var stableId = String(id || '');
          if (!stableId || seen[stableId]) return;
          seen[stableId] = true;
          result.push(stableId);
        });
      }
      return result;
    }

    function getCoverageCaseRelation(segment, caseId) {
      var stableId = String(caseId || '');
      var related = Array.isArray(segment && segment.relatedCaseIds) ? segment.relatedCaseIds : [];
      for (var i = 0; i < related.length; i += 1) {
        if (String(related[i] || '') === stableId) return 'related';
      }
      return 'direct';
    }

    function getCoverageCasePriorityMeta(item) {
      var raw = item && typeof item === 'object'
        ? String(item.priority || item.level || item['优先级'] || '').trim()
        : '';
      var label = raw ? raw.toUpperCase() : '未定';
      var key = label === 'P0' || label === 'P1' || label === 'P2' ? label.toLowerCase() : 'unknown';
      return {
        label: label,
        className: 'is-' + key,
      };
    }

    function getCoverageCurrentRequestInfo() {
      try {
        return {
          request: buildCoverageSourceRequest(),
          error: '',
        };
      } catch (err) {
        return {
          request: null,
          error: err && err.message ? String(err.message || '') : '需求覆盖分析上下文不可用',
        };
      }
    }

    function isCoverageResultStale(coverageState, requestInfo) {
      var result = coverageState && coverageState.result ? coverageState.result : null;
      var request = requestInfo && requestInfo.request ? requestInfo.request : null;
      if (!result || !request) return false;
      var resultSignature = coverageState.signature || result.signature || '';
      return Boolean(resultSignature && request.signature && String(resultSignature) !== String(request.signature));
    }

    function getSelectedCoverageSegment(result, coverageState) {
      var segments = result && Array.isArray(result.segments) ? result.segments : [];
      if (!segments.length) return null;
      var selectedId = coverageState && coverageState.selectedSegmentId ? String(coverageState.selectedSegmentId || '') : '';
      var found = null;
      if (selectedId) {
        segments.some(function(item) {
          if (item && String(item.id || '') === selectedId) {
            found = item;
            return true;
          }
          return false;
        });
      }
      if (found) return found;
      return segments[0] || null;
    }

    function findCoverageSegmentsByCaseId(result, caseId) {
      var stableCaseId = String(caseId || '');
      var segments = result && Array.isArray(result.segments) ? result.segments : [];
      if (!stableCaseId || !segments.length) return [];
      return segments.filter(function(segment) {
        return getCoverageSegmentCaseIds(segment).indexOf(stableCaseId) !== -1;
      });
    }

    function getCoverageSelectedSegmentList(result, selected, highlightedCaseId) {
      var highlightedId = String(highlightedCaseId || '');
      var matches = highlightedId ? findCoverageSegmentsByCaseId(result, highlightedId) : [];
      if (matches.length) return matches;
      return selected ? [selected] : [];
    }

    function buildCoverageSummaryHtml(result, stale) {
      var summary = result && result.summary ? result.summary : {};
      var total = Number(summary.total || 0) || 0;
      var context = Number(summary.context || 0) || 0;
      var effectiveTotal = Math.max(0, total - context);
      var percent = Number(summary.coveragePercent);
      if (!Number.isFinite(percent)) percent = effectiveTotal > 0 ? 0 : 100;
      return ''
        + '<div class="xmind-casegen-coverage-summary" data-coverage-summary>'
        +   '<span class="xmind-casegen-coverage-score">' + escapeHtml(String(percent)) + '%</span>'
        +   '<span>需求覆盖</span>'
        +   '<span class="xmind-casegen-coverage-summary-dot" aria-hidden="true"></span>'
        +   buildCoverageStatusJumpButton('covered', '已覆盖', Number(summary.covered || 0) || 0, 'xmind-casegen-coverage-summary-jump')
        +   buildCoverageStatusJumpButton('partial', '部分', Number(summary.partial || 0) || 0, 'xmind-casegen-coverage-summary-jump')
        +   buildCoverageStatusJumpButton('uncovered', '未覆盖', Number(summary.uncovered || 0) || 0, 'xmind-casegen-coverage-summary-jump')
        +   buildCoverageStatusJumpButton('context', '上下文', context, 'xmind-casegen-coverage-summary-jump')
        +   (stale ? '<span class="xmind-casegen-coverage-stale-pill">已过期</span>' : '')
        + '</div>';
    }

    function buildCoverageStatusJumpButton(status, label, count, extraClass) {
      var stableStatus = String(status || '');
      var stableLabel = String(label || '');
      var stableCount = Number(count || 0) || 0;
      var disabled = stableCount <= 0;
      var title = disabled
        ? ('暂无' + stableLabel + '片段')
        : ('定位下一处' + stableLabel + '片段，共 ' + String(stableCount) + ' 处');
      return '<button type="button" class="' + escapeHtml(String(extraClass || '')) + ' is-' + escapeHtml(stableStatus) + '"'
        + ' data-coverage-jump="' + escapeHtml(stableStatus) + '"'
        + ' title="' + escapeHtml(title) + '"'
        + (disabled ? ' disabled' : '')
        + '>'
        + escapeHtml(stableLabel + ' ' + String(stableCount))
      + '</button>';
    }

    function getCoverageSummaryCount(result, key) {
      var summary = result && result.summary ? result.summary : {};
      return Number(summary && summary[key] || 0) || 0;
    }

    function buildCoverageSourceLegendHtml(result) {
      var items = [
        { key: 'covered', label: '已覆盖', countKey: 'covered', sample: '实线' },
        { key: 'partial', label: '部分覆盖', countKey: 'partial', sample: '虚线' },
        { key: 'uncovered', label: '未覆盖', countKey: 'uncovered', sample: '普通正文' },
        { key: 'context', label: '上下文', countKey: 'context', sample: '灰色正文' },
      ];
      return '<div class="xmind-casegen-coverage-source-legend" aria-label="需求原文覆盖状态图例">'
        + items.map(function(item) {
          var className = 'is-' + item.key;
          return '<button type="button" class="xmind-casegen-coverage-source-legend-item ' + className + '"'
            + ' data-coverage-jump="' + escapeHtml(item.key) + '"'
            + ' title="' + escapeHtml('定位下一处' + item.label + '片段，共 ' + String(getCoverageSummaryCount(result, item.countKey)) + ' 处') + '"'
            + (getCoverageSummaryCount(result, item.countKey) <= 0 ? ' disabled' : '')
            + '>'
            + '<span class="xmind-casegen-coverage-source-legend-sample ' + className + '">' + escapeHtml(item.sample) + '</span>'
            + '<span>' + escapeHtml(item.label) + ' ' + escapeHtml(String(getCoverageSummaryCount(result, item.countKey))) + '</span>'
          + '</button>';
        }).join('')
      + '</div>';
    }

    function buildCoverageNoticeHtml(coverageState, requestInfo, stale) {
      var notices = [];
      if (coverageState && coverageState.running === true) {
        notices.push({
          className: 'is-running',
          text: '正在分析当前可见用例对需求原文的覆盖，完成后会自动刷新结果。',
          spinner: true,
        });
      }
      if (stale) {
        notices.push({
          className: 'is-stale',
          text: '当前需求或可见用例已变化，下面展示的是上一次分析结果。',
        });
      }
      if (requestInfo && requestInfo.error) {
        notices.push({
          className: 'is-error',
          text: requestInfo.error,
        });
      }
      if (coverageState && coverageState.error) {
        notices.push({
          className: 'is-error',
          text: coverageState.error,
        });
      }
      return notices.map(function(item) {
        return '<div class="xmind-casegen-coverage-notice ' + escapeHtml(item.className) + '">'
          + (item.spinner ? '<span class="xmind-casegen-coverage-spinner" aria-hidden="true"></span>' : '')
          + '<span>' + escapeHtml(item.text) + '</span>'
        + '</div>';
      }).join('');
    }

    function readCoverageSourceScrollState() {
      var scroller = summaryDialogBodyEl && summaryDialogBodyEl.querySelector
        ? summaryDialogBodyEl.querySelector('[data-coverage-source-scroll]')
        : null;
      if (!scroller) return null;
      return {
        top: Number(scroller.scrollTop || 0) || 0,
        left: Number(scroller.scrollLeft || 0) || 0,
      };
    }

    function restoreCoverageSourceScrollState(scrollState) {
      if (!scrollState) return;
      function applyScroll() {
        var scroller = summaryDialogBodyEl && summaryDialogBodyEl.querySelector
          ? summaryDialogBodyEl.querySelector('[data-coverage-source-scroll]')
          : null;
        if (!scroller) return;
        scroller.scrollTop = Number(scrollState.top || 0) || 0;
        scroller.scrollLeft = Number(scrollState.left || 0) || 0;
      }
      applyScroll();
      scheduleFrame(applyScroll);
    }

    function findCoverageSourceSegmentElement(segmentId) {
      var targetId = String(segmentId || '');
      if (!targetId || !summaryDialogBodyEl || !summaryDialogBodyEl.querySelectorAll) return null;
      var list = summaryDialogBodyEl.querySelectorAll('[data-coverage-segment]');
      for (var i = 0; i < list.length; i += 1) {
        if (String(list[i].getAttribute('data-coverage-segment') || '') === targetId) return list[i];
      }
      return null;
    }

    function readCoverageSourceAnchorState(segmentId) {
      var scroller = summaryDialogBodyEl && summaryDialogBodyEl.querySelector
        ? summaryDialogBodyEl.querySelector('[data-coverage-source-scroll]')
        : null;
      var target = findCoverageSourceSegmentElement(segmentId);
      if (!scroller || !target || !scroller.getBoundingClientRect || !target.getBoundingClientRect) return null;
      var scrollerRect = scroller.getBoundingClientRect();
      var targetRect = target.getBoundingClientRect();
      return {
        segmentId: String(segmentId || ''),
        offsetTop: Number(targetRect.top - scrollerRect.top) || 0,
        left: Number(scroller.scrollLeft || 0) || 0,
      };
    }

    function restoreCoverageSourceAnchorState(anchorState) {
      if (!anchorState || !anchorState.segmentId) return;
      function applyScroll() {
        var scroller = summaryDialogBodyEl && summaryDialogBodyEl.querySelector
          ? summaryDialogBodyEl.querySelector('[data-coverage-source-scroll]')
          : null;
        var target = findCoverageSourceSegmentElement(anchorState.segmentId);
        if (!scroller || !target || !scroller.getBoundingClientRect || !target.getBoundingClientRect) return;
        var scrollerRect = scroller.getBoundingClientRect();
        var targetRect = target.getBoundingClientRect();
        var currentOffsetTop = Number(targetRect.top - scrollerRect.top) || 0;
        scroller.scrollTop = (Number(scroller.scrollTop || 0) || 0) + currentOffsetTop - (Number(anchorState.offsetTop || 0) || 0);
        scroller.scrollLeft = Number(anchorState.left || 0) || 0;
      }
      applyScroll();
      scheduleFrame(applyScroll);
    }

    function releaseCoverageRequirementImageObjectUrls() {
      if (!coverageRequirementImageObjectUrls.length) return;
      var urlApi = getUrlApi();
      if (urlApi && typeof urlApi.revokeObjectURL === 'function') {
        coverageRequirementImageObjectUrls.forEach(function(url) {
          if (url) urlApi.revokeObjectURL(url);
        });
      }
      coverageRequirementImageObjectUrls = [];
    }

    function createCoverageRequirementImageUrl(item) {
      if (!item || typeof item !== 'object') return '';
      var dataUrl = String(item.dataUrl || '');
      if (dataUrl.indexOf('data:image/') === 0) return dataUrl;
      var blob = item.blob || item.file || null;
      var urlApi = getUrlApi();
      if (!blob || !urlApi || typeof urlApi.createObjectURL !== 'function') return '';
      try {
        var objectUrl = urlApi.createObjectURL(blob);
        coverageRequirementImageObjectUrls.push(objectUrl);
        return objectUrl;
      } catch (err) {
        return '';
      }
    }

    function collectCoverageRequirementMediaItems(result) {
      var source = getSelectedRequirementSource();
      var resultText = result && result.requirementText ? String(result.requirementText || '').trim() : '';
      var sourceText = source && source.text ? String(source.text || '').trim() : '';
      if (!resultText || resultText !== sourceText) return [];
      var images = source && Array.isArray(source.images) ? source.images : [];
      var items = [];
      images.forEach(function(item, index) {
        if (!item || typeof item !== 'object') return;
        var url = createCoverageRequirementImageUrl(item);
        if (!url) return;
        var hasOffset = Number.isFinite(Number(item.textOffset)) && Number(item.textOffset) >= 0;
        var sourceType = String(item.source || source.mode || '').toLowerCase();
        var label = sourceType === 'paste'
          ? '粘贴图片'
          : (sourceType === 'manual' ? '手填需求图片' : '需求图片');
        var order = Number(item.index || index + 1) || (index + 1);
        items.push({
          url: url,
          label: label + ' ' + String(order),
          alt: item.name ? String(item.name || '') : (label + ' ' + String(order)),
          offset: hasOffset ? Number(item.textOffset) : Number.POSITIVE_INFINITY,
          order: order,
        });
      });
      items.sort(function(a, b) {
        if (a.offset !== b.offset) return a.offset - b.offset;
        return a.order - b.order;
      });
      return items;
    }

    function buildCoverageSourceImageHtml(item) {
      if (!item || !item.url) return '';
      return '<figure class="xmind-casegen-coverage-image" data-coverage-media="image">'
        + '<img src="' + escapeHtml(item.url) + '" alt="' + escapeHtml(item.alt || item.label || '需求图片') + '" loading="lazy" />'
        + '<figcaption>' + escapeHtml(item.label || '需求图片') + '</figcaption>'
      + '</figure>';
    }

    function buildCoverageSourceSegmentHtml(segment, selected, highlightedCaseId, textOverride) {
      var meta = getCoverageStatusMeta(segment && segment.status);
      var caseIds = getCoverageSegmentCaseIds(segment);
      var directCount = Array.isArray(segment && segment.directCaseIds) ? segment.directCaseIds.length : caseIds.length;
      var relatedCount = Array.isArray(segment && segment.relatedCaseIds) ? segment.relatedCaseIds.length : 0;
      var classes = ['xmind-casegen-coverage-segment', meta.className];
      if (selected && String(selected.id || '') === String(segment.id || '')) classes.push('is-active');
      if (highlightedCaseId && caseIds.indexOf(highlightedCaseId) !== -1) classes.push('is-case-highlighted');
      var reason = segment && segment.reason ? String(segment.reason || '') : '';
      var titleText = meta.label + ' / 直接 ' + String(directCount) + ' 条，关联 ' + String(relatedCount) + ' 条' + (reason ? ' / ' + reason : '');
      var displayText = textOverride !== undefined && textOverride !== null
        ? String(textOverride || '')
        : String(segment && segment.text ? segment.text : '');
      return '<button type="button" class="' + classes.join(' ') + '"'
        + ' data-coverage-segment="' + escapeHtml(segment && segment.id ? segment.id : '') + '"'
        + ' data-coverage-status="' + escapeHtml(meta.key || '') + '"'
        + ' title="' + escapeHtml(titleText) + '">'
        + '<span class="xmind-casegen-coverage-doc-text">' + escapeHtml(displayText) + '</span>'
      + '</button>';
    }

    function buildCoverageDocumentHtml(result, segments, selected, highlightedCaseId, mediaItems) {
      var fullText = result && result.requirementText ? String(result.requirementText || '') : '';
      var media = Array.isArray(mediaItems) ? mediaItems : [];
      function buildRemainingMediaHtml() {
        return media.map(function(item) {
          return buildCoverageSourceImageHtml(item);
        }).join('');
      }
      if (!fullText) {
        return segments.map(function(segment) {
          return buildCoverageSourceSegmentHtml(segment, selected, highlightedCaseId, segment && segment.text ? segment.text : '');
        }).join('\n') + buildRemainingMediaHtml();
      }
      var cursor = 0;
      var pieces = [];
      var matchedAll = true;
      var mediaCursor = 0;

      function appendTextRangeWithMedia(start, end) {
        var pos = start;
        while (
          mediaCursor < media.length
          && media[mediaCursor]
          && media[mediaCursor].offset !== Number.POSITIVE_INFINITY
          && media[mediaCursor].offset <= end
        ) {
          var item = media[mediaCursor];
          var offset = Math.max(start, Math.min(end, Number(item.offset || 0) || 0));
          if (offset > pos) pieces.push(escapeHtml(fullText.slice(pos, offset)));
          pieces.push(buildCoverageSourceImageHtml(item));
          pos = offset;
          mediaCursor += 1;
        }
        if (end > pos) pieces.push(escapeHtml(fullText.slice(pos, end)));
      }

      function appendMediaUpTo(offset) {
        while (
          mediaCursor < media.length
          && media[mediaCursor]
          && media[mediaCursor].offset !== Number.POSITIVE_INFINITY
          && media[mediaCursor].offset <= offset
        ) {
          pieces.push(buildCoverageSourceImageHtml(media[mediaCursor]));
          mediaCursor += 1;
        }
      }

      function appendTrailingMedia() {
        while (mediaCursor < media.length) {
          pieces.push(buildCoverageSourceImageHtml(media[mediaCursor]));
          mediaCursor += 1;
        }
      }

      segments.forEach(function(segment) {
        if (!matchedAll) return;
        var segmentText = String(segment && segment.text ? segment.text : '');
        if (!segmentText) return;
        var index = fullText.indexOf(segmentText, cursor);
        if (index < 0) {
          matchedAll = false;
          return;
        }
        if (index > cursor) appendTextRangeWithMedia(cursor, index);
        appendMediaUpTo(index);
        pieces.push(buildCoverageSourceSegmentHtml(segment, selected, highlightedCaseId, segmentText));
        cursor = index + segmentText.length;
        appendMediaUpTo(cursor);
      });
      if (!matchedAll) {
        return segments.map(function(segment) {
          return buildCoverageSourceSegmentHtml(segment, selected, highlightedCaseId, segment && segment.text ? segment.text : '');
        }).join('\n') + buildRemainingMediaHtml();
      }
      if (cursor < fullText.length) appendTextRangeWithMedia(cursor, fullText.length);
      appendTrailingMedia();
      return pieces.join('');
    }

    function buildCoverageSourceHtml(result, coverageState) {
      var segments = result && Array.isArray(result.segments) ? result.segments : [];
      if (!segments.length) {
        return '<div class="xmind-casegen-coverage-empty">暂无需求覆盖分析结果。</div>';
      }
      var selected = getSelectedCoverageSegment(result, coverageState);
      var highlightedCaseId = coverageHighlightedCaseId ? String(coverageHighlightedCaseId || '') : '';
      var mediaItems = collectCoverageRequirementMediaItems(result);
      return '<article class="xmind-casegen-coverage-segment-list xmind-casegen-coverage-document" data-coverage-source-scroll>'
        + buildCoverageDocumentHtml(result, segments, selected, highlightedCaseId, mediaItems)
        + '</article>';
    }

    function buildCoverageSelectedSegmentsHtml(result, selected, highlightedCaseId) {
      var highlightedId = String(highlightedCaseId || '');
      var segments = getCoverageSelectedSegmentList(result, selected, highlightedId);
      if (!segments.length) {
        return '<div class="xmind-casegen-coverage-empty">请选择左侧需求片段查看对应用例。</div>';
      }
      var selectedId = selected && selected.id ? String(selected.id || '') : '';
      var title = highlightedId && segments.length > 1 ? '用例关联片段' : '当前片段';
      var countText = segments.length > 1 ? ('共 ' + String(segments.length) + ' 处') : '1 处';
      return '<div class="xmind-casegen-coverage-selected-card" data-coverage-selected-card>'
        + '<div class="xmind-casegen-coverage-selected-card-head">'
        +   '<strong>' + escapeHtml(title) + '</strong>'
        +   '<span>' + escapeHtml(countText) + '</span>'
        + '</div>'
        + '<div class="xmind-casegen-coverage-selected-list">'
        + segments.map(function(segment) {
          var meta = getCoverageStatusMeta(segment && segment.status);
          var active = selectedId && String(segment && segment.id ? segment.id : '') === selectedId;
          var relation = highlightedId ? getCoverageCaseRelation(segment, highlightedId) : '';
          var relationLabel = relation === 'related' ? '关联' : (relation === 'direct' ? '直接' : '');
          return '<button type="button" class="xmind-casegen-coverage-selected-item ' + (active ? 'is-active ' : '') + escapeHtml(meta.className || '') + '"'
            + ' data-coverage-selected-segment="' + escapeHtml(segment && segment.id ? segment.id : '') + '"'
            + ' title="' + escapeHtml('定位到需求原文片段') + '">'
            + '<span class="xmind-casegen-coverage-selected-head">'
            +   '<span class="xmind-casegen-coverage-segment-id">' + escapeHtml(segment && segment.id ? segment.id : '') + '</span>'
            +   '<span class="xmind-casegen-coverage-status ' + escapeHtml(meta.className) + '">' + escapeHtml(meta.label) + '</span>'
            +   (relationLabel ? '<span class="xmind-casegen-coverage-case-relation ' + (relation === 'related' ? 'is-related' : 'is-direct') + '">' + escapeHtml(relationLabel) + '</span>' : '')
            + '</span>'
            + '<span class="xmind-casegen-coverage-selected-text">' + escapeHtml(segment && segment.text ? segment.text : '') + '</span>'
          + '</button>';
        }).join('')
        + '</div>'
      + '</div>';
    }

    function buildCoverageCaseListHtml(result, coverageState) {
      var selected = getSelectedCoverageSegment(result, coverageState);
      var caseMap = buildCoverageCaseMap(result);
      if (!selected) {
        return '<div class="xmind-casegen-coverage-empty">请选择左侧需求片段查看对应用例。</div>';
      }
      var caseIds = getCoverageSegmentCaseIds(selected);
      var caseHtml = caseIds.map(function(id) {
        var item = caseMap[id];
        if (!item) return '';
        var active = coverageHighlightedCaseId && String(coverageHighlightedCaseId || '') === String(id || '');
        var relation = getCoverageCaseRelation(selected, id);
        var relationLabel = relation === 'related' ? '关联' : '直接';
        var priority = getCoverageCasePriorityMeta(item);
        return '<button type="button" class="xmind-casegen-coverage-case ' + (active ? 'is-active ' : '') + (relation === 'related' ? 'is-related' : 'is-direct') + '" data-coverage-case="' + escapeHtml(id) + '" data-coverage-case-detail-trigger>'
          + '<span class="xmind-casegen-coverage-case-module">' + escapeHtml(item.module || '未命名模块') + '</span>'
          + '<span class="xmind-casegen-coverage-case-title-wrap">'
          +   '<span class="xmind-casegen-coverage-case-title">' + escapeHtml(item.title || '未命名用例') + '</span>'
          +   '<span class="xmind-casegen-coverage-case-priority ' + escapeHtml(priority.className) + '">' + escapeHtml(priority.label) + '</span>'
          +   '<span class="xmind-casegen-coverage-case-relation ' + (relation === 'related' ? 'is-related' : 'is-direct') + '">' + escapeHtml(relationLabel) + '</span>'
          + '</span>'
        + '</button>';
      }).join('');
      if (!caseHtml) {
        caseHtml = '<div class="xmind-casegen-coverage-empty">'
          + (selected.status === 'context'
            ? '该片段被识别为背景或上下文信息，不需要直接挂接用例。'
            : '该片段暂未找到直接或关联对应的用例。')
          + '</div>';
      }
      var unmappedCount = result && Array.isArray(result.unmappedCaseIds) ? result.unmappedCaseIds.length : 0;
      return ''
        + buildCoverageSelectedSegmentsHtml(result, selected, coverageHighlightedCaseId)
        + '<div class="xmind-casegen-coverage-case-list">' + caseHtml + '</div>'
        + (unmappedCount > 0
          ? '<div class="xmind-casegen-coverage-unmapped">另有 ' + escapeHtml(String(unmappedCount)) + ' 条用例未直接或关联映射到需求原文，默认不计入需求本身覆盖率。</div>'
          : '');
    }

    function scrollCoverageSourceSegmentIntoView(segmentId) {
      function applyScroll() {
        var target = findCoverageSourceSegmentElement(segmentId);
        if (!target || typeof target.scrollIntoView !== 'function') return;
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
      applyScroll();
      scheduleFrame(applyScroll);
    }

    function findNextCoverageSegmentByStatus(result, currentSegmentId, status) {
      var segments = result && Array.isArray(result.segments) ? result.segments : [];
      var stableStatus = String(status || '');
      if (!stableStatus || !segments.length) return null;
      var matches = segments.filter(function(segment) {
        return segment && String(segment.status || '') === stableStatus;
      });
      if (!matches.length) return null;
      var currentId = String(currentSegmentId || '');
      var currentMatchIndex = -1;
      for (var i = 0; i < matches.length; i += 1) {
        if (String(matches[i].id || '') === currentId) {
          currentMatchIndex = i;
          break;
        }
      }
      if (currentMatchIndex >= 0) return matches[(currentMatchIndex + 1) % matches.length];
      var currentIndex = -1;
      segments.some(function(segment, index) {
        if (segment && String(segment.id || '') === currentId) {
          currentIndex = index;
          return true;
        }
        return false;
      });
      if (currentIndex >= 0) {
        for (var j = 0; j < matches.length; j += 1) {
          if (Number(matches[j].index || 0) > currentIndex) return matches[j];
        }
      }
      return matches[0];
    }

    function jumpToCoverageStatus(status) {
      var stableStatus = String(status || '');
      if (!stableStatus) return false;
      var coverageState = ensureCoverageUiState();
      var result = coverageState.result && typeof coverageState.result === 'object' ? coverageState.result : null;
      var target = findNextCoverageSegmentByStatus(result, coverageState.selectedSegmentId, stableStatus);
      if (!target || !target.id) return false;
      coverageState.selectedSegmentId = String(target.id || '');
      coverageHighlightedCaseId = '';
      coverageState.updatedAt = now();
      persistXmindState(false);
      renderCoverageDialog({ resetSourceScroll: true });
      scrollCoverageSourceSegmentIntoView(target.id);
      return true;
    }

    function renderCoverageDialog(options) {
      if (!summaryDialogBodyEl) return;
      hideCoverageCaseDetailTooltip();
      var opts = options || {};
      var sourceAnchorState = opts.sourceAnchorState || null;
      var sourceScrollState = opts.resetSourceScroll === true || sourceAnchorState ? null : readCoverageSourceScrollState();
      releaseCoverageRequirementImageObjectUrls();
      var coverageState = ensureCoverageUiState();
      var requestInfo = getCoverageCurrentRequestInfo();
      var result = coverageState.result && typeof coverageState.result === 'object' ? coverageState.result : null;
      var stale = isCoverageResultStale(coverageState, requestInfo);
      var summaryHtml = result ? buildCoverageSummaryHtml(result, stale) : '';
      var noticeHtml = buildCoverageNoticeHtml(coverageState, requestInfo, stale);
      var actionDisabled = coverageState.running === true || Boolean(requestInfo.error);
      if (!result && coverageState.running !== true) {
        noticeHtml += '<div class="xmind-casegen-coverage-notice is-stale">尚未生成需求覆盖分析结果。</div>';
      }
      var reanalyzeLabel = coverageState.running === true
        ? '<span class="xmind-casegen-coverage-spinner" aria-hidden="true"></span><span>分析中</span>'
        : (result ? '重新分析' : '开始分析');
      summaryDialogBodyEl.innerHTML = ''
        + '<div class="xmind-casegen-coverage-panel">'
        +   '<div class="xmind-casegen-coverage-toolbar">'
        +     '<div class="xmind-casegen-coverage-toolbar-copy">'
        +       summaryHtml
        +       noticeHtml
        +     '</div>'
        +     '<button type="button" class="secondary xmind-casegen-coverage-reanalyze ' + (coverageState.running === true ? 'is-running' : '') + '" data-coverage-action="reanalyze" ' + (coverageState.running === true ? 'aria-busy="true" ' : '') + (actionDisabled ? 'disabled' : '') + '>'
        +       reanalyzeLabel
        +     '</button>'
        +   '</div>'
        +   '<div class="xmind-casegen-coverage-layout">'
        +     '<section class="xmind-casegen-coverage-source" aria-label="需求原文覆盖片段">'
        +       '<div class="xmind-casegen-coverage-column-head">'
        +         '<strong>需求原文</strong>'
        +         '<span>点击片段查看对应用例</span>'
        +       '</div>'
        +       (result ? buildCoverageSourceLegendHtml(result) : '')
        +       (result ? buildCoverageSourceHtml(result, coverageState) : '<div class="xmind-casegen-coverage-empty">分析完成后会在这里按原文顺序展示覆盖状态。</div>')
        +     '</section>'
        +     '<section class="xmind-casegen-coverage-cases" aria-label="对应用例">'
        +       '<div class="xmind-casegen-coverage-column-head">'
        +         '<strong>对应用例</strong>'
        +         '<span>悬停用例查看详情</span>'
        +       '</div>'
        +       (result ? buildCoverageCaseListHtml(result, coverageState) : '<div class="xmind-casegen-coverage-empty">请选择或等待左侧片段分析结果。</div>')
        +     '</section>'
        +   '</div>'
        + '</div>';
      if (sourceAnchorState) restoreCoverageSourceAnchorState(sourceAnchorState);
      else restoreCoverageSourceScrollState(sourceScrollState);
    }


    function openCoverageDialog(options) {
      var dialogOptions = options || {};
      if (!hasActiveWorkspace()) {
        notifyFloatingStatus('请先新建生成页签', 'warn', 2500);
        return false;
      }
      var runningOperations = collectRunningGenerationOperations();
      var coverageState = ensureCoverageUiState();
      if (runningOperations.length > 0 && coverageState.running !== true) {
        notifyStatus('当前有 XMind 任务进行中，请等待完成后再查看覆盖', 'warn', { forceInline: true });
        return false;
      }
      var request = null;
      try {
        request = buildCoverageSourceRequest();
      } catch (err) {
        notifyStatus(err && err.message ? err.message : '需求覆盖分析上下文不可用', 'warn', { forceInline: true });
        return false;
      }
      hideOpenMindContextMenu();
      coverageHighlightedCaseId = '';
      openCoverageDialogShell();
      if (coverageState.result && !coverageState.selectedSegmentId) {
        coverageState.selectedSegmentId = String(coverageState.result.selectedSegmentId || '');
      }
      var hasResult = Boolean(coverageState.result);
      var resultSignature = coverageState.signature || (coverageState.result && coverageState.result.signature) || '';
      var stale = hasResult && resultSignature && String(resultSignature || '') !== String(request.signature || '');
      var shouldStart = dialogOptions.force === true || (!hasResult && coverageState.running !== true);
      if (stale && dialogOptions.force !== true) {
        persistXmindState(false);
        return true;
      }
      if (shouldStart) {
        startRequirementCoverageTask({
          request: request,
          force: dialogOptions.force === true,
        });
      } else {
        persistXmindState(false);
      }
      return true;
    }

    function handleClick(event) {
      var coverageActionTarget = event && event.target && event.target.closest
        ? event.target.closest('[data-coverage-action]')
        : null;
      if (coverageActionTarget) {
        var coverageActionId = String(coverageActionTarget.getAttribute('data-coverage-action') || '');
        if (coverageActionId === 'reanalyze' && coverageActionTarget.disabled !== true) {
          startRequirementCoverageTask({ force: true });
          return true;
        }
      }
      var coverageJumpTarget = event && event.target && event.target.closest
        ? event.target.closest('[data-coverage-jump]')
        : null;
      if (coverageJumpTarget && coverageJumpTarget.disabled !== true) {
        var coverageJumpStatus = String(coverageJumpTarget.getAttribute('data-coverage-jump') || '');
        if (coverageJumpStatus && jumpToCoverageStatus(coverageJumpStatus)) return true;
      }
      var coverageSelectedSegmentTarget = event && event.target && event.target.closest
        ? event.target.closest('[data-coverage-selected-segment]')
        : null;
      if (coverageSelectedSegmentTarget) {
        var coverageSelectedSegmentId = String(
          coverageSelectedSegmentTarget.getAttribute('data-coverage-selected-segment') || ''
        );
        if (coverageSelectedSegmentId) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          var selectedCoverageState = ensureCoverageUiState();
          selectedCoverageState.selectedSegmentId = coverageSelectedSegmentId;
          selectedCoverageState.updatedAt = now();
          persistXmindState(false);
          renderCoverageDialog({ resetSourceScroll: true });
          scrollCoverageSourceSegmentIntoView(coverageSelectedSegmentId);
          return true;
        }
      }
      var coverageSegmentTarget = event && event.target && event.target.closest
        ? event.target.closest('[data-coverage-segment]')
        : null;
      if (coverageSegmentTarget) {
        var coverageSegmentId = String(coverageSegmentTarget.getAttribute('data-coverage-segment') || '');
        if (coverageSegmentId) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          var coverageAnchorState = readCoverageSourceAnchorState(coverageSegmentId);
          var coverageState = ensureCoverageUiState();
          coverageState.selectedSegmentId = coverageSegmentId;
          coverageHighlightedCaseId = '';
          coverageState.updatedAt = now();
          persistXmindState(false);
          renderCoverageDialog({ sourceAnchorState: coverageAnchorState });
          return true;
        }
      }
      var coverageCaseTarget = event && event.target && event.target.closest
        ? event.target.closest('[data-coverage-case]')
        : null;
      if (coverageCaseTarget) {
        var coverageCaseId = String(coverageCaseTarget.getAttribute('data-coverage-case') || '');
        if (coverageCaseId) {
          coverageHighlightedCaseId = coverageCaseId;
          var coverage = ensureCoverageUiState();
          var result = coverage.result && typeof coverage.result === 'object' ? coverage.result : null;
          var matchedSegments = findCoverageSegmentsByCaseId(result, coverageCaseId);
          var currentId = String(coverage.selectedSegmentId || '');
          var hasCurrent = matchedSegments.some(function(segment) {
            return segment && String(segment.id || '') === currentId;
          });
          if (!hasCurrent && matchedSegments[0]) {
            coverage.selectedSegmentId = String(matchedSegments[0].id || coverage.selectedSegmentId || '');
          }
          coverage.updatedAt = now();
          persistXmindState(false);
          renderCoverageDialog();
          return true;
        }
      }
      return false;
    }

    function bind() {
      if (listenerBound) return;
      listenerBound = true;
      ensureCoverageCaseDetailTooltip();
      coverageButtonClickHandler = function() {
        if (isCoverageDialogOpen()) closeSummaryDialog();
        else openCoverageDialog();
      };
      coverageBodyClickHandler = function(event) {
        handleClick(event);
      };
      if (coverageBtn && typeof coverageBtn.addEventListener === 'function') {
        coverageBtn.addEventListener('click', coverageButtonClickHandler);
      }
      if (summaryDialogBodyEl && typeof summaryDialogBodyEl.addEventListener === 'function') {
        summaryDialogBodyEl.addEventListener('click', coverageBodyClickHandler);
      }
    }

    function unbind() {
      if (!listenerBound) return;
      listenerBound = false;
      if (coverageBtn && typeof coverageBtn.removeEventListener === 'function' && coverageButtonClickHandler) {
        coverageBtn.removeEventListener('click', coverageButtonClickHandler);
      }
      if (
        summaryDialogBodyEl
        && typeof summaryDialogBodyEl.removeEventListener === 'function'
        && coverageBodyClickHandler
      ) {
        summaryDialogBodyEl.removeEventListener('click', coverageBodyClickHandler);
      }
      coverageButtonClickHandler = null;
      coverageBodyClickHandler = null;
      if (coverageCaseTooltipController && typeof coverageCaseTooltipController.destroy === 'function') {
        coverageCaseTooltipController.destroy();
      }
      coverageCaseTooltipController = null;
      releaseCoverageRequirementImageObjectUrls();
    }

    function clearHighlightedCase() {
      coverageHighlightedCaseId = '';
    }

    return {
      bind: bind,
      unbind: unbind,
      handleClick: handleClick,
      openCoverageDialog: openCoverageDialog,
      renderCoverageDialog: renderCoverageDialog,
      hideCoverageCaseDetailTooltip: hideCoverageCaseDetailTooltip,
      releaseCoverageRequirementImageObjectUrls: releaseCoverageRequirementImageObjectUrls,
      clearHighlightedCase: clearHighlightedCase,
      getCoverageStatusMeta: getCoverageStatusMeta,
      getCoverageSegmentCaseIds: getCoverageSegmentCaseIds,
      getCoverageCaseRelation: getCoverageCaseRelation,
      findNextCoverageSegmentByStatus: findNextCoverageSegmentByStatus,
    };
  }

  return { create: create };
});
