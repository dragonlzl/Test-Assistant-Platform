(function() {
  const api = window.app && window.app.apiClient;
  if (!api) return;
  const state = {
    projects: [],
    users: [],
    userProjects: {},
    currentUserProjects: [],
    editingProjectId: null,
    editingUserId: null,
  };

  const dom = {
    projectStatus: document.getElementById('projectStatus'),
    projectRefreshBtn: document.getElementById('projectRefreshBtn'),
    projectCreateBtn: document.getElementById('projectCreateBtn'),
    projectSaveBtn: document.getElementById('projectSaveBtn'),
    projectDrawerTitle: document.getElementById('projectDrawerTitle'),
    projectTableBody: document.getElementById('projectTableBody'),
    projectNameInput: document.getElementById('projectNameInput'),
    projectDescInput: document.getElementById('projectDescInput'),
    projectForm: document.getElementById('projectForm'),
    projectFormStatus: document.getElementById('projectFormStatus'),
    projectDrawer: document.getElementById('projectDrawer'),
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
    userDeleteTargetText: document.getElementById('userDeleteTargetText'),
    userDeleteAdminPasswordInput: document.getElementById('userDeleteAdminPasswordInput'),
    userDeleteConfirmBtn: document.getElementById('userDeleteConfirmBtn'),
    userDeleteStatus: document.getElementById('userDeleteStatus'),
  };
  var userDrawer;
  var projectDrawer;
  var userDeleteDrawer;

  function resolveProjectId(item) {
    if (item === null || item === undefined) return null;
    if (typeof item === 'number') return item;
    if (typeof item === 'string') {
      var num = Number(item);
      return isNaN(num) ? null : num;
    }
    if (item.project_id !== undefined) {
      var pid = Number(item.project_id);
      return isNaN(pid) ? null : pid;
    }
    if (item.projectId !== undefined) {
      var camel = Number(item.projectId);
      return isNaN(camel) ? null : camel;
    }
    if (item.id !== undefined) {
      var id = Number(item.id);
      return isNaN(id) ? null : id;
    }
    return null;
  }

  function normalizeProjectIds(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function(item) { return resolveProjectId(item); }).filter(function(id) { return id !== null; });
  }

  function sortProjectsAsc(list) {
    if (!Array.isArray(list)) return [];
    return list.slice().sort(function(a, b) {
      var idA = resolveProjectId(a);
      var idB = resolveProjectId(b);
      if (idA === null || idB === null) return 0;
      return idA - idB;
    });
  }

  function setStatus(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function openConfirmDrawer(options) {
    const utils = window.app && window.app.utils ? window.app.utils : null;
    if (utils && typeof utils.openConfirmDrawer === 'function') {
      return utils.openConfirmDrawer(options || {});
    }
    const msg = options && options.message ? String(options.message) : '';
    let ok = true;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      ok = window.confirm(msg);
    }
    return Promise.resolve({ ok: ok });
  }

  function resolveAdminActiveDrawer() {
    var candidates = [userDeleteDrawer, userDrawer, projectDrawer];
    for (var i = 0; i < candidates.length; i += 1) {
      var drawer = candidates[i];
      var el = drawer && drawer.element ? drawer.element : null;
      if (el && el.classList && el.classList.contains('open')) return drawer;
    }
    return null;
  }

  function promptNewVersionName(projectName) {
    const drawerApi = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
    if (!drawerApi || typeof drawerApi.open !== 'function') {
      const name = prompt('请输入新版本名称');
      const trimmed = name ? String(name).trim() : '';
      return Promise.resolve({ ok: Boolean(trimmed), value: trimmed });
    }
    return drawerApi.open({
      title: '新增版本',
      message: '为项目【' + projectName + '】新增版本',
      confirmText: '确认新增',
      cancelText: '取消',
      previousDrawer: projectDrawer || null,
      input: {
        label: '版本名称',
        placeholder: '请输入新版本名称',
        required: true,
        requiredMessage: '请输入版本名称',
        maxLength: 50,
      },
    });
  }

  var centerToastEl = null;
  var centerToastTimer = 0;
  function showCenterToast(text, type) {
    if (typeof document === 'undefined') return;
    if (!text) return;
    if (centerToastTimer) {
      clearTimeout(centerToastTimer);
      centerToastTimer = 0;
    }
    if (centerToastEl && centerToastEl.parentNode) {
      try { centerToastEl.parentNode.removeChild(centerToastEl); } catch (_) {}
    }
    centerToastEl = document.createElement('div');
    centerToastEl.className = 'temp-center-toast' + (type ? (' ' + String(type)) : '');
    centerToastEl.textContent = String(text);
    document.body.appendChild(centerToastEl);
    centerToastTimer = setTimeout(function() {
      if (!centerToastEl) return;
      centerToastEl.classList.add('fade-out');
      setTimeout(function() {
        if (centerToastEl && centerToastEl.parentNode) {
          try { centerToastEl.parentNode.removeChild(centerToastEl); } catch (_) {}
        }
        centerToastEl = null;
      }, 240);
    }, 3000);
  }

  function notifyProjectsUpdated(reason, detail) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    var payload = detail && typeof detail === 'object' ? detail : {};
    payload.reason = reason || 'updated';
    payload.ts = Date.now();
    window.dispatchEvent(new CustomEvent('app-projects-updated', { detail: payload }));
  }

  function formatTime(value) {
    if (!value) return '--';
    function normalizeTimeInput(input) {
      if (!input) return '';
      if (typeof input === 'number') return input;
      var raw = String(input || '').trim();
      if (!raw) return '';
      // 兼容 SQLite/Pydantic 输出：若时间不含时区信息，默认按 UTC 解释（避免展示少 8 小时）。
      if (raw.indexOf('T') === -1 && raw.indexOf(' ') !== -1) {
        raw = raw.replace(' ', 'T');
      }
      raw = raw.replace(/(\.\d{3})\d+/, '$1');
      raw = raw.replace(/([+-]\d{2}):(\d{2})$/, '$1$2');
      var hasTz = /Z$/i.test(raw) || /[+-]\d{2}\d{2}$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw);
      var isIsoWithTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw);
      if (isIsoWithTime && !hasTz) raw += 'Z';
      return raw;
    }
    try {
      var normalized = normalizeTimeInput(value);
      var d = typeof normalized === 'number' ? new Date(normalized) : new Date(normalized || value);
      if (!d || isNaN(d.getTime())) return String(value || '--');
      return d.toLocaleString();
    } catch (e) {
      return String(value || '--');
    }
  }

  function showProjectForm(editing) {
    state.editingProjectId = editing ? editing.id : null;
    setStatus(dom.projectStatus, '', '');
    setStatus(dom.projectFormStatus, '', '');
    if (dom.projectDrawerTitle) {
      dom.projectDrawerTitle.textContent = editing ? '编辑项目' : '新建项目';
    }
    if (editing) {
      dom.projectNameInput.value = editing.name || '';
      dom.projectDescInput.value = editing.description || '';
    } else {
      dom.projectNameInput.value = '';
      dom.projectDescInput.value = '';
    }
    dom.projectForm.classList.remove('hidden');
    var drawerInstance = ensureProjectDrawer();
    if (drawerInstance && typeof drawerInstance.open === 'function') {
      drawerInstance.open();
    }
  }

  function hideProjectForm() {
    state.editingProjectId = null;
    dom.projectForm.classList.add('hidden');
    dom.projectNameInput.value = '';
    dom.projectDescInput.value = '';
    setStatus(dom.projectFormStatus, '', '');
    var drawerInstance = ensureProjectDrawer();
    if (drawerInstance && typeof drawerInstance.close === 'function') {
      drawerInstance.close();
    }
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

  function ensureProjectDrawer() {
    if (projectDrawer) return projectDrawer;
    if (!window.app || !window.app.drawer) return null;
    projectDrawer = window.app.drawer.createDrawer({
      drawerId: 'projectDrawer',
      openButtons: [],
      closeButtons: [],
    });
    return projectDrawer;
  }

  function ensureUserDeleteDrawer() {
    if (userDeleteDrawer) return userDeleteDrawer;
    if (!window.app || !window.app.drawer) return null;
    userDeleteDrawer = window.app.drawer.createDrawer({
      drawerId: 'userDeleteDrawer',
      openButtons: [],
      closeButtons: [],
      onClose: function() {
        if (dom.userDeleteAdminPasswordInput) dom.userDeleteAdminPasswordInput.value = '';
        if (dom.userDeleteConfirmBtn) dom.userDeleteConfirmBtn.disabled = true;
        setStatus(dom.userDeleteStatus, '', '');
      },
    });
    return userDeleteDrawer;
  }

  function showUserForm(editing) {
    state.editingUserId = editing ? editing.id : null;
    setStatus(dom.userFormStatus, '', '');
    buildProjectOptions();
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

  function getCurrentUser() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    return globalState && globalState.currentUser ? globalState.currentUser : null;
  }

  function normalizeLevel(level) {
    if (!level && level !== 0) return '';
    var lower = String(level).toLowerCase();
    if (lower === '组长') return 'leader';
    if (lower === '组员') return 'member';
    return lower;
  }

  function ensureCurrentUserReady() {
    var user = getCurrentUser();
    if (user) return Promise.resolve(user);
    if (api && typeof api.getCurrentUser === 'function') {
      return api.getCurrentUser().then(function(u) {
        if (u) u.level = normalizeLevel(u.level);
        if (window.app && window.app.state) {
          window.app.state.currentUser = u;
        }
        return u;
      }).catch(function() { return null; });
    }
    return Promise.resolve(null);
  }

  function isAdmin() {
    var user = getCurrentUser();
    return user && user.role === 'admin';
  }

  function isLeader() {
    var user = getCurrentUser();
    var level = user && user.level ? user.level : '';
    return normalizeLevel(level) === 'leader';
  }

  function belongsToCurrentUser(projectId) {
    if (isAdmin()) return true;
    var set = normalizeProjectIds(state.currentUserProjects);
    state.currentUserProjects = set;
    return set.indexOf(Number(projectId)) !== -1;
  }

  function ensureCurrentUserProjects() {
    if (isAdmin()) return Promise.resolve([]);
    var user = getCurrentUser();
    if (!user || !user.id) return Promise.resolve([]);
    return api.getUserProjects(user.id).then(function(list) {
      var ids = normalizeProjectIds(list);
      state.currentUserProjects = ids;
      if (window.app && window.app.state) {
        window.app.state.currentUserProjects = ids;
      }
      return ids;
    }).catch(function() {
      state.currentUserProjects = [];
      return [];
    });
  }

  function selectUserProjects(ids) {
    const container = dom.userProjectsSelect;
    if (!container || !container.querySelectorAll) return;
    const set = new Set(ids || []);
    var boxes = container.querySelectorAll('input[type="checkbox"]');
    if (!boxes || typeof boxes.length !== 'number') return;
    Array.prototype.forEach.call(boxes, function(box) {
      box.checked = set.has(Number(box.value));
    });
  }

  function buildProjectOptions() {
    if (!dom.userProjectsSelect) return;
    dom.userProjectsSelect.innerHTML = '';
    if (!state.projects.length) {
      var empty = document.createElement('p');
      empty.className = 'hint project-checkbox-empty';
      empty.textContent = '暂无项目';
      dom.userProjectsSelect.appendChild(empty);
      return;
    }
    state.projects.forEach(function(p) {
      var label = document.createElement('label');
      label.className = 'project-checkbox';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = p.id;
      label.appendChild(input);
      var text = document.createElement('span');
      text.textContent = p.name;
      label.appendChild(text);
      dom.userProjectsSelect.appendChild(label);
    });
  }

  function renderProjectList() {
    const tbody = dom.projectTableBody;
    if (!tbody) return;
    if (!state.projects.length) {
      var emptyText = '暂无项目，请先新建。';
      var user = getCurrentUser();
      if (user && user.role !== 'admin') {
        emptyText = '联系管理员指派项目。';
      }
      tbody.innerHTML = '<tr><td colspan="5"><p class="hint">' + emptyText + '</p></td></tr>';
      return;
    }
    const rows = state.projects.map(function(p) {
      var belongs = belongsToCurrentUser(p.id);
      var canManageVersions = isAdmin() || belongs;
      var canEditProject = isAdmin() || (isLeader() && belongs);
      var canDeleteProject = isAdmin();
      const versions = Array.isArray(p.versions) ? p.versions : [];
      const versionTags = versions.length
        ? versions.map(function(v) {
            var delBtn = canManageVersions
              ? '<button class="ghost-btn slim" data-action="delete-version" data-project-id="' + p.id + '" data-version-id="' + v.id + '">删除</button>'
              : '';
            return '<span class="version-chip"><span class="tag muted">' + v.name + '</span>' + delBtn + '</span>';
          }).join(' ')
        : '<span class="hint version-empty">暂无版本</span>';
      var actions = '<div class="actions">';
      if (canEditProject) {
        actions += '<button class="secondary" data-action="edit-project" data-id="' + p.id + '">编辑</button>';
      }
      if (canManageVersions) {
        actions += '<button class="secondary" data-action="add-version" data-id="' + p.id + '">新增版本</button>';
      }
      if (canDeleteProject) {
        actions += '<button class="danger ghost-btn" data-action="delete-project" data-id="' + p.id + '">删除</button>';
      }
      actions += '</div>';
      return (
        '<tr data-project-id="' + p.id + '">' +
        '<td class="project-name"><span class="project-name-text">' + (p.name || '') + '</span></td>' +
        '<td class="project-desc"><span class="project-desc-text">' + (p.description || '—') + '</span></td>' +
        '<td class="project-versions"><div class="version-list">' + versionTags + '</div></td>' +
        '<td class="project-created"><span class="project-created-text">' + formatTime(p.created_at) + '</span></td>' +
        '<td>' + actions + '</td>' +
        '</tr>'
      );
    }).join('');
    tbody.innerHTML = rows;
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
      var levelLabel = '未设级别';
      if (u.level === 'leader') levelLabel = '组长';
      if (u.level === 'member') levelLabel = '组员';
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
    const projects = Array.prototype.filter.call(dom.userProjectsSelect.querySelectorAll('input[type="checkbox"]') || [], function(box) {
      return box && box.checked;
    }).map(function(box) { return Number(box.value); });
    return { username: username, password: password, role: role, level: level, is_active: isActive, project_ids: projects };
  }

  function loadProjects() {
    setStatus(dom.projectStatus, '加载项目...', '');
    var prepare = ensureCurrentUserReady().then(function() {
      return ensureCurrentUserProjects();
    });
    return prepare.then(function() {
      return api.listProjects();
    }).then(function(list) {
      var user = getCurrentUser();
      if (dom.projectCreateBtn) {
        var canCreate = user && user.role === 'admin';
        dom.projectCreateBtn.classList.toggle('hidden', !canCreate);
        // 同步 hidden 属性：即使样式未加载，浏览器也会按默认规则隐藏该按钮。
        dom.projectCreateBtn.hidden = !canCreate;
      }
      var projects = Array.isArray(list) ? list : [];
      if (!isAdmin()) {
        var allowedIds = normalizeProjectIds(state.currentUserProjects);
        state.currentUserProjects = allowedIds;
        if (allowedIds.length) {
          var allowed = new Set(allowedIds);
          projects = projects.filter(function(p) { return allowed.has(Number(p.id)); });
        } else if (projects.length) {
          state.currentUserProjects = projects.map(function(p) { return Number(p.id); });
          if (window.app && window.app.state) {
            window.app.state.currentUserProjects = state.currentUserProjects;
          }
        }
      }
      state.projects = sortProjectsAsc(projects);
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
          var ids = normalizeProjectIds(projects);
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
      setStatus(dom.projectFormStatus, '项目名称不能为空', 'warn');
      return;
    }
    var isEditing = Boolean(state.editingProjectId);
    // “新建/编辑项目”的错误提示统一展示在抽屉内，避免用户误以为是列表操作提示。
    setStatus(dom.projectFormStatus, '保存中...', '');
    const action = state.editingProjectId
      ? api.updateProject(state.editingProjectId, { description: desc })
      : api.createProject({ name: name, description: desc });
    action.then(function() {
      hideProjectForm();
      return loadProjects().then(function() {
        notifyProjectsUpdated(isEditing ? 'project-updated' : 'project-created', { name: name });
      });
    }).catch(function(err) {
      setStatus(dom.projectFormStatus, err && err.message ? err.message : '保存失败', 'err');
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
    var pid = Number(btn.dataset.projectId || btn.dataset.id);
    var belongs = belongsToCurrentUser(pid);
    var canManageVersions = isAdmin() || belongs;
    var canEditProject = isAdmin() || (isLeader() && belongs);
    var canDeleteProject = isAdmin();
    if (action === 'edit-project') {
      if (!canEditProject) return;
      const id = Number(btn.dataset.id);
      const proj = state.projects.find(function(p) { return p.id === id; });
      if (proj) showProjectForm(proj);
    } else if (action === 'delete-project') {
      if (!canDeleteProject) return;
      const id = Number(btn.dataset.id);
      const project = state.projects.find(function(p) { return p && Number(p.id) === Number(id); });
      const projectName = project && project.name ? project.name : ('项目#' + id);
      var prevDrawer = resolveAdminActiveDrawer();
      openConfirmDrawer({
        title: '确认删除项目',
        message: '确认删除项目【' + projectName + '】？相关版本将被删除。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        previousDrawer: prevDrawer || null,
      }).then(function(res) {
        if (!res || res.ok !== true) return;
        api.deleteProject(id).then(function() {
          return loadProjects().then(function() {
            notifyProjectsUpdated('project-deleted', { project_id: id });
            showCenterToast('删除项目成功', 'ok');
          });
        }).catch(function(err) {
          setStatus(dom.projectStatus, err && err.message ? err.message : '删除失败', 'err');
        });
      });
    } else if (action === 'add-version') {
      if (!canManageVersions) return;
      const id = Number(btn.dataset.id);
      const project = state.projects.find(function(p) { return p && Number(p.id) === Number(id); });
      const projectName = project && project.name ? project.name : ('项目#' + id);
      promptNewVersionName(projectName).then(function(res) {
        if (!res || res.ok !== true) return;
        const name = res.value ? String(res.value).trim() : '';
        if (!name) {
          setStatus(dom.projectStatus, '版本名称不能为空', 'warn');
          return;
        }
        api.createVersion(id, { name: name }).then(function() {
          return loadProjects().then(function() {
            notifyProjectsUpdated('version-created', { project_id: id, version_name: name });
            showCenterToast('新增版本成功', 'ok');
          });
        }).catch(function(err) {
          setStatus(dom.projectStatus, err && err.message ? err.message : '新增版本失败', 'err');
        });
      });
    } else if (action === 'delete-version') {
      if (!canManageVersions) return;
      const pid = Number(btn.dataset.projectId);
      const vid = Number(btn.dataset.versionId);
      var prevDrawer = resolveAdminActiveDrawer();
      openConfirmDrawer({
        title: '确认删除版本',
        message: '确认删除该版本？',
        confirmText: '确认删除',
        cancelText: '取消',
        previousDrawer: prevDrawer || null,
      }).then(function(res) {
        if (!res || res.ok !== true) return;
        api.deleteVersion(pid, vid).then(function() {
          return loadProjects().then(function() {
            notifyProjectsUpdated('version-deleted', { project_id: pid, version_id: vid });
            showCenterToast('删除版本成功', 'ok');
          });
        }).catch(function(err) {
          var statusCode = err && typeof err.status === 'number' ? err.status : 0;
          var payload = err && err.payload ? err.payload : null;
          var payloadDetail = payload && payload.detail ? payload.detail : null;
          var code = payload && payload.code ? String(payload.code) : '';
          if (!code && payloadDetail && payloadDetail.code) code = String(payloadDetail.code);
          if (statusCode === 409 && code === 'VERSION_IN_USE') {
            var count = 0;
            if (payload && typeof payload.case_file_count === 'number') count = payload.case_file_count;
            if (!count && payloadDetail && typeof payloadDetail.case_file_count === 'number') count = payloadDetail.case_file_count;
            var project = state.projects.find(function(p) { return p && Number(p.id) === pid; });
            var versions = project && Array.isArray(project.versions) ? project.versions : [];
            var options = versions
              .filter(function(v) { return v && Number(v.id) !== Number(vid); })
              .map(function(v) {
                return { value: v.name ? String(v.name) : '', label: v.name ? String(v.name) : '' };
              })
              .filter(function(opt) { return opt.value; });
            if (!options.length) {
              setStatus(dom.projectStatus, '暂无可转移版本，请先创建版本', 'warn');
              return;
            }
            var transferDrawer = resolveAdminActiveDrawer();
            openConfirmDrawer({
              title: '转移用例并删除版本',
              message: '该版本下已有 ' + count + ' 份用例文件，请选择要转移到的版本后删除。',
              confirmText: '确认删除',
              cancelText: '取消',
              previousDrawer: transferDrawer || null,
              input: {
                type: 'select',
                label: '转移到版本',
                placeholder: '请选择版本',
                required: true,
                options: options,
              },
            }).then(function(res2) {
              if (!res2 || res2.ok !== true) return;
              var transferName = res2.value ? String(res2.value).trim() : '';
              if (!transferName) {
                setStatus(dom.projectStatus, '未选择转移版本，已取消删除', '');
                return;
              }
              var target = versions.find(function(v) { return v && String(v.name || '') === transferName; });
              if (!target) {
                setStatus(dom.projectStatus, '版本不存在，请先创建版本后再进行操作', 'err');
                return;
              }
              api.deleteVersion(pid, vid, transferName).then(function() {
                return loadProjects().then(function() {
                  notifyProjectsUpdated('version-deleted', { project_id: pid, version_id: vid });
                  setStatus(dom.projectStatus, '已转移用例并删除版本', 'ok');
                  showCenterToast('已转移用例并删除版本', 'ok');
                });
              }).catch(function(err2) {
                setStatus(dom.projectStatus, err2 && err2.message ? err2.message : '删除版本失败', 'err');
              });
            });
            return;
          }
          setStatus(dom.projectStatus, err && err.message ? err.message : '删除版本失败', 'err');
        });
      });
    }
  }

  function updateDeleteConfirmState() {
    if (!dom.userDeleteConfirmBtn) return;
    var val = '';
    if (dom.userDeleteAdminPasswordInput) val = String(dom.userDeleteAdminPasswordInput.value || '');
    dom.userDeleteConfirmBtn.disabled = !val.trim();
  }

  function showDeleteUserConfirm(user) {
    if (!user) return;
    var current = getCurrentUser();
    if (current && current.id && Number(current.id) === Number(user.id)) {
      setStatus(dom.userStatus, '禁止删除当前登录账号，请更换管理员账号后操作', 'warn');
      return;
    }
    state.deletingUserId = user.id;
    setStatus(dom.userDeleteStatus, '', '');
    if (dom.userDeleteTargetText) {
      dom.userDeleteTargetText.textContent = (user.username || '') + '（ID: ' + user.id + '）';
    }
    if (dom.userDeleteAdminPasswordInput) dom.userDeleteAdminPasswordInput.value = '';
    updateDeleteConfirmState();
    var drawerInstance = ensureUserDeleteDrawer();
    if (drawerInstance && typeof drawerInstance.open === 'function') {
      drawerInstance.open();
      setTimeout(function() {
        if (dom.userDeleteAdminPasswordInput && typeof dom.userDeleteAdminPasswordInput.focus === 'function') {
          dom.userDeleteAdminPasswordInput.focus({ preventScroll: true });
        }
      }, 0);
    }
  }

  function confirmDeleteUser() {
    var uid = state && state.deletingUserId ? Number(state.deletingUserId) : null;
    if (!uid) return;
    var password = dom.userDeleteAdminPasswordInput ? String(dom.userDeleteAdminPasswordInput.value || '').trim() : '';
    if (!password) {
      setStatus(dom.userDeleteStatus, '请输入当前登录管理员密码', 'warn');
      updateDeleteConfirmState();
      return;
    }
    setStatus(dom.userDeleteStatus, '删除中...', '');
    api.deleteUser(uid, password).then(function() {
      setStatus(dom.userStatus, '用户已删除', 'ok');
      showCenterToast('删除成功', 'ok');
      var drawerInstance = ensureUserDeleteDrawer();
      if (drawerInstance && typeof drawerInstance.close === 'function') drawerInstance.close();
      return loadUsers();
    }).catch(function(err) {
      setStatus(dom.userDeleteStatus, err && err.message ? err.message : '删除失败', 'err');
    });
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
      openConfirmDrawer({
        title: '确认重置密码',
        message: '确认重置该用户密码为默认值？',
        confirmText: '确认重置',
        cancelText: '取消',
        previousDrawer: userDrawer || null,
      }).then(function(res) {
        if (!res || res.ok !== true) return;
        api.resetUserPassword(id).then(function() {
          setStatus(dom.userStatus, '密码已重置', 'ok');
          showCenterToast('重置密码成功', 'ok');
        }).catch(function(err) {
          setStatus(dom.userStatus, err && err.message ? err.message : '重置失败', 'err');
        });
      });
    } else if (action === 'delete-user') {
      if (!user) return;
      var confirmMsg = [
        '确认删除用户【' + (user.username || '') + '】（ID: ' + user.id + '）？',
        '',
        '删除后果（不可恢复）：',
        '1）该用户账号将被彻底删除，无法再登录；',
        '2）该用户的项目归属会被移除；相关个人执行数据可能失去归属，普通用户可能无法再访问，只能由管理员查看/清理；',
        '',
        '下一步需要输入当前登录管理员密码以确认删除。',
      ].join('\n');
      if (!confirm(confirmMsg)) return;
      state.deletingUserId = user.id;
      showDeleteUserConfirm(user);
    }
  }

  function bindEvents() {
    if (dom.projectRefreshBtn) dom.projectRefreshBtn.addEventListener('click', loadProjects);
    if (dom.projectCreateBtn) dom.projectCreateBtn.addEventListener('click', function() {
      if (!isAdmin()) return;
      showProjectForm(null);
    });
    if (dom.projectSaveBtn) dom.projectSaveBtn.addEventListener('click', saveProject);
    if (dom.projectTableBody) dom.projectTableBody.addEventListener('click', handleProjectListClick);

    if (dom.userRefreshBtn) dom.userRefreshBtn.addEventListener('click', function() {
      loadProjects().then(loadUsers);
    });
    if (dom.userCreateBtn) dom.userCreateBtn.addEventListener('click', function() {
      showUserForm(null);
    });
    if (dom.userSaveBtn) dom.userSaveBtn.addEventListener('click', saveUser);
    if (dom.userTableBody) dom.userTableBody.addEventListener('click', handleUserListClick);
    if (dom.userDeleteAdminPasswordInput) {
      dom.userDeleteAdminPasswordInput.addEventListener('input', updateDeleteConfirmState);
      dom.userDeleteAdminPasswordInput.addEventListener('keydown', function(e) {
        if (!e || e.key !== 'Enter') return;
        e.preventDefault();
        confirmDeleteUser();
      });
    }
    if (dom.userDeleteConfirmBtn) dom.userDeleteConfirmBtn.addEventListener('click', confirmDeleteUser);
  }

  function isAuthReady() {
    if (window.app && window.app.authReady === true) return true;
    var globalState = window.app && window.app.state ? window.app.state : null;
    return Boolean(globalState && globalState.currentUser);
  }

  var pendingTab = '';

  function handleTabActivated(tabName) {
    // 刷新后用户可能在鉴权未就绪前就点到管理页签：先挂起，等 app-auth-ready 再补加载，避免首次进入空列表。
    if (!isAuthReady()) {
      pendingTab = tabName || '';
      if (tabName === 'project-admin') setStatus(dom.projectStatus, '登录信息加载中...', '');
      if (tabName === 'user-admin') setStatus(dom.userStatus, '登录信息加载中...', '');
      return;
    }
    if (tabName === 'project-admin') {
      loadProjects();
    } else if (tabName === 'user-admin') {
      loadProjects().then(loadUsers);
    }
  }

  function bindTabActivation() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-tab-activated', function(e) {
      var tabName = e && e.detail ? e.detail.tab : '';
      handleTabActivated(tabName);
    });
  }

  function bindTabButtonFallbacks() {
    // 兜底：某些时序/浏览器下可能没收到 app-tab-activated（例如脚本尚未完全就绪）。
    var projectTab = document.querySelector('[data-tab-btn="project-admin"]');
    if (projectTab) {
      projectTab.addEventListener('click', function() {
        setTimeout(function() { handleTabActivated('project-admin'); }, 0);
      });
    }
    var userTab = document.querySelector('[data-tab-btn="user-admin"]');
    if (userTab) {
      userTab.addEventListener('click', function() {
        setTimeout(function() { handleTabActivated('user-admin'); }, 0);
      });
    }
  }

  function bindAuthReady() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-auth-ready', function() {
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = pendingTab || (globalState && globalState.activeTab ? globalState.activeTab : '');
      pendingTab = '';
      if (tabName) handleTabActivated(tabName);
    });
  }

  function init() {
    bindTabActivation();
    bindTabButtonFallbacks();
    bindAuthReady();
    bindEvents();
    // 如果初始化时页签已可见（例如刷新后恢复），补一次数据加载。
    var visibleProject = document.querySelector('section[data-tab-section="project-admin"]:not(.hidden)');
    var visibleUser = document.querySelector('section[data-tab-section="user-admin"]:not(.hidden)');
    if (visibleProject) handleTabActivated('project-admin');
    else if (visibleUser) handleTabActivated('user-admin');
    if (!window.app) window.app = {};
    window.app.adminBound = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
