(function() {
  var tokenKey = 'tap-auth-token';
  var authToken = '';

  function setToken(token) {
    authToken = token || '';
    if (typeof localStorage !== 'undefined') {
      try {
        if (authToken) {
          localStorage.setItem(tokenKey, authToken);
        } else {
          localStorage.removeItem(tokenKey);
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

  function deleteVersion(projectId, versionId) {
    return fetch('/api/projects/' + projectId + '/versions/' + versionId, {
      method: 'DELETE',
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
    deleteVersion: deleteVersion,
  };
})();
