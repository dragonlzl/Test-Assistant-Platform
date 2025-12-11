(function() {
  const api = window.app && window.app.apiClient;
  if (!api) return;
  const state = {
    projects: [],
    users: [],
    userProjects: {},
    editingProjectId: null,
    editingUserId: null,
  };

  const dom = {
    projectStatus: document.getElementById('projectStatus'),
    projectRefreshBtn: document.getElementById('projectRefreshBtn'),
    projectCreateBtn: document.getElementById('projectCreateBtn'),
    projectSaveBtn: document.getElementById('projectSaveBtn'),
    projectCancelBtn: document.getElementById('projectCancelBtn'),
    projectNameInput: document.getElementById('projectNameInput'),
    projectDescInput: document.getElementById('projectDescInput'),
    projectForm: document.getElementById('projectForm'),
    projectList: document.getElementById('projectList'),
    userStatus: document.getElementById('userStatus'),
    userRefreshBtn: document.getElementById('userRefreshBtn'),
    userCreateBtn: document.getElementById('userCreateBtn'),
    userSaveBtn: document.getElementById('userSaveBtn'),
    userCancelBtn: document.getElementById('userCancelBtn'),
    userNameInput: document.getElementById('userNameInput'),
    userPasswordInput: document.getElementById('userPasswordInput'),
    userPasswordRow: document.getElementById('userPasswordRow'),
    userRoleSelect: document.getElementById('userRoleSelect'),
    userLevelSelect: document.getElementById('userLevelSelect'),
    userActiveCheckbox: document.getElementById('userActiveCheckbox'),
    userProjectsSelect: document.getElementById('userProjectsSelect'),
    userForm: document.getElementById('userForm'),
    userFormStatus: document.getElementById('userFormStatus'),
    userDrawerTitle: document.getElementById('userDrawerTitle'),
    userTableBody: document.getElementById('userTableBody'),
    userList: document.getElementById('userList'),
  };
  var userDrawer;

  function setStatus(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function formatTime(value) {
    if (!value) return '--';
    try {
      return new Date(value).toLocaleString();
    } catch (e) {
      return value;
    }
  }

  function showProjectForm(editing) {
    state.editingProjectId = editing ? editing.id : null;
    if (editing) {
      dom.projectNameInput.value = editing.name || '';
      dom.projectDescInput.value = editing.description || '';
    } else {
      dom.projectNameInput.value = '';
      dom.projectDescInput.value = '';
    }
    dom.projectForm.classList.remove('hidden');
  }

  function hideProjectForm() {
    state.editingProjectId = null;
    dom.projectForm.classList.add('hidden');
    dom.projectNameInput.value = '';
    dom.projectDescInput.value = '';
  }

  function ensureUserDrawer() {
    if (userDrawer) return userDrawer;
    if (!window.app || !window.app.drawer) return null;
    userDrawer = window.app.drawer.createDrawer({
      drawerId: 'userDrawer',
      openButtons: [],
      closeButtons: [],
    });
    return userDrawer;
  }

  function showUserForm(editing) {
    state.editingUserId = editing ? editing.id : null;
    setStatus(dom.userFormStatus, '', '');
    if (dom.userDrawerTitle) {
      dom.userDrawerTitle.textContent = editing ? '编辑人员' : '新增人员';
    }
    if (editing) {
      dom.userNameInput.value = editing.username || '';
      dom.userNameInput.disabled = true;
      dom.userPasswordInput.value = '';
      dom.userPasswordRow.classList.add('hidden');
      dom.userRoleSelect.value = editing.role || 'user';
      dom.userLevelSelect.value = editing.level || 'member';
      dom.userActiveCheckbox.checked = editing.is_active !== false;
      selectUserProjects(state.userProjects[editing.id] || []);
    } else {
      dom.userNameInput.value = '';
      dom.userNameInput.disabled = false;
      dom.userPasswordInput.value = '';
      dom.userPasswordRow.classList.remove('hidden');
      dom.userRoleSelect.value = 'user';
      dom.userLevelSelect.value = 'member';
      dom.userActiveCheckbox.checked = true;
      selectUserProjects([]);
    }
    dom.userForm.classList.remove('hidden');
    var drawerInstance = ensureUserDrawer();
    if (drawerInstance && typeof drawerInstance.open === 'function') {
      drawerInstance.open();
    }
  }

  function hideUserForm() {
    state.editingUserId = null;
    setStatus(dom.userFormStatus, '', '');
    dom.userForm.classList.add('hidden');
    var drawerInstance = ensureUserDrawer();
    if (drawerInstance && typeof drawerInstance.close === 'function') {
      drawerInstance.close();
    }
  }

  function selectUserProjects(ids) {
    const select = dom.userProjectsSelect;
    if (!select) return;
    const set = new Set(ids || []);
    Array.prototype.forEach.call(select.options, function(opt) {
      opt.selected = set.has(Number(opt.value));
    });
  }

  function buildProjectOptions() {
    if (!dom.userProjectsSelect) return;
    dom.userProjectsSelect.innerHTML = '';
    state.projects.forEach(function(p) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      dom.userProjectsSelect.appendChild(opt);
    });
  }

  function renderProjectList() {
    const container = dom.projectList;
    if (!container) return;
    if (!state.projects.length) {
      container.innerHTML = '<p class="hint">暂无项目，请先新建。</p>';
      return;
    }
    container.innerHTML = state.projects.map(function(p) {
      const versions = Array.isArray(p.versions) ? p.versions : [];
      const versionTags = versions.map(function(v) {
        return '<span class="tag muted">' + v.name + '</span>';
      }).join('') || '<span class="hint">暂无版本</span>';
      return (
        '<div class="card-item" data-project-id="' + p.id + '">' +
        '<div class="meta"><strong>' + (p.name || '') + '</strong></div>' +
        '<div class="meta">描述：' + (p.description || '—') + '</div>' +
        '<div class="meta">版本：' + versionTags + '</div>' +
        '<div class="meta">创建时间：' + formatTime(p.created_at) + '</div>' +
        '<div class="actions">' +
        '<button class="secondary" data-action="edit-project" data-id="' + p.id + '">编辑</button>' +
        '<button class="secondary" data-action="add-version" data-id="' + p.id + '">新增版本</button>' +
        '<button class="danger ghost-btn" data-action="delete-project" data-id="' + p.id + '">删除</button>' +
        '</div>' +
        '<div class="meta">版本操作：' + versions.map(function(v) {
          return '<button class="ghost-btn" data-action="delete-version" data-project-id="' + p.id + '" data-version-id="' + v.id + '">删除 ' + v.name + '</button>';
        }).join(' ') + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderUserList() {
    const tbody = dom.userTableBody || dom.userList;
    if (!tbody) return;
    if (!state.users.length) {
      tbody.innerHTML = '<tr><td colspan="7"><p class="hint">暂无人员，请先新增。</p></td></tr>';
      return;
    }
    const projectMap = {};
    state.projects.forEach(function(p) {
      projectMap[p.id] = p.name || ('项目 ' + p.id);
    });
    const rows = state.users.map(function(u) {
      const projects = state.userProjects[u.id] || [];
      const projectTags = projects.length
        ? projects.map(function(pid) {
            const name = projectMap[pid] || ('项目 ' + pid);
            return '<span class="tag">' + name + '</span>';
          }).join('')
        : '<span class="hint">未分配项目</span>';
      const roleLabel = u.role === 'admin' ? '管理员' : '用户';
      const levelLabel = u.level || '未设级别';
      const statusLabel = u.is_active === false ? '停用' : '启用';
      return (
        '<tr data-user-id="' + u.id + '">' +
        '<td><strong>' + u.username + '</strong></td>' +
        '<td>' + roleLabel + '</td>' +
        '<td>' + levelLabel + '</td>' +
        '<td>' + statusLabel + '</td>' +
        '<td>' + projectTags + '</td>' +
        '<td>' + formatTime(u.created_at) + '</td>' +
        '<td><div class="actions">' +
        '<button class="secondary" data-action="edit-user" data-id="' + u.id + '">编辑</button>' +
        '<button class="secondary" data-action="assign-projects" data-id="' + u.id + '">分配项目</button>' +
        '<button class="ghost-btn" data-action="reset-password" data-id="' + u.id + '">重置密码</button>' +
        '<button class="danger ghost-btn" data-action="delete-user" data-id="' + u.id + '">删除</button>' +
        '</div></td>' +
        '</tr>'
      );
    }).join('');
    tbody.innerHTML = rows;
  }

  function collectUserForm() {
    const username = dom.userNameInput.value.trim();
    const password = dom.userPasswordInput.value;
    const role = dom.userRoleSelect.value;
    const level = dom.userLevelSelect.value;
    const isActive = dom.userActiveCheckbox.checked;
    const projects = Array.prototype.filter.call(dom.userProjectsSelect.options || [], function(opt) {
      return opt.selected;
    }).map(function(opt) { return Number(opt.value); });
    return { username: username, password: password, role: role, level: level, is_active: isActive, project_ids: projects };
  }

  function loadProjects() {
    setStatus(dom.projectStatus, '加载项目...', '');
    return api.listProjects().then(function(list) {
      state.projects = Array.isArray(list) ? list : [];
      buildProjectOptions();
      renderProjectList();
      setStatus(dom.projectStatus, '已加载 ' + state.projects.length + ' 个项目', 'ok');
    }).catch(function(err) {
      setStatus(dom.projectStatus, err && err.message ? err.message : '加载失败', 'err');
    });
  }

  function loadUsers() {
    setStatus(dom.userStatus, '加载人员...', '');
    return api.listUsers().then(function(list) {
      state.users = Array.isArray(list) ? list : [];
      return Promise.all(state.users.map(function(u) {
        return api.getUserProjects(u.id).then(function(projects) {
          var ids = Array.isArray(projects)
            ? projects.map(function(item) { return item.project_id !== undefined ? item.project_id : item; })
            : [];
          state.userProjects[u.id] = ids;
        }).catch(function() {
          state.userProjects[u.id] = [];
        });
      }));
    }).then(function() {
      renderUserList();
      setStatus(dom.userStatus, '已加载 ' + state.users.length + ' 人', 'ok');
    }).catch(function(err) {
      setStatus(dom.userStatus, err && err.message ? err.message : '加载失败', 'err');
    });
  }

  function saveProject() {
    const name = dom.projectNameInput.value.trim();
    const desc = dom.projectDescInput.value.trim();
    if (!name) {
      setStatus(dom.projectStatus, '项目名称不能为空', 'warn');
      return;
    }
    setStatus(dom.projectStatus, '保存中...', '');
    const action = state.editingProjectId
      ? api.updateProject(state.editingProjectId, { description: desc })
      : api.createProject({ name: name, description: desc });
    action.then(function() {
      hideProjectForm();
      return loadProjects();
    }).catch(function(err) {
      setStatus(dom.projectStatus, err && err.message ? err.message : '保存失败', 'err');
    });
  }

  function saveUser() {
    const form = collectUserForm();
    if (!form.username) {
      setStatus(dom.userStatus, '账号不能为空', 'warn');
      setStatus(dom.userFormStatus, '账号不能为空', 'warn');
      return;
    }
    setStatus(dom.userStatus, '保存中...', '');
    setStatus(dom.userFormStatus, '保存中...', '');
    var savePromise;
    if (state.editingUserId) {
      savePromise = api.updateUser(state.editingUserId, {
        role: form.role,
        level: form.level,
        is_active: form.is_active,
      }).then(function() {
        return api.assignUserProjects(state.editingUserId, form.project_ids || []);
      });
    } else {
      savePromise = api.createUser({
        username: form.username,
        password: form.password || undefined,
        role: form.role,
        level: form.level,
        is_active: form.is_active,
      }).then(function(res) {
        if (form.project_ids && form.project_ids.length) {
          return api.assignUserProjects(res.id, form.project_ids);
        }
      });
    }
    savePromise.then(function() {
      hideUserForm();
      return loadUsers();
    }).catch(function(err) {
      setStatus(dom.userStatus, err && err.message ? err.message : '保存失败', 'err');
      setStatus(dom.userFormStatus, err && err.message ? err.message : '保存失败', 'err');
    });
  }

  function handleProjectListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'edit-project') {
      const id = Number(btn.dataset.id);
      const proj = state.projects.find(function(p) { return p.id === id; });
      if (proj) showProjectForm(proj);
    } else if (action === 'delete-project') {
      const id = Number(btn.dataset.id);
      if (!confirm('确认删除该项目？相关版本将被删除。')) return;
      api.deleteProject(id).then(loadProjects).catch(function(err) {
        setStatus(dom.projectStatus, err && err.message ? err.message : '删除失败', 'err');
      });
    } else if (action === 'add-version') {
      const id = Number(btn.dataset.id);
      const name = prompt('请输入新版本名称');
      if (!name) return;
      api.createVersion(id, { name: name }).then(loadProjects).catch(function(err) {
        setStatus(dom.projectStatus, err && err.message ? err.message : '新增版本失败', 'err');
      });
    } else if (action === 'delete-version') {
      const pid = Number(btn.dataset.projectId);
      const vid = Number(btn.dataset.versionId);
      if (!confirm('确认删除该版本？')) return;
      api.deleteVersion(pid, vid).then(loadProjects).catch(function(err) {
        setStatus(dom.projectStatus, err && err.message ? err.message : '删除版本失败', 'err');
      });
    }
  }

  function handleUserListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);
    const user = state.users.find(function(u) { return u.id === id; });
    if (action === 'edit-user') {
      if (user) showUserForm(user);
    } else if (action === 'assign-projects') {
      if (!user) return;
      showUserForm(user);
      dom.userForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (action === 'reset-password') {
      if (!confirm('确认重置该用户密码为默认值？')) return;
      api.resetUserPassword(id).then(function() {
        setStatus(dom.userStatus, '密码已重置', 'ok');
      }).catch(function(err) {
        setStatus(dom.userStatus, err && err.message ? err.message : '重置失败', 'err');
      });
    } else if (action === 'delete-user') {
      if (!confirm('确认删除该用户？')) return;
      api.deleteUser(id).then(loadUsers).catch(function(err) {
        setStatus(dom.userStatus, err && err.message ? err.message : '删除失败', 'err');
      });
    }
  }

  function bindEvents() {
    if (dom.projectRefreshBtn) dom.projectRefreshBtn.addEventListener('click', loadProjects);
    if (dom.projectCreateBtn) dom.projectCreateBtn.addEventListener('click', function() { showProjectForm(null); });
    if (dom.projectCancelBtn) dom.projectCancelBtn.addEventListener('click', hideProjectForm);
    if (dom.projectSaveBtn) dom.projectSaveBtn.addEventListener('click', saveProject);
    if (dom.projectList) dom.projectList.addEventListener('click', handleProjectListClick);

    if (dom.userRefreshBtn) dom.userRefreshBtn.addEventListener('click', function() {
      loadProjects().then(loadUsers);
    });
    if (dom.userCreateBtn) dom.userCreateBtn.addEventListener('click', function() {
      showUserForm(null);
    });
    if (dom.userSaveBtn) dom.userSaveBtn.addEventListener('click', saveUser);
    if (dom.userTableBody) dom.userTableBody.addEventListener('click', handleUserListClick);

    var projectTab = document.querySelector('[data-tab-btn="project-admin"]');
    if (projectTab) {
      projectTab.addEventListener('click', function() {
        loadProjects();
      });
    }
    var userTab = document.querySelector('[data-tab-btn="user-admin"]');
    if (userTab) {
      userTab.addEventListener('click', function() {
        loadProjects().then(loadUsers);
      });
    }
  }

  function init() {
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
