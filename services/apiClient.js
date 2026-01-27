(function() {
  var tokenKey = 'tap-auth-token';
  var loginSeqKey = 'tap-login-seq';
  var authToken = '';
  var pendingRequests = {};

  function singleFlight(key, runner) {
    if (pendingRequests[key]) return pendingRequests[key];
    var promise = null;
    try {
      promise = Promise.resolve(runner());
    } catch (err) {
      return Promise.reject(err);
    }
    pendingRequests[key] = promise;
    promise.finally(function() {
      if (pendingRequests[key] === promise) delete pendingRequests[key];
    });
    return promise;
  }

  function generateLoginSeq() {
    // ES2019 兼容：用时间戳 + 随机数即可区分每次登录会话。
    var rand = Math.random().toString(16).slice(2);
    return String(Date.now()) + '-' + rand;
  }

  function setToken(token) {
    authToken = token || '';
    if (typeof localStorage !== 'undefined') {
      try {
        if (authToken) {
          var prevToken = '';
          try {
            prevToken = localStorage.getItem(tokenKey) || '';
          } catch (e) {
            prevToken = '';
          }
          localStorage.setItem(tokenKey, authToken);
          // 仅当 token 发生变化（通常是重新登录）才生成新的 loginSeq。
          if (prevToken !== authToken) {
            localStorage.setItem(loginSeqKey, generateLoginSeq());
          }
        } else {
          localStorage.removeItem(tokenKey);
          localStorage.removeItem(loginSeqKey);
        }
      } catch (err) {
        // ignore
      }
    }
  }

  function getStoredToken() {
    if (typeof localStorage === 'undefined') return '';
    try {
      return localStorage.getItem(tokenKey) || '';
    } catch (err) {
      return '';
    }
  }

  function clearToken() {
    setToken('');
    // 顺带清理与页签恢复相关的 session 标记，避免残留影响“重新登录回主页”。
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('tap-active-tab-login-seq');
        sessionStorage.removeItem('usecase-active-tab');
        sessionStorage.removeItem('tap-force-default-tab');
      }
    } catch (err) {
      // ignore
    }
  }

  function buildHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers.Authorization = 'Bearer ' + authToken;
    }
    try {
      var page = '';
      if (typeof window !== 'undefined') {
        if (window.app && window.app.state && window.app.state.activeTab) {
          page = String(window.app.state.activeTab || '');
        } else {
          var path = window.location && window.location.pathname ? String(window.location.pathname) : '';
          if (path && path.indexOf('login.html') !== -1) page = 'login';
        }
      }
      if (page) headers['X-TAP-Page'] = page;
    } catch (err) {
      // ignore
    }
    return headers;
  }

  function buildHeadersWithOptions(options) {
    var headers = buildHeaders();
    var opts = options && typeof options === 'object' ? options : {};
    if (opts.batch === true) {
      headers['X-TAP-Batch'] = '1';
    }
    return headers;
  }

  function translateDetail(detail, status) {
    if (!detail) return '请求失败，状态码 ' + status;
    if (typeof detail === 'string') return detail;
    if (detail.detail) return translateDetail(detail.detail, status);
    return '请求失败，状态码 ' + status;
  }

  function handleResponse(res) {
    var status = res.status;
    return res.json().catch(function() { return {}; }).then(function(body) {
      if (res.ok) return body;
      var detail = translateDetail(body && body.detail ? body.detail : body, status);
      var error = new Error(detail);
      error.status = status;
      error.payload = body;
      throw error;
    });
  }

  function login(username, password) {
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ username: username, password: password }),
    }).then(function(res) { return handleResponse(res); }).then(function(data) {
      if (data && data.access_token) {
        setToken(data.access_token);
      }
      return data;
    });
  }

  function logout() {
    return fetch('/api/auth/logout', {
      method: 'POST',
      headers: buildHeaders(),
    }).then(function(res) { return handleResponse(res); }).catch(function(err) {
      // logout failures不影响本地清理
      return { error: err && err.message ? err.message : 'logout failed' };
    });
  }

  function getCurrentUser() {
    return fetch('/api/users/me', {
      method: 'GET',
      headers: buildHeaders(),
    }).then(function(res) { return handleResponse(res); });
  }

  function changePassword(oldPassword, newPassword) {
    return fetch('/api/auth/password', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }).then(function(res) { return handleResponse(res); });
  }

  function listUsers() {
    return singleFlight('listUsers', function() {
      return fetch('/api/users', {
        method: 'GET',
        headers: buildHeaders(),
      }).then(handleResponse);
    });
  }

  function createUser(payload) {
    return fetch('/api/users', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    }).then(handleResponse);
  }

  function updateUser(userId, payload) {
    return fetch('/api/users/' + userId, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    }).then(handleResponse);
  }

  function deleteUser(userId, adminPassword) {
    return fetch('/api/users/' + userId + '/delete', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ admin_password: adminPassword || '' }),
    }).then(handleResponse);
  }

  function resetUserPassword(userId) {
    return fetch('/api/users/' + userId + '/reset_password', {
      method: 'POST',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function assignUserProjects(userId, projectIds) {
    return fetch('/api/users/assign-projects', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ user_id: userId, project_ids: projectIds || [] }),
    }).then(handleResponse);
  }

  function getUserProjects(userId) {
    var url = '/api/users/' + userId + '/projects';
    return singleFlight('getUserProjects:' + url, function() {
      return fetch(url, {
        method: 'GET',
        headers: buildHeaders(),
      }).then(handleResponse);
    });
  }

  function listProjects(params) {
    var query = [];
    var p = params && typeof params === 'object' ? params : null;
    if (p && p.scope) query.push('scope=' + encodeURIComponent(p.scope));
    if (p && p.include_all) query.push('include_all=1');
    var url = '/api/projects';
    if (query.length) url += '?' + query.join('&');
    return singleFlight('listProjects:' + url, function() {
      return fetch(url, {
        method: 'GET',
        headers: buildHeaders(),
      }).then(handleResponse);
    });
  }

  function createProject(payload) {
    return fetch('/api/projects', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    }).then(handleResponse);
  }

  function updateProject(id, payload) {
    return fetch('/api/projects/' + id, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    }).then(handleResponse);
  }

  function deleteProject(id) {
    return fetch('/api/projects/' + id, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function createVersion(projectId, payload) {
    return fetch('/api/projects/' + projectId + '/versions', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    }).then(handleResponse);
  }

  function listProjectVersions(projectId, params) {
    var query = [];
    var p = params && typeof params === 'object' ? params : null;
    if (p && p.scope) query.push('scope=' + encodeURIComponent(p.scope));
    if (p && p.include_all) query.push('include_all=1');
    var url = '/api/projects/' + projectId + '/versions';
    if (query.length) url += '?' + query.join('&');
    return singleFlight('listProjectVersions:' + url, function() {
      return fetch(url, {
        method: 'GET',
        headers: buildHeaders(),
      }).then(handleResponse);
    });
  }

  function listCaseFiles(projectId) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    var url = '/api/case-files';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function changeCaseFileVersion(payload) {
    return fetch('/api/case-files/change-version', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function importCaseFile(payload, options) {
    var url = '/api/case-files/import';
    if (options && options.overwrite) {
      url += '?overwrite=1';
    }
    return fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function listCaseItems(caseFileId) {
    return fetch('/api/case-files/' + caseFileId + '/items', {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function deleteCaseFile(caseFileId) {
    return fetch('/api/case-files/' + caseFileId, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function updateCaseItem(caseItemId, payload) {
    return fetch('/api/case-files/items/' + caseItemId, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function createCaseItem(caseFileId, payload, options) {
    return fetch('/api/case-files/' + caseFileId + '/items', {
      method: 'POST',
      headers: buildHeadersWithOptions(options),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function appendCaseItems(caseFileId, payload) {
    return fetch('/api/case-files/' + caseFileId + '/items/append', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function shareCaseFile(payload) {
    return fetch('/api/case-files/share', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function deleteCaseItem(caseItemId, options) {
    return fetch('/api/case-files/items/' + caseItemId, {
      method: 'DELETE',
      headers: buildHeadersWithOptions(options),
    }).then(handleResponse);
  }

  function listMissingModules(projectId, options) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    var opts = options && typeof options === 'object' ? options : {};
    var typeIds = Array.isArray(opts.type_ids) ? opts.type_ids : (Array.isArray(opts.typeIds) ? opts.typeIds : []);
    if (typeIds.length) query.push('type_ids=' + encodeURIComponent(typeIds.join(',')));
    var url = '/api/missing-modules';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function createMissingModule(payload) {
    return fetch('/api/missing-modules', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function updateMissingModule(moduleId, payload) {
    return fetch('/api/missing-modules/' + moduleId, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function deleteMissingModule(moduleId) {
    return fetch('/api/missing-modules/' + moduleId, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function listMissingModuleItems(moduleId) {
    return fetch('/api/missing-modules/' + moduleId + '/items', {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function createMissingModuleItem(moduleId, payload, options) {
    return fetch('/api/missing-modules/' + moduleId + '/items', {
      method: 'POST',
      headers: buildHeadersWithOptions(options),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function updateMissingModuleItem(itemId, payload) {
    return fetch('/api/missing-modules/items/' + itemId, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function deleteMissingModuleItem(itemId, options) {
    return fetch('/api/missing-modules/items/' + itemId, {
      method: 'DELETE',
      headers: buildHeadersWithOptions(options),
    }).then(handleResponse);
  }

  function listMissingTypes(projectId) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    var url = '/api/missing-types';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function createMissingType(payload) {
    return fetch('/api/missing-types', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function deleteMissingType(typeId, transferTo) {
    var query = [];
    if (transferTo || transferTo === 0) query.push('transfer_to=' + encodeURIComponent(transferTo));
    var url = '/api/missing-types/' + typeId;
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function listCaseLibraryChangeFiles(params) {
    var p = params && typeof params === 'object' ? params : {};
    var query = [];
    if (p && (p.project_id || p.project_id === 0)) query.push('project_id=' + encodeURIComponent(p.project_id));
    if (p && (p.version_id || p.version_id === 0)) query.push('version_id=' + encodeURIComponent(p.version_id));
    if (p && p.q) query.push('q=' + encodeURIComponent(p.q));
    if (p && (p.limit || p.limit === 0)) query.push('limit=' + encodeURIComponent(p.limit));
    var url = '/api/case-files/change-history/files';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function getCaseLibraryChangeHistory(projectId, fileNameClean, params) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    if (fileNameClean) query.push('file_name_clean=' + encodeURIComponent(fileNameClean));
    var p = params && typeof params === 'object' ? params : {};
    if (p && (p.version_id || p.version_id === 0)) query.push('version_id=' + encodeURIComponent(p.version_id));
    if (p && (p.limit || p.limit === 0)) query.push('limit=' + encodeURIComponent(p.limit));
    var url = '/api/case-files/change-history';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function listExecSets(projectId, options) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    var opts = options && typeof options === 'object' ? options : {};
    if (opts && opts.status_filter) query.push('status_filter=' + encodeURIComponent(opts.status_filter));
    if (opts && opts.all_users) query.push('all_users=1');
    var url = '/api/exec/sets';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function listExecSetsByCaseFile(projectId) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    var url = '/api/exec/sets/by-case-file';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function createExecSet(payload) {
    return fetch('/api/exec/sets', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function listExecCases(execSetId) {
    return fetch('/api/exec/sets/' + execSetId + '/cases', {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function updateExecSet(execSetId, payload) {
    return fetch('/api/exec/sets/' + execSetId, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function deleteExecSet(execSetId) {
    return fetch('/api/exec/sets/' + execSetId, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function archiveExecSet(execSetId, payload) {
    return fetch('/api/exec/sets/' + execSetId + '/archive', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function listExecArchives(params) {
    var p = params && typeof params === 'object' ? params : {};
    var query = [];
    if (p && (p.project_id || p.project_id === 0)) query.push('project_id=' + encodeURIComponent(p.project_id));
    if (p && (p.version_id || p.version_id === 0)) query.push('version_id=' + encodeURIComponent(p.version_id));
    if (p && p.q) query.push('q=' + encodeURIComponent(p.q));
    if (p && (p.limit || p.limit === 0)) query.push('limit=' + encodeURIComponent(p.limit));
    if (p && (p.offset || p.offset === 0)) query.push('offset=' + encodeURIComponent(p.offset));
    var url = '/api/exec/archives';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function getExecArchive(execSetId) {
    return fetch('/api/exec/archives/' + execSetId, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function deleteExecArchive(execSetId) {
    return fetch('/api/exec/archives/' + execSetId, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function restoreExecArchive(execSetId) {
    return fetch('/api/exec/archives/' + execSetId + '/restore', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({}),
    }).then(handleResponse);
  }

  function syncExecSetCaseLibrary(execSetId) {
    return fetch('/api/exec/sets/' + execSetId + '/case-library-sync', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({}),
    }).then(handleResponse);
  }

  function ackExecSetCaseLibraryDiff(execSetId) {
    return fetch('/api/exec/sets/' + execSetId + '/case-library-diff/ack', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({}),
    }).then(handleResponse);
  }

  function upsertExecSetFromCaseFile(payload) {
    return fetch('/api/exec/sets/from-case-file', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function createExecCase(execSetId, payload) {
    return fetch('/api/exec/sets/' + execSetId + '/cases', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function updateExecCase(caseId, payload) {
    return fetch('/api/exec/cases/' + caseId, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function deleteExecCase(caseId) {
    return fetch('/api/exec/cases/' + caseId, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function addExecCasesFromLibrary(execSetId, caseItemIds) {
    return fetch('/api/exec/sets/' + execSetId + '/cases/from-library', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ case_item_ids: caseItemIds || [] }),
    }).then(handleResponse);
  }

  function deleteVersion(projectId, versionId, transferToVersionName) {
    var url = '/api/projects/' + projectId + '/versions/' + versionId;
    var transferName = transferToVersionName ? String(transferToVersionName || '').trim() : '';
    if (transferName) {
      url += '?transfer_to=' + encodeURIComponent(transferName);
    }
    return fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function listSettings(scope, ownerId) {
    var query = [];
    if (scope) query.push('scope=' + encodeURIComponent(scope));
    if (ownerId || ownerId === 0) query.push('owner_id=' + encodeURIComponent(ownerId));
    var url = '/api/settings';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function saveSettings(scope, items) {
    return fetch('/api/settings', {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify({ scope: scope || 'user', items: items || [] }),
    }).then(handleResponse);
  }

  function listModelConfigs(scope, ownerId) {
    var query = [];
    if (scope) query.push('scope=' + encodeURIComponent(scope));
    if (ownerId || ownerId === 0) query.push('owner_id=' + encodeURIComponent(ownerId));
    var url = '/api/models';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function createModelConfig(payload) {
    return fetch('/api/models', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function updateModelConfig(configId, payload) {
    return fetch('/api/models/' + configId, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function proxyModelCall(payload) {
    return fetch('/api/models/proxy', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    });
  }

  function listFeatureAssignments(scope, ownerId) {
    var query = [];
    if (scope) query.push('scope=' + encodeURIComponent(scope));
    if (ownerId || ownerId === 0) query.push('owner_id=' + encodeURIComponent(ownerId));
    var url = '/api/features';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function createFeatureAssignment(payload) {
    return fetch('/api/features', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function updateFeatureAssignment(assignmentId, payload) {
    return fetch('/api/features/' + assignmentId, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function listOperationLogs(params) {
    var query = [];
    if (params && params.limit) query.push('limit=' + encodeURIComponent(params.limit));
    if (params && params.offset) query.push('offset=' + encodeURIComponent(params.offset));
    if (params && (params.user_id || params.user_id === 0)) {
      query.push('user_id=' + encodeURIComponent(params.user_id));
    }
    var url = '/api/ops';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function createOperationLogEvent(payload) {
    return fetch('/api/ops/event', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function getExecutionOverview(projectId, versionId) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    if (versionId || versionId === 0) query.push('version_id=' + encodeURIComponent(versionId));
    var url = '/api/exec/overview';
    if (query.length) url += '?' + query.join('&');
    return singleFlight('execOverview:' + url, function() {
      return fetch(url, {
        method: 'GET',
        headers: buildHeaders(),
      }).then(handleResponse);
    });
  }

  function getExecutionOverviewLayout(projectId, versionId, includeSets) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    if (versionId || versionId === 0) query.push('version_id=' + encodeURIComponent(versionId));
    if (includeSets === true) query.push('include_sets=1');
    if (includeSets === false) query.push('include_sets=0');
    var url = '/api/exec/overview/layout';
    if (query.length) url += '?' + query.join('&');
    return singleFlight('execOverviewLayout:' + url, function() {
      return fetch(url, {
        method: 'GET',
        headers: buildHeaders(),
      }).then(handleResponse);
    });
  }

  function listExecutionOverviewLayoutExecSets(projectId, userId, versionId) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    if (userId || userId === 0) query.push('user_id=' + encodeURIComponent(userId));
    if (versionId || versionId === 0) query.push('version_id=' + encodeURIComponent(versionId));
    var url = '/api/exec/overview/layout/exec-sets';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function listExecutionOverviewCases(params) {
    var query = [];
    if (params && (params.project_id || params.project_id === 0)) query.push('project_id=' + encodeURIComponent(params.project_id));
    if (params && (params.version_id || params.version_id === 0)) query.push('version_id=' + encodeURIComponent(params.version_id));
    if (params && (params.user_id || params.user_id === 0)) query.push('user_id=' + encodeURIComponent(params.user_id));
    if (params && (params.limit || params.limit === 0)) query.push('limit=' + encodeURIComponent(params.limit));
    if (params && (params.offset || params.offset === 0)) query.push('offset=' + encodeURIComponent(params.offset));
    var url = '/api/exec/overview/cases';
    if (query.length) url += '?' + query.join('&');
    return fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  window.app = window.app || {};
  window.app.apiClient = {
    setToken: setToken,
    clearToken: clearToken,
    getStoredToken: getStoredToken,
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    changePassword: changePassword,
    listUsers: listUsers,
    createUser: createUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    resetUserPassword: resetUserPassword,
    assignUserProjects: assignUserProjects,
    getUserProjects: getUserProjects,
    listProjects: listProjects,
    createProject: createProject,
    updateProject: updateProject,
    deleteProject: deleteProject,
    createVersion: createVersion,
    listProjectVersions: listProjectVersions,
    deleteVersion: deleteVersion,
    listCaseFiles: listCaseFiles,
    changeCaseFileVersion: changeCaseFileVersion,
    importCaseFile: importCaseFile,
    listCaseItems: listCaseItems,
    deleteCaseFile: deleteCaseFile,
    updateCaseItem: updateCaseItem,
    createCaseItem: createCaseItem,
    appendCaseItems: appendCaseItems,
    shareCaseFile: shareCaseFile,
    deleteCaseItem: deleteCaseItem,
    listMissingModules: listMissingModules,
    createMissingModule: createMissingModule,
    updateMissingModule: updateMissingModule,
    deleteMissingModule: deleteMissingModule,
    listMissingModuleItems: listMissingModuleItems,
    createMissingModuleItem: createMissingModuleItem,
    updateMissingModuleItem: updateMissingModuleItem,
    deleteMissingModuleItem: deleteMissingModuleItem,
    listMissingTypes: listMissingTypes,
    createMissingType: createMissingType,
    deleteMissingType: deleteMissingType,
    listCaseLibraryChangeFiles: listCaseLibraryChangeFiles,
    getCaseLibraryChangeHistory: getCaseLibraryChangeHistory,
    listExecSets: listExecSets,
    listExecSetsByCaseFile: listExecSetsByCaseFile,
    createExecSet: createExecSet,
    listExecCases: listExecCases,
    updateExecSet: updateExecSet,
    deleteExecSet: deleteExecSet,
    archiveExecSet: archiveExecSet,
    listExecArchives: listExecArchives,
    getExecArchive: getExecArchive,
    deleteExecArchive: deleteExecArchive,
    restoreExecArchive: restoreExecArchive,
    syncExecSetCaseLibrary: syncExecSetCaseLibrary,
    ackExecSetCaseLibraryDiff: ackExecSetCaseLibraryDiff,
    upsertExecSetFromCaseFile: upsertExecSetFromCaseFile,
    createExecCase: createExecCase,
    updateExecCase: updateExecCase,
    deleteExecCase: deleteExecCase,
    addExecCasesFromLibrary: addExecCasesFromLibrary,
    listSettings: listSettings,
    saveSettings: saveSettings,
    listModelConfigs: listModelConfigs,
    createModelConfig: createModelConfig,
    updateModelConfig: updateModelConfig,
    proxyModelCall: proxyModelCall,
    listFeatureAssignments: listFeatureAssignments,
    createFeatureAssignment: createFeatureAssignment,
    updateFeatureAssignment: updateFeatureAssignment,
    listOperationLogs: listOperationLogs,
    createOperationLogEvent: createOperationLogEvent,
    getExecutionOverview: getExecutionOverview,
    getExecutionOverviewLayout: getExecutionOverviewLayout,
    listExecutionOverviewLayoutExecSets: listExecutionOverviewLayoutExecSets,
    listExecutionOverviewCases: listExecutionOverviewCases,
  };
})();
