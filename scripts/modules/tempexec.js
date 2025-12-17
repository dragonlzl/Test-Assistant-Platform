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
    var tempExecImportFileHint = document.getElementById('tempExecImportFileHint');
    var tempExecImportProjectSelect = document.getElementById('tempExecImportProjectSelect');
    var tempExecImportVersionSelect = document.getElementById('tempExecImportVersionSelect');
    var tempExecImportConfirmBtn = document.getElementById('tempExecImportConfirmBtn');
    var tempExecStatus = document.getElementById('tempExecStatus');
    var tempExecNav = document.getElementById('tempExecNav');
    var tempVersionGrid = document.getElementById('tempVersionGrid');
    var tempExecToolbar = document.getElementById('tempExecToolbar');
    var tempExecToolbarCard = document.getElementById('tempExecToolbarCard');
    var tempexecFlowNav = document.getElementById('tempexecFlowNav');
    var toggleTempReqBtn = document.getElementById('toggleTempReq');
    var toggleTempVersionBtn = document.getElementById('toggleTempVersion');
    var createTempVersionBtn = document.getElementById('createTempVersionBtn');
    var tempExecDrawerEl = document.getElementById('tempExecDrawer');
    var tempExecOverviewDrawerEl = document.getElementById('tempExecOverviewDrawer');
    var tempExecImportDiffDrawerEl = document.getElementById('tempExecImportDiffDrawer');
    var tempExecImportDiffTitle = document.getElementById('tempExecImportDiffTitle');
    var tempExecImportDiffStatus = document.getElementById('tempExecImportDiffStatus');
    var tempExecImportDiffLeftTitle = document.getElementById('tempExecImportDiffLeftTitle');
    var tempExecImportDiffLeftMeta = document.getElementById('tempExecImportDiffLeftMeta');
    var tempExecImportDiffLeftBody = document.getElementById('tempExecImportDiffLeftBody');
    var tempExecImportDiffRightTitle = document.getElementById('tempExecImportDiffRightTitle');
    var tempExecImportDiffRightMeta = document.getElementById('tempExecImportDiffRightMeta');
    var tempExecImportDiffRightBody = document.getElementById('tempExecImportDiffRightBody');
    var tempExecImportDiffOverwriteBtn = document.getElementById('tempExecImportDiffOverwriteBtn');
    var openTempExecDrawerBtn = document.getElementById('openTempExecDrawerBtn');
    var openTempExecViewNavBtn = document.getElementById('openTempExecViewNavBtn');
    var openTempExecOverviewNavBtn = document.getElementById('openTempExecOverviewNavBtn');
    var openTempExecBackupNavBtn = document.getElementById('openTempExecBackupNavBtn');
    var closeTempExecDrawerBtn = document.getElementById('closeTempExecDrawerBtn');
    var closeTempExecOverviewDrawerBtn = document.getElementById('closeTempExecOverviewDrawerBtn');
    var exportTempExecCasesXmindBtn = document.getElementById('exportTempExecCasesXmindBtn');
    var tempExecCaseLibraryChangesBtn = document.getElementById('tempExecCaseLibraryChangesBtn');
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
    var tempExecImportDiffDrawer = window.app.drawer && window.app.drawer.createDrawer({
      drawerId: 'tempExecImportDiffDrawer',
      openButtons: [],
      closeButtons: [],
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
      // 再次打开“执行视图”时也触发一次“用例库同步+diff 检查”（仅 DB 模式会产生实际同步）。
      // 注意：这里只递增触发序号，不会改变当前已选中的执行用例。
      try {
        if (window.app) {
          var prev = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
          if (!isFinite(prev) || prev < 0) prev = 0;
          window.app.__tempexecCaseLibrarySyncSeq = prev + 1;
          window.app.__tempexecCaseLibrarySyncReason = 'view-enter';
        }
      } catch (err) {
        // ignore
      }
      try {
        if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
          window.app.tempExecApi.loadTempExecState();
        }
      } catch (err2) {
        // ignore
      }
    }
    function showTempExecOverview() {
      switchTab('tempexec');
      updateTempExecToolbarOffset();
      if (tempExecDrawer) tempExecDrawer.close();
      if (tempExecOverviewDrawer) tempExecOverviewDrawer.open();
      if (tempExecOverviewSection) {
        tempExecOverviewSection.classList.remove('hidden');
      }
      var drawerBody = tempExecOverviewDrawerEl && tempExecOverviewDrawerEl.querySelector('.drawer-body');
      if (drawerBody) drawerBody.scrollTop = 0;
    }

    function scrollToTempExecCaseRow(fileId, idx, options) {
      var opts = options && typeof options === 'object' ? options : {};
      var attempts = 0;
      var maxAttempts = 30;
      var delay = Number(opts.delayMs);
      if (!Number.isFinite(delay) || delay < 0) delay = 0;
      if (!delay && opts.waitForDrawerUnlock) {
        var closing = false;
        if (tempExecOverviewDrawerEl && tempExecOverviewDrawerEl.classList) {
          closing = closing || tempExecOverviewDrawerEl.classList.contains('closing');
          closing = closing || tempExecOverviewDrawerEl.classList.contains('open');
        }
        if (tempExecDrawerEl && tempExecDrawerEl.classList) {
          closing = closing || tempExecDrawerEl.classList.contains('closing');
          closing = closing || tempExecDrawerEl.classList.contains('open');
        }
        // 抽屉关闭时会恢复 window.scrollTo(lockedScrollTop)，需要等解锁后再滚动到目标行，避免出现“先跳再被拉回”的上滚抖动。
        delay = closing ? 520 : 80;
      }
      function tryScroll() {
        attempts += 1;
        if (!tempExecView) return;
        var selector = 'tr.case-row[data-temp-case-row="' + String(fileId) + '"][data-index="' + String(idx) + '"]';
        var target = tempExecView.querySelector(selector);
        if (!target) {
          target = tempExecView.querySelector('[data-temp-result="' + String(fileId) + '"][data-index="' + String(idx) + '"]');
        }
        if (!target) {
          target = tempExecView.querySelector('[data-temp-remark="' + String(fileId) + '"][data-index="' + String(idx) + '"]');
        }
        if (target) {
          scrollElementIntoView(target, 'auto', 160);
          return;
        }
        if (attempts < maxAttempts) setTimeout(tryScroll, 40);
      }
      setTimeout(tryScroll, delay || 0);
    }

    function scrollToTempExecViewTop(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var delay = Number(opts.delayMs);
      if (!Number.isFinite(delay) || delay < 0) delay = 0;
      if (!delay && opts.waitForDrawerUnlock) {
        var closing = false;
        if (tempExecOverviewDrawerEl && tempExecOverviewDrawerEl.classList) {
          closing = closing || tempExecOverviewDrawerEl.classList.contains('closing');
          closing = closing || tempExecOverviewDrawerEl.classList.contains('open');
        }
        if (tempExecDrawerEl && tempExecDrawerEl.classList) {
          closing = closing || tempExecDrawerEl.classList.contains('closing');
          closing = closing || tempExecDrawerEl.classList.contains('open');
        }
        delay = closing ? 520 : 0;
      }
      setTimeout(function() {
        if (tempExecViewSection) {
          scrollElementIntoView(tempExecViewSection, 'auto', 140);
        } else if (tempExecView) {
          scrollElementIntoView(tempExecView, 'auto', 140);
        }
      }, delay || 0);
    }

    function jumpToTempExecCase(fileId, caseIndex) {
      if (!fileId) return;
      var idx = Number(caseIndex);
      if (!Number.isFinite(idx) || idx < 0) idx = 0;
      var liveApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : api;
      var globalState = window.app && window.app.state ? window.app.state : state;

      if (globalState && globalState.activeTab !== 'tempexec') {
        switchTab('tempexec');
      }
      updateTempExecToolbarOffset();
      try {
        if (window.app) window.app.__drawerSkipRestoreOnce = true;
      } catch (err) {
        // ignore
      }
      if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
      if (tempExecDrawer) tempExecDrawer.close();
      if (tempExecOverviewSection) tempExecOverviewSection.classList.add('hidden');
      if (tempExecViewSection) tempExecViewSection.classList.remove('hidden');

      if (liveApi && typeof liveApi.jumpToTempExecCase === 'function') {
        liveApi.jumpToTempExecCase(fileId, idx, { clearFilters: true });
      } else {
        if (globalState && (!globalState.tempExecPages || typeof globalState.tempExecPages !== 'object')) globalState.tempExecPages = {};
        var size = defaultTempExecPageSize;
        if (liveApi && typeof liveApi.getTempExecPageSize === 'function') size = Number(liveApi.getTempExecPageSize());
        if (!Number.isFinite(size) || size <= 0) size = defaultTempExecPageSize;
        var pageIndex = Math.floor(idx / size);
        if (globalState && globalState.tempExecPages && typeof globalState.tempExecPages === 'object') {
          globalState.tempExecPages[fileId] = pageIndex;
        }
        if (liveApi && typeof liveApi.setTempExecActive === 'function') liveApi.setTempExecActive(fileId);
      }

      scrollToTempExecCaseRow(fileId, idx, { waitForDrawerUnlock: true });
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
    var exportTempExecConfigBtn = document.getElementById('exportTempExecConfigBtn');
    var exportTempExecXmindBtn = document.getElementById('exportTempExecXmindBtn');
    var importTempExecConfigBtn = document.getElementById('importTempExecConfigBtn');
    var importTempExecConfigFile = document.getElementById('importTempExecConfigFile');
    var tempExecPageSizeInput = document.getElementById('tempExecPageSizeInput');
    var tempExecPageSizeStatus = document.getElementById('tempExecPageSizeStatus');
    var saveTempExecPageSizeBtn = document.getElementById('saveTempExecPageSize');
    var tempFocusBlock = document.getElementById('tempFocusBlock');
    var tempFocusZone = tempFocusBlock ? tempFocusBlock.querySelector('[data-temp-focus-zone]') : null;

    var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
    var importState = {
      pendingFiles: [],
      projectId: '',
      versionId: '',
      versionsByProject: {},
      loading: false,
      projectsLoaded: false,
    };
    var importDiffState = {
      loading: false,
      fileName: '',
      cleanName: '',
      projectId: null,
      importVersionId: null,
      dbVersionId: null,
      ext: '',
      source: '',
      importItems: [],
      importExecCases: [],
      importHasResult: false,
      importReuseEnabled: false,
      requirement: '',
      dbCaseFileId: null,
      dbItems: [],
      dbExecSetId: null,
      dbExecCases: [],
      dbReuseEnabled: false,
      dbHasResult: false,
      showResultFields: false,
      rows: [],
    };

    function normalizeDiffText(value) {
      if (value === null || value === undefined) return '';
      return String(value).replace(/\r\n/g, '\n').trim();
    }

    function normalizeKeyText(value) {
      return normalizeDiffText(value).toLowerCase();
    }

    function buildCaseKey(moduleName, title, expected) {
      return normalizeKeyText(moduleName) + '::' + normalizeKeyText(title) + '::' + normalizeKeyText(expected);
    }

    function joinDefectLinks(list) {
      var links = Array.isArray(list) ? list : [];
      var out = [];
      links.forEach(function(link) {
        if (!link) return;
        var url = link.url !== undefined && link.url !== null ? String(link.url).trim() : '';
        if (!url) return;
        out.push(url);
      });
      return out.join('\n');
    }

    function detectExecCasesHasResult(execCases, reuseEnabled) {
      var rows = Array.isArray(execCases) ? execCases : [];
      if (!rows.length) return false;
      if (reuseEnabled) {
        return rows.some(function(row) {
          var details = row && Array.isArray(row.reuse_details) ? row.reuse_details : [];
          return details.some(function(d) {
            var st = d && d.status ? String(d.status) : '未执行';
            var note = d && d.note ? String(d.note) : '';
            return (st && st !== '未执行') || (note && note.trim());
          });
        });
      }
      return rows.some(function(row2) {
        var st2 = row2 && row2.status ? String(row2.status) : '未执行';
        var remark2 = row2 && row2.remark ? String(row2.remark) : '';
        var defects2 = row2 && Array.isArray(row2.defect_links) ? row2.defect_links : [];
        return (st2 && st2 !== '未执行') || (remark2 && remark2.trim()) || defects2.length;
      });
    }

    function buildExecCaseMapByItemId(execCases) {
      var rows = Array.isArray(execCases) ? execCases : [];
      var map = {};
      rows.forEach(function(row) {
        if (!row) return;
        var id = row.case_item_id || row.caseItemId || null;
        if (!id) return;
        map[String(id)] = row;
      });
      return map;
    }

    function buildImportExecCaseMapByKey(execCases) {
      var rows = Array.isArray(execCases) ? execCases : [];
      var map = {};
      rows.forEach(function(row) {
        if (!row) return;
        var key = buildCaseKey(row.module, row.title, row.expected);
        if (!key) return;
        map[key] = row;
      });
      return map;
    }

    function flattenDiffRows(items, execCaseMap, opts) {
      var options = opts && typeof opts === 'object' ? opts : {};
      var reuseEnabled = options.reuseEnabled === true;
      var includeResult = options.includeResult === true;
      var list = Array.isArray(items) ? items : [];
      var out = [];
      var reuseIndexByParent = {};

      list.forEach(function(it) {
        if (!it) return;
        var moduleName = it.module || '';
        var title = it.title || '';
        var expected = it.expected || '';
        var priority = it.priority || '';
        var preconditions = it.precondition || it.preconditions || '';
        var steps = it.steps || '';
        var parentKey = buildCaseKey(moduleName, title, expected);
        var rowKey = 'main::' + parentKey;

        var execRow = null;
        if (options.matchBy === 'itemId') {
          var cid = it.id || it.case_item_id || it.caseItemId || null;
          if (cid !== null && cid !== undefined) {
            execRow = execCaseMap ? execCaseMap[String(cid)] : null;
          }
        } else {
          execRow = execCaseMap ? execCaseMap[parentKey] : null;
        }
        var status = execRow && execRow.status ? String(execRow.status) : '未执行';
        var remark = execRow && execRow.remark ? String(execRow.remark) : '';
        var defectLinks = execRow && Array.isArray(execRow.defect_links) ? execRow.defect_links : [];
        var reuseDetails = execRow && Array.isArray(execRow.reuse_details) ? execRow.reuse_details : [];

        out.push({
          key: rowKey,
          module: moduleName,
          title: title,
          priority: priority,
          preconditions: preconditions,
          steps: steps,
          expected: expected,
          actual: includeResult ? status : '',
          remark: includeResult ? remark : '',
          defect: includeResult ? joinDefectLinks(defectLinks) : '',
          reuseDetails: reuseEnabled ? reuseDetails : [],
          parentKey: parentKey,
          kind: 'main',
        });

        if (reuseEnabled && Array.isArray(reuseDetails) && reuseDetails.length) {
          if (!reuseIndexByParent[parentKey]) reuseIndexByParent[parentKey] = 0;
          reuseDetails.forEach(function(detail) {
            reuseIndexByParent[parentKey] += 1;
            var idx = reuseIndexByParent[parentKey];
            var text = detail && detail.text ? String(detail.text) : '';
            var note = detail && detail.note ? String(detail.note) : '';
            var st3 = detail && detail.status ? String(detail.status) : '未执行';
            out.push({
              key: 'reuse::' + parentKey + '::' + normalizeKeyText(text) + '::' + idx,
              module: '',
              title: '',
              priority: '',
              preconditions: '',
              steps: '',
              expected: text,
              actual: includeResult ? st3 : '',
              remark: includeResult ? note : '',
              defect: '',
              reuseDetails: [],
              parentKey: parentKey,
              kind: 'reuse',
            });
          });
        }
      });

      return out;
    }

    function compareRowFields(left, right, includeResult) {
      var diff = {
        module: false,
        title: false,
        priority: false,
        preconditions: false,
        steps: false,
        expected: false,
        actual: false,
        remark: false,
        defect: false,
      };
      if (!left || !right) return diff;
      diff.module = normalizeDiffText(left.module) !== normalizeDiffText(right.module);
      diff.title = normalizeDiffText(left.title) !== normalizeDiffText(right.title);
      diff.priority = normalizeDiffText(left.priority) !== normalizeDiffText(right.priority);
      diff.preconditions = normalizeDiffText(left.preconditions) !== normalizeDiffText(right.preconditions);
      diff.steps = normalizeDiffText(left.steps) !== normalizeDiffText(right.steps);
      diff.expected = normalizeDiffText(left.expected) !== normalizeDiffText(right.expected);
      if (includeResult) {
        diff.actual = normalizeDiffText(left.actual) !== normalizeDiffText(right.actual);
        diff.remark = normalizeDiffText(left.remark) !== normalizeDiffText(right.remark);
        diff.defect = normalizeDiffText(left.defect) !== normalizeDiffText(right.defect);
      }
      return diff;
    }

    function buildDiffRows(leftRows, rightRows, includeResult) {
      var leftList = Array.isArray(leftRows) ? leftRows : [];
      var rightList = Array.isArray(rightRows) ? rightRows : [];
      var leftMap = {};
      var rightMap = {};
      var keyList = [];
      leftList.forEach(function(row) {
        if (!row || !row.key) return;
        leftMap[row.key] = row;
        keyList.push(row.key);
      });
      rightList.forEach(function(row) {
        if (!row || !row.key) return;
        rightMap[row.key] = row;
        if (!leftMap[row.key]) keyList.push(row.key);
      });
      return keyList.map(function(key) {
        var left = leftMap[key] || null;
        var right = rightMap[key] || null;
        var type = 'unchanged';
        var diff = null;
        if (left && !right) type = 'added';
        else if (!left && right) type = 'removed';
        else if (left && right) {
          diff = compareRowFields(left, right, includeResult);
          var changed = Object.keys(diff).some(function(k) { return diff[k]; });
          if (changed) type = 'changed';
        }
        return { key: key, type: type, left: left, right: right, diff: diff };
      });
    }

    function setDiffResultFieldsVisible(visible) {
      if (!tempExecImportDiffDrawerEl || !tempExecImportDiffDrawerEl.querySelectorAll) return;
      var nodes = tempExecImportDiffDrawerEl.querySelectorAll('[data-tempexec-diff-result]');
      nodes.forEach(function(node) {
        if (!node || !node.classList) return;
        if (visible) node.classList.remove('hidden');
        else node.classList.add('hidden');
      });
    }

    function renderDiffTableBody(bodyEl, side, rows, includeResult) {
      if (!bodyEl) return;
      var list = Array.isArray(rows) ? rows : [];
      if (!list.length) {
        bodyEl.innerHTML = '<tr><td colspan="' + (includeResult ? '10' : '7') + '"><p class="hint">暂无数据</p></td></tr>';
        return;
      }
      bodyEl.innerHTML = list.map(function(row, idx) {
        var item = side === 'left' ? row.left : row.right;
        var other = side === 'left' ? row.right : row.left;
        var isPlaceholder = !item;
        var rowCls = '';
        if (row.type === 'added' && side === 'left') rowCls = 'diff-row-added';
        if (row.type === 'removed' && side === 'right') rowCls = 'diff-row-removed';
        if (row.type === 'changed') rowCls = 'diff-row-changed';

        var module = item ? (item.module || '') : '';
        var title = item ? (item.title || '') : '';
        var expected = item ? (item.expected || '') : '';
        var priority = item ? (item.priority || '') : '';
        var preconditions = item ? (item.preconditions || '') : '';
        var steps = item ? (item.steps || '') : '';
        var actual = item ? (item.actual || '') : '';
        var remark = item ? (item.remark || '') : '';
        var defect = item ? (item.defect || '') : '';

        var priorityCls = '';
        var preCls = '';
        var stepsCls = '';
        var actualCls = '';
        var remarkCls = '';
        var defectCls = '';
        if (!isPlaceholder && other && row.type === 'changed' && row.diff) {
          if (row.diff.priority) priorityCls = 'diff-cell-changed';
          if (row.diff.preconditions) preCls = 'diff-cell-changed';
          if (row.diff.steps) stepsCls = 'diff-cell-changed';
          if (includeResult && row.diff.actual) actualCls = 'diff-cell-changed';
          if (includeResult && row.diff.remark) remarkCls = 'diff-cell-changed';
          if (includeResult && row.diff.defect) defectCls = 'diff-cell-changed';
        }

        var hint = isPlaceholder ? '<p class="hint">（无对应项）</p>' : '';
        var resultCells = includeResult
          ? (
              '<td data-tempexec-diff-result class="' + escapeHtml(actualCls) + '">' + escapeHtml(actual) + '</td>' +
              '<td data-tempexec-diff-result class="' + escapeHtml(remarkCls) + '">' + escapeHtml(remark) + '</td>' +
              '<td data-tempexec-diff-result class="' + escapeHtml(defectCls) + '">' + escapeHtml(defect) + '</td>'
            )
          : '';
        return (
          '<tr class="' + escapeHtml(rowCls) + '">' +
            '<td>' + escapeHtml(String(idx + 1)) + '</td>' +
            '<td>' + escapeHtml(module) + '</td>' +
            '<td>' + escapeHtml(title) + hint + '</td>' +
            '<td class="' + escapeHtml(priorityCls) + '">' + escapeHtml(priority) + '</td>' +
            '<td class="' + escapeHtml(preCls) + '">' + escapeHtml(preconditions) + '</td>' +
            '<td class="' + escapeHtml(stepsCls) + '">' + escapeHtml(steps) + '</td>' +
            '<td>' + escapeHtml(expected) + '</td>' +
            resultCells +
          '</tr>'
        );
      }).join('');
    }

    function syncImportDiffControls() {
      if (!tempExecImportDiffOverwriteBtn) return;
      var can = Boolean(
        !importDiffState.loading &&
        importDiffState.projectId &&
        importDiffState.importVersionId &&
        importDiffState.dbCaseFileId &&
        importDiffState.cleanName &&
        Array.isArray(importDiffState.importItems) &&
        importDiffState.importItems.length
      );
      tempExecImportDiffOverwriteBtn.disabled = !can;
    }

    function openImportDiffDrawerLoading(payload) {
      payload = payload || {};
      importDiffState.loading = true;
      importDiffState.fileName = payload.fileName || '';
      importDiffState.cleanName = payload.cleanName || '';
      importDiffState.projectId = payload.projectId || null;
      importDiffState.importVersionId = payload.importVersionId || null;
      importDiffState.dbVersionId = payload.dbVersionId || null;
      importDiffState.ext = payload.ext || '';
      importDiffState.source = payload.source || '';
      importDiffState.importItems = Array.isArray(payload.importItems) ? payload.importItems : [];
      importDiffState.importExecCases = Array.isArray(payload.importExecCases) ? payload.importExecCases : [];
      importDiffState.importHasResult = payload.importHasResult === true;
      importDiffState.importReuseEnabled = payload.importReuseEnabled === true;
      importDiffState.requirement = payload.requirement || '';
      importDiffState.dbCaseFileId = payload.dbCaseFileId || null;
      importDiffState.dbItems = [];
      importDiffState.dbExecSetId = null;
      importDiffState.dbExecCases = [];
      importDiffState.dbReuseEnabled = false;
      importDiffState.dbHasResult = false;
      importDiffState.showResultFields = false;
      importDiffState.rows = [];

      if (tempExecImportDiffTitle) {
        tempExecImportDiffTitle.textContent = '同名用例差异对比：' + (importDiffState.cleanName || importDiffState.fileName || '用例');
      }
      if (tempExecImportDiffStatus) setStatus(tempExecImportDiffStatus, '正在加载差异对比...', '');
      if (tempExecImportDiffLeftMeta) tempExecImportDiffLeftMeta.textContent = '';
      if (tempExecImportDiffRightMeta) tempExecImportDiffRightMeta.textContent = '';
      if (tempExecImportDiffLeftBody) tempExecImportDiffLeftBody.innerHTML = '<tr><td colspan="10"><p class="hint">加载中...</p></td></tr>';
      if (tempExecImportDiffRightBody) tempExecImportDiffRightBody.innerHTML = '<tr><td colspan="10"><p class="hint">加载中...</p></td></tr>';
      setDiffResultFieldsVisible(true);
      syncImportDiffControls();
      if (tempExecDrawer) tempExecDrawer.close();
      if (tempExecImportDiffDrawer && typeof tempExecImportDiffDrawer.open === 'function') {
        tempExecImportDiffDrawer.open();
      } else if (tempExecImportDiffDrawerEl && tempExecImportDiffDrawerEl.classList) {
        tempExecImportDiffDrawerEl.classList.add('open');
        tempExecImportDiffDrawerEl.classList.remove('hidden');
      }
    }

    function openImportDiffDrawer(payload) {
      payload = payload || {};
      importDiffState.loading = false;
      importDiffState.dbItems = Array.isArray(payload.dbItems) ? payload.dbItems : [];
      importDiffState.dbExecSetId = payload.dbExecSetId || null;
      importDiffState.dbExecCases = Array.isArray(payload.dbExecCases) ? payload.dbExecCases : [];
      importDiffState.dbReuseEnabled = payload.dbReuseEnabled === true;
      importDiffState.dbHasResult = payload.dbHasResult === true;
      importDiffState.importHasResult = payload.importHasResult === true;
      importDiffState.showResultFields = Boolean(importDiffState.importHasResult || importDiffState.dbHasResult);

      var importExecMap = buildImportExecCaseMapByKey(importDiffState.importExecCases || []);
      var importRows = flattenDiffRows(importDiffState.importItems || [], importExecMap, {
        includeResult: importDiffState.showResultFields,
        reuseEnabled: importDiffState.importReuseEnabled,
        matchBy: 'key',
      });
      var dbExecMap = buildExecCaseMapByItemId(importDiffState.dbExecCases || []);
      var dbRows = flattenDiffRows(importDiffState.dbItems || [], dbExecMap, {
        includeResult: importDiffState.showResultFields,
        reuseEnabled: importDiffState.dbReuseEnabled,
        matchBy: 'itemId',
      });
      importDiffState.rows = buildDiffRows(importRows, dbRows, importDiffState.showResultFields);

      if (tempExecImportDiffLeftMeta) {
        tempExecImportDiffLeftMeta.textContent = (importRows.length || 0) + ' 行';
        tempExecImportDiffLeftMeta.classList.toggle('warn', importRows.length !== dbRows.length);
      }
      if (tempExecImportDiffRightMeta) {
        tempExecImportDiffRightMeta.textContent = (dbRows.length || 0) + ' 行';
        tempExecImportDiffRightMeta.classList.toggle('warn', importRows.length !== dbRows.length);
      }
      setDiffResultFieldsVisible(importDiffState.showResultFields);
      renderDiffTableBody(tempExecImportDiffLeftBody, 'left', importDiffState.rows, importDiffState.showResultFields);
      renderDiffTableBody(tempExecImportDiffRightBody, 'right', importDiffState.rows, importDiffState.showResultFields);
      if (tempExecImportDiffStatus) setStatus(tempExecImportDiffStatus, '', '');
      syncImportDiffControls();
    }

    function confirmOverwriteImportFromDiff() {
      if (importDiffState.loading) return;
      if (!apiClient || typeof apiClient.importCaseFile !== 'function' || typeof apiClient.upsertExecSetFromCaseFile !== 'function') {
        if (tempExecImportDiffStatus) setStatus(tempExecImportDiffStatus, '后端入库接口未就绪', 'err');
        return;
      }
      var cleanName = importDiffState.cleanName || importDiffState.fileName || '用例';
      var ok = window.confirm('是否确认覆盖导入用例：' + cleanName + '？');
      if (!ok) return;

      var needSecondConfirm = false;
      var secondMsg = '';
      if (importDiffState.dbHasResult && importDiffState.importHasResult) {
        needSecondConfirm = true;
        secondMsg = '覆盖后将替换现有执行结果（实际结果/备注/缺陷链接），是否继续？';
      } else if (importDiffState.dbHasResult && !importDiffState.importHasResult) {
        needSecondConfirm = true;
        secondMsg = '覆盖后将清空现有执行结果（实际结果/备注/缺陷链接），是否继续？';
      }
      if (needSecondConfirm) {
        var ok2 = window.confirm(secondMsg);
        if (!ok2) return;
      }

      var ext = importDiffState.ext || (String(importDiffState.fileName || '').split('.').pop() || 'xmind');
      ext = String(ext || '').toLowerCase();
      if (!ext || ext === String(importDiffState.fileName || '').toLowerCase()) ext = 'xmind';
      var overwriteFileName = String(importDiffState.cleanName || cleanName || 'case') + '.' + ext;

      importDiffState.loading = true;
      syncImportDiffControls();
      if (tempExecImportDiffStatus) setStatus(tempExecImportDiffStatus, '覆盖导入中...', '');
      setStatus(tempExecStatus, '覆盖导入中...', '');

      var shouldImportResult = Boolean(importDiffState.importHasResult);
      var shouldClearResult = Boolean(importDiffState.dbHasResult && !importDiffState.importHasResult);
      var importCases = null;
      var preferSource = 'db';
      if (shouldImportResult) {
        importCases = Array.isArray(importDiffState.importExecCases) ? importDiffState.importExecCases : [];
        preferSource = 'import';
      } else if (shouldClearResult) {
        importCases = (Array.isArray(importDiffState.importExecCases) ? importDiffState.importExecCases : []).map(function(row) {
          if (!row) return null;
          return Object.assign({}, row, { status: '未执行', remark: '', defect_links: [], reuse_details: [] });
        }).filter(Boolean);
        preferSource = 'import';
      }

      apiClient
        .importCaseFile(
          {
            project_id: importDiffState.projectId,
            version_id: importDiffState.importVersionId,
            file_name: overwriteFileName,
            source: importDiffState.source || 'tempexec',
            items: importDiffState.importItems,
          },
          { overwrite: true }
        )
        .then(function(caseFile) {
          if (!caseFile || !caseFile.id) throw new Error('覆盖入库失败：未返回用例文件');
          return apiClient.upsertExecSetFromCaseFile({
            case_file_id: caseFile.id,
            mode: 'replace',
            preserve_results: false,
            prefer_result_source: preferSource,
            import_cases: importCases && importCases.length ? importCases : null,
            requirement: importDiffState.requirement || '',
            reuse_enabled: importDiffState.importReuseEnabled ? true : false,
            reuse_presets: null,
          });
        })
        .then(function(execSet) {
          if (!execSet || !execSet.id) throw new Error('执行集更新失败');
          var chain = Promise.resolve();
          if (api && typeof api.loadTempExecState === 'function') {
            chain = chain.then(function() { return api.loadTempExecState(); });
          }
          return chain.then(function() {
            if (api && typeof api.setTempExecActive === 'function') {
              api.setTempExecActive(String(execSet.id));
            }
            return execSet;
          });
        })
        .then(function() {
          var msg = '覆盖导入成功：' + cleanName;
          if (tempExecImportDiffStatus) setStatus(tempExecImportDiffStatus, msg, 'ok');
          setStatus(tempExecStatus, msg, 'ok');
          importState.pendingFiles = [];
          renderImportFileHint();
          syncImportConfirmState();
          if (tempExecImportDiffDrawer && typeof tempExecImportDiffDrawer.close === 'function') {
            tempExecImportDiffDrawer.close();
          } else if (tempExecImportDiffDrawerEl && tempExecImportDiffDrawerEl.classList) {
            tempExecImportDiffDrawerEl.classList.remove('open');
          }
        })
        .catch(function(err) {
          var msg = err && err.message ? err.message : '覆盖导入失败';
          if (tempExecImportDiffStatus) setStatus(tempExecImportDiffStatus, '覆盖导入失败：' + msg, 'err');
          setStatus(tempExecStatus, '覆盖导入失败：' + msg, 'err');
        })
        .finally(function() {
          importDiffState.loading = false;
          syncImportDiffControls();
        });
    }

    var importPersistKey = 'tap-tempexec-import-drawer';

    function getCurrentUserId() {
      var globalState = window.app && window.app.state ? window.app.state : null;
      var user = globalState && globalState.currentUser ? globalState.currentUser : null;
      var id = user && user.id !== undefined && user.id !== null ? user.id : '';
      if (id === 0 || String(id) === '0') return '';
      return id ? String(id) : '';
    }

    function readImportPersistedState() {
      try {
        var raw = localStorage.getItem(importPersistKey);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
      } catch (err) {
        return null;
      }
    }

    function writeImportPersistedState(payload) {
      try {
        localStorage.setItem(importPersistKey, JSON.stringify(payload));
      } catch (err) {
        // ignore
      }
    }

    function persistImportSelection(projectId, versionId) {
      var userId = getCurrentUserId();
      var payload = {
        user_id: userId,
        project_id: projectId ? String(projectId) : '',
        version_id: versionId ? String(versionId) : '',
        saved_at: Date.now(),
      };
      writeImportPersistedState(payload);
    }

    function applyImportPersistedSelection(projects) {
      if (!isDbImportEnabled()) return false;
      if (importState && importState.projectId) return false;
      var persisted = readImportPersistedState();
      if (!persisted) return false;
      var userId = getCurrentUserId();
      // 有 user_id 时按用户隔离；无 user_id（极少数场景）则允许全局复用。
      if (persisted.user_id && userId && String(persisted.user_id) !== String(userId)) return false;

      var pid = persisted.project_id ? String(persisted.project_id) : '';
      if (!pid) return false;
      var exists = Array.isArray(projects) && projects.some(function(p) { return p && String(p.id) === pid; });
      if (!exists) return false;
      importState.projectId = pid;
      importState.versionId = persisted.version_id ? String(persisted.version_id) : '';
      return true;
    }

    function invalidateImportProjectsCache() {
      importState.projectsLoaded = false;
      importState.versionsByProject = {};
      importState.projectId = '';
      importState.versionId = '';
      if (tempExecImportProjectSelect) {
        tempExecImportProjectSelect.innerHTML = '<option value=\"\">请选择项目</option>';
        tempExecImportProjectSelect.value = '';
      }
      if (tempExecImportVersionSelect) {
        tempExecImportVersionSelect.disabled = true;
        tempExecImportVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
        tempExecImportVersionSelect.value = '';
      }
      syncImportConfirmState();
    }

    function isDbImportEnabled() {
      var globalState = window.app && window.app.state ? window.app.state : null;
      var user = globalState && globalState.currentUser ? globalState.currentUser : null;
      var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
      if (!userId || String(userId) === '0') return false;
      if (!window.app || window.app.authReady !== true) return false;
      if (!apiClient) return false;
      if (typeof apiClient.listProjects !== 'function' || typeof apiClient.listProjectVersions !== 'function') return false;
      return Boolean(api && typeof api.importTempExecFilesToDb === 'function');
    }

    function renderImportFileHint() {
      if (!tempExecImportFileHint) return;
      var files = Array.isArray(importState.pendingFiles) ? importState.pendingFiles : [];
      if (!files.length) {
        tempExecImportFileHint.textContent = '未选择文件';
        return;
      }
      var names = files.map(function(f) { return (f && f.name) ? f.name : ''; }).filter(Boolean);
      var head = names.slice(0, 3).join('、');
      var suffix = names.length > 3 ? ' 等' : '';
      tempExecImportFileHint.textContent = '已选择 ' + names.length + ' 份文件：' + head + suffix;
    }

    function syncImportConfirmState() {
      if (tempExecImportProjectSelect) {
        tempExecImportProjectSelect.disabled = Boolean(importState.loading);
      }
      if (tempExecImportVersionSelect) {
        tempExecImportVersionSelect.disabled = Boolean(importState.loading) || !importState.projectId;
      }
      if (tempExecImportConfirmBtn) {
        var ready = Boolean(
          !importState.loading &&
          importState.projectId &&
          importState.versionId &&
          importState.pendingFiles &&
          importState.pendingFiles.length
        );
        tempExecImportConfirmBtn.disabled = !ready;
      }
    }

    function renderProjectOptions(list) {
      if (!tempExecImportProjectSelect) return;
      var projects = Array.isArray(list) ? list : [];
      var html = ['<option value=\"\">请选择项目</option>'];
      projects.forEach(function(p) {
        if (!p) return;
        var id = p.id;
        if (id === null || id === undefined) return;
        var name = p.name || ('项目#' + id);
        html.push('<option value=\"' + escapeHtml(id) + '\">' + escapeHtml(name) + '</option>');
      });
      tempExecImportProjectSelect.innerHTML = html.join('');
      tempExecImportProjectSelect.value = importState.projectId || '';
    }

    function renderVersionOptions(projectId, list) {
      if (!tempExecImportVersionSelect) return;
      var versions = Array.isArray(list) ? list : [];
      var html = ['<option value=\"\">请选择版本</option>'];
      versions.forEach(function(v) {
        if (!v) return;
        var id = v.id;
        if (id === null || id === undefined) return;
        var name = v.name || ('版本#' + id);
        html.push('<option value=\"' + escapeHtml(id) + '\">' + escapeHtml(name) + '</option>');
      });
      tempExecImportVersionSelect.innerHTML = html.join('');
      tempExecImportVersionSelect.value = importState.versionId || '';
      tempExecImportVersionSelect.disabled = Boolean(importState.loading) || !projectId;
    }

    function ensureImportProjects() {
      if (!isDbImportEnabled()) return;
      if (importState.projectsLoaded) return;
      if (!apiClient || typeof apiClient.listProjects !== 'function') return;
      importState.projectsLoaded = true;
      setStatus(tempExecStatus, '加载项目列表中...', '');
      apiClient
        .listProjects()
        .then(function(list) {
          var projects = Array.isArray(list) ? list : [];
          applyImportPersistedSelection(projects);
          renderProjectOptions(projects);
          setStatus(tempExecStatus, '', '');
          // 若已恢复 projectId，则自动加载版本并尝试恢复 versionId。
          var pid = importState.projectId;
          if (!pid) {
            syncImportConfirmState();
            return;
          }
          if (importState.versionsByProject[pid]) {
            renderVersionOptions(pid, importState.versionsByProject[pid]);
            // 若版本不存在则清空
            if (importState.versionId) {
              var ok = importState.versionsByProject[pid].some(function(v) { return v && String(v.id) === String(importState.versionId); });
              if (!ok) importState.versionId = '';
            }
            renderVersionOptions(pid, importState.versionsByProject[pid]);
            syncImportConfirmState();
            return;
          }
          apiClient
            .listProjectVersions(pid)
            .then(function(versions) {
              importState.versionsByProject[pid] = Array.isArray(versions) ? versions : [];
              if (importState.versionId) {
                var ok = importState.versionsByProject[pid].some(function(v) { return v && String(v.id) === String(importState.versionId); });
                if (!ok) importState.versionId = '';
              }
              renderVersionOptions(pid, importState.versionsByProject[pid]);
              syncImportConfirmState();
            })
            .catch(function() {
              importState.versionId = '';
              renderVersionOptions(pid, []);
              syncImportConfirmState();
            });
        })
        .catch(function(err) {
          importState.projectsLoaded = false;
          setStatus(tempExecStatus, err && err.message ? err.message : '加载项目失败', 'err');
        });
    }

    function handleImportProjectChange() {
      if (!isDbImportEnabled()) return;
      importState.projectId = tempExecImportProjectSelect ? String(tempExecImportProjectSelect.value || '') : '';
      importState.versionId = '';
      persistImportSelection(importState.projectId, '');
      if (tempExecImportVersionSelect) {
        tempExecImportVersionSelect.disabled = true;
        tempExecImportVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
        tempExecImportVersionSelect.value = '';
      }
      syncImportConfirmState();
      var pid = importState.projectId;
      if (!pid) return;
      if (importState.versionsByProject[pid]) {
        renderVersionOptions(pid, importState.versionsByProject[pid]);
        syncImportConfirmState();
        return;
      }
      setStatus(tempExecStatus, '加载版本中...', '');
      apiClient
        .listProjectVersions(pid)
        .then(function(list) {
          importState.versionsByProject[pid] = Array.isArray(list) ? list : [];
          renderVersionOptions(pid, importState.versionsByProject[pid]);
          setStatus(tempExecStatus, '', '');
          syncImportConfirmState();
        })
        .catch(function(err) {
          setStatus(tempExecStatus, err && err.message ? err.message : '加载版本失败', 'err');
          syncImportConfirmState();
        });
    }

    function handleImportVersionChange() {
      if (!isDbImportEnabled()) return;
      importState.versionId = tempExecImportVersionSelect ? String(tempExecImportVersionSelect.value || '') : '';
      persistImportSelection(importState.projectId, importState.versionId);
      syncImportConfirmState();
    }

    if (typeof api.loadTempExecState === 'function') {
      api.loadTempExecState();
    }

    if (tempExecImportProjectSelect) {
      tempExecImportProjectSelect.addEventListener('change', handleImportProjectChange);
    }
    if (tempExecImportVersionSelect) {
      tempExecImportVersionSelect.addEventListener('change', handleImportVersionChange);
    }
    if (tempExecImportConfirmBtn) {
      tempExecImportConfirmBtn.addEventListener('click', function() {
        if (!isDbImportEnabled()) return;
        if (importState.loading) return;
        if (!importState.pendingFiles || !importState.pendingFiles.length) {
          setStatus(tempExecStatus, '请先选择用例文件', 'warn');
          return;
        }
        if (!importState.projectId) {
          setStatus(tempExecStatus, '请先选择项目', 'warn');
          return;
        }
        if (!importState.versionId) {
          setStatus(tempExecStatus, '请先选择版本', 'warn');
          return;
        }
        importState.loading = true;
        syncImportConfirmState();
        api
          .importTempExecFilesToDb(importState.pendingFiles, importState.projectId, importState.versionId)
          .then(function(result) {
            var res = result && typeof result === 'object' ? result : null;
            var failed = res && Array.isArray(res.failed) ? res.failed : [];
            if (failed.length) {
              var failedNames = Object.create(null);
              failed.forEach(function(item) {
                if (!item || !item.file) return;
                failedNames[String(item.file)] = true;
              });
              importState.pendingFiles = Array.prototype.slice.call(importState.pendingFiles || []).filter(function(file) {
                return file && file.name && failedNames[String(file.name)];
              });
            } else {
              importState.pendingFiles = [];
            }
            renderImportFileHint();
            syncImportConfirmState();
          })
          .catch(function(err) {
            if (err && err.code === 'duplicate_case_file' && err.duplicate) {
              var dup = err.duplicate || {};
              var payload = err && err.payload ? err.payload : null;
              var existingId = payload && payload.existing_case_file_id ? payload.existing_case_file_id : null;
              var matchedCleanName = payload && payload.existing_file_name_clean ? String(payload.existing_file_name_clean) : (dup.clean_name || '');
              var dbVersionId = payload && (payload.existing_version_id || payload.existing_version_id === 0) ? payload.existing_version_id : null;
              if (!existingId) {
                setStatus(tempExecStatus, '打开差异对比失败：未找到同名用例 ID', 'err');
                return;
              }
              openImportDiffDrawerLoading({
                fileName: dup.file_name || '',
                cleanName: matchedCleanName || dup.clean_name || '',
                projectId: dup.project_id || importState.projectId,
                importVersionId: dup.version_id || importState.versionId,
                dbVersionId: dbVersionId,
                ext: dup.ext || '',
                source: dup.source || '',
                importItems: Array.isArray(dup.items) ? dup.items : [],
                importExecCases: Array.isArray(dup.exec_cases) ? dup.exec_cases : [],
                importHasResult: dup.has_result === true,
                importReuseEnabled: dup.reuse_enabled === true,
                requirement: dup.requirement || '',
                dbCaseFileId: existingId,
              });

              var projectId = dup.project_id || importState.projectId;
              Promise.all([
                apiClient && typeof apiClient.listCaseItems === 'function' ? apiClient.listCaseItems(existingId) : Promise.resolve([]),
                apiClient && typeof apiClient.listExecSets === 'function' ? apiClient.listExecSets(projectId) : Promise.resolve([]),
              ])
                .then(function(res2) {
                  var dbItems = Array.isArray(res2 && res2[0]) ? res2[0] : [];
                  var execSets = Array.isArray(res2 && res2[1]) ? res2[1] : [];
                  var matchedSet = execSets
                    .filter(function(s) { return s && Number(s.case_file_id) === Number(existingId); })
                    .sort(function(a, b) { return Number(b.id || 0) - Number(a.id || 0); })[0] || null;
                  var reuseEnabled = Boolean(matchedSet && matchedSet.reuse_enabled);
                  if (!matchedSet || !matchedSet.id || !apiClient || typeof apiClient.listExecCases !== 'function') {
                    openImportDiffDrawer({
                      dbItems: dbItems,
                      dbExecSetId: null,
                      dbExecCases: [],
                      dbReuseEnabled: reuseEnabled,
                      dbHasResult: false,
                      importHasResult: dup.has_result === true,
                    });
                    return;
                  }
                  return apiClient.listExecCases(matchedSet.id).then(function(execCases) {
                    var list = Array.isArray(execCases) ? execCases : [];
                    openImportDiffDrawer({
                      dbItems: dbItems,
                      dbExecSetId: matchedSet.id,
                      dbExecCases: list,
                      dbReuseEnabled: reuseEnabled,
                      dbHasResult: detectExecCasesHasResult(list, reuseEnabled),
                      importHasResult: dup.has_result === true,
                    });
                  }).catch(function() {
                    openImportDiffDrawer({
                      dbItems: dbItems,
                      dbExecSetId: matchedSet.id,
                      dbExecCases: [],
                      dbReuseEnabled: reuseEnabled,
                      dbHasResult: false,
                      importHasResult: dup.has_result === true,
                    });
                  });
                })
                .catch(function(e) {
                  var msg = e && e.message ? e.message : '打开差异对比失败';
                  if (tempExecImportDiffStatus) setStatus(tempExecImportDiffStatus, msg, 'err');
                  setStatus(tempExecStatus, msg, 'err');
                })
                .finally(function() {
                  importState.loading = false;
                  syncImportConfirmState();
                });
              return;
            }
            setStatus(tempExecStatus, err && err.message ? err.message : '入库失败', 'err');
          })
          .finally(function() {
            importState.loading = false;
            syncImportConfirmState();
          });
      });
    }

    if (tempExecImportDiffOverwriteBtn) {
      tempExecImportDiffOverwriteBtn.addEventListener('click', confirmOverwriteImportFromDiff);
    }

    if (tempExecInput && tempExecDropZone && typeof api.importTempExecFiles === 'function') {
      tempExecInput.addEventListener('change', function(e) {
        var files = e.target.files;
        if (files && files.length) {
          if (isDbImportEnabled()) {
            importState.pendingFiles = Array.prototype.slice.call(files || []).filter(Boolean);
            renderImportFileHint();
            syncImportConfirmState();
            setStatus(tempExecStatus, '已选择文件，请选择项目与版本后点击确认入库', 'ok');
          } else {
            api.importTempExecFiles(files);
          }
        }
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
        if (files && files.length) {
          if (isDbImportEnabled()) {
            importState.pendingFiles = Array.prototype.slice.call(files || []).filter(Boolean);
            renderImportFileHint();
            syncImportConfirmState();
            setStatus(tempExecStatus, '已选择文件，请选择项目与版本后点击确认入库', 'ok');
          } else {
            api.importTempExecFiles(files);
          }
        }
      });
    }

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('app-tab-activated', function(e) {
        var tabName = e && e.detail ? e.detail.tab : '';
        if (tabName !== 'tempexec') return;
        ensureImportProjects();
        // 切到“用例执行”时的刷新/同步由 core/appRuntime 统一触发（避免时序差导致漏触发或重复触发）。
      });
      window.addEventListener('app-auth-ready', function() {
        ensureImportProjects();
        // authReady 后 DB 能力才完整可用：补一次加载，确保“历史执行记录/个人执行集”能立即展示。
        if (typeof api.loadTempExecState === 'function') {
          api.loadTempExecState();
        }
      });
      window.addEventListener('app-projects-updated', function() {
        invalidateImportProjectsCache();
        var globalState = window.app && window.app.state ? window.app.state : {};
        var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
        if (tabName === 'tempexec') {
          ensureImportProjects();
          // 版本删除并转移后，需要同步刷新执行区的项目/版本分组
          if (typeof api.loadTempExecState === 'function') {
            api.loadTempExecState();
          }
        }
      });
    }
    ensureImportProjects();
    renderImportFileHint();
    syncImportConfirmState();

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

    function parseProjectVersionKey(raw) {
      var text = String(raw || '');
      var parts = text.split('||');
      if (parts.length < 2) return { projectId: '', versionId: '' };
      return { projectId: parts[0] || '', versionId: parts.slice(1).join('||') || '' };
    }

    function getProjectFiles(projectId) {
      var pid = String(projectId || '');
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      return list.filter(function(file) { return file && String(file.projectId || '') === pid; });
    }

    function getProjectVersionFiles(projectId, versionId) {
      var pid = String(projectId || '');
      var vid = String(versionId || '');
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      return list.filter(function(file) {
        if (!file) return false;
        if (String(file.projectId || '') !== pid) return false;
        return String(file.versionId || '') === vid;
      });
    }

    function resolveInsertBeforeFileId(containerEl, clientY) {
      if (!containerEl || !containerEl.querySelectorAll) return '';
      var rows = Array.prototype.slice.call(containerEl.querySelectorAll('.temp-req-row[data-temp-file]'));
      if (!rows.length) return '';
      var target = '';
      rows.some(function(row) {
        if (!row || !row.getBoundingClientRect) return false;
        var rect = row.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          target = row.dataset.tempFile || '';
          return true;
        }
        return false;
      });
      return target;
    }

    function resolveProjectLabel(projectId) {
      var pid = String(projectId || '');
      if (!pid) return '项目#未知';
      var list = Array.isArray(state.projects) ? state.projects : [];
      var found = list.find(function(p) { return p && String(p.id) === pid; });
      var name = found && found.name ? String(found.name) : '';
      return name.trim() || ('项目#' + pid);
    }

    function resolveVersionLabel(projectId, versionId) {
      var pid = String(projectId || '');
      var vid = String(versionId || '');
      if (!vid) return '全部版本';
      var byProject = state.projectVersionsByProject && typeof state.projectVersionsByProject === 'object'
        ? state.projectVersionsByProject
        : {};
      var list = pid && Array.isArray(byProject[pid]) ? byProject[pid] : [];
      var found = list.find(function(v) { return v && String(v.id) === vid; });
      var name = found && found.name ? String(found.name) : '';
      return name.trim() || ('版本#' + vid);
    }

	    if (tempVersionGrid) {
	      var tempProjectLayoutDropIndicator = null;
	      var tempProjectLayoutDrag = { type: '', key: '' };
	      var tempProjectLayoutFileHover = { body: null, hoverId: '' };
	      var tempProjectLayoutFileDropIndicator = null;
	      function ensureTempProjectLayoutDropIndicator(type) {
	        if (!tempProjectLayoutDropIndicator) {
	          tempProjectLayoutDropIndicator = document.createElement('div');
	          tempProjectLayoutDropIndicator.className = 'temp-drop-indicator';
	          tempProjectLayoutDropIndicator.setAttribute('aria-hidden', 'true');
        }
        var t = type || '';
        tempProjectLayoutDropIndicator.classList.toggle('project', t === 'project');
        tempProjectLayoutDropIndicator.classList.toggle('version', t === 'version');
        tempProjectLayoutDropIndicator.dataset.dropType = t;
        return tempProjectLayoutDropIndicator;
      }
	      function clearTempProjectLayoutDropIndicator() {
	        if (tempProjectLayoutDropIndicator && tempProjectLayoutDropIndicator.parentNode) {
	          tempProjectLayoutDropIndicator.parentNode.removeChild(tempProjectLayoutDropIndicator);
	        }
	        if (tempProjectLayoutDropIndicator) {
	          tempProjectLayoutDropIndicator.dataset.dropType = '';
	          tempProjectLayoutDropIndicator.dataset.dropTargetId = '';
	          tempProjectLayoutDropIndicator.dataset.dropAfter = '';
	          tempProjectLayoutDropIndicator.dataset.dropProjectId = '';
	        }
	      }

	      function clearTempProjectLayoutFileHover() {
	        var body = tempProjectLayoutFileHover && tempProjectLayoutFileHover.body ? tempProjectLayoutFileHover.body : null;
	        if (body && body.classList) body.classList.remove('dragover-file');
	        if (body && body.querySelectorAll) {
	          var rows = body.querySelectorAll('.temp-req-row.dragover-target');
	          rows.forEach(function(el) { el.classList.remove('dragover-target'); });
	        }
	        if (tempProjectLayoutFileDropIndicator && tempProjectLayoutFileDropIndicator.parentNode) {
	          tempProjectLayoutFileDropIndicator.parentNode.removeChild(tempProjectLayoutFileDropIndicator);
	        }
	        tempProjectLayoutFileHover = { body: null, hoverId: '' };
	      }

	      function ensureTempProjectLayoutFileDropIndicator() {
	        if (tempProjectLayoutFileDropIndicator) return tempProjectLayoutFileDropIndicator;
	        tempProjectLayoutFileDropIndicator = document.createElement('div');
	        tempProjectLayoutFileDropIndicator.className = 'temp-file-drop-indicator';
	        tempProjectLayoutFileDropIndicator.setAttribute('aria-hidden', 'true');
	        return tempProjectLayoutFileDropIndicator;
	      }

	      function autoScrollContainerOnDrag(container, clientY) {
	        if (!container || !container.getBoundingClientRect) return;
	        if (container.scrollHeight <= container.clientHeight) return;
	        var rect = container.getBoundingClientRect();
	        var threshold = 26;
	        var step = 18;
	        if (clientY < rect.top + threshold) {
	          container.scrollTop = Math.max(0, container.scrollTop - step);
	        } else if (clientY > rect.bottom - threshold) {
	          var maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
	          container.scrollTop = Math.min(maxTop, container.scrollTop + step);
	        }
	      }
      function getDropAfterByPointer(e, rect, prefer) {
        if (!e || !rect) return false;
        var mode = prefer || 'auto';
        if (mode === 'x') {
          return e.clientX > (rect.left + rect.width / 2);
        }
        if (mode === 'y') {
          return e.clientY > (rect.top + rect.height / 2);
        }
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = (e.clientX - cx) / Math.max(1, rect.width);
        var dy = (e.clientY - cy) / Math.max(1, rect.height);
        if (Math.abs(dx) >= Math.abs(dy)) return dx > 0;
        return dy > 0;
      }
      function getDropAfterByPointerAny(e, rect) {
        if (!e || !rect) return false;
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        return e.clientX > cx || e.clientY > cy;
      }
      function findCardUnderPointer(cards, x, y) {
        var list = Array.isArray(cards) ? cards : [];
        for (var i = 0; i < list.length; i += 1) {
          var el = list[i];
          if (!el || !el.getBoundingClientRect) continue;
          var rect = el.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return el;
        }
        return null;
      }
      function trySetDragImage(e, el) {
        if (!e || !e.dataTransfer || !el || !el.getBoundingClientRect) return;
        try {
          var rect = el.getBoundingClientRect();
          var x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          var y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
          if (typeof e.dataTransfer.setDragImage === 'function') {
            e.dataTransfer.setDragImage(el, x, y);
          }
        } catch (err) {}
      }

      tempVersionGrid.addEventListener('click', function(e) {
        var projectRemoveBtn = e.target.closest('[data-temp-project-remove]');
        if (projectRemoveBtn && api.removeTempExecProject) {
          var pid = projectRemoveBtn.dataset.tempProjectRemove || '';
          var projectFiles = getProjectFiles(pid);
          var projectLabel = resolveProjectLabel(pid);
          var confirmed = window.confirm('是否确认关闭项目【' + projectLabel + '】（' + projectFiles.length + ' 份用例）？');
          if (!confirmed) return;
          api.removeTempExecProject(pid);
          return;
        }
        var versionRemoveBtn = e.target.closest('[data-temp-project-version-remove]');
        if (versionRemoveBtn && api.removeTempExecProjectVersion) {
          var key = versionRemoveBtn.dataset.tempProjectVersionRemove || '';
          var parsed = parseProjectVersionKey(key);
          var versionFiles = getProjectVersionFiles(parsed.projectId, parsed.versionId);
          var versionLabel = resolveVersionLabel(parsed.projectId, parsed.versionId);
          var confirmed2 = window.confirm('是否确认关闭版本【' + versionLabel + '】（' + versionFiles.length + ' 份用例）？');
          if (!confirmed2) return;
          api.removeTempExecProjectVersion(parsed.projectId, parsed.versionId);
          return;
        }
        var fileRemoveBtn = e.target.closest('[data-temp-remove]');
        if (fileRemoveBtn && api.removeTempExecFile) {
          e.preventDefault();
          e.stopPropagation();
          var fileId = fileRemoveBtn.dataset.tempRemove;
          var targetFile = api.getTempExecFile ? api.getTempExecFile(fileId) : null;
          if (!targetFile) return;
          var confirmed3 = window.confirm("确定要删除【" + targetFile.name + "】吗？此操作不可撤销。");
          if (!confirmed3) return;
          api.removeTempExecFile(fileId);
          return;
        }
        // 支持点击整行（含条数徽标/标签），不仅限于按钮本体
        var fileNode = e.target.closest('[data-temp-file]');
        if (!fileNode) return;
        var id = fileNode.dataset.tempFile;
        if (!id) return;
        if (api.getTempExecFile && !api.getTempExecFile(id)) return;
        if (id !== state.tempExecActiveId && api.setTempExecActive) api.setTempExecActive(id);
        // DB 项目/版本分组模式下，避免触发 switchTab 重载导致 activeId 被旧设置覆盖回滚
        if (!(api.isTempExecProjectLayoutEnabled && api.isTempExecProjectLayoutEnabled())) {
          switchTab('tempexec');
        }
      });

      tempVersionGrid.addEventListener('dragstart', function(e) {
        var project = e.target.closest('[data-temp-project-card]');
        var projectHeader = e.target.closest('[data-temp-project-drag]');
        var version = e.target.closest('[data-temp-project-version-card]');
        var versionHeader = e.target.closest('[data-temp-project-version-drag]');
        var fileRow = e.target.closest('[data-temp-file]');
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = 'move';
        if (project && projectHeader && project.dataset.tempProjectCard) {
          e.dataTransfer.setData('text/temp-project', project.dataset.tempProjectCard);
          tempProjectLayoutDrag = { type: 'project', key: String(project.dataset.tempProjectCard || '') };
          trySetDragImage(e, project);
          return;
        }
        if (version && versionHeader && version.dataset.tempProjectVersionCard) {
          e.dataTransfer.setData('text/temp-project-version', version.dataset.tempProjectVersionCard);
          tempProjectLayoutDrag = { type: 'version', key: String(version.dataset.tempProjectVersionCard || '') };
          trySetDragImage(e, version);
          return;
        }
        if (fileRow && fileRow.dataset.tempFile) {
          e.dataTransfer.setData('text/plain', fileRow.dataset.tempFile);
        }
      });

	      tempVersionGrid.addEventListener('dragover', function(e) {
	        if (!e) return;
	        if (!e.dataTransfer) return;
	        e.preventDefault();
	        var dragType = tempProjectLayoutDrag && tempProjectLayoutDrag.type ? tempProjectLayoutDrag.type : '';
	        var dragKey = tempProjectLayoutDrag && tempProjectLayoutDrag.key ? tempProjectLayoutDrag.key : '';
	        if (!dragType) {
	          var ids = e.dataTransfer.getData('text/plain') || '';
	          if (!ids && window.app && window.app.tempDragContext && window.app.tempDragContext.type === 'file') {
	            ids = window.app.tempDragContext.fileId || '';
	          }
	          var versionCardHover = e.target.closest('[data-temp-project-version-card]');
	          var bodyHover = versionCardHover ? versionCardHover.querySelector('.temp-project-version-body') : null;
	          if (ids && bodyHover) {
	            if (tempProjectLayoutFileHover.body && tempProjectLayoutFileHover.body !== bodyHover) {
	              clearTempProjectLayoutFileHover();
	            }
	            bodyHover.classList.add('dragover-file');
	            autoScrollContainerOnDrag(bodyHover, e.clientY);
	            var beforeId = resolveInsertBeforeFileId(bodyHover, e.clientY);
	            var indicatorFile = ensureTempProjectLayoutFileDropIndicator();
	            var rows = Array.prototype.slice.call(bodyHover.querySelectorAll('.temp-req-row[data-temp-file]'));
	            var inserted = false;
	            if (beforeId) {
	              var targetRow = bodyHover.querySelector('.temp-req-row[data-temp-file="' + beforeId + '"]');
	              if (targetRow) {
	                bodyHover.insertBefore(indicatorFile, targetRow);
	                inserted = true;
	              }
	            }
	            if (!inserted) {
	              var firstRow = bodyHover.querySelector('.temp-req-row[data-temp-file]');
	              var hint = bodyHover.querySelector('.hint');
	              if (!firstRow && hint) {
	                bodyHover.insertBefore(indicatorFile, hint);
	                inserted = true;
	              }
	            }
	            if (!inserted) {
	              bodyHover.appendChild(indicatorFile);
	            }
	            rows.forEach(function(row) {
	              row.classList.toggle('dragover-target', Boolean(beforeId) && row.dataset.tempFile === beforeId);
	            });
	            tempProjectLayoutFileHover = { body: bodyHover, hoverId: beforeId || '' };
	            clearTempProjectLayoutDropIndicator();
	            return;
	          }
	          clearTempProjectLayoutFileHover();
	        }
	        if (dragType === 'project' && dragKey) {
	          clearTempProjectLayoutFileHover();
	          var indicator = ensureTempProjectLayoutDropIndicator('project');
	          var cards = Array.prototype.slice.call(tempVersionGrid.querySelectorAll('.temp-project-card'));
	          cards = cards.filter(function(el) { return el && el !== indicator; });
	          if (!cards.length) {
            tempVersionGrid.appendChild(indicator);
            indicator.dataset.dropTargetId = '';
            indicator.dataset.dropAfter = '0';
            return;
          }
          var insertIndex = cards.length;
          var targetId = cards[cards.length - 1].dataset.tempProjectCard || '';
          var after = true;
          for (var i = 0; i < cards.length; i += 1) {
            var card = cards[i];
            if (!card || !card.getBoundingClientRect) continue;
            var rect = card.getBoundingClientRect();
            var midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
              insertIndex = i;
              targetId = card.dataset.tempProjectCard || '';
              after = false;
              break;
            }
          }
          if (insertIndex >= cards.length) {
            targetId = cards[cards.length - 1].dataset.tempProjectCard || '';
            after = true;
          }
          indicator.dataset.dropTargetId = targetId;
          indicator.dataset.dropAfter = after ? '1' : '0';
          var ref = cards[insertIndex] || null;
	          tempVersionGrid.insertBefore(indicator, ref);
	          return;
	        }
	        if (dragType === 'version' && dragKey) {
	          clearTempProjectLayoutFileHover();
	          var src = parseProjectVersionKey(dragKey);
	          var projectCard = e.target.closest('[data-temp-project-card]');
	          if (!projectCard || !projectCard.dataset.tempProjectCard) {
	            clearTempProjectLayoutDropIndicator();
            return;
          }
          if (src.projectId && String(src.projectId) !== String(projectCard.dataset.tempProjectCard || '')) {
            clearTempProjectLayoutDropIndicator();
            return;
          }
          var grid = projectCard.querySelector('.temp-project-versions');
          if (!grid) {
            clearTempProjectLayoutDropIndicator();
            return;
          }
          var indicator2 = ensureTempProjectLayoutDropIndicator('version');
          var versionCards = Array.prototype.slice.call(grid.querySelectorAll('.temp-project-version'));
          versionCards = versionCards.filter(function(el) { return el && el !== indicator2; });
          if (!versionCards.length) {
            grid.appendChild(indicator2);
            indicator2.dataset.dropProjectId = projectCard.dataset.tempProjectCard || '';
            indicator2.dataset.dropTargetId = '';
            indicator2.dataset.dropAfter = '0';
            return;
          }
          var hit = findCardUnderPointer(versionCards, e.clientX, e.clientY);
          var insertIndex2 = versionCards.length;
          var targetKey = versionCards[versionCards.length - 1].dataset.tempProjectVersionCard || '';
          var insertAfter2 = true;
          if (hit) {
            var rect2 = hit.getBoundingClientRect();
            insertAfter2 = getDropAfterByPointerAny(e, rect2);
            var idx2 = versionCards.indexOf(hit);
            if (idx2 === -1) idx2 = versionCards.length - 1;
            insertIndex2 = idx2 + (insertAfter2 ? 1 : 0);
            targetKey = hit.dataset.tempProjectVersionCard || targetKey;
          } else {
            var rowCandidates = versionCards.filter(function(card2) {
              if (!card2 || !card2.getBoundingClientRect) return false;
              var r2 = card2.getBoundingClientRect();
              return e.clientY >= r2.top && e.clientY <= r2.bottom;
            });
            if (rowCandidates.length) {
              rowCandidates.sort(function(a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
              for (var j = 0; j < rowCandidates.length; j += 1) {
                var rc = rowCandidates[j];
                var rr = rc.getBoundingClientRect();
                var cx2 = rr.left + rr.width / 2;
                if (e.clientX < cx2) {
                  insertIndex2 = versionCards.indexOf(rc);
                  targetKey = rc.dataset.tempProjectVersionCard || targetKey;
                  insertAfter2 = false;
                  break;
                }
              }
              if (insertIndex2 === versionCards.length) {
                var last = rowCandidates[rowCandidates.length - 1];
                insertIndex2 = versionCards.indexOf(last) + 1;
                targetKey = last.dataset.tempProjectVersionCard || targetKey;
                insertAfter2 = true;
              }
            } else {
              for (var k = 0; k < versionCards.length; k += 1) {
                var c2 = versionCards[k];
                var cr = c2.getBoundingClientRect();
                var midY2 = cr.top + cr.height / 2;
                if (e.clientY < midY2) {
                  insertIndex2 = k;
                  targetKey = c2.dataset.tempProjectVersionCard || targetKey;
                  insertAfter2 = false;
                  break;
                }
              }
              if (insertIndex2 === versionCards.length) {
                targetKey = versionCards[versionCards.length - 1].dataset.tempProjectVersionCard || targetKey;
                insertAfter2 = true;
              }
            }
          }
          indicator2.dataset.dropProjectId = projectCard.dataset.tempProjectCard || '';
          indicator2.dataset.dropTargetId = targetKey;
          indicator2.dataset.dropAfter = insertAfter2 ? '1' : '0';
          var ref2 = versionCards[insertIndex2] || null;
	          grid.insertBefore(indicator2, ref2);
	          return;
	        }
	        // 其他拖拽（如用例条目拖拽）不走此指示器
	        clearTempProjectLayoutDropIndicator();
	      });

	      tempVersionGrid.addEventListener('dragleave', function(e) {
	        if (!e) return;
	        // dragleave 会在子元素之间频繁触发：仅当离开整个容器时才清理
	        if (e.currentTarget !== tempVersionGrid) return;
	        if (e.target !== tempVersionGrid) return;
	        clearTempProjectLayoutDropIndicator();
	        clearTempProjectLayoutFileHover();
	      });

	      tempVersionGrid.addEventListener('dragend', function() {
	        clearTempProjectLayoutDropIndicator();
	        clearTempProjectLayoutFileHover();
	        tempProjectLayoutDrag = { type: '', key: '' };
	      });

	      tempVersionGrid.addEventListener('drop', function(e) {
	        e.preventDefault();
	        if (!e.dataTransfer) return;
	        clearTempProjectLayoutFileHover();
	        // drop 时也可能无法读取 dataTransfer（浏览器安全策略差异），兜底使用 dragstart 记录的类型/键
	        var dragProject = e.dataTransfer.getData('text/temp-project') || (tempProjectLayoutDrag.type === 'project' ? tempProjectLayoutDrag.key : '');
        if (dragProject && api.reorderTempExecProject) {
          var indicator = tempProjectLayoutDropIndicator;
          var targetId = indicator && indicator.dataset ? (indicator.dataset.dropTargetId || '') : '';
          var after = indicator && indicator.dataset ? (indicator.dataset.dropAfter === '1') : false;
          if (!targetId) {
            // 兜底：落在某个项目卡片上
            var projectCard = e.target.closest('[data-temp-project-card]');
            targetId = projectCard && projectCard.dataset ? (projectCard.dataset.tempProjectCard || '') : '';
            after = false;
          }
          if (targetId) api.reorderTempExecProject(dragProject, targetId, { after: after });
          clearTempProjectLayoutDropIndicator();
          tempProjectLayoutDrag = { type: '', key: '' };
          return;
        }
        var dragVerKey = e.dataTransfer.getData('text/temp-project-version') || (tempProjectLayoutDrag.type === 'version' ? tempProjectLayoutDrag.key : '');
        if (dragVerKey && api.reorderTempExecProjectVersion) {
          var src2 = parseProjectVersionKey(dragVerKey);
          var indicator2 = tempProjectLayoutDropIndicator;
          var targetKey = indicator2 && indicator2.dataset ? (indicator2.dataset.dropTargetId || '') : '';
          var after2 = indicator2 && indicator2.dataset ? (indicator2.dataset.dropAfter === '1') : false;
          var projectId = indicator2 && indicator2.dataset ? (indicator2.dataset.dropProjectId || '') : '';
          // 以 drop 时的落点为准：若落在具体版本盒子上，则根据落点左右半区判定前/后插入
          var versionCard = e.target.closest('[data-temp-project-version-card]');
          if (versionCard && versionCard.dataset && versionCard.dataset.tempProjectVersionCard) {
            targetKey = versionCard.dataset.tempProjectVersionCard || targetKey;
            var rect = versionCard.getBoundingClientRect ? versionCard.getBoundingClientRect() : null;
            after2 = rect ? getDropAfterByPointerAny(e, rect) : after2;
            projectId = '';
          }
          var tgt2 = parseProjectVersionKey(targetKey);
          var pid2 = projectId || tgt2.projectId || src2.projectId;
          if (src2.projectId && pid2 && String(src2.projectId) === String(pid2) && tgt2.versionId) {
            api.reorderTempExecProjectVersion(pid2, src2.versionId, tgt2.versionId, { after: after2 });
          } else if (src2.projectId && pid2 && String(src2.projectId) !== String(pid2)) {
            setStatus(tempExecStatus, '不同项目之间不支持拖拽调整版本顺序', 'warn');
          }
          clearTempProjectLayoutDropIndicator();
          tempProjectLayoutDrag = { type: '', key: '' };
          return;
        }
        clearTempProjectLayoutDropIndicator();
        tempProjectLayoutDrag = { type: '', key: '' };
        var ids = e.dataTransfer.getData('text/plain');
        if (ids && api.reorderTempExecFileInProjectVersion) {
          var versionCard = e.target.closest('[data-temp-project-version-card]');
          if (!versionCard || !versionCard.dataset.tempProjectVersionCard) return;
          var parsed = parseProjectVersionKey(versionCard.dataset.tempProjectVersionCard);
          var idArr = ids.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
          if (!idArr.length) return;
          var file = api.getTempExecFile ? api.getTempExecFile(idArr[0]) : null;
          if (!file) return;
          if (String(file.projectId || '') !== String(parsed.projectId || '') || String(file.versionId || '') !== String(parsed.versionId || '')) {
            setStatus(tempExecStatus, '不同项目/不同版本之间不支持拖拽移动用例', 'warn');
            return;
          }
          var body = versionCard.querySelector('.temp-project-version-body');
          var beforeId = resolveInsertBeforeFileId(body, e.clientY);
          api.reorderTempExecFileInProjectVersion(parsed.projectId, parsed.versionId, String(file.id), beforeId || '');
        }
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
            if (!(api.isTempExecProjectLayoutEnabled && api.isTempExecProjectLayoutEnabled())) {
              switchTab('tempexec');
            }
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
        var projectBtn = e.target.closest('[data-temp-overview-project]');
        if (projectBtn) {
          e.preventDefault();
          e.stopPropagation();
          var pid = projectBtn.dataset ? (projectBtn.dataset.tempOverviewProject || '') : '';
          if (state) {
            state.tempExecOverviewProjectId = pid;
            state.tempExecOverviewVersionId = '';
          }
          if (api.renderTempExecOverview) api.renderTempExecOverview();
          return;
        }
        var seg = e.target.closest('[data-temp-overview-file][data-temp-overview-status]');
        if (seg) {
          e.preventDefault();
          e.stopPropagation();
          var segFileId = seg.dataset.tempOverviewFile;
          var segIndex = Number(seg.dataset.tempOverviewIndex);
          if (!Number.isFinite(segIndex) || segIndex < 0) segIndex = 0;
          jumpToTempExecCase(segFileId, segIndex);
          return;
        }
        var card = e.target.closest('[data-temp-file]');
        if (!card) return;
        var fileId = card.dataset.tempFile;
        if (fileId) {
          e.preventDefault();
          e.stopPropagation();
          try {
            if (window.app) window.app.__drawerSkipRestoreOnce = true;
          } catch (err2) {
            // ignore
          }
          switchTab('tempexec');
          updateTempExecToolbarOffset();
          if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
          if (tempExecDrawer) tempExecDrawer.close();
          if (tempExecOverviewSection) tempExecOverviewSection.classList.add('hidden');
          if (tempExecViewSection) tempExecViewSection.classList.remove('hidden');
          api.setTempExecActive(fileId);
          // 选中用例后回到执行视图：定位到执行视图顶部，避免抽屉关闭滚动恢复导致“列表上滚遮挡顶部”。
          scrollToTempExecViewTop({ waitForDrawerUnlock: true });
        }
      });
      tempExecOverview.addEventListener('change', function(e) {
        var sel = e && e.target && e.target.closest ? e.target.closest('[data-temp-overview-version-select]') : null;
        if (!sel) return;
        if (state) state.tempExecOverviewVersionId = sel.value || '';
        if (api.renderTempExecOverview) api.renderTempExecOverview();
      });
    }
    if (tempExecBackBtn) {
      tempExecBackBtn.addEventListener('click', function() {
        try {
          if (api.prioritizeTempExecUnassignedRequirements) {
            api.prioritizeTempExecUnassignedRequirements();
          }
        } catch (err) {
          // ignore
        }
        try {
          if (window.app) window.app.__drawerSkipRestoreOnce = true;
        } catch (err2) {
          // ignore
        }
        switchTab('tempexec');
        if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
        if (tempExecDrawer) tempExecDrawer.close();
        if (tempExecViewSection) {
          tempExecViewSection.classList.remove('hidden');
        }
        if (tempExecOverviewSection) tempExecOverviewSection.classList.add('hidden');
        scrollToTempExecViewTop({ waitForDrawerUnlock: true });
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
        if (api.isTempExecProjectLayoutEnabled && api.isTempExecProjectLayoutEnabled()) {
          setStatus(tempExecStatus, '当前为项目分组模式，不支持手动新建版本', 'warn');
          return;
        }
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
          if (!Number.isNaN(rcIdx)) {
            var rr = null;
            try { rr = removeCaseBtn.getBoundingClientRect ? removeCaseBtn.getBoundingClientRect() : null; } catch (_) { rr = null; }
            var anchorRect = rr
              ? { left: rr.left, top: rr.top, width: rr.width, height: rr.height, bottom: rr.bottom }
              : null;
            api.removeTempExecCase(rcFileId, rcIdx, anchorRect);
          }
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
          if (!Number.isNaN(icIdx)) {
            var ir = null;
            try { ir = insertCaseBtn.getBoundingClientRect ? insertCaseBtn.getBoundingClientRect() : null; } catch (_) { ir = null; }
            var anchorRect2 = ir
              ? { left: ir.left, top: ir.top, width: ir.width, height: ir.height, bottom: ir.bottom }
              : null;
            api.insertTempExecCase(icFileId, icIdx, anchorRect2);
          }
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
          if (!Number.isNaN(rcIdx)) {
            var rr2 = null;
            try { rr2 = removeCaseBtn.getBoundingClientRect ? removeCaseBtn.getBoundingClientRect() : null; } catch (_) { rr2 = null; }
            var anchorRect3 = rr2
              ? { left: rr2.left, top: rr2.top, width: rr2.width, height: rr2.height, bottom: rr2.bottom }
              : null;
            api.removeTempExecCase(rcFileId, rcIdx, anchorRect3);
          }
          return;
        }
        var insertCaseBtn = e.target.closest('[data-temp-case-insert]');
        if (insertCaseBtn && api.insertTempExecCase) {
          var icFileId = insertCaseBtn.dataset.tempCaseInsert;
          var icIdx = Number(insertCaseBtn.dataset.index);
          if (!Number.isNaN(icIdx)) {
            var ir2 = null;
            try { ir2 = insertCaseBtn.getBoundingClientRect ? insertCaseBtn.getBoundingClientRect() : null; } catch (_) { ir2 = null; }
            var anchorRect4 = ir2
              ? { left: ir2.left, top: ir2.top, width: ir2.width, height: ir2.height, bottom: ir2.bottom }
              : null;
            api.insertTempExecCase(icFileId, icIdx, anchorRect4);
          }
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
    if (tempExecCaseLibraryChangesBtn && api.openTempExecCaseLibraryDiffDrawer) {
      tempExecCaseLibraryChangesBtn.addEventListener('click', function() {
        api.openTempExecCaseLibraryDiffDrawer({ manual: true });
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
