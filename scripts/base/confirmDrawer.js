(function() {
  var drawerInstance = null;
  var resolved = false;
  var resolveFn = null;
  var suspended = null;
  var inputConfig = null;
  var resolveAfterClose = false;
  var deferredResult = null;
  var hasDeferredResult = false;

  var dom = {
    drawer: document.getElementById('appConfirmDrawer'),
    title: document.getElementById('appConfirmDrawerTitle'),
    message: document.getElementById('appConfirmDrawerMessage'),
    hint: document.getElementById('appConfirmDrawerHint'),
    status: document.getElementById('appConfirmDrawerStatus'),
    inputRow: document.getElementById('appConfirmDrawerInputRow'),
    inputLabel: document.getElementById('appConfirmDrawerInputLabel'),
    input: document.getElementById('appConfirmDrawerInput'),
    select: document.getElementById('appConfirmDrawerSelect'),
    confirmBtn: document.getElementById('appConfirmDrawerConfirmBtn'),
    cancelBtn: document.getElementById('appConfirmDrawerCancelBtn'),
  };

  function getUtils() {
    return window.app && window.app.utils ? window.app.utils : null;
  }

  function setStatus(text, type) {
    var utils = getUtils();
    if (utils && typeof utils.setStatus === 'function') {
      utils.setStatus(dom.status, text || '', type || '');
      return;
    }
    if (!dom.status) return;
    dom.status.textContent = text || '';
    dom.status.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function clearStatus() {
    setStatus('', '');
  }

  function isSelectConfig(cfg) {
    if (!cfg) return false;
    return cfg.type === 'select' || cfg.kind === 'select';
  }

  function resolveDrawerElement(ref) {
    if (!ref) return null;
    if (ref.element) return ref.element;
    if (ref.classList) return ref;
    if (typeof ref === 'string') return document.getElementById(ref);
    return null;
  }

  function suspendDrawer(ref) {
    var el = resolveDrawerElement(ref);
    if (!el || !el.classList || !el.classList.contains('open')) return null;
    var already = el.classList.contains('drawer-suspended');
    if (!already) el.classList.add('drawer-suspended');
    return { element: el, already: already };
  }

  function resumeDrawer() {
    if (!suspended || !suspended.element || !suspended.element.classList) {
      suspended = null;
      return;
    }
    suspended.element.classList.remove('drawer-suspended');
    suspended = null;
  }

  function clearSuspendedDrawers() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    var list = document.querySelectorAll('.drawer.drawer-suspended');
    for (var i = 0; i < list.length; i += 1) {
      var el = list[i];
      if (el && el.classList) el.classList.remove('drawer-suspended');
    }
  }

  function ensureDrawer() {
    if (drawerInstance) return drawerInstance;
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    drawerInstance = window.app.drawer.createDrawer({
      drawerId: 'appConfirmDrawer',
      openButtons: [],
      closeButtons: ['appConfirmDrawerCancelBtn'],
      onClose: function() {
        resumeDrawer();
        if (hasDeferredResult && typeof resolveFn === 'function') resolveFn(deferredResult);
        else if (!resolved && typeof resolveFn === 'function') resolveFn({ ok: false, reason: 'close' });
        resolveFn = null;
        resolved = false;
        inputConfig = null;
        resolveAfterClose = false;
        deferredResult = null;
        hasDeferredResult = false;
        clearStatus();
      },
    });
    return drawerInstance;
  }

  function applyInputConfig(cfg) {
    inputConfig = cfg || null;
    if (!dom.inputRow) return;
    if (!inputConfig) {
      dom.inputRow.classList.add('hidden');
      if (dom.input) {
        dom.input.value = '';
        dom.input.placeholder = '请输入内容';
        dom.input.removeAttribute('maxlength');
        dom.input.type = 'text';
        dom.input.classList.remove('hidden');
      }
      if (dom.select) {
        dom.select.innerHTML = '';
        dom.select.classList.add('hidden');
      }
      return;
    }
    dom.inputRow.classList.remove('hidden');
    if (dom.inputLabel) {
      var labelText = inputConfig.label ? String(inputConfig.label) : '输入内容';
      if (dom.inputLabel.firstChild) {
        dom.inputLabel.firstChild.nodeValue = labelText;
      } else {
        dom.inputLabel.textContent = labelText;
      }
    }
    var useSelect = isSelectConfig(inputConfig);
    if (dom.input) dom.input.classList.toggle('hidden', useSelect);
    if (dom.select) dom.select.classList.toggle('hidden', !useSelect);
    if (useSelect) {
      if (dom.select) {
        dom.select.innerHTML = '';
        var options = Array.isArray(inputConfig.options) ? inputConfig.options : [];
        var placeholder = inputConfig.placeholder ? String(inputConfig.placeholder) : '';
        if (placeholder) {
          var placeholderOption = document.createElement('option');
          placeholderOption.value = '';
          placeholderOption.textContent = placeholder;
          dom.select.appendChild(placeholderOption);
        }
        for (var i = 0; i < options.length; i += 1) {
          var item = options[i];
          var optValue = '';
          var optLabel = '';
          var optDisabled = false;
          if (item && typeof item === 'object') {
            optValue = item.value !== undefined ? String(item.value) : '';
            optLabel = item.label !== undefined ? String(item.label) : optValue;
            optDisabled = item.disabled === true;
          } else {
            optValue = item !== undefined && item !== null ? String(item) : '';
            optLabel = optValue;
          }
          var optEl = document.createElement('option');
          optEl.value = optValue;
          optEl.textContent = optLabel;
          if (optDisabled) optEl.disabled = true;
          dom.select.appendChild(optEl);
        }
        dom.select.value = inputConfig.value ? String(inputConfig.value) : '';
      }
    } else if (dom.input) {
      dom.input.type = inputConfig.type ? String(inputConfig.type) : 'text';
      dom.input.placeholder = inputConfig.placeholder ? String(inputConfig.placeholder) : '请输入内容';
      dom.input.value = inputConfig.value ? String(inputConfig.value) : '';
      if (Number.isFinite(inputConfig.maxLength) && Number(inputConfig.maxLength) > 0) {
        dom.input.setAttribute('maxlength', String(Number(inputConfig.maxLength)));
      } else {
        dom.input.removeAttribute('maxlength');
      }
    }
  }

  function applyOptions(opts) {
    var options = opts || {};
    if (dom.title) dom.title.textContent = options.title ? String(options.title) : '确认操作';
    if (dom.message) dom.message.textContent = options.message ? String(options.message) : '';
    if (dom.hint) {
      var hintText = options.hint ? String(options.hint) : '';
      var hintType = options.hintType ? String(options.hintType) : '';
      dom.hint.textContent = hintText;
      dom.hint.className = ['hint', hintType, hintText ? '' : 'hidden'].filter(Boolean).join(' ');
    }
    if (dom.confirmBtn) {
      dom.confirmBtn.textContent = options.confirmText ? String(options.confirmText) : '确认';
      dom.confirmBtn.classList.toggle('danger', options.danger === true);
    }
    if (dom.cancelBtn) dom.cancelBtn.textContent = options.cancelText ? String(options.cancelText) : '取消';
    applyInputConfig(options.input || null);
    clearStatus();
  }

  function finalize(result) {
    if (resolved) return;
    resolved = true;
    if (resolveAfterClose) {
      deferredResult = result;
      hasDeferredResult = true;
      return;
    }
    if (typeof resolveFn === 'function') resolveFn(result);
    resolveFn = null;
  }

  function handleConfirm() {
    if (!drawerInstance || resolved) return;
    var payload = { ok: true };
    var useSelect = isSelectConfig(inputConfig);
    var inputEl = useSelect ? dom.select : dom.input;
    if (inputConfig && inputEl) {
      var raw = String(inputEl.value || '');
      var trimmed = raw.trim();
      if (inputConfig.required && !trimmed) {
        var labelText = inputConfig.label ? String(inputConfig.label) : '内容';
        var msg = inputConfig.requiredMessage ? String(inputConfig.requiredMessage) : ('请输入' + labelText);
        setStatus(msg, 'warn');
        inputEl.focus();
        return;
      }
      if (typeof inputConfig.validate === 'function') {
        var err = inputConfig.validate(trimmed, raw);
        if (err) {
          setStatus(String(err), 'warn');
          inputEl.focus();
          return;
        }
      }
      payload.value = trimmed;
      payload.rawValue = raw;
    }
    finalize(payload);
    drawerInstance.close();
  }

  function handleCancel() {
    if (resolved) return;
    finalize({ ok: false, reason: 'cancel' });
    if (drawerInstance) drawerInstance.close();
  }

  function open(options) {
    var drawer = ensureDrawer();
    if (!drawer) {
      var msg = options && options.message ? String(options.message) : '';
      var ok = true;
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        ok = window.confirm(msg);
      }
      return Promise.resolve({ ok: ok });
    }
    if (typeof resolveFn === 'function' && !resolved) {
      resolveFn({ ok: false, reason: 'replaced' });
    }
    resolved = false;
    resolveFn = null;
    resolveAfterClose = Boolean(options && options.resolveAfterClose === true);
    deferredResult = null;
    hasDeferredResult = false;
    // 清理上一次确认抽屉遗留的挂起状态，避免叠加导致页面不可操作。
    resumeDrawer();
    clearSuspendedDrawers();
    applyOptions(options);
    var prevDrawer = options && (options.previousDrawer || options.prevDrawer || options.drawer) ? (options.previousDrawer || options.prevDrawer || options.drawer) : null;
    suspended = suspendDrawer(prevDrawer);
    drawer.open();
    if (inputConfig) {
      setTimeout(function() {
        var useSelect = isSelectConfig(inputConfig);
        var inputEl = useSelect ? dom.select : dom.input;
        if (inputEl && typeof inputEl.focus === 'function') inputEl.focus({ preventScroll: true });
      }, 0);
    }
    return new Promise(function(resolve) {
      resolveFn = resolve;
    });
  }

  if (dom.confirmBtn) dom.confirmBtn.addEventListener('click', handleConfirm);
  if (dom.cancelBtn) dom.cancelBtn.addEventListener('click', handleCancel);

  window.app = window.app || {};
  window.app.confirmDrawer = {
    open: open,
    close: function() {
      if (drawerInstance) drawerInstance.close();
    },
  };
})();
