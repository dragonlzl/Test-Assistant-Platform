(function() {
  function init(deps) {
    var xmindApi = deps && deps.xmindApi
      ? deps.xmindApi
      : (window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null);
    var defaultScaleStep = 0.15;
    var minScale = 0.3;
    var maxScale = 2.5;

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

    function stringifyCaseField(value) {
      if (Array.isArray(value)) {
        var textArr = value
          .map(function(v) {
            var base = v === undefined || v === null ? '' : v;
            return base.toString().trim();
          })
          .filter(Boolean);
        return textArr.join(' / ');
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

    function formatCaseText(value) {
      if (xmindApi && typeof xmindApi.formatXmindNodeValue === 'function') {
        return xmindApi.formatXmindNodeValue(value);
      }
      var text = stringifyCaseField(value);
      if (!text) return '-';
      return text.replace(/\s*\n+\s*/g, ' / ').trim() || '-';
    }

    function buildCaseFieldsFallback(item, fallbackModule) {
      var row = item || {};
      var moduleName = formatCaseText(row.module || row.module_name || row['模块'] || fallbackModule || '模块');
      var title = formatCaseText(row.title || row.case_title || row['用例标题'] || moduleName);
      var priority = formatCaseText(row.priority || row.level || row['优先级'] || 'P1');
      var preconditions = formatCaseText(row.preconditions || row.precondition || row['前提条件']);
      var steps = formatCaseText(row.steps || row.actions || row['操作步骤']);
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
          var text = formatCaseText(seg);
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

    function clampScale(value) {
      var num = Number(value);
      if (!isFinite(num)) return 1;
      if (num < minScale) return minScale;
      if (num > maxScale) return maxScale;
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

    function normalizeSearchKeyword(value) {
      var text = value === undefined || value === null ? '' : String(value);
      return text.trim().toLowerCase();
    }

    function collectSearchNodeIds(node, keyword, output) {
      if (!node || !keyword) return;
      var list = Array.isArray(output) ? output : [];
      var topicText = node && node.topic !== undefined && node.topic !== null
        ? String(node.topic)
        : '';
      if (topicText.toLowerCase().indexOf(keyword) !== -1 && node.id) {
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

    function bindViewerInteractions(viewerEl, canvasEl, instance) {
      if (!viewerEl || !canvasEl || !instance) return null;

      var controlsEl = viewerEl.querySelector ? viewerEl.querySelector('[data-mind-controls]') : null;
      var searchInputEl = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-search-input]')
        : null;
      var searchCountEl = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-search-count]')
        : null;
      var searchState = {
        keyword: '',
        ids: [],
        index: -1,
      };

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
        for (var i = 0; i < ids.length; i += 1) {
          var target = findMindNodeElement(instance, ids[i]);
          if (!target || !target.classList) continue;
          target.classList.add('xmind-search-hit');
        }
        if (ids.length && searchState.index >= 0 && searchState.index < ids.length) {
          var active = findMindNodeElement(instance, ids[searchState.index]);
          if (active && active.classList) {
            active.classList.add('xmind-search-active');
          }
        }
        setSearchCount();
      }

      function focusSearchIndex(index) {
        var ids = Array.isArray(searchState.ids) ? searchState.ids : [];
        if (!ids.length) {
          searchState.index = -1;
          applySearchClasses();
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
        var activeEl = findMindNodeElement(instance, activeId);
        if (activeEl && typeof instance.selectNode === 'function') {
          try {
            instance.selectNode(activeEl);
          } catch (err) {
            // ignore
          }
        }
      }

      function runSearch(options) {
        var opts = options || {};
        var keepIndex = opts.keepIndex === true;
        var keyword = normalizeSearchKeyword(searchInputEl ? searchInputEl.value : '');
        searchState.keyword = keyword;
        if (!keyword) {
          searchState.ids = [];
          searchState.index = -1;
          applySearchClasses();
          return;
        }
        var matchedIds = [];
        collectSearchNodeIds(instance ? instance.nodeData : null, keyword, matchedIds);
        searchState.ids = matchedIds;
        if (!matchedIds.length) {
          searchState.index = -1;
          applySearchClasses();
          return;
        }
        if (keepIndex && searchState.index >= 0 && searchState.index < matchedIds.length) {
          focusSearchIndex(searchState.index);
        } else {
          focusSearchIndex(0);
        }
      }

      function moveSearch(step) {
        if (!Array.isArray(searchState.ids) || !searchState.ids.length) return;
        var delta = Number(step);
        if (!isFinite(delta) || delta === 0) return;
        var base = searchState.index >= 0 ? searchState.index : 0;
        focusSearchIndex(base + delta);
      }

      function clearSearch() {
        if (searchInputEl) searchInputEl.value = '';
        searchState.keyword = '';
        searchState.ids = [];
        searchState.index = -1;
        applySearchClasses();
      }

      function onSearchInput() {
        runSearch({ keepIndex: false });
      }

      function onSearchKeydown(e) {
        if (!e) return;
        if (e.key !== 'Enter') return;
        if (e.preventDefault) e.preventDefault();
        if (e.shiftKey) moveSearch(-1);
        else moveSearch(1);
      }

      function getCanvasCenterPoint() {
        var rect = canvasEl.getBoundingClientRect();
        return {
          x: rect.left + (rect.width / 2),
          y: rect.top + (rect.height / 2),
        };
      }

      function zoomBy(step) {
        if (!instance || typeof instance.scale !== 'function') return;
        var current = resolveScale(instance);
        var next = clampScale(current + step);
        var center = getCanvasCenterPoint();
        instance.scale(next, center);
        updateViewerDragState(viewerEl, instance, false);
      }

      function zoomFit() {
        if (instance && typeof instance.scaleFit === 'function') {
          instance.scaleFit();
        }
        updateViewerDragState(viewerEl, instance, false);
      }

      var dragging = false;
      var lastX = 0;
      var lastY = 0;

      function startDragging(e) {
        if (!instance || typeof instance.move !== 'function') return;
        if (!e || e.button !== 0) return;
        if (resolveScale(instance) <= 1.01) return;
        if (controlsEl && controlsEl.contains && controlsEl.contains(e.target)) return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        updateViewerDragState(viewerEl, instance, true);
        if (e.preventDefault) e.preventDefault();
      }

      function moveDragging(e) {
        if (!dragging || !instance || typeof instance.move !== 'function') return;
        var nextX = e.clientX;
        var nextY = e.clientY;
        var dx = nextX - lastX;
        var dy = nextY - lastY;
        if (dx || dy) {
          instance.move(dx, dy);
          lastX = nextX;
          lastY = nextY;
        }
        if (e.preventDefault) e.preventDefault();
      }

      function stopDragging() {
        if (!dragging) return;
        dragging = false;
        updateViewerDragState(viewerEl, instance, false);
      }

      function onControlsClick(e) {
        var target = e && e.target && e.target.closest ? e.target.closest('[data-mind-action]') : null;
        if (!target || !target.dataset) return;
        var action = String(target.dataset.mindAction || '');
        if (action === 'zoom-in') {
          zoomBy(defaultScaleStep);
        } else if (action === 'zoom-out') {
          zoomBy(-defaultScaleStep);
        } else if (action === 'zoom-fit') {
          zoomFit();
        } else if (action === 'search-prev') {
          moveSearch(-1);
        } else if (action === 'search-next') {
          moveSearch(1);
        } else if (action === 'search-clear') {
          clearSearch();
          if (searchInputEl && typeof searchInputEl.focus === 'function') {
            try {
              searchInputEl.focus();
            } catch (err) {
              // ignore
            }
          }
        }
      }

      if (controlsEl && typeof controlsEl.addEventListener === 'function') {
        controlsEl.addEventListener('click', onControlsClick);
      }
      if (searchInputEl && typeof searchInputEl.addEventListener === 'function') {
        searchInputEl.addEventListener('input', onSearchInput);
        searchInputEl.addEventListener('keydown', onSearchKeydown);
      }
      if (canvasEl && typeof canvasEl.addEventListener === 'function') {
        canvasEl.addEventListener('mousedown', startDragging, true);
      }
      if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
        window.addEventListener('mousemove', moveDragging);
        window.addEventListener('mouseup', stopDragging);
      }

      setSearchCount();
      updateViewerDragState(viewerEl, instance, false);

      return function cleanup() {
        stopDragging();
        clearSearchClasses();
        if (controlsEl && typeof controlsEl.removeEventListener === 'function') {
          controlsEl.removeEventListener('click', onControlsClick);
        }
        if (searchInputEl && typeof searchInputEl.removeEventListener === 'function') {
          searchInputEl.removeEventListener('input', onSearchInput);
          searchInputEl.removeEventListener('keydown', onSearchKeydown);
        }
        if (canvasEl && typeof canvasEl.removeEventListener === 'function') {
          canvasEl.removeEventListener('mousedown', startDragging, true);
        }
        if (typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function') {
          window.removeEventListener('mousemove', moveDragging);
          window.removeEventListener('mouseup', stopDragging);
        }
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
      if (typeof instance.destroy !== 'function') return;
      try {
        instance.destroy();
      } catch (err) {
        // ignore
      }
    }

    function renderMindMap(container, mindData, options) {
      var opts = options || {};
      var ctor = getMindCtor();
      if (!ctor) throw new Error('MindElixir 依赖未就绪');
      if (!container) throw new Error('缺少思维导图容器');
      if (!mindData || !mindData.nodeData) throw new Error('缺少思维导图数据');

      destroyMindMap(opts.instance || null);
      container.innerHTML = '';

      var controlsHtml = ''
        + '<div class="xmind-structure-controls" data-mind-controls>'
        + '<div class="xmind-search-group">'
        + '<input class="xmind-search-input" type="search" data-mind-search-input placeholder="搜索节点内容" aria-label="搜索节点内容" />'
        + '<span class="xmind-search-count is-empty" data-mind-search-count>0/0</span>'
        + '<button class="secondary xmind-search-btn" type="button" data-mind-action="search-prev" title="上一个">↑</button>'
        + '<button class="secondary xmind-search-btn" type="button" data-mind-action="search-next" title="下一个">↓</button>'
        + '<button class="secondary xmind-search-btn" type="button" data-mind-action="search-clear" title="清空搜索">清空</button>'
        + '</div>'
        + '<div class="xmind-zoom-group">'
        + '<button class="secondary xmind-zoom-btn" type="button" data-mind-action="zoom-out" title="缩小">-</button>'
        + '<button class="secondary xmind-zoom-btn" type="button" data-mind-action="zoom-fit" title="全览">全览</button>'
        + '<button class="secondary xmind-zoom-btn" type="button" data-mind-action="zoom-in" title="放大">+</button>'
        + '</div>'
        + '</div>';
      var canvasHtml = '<div class="xmind-structure-canvas" data-mind-canvas></div>';
      container.innerHTML = controlsHtml + canvasHtml;
      var canvasEl = container.querySelector('[data-mind-canvas]');
      if (!canvasEl) throw new Error('思维导图画布初始化失败');

      var darkMode = typeof opts.darkMode === 'boolean' ? opts.darkMode : resolveDarkMode();
      var theme = buildTheme(darkMode);
      var direction = normalizeDirection(opts.direction, ctor);
      var instance = new ctor({
        el: canvasEl,
        direction: direction,
        editable: false,
        contextMenu: false,
        toolBar: false,
        keypress: false,
        mouseSelectionButton: 2,
        allowUndo: false,
        overflowHidden: false,
        theme: theme || undefined,
      });
      instance.init({
        nodeData: mindData.nodeData,
        direction: direction,
      });

      var cleanup = bindViewerInteractions(container, canvasEl, instance);
      if (cleanup) {
        instance.__tapXmindCleanupList = [cleanup];
      } else {
        instance.__tapXmindCleanupList = [];
      }

      setTimeout(function() {
        if (instance && typeof instance.scaleFit === 'function') {
          try {
            instance.scaleFit();
            updateViewerDragState(container, instance, false);
          } catch (err) {
            // ignore
          }
        }
      }, 0);
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
      renderMindMap: renderMindMap,
      refreshMindTheme: refreshMindTheme,
      destroyMindMap: destroyMindMap,
    };
  }

  window.app = window.app || {};
  window.app.mindElixirCore = { init: init };
})();
