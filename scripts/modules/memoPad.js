(function() {
  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var utils = ctx.utils || {};
    var confirmDrawer = ctx.confirmDrawer || (window.app && window.app.confirmDrawer);
    var persistSettings = ctx.persistSettings || function() {};
    var escapeHtml = ctx.escapeHtml || (utils && utils.escapeHtml) || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    var panel = dom.memoPadPanel;
    var toggleBtn = dom.memoPadToggle;
    var tabLayer = dom.memoTabLayer;
    var tabList = dom.memoTabList;
    var tabAddBtn = dom.memoTabAddBtn;
    var body = dom.memoPadBody;
    var tabProgress = dom.memoTabProgress;
    var caseGenProgressPanel = dom.caseGenProgressPanel;
    var caseGenProgressList = dom.caseGenProgressList;

    if (!panel || !tabList || !tabAddBtn || !body) return {};

    var maxTabs = 3;
    var defaultTabName = '点击命名';
    var defaultItemPlaceholder = '点击输入';
    var editingTabId = '';
    var editingItemId = '';
    var pendingFocus = null;
    var layoutSyncToken = 0;

    function getStyleNumber(el, key) {
      if (!el || !window.getComputedStyle) return 0;
      var styles = window.getComputedStyle(el);
      var val = styles ? styles[key] : 0;
      var num = parseFloat(val || 0);
      return Number.isFinite(num) ? num : 0;
    }

    function getPanelGap(el) {
      if (!el || !window.getComputedStyle) return 0;
      var styles = window.getComputedStyle(el);
      var gap = styles && (styles.rowGap || styles.gap) ? (styles.rowGap || styles.gap) : 0;
      var num = parseFloat(gap || 0);
      return Number.isFinite(num) ? num : 0;
    }

    function resetPanelInlineStyle(el) {
      if (!el) return;
      el.style.flex = '';
      el.style.flexGrow = '';
      el.style.flexShrink = '';
      el.style.flexBasis = '';
      el.style.height = '';
      el.style.maxHeight = '';
    }

    function setPanelCompact(el) {
      if (!el) return;
      el.style.flex = '0 1 auto';
      el.style.flexGrow = '0';
      el.style.flexShrink = '1';
      el.style.flexBasis = 'auto';
      el.style.height = 'auto';
      el.style.maxHeight = 'none';
    }

    function getListContentHeight(listEl) {
      if (!listEl) return 0;
      var total = getStyleNumber(listEl, 'paddingTop') + getStyleNumber(listEl, 'paddingBottom');
      var gap = getPanelGap(listEl);
      var children = listEl.children ? Array.prototype.slice.call(listEl.children) : [];
      var count = 0;
      children.forEach(function(child) {
        if (!child) return;
        total += child.getBoundingClientRect().height;
        count += 1;
      });
      if (count > 1) total += gap * (count - 1);
      return total;
    }

    function getCasePanelMetrics() {
      if (!caseGenProgressPanel || !caseGenProgressList) return { dataHeight: 0, fixedHeight: 0 };
      var head = caseGenProgressPanel.querySelector('.panel-head');
      var paddingY = getStyleNumber(caseGenProgressPanel, 'paddingTop') + getStyleNumber(caseGenProgressPanel, 'paddingBottom');
      var borderY = getStyleNumber(caseGenProgressPanel, 'borderTopWidth') + getStyleNumber(caseGenProgressPanel, 'borderBottomWidth');
      var gap = getPanelGap(caseGenProgressPanel);
      var fixedHeight = paddingY + borderY;
      var count = 0;
      if (head) {
        fixedHeight += head.getBoundingClientRect().height;
        count += 1;
      }
      if (caseGenProgressList) {
        count += 1;
      }
      if (count > 1) fixedHeight += gap * (count - 1);
      return {
        dataHeight: getListContentHeight(caseGenProgressList),
        fixedHeight: fixedHeight,
      };
    }

    function getMemoPanelMetrics() {
      if (!panel || !body) return { dataHeight: 0, fixedHeight: 0 };
      var head = panel.querySelector('.panel-head');
      var paddingY = getStyleNumber(panel, 'paddingTop') + getStyleNumber(panel, 'paddingBottom');
      var borderY = getStyleNumber(panel, 'borderTopWidth') + getStyleNumber(panel, 'borderBottomWidth');
      var gap = getPanelGap(panel);
      var fixedHeight = paddingY + borderY;
      var count = 0;
      if (head) {
        fixedHeight += head.getBoundingClientRect().height;
        count += 1;
      }
      if (tabLayer) {
        fixedHeight += tabLayer.getBoundingClientRect().height;
        count += 1;
      }
      if (body) {
        count += 1;
      }
      if (count > 1) fixedHeight += gap * (count - 1);
      var memoItems = body ? body.querySelector('.memo-items') : null;
      var addBtn = body ? body.querySelector('.memo-item-add') : null;
      var bodyPaddingY = getStyleNumber(body, 'paddingTop') + getStyleNumber(body, 'paddingBottom');
      var bodyBorderY = getStyleNumber(body, 'borderTopWidth') + getStyleNumber(body, 'borderBottomWidth');
      var bodyGap = getPanelGap(body);
      var bodyFixed = bodyPaddingY + bodyBorderY;
      if (addBtn) bodyFixed += addBtn.getBoundingClientRect().height;
      if (memoItems && addBtn) bodyFixed += bodyGap;
      return {
        dataHeight: memoItems ? getListContentHeight(memoItems) : 0,
        fixedHeight: fixedHeight + bodyFixed,
      };
    }

    function syncSidebarPanels() {
      if (!caseGenProgressPanel || !panel) return;
      if (caseGenProgressPanel.classList.contains('is-collapsed') || panel.classList.contains('is-collapsed')) {
        resetPanelInlineStyle(caseGenProgressPanel);
        resetPanelInlineStyle(panel);
        return;
      }
      resetPanelInlineStyle(caseGenProgressPanel);
      resetPanelInlineStyle(panel);
      var halfHeight = caseGenProgressPanel.getBoundingClientRect().height;
      if (!halfHeight) return;
      var caseMetrics = getCasePanelMetrics();
      var memoMetrics = getMemoPanelMetrics();
      var threshold = 4;
      var caseAvailable = halfHeight - caseMetrics.fixedHeight;
      var memoAvailable = halfHeight - memoMetrics.fixedHeight;
      if (caseAvailable < 0) caseAvailable = 0;
      if (memoAvailable < 0) memoAvailable = 0;
      var caseSmall = caseMetrics.dataHeight + threshold < caseAvailable;
      var memoSmall = memoMetrics.dataHeight + threshold < memoAvailable;
      if (caseSmall === memoSmall) return;
      if (caseSmall) setPanelCompact(caseGenProgressPanel);
      else setPanelCompact(panel);
    }

    function requestLayoutSync() {
      if (layoutSyncToken) return;
      var raf = window.requestAnimationFrame || function(cb) { return window.setTimeout(cb, 16); };
      layoutSyncToken = raf(function() {
        layoutSyncToken = 0;
        syncSidebarPanels();
      });
    }

    function ensureSettings() {
      if (!state.settings || typeof state.settings !== 'object') {
        state.settings = {};
      }
      return state.settings;
    }

    function createId(prefix) {
      var rand = Math.random().toString(36).slice(2, 8);
      return String(prefix || 'memo') + '-' + String(Date.now()) + '-' + rand;
    }

    function normalizeItem(item) {
      if (!item || typeof item !== 'object') return null;
      return {
        id: item.id ? String(item.id) : createId('memo-item'),
        text: typeof item.text === 'string' ? item.text : '',
        done: item.done === true,
      };
    }

    function getItemSortWeight(item) {
      if (item && item.done === true) return 2;
      var text = String((item && item.text) || '').trim();
      if (!text) return 1;
      return 0;
    }

    function orderItems(list) {
      if (!Array.isArray(list)) return [];
      if (list.length <= 1) return list;
      var mapped = list.map(function(item, idx) {
        return { item: item, idx: idx, weight: getItemSortWeight(item) };
      });
      mapped.sort(function(a, b) {
        if (a.weight !== b.weight) return a.weight - b.weight;
        return a.idx - b.idx;
      });
      return mapped.map(function(entry) { return entry.item; });
    }

    function normalizeTab(tab) {
      if (!tab || typeof tab !== 'object') {
        return { id: createId('memo-tab'), name: '', items: [] };
      }
      var items = Array.isArray(tab.items) ? tab.items.map(normalizeItem).filter(Boolean) : [];
      return {
        id: tab.id ? String(tab.id) : createId('memo-tab'),
        name: typeof tab.name === 'string' ? tab.name : '',
        items: items,
      };
    }

    function normalizeMemoPad(raw) {
      var memo = raw && typeof raw === 'object' ? raw : {};
      var tabs = Array.isArray(memo.tabs) ? memo.tabs.map(normalizeTab).filter(Boolean) : [];
      if (!tabs.length) {
        tabs = [{ id: 'memo-tab-1', name: '', items: [] }];
      }
      if (tabs.length > maxTabs) {
        tabs = tabs.slice(0, maxTabs);
      }
      var activeId = memo.activeTabId ? String(memo.activeTabId) : tabs[0].id;
      var hasActive = tabs.some(function(tab) { return tab.id === activeId; });
      if (!hasActive) activeId = tabs[0].id;
      memo.tabs = tabs;
      memo.activeTabId = activeId;
      memo.collapsed = memo.collapsed === true;
      return memo;
    }

    function getMemoPadState() {
      var settings = ensureSettings();
      var memo = normalizeMemoPad(settings.memoPad);
      settings.memoPad = memo;
      return memo;
    }

    function saveMemoPad() {
      if (typeof persistSettings === 'function') {
        persistSettings(['memoPad']);
      }
    }

    function setCollapsed(collapsed, shouldPersist) {
      var memo = getMemoPadState();
      memo.collapsed = collapsed === true;
      panel.classList.toggle('is-collapsed', memo.collapsed);
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', memo.collapsed ? 'false' : 'true');
        toggleBtn.textContent = memo.collapsed ? '展开' : '收起';
      }
      requestLayoutSync();
      if (shouldPersist === false) return;
      saveMemoPad();
    }

    function getActiveTab(memo) {
      if (!memo || !memo.tabs || !memo.tabs.length) return null;
      var active = memo.tabs.find(function(tab) { return tab.id === memo.activeTabId; });
      if (!active) {
        memo.activeTabId = memo.tabs[0].id;
        active = memo.tabs[0];
      }
      return active;
    }

    function renderTabProgress(memo) {
      if (!tabProgress) return;
      var activeTab = getActiveTab(memo);
      var doneCount = 0;
      var totalCount = 0;
      if (activeTab && Array.isArray(activeTab.items)) {
        activeTab.items.forEach(function(item) {
          var text = String((item && item.text) || '').trim();
          if (!text) return;
          totalCount += 1;
          if (item && item.done === true) doneCount += 1;
        });
      }
      tabProgress.textContent = doneCount + '/' + totalCount;
    }

    function renderTabs(memo) {
      var activeId = memo.activeTabId;
      var html = memo.tabs.map(function(tab) {
        var name = typeof tab.name === 'string' ? tab.name : '';
        var label = name.trim() ? escapeHtml(name) : defaultTabName;
        var isActive = tab.id === activeId;
        var isEditing = tab.id === editingTabId;
        var cls = 'memo-tab' + (isActive ? ' active' : '') + (isEditing ? ' editing' : '');
        return '' +
          '<div class="' + cls + '" data-memo-tab="' + tab.id + '">' +
            '<span class="memo-tab-label">' + label + '</span>' +
            '<input class="memo-tab-input" type="text" value="' + escapeHtml(name) + '" placeholder="' + defaultTabName + '" />' +
            '<button class="memo-tab-close" type="button" aria-label="关闭页签" data-memo-tab-close="' + tab.id + '">×</button>' +
          '</div>';
      }).join('');
      tabList.innerHTML = html;
      var isFull = memo.tabs.length >= maxTabs;
      tabAddBtn.classList.toggle('is-disabled', isFull);
    }

    function renderItems(memo) {
      var activeTab = getActiveTab(memo);
      if (!activeTab) {
        body.innerHTML = '<div class="memo-items"></div><button class="memo-item-add" type="button">+ 增加子项</button>';
        return;
      }
      var orderedItems = orderItems(activeTab.items);
      if (activeTab.items !== orderedItems) activeTab.items = orderedItems;
      var itemsHtml = orderedItems.map(function(item, idx) {
        var text = typeof item.text === 'string' ? item.text : '';
        var trimmed = text.trim();
        var displayText = trimmed ? escapeHtml(text) : defaultItemPlaceholder;
        var textClass = 'memo-item-text' + (trimmed ? '' : ' is-empty');
        var itemCls = 'memo-item' + (item.done ? ' is-done' : '') + (item.id === editingItemId ? ' editing' : '');
        return '' +
          '<div class="' + itemCls + '" data-memo-item="' + item.id + '">' +
            '<span class="memo-item-index">' + (idx + 1) + '</span>' +
            '<div class="memo-item-body">' +
              '<div class="' + textClass + '">' + displayText + '</div>' +
              '<textarea class="memo-item-input" rows="1" placeholder="' + defaultItemPlaceholder + '">' + escapeHtml(text) + '</textarea>' +
            '</div>' +
            '<button class="memo-item-toggle" type="button" aria-label="标记已办" aria-pressed="' + (item.done ? 'true' : 'false') + '" data-memo-item-toggle="' + item.id + '">✓</button>' +
            '<button class="memo-item-remove" type="button" aria-label="删除条目" data-memo-item-remove="' + item.id + '">×</button>' +
          '</div>';
      }).join('');
      body.innerHTML = '' +
        '<div class="memo-items">' + itemsHtml + '</div>' +
        '<button class="memo-item-add" type="button">+ 增加子项</button>';
    }

    function focusPending() {
      if (!pendingFocus) return;
      if (pendingFocus.type === 'tab') {
        var tabInput = tabList.querySelector('[data-memo-tab="' + pendingFocus.id + '"] .memo-tab-input');
        if (tabInput) {
          tabInput.focus();
          tabInput.select();
        }
      } else if (pendingFocus.type === 'item') {
        var itemInput = body.querySelector('[data-memo-item="' + pendingFocus.id + '"] .memo-item-input');
        if (itemInput) {
          itemInput.focus();
          itemInput.select();
        }
      }
      pendingFocus = null;
    }

    function renderMemoPad() {
      var memo = getMemoPadState();
      renderTabs(memo);
      renderItems(memo);
      renderTabProgress(memo);
      setCollapsed(memo.collapsed, false);
      focusPending();
      requestLayoutSync();
    }

    function setActiveTab(tabId) {
      var memo = getMemoPadState();
      if (memo.activeTabId === tabId) return;
      memo.activeTabId = tabId;
      editingTabId = '';
      editingItemId = '';
      renderMemoPad();
      saveMemoPad();
    }

    function startTabEditing(tabId) {
      var memo = getMemoPadState();
      var exists = memo.tabs.some(function(tab) { return tab.id === tabId; });
      if (!exists) return;
      editingTabId = tabId;
      pendingFocus = { type: 'tab', id: tabId };
      renderMemoPad();
    }

    function saveTabName(tabId, value) {
      var memo = getMemoPadState();
      var tab = memo.tabs.find(function(item) { return item.id === tabId; });
      if (!tab) return;
      tab.name = String(value || '').trim();
      editingTabId = '';
      renderMemoPad();
      saveMemoPad();
    }

    function cancelTabEditing() {
      if (!editingTabId) return;
      editingTabId = '';
      renderMemoPad();
    }

    function addTab() {
      var memo = getMemoPadState();
      if (memo.tabs.length >= maxTabs) {
        if (utils && typeof utils.showCenterToast === 'function') {
          utils.showCenterToast('页签已满，请先删除已有页签', 'warn', 2500);
        }
        return;
      }
      var tab = { id: createId('memo-tab'), name: '', items: [] };
      memo.tabs.push(tab);
      memo.activeTabId = tab.id;
      editingTabId = tab.id;
      editingItemId = '';
      pendingFocus = { type: 'tab', id: tab.id };
      renderMemoPad();
      saveMemoPad();
    }

    function deleteTab(tabId) {
      var memo = getMemoPadState();
      var tabIndex = memo.tabs.findIndex(function(tab) { return tab.id === tabId; });
      if (tabIndex < 0) return;
      var tab = memo.tabs[tabIndex];
      var pendingItems = (tab.items || []).filter(function(item) { return item && item.done !== true && String(item.text || '').trim(); });
      var message = '确认删除该页签及其中的备忘内容？';
      if (pendingItems.length) {
        var list = pendingItems.map(function(item, idx) {
          return (idx + 1) + '. ' + String(item.text || '').trim();
        }).join('\n');
        message += '\n待办事项：\n' + list;
      }
      var hint = pendingItems.length ? '仍可确认删除' : '';
      if (!confirmDrawer || typeof confirmDrawer.open !== 'function') {
        var ok = window.confirm(message);
        if (!ok) return;
        memo.tabs.splice(tabIndex, 1);
        if (!memo.tabs.length) {
          memo.tabs = [{ id: createId('memo-tab'), name: '', items: [] }];
        }
        if (!memo.tabs.some(function(t) { return t.id === memo.activeTabId; })) {
          memo.activeTabId = memo.tabs[0].id;
        }
        editingTabId = '';
        editingItemId = '';
        renderMemoPad();
        saveMemoPad();
        return;
      }
      confirmDrawer.open({
        title: '删除备忘页',
        message: message,
        hint: hint,
        hintType: pendingItems.length ? 'warn' : '',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (!result || !result.ok) return;
        memo.tabs.splice(tabIndex, 1);
        if (!memo.tabs.length) {
          memo.tabs = [{ id: createId('memo-tab'), name: '', items: [] }];
        }
        if (!memo.tabs.some(function(t) { return t.id === memo.activeTabId; })) {
          memo.activeTabId = memo.tabs[0].id;
        }
        editingTabId = '';
        editingItemId = '';
        renderMemoPad();
        saveMemoPad();
      });
    }

    function startItemEditing(itemId) {
      var memo = getMemoPadState();
      var activeTab = getActiveTab(memo);
      if (!activeTab) return;
      var exists = (activeTab.items || []).some(function(item) { return item.id === itemId; });
      if (!exists) return;
      editingItemId = itemId;
      pendingFocus = { type: 'item', id: itemId };
      renderMemoPad();
    }

    function saveItemText(itemId, value) {
      var memo = getMemoPadState();
      var activeTab = getActiveTab(memo);
      if (!activeTab) return;
      var item = (activeTab.items || []).find(function(entry) { return entry.id === itemId; });
      if (!item) return;
      item.text = String(value || '').trim();
      editingItemId = '';
      renderMemoPad();
      saveMemoPad();
    }

    function cancelItemEditing() {
      if (!editingItemId) return;
      editingItemId = '';
      renderMemoPad();
    }

    function addItem() {
      var memo = getMemoPadState();
      var activeTab = getActiveTab(memo);
      if (!activeTab) return;
      var item = { id: createId('memo-item'), text: '', done: false };
      activeTab.items.push(item);
      editingItemId = item.id;
      pendingFocus = { type: 'item', id: item.id };
      renderMemoPad();
      saveMemoPad();
    }

    function toggleItemDone(itemId) {
      var memo = getMemoPadState();
      var activeTab = getActiveTab(memo);
      if (!activeTab) return;
      var items = activeTab.items || [];
      var item = null;
      var idx = -1;
      for (var i = 0; i < items.length; i += 1) {
        if (items[i] && items[i].id === itemId) {
          item = items[i];
          idx = i;
          break;
        }
      }
      if (!item) return;
      var wasDone = item.done === true;
      item.done = !wasDone;
      if (!wasDone && item.done === true && idx >= 0 && idx < items.length - 1) {
        items.splice(idx, 1);
        items.push(item);
      }
      renderMemoPad();
      saveMemoPad();
    }

    function removeItem(itemId) {
      var message = '确认删除该备忘条目？';
      if (!confirmDrawer || typeof confirmDrawer.open !== 'function') {
        var ok = window.confirm(message);
        if (!ok) return;
        var memoFallback = getMemoPadState();
        var tabFallback = getActiveTab(memoFallback);
        if (!tabFallback) return;
        var idxFallback = (tabFallback.items || []).findIndex(function(entry) { return entry.id === itemId; });
        if (idxFallback < 0) return;
        tabFallback.items.splice(idxFallback, 1);
        editingItemId = '';
        renderMemoPad();
        saveMemoPad();
        return;
      }
      confirmDrawer.open({
        title: '删除备忘条目',
        message: message,
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (!result || !result.ok) return;
        var memoNext = getMemoPadState();
        var tabNext = getActiveTab(memoNext);
        if (!tabNext) return;
        var idxNext = (tabNext.items || []).findIndex(function(entry) { return entry.id === itemId; });
        if (idxNext < 0) return;
        tabNext.items.splice(idxNext, 1);
        editingItemId = '';
        renderMemoPad();
        saveMemoPad();
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        setCollapsed(!panel.classList.contains('is-collapsed'), true);
      });
    }

    tabAddBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      addTab();
    });

    tabList.addEventListener('click', function(e) {
      var inputEl = e.target && e.target.closest ? e.target.closest('.memo-tab-input') : null;
      if (inputEl) return;
      var closeBtn = e.target && e.target.closest ? e.target.closest('[data-memo-tab-close]') : null;
      if (closeBtn && closeBtn.dataset) {
        deleteTab(closeBtn.dataset.memoTabClose || '');
        return;
      }
      var tabEl = e.target && e.target.closest ? e.target.closest('[data-memo-tab]') : null;
      if (!tabEl || !tabEl.dataset) return;
      var tabId = tabEl.dataset.memoTab || '';
      if (!tabId) return;
      var memo = getMemoPadState();
      if (memo.activeTabId !== tabId) {
        setActiveTab(tabId);
        return;
      }
      if (editingTabId === tabId) return;
      startTabEditing(tabId);
    });

    tabList.addEventListener('keydown', function(e) {
      var target = e.target;
      if (!target || !target.classList || !target.classList.contains('memo-tab-input')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        target.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelTabEditing();
      }
    });

    tabList.addEventListener('blur', function(e) {
      var target = e.target;
      if (!target || !target.classList || !target.classList.contains('memo-tab-input')) return;
      var tabEl = target.closest('[data-memo-tab]');
      var tabId = tabEl && tabEl.dataset ? tabEl.dataset.memoTab : '';
      saveTabName(tabId, target.value);
    }, true);

    body.addEventListener('click', function(e) {
      var addBtn = e.target && e.target.closest ? e.target.closest('.memo-item-add') : null;
      if (addBtn) {
        addItem();
        return;
      }
      var toggle = e.target && e.target.closest ? e.target.closest('[data-memo-item-toggle]') : null;
      if (toggle && toggle.dataset) {
        toggleItemDone(toggle.dataset.memoItemToggle || '');
        return;
      }
      var removeBtn = e.target && e.target.closest ? e.target.closest('[data-memo-item-remove]') : null;
      if (removeBtn && removeBtn.dataset) {
        removeItem(removeBtn.dataset.memoItemRemove || '');
        return;
      }
      var textEl = e.target && e.target.closest ? e.target.closest('.memo-item-text') : null;
      if (textEl) {
        var itemEl = textEl.closest('[data-memo-item]');
        var itemId = itemEl && itemEl.dataset ? itemEl.dataset.memoItem : '';
        if (itemId) startItemEditing(itemId);
      }
    });

    body.addEventListener('keydown', function(e) {
      var target = e.target;
      if (!target || !target.classList || !target.classList.contains('memo-item-input')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        target.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelItemEditing();
      }
    });

    body.addEventListener('blur', function(e) {
      var target = e.target;
      if (!target || !target.classList || !target.classList.contains('memo-item-input')) return;
      var itemEl = target.closest('[data-memo-item]');
      var itemId = itemEl && itemEl.dataset ? itemEl.dataset.memoItem : '';
      saveItemText(itemId, target.value);
    }, true);

    try {
      window.addEventListener('app-settings-loaded', function() {
        renderMemoPad();
      });
    } catch (err) {
      // ignore
    }

    try {
      window.addEventListener('resize', requestLayoutSync);
    } catch (err) {
      // ignore
    }

    renderMemoPad();

    try {
      window.app = window.app || {};
      window.app.memoPadApi = window.app.memoPadApi || {};
      window.app.memoPadApi.renderMemoPad = renderMemoPad;
      window.app.sidebarPanels = window.app.sidebarPanels || {};
      window.app.sidebarPanels.requestLayoutSync = requestLayoutSync;
      window.app.sidebarPanels.syncLayoutNow = syncSidebarPanels;
    } catch (err) {
      // ignore
    }

    return {
      renderMemoPad: renderMemoPad,
    };
  }

  window.app = window.app || {};
  window.app.memoPad = { init: init };
})();
