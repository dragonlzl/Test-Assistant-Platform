(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecDbImportWorkflowOwner = api;
  }
})(function() {
  function stripFileExt(name) {
    var raw = String(name || '');
    var base = raw.split(/[\\/]/).pop() || raw;
    var cleaned = base.replace(/\.[^.]+$/, '');
    return cleaned || base || '';
  }

  function buildNameList(names, maxCount) {
    var list = Array.isArray(names) ? names.filter(Boolean) : [];
    var max = Number.isFinite(Number(maxCount)) ? Number(maxCount) : 8;
    if (!list.length) return '';
    var head = list.slice(0, max).join('、');
    return list.length > max ? (head + '...（共 ' + list.length + ' 份）') : head;
  }

  function buildFinalImportMessage(importedNames, overwrittenNames, skippedItems, failedItems) {
    var imported = Array.isArray(importedNames) ? importedNames : [];
    var overwritten = Array.isArray(overwrittenNames) ? overwrittenNames : [];
    var skipped = Array.isArray(skippedItems) ? skippedItems : [];
    var failed = Array.isArray(failedItems) ? failedItems : [];
    var lines = [];
    lines.push('入库完成：成功 ' + (imported.length + overwritten.length) + '，跳过 ' + skipped.length + '，失败 ' + failed.length);
    if (imported.length) lines.push('入库成功：' + buildNameList(imported, 10));
    if (overwritten.length) lines.push('覆盖导入成功：' + buildNameList(overwritten, 10));
    if (skipped.length) {
      skipped.slice(0, 10).forEach(function(item) {
        var name = item && item.name ? String(item.name) : '用例';
        var reason = item && item.reason ? String(item.reason) : '已跳过';
        lines.push('跳过 - ' + name + '：' + reason);
      });
      if (skipped.length > 10) lines.push('跳过 - 还有 ' + (skipped.length - 10) + ' 份未展开');
    }
    if (failed.length) {
      failed.slice(0, 10).forEach(function(item) {
        var name = item && item.name ? String(item.name) : '用例';
        var reason = item && item.reason ? String(item.reason) : '失败';
        lines.push('失败 - ' + name + '：' + reason);
      });
      if (failed.length > 10) lines.push('失败 - 还有 ' + (failed.length - 10) + ' 份未展开');
    }
    return lines.join('\n');
  }

  function selectRemainingFiles(originalFiles, failed, duplicates) {
    var keep = Object.create(null);
    (Array.isArray(failed) ? failed : []).forEach(function(item) {
      if (item && item.file) keep[String(item.file)] = true;
    });
    (Array.isArray(duplicates) ? duplicates : []).forEach(function(task) {
      var duplicate = task && task.duplicate ? task.duplicate : null;
      if (duplicate && duplicate.file_name) keep[String(duplicate.file_name)] = true;
    });
    return (Array.isArray(originalFiles) ? originalFiles : []).filter(function(file) {
      return Boolean(file && file.name && keep[String(file.name)]);
    });
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var browser = opts.window || (typeof window !== 'undefined' ? window : {});
    var appState = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var apiClient = opts.apiClient || null;
    var utils = opts.utils && typeof opts.utils === 'object' ? opts.utils : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var importDrawer = opts.importDrawer || null;
    var mainStatus = opts.mainStatus || null;
    var diffStatus = opts.diffStatus || null;
    var storage = opts.storage || (browser && browser.localStorage ? browser.localStorage : null);
    var persistKey = opts.persistKey || 'tap-tempexec-import-drawer';
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var escapeHtml = typeof opts.escapeHtml === 'function' ? opts.escapeHtml : function(value) { return String(value || ''); };
    var getDiffState = typeof opts.getDiffState === 'function' ? opts.getDiffState : function() { return {}; };
    var openDiffLoading = typeof opts.openDiffLoading === 'function' ? opts.openDiffLoading : function() {};
    var openDiff = typeof opts.openDiff === 'function' ? opts.openDiff : function() {};
    var confirmOverwrite = typeof opts.confirmOverwrite === 'function' ? opts.confirmOverwrite : function() {};
    var detectExecCasesHasResult = typeof opts.detectExecCasesHasResult === 'function'
      ? opts.detectExecCasesHasResult
      : function() { return false; };
    var importState = {
      pendingFiles: [],
      projectId: '',
      versionId: '',
      versionsByProject: {},
      loading: false,
      projectsLoaded: false,
    };
    var eventsBound = false;

    function currentUserId() {
      var globalState = browser.app && browser.app.state ? browser.app.state : null;
      var user = globalState && globalState.currentUser ? globalState.currentUser : null;
      var id = user && user.id !== undefined && user.id !== null ? user.id : '';
      if (id === 0 || String(id) === '0') return '';
      return id ? String(id) : '';
    }

    function readPersistedState() {
      if (!storage || typeof storage.getItem !== 'function') return null;
      try {
        var raw = storage.getItem(persistKey);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (error) {
        return null;
      }
    }

    function persistSelection(projectId, versionId) {
      if (!storage || typeof storage.setItem !== 'function') return;
      try {
        storage.setItem(persistKey, JSON.stringify({
          user_id: currentUserId(),
          project_id: projectId ? String(projectId) : '',
          version_id: versionId ? String(versionId) : '',
          saved_at: Date.now(),
        }));
      } catch (error) {
        // ignore storage errors
      }
    }

    function isDbImportEnabled() {
      var globalState = browser.app && browser.app.state ? browser.app.state : null;
      var user = globalState && globalState.currentUser ? globalState.currentUser : null;
      var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
      if (!userId || String(userId) === '0') return false;
      if (!browser.app || browser.app.authReady !== true) return false;
      if (!apiClient) return false;
      if (typeof apiClient.listProjects !== 'function' || typeof apiClient.listProjectVersions !== 'function') return false;
      return typeof api.importTempExecFilesToDb === 'function';
    }

    function applyPersistedSelection(projects) {
      if (!isDbImportEnabled() || importState.projectId) return false;
      var persisted = readPersistedState();
      if (!persisted) return false;
      var userId = currentUserId();
      if (persisted.user_id && userId && String(persisted.user_id) !== String(userId)) return false;
      var projectId = persisted.project_id ? String(persisted.project_id) : '';
      if (!projectId) return false;
      var exists = (Array.isArray(projects) ? projects : []).some(function(project) {
        return project && String(project.id) === projectId;
      });
      if (!exists) return false;
      importState.projectId = projectId;
      importState.versionId = persisted.version_id ? String(persisted.version_id) : '';
      return true;
    }

    function sortProjects(projects) {
      var list = Array.isArray(projects) ? projects : [];
      return typeof utils.sortProjectsByUserSettings === 'function'
        ? utils.sortProjectsByUserSettings(list, appState)
        : list;
    }

    function renderFileHint() {
      if (!dom.fileHint) return;
      var files = Array.isArray(importState.pendingFiles) ? importState.pendingFiles : [];
      if (!files.length) {
        dom.fileHint.textContent = '未选择文件';
        return;
      }
      var names = files.map(function(file) { return file && file.name ? file.name : ''; }).filter(Boolean);
      dom.fileHint.textContent = '已选择 ' + names.length + ' 份文件：' + names.slice(0, 3).join('、') + (names.length > 3 ? ' 等' : '');
    }

    function syncConfirmState() {
      if (dom.projectSelect) dom.projectSelect.disabled = Boolean(importState.loading);
      if (dom.versionSelect) dom.versionSelect.disabled = Boolean(importState.loading) || !importState.projectId;
      if (dom.confirmButton) {
        dom.confirmButton.disabled = !Boolean(
          !importState.loading &&
          importState.projectId &&
          importState.versionId &&
          importState.pendingFiles.length
        );
      }
    }

    function renderProjectOptions(projects) {
      if (!dom.projectSelect) return;
      var html = ['<option value="">请选择项目</option>'];
      sortProjects(projects).forEach(function(project) {
        if (!project || project.id === null || project.id === undefined) return;
        var name = project.name || ('项目#' + project.id);
        html.push('<option value="' + escapeHtml(project.id) + '">' + escapeHtml(name) + '</option>');
      });
      dom.projectSelect.innerHTML = html.join('');
      dom.projectSelect.value = importState.projectId || '';
    }

    function renderVersionOptions(projectId, versions) {
      if (!dom.versionSelect) return;
      var html = ['<option value="">请选择版本</option>'];
      (Array.isArray(versions) ? versions : []).forEach(function(version) {
        if (!version || version.id === null || version.id === undefined) return;
        var name = version.name || ('版本#' + version.id);
        html.push('<option value="' + escapeHtml(version.id) + '">' + escapeHtml(name) + '</option>');
      });
      html.push(typeof utils.buildAddVersionOption === 'function'
        ? utils.buildAddVersionOption('＋ 新增版本')
        : '<option value="__add_version__">＋ 新增版本</option>');
      dom.versionSelect.innerHTML = html.join('');
      dom.versionSelect.value = importState.versionId || '';
      dom.versionSelect.disabled = Boolean(importState.loading) || !projectId;
    }

    function validateRestoredVersion(projectId, versions) {
      if (!importState.versionId) return;
      var exists = (Array.isArray(versions) ? versions : []).some(function(version) {
        return version && String(version.id) === String(importState.versionId);
      });
      if (!exists) importState.versionId = '';
    }

    function loadVersions(projectId) {
      if (!projectId || !apiClient || typeof apiClient.listProjectVersions !== 'function') return Promise.resolve([]);
      if (importState.versionsByProject[projectId]) return Promise.resolve(importState.versionsByProject[projectId]);
      return apiClient.listProjectVersions(projectId).then(function(versions) {
        importState.versionsByProject[projectId] = Array.isArray(versions) ? versions : [];
        return importState.versionsByProject[projectId];
      });
    }

    function ensureProjects() {
      if (!isDbImportEnabled() || importState.projectsLoaded || !apiClient || typeof apiClient.listProjects !== 'function') {
        return Promise.resolve([]);
      }
      importState.projectsLoaded = true;
      setStatus(mainStatus, '加载项目列表中...', '');
      return apiClient.listProjects().then(function(projects) {
        var list = sortProjects(projects);
        applyPersistedSelection(list);
        renderProjectOptions(list);
        setStatus(mainStatus, '', '');
        if (!importState.projectId) {
          syncConfirmState();
          return list;
        }
        return loadVersions(importState.projectId).then(function(versions) {
          validateRestoredVersion(importState.projectId, versions);
          renderVersionOptions(importState.projectId, versions);
          syncConfirmState();
          return list;
        }).catch(function() {
          importState.versionId = '';
          renderVersionOptions(importState.projectId, []);
          syncConfirmState();
          return list;
        });
      }).catch(function(error) {
        importState.projectsLoaded = false;
        setStatus(mainStatus, error && error.message ? error.message : '加载项目失败', 'err');
        return [];
      });
    }

    function invalidateProjectsCache() {
      importState.projectsLoaded = false;
      importState.versionsByProject = {};
      importState.projectId = '';
      importState.versionId = '';
      if (dom.projectSelect) {
        dom.projectSelect.innerHTML = '<option value="">请选择项目</option>';
        dom.projectSelect.value = '';
      }
      if (dom.versionSelect) {
        dom.versionSelect.disabled = true;
        dom.versionSelect.innerHTML = '<option value="">请选择版本</option>';
        dom.versionSelect.value = '';
      }
      syncConfirmState();
    }

    function handleProjectChange() {
      if (!isDbImportEnabled()) return Promise.resolve([]);
      importState.projectId = dom.projectSelect ? String(dom.projectSelect.value || '') : '';
      importState.versionId = '';
      persistSelection(importState.projectId, '');
      if (dom.versionSelect) {
        dom.versionSelect.disabled = true;
        dom.versionSelect.innerHTML = '<option value="">请选择版本</option>';
        dom.versionSelect.value = '';
      }
      syncConfirmState();
      if (!importState.projectId) return Promise.resolve([]);
      setStatus(mainStatus, '加载版本中...', '');
      return loadVersions(importState.projectId).then(function(versions) {
        renderVersionOptions(importState.projectId, versions);
        setStatus(mainStatus, '', '');
        syncConfirmState();
        return versions;
      }).catch(function(error) {
        setStatus(mainStatus, error && error.message ? error.message : '加载版本失败', 'err');
        syncConfirmState();
        return [];
      });
    }

    function getSelectedOptionText(select) {
      try {
        var option = select && select.options ? select.options[select.selectedIndex] : null;
        return option ? String(option.textContent || option.text || '').trim() : '';
      } catch (error) {
        return '';
      }
    }

    function handleVersionChange() {
      if (!isDbImportEnabled()) return Promise.resolve(null);
      var raw = dom.versionSelect ? String(dom.versionSelect.value || '') : '';
      if (typeof utils.isAddVersionOption === 'function' && utils.isAddVersionOption(raw)) {
        var projectId = importState.projectId;
        if (!projectId) {
          setStatus(mainStatus, '请先选择项目', 'warn');
          if (dom.versionSelect) dom.versionSelect.value = importState.versionId || '';
          return Promise.resolve(null);
        }
        if (typeof utils.openAddProjectVersionDrawer !== 'function') {
          setStatus(mainStatus, '新增版本组件未就绪，请刷新后重试', 'err');
          if (dom.versionSelect) dom.versionSelect.value = importState.versionId || '';
          return Promise.resolve(null);
        }
        if (dom.versionSelect) {
          dom.versionSelect.value = importState.versionId || '';
          dom.versionSelect.disabled = true;
        }
        if (dom.confirmButton) dom.confirmButton.disabled = true;
        return utils.openAddProjectVersionDrawer({
          projectId: projectId,
          projectName: getSelectedOptionText(dom.projectSelect) || ('项目#' + projectId),
          previousDrawer: importDrawer || null,
        }).then(function(result) {
          if (!result || result.ok !== true || !result.version) return null;
          var versions = importState.versionsByProject[projectId];
          if (!Array.isArray(versions)) versions = [];
          var exists = versions.some(function(version) { return version && String(version.id) === String(result.version.id); });
          if (!exists) versions.unshift(result.version);
          importState.versionsByProject[projectId] = versions;
          importState.versionId = String(result.version.id);
          renderVersionOptions(projectId, versions);
          if (dom.versionSelect) dom.versionSelect.value = importState.versionId;
          persistSelection(importState.projectId, importState.versionId);
          return result.version;
        }).finally(function() {
          if (dom.versionSelect) dom.versionSelect.disabled = Boolean(importState.loading) || !importState.projectId;
          syncConfirmState();
        });
      }
      importState.versionId = raw;
      persistSelection(importState.projectId, importState.versionId);
      syncConfirmState();
      return Promise.resolve(raw);
    }

    function resolveDiffState() {
      var state = getDiffState();
      return state && typeof state === 'object' ? state : {};
    }

    function openDiffForQueueTask(task) {
      if (!task || !task.duplicate) return Promise.resolve({ ok: false, reason: 'invalid_task' });
      if (!apiClient || typeof apiClient.listCaseItems !== 'function') return Promise.resolve({ ok: false, reason: 'api_not_ready' });
      var duplicate = task.duplicate;
      var payload = task.payload || null;
      var projectId = duplicate.project_id || importState.projectId;
      var versionId = duplicate.version_id || importState.versionId;
      var fileName = duplicate.file_name || '';
      var cleanName = duplicate.clean_name || stripFileExt(fileName) || '';
      var matchedCleanName = payload && payload.existing_file_name_clean ? String(payload.existing_file_name_clean) : '';
      var dbVersionId = payload && (payload.existing_version_id || payload.existing_version_id === 0)
        ? payload.existing_version_id
        : null;
      var existingId = payload && payload.existing_case_file_id ? payload.existing_case_file_id : null;
      var execVersionId = Object.prototype.hasOwnProperty.call(importState, 'execVersionId') ? importState.execVersionId : null;
      if (execVersionId === undefined) execVersionId = null;
      var diffState = resolveDiffState();

      function matchesExecVersion(serverValue) {
        if (execVersionId === null || execVersionId === undefined || String(execVersionId) === '') {
          return serverValue === null || serverValue === undefined || String(serverValue) === '';
        }
        return String(serverValue) === String(execVersionId);
      }

      function fail(reason, message) {
        var text = message || '打开差异对比失败';
        if (diffStatus) setStatus(diffStatus, text, 'err');
        setStatus(mainStatus, text, 'err');
        var external = diffState.external || null;
        if (external && typeof external.resolve === 'function') {
          diffState.external = null;
          try { external.resolve({ ok: false, reason: reason || 'load_failed' }); } catch (error) {}
        }
        try {
          if (opts.diffDrawer && typeof opts.diffDrawer.close === 'function') opts.diffDrawer.close();
        } catch (error2) {
          // ignore drawer close errors
        }
      }

      function ensureExistingId() {
        if (existingId) return Promise.resolve(existingId);
        if (!apiClient || typeof apiClient.listCaseFiles !== 'function') return Promise.resolve(null);
        return apiClient.listCaseFiles(projectId).then(function(files) {
          var targetName = matchedCleanName || cleanName;
          var matched = (Array.isArray(files) ? files : []).find(function(caseFile) {
            return caseFile && caseFile.id && String(caseFile.file_name_clean || '') === String(targetName || '');
          });
          if (!matched && cleanName) {
            matched = (Array.isArray(files) ? files : []).find(function(caseFile) {
              return caseFile && caseFile.id && String(caseFile.file_name_clean || '') === String(cleanName);
            });
          }
          if (matched && matched.id) {
            existingId = matched.id;
            if (!dbVersionId) dbVersionId = matched.version_id || null;
            if (!matchedCleanName && matched.file_name_clean) matchedCleanName = matched.file_name_clean;
          }
          return existingId || null;
        }).catch(function() { return null; });
      }

      diffState.execVersionId = execVersionId;
      openDiffLoading({
        fileName: fileName,
        cleanName: matchedCleanName || cleanName || '',
        projectId: projectId,
        importVersionId: versionId,
        dbVersionId: dbVersionId,
        ext: duplicate.ext || '',
        source: duplicate.source || '',
        importItems: Array.isArray(duplicate.items) ? duplicate.items : [],
        importExecCases: Array.isArray(duplicate.exec_cases) ? duplicate.exec_cases : [],
        importHasResult: duplicate.has_result === true,
        importReuseEnabled: duplicate.reuse_enabled === true,
        requirement: duplicate.requirement || '',
        dbCaseFileId: existingId,
      });

      return new Promise(function(resolve) {
        diffState.external = { resolve: resolve };
        ensureExistingId().then(function(id) {
          if (!id) throw new Error('未找到库中同名用例 ID：' + (matchedCleanName || cleanName || '用例'));
          diffState.dbCaseFileId = id;
          if (typeof apiClient.listExecSets !== 'function') {
            return apiClient.listCaseItems(id).then(function(dbItems) {
              openDiff({
                dbItems: Array.isArray(dbItems) ? dbItems : [],
                dbExecSetId: null,
                dbExecCases: [],
                dbReuseEnabled: false,
                dbHasResult: false,
                importHasResult: duplicate.has_result === true,
              });
            });
          }
          return Promise.all([apiClient.listCaseItems(id), apiClient.listExecSets(projectId)]).then(function(result) {
            var dbItems = Array.isArray(result[0]) ? result[0] : [];
            var execSets = Array.isArray(result[1]) ? result[1] : [];
            var matchedSet = execSets.filter(function(execSet) {
              return execSet &&
                Number(execSet.case_file_id) === Number(id) &&
                String(execSet.status || '') === 'active' &&
                matchesExecVersion(execSet.version_id);
            }).sort(function(left, right) {
              return Number(right.id || 0) - Number(left.id || 0);
            })[0] || null;
            var reuseEnabled = Boolean(matchedSet && matchedSet.reuse_enabled);
            if (!matchedSet || !matchedSet.id || typeof apiClient.listExecCases !== 'function') {
              openDiff({
                dbItems: dbItems,
                dbExecSetId: null,
                dbExecCases: [],
                dbReuseEnabled: reuseEnabled,
                dbHasResult: false,
                importHasResult: duplicate.has_result === true,
              });
              return null;
            }
            return apiClient.listExecCases(matchedSet.id).then(function(execCases) {
              var list = Array.isArray(execCases) ? execCases : [];
              openDiff({
                dbItems: dbItems,
                dbExecSetId: matchedSet.id,
                dbExecCases: list,
                dbReuseEnabled: reuseEnabled,
                dbHasResult: detectExecCasesHasResult(list, reuseEnabled),
                importHasResult: duplicate.has_result === true,
              });
            }).catch(function() {
              openDiff({
                dbItems: dbItems,
                dbExecSetId: matchedSet.id,
                dbExecCases: [],
                dbReuseEnabled: reuseEnabled,
                dbHasResult: false,
                importHasResult: duplicate.has_result === true,
              });
            });
          });
        }).catch(function(error) {
          fail('load_failed', error && error.message ? error.message : '打开差异对比失败');
        });
      });
    }

    function resolveProjectName(projectId) {
      try {
        var projects = browser.app && browser.app.state && Array.isArray(browser.app.state.projects)
          ? browser.app.state.projects
          : [];
        var project = projects.find(function(item) { return item && String(item.id) === String(projectId); });
        return project && project.name ? String(project.name) : '';
      } catch (error) {
        return '';
      }
    }

    function resolveImportVersionName(projectId, versionId) {
      var selected = getSelectedOptionText(dom.versionSelect);
      if (selected) return selected;
      try {
        var versions = importState.versionsByProject[String(projectId)];
        var version = Array.isArray(versions) ? versions.find(function(item) {
          return item && String(item.id) === String(versionId);
        }) : null;
        return version && version.name ? String(version.name) : '';
      } catch (error) {
        return '';
      }
    }

    function processDuplicateQueue(duplicates, overwrittenNames, skippedItems, failedItems) {
      if (!duplicates.length) return Promise.resolve();
      setStatus(mainStatus, '检测到同名用例冲突 ' + duplicates.length + ' 份，请依次确认覆盖导入或关闭跳过', 'warn');
      var diffState = resolveDiffState();
      diffState.queue = { active: true, total: duplicates.length, index: -1 };
      var chain = Promise.resolve();
      duplicates.forEach(function(task, index) {
        chain = chain.then(function() {
          if (!task) return null;
          if (diffState.queue && diffState.queue.active) diffState.queue.index = index;
          var duplicate = task.duplicate || {};
          var name = duplicate.clean_name || stripFileExt(duplicate.file_name) || '用例';
          var fileName = duplicate.file_name ? String(duplicate.file_name) : '';
          setStatus(mainStatus, '同名用例已存在，处理差异对比（' + (index + 1) + '/' + duplicates.length + '）：' + name, 'warn');
          return openDiffForQueueTask(task).then(function(result) {
            if (result && result.ok) overwrittenNames.push(name);
            else if (result && result.reason === 'closed') skippedItems.push({ name: name, fileName: fileName, reason: '同名冲突已跳过' });
            else failedItems.push({
              name: name,
              fileName: fileName,
              reason: result && result.reason ? String(result.reason) : '同名冲突处理失败',
            });
          });
        });
      });
      return chain.finally(function() {
        if (diffState.queue && diffState.queue.active) {
          diffState.queue.active = false;
          diffState.queue.index = -1;
        }
      });
    }

    function submitImport(execVersionId) {
      importState.execVersionId = execVersionId;
      importState.loading = true;
      syncConfirmState();
      var originalFiles = Array.prototype.slice.call(importState.pendingFiles || []).filter(Boolean);
      var importedNames = [];
      var overwrittenNames = [];
      var skippedItems = [];
      var failedItems = [];
      return api.importTempExecFilesToDb(
        importState.pendingFiles,
        importState.projectId,
        importState.versionId,
        execVersionId
      ).then(function(result) {
        var response = result && typeof result === 'object' ? result : {};
        var failed = Array.isArray(response.failed) ? response.failed : [];
        var duplicates = Array.isArray(response.duplicates) ? response.duplicates : [];
        (Array.isArray(response.imported_names) ? response.imported_names : []).forEach(function(name) {
          if (name) importedNames.push(String(name));
        });
        failed.forEach(function(item) {
          if (!item || !item.file) return;
          failedItems.push({
            name: stripFileExt(item.file),
            fileName: String(item.file),
            reason: item.reason || item.message || '入库失败',
          });
        });
        importState.pendingFiles = failed.length || duplicates.length
          ? selectRemainingFiles(originalFiles, failed, duplicates)
          : [];
        renderFileHint();
        syncConfirmState();
        return processDuplicateQueue(duplicates, overwrittenNames, skippedItems, failedItems);
      }).then(function() {
        var message = buildFinalImportMessage(importedNames, overwrittenNames, skippedItems, failedItems);
        var hasIssues = Boolean(skippedItems.length || failedItems.length);
        setStatus(mainStatus, message, hasIssues ? 'warn' : 'ok');
        if (browser.app && browser.app.utils && typeof browser.app.utils.showCenterToast === 'function') {
          browser.app.utils.showCenterToast(message, hasIssues ? 'warn' : 'ok', 10000);
        }
        if (!hasIssues && (importedNames.length || overwrittenNames.length)) {
          importState.pendingFiles = [];
        } else {
          var unresolved = skippedItems.concat(failedItems).map(function(item) {
            return { file: item && item.fileName ? item.fileName : '' };
          });
          importState.pendingFiles = selectRemainingFiles(originalFiles, unresolved, []);
        }
        renderFileHint();
        syncConfirmState();
        return {
          importedNames: importedNames,
          overwrittenNames: overwrittenNames,
          skippedItems: skippedItems,
          failedItems: failedItems,
        };
      }).catch(function(error) {
        setStatus(mainStatus, error && error.message ? error.message : '入库失败', 'err');
        return null;
      }).finally(function() {
        importState.loading = false;
        syncConfirmState();
      });
    }

    function handleConfirm() {
      if (!isDbImportEnabled() || importState.loading) return Promise.resolve(null);
      if (!importState.pendingFiles.length) {
        setStatus(mainStatus, '请先选择用例文件', 'warn');
        return Promise.resolve(null);
      }
      if (!importState.projectId) {
        setStatus(mainStatus, '请先选择项目', 'warn');
        return Promise.resolve(null);
      }
      if (!importState.versionId) {
        setStatus(mainStatus, '请先选择版本', 'warn');
        return Promise.resolve(null);
      }
      var execVersionDrawer = browser.app && browser.app.execVersionDrawer ? browser.app.execVersionDrawer : null;
      if (!execVersionDrawer || typeof execVersionDrawer.open !== 'function') {
        setStatus(mainStatus, '执行版本选择组件未就绪，请刷新页面后重试', 'err');
        return Promise.resolve(null);
      }
      var projectId = importState.projectId;
      var versionId = importState.versionId;
      try { if (browser.app) browser.app.__drawerSkipRestoreOnce = true; } catch (error) {}
      if (importDrawer && typeof importDrawer.close === 'function') importDrawer.close();
      return execVersionDrawer.open({
        title: '选择执行版本',
        projectId: projectId,
        projectName: resolveProjectName(projectId) || ('项目#' + projectId),
        importVersionId: versionId,
        importVersionName: resolveImportVersionName(projectId, versionId),
      }).then(function(result) {
        if (importDrawer && typeof importDrawer.open === 'function') importDrawer.open();
        if (!result || result.ok !== true) {
          setStatus(mainStatus, '已取消入库', 'warn');
          return null;
        }
        var execVersionId = Object.prototype.hasOwnProperty.call(result, 'versionId')
          ? result.versionId
          : (result.exec_version_id || null);
        if (execVersionId === undefined) execVersionId = null;
        return submitImport(execVersionId);
      });
    }

    function selectFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || []).filter(Boolean);
      if (!files.length) return false;
      if (!isDbImportEnabled()) {
        if (typeof api.importTempExecFiles === 'function') api.importTempExecFiles(fileList);
        return false;
      }
      importState.pendingFiles = files;
      renderFileHint();
      syncConfirmState();
      setStatus(mainStatus, '已选择文件，请选择项目与版本后点击确认入库', 'ok');
      return true;
    }

    function clearPendingFiles() {
      importState.pendingFiles = [];
      renderFileHint();
      syncConfirmState();
    }

    function bindEvents() {
      if (eventsBound) return;
      eventsBound = true;
      if (dom.projectSelect) dom.projectSelect.addEventListener('change', handleProjectChange);
      if (dom.versionSelect) dom.versionSelect.addEventListener('change', handleVersionChange);
      if (dom.confirmButton) dom.confirmButton.addEventListener('click', handleConfirm);
      if (dom.diffOverwriteButton) dom.diffOverwriteButton.addEventListener('click', confirmOverwrite);
      if (dom.fileInput && dom.dropZone && typeof api.importTempExecFiles === 'function') {
        dom.fileInput.addEventListener('change', function(event) {
          var files = event.target.files;
          if (files && files.length) selectFiles(files);
          event.target.value = '';
        });
        dom.dropZone.addEventListener('dragover', function(event) {
          event.preventDefault();
          dom.dropZone.classList.add('dragover');
        });
        dom.dropZone.addEventListener('dragleave', function() { dom.dropZone.classList.remove('dragover'); });
        dom.dropZone.addEventListener('drop', function(event) {
          event.preventDefault();
          dom.dropZone.classList.remove('dragover');
          var files = event.dataTransfer ? event.dataTransfer.files : null;
          if (files && files.length) selectFiles(files);
        });
      }
    }

    function init() {
      bindEvents();
      renderFileHint();
      syncConfirmState();
      return ensureProjects();
    }

    return {
      getState: function() { return importState; },
      isDbImportEnabled: isDbImportEnabled,
      ensureProjects: ensureProjects,
      invalidateProjectsCache: invalidateProjectsCache,
      handleProjectChange: handleProjectChange,
      handleVersionChange: handleVersionChange,
      handleConfirm: handleConfirm,
      openDiffForQueueTask: openDiffForQueueTask,
      selectFiles: selectFiles,
      clearPendingFiles: clearPendingFiles,
      renderFileHint: renderFileHint,
      syncConfirmState: syncConfirmState,
      bindEvents: bindEvents,
      init: init,
    };
  }

  return {
    create: create,
    stripFileExt: stripFileExt,
    buildNameList: buildNameList,
    buildFinalImportMessage: buildFinalImportMessage,
    selectRemainingFiles: selectRemainingFiles,
  };
});
