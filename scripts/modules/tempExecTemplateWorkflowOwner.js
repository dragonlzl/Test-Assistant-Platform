(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecTemplateWorkflowOwner = api;
  }
})(function() {
  function normalizeTemplateName(raw) {
    if (!raw) return '';
    var clean = String(raw).split('?')[0] || '';
    clean = clean.replace(/\\/g, '/');
    var name = clean.split('/').pop() || '';
    try {
      name = decodeURIComponent(name);
    } catch (error) {
      // Keep the undecoded filename when a directory listing contains invalid escapes.
    }
    if (name.toLowerCase().lastIndexOf('.xmind') === name.length - 6) {
      name = name.slice(0, -6);
    }
    return name.trim();
  }

  function dedupeAndSort(list) {
    var seen = new Set();
    var result = [];
    (Array.isArray(list) ? list : []).forEach(function(name) {
      var normalized = normalizeTemplateName(name);
      var key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) return;
      seen.add(key);
      result.push(normalized);
    });
    result.sort(function(a, b) { return a.localeCompare(b, 'zh-Hans-CN'); });
    return result;
  }

  function parseTemplateListFromHtml(raw, Parser) {
    if (!raw) return [];
    var names = [];
    var ParserCtor = Parser || (typeof DOMParser === 'function' ? DOMParser : null);
    if (ParserCtor) {
      try {
        var parser = new ParserCtor();
        var parsedDocument = parser.parseFromString(raw, 'text/html');
        var anchors = Array.prototype.slice.call(parsedDocument.getElementsByTagName('a'));
        anchors.forEach(function(anchor) {
          var href = anchor.getAttribute('href') || '';
          var text = anchor.textContent || '';
          [href, text].forEach(function(value) {
            if (value && value.toLowerCase().indexOf('.xmind') !== -1) {
              var parsed = normalizeTemplateName(value);
              if (parsed) names.push(parsed);
            }
          });
        });
      } catch (error) {
        names = [];
      }
    }
    if (!names.length) {
      var hrefRegex = /href\s*=\s*"([^"]+\.xmind)"/gi;
      var hrefMatch = hrefRegex.exec(raw);
      while (hrefMatch) {
        names.push(hrefMatch[1]);
        hrefMatch = hrefRegex.exec(raw);
      }
    }
    if (!names.length) {
      var textRegex = /([^\s"'<>]+\.xmind)/gi;
      var textMatch = textRegex.exec(raw);
      while (textMatch) {
        names.push(textMatch[1]);
        textMatch = textRegex.exec(raw);
      }
    }
    return dedupeAndSort(names);
  }

  function mergeTemplateSources(manifestList, directoryList) {
    var directoryNames = dedupeAndSort(directoryList);
    if (directoryNames.length) return directoryNames;
    return dedupeAndSort(manifestList);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var browser = opts.window || (typeof window !== 'undefined' ? window : {});
    var document = opts.document || (browser && browser.document ? browser.document : null);
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var escapeHtml = typeof opts.escapeHtml === 'function' ? opts.escapeHtml : function(value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var fetchRequest = typeof opts.fetch === 'function'
      ? opts.fetch
      : (browser && typeof browser.fetch === 'function' ? browser.fetch.bind(browser) : null);
    var now = typeof opts.now === 'function' ? opts.now : Date.now;
    var ParserCtor = opts.DOMParser || (browser && browser.DOMParser ? browser.DOMParser : null);
    var FileCtor = opts.File || (browser && browser.File ? browser.File : null);
    var dropdown = document ? document.getElementById('caseTemplateDropdown') : null;
    var toggle = document ? document.getElementById('caseTemplateToggle') : null;
    var menu = document ? document.getElementById('caseTemplateMenu') : null;
    var statusElement = opts.statusElement || null;
    var loaded = false;
    var loading = false;
    var templateList = [];
    var localHandles = {};
    var bound = false;

    function getTemplateBase() {
      var path = browser && browser.location && browser.location.pathname
        ? browser.location.pathname
        : '';
      if (!path) return 'caseTemplate/';
      return path.replace(/[^/]*$/, '') + 'caseTemplate/';
    }

    function buildTemplateUrl(name, bust) {
      var base = getTemplateBase();
      var url = name ? base + encodeURIComponent(name) : base;
      if (bust) {
        url += (url.indexOf('?') === -1 ? '?' : '&') + 't=' + now();
      }
      return url;
    }

    function render(list, isLoading, errorText) {
      if (!menu) return;
      var localNames = Object.keys(localHandles || {});
      if (isLoading) {
        menu.innerHTML = '<div class="template-menu-empty">正在加载模版...</div>';
        return;
      }
      if (errorText) {
        menu.innerHTML = '<div class="template-menu-empty">' + escapeHtml(errorText) + '</div>';
        return;
      }
      var parts = [];
      if (list && list.length) {
        parts.push(list.map(function(name) {
          return '<button type="button" class="template-option" data-template-name="' +
            escapeHtml(name) + '" data-template-source="remote">' + escapeHtml(name) + '</button>';
        }).join(''));
      }
      if (localNames.length) {
        parts.push(localNames.map(function(name) {
          return '<button type="button" class="template-option" data-template-name="' +
            escapeHtml(name) + '" data-template-source="local">' + escapeHtml(name) + '（本地）</button>';
        }).join(''));
      }
      if (!parts.length) {
        parts.push('<div class="template-menu-empty">未找到 .xmind 模版，请检查 caseTemplate 目录或 manifest</div>');
      }
      menu.innerHTML = parts.join('');
    }

    function close() {
      if (menu && menu.classList) menu.classList.add('hidden');
      if (dropdown && dropdown.classList) dropdown.classList.remove('open');
    }

    function applyTemplateList(list) {
      templateList = Array.isArray(list) ? list.slice() : [];
      loaded = true;
      render(templateList, false, '');
    }

    async function fetchTemplateManifest(forceRefresh) {
      if (!fetchRequest) return [];
      var candidates = ['manifest.json', 'templates.json', 'caseTemplates.json'];
      for (var i = 0; i < candidates.length; i += 1) {
        try {
          var response = await fetchRequest(buildTemplateUrl(candidates[i], forceRefresh), { cache: 'no-store' });
          if (!response || !response.ok) continue;
          var json = await response.json();
          if (!Array.isArray(json)) continue;
          var names = json.map(function(item) {
            return typeof item === 'string' ? item : '';
          }).filter(Boolean);
          if (names.length) return names;
        } catch (error) {
          // Try the next supported manifest filename.
        }
      }
      return [];
    }

    async function fetchTemplateDirectory(forceRefresh) {
      if (!fetchRequest) return [];
      try {
        var response = await fetchRequest(buildTemplateUrl('', forceRefresh), { cache: 'no-store' });
        if (!response || !response.ok) return [];
        return parseTemplateListFromHtml(await response.text(), ParserCtor);
      } catch (error) {
        if (browser && browser.console && typeof browser.console.warn === 'function') {
          browser.console.warn('读取 caseTemplate 目录失败', error);
        }
        return [];
      }
    }

    async function load(forceRefresh) {
      if (!menu || loading) return;
      loading = true;
      try {
        var manifest = await fetchTemplateManifest(forceRefresh);
        var directoryList = await fetchTemplateDirectory(forceRefresh);
        var merged = mergeTemplateSources(manifest, directoryList);
        if (!merged.length) throw new Error('未能获取目录列表');
        applyTemplateList(merged);
        if (directoryList.length && manifest.length) {
          var manifestSet = new Set(manifest.map(function(name) {
            return normalizeTemplateName(name).toLowerCase();
          }).filter(Boolean));
          var directorySet = new Set(directoryList.map(function(name) {
            return normalizeTemplateName(name).toLowerCase();
          }).filter(Boolean));
          var inconsistent = manifestSet.size !== directorySet.size || Array.from(directorySet).some(function(name) {
            return !manifestSet.has(name);
          });
          if (inconsistent && statusElement) {
            setStatus(statusElement, '已按目录刷新模版列表，manifest 已与目录对齐', 'ok');
          }
        }
      } catch (error) {
        loaded = false;
        templateList = [];
        render([], false, '未能读取 caseTemplate 目录，请确认使用本地 HTTP 服务或补充 manifest.json');
        if (browser && browser.console && typeof browser.console.warn === 'function') {
          browser.console.warn('加载常用用例模版失败', error);
        }
      } finally {
        loading = false;
      }
    }

    function open(forceRefresh) {
      if (!dropdown || !menu) return;
      if (dropdown.classList) dropdown.classList.add('open');
      if (menu.classList) menu.classList.remove('hidden');
      if (forceRefresh) {
        loaded = false;
        render([], true, '');
      } else if (!loaded && !loading) {
        render([], true, '');
      }
      load(forceRefresh);
    }

    async function importLocal(name) {
      if (!name || !localHandles[name]) return false;
      try {
        var file = await localHandles[name].getFile();
        await api.importTempExecFiles([file]);
        return true;
      } catch (error) {
        if (statusElement) {
          setStatus(statusElement, '导入本地模版失败：' + (error && error.message ? error.message : '未知错误'), 'err');
        }
        if (browser && browser.console && typeof browser.console.warn === 'function') {
          browser.console.warn('导入本地模版失败', error);
        }
        return false;
      }
    }

    async function pickLocalFolder() {
      if (!browser || typeof browser.showDirectoryPicker !== 'function') {
        if (statusElement) {
          setStatus(statusElement, '当前浏览器不支持本地文件夹选择，请使用支持 File System Access 的浏览器', 'warn');
        }
        return false;
      }
      try {
        var directory = await browser.showDirectoryPicker();
        var nextHandles = {};
        for await (var entry of directory.values()) {
          if (!entry || entry.kind !== 'file' || !entry.name) continue;
          if (entry.name.toLowerCase().indexOf('.xmind') !== entry.name.length - 6) continue;
          var baseName = normalizeTemplateName(entry.name);
          if (baseName) nextHandles[baseName] = entry;
        }
        localHandles = nextHandles;
        if (!Object.keys(localHandles).length) {
          if (statusElement) setStatus(statusElement, '选择的文件夹中未找到 .xmind 文件', 'warn');
          return false;
        }
        render(templateList, false, '');
        if (statusElement) setStatus(statusElement, '已加载本地模版目录', 'ok');
        return true;
      } catch (error) {
        if (error && (error.name === 'AbortError' || error.code === 20)) return false;
        if (browser && browser.console && typeof browser.console.warn === 'function') {
          browser.console.warn('选择本地模版文件夹失败', error);
        }
        if (statusElement) {
          setStatus(statusElement, '选择本地模版文件夹失败：' +
            (error && error.message ? error.message : '未知错误'), 'err');
        }
        return false;
      }
    }

    async function importRemote(name) {
      if (!name || typeof api.importTempExecFiles !== 'function') return false;
      var fileName = name + '.xmind';
      if (statusElement) setStatus(statusElement, '正在获取模版【' + name + '】...', '');
      try {
        if (!fetchRequest) throw new Error('Fetch API unavailable');
        var response = await fetchRequest(buildTemplateUrl(fileName, true), { cache: 'no-store' });
        if (!response || !response.ok) throw new Error('HTTP ' + (response ? response.status : 0));
        var blob = await response.blob();
        var mime = blob && blob.type ? blob.type : 'application/octet-stream';
        var file;
        if (typeof FileCtor === 'function') {
          file = new FileCtor([blob], fileName, { type: mime });
        } else {
          file = blob.slice(0, blob.size, mime);
          file.name = fileName;
        }
        await api.importTempExecFiles([file]);
        return true;
      } catch (error) {
        if (browser && browser.console && typeof browser.console.warn === 'function') {
          browser.console.warn('导入模版失败', error);
        }
        var reason = error && error.message ? error.message : '未知错误';
        if (localHandles && localHandles[name]) {
          if (statusElement) setStatus(statusElement, '在线读取失败，尝试使用本地模版...', 'warn');
          return importLocal(name);
        }
        if (browser && typeof browser.showDirectoryPicker === 'function') {
          if (statusElement) {
            setStatus(statusElement, '导入模版失败：' + reason + '，可点击下拉菜单选择本地 caseTemplate 文件夹', 'warn');
          }
        } else if (statusElement) {
          setStatus(statusElement, '导入模版失败：' + reason +
            '，请确认已通过本地 HTTP 服务访问且文件存在于 caseTemplate/ 下', 'err');
        }
        return false;
      }
    }

    function init() {
      if (bound || !dropdown || !toggle || !menu || toggle.disabled) return false;
      bound = true;
      toggle.addEventListener('click', function() {
        if (dropdown.classList && dropdown.classList.contains('open')) close();
        else open(true);
      });
      menu.addEventListener('click', function(event) {
        var target = event && event.target ? event.target : null;
        var templateButton = target && typeof target.closest === 'function'
          ? target.closest('[data-template-name]')
          : null;
        if (templateButton) {
          var name = templateButton.dataset ? templateButton.dataset.templateName || '' : '';
          var source = templateButton.dataset ? templateButton.dataset.templateSource || 'remote' : 'remote';
          close();
          if (source === 'local') importLocal(name);
          else importRemote(name);
          return;
        }
        var folderButton = target && typeof target.closest === 'function'
          ? target.closest('[data-template-folder]')
          : null;
        if (folderButton) pickLocalFolder();
      });
      document.addEventListener('click', function(event) {
        if (!dropdown || dropdown.contains(event.target)) return;
        close();
      });
      return true;
    }

    return {
      init: init,
      open: open,
      close: close,
      load: load,
      importLocal: importLocal,
      importRemote: importRemote,
      pickLocalFolder: pickLocalFolder,
      buildTemplateUrl: buildTemplateUrl,
      getSnapshot: function() {
        return {
          loaded: loaded,
          loading: loading,
          templateList: templateList.slice(),
          localTemplateNames: Object.keys(localHandles),
          bound: bound,
        };
      },
    };
  }

  return {
    create: create,
    normalizeTemplateName: normalizeTemplateName,
    parseTemplateListFromHtml: parseTemplateListFromHtml,
    dedupeAndSort: dedupeAndSort,
    mergeTemplateSources: mergeTemplateSources,
  };
});
