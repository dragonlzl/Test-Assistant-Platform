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

  window.app = window.app || {};
  window.app.apiClient = {
    setToken: setToken,
    clearToken: clearToken,
    getStoredToken: getStoredToken,
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
  };
})();
