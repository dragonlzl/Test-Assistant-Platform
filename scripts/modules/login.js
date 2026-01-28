(function() {
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function getQueryParams() {
    var search = window.location.search || '';
    var params = {};
    if (!search) return params;
    search.replace(/^\?/, '').split('&').forEach(function(pair) {
      var parts = pair.split('=');
      if (!parts[0]) return;
      params[decodeURIComponent(parts[0])] = decodeURIComponent(parts.slice(1).join('='));
    });
    return params;
  }

  function getRedirectTarget() {
    var params = getQueryParams();
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
      // Re-login should start from default tab; refresh within index.html is handled by sessionStorage.
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('usecase-active-tab');
      } catch (err) {
        // ignore
      }
      // 标记一次“刚完成登录”，让 index.html 无条件回到主页（避免任何残留页签/redirect 恢复到旧页面）。
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('tap-force-default-tab', '1');
      } catch (err) {
        // ignore
      }
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem('usecase-active-tab');
      } catch (err) {
        // ignore
      }
      window.location.href = getRedirectTarget();
    }).catch(function(err) {
      var msg = err && err.message ? err.message : '登录失败';
      setText(statusEl, msg);
      form.classList.remove('loading');
    });
    return false;
  }

  function handleChangePassword(event) {
    if (event && event.preventDefault) event.preventDefault();
    var oldInput = document.getElementById('oldPassword');
    var newInput = document.getElementById('newPassword');
    var confirmInput = document.getElementById('newPasswordConfirm');
    var usernameInput = document.getElementById('loginUsername');
    var statusEl = document.getElementById('changePasswordStatus');
    if (!apiClient || typeof apiClient.changePassword !== 'function') {
      setText(statusEl, '修改密码服务未就绪');
      return false;
    }
    var username = usernameInput && usernameInput.value ? usernameInput.value.trim() : '';
    var oldPwd = oldInput && oldInput.value ? oldInput.value : '';
    var newPwd = newInput && newInput.value ? newInput.value : '';
    var confirmPwd = confirmInput && confirmInput.value ? confirmInput.value : '';
    if (!username || !oldPwd || !newPwd || !confirmPwd) {
      setText(statusEl, '请填写账号及全部密码字段');
      return false;
    }
    if (newPwd !== confirmPwd) {
      setText(statusEl, '两次新密码不一致');
      return false;
    }
    if (newPwd.length < 8) {
      setText(statusEl, '新密码至少 8 位');
      return false;
    }
    setText(statusEl, '提交中...');
    // 先用账号+旧密码获取临时 token，再调用修改密码
    apiClient.login(username, oldPwd).then(function(loginRes) {
      if (!loginRes || !loginRes.access_token) {
        throw new Error('账号或旧密码错误');
      }
      return apiClient.changePassword(oldPwd, newPwd);
    }).then(function(res) {
      if (apiClient && typeof apiClient.clearToken === 'function') {
        apiClient.clearToken();
      }
      setText(statusEl, res && res.detail ? res.detail : '密码已更新，请使用新密码登录');
      setTimeout(function() {
        window.location.replace(getRedirectTarget());
      }, 500);
    }).catch(function(err) {
      var msg = err && err.message ? err.message : '修改失败';
      setText(statusEl, msg);
    });
    return false;
  }

  function toggleChangePassword() {
    var panel = document.getElementById('changePasswordPanel');
    if (!panel) return;
    panel.classList.toggle('hidden');
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
    var openChangeBtn = document.getElementById('openChangePassword');
    var submitChangeBtn = document.getElementById('submitChangePassword');
    if (openChangeBtn) {
      openChangeBtn.addEventListener('click', toggleChangePassword);
    }
    if (submitChangeBtn) {
      submitChangeBtn.addEventListener('click', handleChangePassword);
    }
  }

  function init() {
    // 如果有残留 token，先清空避免循环跳转
    if (apiClient && typeof apiClient.clearToken === 'function') {
      apiClient.clearToken();
    }
    // Ensure a fresh login always starts from default tab.
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('usecase-active-tab');
    } catch (err) {
      // ignore
    }
    var params = getQueryParams();
    if (params && params.reason === 'expired') {
      setText(document.getElementById('loginStatus'), '登录已过期，请重新登录');
    }
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
