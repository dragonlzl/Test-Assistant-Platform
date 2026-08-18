(function() {
  function createManager(factory, options) {
    if (typeof factory !== 'function') return null;
    return factory(options || {}) || null;
  }

  function exposeManagers(managers) {
    window.app = window.app || {};
    window.app.missingReminderAi = managers.missingReminder;
    window.app.caseLibraryAiGen = managers.casePageGeneration;
    window.app.xmindCaseGenTaskManager = managers.xmindGeneration;
  }

  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var factories = ctx.factories || {};
    var clients = ctx.clients || {};

    var managers = {
      missingReminder: createManager(factories.missingReminder, {
        utils: ctx.utils || {},
        callModelWithConfig: clients.callModelWithConfig,
      }),
      casePageGeneration: createManager(factories.casePageGeneration, {
        utils: ctx.utils || {},
        callModelWithConfig: clients.callModelWithConfig,
      }),
      xmindGeneration: createManager(factories.xmindGeneration, {
        callModelWithConfig: clients.callModelWithConfig,
        callModelWithContent: clients.callModelWithContent,
        abortRequestsByOwner: clients.abortRequestsByOwner,
        getTimeoutSec: clients.getTimeoutSec,
        requestSchedulerCore: ctx.requestSchedulerCore || null,
      }),
    };

    exposeManagers(managers);

    if (managers.casePageGeneration && typeof managers.casePageGeneration.resumeTasks === 'function') {
      managers.casePageGeneration.resumeTasks({ force: true });
    }

    function shouldResumeMissingReminder() {
      return Boolean(state && state.settings && state.settings.missingCaseReminderAiEnabled === 'on');
    }

    function syncMissingReminderTasks() {
      var manager = managers.missingReminder;
      if (!manager || typeof manager.resumeTasks !== 'function') return;
      if (!shouldResumeMissingReminder()) {
        if (typeof manager.clearTask === 'function') {
          manager.clearTask('case-library');
          manager.clearTask('temp-exec');
        }
        return;
      }
      manager.resumeTasks({ force: true });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('app-settings-loaded', syncMissingReminderTasks);
      window.addEventListener('app-settings-updated', function(e) {
        var detail = e && e.detail ? e.detail : null;
        var keys = detail && Array.isArray(detail.keys) ? detail.keys : [];
        if (!keys.length || keys.indexOf('missingCaseReminderAiEnabled') !== -1) {
          syncMissingReminderTasks();
        }
      });
    }
    if (window.app && window.app.settingsReady === true) {
      syncMissingReminderTasks();
    }

    function interruptXmindGeneration(reasonText) {
      var manager = managers.xmindGeneration;
      if (!manager || typeof manager.cancelAllRunning !== 'function') return false;
      var reason = reasonText ? String(reasonText) : '已中断当前 XMind 生成任务';
      return manager.cancelAllRunning({
        reason: reason,
        abortReason: 'xmind-casegen-interrupted',
      }) > 0;
    }

    function buildXmindModuleContext(input) {
      var source = input || {};
      return {
        state: source.state || state,
        config: source.config || (window.app && window.app.config) || {},
        utils: source.utils || ctx.utils || {},
        core: source.core || {},
        tempExecApi: source.tempExecApi || {},
        casesGenApi: source.casesGenApi || {},
        prepApi: {
          interruptActiveExecutions: source.interruptXmindGeneration || interruptXmindGeneration,
        },
        xmindGenApi: {
          callModelWithConfig: clients.callModelWithConfig,
          callModelWithContent: clients.callModelWithContent,
          getAssignedModel: source.getAssignedModel,
          getReasoningForType: source.getReasoningForType,
          getTemperatureForType: source.getTemperatureForType,
          taskManager: managers.xmindGeneration,
          saveAssignments: source.saveAssignments,
          renderAssignmentsSelect: source.renderAssignmentsSelect,
          updateAssignmentStatuses: source.updateAssignmentStatuses,
          deriveCaseListFromText: source.deriveCaseListFromText,
          parseCaseList: source.parseCaseList,
          getCombinedCaseList: source.getCombinedCaseList,
          getCombinedCaseText: source.getCombinedCaseText,
          hasCaseSource: source.hasCaseSource,
        },
        xmindCoreApi: source.xmindCoreApi || null,
        xmindMarkdownExportCoreApi: source.xmindMarkdownExportCoreApi || null,
        mindElixirCoreApi: source.mindElixirCoreApi || null,
        casesCoreApi: source.casesCoreApi || null,
        xmindKnowledgeBaseApi: source.xmindKnowledgeBaseApi || null,
        casePageAiGenPrepApi: source.casePageAiGenPrepApi || null,
        generationManagers: managers,
      };
    }

    return {
      managers: managers,
      syncMissingReminderTasks: syncMissingReminderTasks,
      interruptXmindGeneration: interruptXmindGeneration,
      buildXmindModuleContext: buildXmindModuleContext,
    };
  }

  window.app = window.app || {};
  window.app.retainedGenerationRuntime = { init: init };
})();
