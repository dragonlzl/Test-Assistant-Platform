(function() {
  'use strict';

  var tooltipSequence = 0;

  function normalizeText(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/\r\n?/g, '\n')
      .trim();
  }

  function normalizeSteps(value) {
    if (Array.isArray(value)) {
      return value.map(function(item) {
        return normalizeText(item);
      }).filter(Boolean);
    }
    var text = normalizeText(value);
    if (!text) return [];
    return text.split(/\n+/).map(function(item) {
      return normalizeText(item);
    }).filter(Boolean);
  }

  function normalizeCaseDetail(item) {
    var source = item && typeof item === 'object' ? item : {};
    return {
      title: normalizeText(source.title || source.caseTitle || source.case_title || source.name || '') || '未命名用例',
      module: normalizeText(source.module || source.moduleName || source.module_name || ''),
      preconditions: normalizeText(source.preconditions || source.precondition || source['前置条件'] || '') || '未填写',
      steps: normalizeSteps(source.steps || source.step || source['操作步骤'] || source['步骤'] || ''),
      expected: normalizeText(source.expected || source.expect || source['预期结果'] || '') || '未填写',
    };
  }

  function clamp(value, min, max) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  }

  function normalizeRect(rect) {
    var source = rect && typeof rect === 'object' ? rect : {};
    var left = Number(source.left || 0);
    var top = Number(source.top || 0);
    var width = Number(source.width || 0);
    var height = Number(source.height || 0);
    var right = Number.isFinite(Number(source.right)) ? Number(source.right) : left + width;
    var bottom = Number.isFinite(Number(source.bottom)) ? Number(source.bottom) : top + height;
    return {
      left: Number.isFinite(left) ? left : 0,
      top: Number.isFinite(top) ? top : 0,
      right: Number.isFinite(right) ? right : 0,
      bottom: Number.isFinite(bottom) ? bottom : 0,
      width: Number.isFinite(width) ? width : 0,
      height: Number.isFinite(height) ? height : 0,
    };
  }

  function computeTooltipPosition(triggerRect, tooltipRect, viewport, gap) {
    var trigger = normalizeRect(triggerRect);
    var tooltip = normalizeRect(tooltipRect);
    var viewportInfo = viewport && typeof viewport === 'object' ? viewport : {};
    var viewportWidth = Math.max(0, Number(viewportInfo.width || 0) || 0);
    var viewportHeight = Math.max(0, Number(viewportInfo.height || 0) || 0);
    var safeGap = Math.max(6, Number(gap || 12) || 12);
    var margin = 12;
    var placement = 'left';
    var left = trigger.left - tooltip.width - safeGap;
    var top = trigger.top + ((trigger.height - tooltip.height) / 2);

    if (left < margin) {
      var rightCandidate = trigger.right + safeGap;
      if (rightCandidate + tooltip.width <= viewportWidth - margin) {
        left = rightCandidate;
        placement = 'right';
      } else {
        left = trigger.left;
        top = trigger.bottom + safeGap;
        placement = 'below';
        if (top + tooltip.height > viewportHeight - margin) {
          top = trigger.top - tooltip.height - safeGap;
          placement = 'above';
        }
      }
    }

    left = clamp(left, margin, Math.max(margin, viewportWidth - tooltip.width - margin));
    top = clamp(top, margin, Math.max(margin, viewportHeight - tooltip.height - margin));
    return {
      left: Math.round(left),
      top: Math.round(top),
      placement: placement,
    };
  }

  function createNoopController() {
    return {
      hide: function() {},
      destroy: function() {},
    };
  }

  function init(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var root = opts.root;
    if (!root || typeof root.addEventListener !== 'function') return createNoopController();
    var documentRef = opts.document || root.ownerDocument || (typeof document !== 'undefined' ? document : null);
    var windowRef = opts.window || (documentRef && documentRef.defaultView) || (typeof window !== 'undefined' ? window : null);
    if (!documentRef || !windowRef) return createNoopController();
    var getCaseDetail = typeof opts.getCaseDetail === 'function' ? opts.getCaseDetail : function() { return null; };
    var delayMs = Math.max(0, Number(opts.delayMs || 420) || 420);
    var tooltipEl = null;
    var pendingTimer = 0;
    var pendingTrigger = null;
    var activeTrigger = null;

    function ensureTooltip() {
      if (tooltipEl && tooltipEl.parentNode) return tooltipEl;
      if (!documentRef.body || typeof documentRef.createElement !== 'function') return null;
      tooltipSequence += 1;
      tooltipEl = documentRef.createElement('div');
      tooltipEl.id = 'xmindCoverageCaseDetailTooltip-' + String(tooltipSequence);
      tooltipEl.className = 'xmind-casegen-coverage-case-detail-tooltip';
      tooltipEl.setAttribute('role', 'tooltip');
      tooltipEl.setAttribute('aria-hidden', 'true');
      documentRef.body.appendChild(tooltipEl);
      return tooltipEl;
    }

    function appendTextSection(container, labelText, valueText) {
      var section = documentRef.createElement('section');
      section.className = 'xmind-casegen-coverage-case-detail-section';
      var label = documentRef.createElement('strong');
      label.className = 'xmind-casegen-coverage-case-detail-label';
      label.textContent = labelText;
      var value = documentRef.createElement('div');
      value.className = 'xmind-casegen-coverage-case-detail-value';
      value.textContent = valueText;
      section.appendChild(label);
      section.appendChild(value);
      container.appendChild(section);
    }

    function appendStepsSection(container, steps) {
      var section = documentRef.createElement('section');
      section.className = 'xmind-casegen-coverage-case-detail-section';
      var label = documentRef.createElement('strong');
      label.className = 'xmind-casegen-coverage-case-detail-label';
      label.textContent = '操作步骤';
      var list = documentRef.createElement('div');
      list.className = 'xmind-casegen-coverage-case-detail-steps';
      var values = Array.isArray(steps) && steps.length ? steps : ['未填写'];
      values.forEach(function(step) {
        var row = documentRef.createElement('div');
        row.className = 'xmind-casegen-coverage-case-detail-step';
        row.textContent = step;
        list.appendChild(row);
      });
      section.appendChild(label);
      section.appendChild(list);
      container.appendChild(section);
    }

    function renderTooltip(item) {
      var tooltip = ensureTooltip();
      if (!tooltip) return null;
      var detail = normalizeCaseDetail(item);
      tooltip.innerHTML = '';
      var head = documentRef.createElement('div');
      head.className = 'xmind-casegen-coverage-case-detail-head';
      var title = documentRef.createElement('strong');
      title.className = 'xmind-casegen-coverage-case-detail-title';
      title.textContent = detail.title;
      head.appendChild(title);
      if (detail.module) {
        var module = documentRef.createElement('span');
        module.className = 'xmind-casegen-coverage-case-detail-module';
        module.textContent = detail.module;
        head.appendChild(module);
      }
      tooltip.appendChild(head);
      appendTextSection(tooltip, '前提条件', detail.preconditions);
      appendStepsSection(tooltip, detail.steps);
      appendTextSection(tooltip, '预期结果', detail.expected);
      return tooltip;
    }

    function resolveTrigger(target) {
      if (!target || typeof target.closest !== 'function') return null;
      var trigger = target.closest('[data-coverage-case-detail-trigger]');
      if (!trigger || !root.contains(trigger)) return null;
      return trigger;
    }

    function resolveCaseId(trigger) {
      if (!trigger) return '';
      var owner = typeof trigger.closest === 'function' ? trigger.closest('[data-coverage-case]') : null;
      return owner && owner.getAttribute ? String(owner.getAttribute('data-coverage-case') || '') : '';
    }

    function positionTooltip(trigger, tooltip) {
      if (!trigger || !tooltip || typeof trigger.getBoundingClientRect !== 'function') return;
      var position = computeTooltipPosition(trigger.getBoundingClientRect(), tooltip.getBoundingClientRect(), {
        width: Number(windowRef.innerWidth || 0),
        height: Number(windowRef.innerHeight || 0),
      }, 12);
      tooltip.style.left = position.left + 'px';
      tooltip.style.top = position.top + 'px';
      tooltip.setAttribute('data-placement', position.placement);
    }

    function hide() {
      if (pendingTimer) {
        windowRef.clearTimeout(pendingTimer);
        pendingTimer = 0;
      }
      pendingTrigger = null;
      if (activeTrigger && tooltipEl && activeTrigger.getAttribute('aria-describedby') === tooltipEl.id) {
        activeTrigger.removeAttribute('aria-describedby');
      }
      activeTrigger = null;
      if (!tooltipEl) return;
      tooltipEl.classList.remove('is-open');
      tooltipEl.setAttribute('aria-hidden', 'true');
    }

    function show(trigger) {
      if (!trigger || !root.contains(trigger)) return;
      var caseId = resolveCaseId(trigger);
      var item = caseId ? getCaseDetail(caseId) : null;
      if (!item) {
        hide();
        return;
      }
      var tooltip = renderTooltip(item);
      if (!tooltip) return;
      activeTrigger = trigger;
      trigger.setAttribute('aria-describedby', tooltip.id);
      positionTooltip(trigger, tooltip);
      tooltip.setAttribute('aria-hidden', 'false');
      tooltip.classList.add('is-open');
    }

    function scheduleShow(trigger) {
      if (activeTrigger === trigger && tooltipEl && tooltipEl.classList.contains('is-open')) return;
      hide();
      pendingTrigger = trigger;
      pendingTimer = windowRef.setTimeout(function() {
        pendingTimer = 0;
        var target = pendingTrigger;
        pendingTrigger = null;
        show(target);
      }, delayMs);
    }

    function handleMouseOver(event) {
      var trigger = resolveTrigger(event && event.target);
      if (!trigger) return;
      var related = event && event.relatedTarget ? event.relatedTarget : null;
      if (related && trigger.contains(related)) return;
      scheduleShow(trigger);
    }

    function handleMouseOut(event) {
      var trigger = resolveTrigger(event && event.target);
      if (!trigger) return;
      var related = event && event.relatedTarget ? event.relatedTarget : null;
      if (related && trigger.contains(related)) return;
      if (trigger === pendingTrigger || trigger === activeTrigger) hide();
    }

    function destroy() {
      hide();
      root.removeEventListener('mouseover', handleMouseOver);
      root.removeEventListener('mouseout', handleMouseOut);
      root.removeEventListener('scroll', hide, true);
      windowRef.removeEventListener('resize', hide);
      windowRef.removeEventListener('blur', hide);
      if (tooltipEl && tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
      tooltipEl = null;
    }

    root.addEventListener('mouseover', handleMouseOver);
    root.addEventListener('mouseout', handleMouseOut);
    root.addEventListener('scroll', hide, true);
    windowRef.addEventListener('resize', hide);
    windowRef.addEventListener('blur', hide);

    return {
      hide: hide,
      destroy: destroy,
    };
  }

  window.app = window.app || {};
  window.app.xmindCoverageCaseTooltipCore = {
    init: init,
    normalizeCaseDetail: normalizeCaseDetail,
    computeTooltipPosition: computeTooltipPosition,
  };
})();
