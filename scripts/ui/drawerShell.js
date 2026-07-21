(function() {
  var activeController = null;
  var holders = {};
  var lockedScrollTop = 0;
  var scrollListenersAttached = false;
  var passiveFalse = { passive: false };

  function holderCount() {
    return Object.keys(holders).length;
  }

  function isInOpenDrawer(target) {
    var node = target;
    while (node) {
      if (node.classList && node.classList.contains('drawer')) {
        return node.classList.contains('open') || node.classList.contains('closing');
      }
      node = node.parentNode;
    }
    return false;
  }

  function preventScrollIfOutsideDrawer(event) {
    if (!event || isInOpenDrawer(event.target)) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  function preventKeyScroll(event) {
    if (!event || isInOpenDrawer(event.target)) return;
    var keys = [' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'];
    if (keys.indexOf(event.key) === -1) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  function attachScrollListeners() {
    if (scrollListenersAttached) return;
    window.addEventListener('wheel', preventScrollIfOutsideDrawer, passiveFalse);
    window.addEventListener('touchmove', preventScrollIfOutsideDrawer, passiveFalse);
    window.addEventListener('keydown', preventKeyScroll, true);
    scrollListenersAttached = true;
  }

  function detachScrollListeners() {
    if (!scrollListenersAttached) return;
    window.removeEventListener('wheel', preventScrollIfOutsideDrawer, passiveFalse);
    window.removeEventListener('touchmove', preventScrollIfOutsideDrawer, passiveFalse);
    window.removeEventListener('keydown', preventKeyScroll, true);
    scrollListenersAttached = false;
  }

  function addLockedClasses() {
    if (document.body && document.body.classList) document.body.classList.add('drawer-open');
    if (document.documentElement && document.documentElement.classList) document.documentElement.classList.add('drawer-open');
  }

  function removeLockedClasses() {
    if (document.body && document.body.classList) document.body.classList.remove('drawer-open');
    if (document.documentElement && document.documentElement.classList) document.documentElement.classList.remove('drawer-open');
  }

  function restoreScrollPosition() {
    var targetTop = lockedScrollTop || 0;
    var skipRestore = false;
    var overrideTop = null;
    try {
      window.app = window.app || {};
      if (window.app.__drawerSkipRestoreOnce) {
        skipRestore = true;
        window.app.__drawerSkipRestoreOnce = false;
      } else if (typeof window.app.__drawerRestoreScrollTopOnce === 'number') {
        overrideTop = window.app.__drawerRestoreScrollTopOnce;
        window.app.__drawerRestoreScrollTopOnce = null;
      }
    } catch (error) {
      // Ignore unavailable compatibility state.
    }
    lockedScrollTop = 0;
    if (!skipRestore && typeof window.scrollTo === 'function') {
      window.scrollTo(0, overrideTop !== null && overrideTop !== undefined ? overrideTop : targetTop);
    }
  }

  var scrollLock = {
    acquire: function(drawerId) {
      var id = String(drawerId || '').trim();
      if (!id || holders[id]) return holderCount();
      if (!holderCount()) {
        lockedScrollTop = typeof window.scrollY === 'number'
          ? window.scrollY
          : ((document.documentElement && document.documentElement.scrollTop) || 0);
        attachScrollListeners();
      }
      holders[id] = true;
      addLockedClasses();
      return holderCount();
    },
    release: function(drawerId) {
      var id = String(drawerId || '').trim();
      if (!id || !holders[id]) return holderCount();
      delete holders[id];
      if (!holderCount()) {
        detachScrollListeners();
        removeLockedClasses();
        restoreScrollPosition();
      }
      return holderCount();
    },
    count: holderCount,
    has: function(drawerId) {
      return Boolean(holders[String(drawerId || '')]);
    },
    releaseAll: function() {
      holders = {};
      detachScrollListeners();
      removeLockedClasses();
      lockedScrollTop = 0;
      return 0;
    },
  };

  function inferKind(drawer) {
    var id = String(drawer.id || '').toLowerCase();
    if (id.indexOf('xmind') >= 0 || drawer.querySelector('.drawer-panel-xmind')) return 'canvas';
    if (id.indexOf('diff') >= 0 || drawer.querySelector('.diff-table')) return 'diff';
    if (drawer.querySelector('table, .admin-table-wrapper, [data-vtable-id]')) return 'table';
    if (drawer.querySelector('form, .form-row, textarea, input:not([type="hidden"])')) return 'form';
    return 'detail';
  }

  function emitResize(reason, drawer) {
    if (typeof CustomEvent !== 'function') return;
    document.dispatchEvent(new CustomEvent('tap:layout-resize', {
      detail: {
        source: 'drawer',
        reason: reason || 'resize',
        drawerId: drawer && drawer.id ? drawer.id : '',
      },
    }));
  }

  var fullscreen = {
    is: function(drawer) {
      return Boolean(drawer && drawer.classList && (
        drawer.classList.contains('tap-drawer-fullscreen') ||
        drawer.classList.contains('xmind-drawer-fullscreen')
      ));
    },
    set: function(drawer, enabled) {
      if (!drawer || !drawer.classList) return false;
      var next = enabled === true;
      drawer.classList.toggle('tap-drawer-fullscreen', next);
      var kind = drawer.getAttribute('data-drawer-kind') || inferKind(drawer);
      if (kind === 'canvas' || drawer.classList.contains('xmind-drawer-fullscreen')) {
        drawer.classList.toggle('xmind-drawer-fullscreen', next);
      }
      var button = drawer.querySelector('.tap-drawer-fullscreen-toggle');
      if (button) {
        button.setAttribute('aria-pressed', next ? 'true' : 'false');
        button.title = next ? '退出全屏' : '全屏';
        button.setAttribute('aria-label', button.title);
      }
      emitResize(next ? 'fullscreen-enter' : 'fullscreen-exit', drawer);
      if (typeof CustomEvent === 'function') {
        drawer.dispatchEvent(new CustomEvent('tap:drawer-fullscreen-change', {
          bubbles: true,
          detail: { fullscreen: next },
        }));
      }
      return next;
    },
    toggle: function(drawer) {
      return fullscreen.set(drawer, !fullscreen.is(drawer));
    },
  };

  function init() {
    if (activeController) return activeController;
    var destroyed = false;
    var rootObserver = null;
    var resizeTimer = 0;
    var openStack = [];
    var decorated = [];

    function scheduleResize(reason, drawer) {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function() {
        resizeTimer = 0;
        emitResize(reason, drawer);
      }, 240);
    }

    function removeFromOpenStack(drawer) {
      openStack = openStack.filter(function(item) { return item !== drawer; });
    }

    function syncDrawerState(drawer) {
      if (!drawer || !drawer.classList || !drawer.id) return;
      if (!drawer.classList.contains('drawer') &&
        drawer.getAttribute('data-drawer-shell') !== '1') return;
      var open = drawer.classList.contains('open');
      var closing = drawer.classList.contains('closing');
      if (open || closing) scrollLock.acquire(drawer.id);
      else scrollLock.release(drawer.id);
      if (open) {
        removeFromOpenStack(drawer);
        openStack.push(drawer);
        scheduleResize('open', drawer);
      } else if (!closing) {
        removeFromOpenStack(drawer);
        if (fullscreen.is(drawer)) fullscreen.set(drawer, false);
      }
    }

    function addFullscreenControl(drawer, kind) {
      if (kind !== 'table' && kind !== 'diff') return null;
      var header = drawer.querySelector('.drawer-header');
      if (!header || header.querySelector('.tap-drawer-fullscreen-toggle')) return null;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'tap-drawer-fullscreen-toggle';
      button.textContent = '[]';
      button.title = '全屏';
      button.setAttribute('aria-label', '全屏');
      button.setAttribute('aria-pressed', 'false');
      var close = header.querySelector('[data-drawer-close]');
      if (close) header.insertBefore(button, close);
      else header.appendChild(button);
      var handler = function() { fullscreen.toggle(drawer); };
      button.addEventListener('click', handler);
      return { button: button, handler: handler };
    }

    function decorate(drawer) {
      if (!drawer || drawer.getAttribute('data-drawer-shell') === '1') {
        if (drawer) syncDrawerState(drawer);
        return;
      }
      var kind = inferKind(drawer);
      drawer.setAttribute('data-drawer-shell', '1');
      drawer.setAttribute('data-drawer-kind', kind);
      var header = drawer.querySelector('.drawer-header');
      if (header) {
        var close = header.querySelector('[data-drawer-close]');
        if (close) {
          close.classList.add('tap-drawer-close');
          close.textContent = 'x';
          close.title = '关闭';
          close.setAttribute('aria-label', '关闭');
        }
      }
      decorated.push({ drawer: drawer, fullscreenControl: addFullscreenControl(drawer, kind) });
      syncDrawerState(drawer);
    }

    function decorateAll(root) {
      var scope = root && root.querySelectorAll ? root : document;
      if (scope.classList && scope.classList.contains('drawer')) decorate(scope);
      Array.prototype.slice.call(scope.querySelectorAll('.drawer')).forEach(decorate);
    }

    function getTopOpenDrawer() {
      for (var index = openStack.length - 1; index >= 0; index -= 1) {
        var drawer = openStack[index];
        if (drawer && drawer.isConnected && drawer.classList.contains('open')) return drawer;
      }
      return null;
    }

    function closeTopDrawer() {
      var drawer = getTopOpenDrawer();
      if (!drawer) return false;
      if (fullscreen.is(drawer)) {
        fullscreen.set(drawer, false);
        return true;
      }
      var close = drawer.querySelector('[data-drawer-close]') || drawer.querySelector('.drawer-mask');
      if (!close || typeof close.click !== 'function') return false;
      close.click();
      return true;
    }

    function handleKeydown(event) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (closeTopDrawer()) event.preventDefault();
    }

    function handleResize() {
      scheduleResize('viewport', getTopOpenDrawer());
    }

    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', handleResize);
    decorateAll(document);

    if (typeof MutationObserver === 'function') {
      rootObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes') {
            var target = mutation.target;
            if (target && target.classList && (
              target.classList.contains('drawer') ||
              target.getAttribute('data-drawer-shell') === '1'
            )) {
              syncDrawerState(target);
            }
            return;
          }
          Array.prototype.slice.call(mutation.addedNodes || []).forEach(function(node) {
            if (node && node.nodeType === 1) decorateAll(node);
          });
        });
      });
      rootObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (resizeTimer) window.clearTimeout(resizeTimer);
      if (rootObserver) rootObserver.disconnect();
      document.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', handleResize);
      decorated.forEach(function(entry) {
        var control = entry.fullscreenControl;
        if (control && control.button) {
          control.button.removeEventListener('click', control.handler);
          if (control.button.parentNode) control.button.parentNode.removeChild(control.button);
        }
        if (entry.drawer && entry.drawer.classList) {
          entry.drawer.classList.remove('tap-drawer-fullscreen');
          entry.drawer.classList.remove('xmind-drawer-fullscreen');
          entry.drawer.removeAttribute('data-drawer-shell');
          entry.drawer.removeAttribute('data-drawer-kind');
        }
      });
      decorated = [];
      openStack = [];
      scrollLock.releaseAll();
      if (window.app && window.app.ui && window.app.ui.drawers === activeController) {
        window.app.ui.drawers = null;
      }
      activeController = null;
    }

    activeController = {
      decorate: decorate,
      resizeTables: function() { emitResize('manual', getTopOpenDrawer()); },
      closeTopDrawer: closeTopDrawer,
      getTopOpenDrawer: getTopOpenDrawer,
      destroy: destroy,
    };
    return activeController;
  }

  function destroy() {
    if (activeController) activeController.destroy();
    else scrollLock.releaseAll();
  }

  window.app = window.app || {};
  window.app.ui = window.app.ui || {};
  window.app.ui.DrawerShell = {
    init: init,
    destroy: destroy,
    get: function() { return activeController; },
    scrollLock: scrollLock,
    fullscreen: fullscreen,
  };
})();
