(function() {
  function init(ctx) {
    if (!ctx) return;
    var state = ctx.state || {};
    var core = ctx.core || {};
    var utils = ctx.utils || {};
    var config = ctx.config || {};
    var api = ctx.tempExecApi || {};
    var setStatus = core.setStatus || utils.setStatus || function() {};
    var switchTab = core.switchTab || function() {};
    var scrollElementIntoView = core.scrollElementIntoView || function() {};
    var downloadText = utils.downloadText || core.downloadText || function() {};
    var formatCompactTimestamp = core.formatCompactTimestamp || function() { return Date.now().toString(); };
    var escapeHtml = core.escapeHtml || utils.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var normalizeRequirementName = core.normalizeRequirementName || function(name) { return name || ''; };
    var defaultTempExecPageSize = config.defaultTempExecPageSize || 20;

    var tempExecDropZone = document.getElementById('tempExecDropZone');
    var tempExecInput = document.getElementById('tempExecInput');
    var tempExecStatus = document.getElementById('tempExecStatus');
    var tempExecNav = document.getElementById('tempExecNav');
    var tempVersionGrid = document.getElementById('tempVersionGrid');
    var tempExecToolbar = document.getElementById('tempExecToolbar');
    var tempExecToolbarCard = document.getElementById('tempExecToolbarCard');
    var tempexecFlowNav = document.getElementById('tempexecFlowNav');
    var toggleTempReqBtn = document.getElementById('toggleTempReq');
    var toggleTempVersionBtn = document.getElementById('toggleTempVersion');
    var tempExecDrawerEl = document.getElementById('tempExecDrawer');
    var tempExecOverviewDrawerEl = document.getElementById('tempExecOverviewDrawer');
    var openTempExecDrawerBtn = document.getElementById('openTempExecDrawerBtn');
    var openTempExecViewNavBtn = document.getElementById('openTempExecViewNavBtn');
    var openTempExecOverviewNavBtn = document.getElementById('openTempExecOverviewNavBtn');
    var openTempExecBackupNavBtn = document.getElementById('openTempExecBackupNavBtn');
    var closeTempExecDrawerBtn = document.getElementById('closeTempExecDrawerBtn');
    var closeTempExecOverviewDrawerBtn = document.getElementById('closeTempExecOverviewDrawerBtn');
    var exportTempExecCasesXmindBtn = document.getElementById('exportTempExecCasesXmindBtn');
    var caseTemplateDropdown = document.getElementById('caseTemplateDropdown');
    var caseTemplateToggle = document.getElementById('caseTemplateToggle');
    var caseTemplateMenu = document.getElementById('caseTemplateMenu');
    var caseTemplateLoaded = false;
    var caseTemplateLoading = false;
    var caseTemplateList = [];
    var localTemplateHandles = {};
    var supportDirPicker = typeof window.showDirectoryPicker === 'function';
    function getTemplateBase() {
      var path = (window.location && window.location.pathname) ? window.location.pathname : '';
      if (!path) return 'caseTemplate/';
      var trimmed = path.replace(/[^/]*$/, '');
      return trimmed + 'caseTemplate/';
    }
    function buildTemplateUrl(name, bust) {
      var base = getTemplateBase();
      var url = name ? (base + encodeURIComponent(name)) : base;
      if (bust) {
        var stamp = Date.now();
        url += (url.indexOf('?') === -1 ? '?' : '&') + 't=' + stamp;
      }
      return url;
    }
    var navHoverFileId = '';
    var navHoverReqName = '';
    var debounce = utils.debounce || function(fn, wait) {
      var delay = Number(wait) || 150;
      var t = null;
      return function() {
        var args = arguments;
        var ctxThis = this;
        clearTimeout(t);
        t = setTimeout(function() {
          fn.apply(ctxThis, args);
        }, delay);
      };
    };
    function normalizeTemplateName(raw) {
      if (!raw) return '';
      var clean = raw.split('?')[0] || '';
      clean = clean.replace(/\\/g, '/');
      var name = clean.split('/').pop() || '';
      try {
        name = decodeURIComponent(name);
      } catch (err) {
        // ignore decode errors
      }
      if (name.toLowerCase().lastIndexOf('.xmind') === name.length - 6) {
        name = name.slice(0, -6);
      }
      return name.trim();
    }
    function parseTemplateListFromHtml(raw) {
      if (!raw) return [];
      var names = [];
      try {
        if (typeof DOMParser === 'function') {
          var parser = new DOMParser();
          var doc = parser.parseFromString(raw, 'text/html');
          var anchors = Array.prototype.slice.call(doc.getElementsByTagName('a'));
          anchors.forEach(function(anchor) {
            var href = anchor.getAttribute('href') || '';
            var text = anchor.textContent || '';
            [href, text].forEach(function(val) {
              if (val && val.toLowerCase().indexOf('.xmind') !== -1) {
                var parsed = normalizeTemplateName(val);
                if (parsed) names.push(parsed);
              }
            });
          });
        }
      } catch (err) {
        console.warn('解析模版目录失败，回退正则解析', err);
      }
      if (!names.length) {
        var regex = /href\s*=\s*"([^"]+\.xmind)"/gi;
        var match = regex.exec(raw);
        while (match) {
          var candidate = normalizeTemplateName(match[1]);
          if (candidate) names.push(candidate);
          match = regex.exec(raw);
        }
      }
      if (!names.length) {
        var textRegex = /([^\s"'<>]+\.xmind)/gi;
        var textMatch = textRegex.exec(raw);
        while (textMatch) {
          var candidateText = normalizeTemplateName(textMatch[1]);
          if (candidateText) names.push(candidateText);
          textMatch = textRegex.exec(raw);
        }
      }
      var unique = [];
      var seen = new Set();
      names.forEach(function(name) {
        var lower = name.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          unique.push(name);
        }
      });
      unique.sort(function(a, b) { return a.localeCompare(b, 'zh-Hans-CN'); });
      return unique;
    }
    function renderTemplateMenu(list, loading, errorText) {
      if (!caseTemplateMenu) return;
      var localNames = Object.keys(localTemplateHandles || {});
      if (loading) {
        caseTemplateMenu.innerHTML = '<div class="template-menu-empty">正在加载模版...</div>';
        return;
      }
      if (errorText) {
        caseTemplateMenu.innerHTML = '<div class="template-menu-empty">' + escapeHtml(errorText) + '</div>';
        return;
      }
      var parts = [];
      if (list && list.length) {
        parts.push(list.map(function(name) {
          return '<button type="button" class="template-option" data-template-name="' + escapeHtml(name) + '" data-template-source="remote">' + escapeHtml(name) + '</button>';
        }).join(''));
      }
      if (localNames.length) {
        parts.push(localNames.map(function(name) {
          return '<button type="button" class="template-option" data-template-name="' + escapeHtml(name) + '" data-template-source="local">' + escapeHtml(name) + '（本地）</button>';
        }).join(''));
      }
      if (!parts.length) {
        parts.push('<div class="template-menu-empty">未找到 .xmind 模版，请检查 caseTemplate 目录或 manifest</div>');
      }
      caseTemplateMenu.innerHTML = parts.join('');
    }
    function closeTemplateDropdown() {
      if (caseTemplateMenu) caseTemplateMenu.classList.add('hidden');
      if (caseTemplateDropdown) caseTemplateDropdown.classList.remove('open');
    }
    function openTemplateDropdown(forceRefresh) {
      if (!caseTemplateDropdown || !caseTemplateMenu) return;
      caseTemplateDropdown.classList.add('open');
      caseTemplateMenu.classList.remove('hidden');
      if (forceRefresh) {
        caseTemplateLoaded = false;
        renderTemplateMenu([], true, '');
      } else if (!caseTemplateLoaded && !caseTemplateLoading) {
        renderTemplateMenu([], true, '');
      }
      loadCaseTemplates(forceRefresh);
    }

    var tempExecDrawer = window.app.drawer && window.app.drawer.createDrawer({
      drawerId: 'tempExecDrawer',
      openButtons: ['openTempExecDrawerBtn'],
      closeButtons: ['closeTempExecDrawerBtn'],
      onClose: closeTemplateDropdown,
    });
    var tempExecOverviewDrawer = window.app.drawer && window.app.drawer.createDrawer({
      drawerId: 'tempExecOverviewDrawer',
      openButtons: ['openTempExecOverviewNavBtn', 'tempExecOverviewBtn'],
      closeButtons: ['closeTempExecOverviewDrawerBtn'],
    });
    if (tempExecDrawer) {
      var tabButtons = document.querySelectorAll('[data-tab-btn]');
      tabButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (btn && btn.dataset && btn.dataset.tabBtn !== 'tempexec') {
            tempExecDrawer.close();
            if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
          }
        });
      });
    }
    function showTempExecView(options) {
      var shouldScroll = !options || options.scroll !== false;
      switchTab('tempexec');
      updateTempExecToolbarOffset();
      if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
      if (tempExecDrawer) tempExecDrawer.close();
      if (tempExecViewSection) {
        tempExecViewSection.classList.remove('hidden');
        if (shouldScroll) {
          scrollElementIntoView(tempExecViewSection, 'smooth', 140);
        }
      }
    }
    function showTempExecOverview() {
      switchTab('tempexec');
      updateTempExecToolbarOffset();
      if (tempExecDrawer) tempExecDrawer.close();
      if (tempExecOverviewDrawer) tempExecOverviewDrawer.open();
      if (tempExecOverviewSection) {
        tempExecOverviewSection.classList.remove('hidden');
        scrollElementIntoView(tempExecOverviewSection, 'smooth', 140);
      }
    }
    function focusTempExecBackup() {
      switchTab('tempexec');
      if (tempExecDrawer) tempExecDrawer.open();
      var drawerBody = tempExecDrawerEl && tempExecDrawerEl.querySelector('.drawer-body');
      if (drawerBody) drawerBody.scrollTop = 0;
      if (exportTempExecConfigBtn && typeof exportTempExecConfigBtn.focus === 'function') {
        exportTempExecConfigBtn.focus({ preventScroll: true });
      }
    }
    if (openTempExecViewNavBtn) {
      openTempExecViewNavBtn.addEventListener('click', function() {
        showTempExecView();
      });
    }
    if (openTempExecOverviewNavBtn) {
      openTempExecOverviewNavBtn.addEventListener('click', function() {
        showTempExecOverview();
      });
    }
    if (openTempExecBackupNavBtn) {
      openTempExecBackupNavBtn.addEventListener('click', function() {
        focusTempExecBackup();
      });
    }

    var lastToolbarNavHeight = 0;
    function updateTempExecToolbarOffset() {
      if (!tempexecFlowNav) return;
      var rect = tempexecFlowNav.getBoundingClientRect ? tempexecFlowNav.getBoundingClientRect() : null;
      var height = rect && rect.height ? rect.height : (tempexecFlowNav.scrollHeight || 0);
      if (!height && tempexecFlowNav.classList && tempexecFlowNav.classList.contains('hidden')) return;
      var resolved = height && height > 0 ? height : 120;
      if (Math.abs(resolved - lastToolbarNavHeight) < 1) return;
      lastToolbarNavHeight = resolved;
      document.documentElement.style.setProperty('--tempexec-nav-height', Math.round(resolved) + 'px');
    }
    var updateToolbarOffsetDebounced = debounce(updateTempExecToolbarOffset, 200);
    window.addEventListener('resize', updateToolbarOffsetDebounced);
    setTimeout(updateTempExecToolbarOffset, 80);
    async function importLocalTemplate(name) {
      if (!name || !localTemplateHandles[name]) return;
      try {
        var handle = localTemplateHandles[name];
        var file = await handle.getFile();
        await api.importTempExecFiles([file]);
      } catch (err) {
        if (tempExecStatus) setStatus(tempExecStatus, '导入本地模版失败：' + (err && err.message ? err.message : '未知错误'), 'err');
        console.warn('导入本地模版失败', err);
      }
    }
    async function pickLocalTemplateFolder() {
      if (!supportDirPicker) {
        if (tempExecStatus) setStatus(tempExecStatus, '当前浏览器不支持本地文件夹选择，请使用支持 File System Access 的浏览器', 'warn');
        return;
      }
      try {
        var dir = await window.showDirectoryPicker();
        var map = {};
        for await (var entry of dir.values()) {
          if (!entry) continue;
          if (entry.kind === 'file' && entry.name && entry.name.toLowerCase().indexOf('.xmind') === entry.name.length - 6) {
            var baseName = normalizeTemplateName(entry.name);
            if (baseName) map[baseName] = entry;
          }
        }
        localTemplateHandles = map;
        if (!Object.keys(localTemplateHandles).length) {
          if (tempExecStatus) setStatus(tempExecStatus, '选择的文件夹中未找到 .xmind 文件', 'warn');
        } else {
          renderTemplateMenu(caseTemplateList, false, '');
          if (tempExecStatus) setStatus(tempExecStatus, '已加载本地模版目录', 'ok');
        }
      } catch (err) {
        if (err && (err.name === 'AbortError' || err.code === 20)) return;
        console.warn('选择本地模版文件夹失败', err);
        if (tempExecStatus) setStatus(tempExecStatus, '选择本地模版文件夹失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      }
    }
    function applyTemplateList(list) {
      caseTemplateList = list || [];
      caseTemplateLoaded = true;
      renderTemplateMenu(caseTemplateList, false, '');
    }
    async function fetchTemplateManifest(forceRefresh) {
      var manifestNames = [];
      var candidates = ['manifest.json', 'templates.json', 'caseTemplates.json'];
      for (var i = 0; i < candidates.length; i += 1) {
        var name = candidates[i];
        try {
          var res = await fetch(buildTemplateUrl(name, forceRefresh), { cache: 'no-store' });
          if (!res.ok) continue;
          var json = await res.json();
          if (Array.isArray(json)) {
            manifestNames = json.map(function(item) {
              return typeof item === 'string' ? item : '';
            }).filter(function(item) { return Boolean(item); });
            if (manifestNames.length) return manifestNames;
          }
        } catch (err) {
          // ignore and try next
        }
      }
      return [];
    }
    async function fetchTemplateDirectory(forceRefresh) {
      try {
        var res = await fetch(buildTemplateUrl('', forceRefresh), { cache: 'no-store' });
        if (!res || !res.ok) return [];
        var html = await res.text();
        return parseTemplateListFromHtml(html);
      } catch (err) {
        console.warn('读取 caseTemplate 目录失败', err);
        return [];
      }
    }
    function dedupeAndSort(list) {
      var seen = new Set();
      var result = [];
      (list || []).forEach(function(name) {
        var normalized = normalizeTemplateName(name);
        if (normalized && !seen.has(normalized.toLowerCase())) {
          seen.add(normalized.toLowerCase());
          result.push(normalized);
        }
      });
      result.sort(function(a, b) { return a.localeCompare(b, 'zh-Hans-CN'); });
      return result;
    }
    function mergeTemplateSources(manifestList, dirList) {
      var dirClean = dedupeAndSort(dirList);
      var manifestClean = dedupeAndSort(manifestList);
      if (dirClean.length) return dirClean;
      return manifestClean;
    }
    async function loadCaseTemplates(forceRefresh) {
      if (!caseTemplateMenu || caseTemplateLoading) return;
      caseTemplateLoading = true;
      try {
        var manifest = await fetchTemplateManifest(forceRefresh);
        var dirList = await fetchTemplateDirectory(forceRefresh);
        var merged = mergeTemplateSources(manifest, dirList);
        if (merged && merged.length) {
          var usedDir = dirList && dirList.length;
          applyTemplateList(merged);
          if (usedDir && manifest && manifest.length) {
            var manifestSet = new Set(manifest.map(function(n) { return normalizeTemplateName(n).toLowerCase(); }).filter(Boolean));
            var dirSet = new Set(dirList.map(function(n) { return normalizeTemplateName(n).toLowerCase(); }).filter(Boolean));
            var inconsistent = manifestSet.size !== dirSet.size || Array.from(dirSet).some(function(n) { return !manifestSet.has(n); });
            if (inconsistent && tempExecStatus) {
              setStatus(tempExecStatus, '已按目录刷新模版列表，manifest 已与目录对齐', 'ok');
            }
          }
          return;
        }
        throw new Error('未能获取目录列表');
      } catch (err) {
        caseTemplateLoaded = false;
        caseTemplateList = [];
        renderTemplateMenu([], false, '未能读取 caseTemplate 目录，请确认使用本地 HTTP 服务或补充 manifest.json');
        console.warn('加载常用用例模版失败', err);
      } finally {
        caseTemplateLoading = false;
      }
    }
    async function importTemplateByName(name) {
      if (!name || !api.importTempExecFiles) return;
      var fileName = name + '.xmind';
      if (tempExecStatus) setStatus(tempExecStatus, '正在获取模版【' + name + '】...', '');
      try {
        var url = buildTemplateUrl(fileName, true);
        var res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        var blob = await res.blob();
        var mime = blob && blob.type ? blob.type : 'application/octet-stream';
        var file = typeof File === 'function'
          ? new File([blob], fileName, { type: mime })
          : (function() {
              var shim = blob.slice(0, blob.size, mime);
              shim.name = fileName;
              return shim;
            })();
        await api.importTempExecFiles([file]);
      } catch (err) {
        console.warn('导入模版失败', err);
        var reason = err && err.message ? err.message : '未知错误';
        if (localTemplateHandles && localTemplateHandles[name]) {
          if (tempExecStatus) setStatus(tempExecStatus, '在线读取失败，尝试使用本地模版...', 'warn');
          importLocalTemplate(name);
          return;
        }
        if (supportDirPicker) {
          if (tempExecStatus) setStatus(tempExecStatus, '导入模版失败：' + reason + '，可点击下拉菜单选择本地 caseTemplate 文件夹', 'warn');
        } else if (tempExecStatus) {
          setStatus(tempExecStatus, '导入模版失败：' + reason + '，请确认已通过本地 HTTP 服务访问且文件存在于 caseTemplate/ 下', 'err');
        }
      }
    }
  function clearTempNavDragHints() {
    tempExecNav.querySelectorAll('.dragover').forEach(function(el) { el.classList.remove('dragover'); });
    tempExecNav.querySelectorAll('.dragover-target').forEach(function(el) { el.classList.remove('dragover-target'); });
    navHoverFileId = '';
    clearNavPlaceholder();
  }
    var navPlaceholderEl = null;
    function clearNavPlaceholder() {
      if (navPlaceholderEl && navPlaceholderEl.parentNode) {
        navPlaceholderEl.parentNode.removeChild(navPlaceholderEl);
      }
      navPlaceholderEl = null;
    }
    function renderNavPlaceholder(container, beforeId) {
      if (!container) {
        clearNavPlaceholder();
        return;
      }
      var list = container.classList.contains('temp-req-grid')
        ? container
        : container.querySelector('.temp-req-list');
      if (!list) {
        clearNavPlaceholder();
        return;
      }
      if (!navPlaceholderEl) {
        navPlaceholderEl = document.createElement('div');
        navPlaceholderEl.className = 'temp-drag-placeholder';
        navPlaceholderEl.textContent = '放置到此';
      }
      if (navPlaceholderEl.parentNode !== list) {
        list.appendChild(navPlaceholderEl);
      }
      if (beforeId) {
        var targetRow = list.querySelector('[data-temp-file="' + beforeId + '"]');
        if (targetRow && targetRow !== navPlaceholderEl.nextSibling) {
          list.insertBefore(navPlaceholderEl, targetRow);
          return;
        }
      }
      // ensure placeholder stays visible without forcing reflow
      list.appendChild(navPlaceholderEl);
    }
    function setNavHoverTarget(container, pointerY) {
      if (!container) return;
      var rows = Array.from(container.querySelectorAll('[data-temp-file]'));
      var candidateId = '';
      rows.some(function(row) {
        var rect = row.getBoundingClientRect();
        if (pointerY < rect.top + rect.height / 2) {
          candidateId = row.dataset.tempFile || '';
          return true;
        }
        return false;
      });
      navHoverFileId = candidateId;
      rows.forEach(function(row) {
        row.classList.toggle('dragover-target', row.dataset.tempFile === navHoverFileId);
      });
    }
    var tempExecView = document.getElementById('tempExecView');
    var tempExecMindBtn = document.getElementById('tempExecMindBtn');
    var tempExecOverviewBtn = document.getElementById('tempExecOverviewBtn');
    var tempExecOverviewSection = document.querySelector('[data-section-id="tempexec-overview"]');
    var tempExecViewSection = document.querySelector('[data-section-id="tempexec-view"]');
    var tempExecBackBtn = document.getElementById('tempExecBackBtn');
    var exportTempExecBtn = document.getElementById('exportTempExecBtn');
    var exportTempExecConfigBtn = document.getElementById('exportTempExecConfigBtn');
    var exportTempExecXmindBtn = document.getElementById('exportTempExecXmindBtn');
    var importTempExecBtn = document.getElementById('importTempExecBtn');
    var importTempExecFile = document.getElementById('importTempExecFile');
    var importTempExecConfigBtn = document.getElementById('importTempExecConfigBtn');
    var importTempExecConfigFile = document.getElementById('importTempExecConfigFile');
    var tempExecPageSizeInput = document.getElementById('tempExecPageSizeInput');
    var tempExecPageSizeStatus = document.getElementById('tempExecPageSizeStatus');
    var saveTempExecPageSizeBtn = document.getElementById('saveTempExecPageSize');
    var createTempVersionBtn = document.getElementById('createTempVersionBtn');
    var tempFocusBlock = document.getElementById('tempFocusBlock');
    var tempFocusZone = tempFocusBlock ? tempFocusBlock.querySelector('[data-temp-focus-zone]') : null;

    if (typeof api.loadTempExecState === 'function') {
      api.loadTempExecState();
    }

    if (tempExecInput && tempExecDropZone && typeof api.importTempExecFiles === 'function') {
      tempExecInput.addEventListener('change', function(e) {
        var files = e.target.files;
        if (files && files.length) api.importTempExecFiles(files);
        e.target.value = '';
      });
      tempExecDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        tempExecDropZone.classList.add('dragover');
      });
      tempExecDropZone.addEventListener('dragleave', function() { tempExecDropZone.classList.remove('dragover'); });
      tempExecDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        tempExecDropZone.classList.remove('dragover');
        var files = e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length) api.importTempExecFiles(files);
      });
    }

    if (caseTemplateDropdown && caseTemplateToggle && caseTemplateMenu) {
      caseTemplateToggle.addEventListener('click', function() {
        var isOpen = caseTemplateDropdown.classList.contains('open');
        if (isOpen) {
          closeTemplateDropdown();
        } else {
          openTemplateDropdown(true);
        }
      });
      caseTemplateMenu.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-template-name]');
        if (btn) {
          var name = btn.dataset.templateName || '';
          var source = btn.dataset.templateSource || 'remote';
          closeTemplateDropdown();
          if (source === 'local') {
            importLocalTemplate(name);
          } else {
            importTemplateByName(name);
          }
          return;
        }
        var pickBtn = e.target.closest('[data-template-folder]');
        if (pickBtn) {
          pickLocalTemplateFolder();
        }
      });
      document.addEventListener('click', function(e) {
        if (!caseTemplateDropdown) return;
        if (caseTemplateDropdown.contains(e.target)) return;
        closeTemplateDropdown();
      });
    }

    if (tempExecToolbar) {
      tempExecToolbar.addEventListener('click', function(e) {
        var statusPill = e.target.closest('[data-temp-status-filter]');
        if (statusPill && api.setTempExecStatusFilter) {
          var sfFileId = statusPill.dataset.tempStatusFile;
          var sfStatus = statusPill.dataset.tempStatusFilter;
          api.setTempExecStatusFilter(sfFileId, sfStatus);
          return;
        }
        var searchBtn = e.target.closest('[data-temp-search-btn]');
        if (searchBtn && api.applyTempExecSearch) {
          var sbFileId = searchBtn.dataset.tempSearchBtn;
          var input = document.querySelector('[data-temp-search-input=\"' + sbFileId + '\"]');
          var val = input ? input.value : '';
          api.applyTempExecSearch(sbFileId, val, val);
          return;
        }
        var searchClear = e.target.closest('[data-temp-search-clear]');
        if (searchClear && api.applyTempExecSearch) {
          var scFileId = searchClear.dataset.tempSearchClear;
          var inputClear = document.querySelector('[data-temp-search-input=\"' + scFileId + '\"]');
          if (inputClear) inputClear.value = '';
          api.applyTempExecSearch(scFileId, '', '');
        }
      });
    }

    if (toggleTempReqBtn && typeof api.toggleTempExecRequirementZone === 'function') {
      toggleTempReqBtn.addEventListener('click', function() {
        api.toggleTempExecRequirementZone();
      });
    }
    if (toggleTempVersionBtn && typeof api.toggleTempExecVersionZone === 'function') {
      toggleTempVersionBtn.addEventListener('click', function() {
        api.toggleTempExecVersionZone();
      });
    }

    if (tempExecNav && api.getTempExecFile && api.setTempExecActive) {
      tempExecNav.addEventListener('click', function(e) {
        var focusRemoveBtn = e.target.closest('[data-temp-focus-remove]');
        if (focusRemoveBtn && api.removeTempExecFocus) {
          e.preventDefault();
          e.stopPropagation();
          api.removeTempExecFocus(focusRemoveBtn.dataset.tempFocusRemove);
          return;
        }
        var removeBtn = e.target.closest('[data-temp-remove]');
        if (removeBtn && api.removeTempExecFile) {
          e.preventDefault();
          e.stopPropagation();
          var fileId = removeBtn.dataset.tempRemove;
          var targetFile = api.getTempExecFile(fileId);
          if (!targetFile) return;
          var confirmed = window.confirm("确定要删除【" + targetFile.name + "】吗？此操作不可撤销。");
          if (!confirmed) return;
          api.removeTempExecFile(fileId);
          return;
        }
        var btn = e.target.closest('button[data-temp-file]');
        if (!btn) return;
        var fileId = btn.dataset.tempFile;
        if (!fileId) return;
        if (!api.getTempExecFile(fileId)) return;
        if (fileId !== state.tempExecActiveId) {
          api.setTempExecActive(fileId);
        }
        showTempExecView({ scroll: false });
      });
      tempExecNav.addEventListener('dragstart', function(e) {
        var targetFile = e.target.closest('[data-temp-file]');
        var targetReq = e.target.closest('[data-temp-req]');
        if (!targetFile && !targetReq) return;
        if (targetReq && targetReq.closest('[data-temp-focus-zone]')) return;
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        if (targetFile) {
          if (e.dataTransfer) e.dataTransfer.setData('text/plain', targetFile.dataset.tempFile || '');
        } else if (targetReq && targetReq.dataset.tempReq) {
          if (e.dataTransfer) e.dataTransfer.setData('text/temp-req', targetReq.dataset.tempReq);
        }
      });
      tempExecNav.addEventListener('dragover', function(e) {
        var reqBox = e.target.closest('[data-temp-req]');
        var fileRow = e.target.closest('[data-temp-file]');
        var poolZone = e.target.closest('[data-temp-req-pool]') || tempExecNav.querySelector('[data-temp-req-pool]');
        var dragCtx = (window.app && window.app.tempDragContext) || null;
        var draggingReq = dragCtx && dragCtx.type === 'req';
        e.preventDefault();
        if (poolZone) poolZone.classList.add('dragover');
        if (reqBox) {
          reqBox.classList.add('dragover');
          navHoverReqName = reqBox.dataset.tempReq || navHoverReqName;
          if (!draggingReq) {
            setNavHoverTarget(reqBox.querySelector('.temp-req-list'), e.clientY);
          }
        } else if (poolZone && draggingReq) {
          navHoverFileId = '';
          renderNavPlaceholder(poolZone, '');
        }
        if (fileRow) {
          fileRow.classList.add('dragover-target');
          navHoverFileId = fileRow.dataset.tempFile || navHoverFileId;
          navHoverReqName = fileRow.dataset.tempReq || navHoverReqName;
        }
      });
      tempExecNav.addEventListener('dragleave', function(e) {
        var next = e.relatedTarget;
        if (next && tempExecNav.contains(next)) return;
        var poolZone = e.target.closest('[data-temp-req-pool]');
        if (poolZone) poolZone.classList.remove('dragover');
        var reqBox = e.target.closest('[data-temp-req]');
        var fileRow = e.target.closest('[data-temp-file]');
        if (reqBox) reqBox.classList.remove('dragover');
        if (fileRow) fileRow.classList.remove('dragover-target');
        navHoverFileId = '';
        clearNavPlaceholder();
      });
      tempExecNav.addEventListener('drop', function(e) {
        var poolZone = e.target.closest('[data-temp-req-pool]') || tempExecNav.querySelector('[data-temp-req-pool]');
        var reqBox = e.target.closest('[data-temp-req]');
        var fileRow = e.target.closest('[data-temp-file]');
        e.preventDefault();
        if (!e.dataTransfer) return;
        var reqData = e.dataTransfer.getData('text/temp-req');
        var reqPayload = e.dataTransfer.getData('text/temp-req-version');
        var versionReorder = e.dataTransfer.getData('text/temp-version');
        var ids = e.dataTransfer.getData('text/plain');
        function resolveTargetRequirement() {
          if (reqBox && reqBox.dataset.tempReq) return reqBox.dataset.tempReq;
          if (fileRow && fileRow.dataset.tempReq) return fileRow.dataset.tempReq;
          if (navHoverReqName) return navHoverReqName;
          if (typeof document.elementFromPoint === 'function') {
            var node = document.elementFromPoint(e.clientX, e.clientY);
            var refReq = node ? node.closest('[data-temp-req]') : null;
            if (refReq && refReq.dataset.tempReq) return refReq.dataset.tempReq;
          }
          return '';
        }
        // 从版本盒拖回需求区：优先使用拖拽上下文或 payload 中的版本信息
        if (api.moveRequirementOutOfVersion) {
          var dragCtx = (window.app && window.app.tempDragContext) || null;
          var ctxReq = dragCtx && dragCtx.type === 'req' ? (dragCtx.req || reqData || '') : '';
          var ctxVer = dragCtx && dragCtx.type === 'req' ? (dragCtx.versionId || '') : '';
          var payloadReq = '';
          var payloadVer = '';
          if (reqPayload) {
            var partsPayload = reqPayload.split('||');
            payloadReq = partsPayload[0] || '';
            payloadVer = partsPayload[2] || '';
          }
          var finalMoveReq = payloadReq || ctxReq || reqData || '';
          var finalFromVer = payloadVer || ctxVer || '';
        if (poolZone && finalMoveReq && finalFromVer) {
          var targetReqNamePool = (reqBox && reqBox.dataset.tempReq) || '';
          api.moveRequirementOutOfVersion(finalFromVer, finalMoveReq, '');
          if (reqBox && api.reorderTempRequirement) {
            api.reorderTempRequirement(finalMoveReq, targetReqNamePool || finalMoveReq);
          }
          if (window.app) window.app.tempDragContext = null;
          clearTempNavDragHints();
          clearNavPlaceholder();
          navHoverReqName = '';
          return;
        }
        if (reqPayload && payloadReq && payloadVer && !reqBox && !fileRow && poolZone) {
          api.moveRequirementOutOfVersion(payloadVer, payloadReq, payloadReq);
          if (window.app) window.app.tempDragContext = null;
          clearTempNavDragHints();
          clearNavPlaceholder();
          return;
        }
        }
        const targetReqForReorder = resolveTargetRequirement();
        if (reqData && targetReqForReorder && api.reorderTempRequirement) {
          if (targetReqForReorder !== reqData) {
            api.reorderTempRequirement(reqData, targetReqForReorder);
          }
          clearNavPlaceholder();
          clearTempNavDragHints();
          navHoverReqName = '';
          return;
        }
        if (ids && api.moveTempExecFileToRequirement) {
          var targetReq = resolveTargetRequirement();
          if (!targetReq) return;
        var sourceReq = '';
        var dragCtxFile = (window.app && window.app.tempDragContext && window.app.tempDragContext.type === 'file') ? window.app.tempDragContext : null;
        if (dragCtxFile && dragCtxFile.requirement) sourceReq = dragCtxFile.requirement;
        if (!sourceReq && api.getTempExecFile) {
          var firstId = ids.split(',').map(function(s) { return s.trim(); }).find(function(s) { return s; }) || '';
          var firstFile = firstId ? api.getTempExecFile(firstId) : null;
          if (firstFile && firstFile.requirement) sourceReq = firstFile.requirement;
        }
        var normSrc = (sourceReq || '').toLowerCase();
        var normTgt = (targetReq || '').toLowerCase();
        if (normSrc && normTgt && normSrc !== normTgt) {
          var confirmedMove = window.confirm('确定要将该用例从【' + sourceReq + '】移动到【' + targetReq + '】吗？');
          if (!confirmedMove) {
            clearTempNavDragHints();
            navHoverFileId = '';
            clearNavPlaceholder();
            return;
          }
        }
        var beforeId = fileRow && fileRow.dataset.tempFile ? fileRow.dataset.tempFile : (navHoverFileId || '');
        if (!beforeId && reqBox) {
          setNavHoverTarget(reqBox.querySelector('.temp-req-list'), e.clientY);
          beforeId = navHoverFileId || '';
        }
        ids.split(',').forEach(function(id) {
          var trimmed = id.trim();
          if (!trimmed) return;
          var finalBefore = beforeId === trimmed ? '' : beforeId;
          api.moveTempExecFileToRequirement(trimmed, targetReq, finalBefore, { skipConfirm: true });
        });
        clearTempNavDragHints();
        navHoverFileId = '';
        navHoverReqName = '';
        return;
      }
        if (ids && api.removeTempExecFromVersion) {
          ids.split(',').forEach(function(id) {
            var trimmed = id.trim();
            if (trimmed) api.removeTempExecFromVersion(trimmed);
          });
        }
        if (window.app) window.app.tempDragContext = null;
        clearTempNavDragHints();
        clearNavPlaceholder();
        navHoverReqName = '';
      });
    }

    function setTempDragContext(ctx) {
      window.app = window.app || {};
      window.app.tempDragContext = ctx;
    }

    function resolveVersionTargetReq(card, clientY) {
      if (!card) return { req: '', key: '' };
      var boxes = Array.prototype.slice.call(card.querySelectorAll('[data-temp-req]'));
      var target = { req: '', key: '' };
      boxes.some(function(box) {
        var rect = box.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          target = { req: box.dataset.tempReq || '', key: box.dataset.tempReqKey || '' };
          return true;
        }
        return false;
      });
      if (!target.req && boxes.length) {
        var last = boxes[boxes.length - 1];
        target = { req: last.dataset.tempReq || '', key: last.dataset.tempReqKey || '' };
      }
      return target;
    }

    function resolveVersionFileInsertTarget(reqBox, clientY) {
      if (!reqBox) return '';
      var rows = Array.prototype.slice.call(reqBox.querySelectorAll('[data-temp-file]'));
      var targetId = '';
      rows.some(function(row) {
        var rect = row.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          targetId = row.dataset.tempFile || '';
          return true;
        }
        return false;
      });
      return targetId;
    }

    if (tempVersionGrid) {
      tempVersionGrid.addEventListener('dragstart', function(e) {
        var targetFile = e.target.closest('[data-temp-file]');
        var targetReq = e.target.closest('[data-temp-req]');
        var targetVer = e.target.closest('[data-temp-version]');
        if (!targetFile && !targetReq && !targetVer) return;
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = 'move';
        if (targetFile) {
          e.dataTransfer.setData('text/plain', targetFile.dataset.tempFile || '');
        } else if (targetReq && targetReq.dataset.tempReq) {
          var payload = [
            targetReq.dataset.tempReq || '',
            targetReq.dataset.tempReqKey || '',
            targetReq.dataset.tempVersionGroup || '',
          ].join('||');
          e.dataTransfer.setData('text/temp-req-version', payload);
          e.dataTransfer.setData('text/temp-req', targetReq.dataset.tempReq);
          e.dataTransfer.setData('text/temp-req-key', targetReq.dataset.tempReqKey || '');
        } else if (targetVer && targetVer.dataset.tempVersion) {
          e.dataTransfer.setData('text/temp-version', targetVer.dataset.tempVersion);
        }
      });
      tempVersionGrid.addEventListener('dragover', function(e) {
        var card = e.target.closest('[data-temp-version]');
        if (card) {
          e.preventDefault();
          card.classList.add('dragover');
        }
        var reqBox = e.target.closest('[data-temp-req]');
        if (reqBox) {
          e.preventDefault();
          reqBox.classList.add('dragover');
        }
      });
      tempVersionGrid.addEventListener('dragleave', function(e) {
        var card = e.target.closest('[data-temp-version]');
        if (card) card.classList.remove('dragover');
        var reqBox = e.target.closest('[data-temp-req]');
        if (reqBox) reqBox.classList.remove('dragover');
      });
      tempVersionGrid.addEventListener('drop', function(e) {
        var card = e.target.closest('[data-temp-version]');
        if (!card) return;
        e.preventDefault();
        card.classList.remove('dragover');
        var reqBox = e.target.closest('[data-temp-req]');
        if (reqBox) reqBox.classList.remove('dragover');
        if (tempMouseDragFileId && tempMouseDragFromNav) {
          var dropReq = reqBox && reqBox.dataset ? reqBox.dataset.tempReq : '';
          var pendingFileId = tempMouseDragFileId;
          tempMouseDragFileId = '';
          tempMouseDragFromNav = false;
          if (api.getTempExecFile && api.getTempExecFile(pendingFileId)) {
            if (typeof api.moveTempExecFileWithinVersion === 'function') {
              api.moveTempExecFileWithinVersion(pendingFileId, card.dataset.tempVersion, dropReq || '', '');
            } else if (typeof api.moveTempExecToVersion === 'function') {
              api.moveTempExecToVersion(pendingFileId, card.dataset.tempVersion);
            }
            return;
          }
        }
        var dataTransfer = e.dataTransfer || null;
        var verId = dataTransfer ? dataTransfer.getData('text/temp-version') : '';
        if (verId) {
          if (api.reorderTempVersion) api.reorderTempVersion(verId, card.dataset.tempVersion);
          return;
        }
        var reqMove = dataTransfer ? dataTransfer.getData('text/temp-req') : '';
        var reqKeyMove = dataTransfer ? dataTransfer.getData('text/temp-req-key') : '';
        var reqPayload = dataTransfer ? dataTransfer.getData('text/temp-req-version') : '';
        var payloadText = reqPayload || (reqMove ? [reqMove, reqKeyMove || '', card.dataset.tempVersion || ''].join('||') : '');
        if (payloadText) {
          var parts = payloadText.split('||');
          var srcReq = parts[0] || '';
          var srcKey = parts[1] || '';
          var srcVer = parts[2] || '';
          var targetResolved = resolveVersionTargetReq(card, e.clientY);
          var tgtKey = reqBox && reqBox.dataset.tempReqKey ? reqBox.dataset.tempReqKey : targetResolved.key;
          var tgtReq = reqBox && reqBox.dataset.tempReq ? reqBox.dataset.tempReq : targetResolved.req;
          var targetVersion = card.dataset.tempVersion;
          var targetObj = api.getTempVersion ? api.getTempVersion(targetVersion) : null;
          var hasReqInVersion = targetObj && api.getVersionRequirementBlocks
            ? api.getVersionRequirementBlocks(targetObj).some(function(block) {
                return (block.key && block.key === srcKey) || (normalizeRequirementName(block.req) === normalizeRequirementName(srcReq));
              })
            : false;
          if (srcVer === card.dataset.tempVersion && (srcKey || srcReq)) {
            if (hasReqInVersion && api.reorderVersionRequirement) {
              api.reorderVersionRequirement(card.dataset.tempVersion, srcKey || srcReq, tgtKey || tgtReq || '');
            } else if (srcReq && api.moveRequirementToVersion) {
              api.moveRequirementToVersion(srcReq, card.dataset.tempVersion, tgtKey || tgtReq || '');
            }
            return;
          }
          if (srcReq && api.moveRequirementToVersion) {
            api.moveRequirementToVersion(srcReq, card.dataset.tempVersion, tgtKey || tgtReq || '');
            return;
          }
        }
        if (window.app && window.app.tempDragContext && window.app.tempDragContext.type === 'req' && window.app.tempDragContext.req) {
          if (typeof api.moveRequirementToVersion === 'function') {
            api.moveRequirementToVersion(window.app.tempDragContext.req, card.dataset.tempVersion, '');
            setTempDragContext(null);
            return;
          }
        }
        var ids = dataTransfer ? dataTransfer.getData('text/plain') : '';
        if (!ids && window.app && window.app.tempDragContext && window.app.tempDragContext.type === 'file') {
          ids = window.app.tempDragContext.fileId || '';
        }
        if (!payloadText && !reqMove && !reqKeyMove && !ids && tempExecNav) {
          var navReq = tempExecNav.querySelector('[data-temp-req]');
          var navReqName = navReq && navReq.dataset ? navReq.dataset.tempReq : '';
          if (navReqName && typeof api.moveRequirementToVersion === 'function') {
            api.moveRequirementToVersion(navReqName, card.dataset.tempVersion, '');
            setTempDragContext(null);
            return;
          }
        }
        if (ids) {
          var resolvedReq = reqBox && reqBox.dataset.tempReq ? reqBox.dataset.tempReq : resolveVersionTargetReq(card, e.clientY).req;
          var beforeId = resolveVersionFileInsertTarget(reqBox, e.clientY);
          if (!beforeId) {
            var fileRow = e.target.closest('[data-temp-file]');
            beforeId = fileRow && fileRow.dataset.tempFile ? fileRow.dataset.tempFile : '';
          }
          var idArr = ids.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
          var firstFile = idArr.length && api.getTempExecFile ? api.getTempExecFile(idArr[0]) : null;
          var srcReqName = normalizeRequirementName(firstFile && firstFile.requirement) || '';
          var tgtReqName = normalizeRequirementName(resolvedReq) || srcReqName;
          if (idArr.length && srcReqName && tgtReqName && srcReqName !== tgtReqName) {
            var confirmedMove = window.confirm('确定将用例从【' + srcReqName + '】移动到【' + tgtReqName + '】吗？');
            if (!confirmedMove) return;
          }
          if (api.moveTempExecFileWithinVersion) {
            api.moveTempExecFileWithinVersion(ids, card.dataset.tempVersion, resolvedReq, beforeId || '');
          } else if (api.moveTempExecToVersion) {
            api.moveTempExecToVersion(ids, card.dataset.tempVersion);
          }
        }
      });
      tempVersionGrid.addEventListener('click', function(e) {
        var removeBtn = e.target.closest('[data-temp-version-remove]');
        if (removeBtn && api.removeTempVersion) api.removeTempVersion(removeBtn.dataset.tempVersionRemove);
        var groupRemoveBtn = e.target.closest('[data-temp-group-remove]');
        if (groupRemoveBtn && api.removeTempGroupFromVersion) {
          api.removeTempGroupFromVersion(groupRemoveBtn.dataset.tempGroupRemove, groupRemoveBtn.dataset.tempGroupIds || '');
          return;
        }
        var renameBtn = e.target.closest('[data-temp-version-rename]');
        if (renameBtn && api.renameTempVersion) {
          api.renameTempVersion(renameBtn.dataset.tempVersionRename);
          return;
        }
        var fileBtn = e.target.closest('[data-temp-file]');
        if (fileBtn && typeof api.setTempExecActive === 'function') {
          var fileId = fileBtn.dataset.tempFile;
          if (fileId && api.getTempExecFile && api.getTempExecFile(fileId)) {
            api.setTempExecActive(fileId);
            switchTab('tempexec');
          }
        }
      });
    }

    function handleTempFileDragStart(e) {
      if (!e) return;
      setTempDragContext(null);
      var fileBtn = e.target.closest('[data-temp-file]');
      if (fileBtn) {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', fileBtn.dataset.tempFile || '');
        }
        var file = api.getTempExecFile ? api.getTempExecFile(fileBtn.dataset.tempFile) : null;
        var req = normalizeRequirementName(file && file.requirement) || fileBtn.dataset.tempReq || '';
        setTempDragContext({
          type: 'file',
          fileId: fileBtn.dataset.tempFile || '',
          requirement: req,
          versionId: file && file.versionId ? file.versionId : '',
        });
        return;
      }
      var reqBox = e.target.closest('[data-temp-req]');
      if (reqBox && reqBox.dataset.tempReq) {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/temp-req', reqBox.dataset.tempReq);
          var rect = reqBox.getBoundingClientRect();
          var ghost = reqBox.cloneNode(true);
          ghost.style.position = 'fixed';
          ghost.style.top = '-9999px';
          ghost.style.left = '-9999px';
          ghost.style.width = rect.width + 'px';
          ghost.style.maxWidth = rect.width + 'px';
          ghost.style.boxSizing = 'border-box';
          document.body.appendChild(ghost);
          var offsetX = Math.max(0, e.clientX - rect.left);
          var offsetY = Math.max(0, e.clientY - rect.top);
          e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
          setTimeout(function() {
            if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
          }, 0);
        }
        setTempDragContext({ type: 'req', req: reqBox.dataset.tempReq, versionId: reqBox.dataset.tempVersionGroup || '' });
        return;
      }
      var versionCard = e.target.closest('[data-temp-version]');
      if (versionCard && versionCard.dataset.tempVersion) {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/temp-version', versionCard.dataset.tempVersion);
        }
        setTempDragContext({ type: 'version', versionId: versionCard.dataset.tempVersion });
      }
    }

    document.addEventListener('dragstart', handleTempFileDragStart);
    var tempMouseDragFileId = '';
    var tempMouseDragFromNav = false;
    document.addEventListener('mousedown', function(e) {
      var fileRow = e.target.closest('[data-temp-file]');
      if (fileRow && fileRow.dataset.tempFile) {
        tempMouseDragFileId = fileRow.dataset.tempFile;
        tempMouseDragFromNav = Boolean(tempExecNav && tempExecNav.contains(fileRow));
      } else {
        tempMouseDragFileId = '';
        tempMouseDragFromNav = false;
      }
    });
    document.addEventListener('mouseup', function(e) {
      if (!tempMouseDragFileId || !tempMouseDragFromNav) return;
      var versionBody = e.target.closest('[data-temp-version] .temp-version-body');
      var versionCard = e.target.closest('[data-temp-version]');
      if (versionCard && versionCard.dataset && versionCard.dataset.tempVersion && versionBody) {
        var fileId = tempMouseDragFileId;
        tempMouseDragFileId = '';
        tempMouseDragFromNav = false;
        if (api.getTempExecFile && !api.getTempExecFile(fileId)) return;
        var resolvedReq = versionBody.dataset && versionBody.dataset.tempReq ? versionBody.dataset.tempReq : '';
        if (typeof api.moveTempExecFileWithinVersion === 'function') {
          api.moveTempExecFileWithinVersion(fileId, versionCard.dataset.tempVersion, resolvedReq, '');
        } else if (typeof api.moveTempExecToVersion === 'function') {
          api.moveTempExecToVersion(fileId, versionCard.dataset.tempVersion);
        }
        return;
      }
      tempMouseDragFileId = '';
      tempMouseDragFromNav = false;
    });

    if (tempFocusBlock && api.getTempExecFile && api.setTempExecActive) {
      tempFocusBlock.addEventListener('click', function(e) {
        var removeBtn = e.target.closest('[data-temp-focus-remove]');
        if (removeBtn && api.removeTempExecFocus) {
          e.preventDefault();
          e.stopPropagation();
          api.removeTempExecFocus(removeBtn.dataset.tempFocusRemove);
          return;
        }
        var btn = e.target.closest('button[data-temp-file]');
        if (!btn) return;
        var fileId = btn.dataset.tempFile;
        if (!fileId || fileId === state.tempExecActiveId) return;
        if (!api.getTempExecFile(fileId)) return;
        api.setTempExecActive(fileId);
        switchTab('tempexec');
      });
      tempFocusBlock.addEventListener('dragstart', function(e) {
        var btn = e.target.closest('button[data-temp-file]');
        if (!btn || !e.dataTransfer) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', btn.dataset.tempFile || '');
      });
    }

    if (tempFocusZone && api.addTempExecFocus) {
      tempFocusZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        tempFocusZone.classList.add('dragover');
      });
      tempFocusZone.addEventListener('dragleave', function() {
        tempFocusZone.classList.remove('dragover');
      });
      tempFocusZone.addEventListener('drop', function(e) {
        e.preventDefault();
        tempFocusZone.classList.remove('dragover');
        if (!e.dataTransfer) return;
        var fileId = e.dataTransfer.getData('text/plain');
        if (!fileId && window.app && window.app.tempDragContext && window.app.tempDragContext.type === 'file') {
          fileId = window.app.tempDragContext.fileId || '';
        }
        if (!fileId && tempExecNav) {
          var navFile = tempExecNav.querySelector('[data-temp-file]');
          fileId = navFile && navFile.dataset ? navFile.dataset.tempFile : '';
        }
        if (!fileId) return;
        api.addTempExecFocus(fileId);
      });
    }

    if (tempExecOverviewBtn) {
      tempExecOverviewBtn.addEventListener('click', function() {
        showTempExecOverview();
      });
    }
    if (tempExecOverview && api.setTempExecActive) {
      tempExecOverview.addEventListener('click', function(e) {
        var card = e.target.closest('[data-temp-file]');
        if (!card) return;
        var fileId = card.dataset.tempFile;
        if (fileId) {
          api.setTempExecActive(fileId);
          switchTab('tempexec');
          if (tempExecViewSection) scrollElementIntoView(tempExecViewSection, 'smooth', 120);
        }
      });
    }
    if (tempExecBackBtn) {
      tempExecBackBtn.addEventListener('click', function() {
        if (api.prioritizeTempExecUnassignedRequirements) {
          api.prioritizeTempExecUnassignedRequirements();
        }
        switchTab('tempexec');
        if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
        if (tempExecDrawer) tempExecDrawer.close();
        if (tempExecViewSection) {
          tempExecViewSection.classList.remove('hidden');
          scrollElementIntoView(tempExecViewSection, 'smooth', 140);
        }
      });
    }
    if (tempExecMindBtn && api.renderTempExecView && api.getTempExecFile) {
      tempExecMindBtn.addEventListener('click', function() {
        var file = api.getTempExecFile(state.tempExecActiveId);
        if (!file) {
          setStatus(tempExecStatus, '当前没有可展示的用例', 'warn');
          return;
        }
        state.tempExecMindMode = !state.tempExecMindMode;
        api.renderTempExecView();
      });
    }

    if (createTempVersionBtn && api.createTempVersion) {
      createTempVersionBtn.addEventListener('click', function() {
        var name = window.prompt('请输入版本名称');
        if (!name) return;
        var id = api.createTempVersion(name);
        if (id && tempExecStatus) setStatus(tempExecStatus, '版本已创建，可拖拽需求到对应版本', 'ok');
      });
    }

    if (tempExecView && api.renderTempExecView) {
      tempExecView.addEventListener('click', function(e) {
        var presetAddBtn = e.target.closest('[data-temp-reuse-preset-add]');
        if (presetAddBtn && api.startTempExecPresetDraft) {
          var fileId = presetAddBtn.dataset.tempReusePresetAdd;
          var file = api.getTempExecFile && api.getTempExecFile(fileId);
          if (file && file.reuseEnabled) {
            api.startTempExecPresetDraft(fileId);
          } else if (tempExecStatus) {
            setStatus(tempExecStatus, '请先开启用例复用再添加预设子项', 'warn');
          }
          return;
        }
        var presetCancelBtn = e.target.closest('[data-temp-reuse-preset-cancel]');
        if (presetCancelBtn && api.cancelTempExecPresetDraft) {
          api.cancelTempExecPresetDraft();
          return;
        }
        var presetConfirmBtn = e.target.closest('[data-temp-reuse-preset-confirm]');
        if (presetConfirmBtn && api.confirmTempExecPresetDraft) {
          api.confirmTempExecPresetDraft(presetConfirmBtn.dataset.tempReusePresetConfirm);
          return;
        }
        var presetRemoveBtn = e.target.closest('[data-temp-reuse-preset-remove]');
        if (presetRemoveBtn && api.removeTempExecPreset) {
          var presetFileId = presetRemoveBtn.dataset.tempReusePresetRemove;
          var presetId = presetRemoveBtn.dataset.preset;
          if (presetFileId && presetId) api.removeTempExecPreset(presetFileId, presetId);
          return;
        }
        var pageBtn = e.target.closest('[data-temp-page-action]');
        if (pageBtn && api.changeTempExecPage) {
          api.changeTempExecPage(pageBtn.dataset.tempPageAction, pageBtn.dataset.action);
          return;
        }
        var defectToggleBtn = e.target.closest('[data-temp-defect-toggle]');
        if (defectToggleBtn && api.ensureTempExecSelection && api.toggleTempExecDefectPanel) {
          var dtFileId = defectToggleBtn.dataset.tempDefectToggle;
          var dtIdx = Number(defectToggleBtn.dataset.index);
          if (!Number.isNaN(dtIdx)) {
            var selection = api.ensureTempExecSelection(dtFileId);
            var targets = selection.size ? Array.from(selection) : [dtIdx];
            api.toggleTempExecDefectPanel(dtFileId, targets);
          }
          return;
        }
        var defectAddBtn = e.target.closest('[data-temp-defect-add]');
        if (defectAddBtn && api.addTempExecDefectLink) {
          var daFileId = defectAddBtn.dataset.tempDefectAdd;
          var daIdx = Number(defectAddBtn.dataset.index);
          if (!Number.isNaN(daIdx)) api.addTempExecDefectLink(daFileId, daIdx);
          return;
        }
        var removeCaseBtn = e.target.closest('[data-temp-case-remove]');
        if (removeCaseBtn && api.removeTempExecCase) {
          var rcFileId = removeCaseBtn.dataset.tempCaseRemove;
          var rcIdx = Number(removeCaseBtn.dataset.index);
          if (!Number.isNaN(rcIdx)) api.removeTempExecCase(rcFileId, rcIdx);
          return;
        }
        var statusPill = e.target.closest('[data-temp-status-filter]');
        if (statusPill && api.setTempExecStatusFilter) {
          var sfFileId = statusPill.dataset.tempStatusFile;
          var sfStatus = statusPill.dataset.tempStatusFilter;
          api.setTempExecStatusFilter(sfFileId, sfStatus);
          return;
        }
        if (statusPill) {
          var sfFileIdFallback = statusPill.dataset.tempStatusFile;
          var sfStatusFallback = statusPill.dataset.tempStatusFilter;
          var currentFilter = state.tempExecStatusFilter || { fileId: '', status: '' };
          var nextFilter = { fileId: '', status: '' };
          if (sfFileIdFallback && sfStatusFallback && (currentFilter.fileId !== sfFileIdFallback || currentFilter.status !== sfStatusFallback)) {
            nextFilter = { fileId: sfFileIdFallback, status: sfStatusFallback };
          }
          state.tempExecStatusFilter = nextFilter;
          if (api.renderTempExecView) api.renderTempExecView();
          return;
        }
        var insertCaseBtn = e.target.closest('[data-temp-case-insert]');
        if (insertCaseBtn && api.insertTempExecCase) {
          var icFileId = insertCaseBtn.dataset.tempCaseInsert;
          var icIdx = Number(insertCaseBtn.dataset.index);
          if (!Number.isNaN(icIdx)) api.insertTempExecCase(icFileId, icIdx);
          return;
        }
        var defectOpenBtn = e.target.closest('[data-temp-defect-open]');
        if (defectOpenBtn && api.openTempExecDefectLink) {
          var doFileId = defectOpenBtn.dataset.tempDefectOpen;
          var doIdx = Number(defectOpenBtn.dataset.index);
          var linkId = defectOpenBtn.dataset.link;
          if (!Number.isNaN(doIdx) && linkId) api.openTempExecDefectLink(doFileId, doIdx, linkId);
          return;
        }
        var defectRemoveBtn = e.target.closest('[data-temp-defect-remove]');
        if (defectRemoveBtn && api.removeTempExecDefectLink) {
          var drFileId = defectRemoveBtn.dataset.tempDefectRemove;
          var drIdx = Number(defectRemoveBtn.dataset.index);
          var drLinkId = defectRemoveBtn.dataset.link;
          if (!Number.isNaN(drIdx) && drLinkId) api.removeTempExecDefectLink(drFileId, drIdx, drLinkId);
          return;
        }
        var reuseBtn = e.target.closest('[data-temp-reuse-panel]');
        if (reuseBtn && api.ensureTempExecSelection && api.toggleTempExecReusePanel) {
          var rFileId = reuseBtn.dataset.tempReusePanel;
          var rIdx = Number(reuseBtn.dataset.index);
          if (!Number.isNaN(rIdx)) {
            var reuseSelection = api.ensureTempExecSelection(rFileId);
            var reuseTargets = reuseSelection.size ? Array.from(reuseSelection) : [rIdx];
            api.toggleTempExecReusePanel(rFileId, reuseTargets);
          }
          return;
        }
        var reuseAddBtn = e.target.closest('[data-temp-reuse-add]');
        if (reuseAddBtn && api.addTempExecReuseEntry) {
          var raFileId = reuseAddBtn.dataset.tempReuseAdd;
          var raIdx = Number(reuseAddBtn.dataset.index);
          if (!Number.isNaN(raIdx)) api.addTempExecReuseEntry(raFileId, raIdx);
          return;
        }
        var reuseRemoveBtn = e.target.closest('[data-temp-reuse-remove]');
        if (reuseRemoveBtn && api.removeTempExecReuseEntry) {
          var rrFileId = reuseRemoveBtn.dataset.tempReuseRemove;
          var rrIdx = Number(reuseRemoveBtn.dataset.index);
          var detailId = reuseRemoveBtn.dataset.detail;
          if (!Number.isNaN(rrIdx) && detailId) api.removeTempExecReuseEntry(rrFileId, rrIdx, detailId);
          return;
        }
        var removeCaseBtn = e.target.closest('[data-temp-case-remove]');
        if (removeCaseBtn && api.removeTempExecCase) {
          var rcFileId = removeCaseBtn.dataset.tempCaseRemove;
          var rcIdx = Number(removeCaseBtn.dataset.index);
          if (!Number.isNaN(rcIdx)) api.removeTempExecCase(rcFileId, rcIdx);
          return;
        }
        var insertCaseBtn = e.target.closest('[data-temp-case-insert]');
        if (insertCaseBtn && api.insertTempExecCase) {
          var icFileId = insertCaseBtn.dataset.tempCaseInsert;
          var icIdx = Number(insertCaseBtn.dataset.index);
          if (!Number.isNaN(icIdx)) api.insertTempExecCase(icFileId, icIdx);
          return;
        }
        var searchBtn = e.target.closest('[data-temp-search-btn]');
        if (searchBtn && api.applyTempExecSearch) {
          var sbFileId = searchBtn.dataset.tempSearchBtn;
          var input = document.querySelector('[data-temp-search-input=\"' + sbFileId + '\"]');
          var val = input ? input.value : '';
          api.applyTempExecSearch(sbFileId, val, val);
          return;
        }
        var searchClear = e.target.closest('[data-temp-search-clear]');
        if (searchClear && api.applyTempExecSearch) {
          var scFileId = searchClear.dataset.tempSearchClear;
          var inputClear = document.querySelector('[data-temp-search-input=\"' + scFileId + '\"]');
          if (inputClear) inputClear.value = '';
          api.applyTempExecSearch(scFileId, '', '');
          return;
        }
        var toggleBtn = e.target.closest('[data-temp-remark-toggle]');
        if (toggleBtn && api.ensureTempExecRemarkOpen && api.ensureTempExecSelection) {
          var tFileId = toggleBtn.dataset.tempRemarkToggle;
          var tIdx = Number(toggleBtn.dataset.index);
          if (!Number.isNaN(tIdx)) {
            var openSet = api.ensureTempExecRemarkOpen(tFileId);
            var selectionSet = api.ensureTempExecSelection(tFileId);
            var targetsToggle = selectionSet.size ? Array.from(selectionSet) : [tIdx];
            var shouldOpen = !targetsToggle.every(function(i) { return openSet.has(i); });
            targetsToggle.forEach(function(i) {
              if (shouldOpen) openSet.add(i);
              else openSet.delete(i);
            });
            api.renderTempExecView();
          }
          return;
        }
      });
      tempExecView.addEventListener('change', function(e) {
        var target = e.target;
        if (!target) return;
        if (target.dataset.tempSelectAll !== undefined && api.toggleTempExecSelectAll) {
          var allFileId = target.dataset.tempSelectAll;
          var visible = (target.dataset.tempVisible || '').split(',').map(function(val) {
            var num = Number(val);
            return Number.isFinite(num) ? num : null;
          }).filter(function(n) { return n !== null; });
          api.toggleTempExecSelectAll(allFileId, target.checked, visible);
          return;
        }
        if (target.dataset.tempPageInput !== undefined && api.getTempExecFile && api.getTempExecPageSize && api.setTempExecPage) {
          var fileId = target.dataset.tempPageInput;
          var file = api.getTempExecFile(fileId);
          if (!file) {
            target.value = '1';
            return;
          }
          var pageSize = api.getTempExecPageSize();
          var totalPages = Math.max(1, Math.ceil(file.cases.length / pageSize));
          var requested = Math.round(Number(target.value));
          if (!Number.isFinite(requested)) requested = 1;
          requested = Math.min(Math.max(1, requested), totalPages);
          target.value = requested;
          api.setTempExecPage(fileId, requested - 1);
          if (api.scrollTempExecViewTop) api.scrollTempExecViewTop();
          return;
        }
        if (target.dataset.tempSelect !== undefined && api.toggleTempExecSelection) {
          var selFileId = target.dataset.tempSelect;
          var selIdx = Number(target.dataset.index);
          if (!Number.isNaN(selIdx)) api.toggleTempExecSelection(selFileId, selIdx, target.checked);
          return;
        }
        if (target.dataset.tempResult !== undefined && api.updateTempExecResult) {
          var resFileId = target.dataset.tempResult;
          var resIdx = Number(target.dataset.index);
          if (!Number.isNaN(resIdx)) {
            api.updateTempExecResult(resFileId, resIdx, target.value);
            target.dataset.status = target.value;
          }
          return;
        }
        if (target.dataset.tempReuseToggle !== undefined && api.handleTempExecReuseToggle) {
          api.handleTempExecReuseToggle(target.dataset.tempReuseToggle, target.checked, target);
          return;
        }
        if (target.dataset.tempReuseStatus !== undefined && api.updateTempExecReuseStatus) {
          var rsFileId = target.dataset.tempReuseStatus;
          var rsIdx = Number(target.dataset.index);
          var detailId = target.dataset.detail;
          if (!Number.isNaN(rsIdx) && detailId) api.updateTempExecReuseStatus(rsFileId, rsIdx, detailId, target.value);
          return;
        }
      });
      tempExecView.addEventListener('input', function(e) {
        var target = e.target;
        if (!target) return;
        if (target.dataset.tempRemark !== undefined && api.updateTempExecRemark) {
          var rFileId = target.dataset.tempRemark;
          var rIdx = Number(target.dataset.index);
          if (!Number.isNaN(rIdx)) api.updateTempExecRemark(rFileId, rIdx, target.value);
          return;
        }
        if (target.dataset.tempReuseText !== undefined && api.updateTempExecReuseText) {
          var rtFileId = target.dataset.tempReuseText;
          var rtIdx = Number(target.dataset.index);
          var rtDetailId = target.dataset.detail;
          if (!Number.isNaN(rtIdx) && rtDetailId) api.updateTempExecReuseText(rtFileId, rtIdx, rtDetailId, target.value);
          return;
        }
        if (target.dataset.tempReuseNote !== undefined && api.updateTempExecReuseNote) {
          var rnFileId = target.dataset.tempReuseNote;
          var rnIdx = Number(target.dataset.index);
          var rnDetailId = target.dataset.detail;
          if (!Number.isNaN(rnIdx) && rnDetailId) api.updateTempExecReuseNote(rnFileId, rnIdx, rnDetailId, target.value);
          return;
        }
        if (target.dataset.tempSearchInput !== undefined) {
          return;
        }
        if (target.dataset.tempSearchInput !== undefined) {
          return;
        }
        if (target.dataset.tempEditField !== undefined && api.updateTempExecCaseField) {
          var efFileId = target.dataset.tempEditFile;
          var efIdx = Number(target.dataset.tempEditIndex);
          var efField = target.dataset.tempEditField;
          var multiline = String(target.dataset.tempEditMultiline || '').toLowerCase() === 'true';
          if (!Number.isNaN(efIdx) && efField) {
            var caretPos = null;
            var sel = window.getSelection && window.getSelection();
            if (sel && sel.anchorNode && target.contains(sel.anchorNode)) {
              caretPos = sel.anchorOffset;
            }
            var rawText = typeof target.innerText === 'string' ? target.innerText : (target.textContent || '');
            var normalized = rawText.replace(/\r\n/g, '\n');
            if (!multiline) {
              normalized = normalized.replace(/\n/g, ' ').trim();
            }
            if (efField === 'priority') {
              var upper = normalized.toUpperCase();
              normalized = upper;
              target.textContent = normalized;
              if (caretPos !== null) {
                var node = target.firstChild;
                if (node) {
                  var pos = Math.min(caretPos, node.textContent.length);
                  var range = document.createRange();
                  range.setStart(node, pos);
                  range.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
              }
            }
            api.updateTempExecCaseField(efFileId, efIdx, efField, normalized);
          }
          return;
        }
        if (target.dataset.tempReusePresetInput !== undefined && api.updateTempExecPresetDraft) {
          api.updateTempExecPresetDraft(target.value);
          return;
        }
        if (target.dataset.tempDefectLink !== undefined && api.updateTempExecDefectLink) {
          var dlFileId = target.dataset.tempDefectLink;
          var dlIdx = Number(target.dataset.index);
          var dlLinkId = target.dataset.link;
          if (!Number.isNaN(dlIdx) && dlLinkId) api.updateTempExecDefectLink(dlFileId, dlIdx, dlLinkId, target.value);
        }
      });
      tempExecView.addEventListener('keydown', function(e) {
        var target = e.target;
        if (!target) return;
        if (target.dataset && target.dataset.tempEditField !== undefined) {
          var multiline = String(target.dataset.tempEditMultiline || '').toLowerCase() === 'true';
          if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            if (target.blur) target.blur();
          }
        }
        if (target.dataset && target.dataset.tempSearchInput !== undefined) {
          if (e.key === 'Enter' && api.applyTempExecSearch) {
            var sfFileId = target.dataset.tempSearchInput;
            var val = target.value || '';
            api.applyTempExecSearch(sfFileId, val, val);
            e.preventDefault();
          }
        }
      });
      tempExecView.addEventListener('keydown', function(e) {
        var target = e.target;
        if (!target) return;
        if (target.dataset && target.dataset.tempEditField !== undefined) {
          var multiline = String(target.dataset.tempEditMultiline || '').toLowerCase() === 'true';
          if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            if (target.blur) target.blur();
          }
        }
        if (target.dataset && target.dataset.tempSearchInput !== undefined) {
          if (e.key === 'Enter' && api.applyTempExecSearch) {
            var sfFileId = target.dataset.tempSearchInput;
            var val = target.value || '';
            api.applyTempExecSearch(sfFileId, val, val);
            e.preventDefault();
          }
        }
      });
    }

    if (exportTempExecBtn && api.getTempExecFile && api.serializeSingleTempExecFile) {
      exportTempExecBtn.addEventListener('click', function() {
        var active = api.getTempExecFile(state.tempExecActiveId);
        if (!active) {
          setStatus(tempExecStatus, '请选择需要导出的执行用例', 'warn');
          return;
        }
        var payload = JSON.stringify([api.serializeSingleTempExecFile(active)], null, 2);
        var stamp = formatCompactTimestamp();
        var safeReq = (state.requirementLabel || '').replace(/[\\/:*?"<>|]/g, '_');
        var safeName = (active.name || 'usecase').replace(/[\\/:*?"<>|]/g, '_');
        var prefix = safeReq || 'temp_exec';
        downloadText(prefix + '_' + safeName + '_' + stamp + '.json', payload);
        setStatus(tempExecStatus, '已导出【' + (active.name || '') + '】的执行结果', 'ok');
      });
    }

    if (exportTempExecConfigBtn && api.exportTempExecSnapshot) {
      exportTempExecConfigBtn.addEventListener('click', function() {
        api.exportTempExecSnapshot();
      });
    }

    if (exportTempExecXmindBtn && api.exportTempExecToXmind) {
      exportTempExecXmindBtn.addEventListener('click', function() {
        api.exportTempExecToXmind();
      });
    }
    if (exportTempExecCasesXmindBtn && api.exportTempExecCasesToXmind) {
      exportTempExecCasesXmindBtn.addEventListener('click', function() {
        api.exportTempExecCasesToXmind();
      });
    }

    if (importTempExecConfigBtn && importTempExecConfigFile && api.importTempExecSnapshot) {
      importTempExecConfigBtn.addEventListener('click', function() { importTempExecConfigFile.click(); });
      importTempExecConfigFile.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (file) api.importTempExecSnapshot(file);
      });
    }

    if (importTempExecBtn && importTempExecFile && api.createTempExecFile && api.ensureTempExecReplacement && api.normalizeReusePresets) {
      importTempExecBtn.addEventListener('click', function() { importTempExecFile.click(); });
      importTempExecFile.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        file.text().then(function(text) {
          var trimmed = (text || '').trim();
          if (!trimmed) {
            setStatus(tempExecStatus, '导入文件为空', 'warn');
            return;
          }
          var data;
          try {
            data = JSON.parse(trimmed);
          } catch (err) {
            setStatus(tempExecStatus, '执行数据 JSON 解析失败', 'err');
            return;
          }
          if (!Array.isArray(data) || !data.length) {
            setStatus(tempExecStatus, '导入文件未包含有效用例数据', 'warn');
            return;
          }
          var existingIds = new Set(state.tempExecFiles.map(function(item) { return item.id; }));
          var ensuredRequirement = '';
          var merged = [];
          data.forEach(function(item) {
            if (!item || typeof item !== 'object') return;
            var fileId = item.id || (api.generateTempExecId ? api.generateTempExecId() : '');
            while (fileId && existingIds.has(fileId) && api.generateTempExecId) {
              fileId = api.generateTempExecId();
            }
            var requirement = item.requirement || ensuredRequirement;
            if (!requirement) {
              ensuredRequirement = ensuredRequirement || (state.requirementLabel || '');
              if (!ensuredRequirement && ctx.core && ctx.core.ensureRequirementLabel) {
                ensuredRequirement = ctx.core.ensureRequirementLabel('请输入本次需求标识后再导入执行用例');
              }
              requirement = ensuredRequirement || '';
              if (!requirement) return;
            }
            var entry = api.createTempExecFile(item.name, item.cases || [], 'current', fileId, item.createdAt, requirement);
            if (!entry) return;
            entry.reuseEnabled = Boolean(item.reuseEnabled);
            entry.reusePresets = api.normalizeReusePresets(item && item.reusePresets);
            if (!api.ensureTempExecReplacement(entry, merged)) return;
            existingIds.add(entry.id);
            merged.push(entry);
          });
          if (!merged.length) {
            setStatus(tempExecStatus, '导入文件未包含有效用例数据', 'warn');
            return;
          }
          state.tempExecFiles = state.tempExecFiles.concat(merged);
          if (api.syncTempExecFocus) api.syncTempExecFocus();
          merged.forEach(function(entry) {
            state.tempExecPages[entry.id] = 0;
          });
          state.tempExecSelections = {};
          if (api.persistTempExecState) api.persistTempExecState();
          if (api.setTempExecActive) api.setTempExecActive(merged[merged.length - 1].id);
          setStatus(tempExecStatus, '已导入执行结果数据', 'ok');
        }).catch(function(err) {
          console.error(err);
          setStatus(tempExecStatus, '导入失败：' + err.message, 'err');
        });
      });
    }

    if (tempExecPageSizeInput) {
      tempExecPageSizeInput.value = state.tempExecPageSize || defaultTempExecPageSize;
      tempExecPageSizeInput.addEventListener('input', function() { setStatus(tempExecPageSizeStatus, '', ''); });
    }
    if (saveTempExecPageSizeBtn && api.applyTempExecPageSize) {
      saveTempExecPageSizeBtn.addEventListener('click', function() {
        if (!tempExecPageSizeInput) return;
        var desired = Number(tempExecPageSizeInput.value);
        var result = api.applyTempExecPageSize(desired);
        tempExecPageSizeInput.value = result.size;
        var message = result.changed
          ? '分页设置已更新，每页 ' + result.size + ' 条'
          : '分页设置已是每页 ' + result.size + ' 条';
        setStatus(tempExecPageSizeStatus, message, 'ok');
      });
    }
  }

  window.app = window.app || {};
  window.app.tempexec = { init: init };
})();
