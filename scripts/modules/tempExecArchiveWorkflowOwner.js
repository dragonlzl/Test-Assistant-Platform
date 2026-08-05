(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecArchiveWorkflowOwner = api;
  }
})(function() {
  function summarizeArchiveCases(file, getCaseExecutionDisplay) {
    var counts = { pending: 0, failed: 0, blocked: 0, total: 0 };
    var cases = file && Array.isArray(file.cases) ? file.cases : [];
    counts.total = cases.length;
    cases.forEach(function(item) {
      var display = typeof getCaseExecutionDisplay === 'function'
        ? getCaseExecutionDisplay(file, item)
        : null;
      var status = display && display.label ? String(display.label || '').trim() : '';
      if (!status) status = '未执行';
      if (status === '通过' || status === '不适用') return;
      if (status === '失败') counts.failed += 1;
      else if (status === '阻塞') counts.blocked += 1;
      else counts.pending += 1;
    });
    return counts;
  }

  function buildArchiveReasonHint(counts) {
    var source = counts && typeof counts === 'object' ? counts : {};
    return '仍存在未通过用例（未执行 ' +
      (Number(source.pending) || 0) +
      ' / 失败 ' +
      (Number(source.failed) || 0) +
      ' / 阻塞 ' +
      (Number(source.blocked) || 0) +
      '），请填写归档原因后继续。';
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var browser = opts.window || (typeof window !== 'undefined' ? window : {});
    var document = opts.document || (browser && browser.document ? browser.document : null);
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var showOverview = typeof opts.showOverview === 'function' ? opts.showOverview : function() {};
    var getApiClient = typeof opts.getApiClient === 'function'
      ? opts.getApiClient
      : function() { return browser.app && browser.app.apiClient ? browser.app.apiClient : null; };
    var getConfirmDrawer = typeof opts.getConfirmDrawer === 'function'
      ? opts.getConfirmDrawer
      : function() { return browser.app && browser.app.confirmDrawer ? browser.app.confirmDrawer : null; };
    var showSuccessToast = typeof opts.showSuccessToast === 'function'
      ? opts.showSuccessToast
      : showArchiveSuccessToast;
    var drawerManager = opts.drawerManager || (browser.app && browser.app.drawer ? browser.app.drawer : null);
    var mainStatus = opts.mainStatus || null;
    var reasonHint = document ? document.getElementById('tempExecArchiveReasonHint') : null;
    var reasonInput = document ? document.getElementById('tempExecArchiveReasonInput') : null;
    var reasonConfirmButton = document ? document.getElementById('tempExecArchiveReasonConfirmBtn') : null;
    var reasonCancelButton = document ? document.getElementById('tempExecArchiveReasonCancelBtn') : null;
    var reasonStatus = document ? document.getElementById('tempExecArchiveReasonStatus') : null;
    var reasonContext = null;
    var reasonDrawer = drawerManager && typeof drawerManager.createDrawer === 'function'
      ? drawerManager.createDrawer({
        drawerId: 'tempExecArchiveReasonDrawer',
        closeButtons: ['closeTempExecArchiveReasonDrawerBtn'],
        onClose: handleReasonDrawerClose,
      })
      : null;

    function handleReasonDrawerClose() {
      if (reasonStatus) setStatus(reasonStatus, '', '');
      if (reasonInput && reasonInput.classList) reasonInput.classList.remove('input-invalid');
      if (reasonContext && reasonContext.resumeOverview && !reasonContext.submitting) {
        try { if (browser.app) browser.app.__drawerSkipRestoreOnce = true; } catch (error) {}
        showOverview();
      }
      reasonContext = null;
    }

    function openReasonDrawer(optionsValue) {
      var config = optionsValue && typeof optionsValue === 'object' ? optionsValue : {};
      if (!reasonDrawer || typeof reasonDrawer.open !== 'function') return false;
      if (drawerManager && typeof drawerManager.closeAllDrawers === 'function') {
        drawerManager.closeAllDrawers();
      }
      reasonContext = {
        execSetId: config.execSetId || '',
        fileId: config.fileId || '',
        client: config.client || null,
        payloadBase: config.payloadBase || {},
        resumeOverview: config.resumeOverview !== false,
        afterArchive: config.afterArchive || null,
        submitting: false,
      };
      if (reasonStatus) setStatus(reasonStatus, '', '');
      if (reasonInput) {
        if (reasonInput.classList) reasonInput.classList.remove('input-invalid');
        reasonInput.value = config.defaultValue || '';
      }
      if (reasonHint) {
        reasonHint.textContent = config.hintText ||
          '原则上归档前需全部执行通过；如仍有未通过/未执行用例，请填写归档原因后继续。';
      }
      if (reasonConfirmButton) reasonConfirmButton.disabled = false;
      if (reasonCancelButton) reasonCancelButton.disabled = false;
      reasonDrawer.open();
      try { if (reasonInput) reasonInput.focus(); } catch (error) {}
      return true;
    }

    function removeFocusAfterArchive(fileId) {
      if (!fileId) return;
      var id = String(fileId);
      var focusList = Array.isArray(state.tempExecFocus) ? state.tempExecFocus : [];
      if (!focusList.length) return;
      var next = focusList.filter(function(focusId) { return String(focusId) !== id; });
      if (next.length === focusList.length) return;
      state.tempExecFocus = next;
      if (typeof api.persistTempExecState === 'function') api.persistTempExecState();
      if (typeof api.saveTempExecFocus === 'function') api.saveTempExecFocus();
      if (typeof api.renderTempExecNav === 'function') api.renderTempExecNav();
      if (typeof api.renderTempVersionGrid === 'function') api.renderTempVersionGrid();
      if (typeof api.renderTempFocusZone === 'function') api.renderTempFocusZone();
    }

    function showArchiveSuccessToast() {
      if (!document || !document.body || typeof document.createElement !== 'function') return;
      try {
        var app = browser.app || {};
        browser.app = app;
        var key = '__tapArchiveSuccessToast';
        var store = app[key] && typeof app[key] === 'object' ? app[key] : {};
        if (store.timer) {
          clearTimeout(store.timer);
          store.timer = 0;
        }
        if (store.fadeTimer) {
          clearTimeout(store.fadeTimer);
          store.fadeTimer = 0;
        }
        if (store.el && store.el.parentNode) {
          try { store.el.parentNode.removeChild(store.el); } catch (removeError) {}
        }
        var element = document.createElement('div');
        element.className = 'temp-center-toast ok';
        element.textContent = '归档成功，可到 用例相关 -> 用例归档 -> 查看归档 内查看详情。';
        document.body.appendChild(element);
        store.el = element;
        store.timer = setTimeout(function() {
          if (!store.el) return;
          store.el.classList.add('fade-out');
          store.fadeTimer = setTimeout(function() {
            if (store.el && store.el.parentNode) {
              try { store.el.parentNode.removeChild(store.el); } catch (removeError) {}
            }
            store.el = null;
            store.timer = 0;
            store.fadeTimer = 0;
          }, 260);
        }, 3000);
        app[key] = store;
      } catch (error) {}
    }

    function finalizeArchive(optionsValue) {
      var config = optionsValue && typeof optionsValue === 'object' ? optionsValue : {};
      var resumeOverview = config.resumeOverview !== false;
      var afterArchive = typeof config.afterArchive === 'function' ? config.afterArchive : null;
      var loadPromise = null;
      try {
        if (typeof api.loadTempExecState === 'function') loadPromise = api.loadTempExecState();
      } catch (error) {
        loadPromise = null;
      }
      try {
        if (typeof api.renderTempExecOverview === 'function') api.renderTempExecOverview();
      } catch (error) {}
      if (resumeOverview) {
        try { showOverview(); } catch (error) {}
      }
      return Promise.resolve(loadPromise).then(function() {
        if (afterArchive) afterArchive();
      });
    }

    function completeArchive(fileId, optionsValue) {
      var config = optionsValue && typeof optionsValue === 'object' ? optionsValue : {};
      if (mainStatus) setStatus(mainStatus, '归档成功', 'ok');
      showSuccessToast();
      removeFocusAfterArchive(fileId);
      return finalizeArchive(config);
    }

    function requestArchive(fileForArchive, optionsValue) {
      var config = optionsValue && typeof optionsValue === 'object' ? optionsValue : {};
      if (!fileForArchive) {
        if (mainStatus) setStatus(mainStatus, '未找到要归档的用例', 'warn');
        return Promise.resolve(false);
      }
      if (fileForArchive._casesLoading) {
        if (mainStatus) setStatus(mainStatus, '用例加载中，请稍后再试', 'warn');
        return Promise.resolve(false);
      }
      var client = getApiClient();
      if (!client || typeof client.archiveExecSet !== 'function') {
        if (mainStatus) setStatus(mainStatus, '当前模式不支持归档（需启用 DB 后端）', 'warn');
        return Promise.resolve(false);
      }
      var execSetId = Number(config.execSetId || fileForArchive.execSetId || fileForArchive.id);
      if (!Number.isFinite(execSetId) || execSetId <= 0) {
        if (mainStatus) setStatus(mainStatus, '归档失败：执行集 ID 无效', 'err');
        return Promise.resolve(false);
      }
      var focusFileId = fileForArchive.id !== null && fileForArchive.id !== undefined
        ? String(fileForArchive.id)
        : '';
      var counts = summarizeArchiveCases(fileForArchive, api.getCaseExecutionDisplay);
      var payload = {};
      var completionOptions = {
        resumeOverview: config.resumeOverview !== false,
        afterArchive: typeof config.afterArchive === 'function' ? config.afterArchive : null,
      };

      function submitDirectArchive() {
        if (mainStatus) setStatus(mainStatus, '归档中...', '');
        return client.archiveExecSet(execSetId, payload)
          .then(function() {
            return completeArchive(focusFileId, completionOptions).then(function() { return true; });
          })
          .catch(function(error) {
            if (mainStatus) setStatus(mainStatus, error && error.message ? error.message : '归档失败', 'err');
            return false;
          });
      }

      if (counts.failed || counts.blocked || counts.pending) {
        openReasonDrawer({
          execSetId: execSetId,
          fileId: focusFileId,
          client: client,
          payloadBase: payload,
          resumeOverview: completionOptions.resumeOverview,
          hintText: buildArchiveReasonHint(counts),
          afterArchive: completionOptions.afterArchive,
        });
        return Promise.resolve(false);
      }
      if (counts.total > 0) {
        var confirmDrawer = getConfirmDrawer();
        var confirmMessage = '用例已全部执行通过（或通过+不适用），归档后无法更改测试结果，是否确认归档？';
        if (confirmDrawer && typeof confirmDrawer.open === 'function') {
          return confirmDrawer.open({
            title: '确认归档',
            message: confirmMessage,
            confirmText: '确认归档',
            cancelText: '取消',
            danger: true,
          }).then(function(result) {
            if (!result || !result.ok) return false;
            return submitDirectArchive();
          });
        }
        var confirmed = true;
        if (browser && typeof browser.confirm === 'function') confirmed = browser.confirm(confirmMessage);
        if (!confirmed) return Promise.resolve(false);
      }
      return submitDirectArchive();
    }

    function submitReason() {
      if (!reasonContext) return Promise.resolve(false);
      var context = reasonContext;
      var client = context.client;
      if (!client || typeof client.archiveExecSet !== 'function') {
        if (reasonStatus) setStatus(reasonStatus, '当前模式不支持归档（需启用 DB 后端）', 'warn');
        return Promise.resolve(false);
      }
      var execSetId = Number(context.execSetId);
      if (!Number.isFinite(execSetId) || execSetId <= 0) {
        if (reasonStatus) setStatus(reasonStatus, '归档失败：执行集 ID 无效', 'err');
        return Promise.resolve(false);
      }
      var reason = reasonInput ? String(reasonInput.value || '').trim() : '';
      if (!reason) {
        if (reasonStatus) setStatus(reasonStatus, '归档原因不能为空', 'warn');
        if (reasonInput && reasonInput.classList) reasonInput.classList.add('input-invalid');
        try { if (reasonInput) reasonInput.focus(); } catch (error) {}
        return Promise.resolve(false);
      }
      if (reasonInput && reasonInput.classList) reasonInput.classList.remove('input-invalid');
      var payload = Object.assign({}, context.payloadBase || {});
      payload.reason = reason;
      context.submitting = true;
      if (reasonConfirmButton) reasonConfirmButton.disabled = true;
      if (reasonCancelButton) reasonCancelButton.disabled = true;
      if (reasonStatus) setStatus(reasonStatus, '归档中...', '');
      if (mainStatus) setStatus(mainStatus, '归档中...', '');
      return client.archiveExecSet(execSetId, payload)
        .then(function() {
          if (mainStatus) setStatus(mainStatus, '归档成功', 'ok');
          showSuccessToast();
          if (context.fileId) removeFocusAfterArchive(context.fileId);
          context.submitting = false;
          var completionOptions = {
            resumeOverview: context.resumeOverview !== false,
            afterArchive: typeof context.afterArchive === 'function' ? context.afterArchive : null,
          };
          try {
            if (reasonDrawer && typeof reasonDrawer.close === 'function') reasonDrawer.close();
          } catch (error) {}
          try { if (browser.app) browser.app.__drawerSkipRestoreOnce = true; } catch (error) {}
          return finalizeArchive(completionOptions).then(function() { return true; });
        })
        .catch(function(error) {
          context.submitting = false;
          if (reasonConfirmButton) reasonConfirmButton.disabled = false;
          if (reasonCancelButton) reasonCancelButton.disabled = false;
          if (reasonStatus) {
            setStatus(reasonStatus, error && error.message ? error.message : '归档失败，请重试或取消', 'err');
          }
          return false;
        });
    }

    function cancelReason() {
      if (reasonContext) reasonContext.submitting = false;
      if (reasonDrawer && typeof reasonDrawer.close === 'function') reasonDrawer.close();
    }

    if (reasonConfirmButton && typeof reasonConfirmButton.addEventListener === 'function') {
      reasonConfirmButton.addEventListener('click', function() { submitReason(); });
    }
    if (reasonCancelButton && typeof reasonCancelButton.addEventListener === 'function') {
      reasonCancelButton.addEventListener('click', cancelReason);
    }

    return {
      getDrawer: function() { return reasonDrawer; },
      getContext: function() { return reasonContext; },
      openReasonDrawer: openReasonDrawer,
      requestArchive: requestArchive,
      submitReason: submitReason,
      cancelReason: cancelReason,
      finalizeArchive: finalizeArchive,
    };
  }

  return {
    create: create,
    summarizeArchiveCases: summarizeArchiveCases,
    buildArchiveReasonHint: buildArchiveReasonHint,
  };
});
