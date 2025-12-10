(function() {
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function getRedirectTarget() {
    var search = window.location.search || '';
    if (!search) return 'index.html';
    var params = {};
    search.replace(/^\?/, '').split('&').forEach(function(pair) {
      var parts = pair.split('=');
      if (parts.length === 2) {
        params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
      }
    });
    return params.redirect || 'index.html';
  }

  function handleSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    var form = document.getElementById('loginForm');
    var usernameInput = document.getElementById('loginUsername');
    var passwordInput = document.getElementById('loginPassword');
    var statusEl = document.getElementById('loginStatus');
    if (!apiClient || typeof apiClient.login !== 'function') {
      setText(statusEl, '登录服务未就绪');
      return false;
    }
    var username = usernameInput && usernameInput.value ? usernameInput.value.trim() : '';
    var password = passwordInput && passwordInput.value ? passwordInput.value : '';
    if (!username || !password) {
      setText(statusEl, '请输入账号和密码');
      return false;
    }
    form.classList.add('loading');
    setText(statusEl, '登录中...');
    apiClient.login(username, password).then(function() {
      setText(statusEl, '');
      form.classList.remove('loading');
      window.location.href = getRedirectTarget();
    }).catch(function(err) {
      var msg = err && err.message ? err.message : '登录失败';
      setText(statusEl, msg);
      form.classList.remove('loading');
    });
    return false;
  }

  function bindEvents() {
    var form = document.getElementById('loginForm');
    var submitBtn = document.getElementById('loginSubmit');
    if (form) {
      form.addEventListener('submit', handleSubmit);
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmit);
    }
  }

  function init() {
    if (apiClient && typeof apiClient.getStoredToken === 'function') {
      var stored = apiClient.getStoredToken();
      if (stored) {
        apiClient.setToken(stored);
        window.location.replace(getRedirectTarget());
        return;
      }
    }
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
