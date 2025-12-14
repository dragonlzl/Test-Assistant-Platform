(function() {
  var tokenKey = 'tap-auth-token';
  var loginSeqKey = 'tap-login-seq';
  var authToken = '';

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
    return fetch('/api/users', {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
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

  function deleteUser(userId) {
    return fetch('/api/users/' + userId, {
      method: 'DELETE',
      headers: buildHeaders(),
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
    return fetch('/api/users/' + userId + '/projects', {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function listProjects() {
    return fetch('/api/projects', {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
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

  function listProjectVersions(projectId) {
    return fetch('/api/projects/' + projectId + '/versions', {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse);
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

  function importCaseFile(payload) {
    return fetch('/api/case-files/import', {
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

  function updateCaseItem(caseItemId, payload) {
    return fetch('/api/case-files/items/' + caseItemId, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function createCaseItem(caseFileId, payload) {
    return fetch('/api/case-files/' + caseFileId + '/items', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(handleResponse);
  }

  function deleteCaseItem(caseItemId) {
    return fetch('/api/case-files/items/' + caseItemId, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse);
  }

  function listExecSets(projectId) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    var url = '/api/exec/sets';
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

  function deleteVersion(projectId, versionId) {
    return fetch('/api/projects/' + projectId + '/versions/' + versionId, {
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

  function getExecutionOverview(projectId, versionId) {
    var query = [];
    if (projectId || projectId === 0) query.push('project_id=' + encodeURIComponent(projectId));
    if (versionId || versionId === 0) query.push('version_id=' + encodeURIComponent(versionId));
    var url = '/api/exec/overview';
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
    importCaseFile: importCaseFile,
    listCaseItems: listCaseItems,
    updateCaseItem: updateCaseItem,
    createCaseItem: createCaseItem,
    deleteCaseItem: deleteCaseItem,
    listExecSets: listExecSets,
    createExecSet: createExecSet,
    listExecCases: listExecCases,
    updateExecSet: updateExecSet,
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
    listFeatureAssignments: listFeatureAssignments,
    createFeatureAssignment: createFeatureAssignment,
    updateFeatureAssignment: updateFeatureAssignment,
    listOperationLogs: listOperationLogs,
    getExecutionOverview: getExecutionOverview,
    listExecutionOverviewCases: listExecutionOverviewCases,
  };
})();
