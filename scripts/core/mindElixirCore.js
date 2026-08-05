(function() {
  function init(deps) {
    var xmindApi = deps && deps.xmindApi
      ? deps.xmindApi
      : (window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null);
    var dataModelOwner = deps && deps.dataModelOwner
      ? deps.dataModelOwner
      : (window.app && window.app.mindElixirDataModel
          ? window.app.mindElixirDataModel
          : null);
    var sessionStoreOwner = deps && deps.sessionStoreOwner
      ? deps.sessionStoreOwner
      : (window.app && window.app.mindElixirSessionStore
          ? window.app.mindElixirSessionStore
          : null);
    var themeOwner = deps && deps.themeOwner
      ? deps.themeOwner
      : (window.app && window.app.mindElixirThemeOwner
          ? window.app.mindElixirThemeOwner
          : null);
    var uiBridgeOwner = deps && deps.uiBridgeOwner
      ? deps.uiBridgeOwner
      : (window.app && window.app.mindElixirUiBridge
          ? window.app.mindElixirUiBridge
          : null);
    var renderPolicyCore = deps && deps.renderPolicyCore
      ? deps.renderPolicyCore
      : (window.app && window.app.xmindRenderPolicyCore ? window.app.xmindRenderPolicyCore : null);
    var viewportControllerOwner = deps && deps.viewportControllerOwner
      ? deps.viewportControllerOwner
      : (window.app && window.app.mindElixirViewportController
          ? window.app.mindElixirViewportController
          : null);
    var searchControllerOwner = deps && deps.searchControllerOwner
      ? deps.searchControllerOwner
      : (window.app && window.app.mindElixirSearchController
          ? window.app.mindElixirSearchController
          : null);
    var selectionModelOwner = deps && deps.selectionModelOwner
      ? deps.selectionModelOwner
      : (window.app && window.app.mindElixirSelectionModel
          ? window.app.mindElixirSelectionModel
          : null);
    var selectionControllerOwner = deps && deps.selectionControllerOwner
      ? deps.selectionControllerOwner
      : (window.app && window.app.mindElixirSelectionController
          ? window.app.mindElixirSelectionController
          : null);
    var dragControllerOwner = deps && deps.dragControllerOwner
      ? deps.dragControllerOwner
      : (window.app && window.app.mindElixirDragController
          ? window.app.mindElixirDragController
          : null);
    var editInputControllerOwner = deps && deps.editInputControllerOwner
      ? deps.editInputControllerOwner
      : (window.app && window.app.mindElixirEditInputController
          ? window.app.mindElixirEditInputController
          : null);
    var editActionPolicyOwner = deps && deps.editActionPolicyOwner
      ? deps.editActionPolicyOwner
      : (window.app && window.app.mindElixirEditActionPolicy
          ? window.app.mindElixirEditActionPolicy
          : null);
    var historyModelOwner = deps && deps.historyModelOwner
      ? deps.historyModelOwner
      : (window.app && window.app.mindElixirHistoryModel
          ? window.app.mindElixirHistoryModel
          : null);
    var clipboardControllerOwner = deps && deps.clipboardControllerOwner
      ? deps.clipboardControllerOwner
      : (window.app && window.app.mindElixirClipboardController
          ? window.app.mindElixirClipboardController
          : null);
    if (!dataModelOwner || typeof dataModelOwner.create !== 'function') {
      throw new Error('MindElixir 数据模型未就绪');
    }
    if (!sessionStoreOwner || typeof sessionStoreOwner.create !== 'function') {
      throw new Error('MindElixir 会话存储未就绪');
    }
    if (!themeOwner || typeof themeOwner.create !== 'function') {
      throw new Error('MindElixir 主题模块未就绪');
    }
    if (!uiBridgeOwner || typeof uiBridgeOwner.create !== 'function') {
      throw new Error('MindElixir UI 桥接未就绪');
    }
    if (!viewportControllerOwner || typeof viewportControllerOwner.create !== 'function') {
      throw new Error('MindElixir 视口控制器未就绪');
    }
    if (!searchControllerOwner || typeof searchControllerOwner.create !== 'function') {
      throw new Error('MindElixir 搜索控制器未就绪');
    }
    if (!selectionModelOwner || typeof selectionModelOwner.create !== 'function') {
      throw new Error('MindElixir 选择模型未就绪');
    }
    if (!selectionControllerOwner || typeof selectionControllerOwner.create !== 'function') {
      throw new Error('MindElixir 选择控制器未就绪');
    }
    if (!dragControllerOwner || typeof dragControllerOwner.create !== 'function') {
      throw new Error('MindElixir 拖拽控制器未就绪');
    }
    if (!editInputControllerOwner || typeof editInputControllerOwner.create !== 'function') {
      throw new Error('MindElixir 编辑输入控制器未就绪');
    }
    if (!editActionPolicyOwner || typeof editActionPolicyOwner.create !== 'function') {
      throw new Error('MindElixir 编辑动作策略未就绪');
    }
    if (!historyModelOwner || typeof historyModelOwner.create !== 'function') {
      throw new Error('MindElixir 历史模型未就绪');
    }
    if (!clipboardControllerOwner || typeof clipboardControllerOwner.create !== 'function') {
      throw new Error('MindElixir 剪贴板控制器未就绪');
    }
    var drawerFullscreenPort = window.app && window.app.ui && window.app.ui.DrawerShell
      ? window.app.ui.DrawerShell.fullscreen
      : null;
    var defaultScaleStep = 0.15;
    var minScale = 0.1;
    var maxScale = 2.5;
    var dataModel = dataModelOwner.create({ xmindApi: xmindApi });
    var sessionStore = sessionStoreOwner.create({});
    var themeApi = themeOwner.create({ ctor: getMindCtor() });
    var uiBridge = uiBridgeOwner.create({});
    var editActionPolicy = editActionPolicyOwner.create({
      getNodeParent: function(node) {
        return node && node.nodeObj ? node.nodeObj.parent || null : null;
      },
    });
    var generateNodeId = dataModel.generateNodeId;
    var createNode = dataModel.createNode;
    var buildPathsFromCases = dataModel.buildPathsFromCases;
    var buildMindDataFromCases = dataModel.buildMindDataFromCases;
    var buildMindDataFromPaths = dataModel.buildMindDataFromPaths;
    var cloneMindDataObject = dataModel.cloneMindDataObject;
    var readMindDataFromInstance = dataModel.readMindDataFromInstance;
    var buildMindDataSignature = dataModel.buildMindDataSignature;
    var historyModel = historyModelOwner.create({
      cloneData: cloneMindDataObject,
      getSignature: buildMindDataSignature,
    });
    var buildMindNodeMeta = dataModel.buildNodeMeta;
    var normalizeMindTopic = dataModel.normalizeMindTopic;
    var isMindElixirInternalClipboardText = dataModel.isMindElixirInternalClipboardText;
    var parseIndentedTextToMindData = dataModel.parseIndentedTextToMindData;
    var normalizeClipboardPlainNodeTopic = dataModel.normalizeClipboardPlainNodeTopic;
    var cloneMindNodeTree = dataModel.cloneMindNodeTree;
    var calculateCaseChangeSummary = dataModel.calculateCaseChangeSummary;
    var validateMindDataCases = dataModel.validateMindDataCases;
    var readMindEditSession = sessionStore.read;
    var writeMindEditSession = sessionStore.write;
    var clearMindEditSession = sessionStore.clear;
    var buildTheme = themeApi.buildTheme;
    var resolveDarkMode = themeApi.resolveDarkMode;
    var syncDetachedGhostTheme = themeApi.syncDetachedGhostTheme;
    var openMindConfirmDrawer = uiBridge.openConfirmDrawer;
    var showMindToast = uiBridge.showToast;
    var resolveScale = viewportControllerOwner.resolveScale;
    var updateViewerDragState = viewportControllerOwner.updateViewerDragState;
    var parseMindTransformState = viewportControllerOwner.parseTransformState;
    var writeMindTransformState = viewportControllerOwner.writeTransformState;

    function getRenderPolicyCore() {
      if (renderPolicyCore) return renderPolicyCore;
      if (window.app && window.app.xmindRenderPolicyCore) {
        renderPolicyCore = window.app.xmindRenderPolicyCore;
      }
      return renderPolicyCore;
    }
    var activeContextMenuHider = function() {};

    function forceHideAllNodeContextMenus() {
      if (typeof document === 'undefined' || !document || typeof document.querySelectorAll !== 'function') return;
      var menus = document.querySelectorAll('.xmind-node-context-menu');
      if (!menus || !menus.length) return;
      Array.prototype.forEach.call(menus, function(menu) {
        if (!menu || !menu.classList) return;
        menu.classList.remove('is-open');
        if (menu.setAttribute) menu.setAttribute('aria-hidden', 'true');
      });
    }

    function hideOpenContextMenu() {
      try {
        activeContextMenuHider();
      } catch (err) {
        activeContextMenuHider = function() {};
      }
      forceHideAllNodeContextMenus();
    }

    function getMindCtor() {
      var source = null;
      if (typeof MindElixir !== 'undefined') {
        source = MindElixir;
      } else if (typeof window !== 'undefined' && window && window.MindElixir) {
        source = window.MindElixir;
      }
      if (!source) return null;
      if (typeof source === 'function') return source;
      if (source && typeof source.default === 'function') return source.default;
      return null;
    }

    function normalizeDirection(raw, ctor) {
      var name = String(raw || '').toLowerCase();
      if (name === 'left') return ctor.LEFT;
      if (name === 'right') return ctor.RIGHT;
      return ctor.SIDE;
    }

    function buildMindChangeConfirmMessage(summary, suffix) {
      var meta = summary && typeof summary === 'object' ? summary : {};
      var modified = Number(meta.modified || 0);
      var added = Number(meta.added || 0);
      var deleted = Number(meta.deleted || 0);
      if (!isFinite(modified) || modified < 0) modified = 0;
      if (!isFinite(added) || added < 0) added = 0;
      if (!isFinite(deleted) || deleted < 0) deleted = 0;
      return '修改' + modified + '条、新增' + added + '条、删除' + deleted + '条，' + String(suffix || '确认继续吗？');
    }

    function detachMindDragGhost(instance) {
      if (!instance || !instance.container || !instance.container.querySelectorAll) return;
      if (typeof document === 'undefined' || !document || !document.body || !document.body.appendChild) return;
      var list = instance.container.querySelectorAll('.mind-elixir-ghost');
      if (!list || !list.length) return;
      var detached = Array.isArray(instance.__tapDetachedNodes) ? instance.__tapDetachedNodes : [];
      Array.prototype.forEach.call(list, function(ghostEl) {
        if (!ghostEl) return;
        if (ghostEl.classList) ghostEl.classList.add('xmind-floating-ghost');
        syncDetachedGhostTheme(ghostEl, instance);
        try {
          document.body.appendChild(ghostEl);
          detached.push(ghostEl);
        } catch (err) {
          // ignore
        }
      });
      instance.__tapDetachedNodes = detached;
    }

    function findMindNodeElement(instance, nodeId) {
      if (!instance || !nodeId || typeof instance.findEle !== 'function') return null;
      try {
        return instance.findEle(String(nodeId));
      } catch (err) {
        return null;
      }
    }

    function bindViewerInteractions(viewerEl, canvasEl, instance, options) {
      if (!viewerEl || !canvasEl || !instance) return null;

      var opts = options || {};
      if (viewerEl.setAttribute && !viewerEl.getAttribute('tabindex')) {
        viewerEl.setAttribute('tabindex', '0');
      }
      var controlsEl = viewerEl.querySelector ? viewerEl.querySelector('[data-mind-controls]') : null;
      var editEnterBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="edit-enter"]')
        : null;
      var editCancelBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="edit-cancel"]')
        : null;
      var editSaveBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="edit-save"]')
        : null;
      var editAddBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="node-add"]')
        : null;
      var editDeleteBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="node-delete"]')
        : null;
      var editUndoBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="undo"]')
        : null;
      var editRedoBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="redo"]')
        : null;
      var fullscreenToggleBtn = controlsEl && controlsEl.querySelector
        ? controlsEl.querySelector('[data-mind-action="drawer-fullscreen"]')
        : null;

      var editableSessionKey = opts && opts.editableSessionKey ? String(opts.editableSessionKey) : '';
      var restoredSession = opts && opts.restoredSession && typeof opts.restoredSession === 'object'
        ? opts.restoredSession
        : null;
      var restoreNoticeSignature = opts && opts.restoreNoticeSignature
        ? String(opts.restoreNoticeSignature)
        : '';
      var allowEdit = !(opts && opts.allowEdit === false);
      var editing = allowEdit && opts && opts.initialEditing === true;
      var pendingSave = false;
      var applyingHistory = false;
      var recordTimer = 0;
      var baseMindData = cloneMindDataObject(opts && opts.baseMindData)
        || cloneMindDataObject(opts && opts.initialMindData)
        || readMindDataFromInstance(instance)
        || null;

      var historyEntries = [];
      var historyIndex = -1;

      var viewportController = null;
      var searchController = null;
      var selectionController = null;
      var dragController = null;
      var editInputController = null;
      var clipboardController = null;
      var exportState = {
        pending: false,
      };

      function focusViewerForKeyboard() {
        var inst = getInstance();
        var focusEl = inst && inst.container && typeof inst.container.focus === 'function'
          ? inst.container
          : viewerEl;
        if (!focusEl || typeof focusEl.focus !== 'function') return;
        try {
          focusEl.focus({ preventScroll: true });
        } catch (err) {
          try {
            focusEl.focus();
          } catch (err2) {
            // ignore
          }
        }
      }

      var enableCustomBoxSelection = Boolean(opts && opts.enableCustomBoxSelection === true);
      var nodeContextMenuEl = null;
      var nodeContextMenuMeta = null;
      var nodeDecorateTimer = 0;
      var nodeDecorateObserver = null;
      var nodeDecorationApplying = false;
      var drawerEl = viewerEl && typeof viewerEl.closest === 'function' ? viewerEl.closest('.drawer') : null;
      var drawerPanelEl = viewerEl && typeof viewerEl.closest === 'function' ? viewerEl.closest('.drawer-panel') : null;

      function getInstance() {
        return instance;
      }

      viewportController = viewportControllerOwner.create({
        viewerEl: viewerEl,
        canvasEl: canvasEl,
        getInstance: getInstance,
        minScale: minScale,
        maxScale: maxScale,
        defaultScaleStep: defaultScaleStep,
        enableCustomBoxSelection: enableCustomBoxSelection,
        isEventInsideControls: isEventInsideMindControls,
        isEventInsideCanvas: isEventInsideMindCanvas,
        isNodeExpanderTarget: isMindNodeExpanderTarget,
        centerNode: centerMindNode,
        onViewStateChange: opts && opts.onViewStateChange,
        onBeforeCtrlDrag: function() {
          if (dragController) dragController.resetPreview();
        },
        onCtrlRelease: function() {
          if (selectionController) selectionController.resetModifierPointerGuard();
        },
        onGlobalPointerDown: function(e) {
          var menuTarget = e && e.target && e.target.closest
            ? e.target.closest('.xmind-node-context-menu')
            : null;
          if (!menuTarget) hideNodeContextMenu();
        },
      });

      searchController = searchControllerOwner.create({
        controlsEl: controlsEl,
        viewerEl: viewerEl,
        canvasEl: canvasEl,
        getInstance: getInstance,
        findNodeElement: findMindNodeElement,
        resolveAnchorElement: resolveMindAnchorElement,
        parseTransformState: parseMindTransformState,
        writeTransformState: writeMindTransformState,
      });

      selectionController = selectionControllerOwner.create({
        viewerEl: viewerEl,
        window: typeof window !== 'undefined' ? window : null,
        document: typeof document !== 'undefined' ? document : null,
        enabled: enableCustomBoxSelection,
        selectionModelOwner: selectionModelOwner,
        getInstance: getInstance,
        isEditing: function() { return editing; },
        isPendingSave: function() { return pendingSave; },
        findNodeById: function(nodeId) {
          return editInputController ? editInputController.findNodeById(nodeId) : null;
        },
        collectNodeLocatePath: collectNodeLocatePath,
        resolveEventNode: function(e) {
          return editInputController ? editInputController.resolveEventNode(e) : null;
        },
        isCtrlModifierActive: isCtrlModifierActive,
        isEventInsideControls: isEventInsideMindControls,
        isEventInsideCanvas: isEventInsideMindCanvas,
        isNodeExpanderTarget: isMindNodeExpanderTarget,
        hideContextMenu: hideNodeContextMenu,
        focusViewer: focusViewerForKeyboard,
        updateEditButtons: updateEditButtons,
      });

      dragController = dragControllerOwner.create({
        viewerEl: viewerEl,
        window: typeof window !== 'undefined' ? window : null,
        document: typeof document !== 'undefined' ? document : null,
        getInstance: getInstance,
        isEditing: function() { return editing; },
        isPendingSave: function() { return pendingSave; },
        isEventInsideControls: isEventInsideMindControls,
        isNodeExpanderTarget: isMindNodeExpanderTarget,
        isTypingTarget: function(target) {
          return Boolean(editInputController && editInputController.isTypingTarget(target));
        },
        selectModifiedNodeFromEvent: function(e) {
          return selectionController.selectModifiedNodeFromEvent(e);
        },
        collectSelectedNodes: collectSelectedNodes,
        findNodeElement: findMindNodeElement,
        getCurrentMindData: getCurrentMindData,
        findNodeWithParentById: findNodeWithParentById,
        refreshMindData: function(nextData) {
          var inst = getInstance();
          if (!inst || typeof inst.refresh !== 'function') return false;
          applyingHistory = true;
          try {
            inst.refresh(nextData);
            return true;
          } catch (err) {
            return false;
          } finally {
            applyingHistory = false;
          }
        },
        onRootSideMoved: function() {
          searchController.run({ keepIndex: true });
          scheduleRecordSnapshot();
          updateEditButtons();
        },
      });

      editInputController = editInputControllerOwner.create({
        viewerEl: viewerEl,
        window: typeof window !== 'undefined' ? window : null,
        document: typeof document !== 'undefined' ? document : null,
        getInstance: getInstance,
        isEditing: function() { return editing; },
        isPendingSave: function() { return pendingSave; },
        isEventInsideControls: isEventInsideMindControls,
        isNodeExpanderTarget: isMindNodeExpanderTarget,
        isCtrlModifierActive: isCtrlModifierActive,
        collectSelectedNodes: collectSelectedNodes,
        applySelectionNodes: applyCustomSelectionNodes,
        focusViewer: focusViewerForKeyboard,
        updateEditButtons: updateEditButtons,
        selectNodeForContextMenu: function(nodeEl) {
          selectSingleNodeForContextMenu(nodeEl);
        },
        hideContextMenu: hideNodeContextMenu,
        resetDragPreview: function() { dragController.resetPreview(); },
        onInputMutation: scheduleRecordSnapshot,
      });

      clipboardController = clipboardControllerOwner.create({
        viewerEl: viewerEl,
        controlsEl: controlsEl,
        getInstance: getInstance,
        isEditing: function() { return editing; },
        isPendingSave: function() { return pendingSave; },
        isTypingTarget: function(target) {
          return Boolean(editInputController && editInputController.isTypingTarget(target));
        },
        isInternalClipboardText: isMindElixirInternalClipboardText,
        parseIndentedTextToMindData: parseIndentedTextToMindData,
        normalizeClipboardPlainNodeTopic: normalizeClipboardPlainNodeTopic,
        getCurrentMindData: getCurrentMindData,
        createNode: createNode,
        cloneMindDataObject: cloneMindDataObject,
        cloneMindNodeTree: cloneMindNodeTree,
        collectSelectedNodes: collectSelectedNodes,
        findNodeWithParentById: findNodeWithParentById,
        normalizeMindTopic: normalizeMindTopic,
        clearValidationMarks: clearValidationMarks,
        setApplyingHistory: function(value) { applyingHistory = value === true; },
        pushHistorySnapshot: pushHistorySnapshot,
        runSearch: function(options) {
          if (searchController && typeof searchController.run === 'function') {
            searchController.run(options || {});
          }
        },
        updateEditButtons: updateEditButtons,
        showToast: callShowToast,
      });
      clipboardController.bind();

      function getCurrentMindData() {
        return readMindDataFromInstance(getInstance());
      }

      function callOpenConfirm(options) {
        if (opts && typeof opts.openConfirmDrawer === 'function') {
          return opts.openConfirmDrawer(options || {});
        }
        return openMindConfirmDrawer(options || {});
      }

      function callShowToast(message, type, durationMs) {
        if (opts && typeof opts.showToast === 'function') {
          opts.showToast(message, type || '', durationMs || 3000);
          return;
        }
        showMindToast(message, type || '', durationMs || 3000);
      }

      function buildNodeMeta(nodeEl) {
        var nodeObj = nodeEl && nodeEl.nodeObj ? nodeEl.nodeObj : null;
        if (!nodeObj) return null;
        var inst = getInstance();
        var rootTopic = inst && inst.nodeData && inst.nodeData.topic !== null && inst.nodeData.topic !== undefined
          ? String(inst.nodeData.topic).trim()
          : '';
        return buildMindNodeMeta(nodeObj, rootTopic, nodeEl);
      }

      function applyDefaultSelectionGroup(nodeEl, nodeMeta) {
        selectionController.applyDefaultGroup(nodeEl, nodeMeta);
      }

      function normalizeActionList(list) {
        if (!Array.isArray(list)) return [];
        return list.map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var actionId = item.id === undefined || item.id === null ? '' : String(item.id);
          if (!actionId) return null;
          return {
            id: actionId,
            label: item.label === undefined || item.label === null ? actionId : String(item.label),
            disabled: item.disabled === true,
          };
        }).filter(Boolean);
      }

      function collectSelectedNodeMetas(preferredNodeEl) {
        var selectedNodes = collectSelectedNodes().slice();
        if (preferredNodeEl) {
          var exists = selectedNodes.some(function(node) {
            return node === preferredNodeEl;
          });
          if (!exists) selectedNodes.unshift(preferredNodeEl);
        }
        return selectedNodes.map(function(node) {
          return buildNodeMeta(node);
        }).filter(Boolean);
      }

      function ensureActionContext(nodeMeta) {
        if (!nodeMeta) return null;
        if (Array.isArray(nodeMeta.selection)) return nodeMeta;
        var preferredNodeEl = nodeMeta.nodeEl || null;
        var actionMeta = preferredNodeEl ? buildNodeMeta(preferredNodeEl) : nodeMeta;
        if (!actionMeta) return null;
        actionMeta.selection = collectSelectedNodeMetas(preferredNodeEl);
        actionMeta.selectionCount = actionMeta.selection.length;
        return actionMeta;
      }

      function getNodeActionsForMeta(nodeMeta) {
        if (!nodeMeta || !opts || typeof opts.getNodeActions !== 'function') return [];
        try {
          return normalizeActionList(opts.getNodeActions(ensureActionContext(nodeMeta)));
        } catch (err) {
          return [];
        }
      }

      function requestNodeAction(actionId, nodeMeta) {
        if (!actionId || !opts || typeof opts.onNodeAction !== 'function') return false;
        try {
          opts.onNodeAction(String(actionId), ensureActionContext(nodeMeta) || null);
          return true;
        } catch (err) {
          return false;
        }
      }

      function requestDeleteSelection(nodeMeta) {
        if (!opts || typeof opts.onDeleteSelection !== 'function') return false;
        try {
          opts.onDeleteSelection(ensureActionContext(nodeMeta) || null);
          return true;
        } catch (err) {
          return false;
        }
      }

      function notifyEditStateChange() {
        if (opts && typeof opts.onEditStateChange === 'function') {
          try {
            opts.onEditStateChange({ editing: editing, pendingSave: pendingSave });
          } catch (err) {
            // ignore
          }
        }
      }

      function persistEditSession() {
        if (!editableSessionKey) return;
        if (!editing) {
          clearMindEditSession(editableSessionKey);
          return;
        }
        var currentData = getCurrentMindData();
        if (!currentData || !currentData.nodeData) return;

        var persistedHistory = historyModel.buildPersistedHistory(historyEntries, historyIndex, 80);

        writeMindEditSession(editableSessionKey, {
          version: 1,
          editing: true,
          baseData: cloneMindDataObject(baseMindData),
          currentData: cloneMindDataObject(currentData),
          history: persistedHistory.history,
          historyIndex: persistedHistory.historyIndex,
          restoreNoticeSignature: restoreNoticeSignature,
          updatedAt: Date.now(),
        });
      }

      function pushHistorySnapshot(data, options) {
        var opts1 = options || {};
        var next = historyModel.appendSnapshot(historyEntries, historyIndex, data, opts1);
        if (!next) return;
        historyEntries = next.entries;
        historyIndex = next.historyIndex;
        if (opts1.persist !== false) persistEditSession();
      }

      function recordSnapshotNow() {
        if (!editing || applyingHistory) return false;
        var snapshot = getCurrentMindData();
        if (!snapshot || !snapshot.nodeData) return false;
        pushHistorySnapshot(snapshot);
        return true;
      }

      function flushPendingEditSnapshot() {
        if (recordTimer) {
          clearTimeout(recordTimer);
          recordTimer = 0;
        }
        if (!editing || applyingHistory) return;
        if (!recordSnapshotNow()) persistEditSession();
      }

      function initializeHistory() {
        var restoredHistory = restoredSession && Array.isArray(restoredSession.history)
          ? restoredSession.history
          : [];
        if (editing && restoredHistory.length) {
          var restored = historyModel.restoreHistory(
            restoredHistory,
            restoredSession && restoredSession.historyIndex
          );
          if (restored) {
            historyEntries = restored.entries;
            historyIndex = restored.historyIndex;
            return;
          }
        }
        var initial = getCurrentMindData() || cloneMindDataObject(opts && opts.initialMindData);
        if (initial && initial.nodeData) {
          pushHistorySnapshot(initial, { reset: true, persist: false });
        }
      }

      function scheduleRecordSnapshot() {
        if (!editing || applyingHistory) return;
        if (recordTimer) clearTimeout(recordTimer);
        recordTimer = setTimeout(function() {
          recordTimer = 0;
          recordSnapshotNow();
          updateEditButtons();
        }, 20);
      }

      function clearValidationMarks() {
        if (!viewerEl || !viewerEl.querySelectorAll) return;
        var nodes = viewerEl.querySelectorAll('me-tpc.xmind-node-empty-error, me-tpc.xmind-node-struct-error');
        if (!nodes || !nodes.length) return;
        Array.prototype.forEach.call(nodes, function(node) {
          if (!node || !node.classList) return;
          node.classList.remove('xmind-node-empty-error');
          node.classList.remove('xmind-node-struct-error');
        });
      }

      function applyValidationMarks(emptyIds, structIds) {
        clearValidationMarks();
        var inst = getInstance();
        if (!inst) return;
        var empty = Array.isArray(emptyIds) ? emptyIds : [];
        var struct = Array.isArray(structIds) ? structIds : [];
        empty.forEach(function(id) {
          var el = findMindNodeElement(inst, id);
          if (!el || !el.classList) return;
          el.classList.add('xmind-node-empty-error');
        });
        struct.forEach(function(id2) {
          var el2 = findMindNodeElement(inst, id2);
          if (!el2 || !el2.classList) return;
          el2.classList.add('xmind-node-struct-error');
        });
      }

      function canToggleDrawerFullscreen() {
        return Boolean(
          drawerEl &&
          drawerPanelEl &&
          drawerEl.classList &&
          drawerPanelEl.classList &&
          drawerFullscreenPort &&
          typeof drawerFullscreenPort.is === 'function' &&
          typeof drawerFullscreenPort.set === 'function'
        );
      }

      function isDrawerFullscreen() {
        if (!canToggleDrawerFullscreen()) return false;
        return drawerFullscreenPort.is(drawerEl);
      }

      function syncFullscreenButtonState() {
        if (!fullscreenToggleBtn) return;
        if (!canToggleDrawerFullscreen()) {
          fullscreenToggleBtn.disabled = true;
          if (fullscreenToggleBtn.classList) fullscreenToggleBtn.classList.add('hidden');
          return;
        }
        if (fullscreenToggleBtn.classList) fullscreenToggleBtn.classList.remove('hidden');
        fullscreenToggleBtn.disabled = false;
        var fullscreen = isDrawerFullscreen();
        fullscreenToggleBtn.textContent = fullscreen ? '复原' : '全屏';
        fullscreenToggleBtn.title = fullscreen ? '复原' : '全屏';
        fullscreenToggleBtn.setAttribute('aria-pressed', fullscreen ? 'true' : 'false');
      }

      function setDrawerFullscreen(enabled) {
        if (!canToggleDrawerFullscreen()) {
          syncFullscreenButtonState();
          return false;
        }
        drawerFullscreenPort.set(drawerEl, enabled === true);
        return enabled === true;
      }

      function onDrawerFullscreenChange() {
        syncFullscreenButtonState();
        viewportController.handleLayoutChange('drawer-fullscreen');
      }

      function zoomBy(step) {
        viewportController.zoomBy(step);
      }

      function zoomFit() {
        viewportController.zoomFit();
      }

      function resolveSelectionNode(node, options) {
        return selectionController.resolveNode(node, options);
      }

      function applyCustomSelectionNodes(nodes) {
        return selectionController.apply(nodes);
      }

      function collectSelectedNodes(options) {
        return selectionController.collect(options);
      }

      function applyNodeDecorations() {
        if (!viewerEl || !viewerEl.querySelectorAll) return;
        if (nodeDecorationApplying) return;
        var nodes = viewerEl.querySelectorAll('me-tpc');
        if (!nodes || !nodes.length) return;
        nodeDecorationApplying = true;
        if (nodeDecorateObserver && typeof nodeDecorateObserver.disconnect === 'function') {
          nodeDecorateObserver.disconnect();
        }
        try {
          Array.prototype.forEach.call(nodes, function(nodeEl) {
            if (!nodeEl || !nodeEl.nodeObj) return;
            var nodeMeta = buildNodeMeta(nodeEl);
            if (!nodeMeta) return;
            if (opts && typeof opts.decorateNodeElement === 'function') {
              try {
                opts.decorateNodeElement(nodeEl, nodeMeta);
              } catch (err) {
                // ignore
              }
            }
            applyDefaultSelectionGroup(nodeEl, nodeMeta);
          });
        } finally {
          nodeDecorationApplying = false;
          observeNodeDecorationMutations();
        }
      }

      function scheduleNodeDecorations() {
        if (nodeDecorateTimer) clearTimeout(nodeDecorateTimer);
        nodeDecorateTimer = setTimeout(function() {
          nodeDecorateTimer = 0;
          applyNodeDecorations();
        }, 0);
      }

      function clearCustomSelection(syncMindSelection) {
        selectionController.clear(syncMindSelection === true);
      }

      function resetCustomSelectionInteractionState(syncMindSelection) {
        selectionController.resetInteractionState(syncMindSelection === true);
      }

      function isEventInsideMindControls(target) {
        if (!target) return false;
        if (controlsEl && controlsEl.contains && controlsEl.contains(target)) return true;
        if (target.closest && target.closest('[data-mind-controls]')) return true;
        return false;
      }

      function isEventInsideMindCanvas(target) {
        if (!target) return false;
        if (canvasEl && canvasEl.contains && canvasEl.contains(target)) return true;
        if (target.closest && target.closest('[data-mind-canvas]')) return true;
        return false;
      }

      function isMindNodeExpanderTarget(target) {
        return Boolean(target && target.closest && target.closest('me-epd'));
      }

      function ensureNodeContextMenuEl() {
        if (nodeContextMenuEl && nodeContextMenuEl.parentNode) return nodeContextMenuEl;
        if (typeof document === 'undefined' || !document.createElement) return null;
        if (!document.body || !document.body.appendChild) return null;
        var el = document.createElement('div');
        el.className = 'xmind-node-context-menu';
        el.setAttribute('aria-hidden', 'true');
        el.addEventListener('mousedown', onNodeContextMenuMouseDown, true);
        el.addEventListener('click', onNodeContextMenuClick);
        document.body.appendChild(el);
        nodeContextMenuEl = el;
        return nodeContextMenuEl;
      }

      function isNodeWithinViewerSelection(selectionNode) {
        if (!selectionNode) return false;
        var current = selectionNode.nodeType === 1 ? selectionNode : selectionNode.parentNode;
        while (current) {
          if (current === viewerEl) return true;
          current = current.parentNode;
        }
        return false;
      }

      function clearViewerNativeTextSelection() {
        if (typeof window === 'undefined' || !window || typeof window.getSelection !== 'function') return false;
        var selection = null;
        try {
          selection = window.getSelection();
        } catch (err) {
          selection = null;
        }
        if (!selection || selection.rangeCount <= 0 || selection.isCollapsed) return false;
        var anchorNode = selection.anchorNode || null;
        var focusNode = selection.focusNode || null;
        if (!isNodeWithinViewerSelection(anchorNode) && !isNodeWithinViewerSelection(focusNode)) return false;
        try {
          selection.removeAllRanges();
          return true;
        } catch (err2) {
          return false;
        }
      }

      function hideNodeContextMenu(options) {
        var preserveNativeSelection = Boolean(options && options.preserveNativeSelection === true);
        if (!preserveNativeSelection) clearViewerNativeTextSelection();
        nodeContextMenuMeta = null;
        forceHideAllNodeContextMenus();
        if (!nodeContextMenuEl || !nodeContextMenuEl.classList) return;
        nodeContextMenuEl.classList.remove('is-open');
        nodeContextMenuEl.setAttribute('aria-hidden', 'true');
      }
      activeContextMenuHider = hideNodeContextMenu;

      function showNodeContextMenu(clientX, clientY, payload) {
        var menu = ensureNodeContextMenuEl();
        if (!menu || !menu.style) return;
        clearViewerNativeTextSelection();
        var items = payload && Array.isArray(payload.items) ? payload.items : [];
        if (!items.length) {
          hideNodeContextMenu();
          return;
        }
        nodeContextMenuMeta = payload && payload.meta ? payload.meta : null;
        menu.innerHTML = items.map(function(item) {
          var disabledAttr = item && item.disabled ? ' disabled' : '';
          var label = item && item.label ? String(item.label) : '';
          var actionId = item && item.id ? String(item.id) : '';
          return '<button type="button" class="xmind-node-context-menu-btn" data-mind-node-menu="' + actionId + '"' + disabledAttr + '>' + label + '</button>';
        }).join('');
        menu.style.left = '0px';
        menu.style.top = '0px';
        menu.classList.add('is-open');
        menu.setAttribute('aria-hidden', 'false');
        var menuRect = menu.getBoundingClientRect ? menu.getBoundingClientRect() : null;
        var width = menuRect && menuRect.width ? menuRect.width : 120;
        var height = menuRect && menuRect.height ? menuRect.height : 40;
        var viewportWidth = typeof window !== 'undefined' && window ? (window.innerWidth || 0) : 0;
        var viewportHeight = typeof window !== 'undefined' && window ? (window.innerHeight || 0) : 0;
        var left = Number(clientX);
        var top = Number(clientY);
        if (!isFinite(left)) left = 0;
        if (!isFinite(top)) top = 0;
        if (viewportWidth > 0 && left + width > viewportWidth - 4) left = viewportWidth - width - 4;
        if (viewportHeight > 0 && top + height > viewportHeight - 4) top = viewportHeight - height - 4;
        if (left < 4) left = 4;
        if (top < 4) top = 4;
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
      }

      function isNodeContextMenuOpen() {
        if (!nodeContextMenuEl || !nodeContextMenuEl.classList) return false;
        return nodeContextMenuEl.classList.contains('is-open');
      }

      function isNodeCurrentlySelected(nodeEl) {
        if (!nodeEl) return false;
        var selected = collectSelectedNodes();
        if (!selected || !selected.length) return false;
        for (var i = 0; i < selected.length; i += 1) {
          if (selected[i] === nodeEl) return true;
        }
        return false;
      }

      function selectSingleNodeForContextMenu(nodeEl, preserveExistingSelection) {
        if (!nodeEl) return;
        nodeEl = resolveSelectionNode(nodeEl) || nodeEl;
        if (preserveExistingSelection === true && isNodeCurrentlySelected(nodeEl)) {
          focusViewerForKeyboard();
          return;
        }
        var selected = collectSelectedNodes();
        if (selected.length === 1 && selected[0] === nodeEl) {
          focusViewerForKeyboard();
          return;
        }
        var inst = getInstance();
        if (enableCustomBoxSelection) {
          clearCustomSelection(false);
        }
        if (inst && typeof inst.clearSelection === 'function') {
          try {
            inst.clearSelection();
          } catch (err0) {
            // ignore
          }
        }
        if (inst && typeof inst.selectNode === 'function') {
          try {
            inst.selectNode(nodeEl);
            focusViewerForKeyboard();
            return;
          } catch (err1) {
            // ignore
          }
        }
        if (inst && typeof inst.selectNodes === 'function') {
          try {
            inst.selectNodes([nodeEl]);
            focusViewerForKeyboard();
          } catch (err2) {
            // ignore
          }
        }
      }

      function resolveContextMenuTargetNode(target) {
        var nodeEl = target && target.closest ? target.closest('me-tpc') : null;
        if (nodeEl) {
          nodeEl = resolveSelectionNode(nodeEl) || nodeEl;
          selectSingleNodeForContextMenu(nodeEl, true);
          return nodeEl;
        }
        var selectedNodes = collectSelectedNodes();
        if (selectedNodes && selectedNodes.length === 1) return selectedNodes[0];
        return null;
      }

      function resolveContextMenuPayload(nodeEl) {
        var nodeMeta = ensureActionContext(buildNodeMeta(nodeEl));
        if (!nodeMeta) return null;
        var customActions = getNodeActionsForMeta(nodeMeta);
        if (customActions.length) {
          return {
            meta: nodeMeta,
            items: customActions,
          };
        }
        if (!allowEdit || !editing || pendingSave) return null;
        var selected = collectSelectedNodes();
        var actionState = editActionPolicy.resolve({
          editing: true,
          pendingSave: false,
          selectedNodes: selected,
        });
        var items = [];
        items.push({ id: 'node-add', label: '新增节点', disabled: !actionState.canAdd });
        if (actionState.canDelete) {
          items.push({ id: 'node-delete', label: '删除节点', disabled: !actionState.canDelete });
        }
        return items.length ? {
          meta: nodeMeta,
          items: items,
        } : null;
      }

      function onNodeContextMenuClick(e) {
        var target = e && e.target && e.target.closest
          ? e.target.closest('[data-mind-node-menu]')
          : null;
        if (!target || !target.dataset) return;
        var action = String(target.dataset.mindNodeMenu || '');
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
        if (action === 'node-add') {
          hideNodeContextMenu();
          setTimeout(function() {
            runAddNode();
          }, 0);
        } else if (action === 'node-delete') {
          hideNodeContextMenu();
          setTimeout(function() {
            runDeleteNodes();
          }, 0);
        } else if (action) {
          var meta = nodeContextMenuMeta;
          hideNodeContextMenu();
          setTimeout(function() {
            requestNodeAction(action, meta);
          }, 0);
        }
      }

      function onNodeContextMenuMouseDown(e) {
        var target = e && e.target && e.target.closest
          ? e.target.closest('[data-mind-node-menu]')
          : null;
        if (!target) return;
        clearViewerNativeTextSelection();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else if (e.stopPropagation) e.stopPropagation();
      }

      function isCtrlModifierActive(e) {
        return viewportController.isCtrlModifierActive(e);
      }

      function onViewerMouseDownGestureGuard(e) {
        if (!e || e.button !== 2) return;
        if (isEventInsideMindControls(e.target)) return;
        if (selectionController.selectModifiedNodeFromEvent(e)) {
          if (e.preventDefault) e.preventDefault();
          return;
        }
        var nodeEl = resolveContextMenuTargetNode(e.target);
        var menuPayload = nodeEl ? resolveContextMenuPayload(nodeEl) : null;
        if (menuPayload && nodeEl && isNodeCurrentlySelected(nodeEl)) {
          showNodeContextMenu(e.clientX, e.clientY, menuPayload);
          if (e.preventDefault) e.preventDefault();
          return;
        }
        if (!isEventInsideMindCanvas(e.target)) return;
        hideNodeContextMenu();
        dragController.beginLegacyRightDrag(e);
      }

      function onViewerContextMenu(e) {
        if (!e) return;
        if (selectionController.consumeContextMenuSuppression(e)) return;
        if (isEventInsideMindControls(e.target)) return;
        if (selectionController.selectModifiedNodeFromEvent(e)) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          return;
        }
        var nodeEl = resolveContextMenuTargetNode(e.target);
        var menuPayload = nodeEl ? resolveContextMenuPayload(nodeEl) : null;
        if (menuPayload && nodeEl && isNodeCurrentlySelected(nodeEl)) {
          focusViewerForKeyboard();
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          showNodeContextMenu(e.clientX, e.clientY, menuPayload);
          return;
        }
        if (isEventInsideMindCanvas(e.target)) {
          hideNodeContextMenu();
          if (e.preventDefault) e.preventDefault();
          return;
        }
        if (dragController.shouldSuppressContextMenu() && e.preventDefault) e.preventDefault();
      }

      function onWindowContextMenu(e) {
        if (!e) return;
        if (selectionController.consumeContextMenuSuppression(e)) return;
        if (isEventInsideMindControls(e.target)) return;
        if (isEventInsideMindCanvas(e.target)) {
          if (isNodeContextMenuOpen()) {
            if (e.preventDefault) e.preventDefault();
            return;
          }
          if (!(editing && e.target && e.target.closest && e.target.closest('me-tpc'))) {
            hideNodeContextMenu();
          }
          if (e.preventDefault) e.preventDefault();
          return;
        }
        hideNodeContextMenu();
        if (!dragController.shouldSuppressContextMenu()) return;
        if (e.preventDefault) e.preventDefault();
      }

      function setButtonVisible(button, visible) {
        if (!button || !button.classList) return;
        if (visible) button.classList.remove('hidden');
        else button.classList.add('hidden');
      }

      function setButtonDisabled(button, disabled) {
        if (!button) return;
        button.disabled = Boolean(disabled);
      }

      function updateEditButtons() {
        var selected = collectSelectedNodes();
        var actionState = editActionPolicy.resolve({
          editing: editing,
          pendingSave: pendingSave,
          selectedNodes: selected,
          historyIndex: historyIndex,
          historyLength: historyEntries.length,
        });

        setButtonVisible(editEnterBtn, !editing);
        setButtonVisible(editCancelBtn, editing);
        setButtonVisible(editSaveBtn, editing);
        setButtonVisible(editAddBtn, editing);
        setButtonVisible(editDeleteBtn, editing);
        setButtonVisible(editUndoBtn, editing);
        setButtonVisible(editRedoBtn, editing);

        setButtonDisabled(editAddBtn, !actionState.canAdd);
        setButtonDisabled(editDeleteBtn, !actionState.canDelete);
        setButtonDisabled(editUndoBtn, !actionState.canUndo);
        setButtonDisabled(editRedoBtn, !actionState.canRedo);
        setButtonDisabled(editSaveBtn, pendingSave);
        setButtonDisabled(editCancelBtn, pendingSave);

        if (viewerEl && viewerEl.classList) {
          if (editing) viewerEl.classList.add('is-editing');
          else viewerEl.classList.remove('is-editing');
          if (pendingSave) viewerEl.classList.add('is-saving');
          else viewerEl.classList.remove('is-saving');
        }

        notifyEditStateChange();
      }

      function scheduleUpdateEditButtons() {
        setTimeout(function() {
          updateEditButtons();
        }, 0);
        setTimeout(function() {
          updateEditButtons();
        }, 80);
      }

      function enterEditMode() {
        if (!allowEdit) return;
        if (editing) return;
        editing = true;
        pendingSave = false;
        clearValidationMarks();
        resetCustomSelectionInteractionState(true);
        var inst = getInstance();
        if (inst && typeof inst.enableEdit === 'function') {
          try {
            inst.enableEdit();
          } catch (err) {
            // ignore
          }
        }
        var snapshot = getCurrentMindData();
        if (snapshot && snapshot.nodeData) {
          baseMindData = cloneMindDataObject(snapshot);
          pushHistorySnapshot(snapshot, { reset: true, persist: false });
        }
        persistEditSession();
        updateEditButtons();
      }

      function applyHistoryAt(index) {
        var nextIndex = Number(index);
        if (!isFinite(nextIndex)) return;
        if (nextIndex < 0 || nextIndex >= historyEntries.length) return;
        var entry = historyEntries[nextIndex];
        if (!entry || !entry.data || !entry.data.nodeData) return;
        var inst = getInstance();
        if (!inst || typeof inst.refresh !== 'function') return;
        applyingHistory = true;
        try {
          inst.refresh(cloneMindDataObject(entry.data));
        } catch (err) {
          // ignore
        }
        // MindElixir refresh 可能重置主题变量，撤回/恢复后强制与当前页面主题保持一致。
        refreshMindTheme(inst);
        setTimeout(function() {
          refreshMindTheme(inst);
        }, 0);
        applyingHistory = false;
        historyIndex = nextIndex;
        clearValidationMarks();
        searchController.run({ keepIndex: true });
        persistEditSession();
        updateEditButtons();
      }

      function runUndo() {
        if (!editing || pendingSave) return;
        if (historyIndex <= 0) return;
        applyHistoryAt(historyIndex - 1);
      }

      function runRedo() {
        if (!editing || pendingSave) return;
        if (historyEntries.length <= 0) return;
        if (historyIndex >= historyEntries.length - 1) return;
        applyHistoryAt(historyIndex + 1);
      }

      function runAddNode() {
        if (!editing || pendingSave) return;
        var inst = getInstance();
        if (!inst || typeof inst.addChild !== 'function') return;
        var selected = collectSelectedNodes();
        if (selected.length !== 1) return;
        clearValidationMarks();
        try {
          inst.addChild(selected[0], {
            id: generateNodeId(),
            topic: '',
            expanded: true,
            children: [],
          });
          scheduleRecordSnapshot();
        } catch (err) {
          // ignore
        }
      }

      function collectRemovableSelectedNodes() {
        return selectionController.collectRemovableNodes();
      }

      function runDeleteNodes() {
        if (!editing || pendingSave) return;
        var inst = getInstance();
        if (!inst || typeof inst.removeNodes !== 'function') return;
        var selected = collectRemovableSelectedNodes();
        if (!selected.length) return;
        var viewState = captureMindViewState(inst);
        clearValidationMarks();
        try {
          inst.removeNodes(selected);
          selectionController.clearVisualSelection();
          scheduleMindViewRestore(inst, viewState, null, { force: true });
          scheduleRecordSnapshot();
        } catch (err) {
          // ignore
        }
      }

      function exitEditMode(clearSession) {
        editing = false;
        pendingSave = false;
        clearValidationMarks();
        selectionController.clearVisualSelection();
        var inst = getInstance();
        if (inst && typeof inst.disableEdit === 'function') {
          try {
            inst.disableEdit();
          } catch (err) {
            // ignore
          }
        }
        if (clearSession === true) {
          clearMindEditSession(editableSessionKey);
        } else {
          persistEditSession();
        }
        updateEditButtons();
      }

      function cancelEditMode() {
        if (!editing || pendingSave) return;
        var current = getCurrentMindData();
        var base = cloneMindDataObject(baseMindData) || cloneMindDataObject(opts && opts.initialMindData);
        if (!base || !base.nodeData) {
          exitEditMode(true);
          return;
        }
        var currentData = current || base;
        var snapshotChanged = buildMindDataSignature(base) !== buildMindDataSignature(currentData);
        var summary = calculateCaseChangeSummary(base, currentData);
        if (snapshotChanged && (!summary || Number(summary.total || 0) <= 0)) {
          summary = { modified: 1, added: 0, deleted: 0, total: 1 };
        }
        var hasChange = Boolean(snapshotChanged || (summary && Number(summary.total || 0) > 0));

        function applyCancel() {
          var inst = getInstance();
          if (inst && typeof inst.refresh === 'function') {
            applyingHistory = true;
            try {
              inst.refresh(cloneMindDataObject(base));
            } catch (err) {
              // ignore
            }
            applyingHistory = false;
          }
          pushHistorySnapshot(base, { reset: true, persist: false });
          searchController.run({ keepIndex: false });
          exitEditMode(true);
        }

        if (!hasChange) {
          applyCancel();
          return;
        }

        var cancelSuffix = opts && opts.cancelConfirmSuffix
          ? String(opts.cancelConfirmSuffix)
          : '确认要取消保存吗？';
        callOpenConfirm({
          title: '取消编辑',
          message: buildMindChangeConfirmMessage(summary, cancelSuffix),
          confirmText: '确认取消',
          cancelText: '继续编辑',
          danger: true,
        }).then(function(res) {
          if (!res || res.ok !== true) return;
          applyCancel();
        });
      }

      function saveEditMode() {
        if (!editing || pendingSave) return;
        var saveFn = opts && typeof opts.onSaveCases === 'function' ? opts.onSaveCases : null;
        var current = getCurrentMindData();
        if (!current || !current.nodeData) {
          callShowToast('当前导图数据为空，无法保存', 'err', 3000);
          return;
        }
        var saveFieldCount = Number(opts && opts.fieldCount);
        if (!isFinite(saveFieldCount) || saveFieldCount <= 0) saveFieldCount = 6;
        var validation = validateMindDataCases(current, {
          fieldCount: saveFieldCount,
          topicCaseParser: opts && typeof opts.topicCaseParser === 'function' ? opts.topicCaseParser : null,
        });
        if (!validation || validation.ok !== true) {
          var msg = validation && Array.isArray(validation.errors) && validation.errors.length
            ? validation.errors[0]
            : '结构校验失败，请检查节点';
          applyValidationMarks(
            validation && Array.isArray(validation.emptyNodeIds) ? validation.emptyNodeIds : [],
            validation && Array.isArray(validation.structuralNodeIds) ? validation.structuralNodeIds : []
          );
          callShowToast(msg, 'err', 3000);
          return;
        }

        clearValidationMarks();
        var base = cloneMindDataObject(baseMindData) || cloneMindDataObject(opts && opts.initialMindData) || current;
        var snapshotChanged = buildMindDataSignature(base) !== buildMindDataSignature(current);
        var summary = calculateCaseChangeSummary(base, current);
        if (snapshotChanged && (!summary || Number(summary.total || 0) <= 0)) {
          summary = { modified: 1, added: 0, deleted: 0, total: 1 };
        }
        var hasChange = Boolean(snapshotChanged || (summary && Number(summary.total || 0) > 0));

        function runSave() {
          pendingSave = true;
          updateEditButtons();
          var savePromise = null;
          try {
            if (saveFn) {
              savePromise = saveFn(validation.cases || [], summary || {}, {
                mindData: cloneMindDataObject(current),
                baseMindData: cloneMindDataObject(base),
                validation: validation,
              });
            } else {
              savePromise = Promise.resolve(true);
            }
          } catch (err) {
            savePromise = Promise.reject(err);
          }

          Promise.resolve(savePromise).then(function(res) {
            pendingSave = false;
            var latest = getCurrentMindData() || cloneMindDataObject(current);
            baseMindData = cloneMindDataObject(latest);
            pushHistorySnapshot(latest, { reset: true, persist: false });
            exitEditMode(true);
            if (opts && typeof opts.onSaveSuccess === 'function') {
              try {
                opts.onSaveSuccess(res || null);
              } catch (err2) {
                // ignore
              }
            }
          }).catch(function(err) {
            pendingSave = false;
            updateEditButtons();
            if (err && err.silent === true) return;
            var msg = err && err.message ? String(err.message) : '保存失败';
            callShowToast(msg, 'err', 3000);
          });
        }

        if (!hasChange) {
          runSave();
          return;
        }

        callOpenConfirm({
          title: '确认保存',
          message: buildMindChangeConfirmMessage(summary, '确认要保存吗？'),
          confirmText: '确认保存',
          cancelText: '继续编辑',
        }).then(function(res) {
          if (!res || res.ok !== true) return;
          runSave();
        });
      }

      function onControlsClick(e) {
        hideNodeContextMenu();
        var target = e && e.target && e.target.closest ? e.target.closest('[data-mind-action]') : null;
        if (!target || !target.dataset) return;
        var action = String(target.dataset.mindAction || '');
        if (action === 'zoom-in') {
          zoomBy(defaultScaleStep);
        } else if (action === 'zoom-out') {
          zoomBy(-defaultScaleStep);
        } else if (action === 'zoom-fit') {
          zoomFit();
        } else if (action === 'drawer-fullscreen') {
          setDrawerFullscreen(!isDrawerFullscreen());
        } else if (action === 'search-prev') {
          searchController.move(-1);
        } else if (action === 'search-next') {
          searchController.move(1);
        } else if (action === 'search-clear') {
          searchController.clear({ focusInput: true });
        } else if (action === 'export-xmind') {
          if (exportState.pending) return;
          if (!opts || typeof opts.onExportXmind !== 'function') return;
          var resetExportState = function() {
            exportState.pending = false;
            if (target && target.disabled) {
              target.disabled = false;
            }
          };
          try {
            var exportResult = opts.onExportXmind();
            if (exportResult && typeof exportResult.then === 'function') {
              exportState.pending = true;
              target.disabled = true;
              Promise.resolve(exportResult).then(function() {
                resetExportState();
              }).catch(function() {
                resetExportState();
              });
            }
          } catch (err2) {
            resetExportState();
          }
        } else if (action === 'edit-enter') {
          enterEditMode();
        } else if (action === 'edit-cancel') {
          cancelEditMode();
        } else if (action === 'edit-save') {
          saveEditMode();
        } else if (action === 'node-add') {
          runAddNode();
        } else if (action === 'node-delete') {
          runDeleteNodes();
        } else if (action === 'undo') {
          runUndo();
        } else if (action === 'redo') {
          runRedo();
        }
      }

      function isMutationKeyEvent(e) {
        if (!e) return false;
        var key = e.key ? String(e.key) : '';
        var lower = key.toLowerCase();
        if (key === 'Tab' || key === 'Enter' || key === 'Delete' || key === 'Backspace') return true;
        if ((e.ctrlKey || e.metaKey) && (lower === 'c' || lower === 'v' || lower === 'x' || lower === 'z' || lower === 'y')) return true;
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && lower === 'z') return true;
        return false;
      }

      function onViewerKeydown(e) {
        if (!e) return;
        var eventTarget = e.target || null;
        var typing = editInputController.isTypingTarget(eventTarget);
        if (typing) hideNodeContextMenu({ preserveNativeSelection: true });
        else hideNodeContextMenu();
        if (e.key === 'Escape' && isDrawerFullscreen()) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          setDrawerFullscreen(false);
          return;
        }
        if (controlsEl && controlsEl.contains && controlsEl.contains(e.target)) return;
        var lower = e.key ? String(e.key).toLowerCase() : '';

        if (!editing) {
          if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
            var deleteSelectedReadonly = collectRemovableSelectedNodes();
            if (deleteSelectedReadonly.length && requestDeleteSelection(buildNodeMeta(deleteSelectedReadonly[0]))) {
              if (e.preventDefault) e.preventDefault();
              if (e.stopPropagation) e.stopPropagation();
              return;
            }
          }
          if (isMutationKeyEvent(e)) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
          }
          return;
        }

        if (!typing && (e.ctrlKey || e.metaKey) && !e.shiftKey && lower === 'z') {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          runUndo();
          return;
        }

        if (!typing && (((e.ctrlKey || e.metaKey) && lower === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && lower === 'z'))) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          runRedo();
          return;
        }

        if (!typing && e.key === 'Delete') {
          var deleteSelected = collectRemovableSelectedNodes();
          if (deleteSelected.length) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            runDeleteNodes();
            return;
          }
        }

        if (!typing && editInputController.beginKeyboardEdit(e)) {
          return;
        }

        if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
          var selected = collectRemovableSelectedNodes();
          if (selected.length) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            runDeleteNodes();
          }
        }
      }

      function onViewerClick(e) {
        selectionController.resetModifierPointerGuard();
        if (e && isMindNodeExpanderTarget(e.target)) {
          hideNodeContextMenu();
          updateEditButtons();
          return;
        }
        if (e && editInputController.isTypingTarget(e.target)) {
          hideNodeContextMenu({ preserveNativeSelection: true });
          updateEditButtons();
          return;
        }
        if (selectionController.consumeClickSuppression(e)) return;
        var nodeEl = editInputController.resolveEventNode(e);
        if (editing && !pendingSave && e && !isCtrlModifierActive(e) && !e.metaKey && !e.shiftKey && !e.altKey) {
          if (nodeEl) {
            editInputController.scheduleSelectionMode('point', {
              x: e.clientX,
              y: e.clientY,
            });
            editInputController.selectNodeForEditing(nodeEl);
          } else if (isEventInsideMindCanvas(e.target) && !editInputController.isCanvasClearSuppressed()) {
            clearCustomSelection(true);
            focusViewerForKeyboard();
          }
        }
        if (selectionController.handleReadOnlyClick(e, nodeEl)) return;
        hideNodeContextMenu();
        updateEditButtons();
        scheduleUpdateEditButtons();
      }

      function normalizeLocatePath(pathArr) {
        if (!Array.isArray(pathArr)) return [];
        return pathArr.map(function(seg) {
          if (seg === null || seg === undefined) return '';
          return String(seg).trim();
        });
      }

      function collectNodeLocatePath(nodeEl) {
        if (!nodeEl || !nodeEl.nodeObj) return [];
        var topics = [];
        var cursor = nodeEl.nodeObj;
        var guard = 0;
        while (cursor && guard < 64) {
          var topic = cursor.topic === null || cursor.topic === undefined
            ? ''
            : String(cursor.topic).trim();
          topics.unshift(topic);
          cursor = cursor.parent || null;
          guard += 1;
        }

        var inst = getInstance();
        var rootTopic = inst && inst.nodeData && inst.nodeData.topic !== null && inst.nodeData.topic !== undefined
          ? String(inst.nodeData.topic).trim()
          : '';
        if (rootTopic && topics.length && topics[0] === rootTopic) {
          topics = topics.slice(1);
        }
        while (topics.length > 6) {
          topics = topics.slice(topics.length - 6);
        }
        return normalizeLocatePath(topics);
      }

      function onViewerDblClick(e) {
        if (e && isMindNodeExpanderTarget(e.target)) return;
        if (editInputController.handleEditingDblClick(e)) return;
        if (!opts || typeof opts.onNodeDblClickLocate !== 'function') return;
        if (controlsEl && controlsEl.contains && controlsEl.contains(e && e.target)) return;
        if (e && e.target && e.target.closest && e.target.closest('[data-mind-controls]')) return;

        var nodeEl = e && e.target && e.target.closest ? e.target.closest('me-tpc') : null;
        if (!nodeEl || !nodeEl.nodeObj) return;

        var path = collectNodeLocatePath(nodeEl);
        if (!path.length) return;

        try {
          opts.onNodeDblClickLocate({
            path: path,
            topic: path[path.length - 1] || '',
            nodeId: nodeEl.nodeObj && nodeEl.nodeObj.id ? String(nodeEl.nodeObj.id) : '',
            depth: path.length,
          });
        } catch (err) {
          // ignore
        }
      }

      function onWindowPageHide() {
        flushPendingEditSnapshot();
      }

      function findNodeWithParentById(rootNode, nodeId, parentNode) {
        if (!rootNode || !nodeId) return null;
        var idText = rootNode.id === undefined || rootNode.id === null ? '' : String(rootNode.id);
        if (idText && idText === String(nodeId)) {
          return {
            node: rootNode,
            parent: parentNode || null,
          };
        }
        var children = Array.isArray(rootNode.children) ? rootNode.children : [];
        for (var i = 0; i < children.length; i += 1) {
          var found = findNodeWithParentById(children[i], nodeId, rootNode);
          if (found) return found;
        }
        return null;
      }

      function operationListener(payload) {
        if (!editing || applyingHistory) return;
        if (editInputController.handleOperation(payload)) return;
        clearValidationMarks();
        scheduleRecordSnapshot();
        scheduleNodeDecorations();
      }

      initializeHistory();

      if (controlsEl && typeof controlsEl.addEventListener === 'function') {
        controlsEl.addEventListener('click', onControlsClick);
      }
      if (drawerEl && typeof drawerEl.addEventListener === 'function') {
        drawerEl.addEventListener('tap:drawer-fullscreen-change', onDrawerFullscreenChange);
      }
      if (viewerEl && typeof viewerEl.addEventListener === 'function') {
        editInputController.bind();
        viewerEl.addEventListener('contextmenu', onViewerContextMenu, true);
        viewerEl.addEventListener('mousedown', onViewerMouseDownGestureGuard, true);
        selectionController.bind();
        dragController.bind();
        viewerEl.addEventListener('keydown', onViewerKeydown, true);
        viewerEl.addEventListener('click', onViewerClick, true);
        viewerEl.addEventListener('dblclick', onViewerDblClick, true);
      }
      if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
        window.addEventListener('pagehide', onWindowPageHide);
        window.addEventListener('beforeunload', onWindowPageHide);
        window.addEventListener('contextmenu', onWindowContextMenu, true);
      }
      if (instance && instance.bus && typeof instance.bus.addListener === 'function') {
        instance.bus.addListener('operation', operationListener);
      }
      if (instance && typeof instance === 'object') {
        instance.__tapCaptureViewState = function() {
          return captureMindViewState(getInstance());
        };
        instance.__tapCaptureViewportAnchorState = function() {
          return captureViewportCenterAnchorState(getInstance());
        };
        instance.__tapCaptureDrawerState = function() {
          return captureMindDrawerState(getInstance());
        };
        instance.__tapSetDrawerFullscreen = function(enabled) {
          return setDrawerFullscreen(enabled === true);
        };
      }
      function getDecorationNodeClassName(node) {
        if (!node) return '';
        if (typeof node.className === 'string') return node.className;
        if (node.className && typeof node.className.baseVal === 'string') return node.className.baseVal;
        return '';
      }

      function isManagedDecorationNode(node) {
        var policyCore = getRenderPolicyCore();
        if (!node || Number(node.nodeType) !== 1) return false;
        if (node.matches && node.matches('[data-xmind-casegen-topup-layer]')) return true;
        if (node.closest && node.closest('[data-xmind-casegen-topup-layer]')) return true;
        if (!policyCore || typeof policyCore.isManagedDecorationClassName !== 'function') return false;
        return policyCore.isManagedDecorationClassName(getDecorationNodeClassName(node));
      }

      function isManagedDecorationMutationOnly(mutation) {
        var nodes = [];
        Array.prototype.forEach.call(mutation && mutation.addedNodes ? mutation.addedNodes : [], function(node) {
          nodes.push(node);
        });
        Array.prototype.forEach.call(mutation && mutation.removedNodes ? mutation.removedNodes : [], function(node) {
          nodes.push(node);
        });
        var elementNodes = nodes.filter(function(node) {
          return Boolean(node && Number(node.nodeType) === 1);
        });
        return Boolean(elementNodes.length && elementNodes.every(isManagedDecorationNode));
      }

      function buildNodeDecorationMutationChanges(mutations) {
        return Array.prototype.map.call(mutations || [], function(mutation) {
          return {
            type: mutation && mutation.type ? String(mutation.type || '') : '',
            targetRole: isManagedDecorationNode(mutation && mutation.target ? mutation.target : null) ? 'managed' : 'tree',
            insideManaged: isManagedDecorationNode(mutation && mutation.target ? mutation.target : null),
            managedOnly: isManagedDecorationMutationOnly(mutation),
          };
        });
      }

      function shouldScheduleNodeDecorationsForMutations(mutations) {
        var policyCore = getRenderPolicyCore();
        if (!policyCore || typeof policyCore.shouldScheduleNodeDecorations !== 'function') return true;
        return policyCore.shouldScheduleNodeDecorations(buildNodeDecorationMutationChanges(mutations));
      }

      function observeNodeDecorationMutations() {
        if (!nodeDecorateObserver || !canvasEl || nodeDecorationApplying) return;
        nodeDecorateObserver.observe(canvasEl, { childList: true, subtree: true });
      }

      if (typeof MutationObserver !== 'undefined' && canvasEl) {
        nodeDecorateObserver = new MutationObserver(function(mutations) {
          if (nodeDecorationApplying || !shouldScheduleNodeDecorationsForMutations(mutations)) return;
          editInputController.syncInputBox();
          scheduleNodeDecorations();
        });
        try {
          observeNodeDecorationMutations();
        } catch (err3) {
          nodeDecorateObserver = null;
        }
      }

      syncFullscreenButtonState();
      scheduleNodeDecorations();

      if (editing) {
        if (instance && typeof instance.enableEdit === 'function') {
          try {
            instance.enableEdit();
          } catch (err) {
            // ignore
          }
        }
        persistEditSession();
      } else if (instance && typeof instance.disableEdit === 'function') {
        try {
          instance.disableEdit();
        } catch (err2) {
          // ignore
        }
      }
      updateEditButtons();

      return function cleanup() {
        // Flush pending snapshots before unbinding to avoid losing the latest unsaved edits.
        flushPendingEditSnapshot();
        var preserveDrawerFullscreen = Boolean(
          instance &&
          instance.__tapPreserveDrawerFullscreenOnDestroy === true
        );
        if (!preserveDrawerFullscreen) {
          setDrawerFullscreen(false);
        }
        if (recordTimer) {
          clearTimeout(recordTimer);
          recordTimer = 0;
        }
        if (searchController && typeof searchController.destroy === 'function') {
          searchController.destroy();
        }
        if (viewportController && typeof viewportController.destroy === 'function') {
          viewportController.destroy();
        }
        if (nodeDecorateTimer) {
          clearTimeout(nodeDecorateTimer);
          nodeDecorateTimer = 0;
        }
        if (editInputController && typeof editInputController.destroy === 'function') {
          editInputController.destroy();
        }
        if (selectionController && typeof selectionController.destroy === 'function') {
          selectionController.destroy();
        }
        if (dragController && typeof dragController.destroy === 'function') {
          dragController.destroy();
        }
        clearValidationMarks();
        if (controlsEl && typeof controlsEl.removeEventListener === 'function') {
          controlsEl.removeEventListener('click', onControlsClick);
        }
        if (drawerEl && typeof drawerEl.removeEventListener === 'function') {
          drawerEl.removeEventListener('tap:drawer-fullscreen-change', onDrawerFullscreenChange);
        }
        if (viewerEl && typeof viewerEl.removeEventListener === 'function') {
          viewerEl.removeEventListener('contextmenu', onViewerContextMenu, true);
          viewerEl.removeEventListener('mousedown', onViewerMouseDownGestureGuard, true);
          viewerEl.removeEventListener('keydown', onViewerKeydown, true);
          viewerEl.removeEventListener('click', onViewerClick, true);
          viewerEl.removeEventListener('dblclick', onViewerDblClick, true);
          if (clipboardController && typeof clipboardController.destroy === 'function') {
            clipboardController.destroy();
          }
        }
        if (typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function') {
          window.removeEventListener('pagehide', onWindowPageHide);
          window.removeEventListener('beforeunload', onWindowPageHide);
          window.removeEventListener('contextmenu', onWindowContextMenu, true);
        }
        if (instance && instance.bus && typeof instance.bus.removeListener === 'function') {
          instance.bus.removeListener('operation', operationListener);
        }
        if (instance && typeof instance === 'object') {
          try {
            delete instance.__tapPreserveDrawerFullscreenOnDestroy;
          } catch (err4a) {
            instance.__tapPreserveDrawerFullscreenOnDestroy = null;
          }
          try {
            delete instance.__tapCaptureViewState;
          } catch (err4c) {
            instance.__tapCaptureViewState = null;
          }
          try {
            delete instance.__tapCaptureDrawerState;
          } catch (err4d) {
            instance.__tapCaptureDrawerState = null;
          }
          try {
            delete instance.__tapSetDrawerFullscreen;
          } catch (err4e) {
            instance.__tapSetDrawerFullscreen = null;
          }
        }
        if (nodeDecorateObserver && typeof nodeDecorateObserver.disconnect === 'function') {
          nodeDecorateObserver.disconnect();
          nodeDecorateObserver = null;
        }
        if (nodeContextMenuEl) {
          if (typeof nodeContextMenuEl.removeEventListener === 'function') {
            nodeContextMenuEl.removeEventListener('mousedown', onNodeContextMenuMouseDown, true);
            nodeContextMenuEl.removeEventListener('click', onNodeContextMenuClick);
          }
          if (nodeContextMenuEl.parentNode) {
            nodeContextMenuEl.parentNode.removeChild(nodeContextMenuEl);
          }
          nodeContextMenuEl = null;
        }
        if (activeContextMenuHider === hideNodeContextMenu) {
          activeContextMenuHider = function() {};
        }
      };
    }

    function destroyMindMap(instance) {
      if (!instance) return;
      var cleanups = Array.isArray(instance.__tapXmindCleanupList) ? instance.__tapXmindCleanupList : [];
      cleanups.forEach(function(fn) {
        if (typeof fn !== 'function') return;
        try {
          fn();
        } catch (err) {
          // ignore
        }
      });
      instance.__tapXmindCleanupList = [];
      var detachedNodes = Array.isArray(instance.__tapDetachedNodes) ? instance.__tapDetachedNodes : [];
      detachedNodes.forEach(function(node) {
        if (!node || !node.parentNode) return;
        try {
          node.parentNode.removeChild(node);
        } catch (err0) {
          // ignore
        }
      });
      instance.__tapDetachedNodes = [];
      if (typeof instance.destroy !== 'function') return;
      try {
        instance.destroy();
      } catch (err) {
        // ignore
      }
    }

    function captureMindViewState(instance) {
      if (!instance || !instance.map || !instance.container) return null;
      var transform = '';
      if (instance.map.style && instance.map.style.transform) {
        transform = String(instance.map.style.transform || '');
      }
      return {
        transform: transform,
        scaleVal: resolveScale(instance),
        scrollLeft: Number(instance.container.scrollLeft || 0),
        scrollTop: Number(instance.container.scrollTop || 0),
      };
    }

    function resolveMindAnchorElement(nodeEl) {
      if (!nodeEl) return null;
      if (nodeEl.querySelector) {
        var topicText = nodeEl.querySelector('.text');
        if (topicText && topicText.getBoundingClientRect) {
          return topicText;
        }
      }
      return nodeEl && nodeEl.getBoundingClientRect ? nodeEl : null;
    }

    function captureMindAnchorState(instance, anchorNodeId) {
      if (!instance || !anchorNodeId) return null;
      var nodeEl = findMindNodeElement(instance, anchorNodeId);
      var anchorEl = resolveMindAnchorElement(nodeEl);
      if (!anchorEl || !anchorEl.getBoundingClientRect) return null;
      var nodeRect = anchorEl.getBoundingClientRect();
      return {
        nodeId: String(anchorNodeId),
        centerX: Number(nodeRect.left + (nodeRect.width / 2)),
        centerY: Number(nodeRect.top + (nodeRect.height / 2)),
      };
    }

    function captureViewportCenterAnchorState(instance) {
      if (!instance) return null;
      var viewerEl = instance.el && instance.el.getBoundingClientRect
        ? instance.el
        : (instance.container && instance.container.getBoundingClientRect ? instance.container : null);
      if (!viewerEl || !viewerEl.getBoundingClientRect || !viewerEl.querySelectorAll) return null;
      var viewerRect = viewerEl.getBoundingClientRect();
      var viewerCenterX = Number(viewerRect.left + (viewerRect.width / 2));
      var viewerCenterY = Number(viewerRect.top + (viewerRect.height / 2));
      if (!isFinite(viewerCenterX) || !isFinite(viewerCenterY)) return null;
      var nodeEls = viewerEl.querySelectorAll('me-tpc');
      var best = null;
      Array.prototype.forEach.call(nodeEls, function(nodeEl) {
        if (!nodeEl || !nodeEl.nodeObj || nodeEl.nodeObj.id === undefined || nodeEl.nodeObj.id === null) return;
        var anchorEl = resolveMindAnchorElement(nodeEl);
        if (!anchorEl || !anchorEl.getBoundingClientRect) return;
        var rect = anchorEl.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        var centerX = Number(rect.left + (rect.width / 2));
        var centerY = Number(rect.top + (rect.height / 2));
        if (!isFinite(centerX) || !isFinite(centerY)) return;
        var dx = centerX - viewerCenterX;
        var dy = centerY - viewerCenterY;
        var distance = Math.sqrt((dx * dx) + (dy * dy));
        if (!best || distance < best.distance) {
          best = {
            nodeId: String(nodeEl.nodeObj.id),
            centerX: centerX,
            centerY: centerY,
            distance: distance,
          };
        }
      });
      if (!best || !best.nodeId) return null;
      return {
        nodeId: best.nodeId,
        centerX: best.centerX,
        centerY: best.centerY,
      };
    }

    function captureMindDrawerState(instance) {
      if (!instance || !instance.container || typeof instance.container.closest !== 'function') return null;
      var drawerEl = instance.container.closest('.drawer');
      if (!drawerEl || !drawerEl.classList) return null;
      return {
        fullscreen: Boolean(
          drawerFullscreenPort &&
          typeof drawerFullscreenPort.is === 'function' &&
          drawerFullscreenPort.is(drawerEl)
        ),
      };
    }

    function restoreMindViewState(instance, viewState) {
      if (!instance || !instance.map || !instance.container || !viewState) return false;
      if (instance.container) {
        instance.container.scrollLeft = Number(viewState.scrollLeft || 0);
        instance.container.scrollTop = Number(viewState.scrollTop || 0);
      }
      if (viewState.transform && instance.map.style) {
        instance.map.style.transform = String(viewState.transform);
      }
      var scaleVal = Number(viewState.scaleVal);
      if (isFinite(scaleVal) && scaleVal > 0) {
        instance.scaleVal = scaleVal;
      }
      if (typeof instance.__tapSyncZoomMinScale === 'function') {
        instance.__tapSyncZoomMinScale();
      }
      if (typeof instance.__tapSyncCtrlWheelMinScale === 'function') {
        instance.__tapSyncCtrlWheelMinScale(true);
      }
      return true;
    }

    function restoreMindAnchorState(instance, anchorState) {
      if (!instance || !anchorState || !anchorState.nodeId) {
        return false;
      }
      var nodeEl = findMindNodeElement(instance, anchorState.nodeId);
      var anchorEl = resolveMindAnchorElement(nodeEl);
      if (!anchorEl || !anchorEl.getBoundingClientRect) return false;
      var nodeRect = anchorEl.getBoundingClientRect();
      var currentCenterX = Number(nodeRect.left + (nodeRect.width / 2));
      var currentCenterY = Number(nodeRect.top + (nodeRect.height / 2));
      var desiredCenterX = Number(anchorState.centerX);
      var desiredCenterY = Number(anchorState.centerY);
      if (!isFinite(currentCenterX) || !isFinite(currentCenterY) || !isFinite(desiredCenterX) || !isFinite(desiredCenterY)) {
        return false;
      }
      var deltaX = desiredCenterX - currentCenterX;
      var deltaY = desiredCenterY - currentCenterY;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
      var transformState = parseMindTransformState(instance.map && instance.map.style ? instance.map.style.transform : '');
      transformState.x += deltaX;
      transformState.y += deltaY;
      return writeMindTransformState(instance, transformState);
    }

    function scheduleMindViewRestore(instance, viewState, anchorState, options) {
      if (!instance || !viewState) return;
      var forceRestore = Boolean(options && options.force === true);
      var shouldRestoreAnchor = !(viewState && viewState.skipAnchorAlign === true) && Boolean(anchorState);
      [0, 16, 48, 96, 180, 320, 520].forEach(function(delayMs) {
        setTimeout(function() {
          if (!isActiveMindRenderInstance(instance)) return;
          if (!forceRestore && delayMs > 0 && instance.__tapViewportInteracted === true) return;
          restoreMindViewState(instance, viewState);
          if (shouldRestoreAnchor) {
            restoreMindAnchorState(instance, anchorState);
          }
        }, delayMs);
      });
    }

    function scheduleMindAnchorRestore(instance, anchorState) {
      if (!instance || !anchorState) return;
      [0, 16, 48, 96, 180, 320, 520, 760, 1080].forEach(function(delayMs) {
        setTimeout(function() {
          if (!isActiveMindRenderInstance(instance)) return;
          if (delayMs > 0 && instance.__tapViewportInteracted === true) return;
          restoreMindAnchorState(instance, anchorState);
        }, delayMs);
      });
    }

    function isActiveMindRenderInstance(instance) {
      if (!instance || !instance.map || !instance.el || !instance.el.isConnected) return false;
      var host = instance.__tapHostContainer || null;
      var token = instance.__tapRenderSessionToken ? String(instance.__tapRenderSessionToken || '') : '';
      if (host && token) {
        var activeToken = host.__tapActiveMindRenderToken ? String(host.__tapActiveMindRenderToken || '') : '';
        if (activeToken && activeToken !== token) return false;
      }
      return true;
    }

    function centerMindNode(instance, nodeId) {
      if (!instance || !nodeId || !instance.map) {
        return false;
      }
      var nodeEl = findMindNodeElement(instance, nodeId);
      var anchorEl = resolveMindAnchorElement(nodeEl);
      if (!anchorEl || !anchorEl.getBoundingClientRect) return false;
      var viewerEl = instance.el && instance.el.getBoundingClientRect
        ? instance.el
        : (instance.container && instance.container.getBoundingClientRect ? instance.container : null);
      if (!viewerEl || !viewerEl.getBoundingClientRect) return false;
      var nodeRect = anchorEl.getBoundingClientRect();
      var viewerRect = viewerEl.getBoundingClientRect();
      var currentCenterX = Number(nodeRect.left + (nodeRect.width / 2));
      var currentCenterY = Number(nodeRect.top + (nodeRect.height / 2));
      var desiredCenterX = Number(viewerRect.left + (viewerRect.width / 2));
      var desiredCenterY = Number(viewerRect.top + (viewerRect.height / 2));
      if (!isFinite(currentCenterX) || !isFinite(currentCenterY) || !isFinite(desiredCenterX) || !isFinite(desiredCenterY)) {
        return false;
      }
      var deltaX = desiredCenterX - currentCenterX;
      var deltaY = desiredCenterY - currentCenterY;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
      var transformState = parseMindTransformState(instance.map && instance.map.style ? instance.map.style.transform : '');
      transformState.x += deltaX;
      transformState.y += deltaY;
      return writeMindTransformState(instance, transformState);
    }

    function renderMindMap(container, mindData, options) {
      var opts = options || {};
      var ctor = getMindCtor();
      if (!ctor) throw new Error('MindElixir 依赖未就绪');
      if (!container) throw new Error('缺少思维导图容器');
      if (!mindData || !mindData.nodeData) throw new Error('缺少思维导图数据');

      var preservedViewState = opts && opts.preserveViewState === true
        ? captureMindViewState(opts.instance || null)
        : null;
      var preservedAnchorState = opts && opts.preserveViewState === true && opts.preserveAnchorNodeId
        ? captureMindAnchorState(opts.instance || null, opts.preserveAnchorNodeId)
        : null;
      var preservedAutoAnchorState = !preservedAnchorState && opts && opts.preserveViewState === true && opts.preserveAutoAnchor === true
        ? captureViewportCenterAnchorState(opts.instance || null)
        : null;
      var effectivePreservedAnchorState = preservedAnchorState || preservedAutoAnchorState;
      var preservedDrawerState = opts && opts.preserveViewState === true
        ? captureMindDrawerState(opts.instance || null)
        : null;
      var explicitInitialViewState = opts && opts.initialViewState && typeof opts.initialViewState === 'object'
        ? opts.initialViewState
        : null;
      var explicitInitialAnchorState = explicitInitialViewState && explicitInitialViewState.skipAnchorAlign === true
        ? null
        : (explicitInitialViewState && explicitInitialViewState.anchorState
        ? explicitInitialViewState.anchorState
        : (opts && opts.initialAnchorState && typeof opts.initialAnchorState === 'object'
          ? opts.initialAnchorState
          : null));
      var explicitInitialDrawerState = opts && opts.initialDrawerState && typeof opts.initialDrawerState === 'object'
        ? opts.initialDrawerState
        : null;
      if (
        opts &&
        opts.instance &&
        preservedDrawerState &&
        preservedDrawerState.fullscreen === true
      ) {
        opts.instance.__tapPreserveDrawerFullscreenOnDestroy = true;
      }
      destroyMindMap(opts.instance || null);
      container.innerHTML = '';

      var allowEdit = !(opts && opts.allowEdit === false);
      var exportEnabled = Boolean(opts && typeof opts.onExportXmind === 'function');
      var exportDisabledAttr = exportEnabled ? '' : ' disabled';
      var editGroupClass = allowEdit ? 'xmind-edit-group' : 'xmind-edit-group is-disabled';
      var controlsHtml = ''
        + '<div class="xmind-structure-controls" data-mind-controls>'
        + '<div class="xmind-controls-leading">'
        + '<div class="xmind-controls-leading-host" data-mind-leading-host></div>'
        + '</div>'
        + '<div class="xmind-controls-trailing">'
        + '<div class="xmind-controls-utility-host" data-mind-utility-host></div>'
        + '<div class="xmind-search-group">'
        + '<input class="xmind-search-input" type="search" data-mind-search-input placeholder="搜索节点内容" aria-label="搜索节点内容" />'
        + '<span class="xmind-search-count is-empty" data-mind-search-count>0/0</span>'
        + '<button class="secondary xmind-search-btn" type="button" data-mind-action="search-prev" title="上一个">↑</button>'
        + '<button class="secondary xmind-search-btn" type="button" data-mind-action="search-next" title="下一个">↓</button>'
        + '<button class="secondary xmind-search-btn" type="button" data-mind-action="search-clear" title="清空搜索">清空</button>'
        + '</div>'
        + '<div class="xmind-action-group">'
        + '<div class="xmind-zoom-group">'
        + '<button class="secondary xmind-zoom-btn" type="button" data-mind-action="zoom-out" title="缩小">-</button>'
        + '<button class="secondary xmind-zoom-btn" type="button" data-mind-action="zoom-fit" title="全览">全览</button>'
        + '<button class="secondary xmind-zoom-btn" type="button" data-mind-action="zoom-in" title="放大">+</button>'
        + '<button class="secondary xmind-zoom-btn xmind-fullscreen-btn" type="button" data-mind-action="drawer-fullscreen" title="全屏" aria-pressed="false">全屏</button>'
        + '<button class="secondary xmind-zoom-btn xmind-export-btn" type="button" data-mind-action="export-xmind" title="导出当前XMind"' + exportDisabledAttr + '>导出XMind</button>'
        + '</div>'
        + '<div class="' + editGroupClass + '">'
        + '<button class="secondary xmind-edit-btn" type="button" data-mind-action="edit-enter">编辑</button>'
        + '<button class="secondary xmind-edit-btn hidden" type="button" data-mind-action="edit-cancel">取消</button>'
        + '<button class="secondary xmind-edit-btn hidden" type="button" data-mind-action="edit-save">确认保存</button>'
        + '<button class="secondary xmind-edit-op-btn hidden" type="button" data-mind-action="node-add" disabled>增加节点</button>'
        + '<button class="secondary xmind-edit-op-btn hidden" type="button" data-mind-action="node-delete" disabled>删除节点</button>'
        + '<button class="secondary xmind-edit-op-btn hidden" type="button" data-mind-action="undo" disabled>撤回改动</button>'
        + '<button class="secondary xmind-edit-op-btn hidden" type="button" data-mind-action="redo" disabled>恢复改动</button>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
      var canvasHtml = '<div class="xmind-structure-canvas" data-mind-canvas></div>';
      container.innerHTML = controlsHtml + canvasHtml;
      var canvasEl = container.querySelector('[data-mind-canvas]');
      if (!canvasEl) throw new Error('思维导图画布初始化失败');

      var sessionKey = opts && opts.editableSessionKey ? String(opts.editableSessionKey) : '';
      var restoredSession = sessionKey ? readMindEditSession(sessionKey) : null;
      var restoredCurrent = restoredSession && restoredSession.currentData && restoredSession.currentData.nodeData
        ? cloneMindDataObject(restoredSession.currentData)
        : null;
      var initialMindData = restoredCurrent || cloneMindDataObject(mindData) || mindData;
      var restoredEditing = Boolean(restoredSession && restoredSession.editing === true && restoredCurrent && restoredCurrent.nodeData);
      var forcedEditing = Boolean(opts && opts.initialEditing === true && initialMindData && initialMindData.nodeData);
      var initialEditing = Boolean(allowEdit && (restoredEditing || forcedEditing));
      var restoreCurrentSignature = buildMindDataSignature(restoredCurrent);
      var restoreNoticeSignature = restoredSession && restoredSession.restoreNoticeSignature
        ? String(restoredSession.restoreNoticeSignature)
        : '';
      var showRestoreNotice = Boolean(
        restoredEditing &&
        restoreCurrentSignature &&
        restoreCurrentSignature !== restoreNoticeSignature &&
        !(opts && opts.showRestoreNotice === false)
      );
      var restoreNoticeSignatureForSession = showRestoreNotice ? restoreCurrentSignature : restoreNoticeSignature;
      var baseMindData = restoredSession && restoredSession.baseData && restoredSession.baseData.nodeData
        ? cloneMindDataObject(restoredSession.baseData)
        : cloneMindDataObject(mindData);
      var initialCenterNodeId = opts && opts.initialCenterNodeId ? String(opts.initialCenterNodeId) : '';
      var eagerInitialCenter = Boolean(opts && opts.eagerInitialCenter === true && initialCenterNodeId);
      var disableDeferredInitialCenterRetry = Boolean(opts && opts.disableDeferredInitialCenterRetry === true && initialCenterNodeId);
      var renderSessionToken = 'mind-render-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

      var darkMode = typeof opts.darkMode === 'boolean' ? opts.darkMode : resolveDarkMode();
      var theme = buildTheme(darkMode);
      var direction = normalizeDirection(opts.direction, ctor);
      var instance = new ctor({
        el: canvasEl,
        direction: direction,
        editable: true,
        contextMenu: false,
        toolBar: false,
        keypress: true,
        selectionContainer: (typeof document !== 'undefined' && document && document.body) ? document.body : undefined,
        mouseSelectionButton: 0,
        allowUndo: true,
        overflowHidden: false,
        alignment: 'nodes',
        theme: theme || undefined,
      });
      container.__tapActiveMindRenderToken = renderSessionToken;
      instance.__tapRenderSessionToken = renderSessionToken;
      instance.__tapHostContainer = container;
      instance.newTopicName = '';
      instance.init({
        nodeData: initialMindData.nodeData,
        direction: direction,
      });
      detachMindDragGhost(instance);
      if (initialEditing) {
        if (typeof instance.enableEdit === 'function') {
          try {
            instance.enableEdit();
          } catch (err0) {
            // ignore
          }
        }
      } else if (typeof instance.disableEdit === 'function') {
        try {
          instance.disableEdit();
        } catch (err1) {
          // ignore
        }
      }

      var cleanup = bindViewerInteractions(container, canvasEl, instance, Object.assign({}, opts, {
        direction: direction,
        allowEdit: allowEdit,
        editableSessionKey: sessionKey,
        restoredSession: restoredSession,
        restoreNoticeSignature: restoreNoticeSignatureForSession,
        initialEditing: initialEditing,
        initialMindData: cloneMindDataObject(initialMindData),
        baseMindData: cloneMindDataObject(baseMindData),
      }));
      if (cleanup) {
        instance.__tapXmindCleanupList = [cleanup];
      } else {
        instance.__tapXmindCleanupList = [];
      }

      if (opts && typeof opts.onInstanceChange === 'function') {
        try {
          opts.onInstanceChange(instance);
        } catch (err2) {
          // ignore
        }
      }
      instance.getSelectedNodeMetas = function() {
        return collectSelectedNodeMetas();
      };

      var restoredViewState = false;
      if (preservedViewState && !initialEditing) {
        restoredViewState = restoreMindViewState(instance, preservedViewState);
        if (effectivePreservedAnchorState) {
          restoreMindAnchorState(instance, effectivePreservedAnchorState);
        }
        scheduleMindViewRestore(instance, preservedViewState, effectivePreservedAnchorState);
        if (effectivePreservedAnchorState) {
          scheduleMindAnchorRestore(instance, effectivePreservedAnchorState);
        }
      } else if (explicitInitialViewState && !initialEditing) {
        restoredViewState = restoreMindViewState(instance, explicitInitialViewState);
        if (explicitInitialAnchorState) {
          restoreMindAnchorState(instance, explicitInitialAnchorState);
        }
        scheduleMindViewRestore(instance, explicitInitialViewState, explicitInitialAnchorState);
        if (explicitInitialAnchorState) {
          scheduleMindAnchorRestore(instance, explicitInitialAnchorState);
        }
      }
      if (
        explicitInitialDrawerState
        && explicitInitialDrawerState.fullscreen === true
        && instance
        && typeof instance.__tapSetDrawerFullscreen === 'function'
      ) {
        instance.__tapSetDrawerFullscreen(true);
      }
      if (showRestoreNotice) {
        setTimeout(function() {
          var restoreMsg = '检测到上次未保存的内容编辑，已进行恢复，请继续完成编辑。';
          if (sessionKey && restoreNoticeSignatureForSession) {
            writeMindEditSession(sessionKey, Object.assign({}, restoredSession || {}, {
              restoreNoticeSignature: restoreNoticeSignatureForSession,
              restoreNoticeAt: Date.now(),
            }));
          }
          if (opts && typeof opts.showToast === 'function') {
            opts.showToast(restoreMsg, 'warn', 3000);
            return;
          }
          showMindToast(restoreMsg, 'warn', 3000);
        }, 0);
      }

      var initialAutoFitScale = 0;
      function runAutoScaleFitIfStable(forceRun) {
        if (!isActiveMindRenderInstance(instance) || typeof instance.scaleFit !== 'function') return false;
        if (!forceRun) {
          var current = resolveScale(instance);
          if (initialAutoFitScale > 0 && Math.abs(current - initialAutoFitScale) > 0.03) {
            return false;
          }
        }
        try {
          instance.scaleFit();
          if (typeof instance.__tapSyncZoomMinScale === 'function') {
            instance.__tapSyncZoomMinScale();
          }
          if (typeof instance.__tapSyncCtrlWheelMinScale === 'function') {
            instance.__tapSyncCtrlWheelMinScale(true);
          }
          initialAutoFitScale = resolveScale(instance);
          updateViewerDragState(container, instance, false);
          return true;
        } catch (err3) {
          // ignore
        }
        return false;
      }

      if (eagerInitialCenter && !initialEditing && !restoredViewState && isActiveMindRenderInstance(instance)) {
        runAutoScaleFitIfStable(true);
        centerMindNode(instance, initialCenterNodeId);
      }

      setTimeout(function() {
        if (!isActiveMindRenderInstance(instance)) return;
        if (initialEditing) {
          updateViewerDragState(container, instance, false);
          return;
        }
        if (restoredViewState) {
          updateViewerDragState(container, instance, false);
          return;
        }
        if (instance && instance.__tapViewportInteracted === true) {
          updateViewerDragState(container, instance, false);
          return;
        }
        runAutoScaleFitIfStable(true);
        if (initialCenterNodeId) {
          centerMindNode(instance, initialCenterNodeId);
        }
      }, 0);

      setTimeout(function() {
        if (!isActiveMindRenderInstance(instance)) return;
        if (initialEditing || restoredViewState) return;
        if (instance && instance.__tapViewportInteracted === true) return;
        if (disableDeferredInitialCenterRetry) return;
        runAutoScaleFitIfStable(false);
        if (initialCenterNodeId) {
          centerMindNode(instance, initialCenterNodeId);
        }
      }, 420);
      return instance;
    }

    function refreshMindTheme(instance, darkMode) {
      var ctor = getMindCtor();
      if (!instance || !ctor || typeof instance.changeTheme !== 'function') return false;
      var resolvedDark = typeof darkMode === 'boolean' ? darkMode : resolveDarkMode();
      var nextTheme = buildTheme(resolvedDark);
      if (!nextTheme) return false;
      try {
        instance.changeTheme(nextTheme, true);
        var detachedNodes = Array.isArray(instance.__tapDetachedNodes) ? instance.__tapDetachedNodes : [];
        detachedNodes.forEach(function(node) {
          syncDetachedGhostTheme(node, instance);
        });
        return true;
      } catch (err) {
        return false;
      }
    }

    return {
      getMindCtor: getMindCtor,
      resolveDarkMode: resolveDarkMode,
      buildPathsFromCases: buildPathsFromCases,
      buildMindDataFromCases: buildMindDataFromCases,
      buildMindDataFromPaths: buildMindDataFromPaths,
      centerMindNode: centerMindNode,
      renderMindMap: renderMindMap,
      hideOpenContextMenu: hideOpenContextMenu,
      refreshMindTheme: refreshMindTheme,
      destroyMindMap: destroyMindMap,
    };
  }

  window.app = window.app || {};
  window.app.mindElixirCore = { init: init };
})();
