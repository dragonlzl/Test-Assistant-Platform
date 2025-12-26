(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var config = ctx.config || {};
    var utils = ctx.utils || {};
    var setStatus = ctx.setStatus || utils.setStatus || function() {};
    var defaultSwitches = config.defaultPageGuideSwitches
      || (config.defaultSettings && typeof config.defaultSettings.pageGuideSwitches === 'object'
        ? config.defaultSettings.pageGuideSwitches
        : {});
    var drawerInstance = null;
    var lastTab = '';
    var skipInitialTab = '';
    var skipInitialConsumed = false;
    var titleEl = document.getElementById('pageGuideDrawerTitle');
    var bodyEl = document.getElementById('pageGuideDrawerBody');
    var guideTriggerBtn = document.getElementById('pageGuideTrigger');
    var xmindDrawerInstance = null;
    var xmindTitleEl = document.getElementById('xmindStructureDrawerTitle');
    var xmindBodyEl = document.getElementById('xmindStructureDrawerBody');

    var guideTipHtml = ''
      + '<div class="notice-card highlight page-guide-tip">'
      + '<h3>提示</h3>'
      + '<ul>'
      + '<li><strong>进入设置的“其他设置”页可以关闭每次进入的提示。</strong>如不需要自动弹出，可取消勾选对应页面。</li>'
      + '</ul>'
      + '</div>';

    function wrapSection(title, innerHtml) {
      return '<div class="page-guide-section">'
        + '<h4>' + title + '</h4>'
        + innerHtml
        + '</div>';
    }

    function buildTemplateDownloadBlock() {
      return ''
        + '<div class="notice-card highlight page-guide-template">'
        + '<p style="margin:0 0 10px;">可在【用例库】的【用例导入】页面，下载用例模板，也可以在此处下载模板。</p>'
        + '<div class="actions" style="gap:8px;">'
        + '<button type="button" class="secondary" data-guide-template="excel">Excel导入模板</button>'
        + '<button type="button" class="secondary" data-guide-template="xmind">XMind导入模板</button>'
        + '</div>'
        + '</div>';
    }

    function buildXmindEntryBlock() {
      return ''
        + '<div class="notice-card highlight page-guide-xmind">'
        + '<p style="margin:0 0 10px;">点击下方按钮查看 XMind 用例结构要求，确保层级完整便于系统解析。</p>'
        + '<button type="button" class="structure-pill" data-guide-xmind="open">'
        + '<span class="icon">?</span>'
        + '<span>查看 XMind 用例结构</span>'
        + '</button>'
        + '</div>';
    }

    function buildXmindStructureBlock() {
      var exampleCode = '[\n'
        + '  {\n'
        + '    "module": "解锁方式",\n'
        + '    "title": "人民币解锁",\n'
        + '    "priority": "P1",\n'
        + '    "preconditions": "未解锁皮肤",\n'
        + '    "steps": "进入商城或角色选择界面，选中皮肤，观察解锁方式",\n'
        + '    "expected": "解锁方式为人民币解锁"\n'
        + '  },\n'
        + '  {\n'
        + '    "module": "解锁方式",\n'
        + '    "title": "蓝币解锁",\n'
        + '    "priority": "P1",\n'
        + '    "preconditions": "未解锁皮肤",\n'
        + '    "steps": "进入商城或角色选择界面，选中皮肤，观察解锁方式",\n'
        + '    "expected": "解锁方式为蓝币解锁"\n'
        + '  },\n'
        + '  {\n'
        + '    "module": "通用",\n'
        + '    "title": "皮肤名字展示",\n'
        + '    "priority": "P1",\n'
        + '    "preconditions": "已拥有皮肤",\n'
        + '    "steps": "进入皮肤选择界面，观察皮肤在列表中的名称展示",\n'
        + '    "expected": "皮肤名称展示正常"\n'
        + '  }\n'
        + ']';
      return ''
        + '<div class="structure-card">'
        + '<h3 style="margin:0 0 10px;">XMind 用例层级要求</h3>'
        + '<p class="hint" style="margin:0 0 12px;">请严格按照“需求（根节点） → 模块 → 用例标题 → 优先级 → 前置条件 → 操作步骤 → 预期结果”七层结构填写。少任一层都会影响字段解析。</p>'
        + '<div class="structure-diagram">'
        + '<div class="structure-node node-root">需求（根）</div>'
        + '<div class="structure-node node-module">模块</div>'
        + '<div class="structure-node node-title">用例标题</div>'
        + '<div class="structure-node node-priority">优先级 (P0/P1/P2)</div>'
        + '<div class="structure-node node-pre">前置条件</div>'
        + '<div class="structure-node node-steps">操作步骤</div>'
        + '<div class="structure-node node-expected">预期结果</div>'
        + '</div>'
        + '<div class="structure-example">'
        + '<strong>编写示例</strong>'
        + '<div class="structure-image">'
        + '<img alt="XMind 用例结构示例：武器皮肤根节点与两条解锁用例" src="帮助例子.png"/>'
        + '</div>'
        + '<strong style="display:block;margin-top:10px;">导出结构</strong>'
        + '<code>' + exampleCode + '</code>'
        + '<p style="margin-top:8px;">同一根节点下可以继续添加其他模块与用例；若缺少根节点或其中某层，系统会降级为普通文本或字段缺失，建议严格遵循此结构，或直接上传拥有相同字段的 JSON/文本文件。</p>'
        + '</div>'
        + '</div>';
    }

    function ensureSwitches() {
      if (!state.settings || typeof state.settings !== 'object') {
        state.settings = {};
      }
      var base = (defaultSwitches && typeof defaultSwitches === 'object') ? defaultSwitches : {};
      var current = state.settings.pageGuideSwitches && typeof state.settings.pageGuideSwitches === 'object'
        ? state.settings.pageGuideSwitches
        : {};
      var merged = Object.assign({}, base);
      Object.keys(current).forEach(function(key) {
        if (typeof current[key] === 'boolean') merged[key] = current[key];
      });
      state.settings.pageGuideSwitches = merged;
      return merged;
    }

    function isEnabled(tab) {
      var switches = ensureSwitches();
      if (!tab) return false;
      if (!Object.prototype.hasOwnProperty.call(switches, tab)) return false;
      return switches[tab] !== false;
    }

    function isSettingsReady() {
      if (state && state.settingsReady === true) return true;
      if (window.app && window.app.settingsReady === true) return true;
      return false;
    }

    function shouldWaitForSettings() {
      if (isSettingsReady()) return false;
      var api = window.app && window.app.apiClient;
      if (!api || typeof api.getStoredToken !== 'function' || typeof api.listSettings !== 'function') return false;
      var token = api.getStoredToken();
      return Boolean(token);
    }

    function shouldSkipAutoOpen() {
      // 自动化运行时默认不弹出，避免遮挡交互；如需验证可通过本地标记强制开启。
      var isAutomation = false;
      var force = false;
      try {
        isAutomation = Boolean(navigator && navigator.webdriver);
      } catch (err) {
        isAutomation = false;
      }
      try {
        if (typeof localStorage !== 'undefined') {
          force = localStorage.getItem('tap-e2e-force-guide') === '1';
        }
      } catch (err) {
        force = false;
      }
      if (force) return false;
      return isAutomation;
    }

    function getActiveTab() {
      if (state && state.activeTab) return state.activeTab;
      var btn = document.querySelector('[data-tab-btn].active');
      return btn && btn.dataset ? btn.dataset.tabBtn || '' : '';
    }

    function detectReloadSkip(tab) {
      var isReload = false;
      try {
        if (typeof performance !== 'undefined') {
          var entries = performance.getEntriesByType && performance.getEntriesByType('navigation');
          if (entries && entries.length) {
            isReload = entries[0].type === 'reload';
          } else if (performance.navigation) {
            isReload = performance.navigation.type === 1;
          }
        }
      } catch (err) {
        isReload = false;
      }
      if (!isReload) return;
      var fromTab = '';
      try {
        if (typeof sessionStorage !== 'undefined') {
          fromTab = sessionStorage.getItem('tap-reload-source-tab') || '';
        }
      } catch (err) {
        fromTab = '';
      }
      if (fromTab) skipInitialTab = fromTab;
    }

    function ensureDrawer() {
      if (drawerInstance) return drawerInstance;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      drawerInstance = window.app.drawer.createDrawer({
        drawerId: 'pageGuideDrawer',
        closeButtons: ['closePageGuideDrawerBtn'],
      });
      return drawerInstance;
    }

    function ensureXmindDrawer() {
      if (xmindDrawerInstance) return xmindDrawerInstance;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      xmindDrawerInstance = window.app.drawer.createDrawer({
        drawerId: 'xmindStructureDrawer',
        closeButtons: ['closeXmindStructureDrawerBtn'],
      });
      return xmindDrawerInstance;
    }

    function openXmindDrawer() {
      var drawer = ensureXmindDrawer();
      if (!drawer) return;
      if (xmindTitleEl) xmindTitleEl.textContent = 'XMind 用例结构';
      if (xmindBodyEl) xmindBodyEl.innerHTML = buildXmindStructureBlock();
      drawer.open();
    }

    function buildAutoGuide() {
      var intro = '<p>用于一键执行，对导入的需求和用例进行评审，分析需求不明确点，并指出用例缺漏。</p>';
      var flow = ''
        + '<ol class="page-guide-steps">'
        + '<li>Step1 导入需求、导入用例。</li>'
        + '<li>Step2 点击“自动执行工作流”模块的 <span class="page-guide-button">【一键执行】</span> 按钮。'
        + '<ul>'
        + '<li>可选操作：勾选 <span class="page-guide-button">【需要人工确认需求澄清后再继续自动流程】</span>。</li>'
        + '<li>勾选后，在需求评审完成后会暂停，需人工确认澄清后才继续执行进入 Step3。</li>'
        + '</ul>'
        + '</li>'
        + '<li>Step3 等待覆盖率结果。'
        + '<ul>'
        + '<li>覆盖率少于 100%，需要人工确认是直接继续执行，还是重新清洗需求。</li>'
        + '<li>注意：重新清洗后覆盖率仍少于 100% 时，依然需要人工确认是否继续或再次清洗。</li>'
        + '<li>覆盖率等于 100%，则继续执行直到最后一步覆盖对比完成。</li>'
        + '</ul>'
        + '</li>'
        + '<li>Step4 覆盖对比完成。'
        + '<ul>'
        + '<li>点击 <span class="page-guide-button">【用例缺失测试点】</span> 下的 <span class="page-guide-button">【前往勾选缺失模块生成缺失用例】</span> 展开视图。</li>'
        + '<li>视图中勾选用例，选择下方 <span class="page-guide-button">【智能生成填充】</span> 或 <span class="page-guide-button">【生成用例】</span>，将自动跳转到“用例生成”。</li>'
        + '</ul>'
        + '</li>'
        + '</ol>';
      var notes = ''
        + '<ul class="page-guide-notes">'
        + '<li><span class="page-guide-button">【需要人工确认需求澄清后再继续自动流程】</span>：可选操作，勾选后流程在评审后暂停，需在澄清抽屉确认完成才会继续。</li>'
        + '<li><span class="page-guide-button">【一键执行】</span>：按顺序执行评审、清洗、对比、拆分与覆盖对比流程。</li>'
        + '<li><span class="page-guide-button">【覆盖缺失视图】</span>：展示清洗后需求缺失点，便于判断是否重新清洗。</li>'
        + '<li><span class="page-guide-button">【前往勾选缺失模块生成缺失用例】</span>：打开缺失模块视图并支持勾选生成用例。</li>'
        + '</ul>';
      return ''
        + wrapSection('页面功能简介', intro)
        + wrapSection('操作流程', flow)
        + wrapSection('必要说明', notes)
        + guideTipHtml;
    }

    function buildWorkflowGuide() {
      var intro = '<p>一键执行的拆分流程，可独立使用；后一步功能依赖上一步结果。</p>';
      var flow = ''
        + '<ol class="page-guide-steps">'
        + '<li>导入需求文档（前置：无）<ul><li>拖拽或点击导入需求，右侧可手工补充原始需求。</li></ul></li>'
        + '<li>需求评审（前置：导入需求文档）<ul><li>点击 <span class="page-guide-button">【需求分析】</span> 输出评审 JSON。</li></ul></li>'
        + '<li>需求清洗（前置：需求评审）<ul><li>点击 <span class="page-guide-button">【开始清洗】</span> 生成结构化清洗结果。</li></ul></li>'
        + '<li>对比完整性（前置：需求清洗）<ul><li>点击 <span class="page-guide-button">【开始对比】</span> 获取覆盖率，低于 100% 可回到清洗修正。</li></ul></li>'
        + '<li>测试模块拆分（前置：对比完整性）<ul><li>点击 <span class="page-guide-button">【开始拆分】</span> 生成测试模块与测点。</li></ul></li>'
        + '<li>用例导入（前置：无）<ul><li>导入 XMind/文本用例，为覆盖对比提供用例数据。</li></ul></li>'
        + '<li>测试用例覆盖对比（前置：测试模块拆分、用例导入）<ul><li>点击 <span class="page-guide-button">【执行覆盖对比】</span> 输出覆盖率与缺失模块。</li></ul></li>'
        + '</ol>';
      var notes = ''
        + '<ul class="page-guide-notes">'
        + '<li><span class="page-guide-button">【需求分析】</span>：输出评审问题 JSON，供澄清与补全。</li>'
        + '<li><span class="page-guide-button">【开始清洗】</span>：生成整理后的需求条目，供后续拆分。</li>'
        + '<li><span class="page-guide-button">【开始对比】</span>：检查清洗结果是否覆盖原需求。</li>'
        + '<li><span class="page-guide-button">【开始拆分】</span>：得到测试模块/测点，供用例生成。</li>'
        + '<li><span class="page-guide-button">【执行覆盖对比】</span>：对比拆分模块与导入用例，输出缺失点。</li>'
        + '<li><span class="page-guide-button">【前往勾选缺失模块生成缺失用例】</span>：进入缺失模块视图并跳转到用例生成。</li>'
        + '</ul>';
      return ''
        + wrapSection('页面功能简介', intro)
        + wrapSection('操作流程', flow)
        + wrapSection('必要说明', notes)
        + guideTipHtml;
    }

    function buildCaseGenGuide() {
      var intro = '<p>基于测试模块拆分结果生成结构化测试用例，支持导出、入库与转执行。</p>';
      var flow = ''
        + '<ol class="page-guide-steps">'
        + '<li>从“测试模块拆分”或“缺失模块视图”进入时，会自动带入模块列表。</li>'
        + '<li>在模块卡片中点击 <span class="page-guide-button">【生成用例】</span> 或补全按钮，等待模型生成。</li>'
        + '<li>在模块内勾选用例，或点击 <span class="page-guide-button">【全模块用例视图】</span> 集中查看与勾选。</li>'
        + '<li>选择入库方式（直接入库 / 入库并转到执行），点击 <span class="page-guide-button">【新用例入库】</span> 或 <span class="page-guide-button">【旧用例追加入库】</span> 完成入库。</li>'
        + '<li>可按需导出 TXT / XMind 文件用于外部共享。</li>'
        + '</ol>';
      var rules = ''
        + '<ul class="page-guide-notes">'
        + '<li><span class="page-guide-button">【生成用例】</span>：对单个模块生成用例，会覆盖该模块已有结果。</li>'
        + '<li><span class="page-guide-button">【补全生成】</span>：仅对已有结果的模块补充用例，不覆盖原结果。</li>'
        + '<li><span class="page-guide-button">【全模块直接生成】</span>：对未生成中的模块批量执行“生成用例”；存在已生成数据时会二次确认，取消则全部不执行。</li>'
        + '<li><span class="page-guide-button">【全模块补全生成】</span>：仅对已有结果且未生成中的模块批量补全，无可补全模块时不可点击。</li>'
        + '<li>模块生成中会被跳过；全部生成中时全模块按钮不可点击。</li>'
        + '</ul>';
      var notes = ''
        + '<ul class="page-guide-notes">'
        + '<li><span class="page-guide-button">【全模块用例视图】</span>：汇总当前勾选用例，支持批量选中与入库。</li>'
        + '<li><span class="page-guide-button">【新用例入库】</span>：将勾选用例作为新用例文件写入用例库。</li>'
        + '<li><span class="page-guide-button">【旧用例追加入库】</span>：将勾选用例追加到已存在的用例文件。</li>'
        + '<li><span class="page-guide-button">【导出全部用例TXT】</span> / <span class="page-guide-button">【导出全部勾选用例XMind】</span>：导出当前结果用于外部共享。</li>'
        + '</ul>';
      return ''
        + wrapSection('页面功能简介', intro)
        + wrapSection('操作流程', flow)
        + wrapSection('生成规则与区别', rules)
        + wrapSection('必要说明', notes)
        + guideTipHtml;
    }

    function buildAssignGuide() {
      var intro = '<p>为各功能流程指派使用模型，统一输出风格与质量。</p>';
      var flow = ''
        + '<ol class="page-guide-steps">'
        + '<li>在每个功能卡片选择对应模型，必要时调整提示词与温度。</li>'
        + '<li>确认全部指派后点击 <span class="page-guide-button">【保存指派】</span>。</li>'
        + '<li>需要验证模型时可先点击对应的 <span class="page-guide-button">【测试连通性】</span>。</li>'
        + '</ol>';
      var notes = ''
        + '<ul class="page-guide-notes">'
        + '<li><span class="page-guide-button">【保存指派】</span>：保存当前指派，后续流程将使用对应模型。</li>'
        + '<li><span class="page-guide-button">【测试连通性】</span>：验证模型配置可用性，避免执行时报错。</li>'
        + '</ul>';
      return ''
        + wrapSection('页面功能简介', intro)
        + wrapSection('操作流程', flow)
        + wrapSection('必要说明', notes)
        + guideTipHtml;
    }

    function buildModelsGuide() {
      var intro = '<p>维护可用模型配置，供清洗、评审、对比与用例生成等功能调用。</p>';
      var flow = ''
        + '<ol class="page-guide-steps">'
        + '<li>点击 <span class="page-guide-button">【新增模型】</span>，填写模型名称、接口地址、API Key、模型 ID 与 Max Tokens。</li>'
        + '<li>点击 <span class="page-guide-button">【保存模型】</span>，模型会出现在列表中。</li>'
        + '<li>根据需要调整 <span class="page-guide-button">【模型超时时间】</span> 并保存。</li>'
        + '</ol>';
      var notes = ''
        + '<ul class="page-guide-notes">'
        + '<li><span class="page-guide-button">【保存超时设置】</span>：控制模型请求超时，建议 30-1800 秒。</li>'
        + '<li><span class="page-guide-button">【测试连通性】</span>：验证当前模型配置是否可用。</li>'
        + '<li>API Key 等敏感信息仅保存在本地浏览器。</li>'
        + '<li>模型配置将用于“功能指派”，建议统一指派高质量模型。</li>'
        + '</ul>';
      return ''
        + wrapSection('页面功能简介', intro)
        + wrapSection('操作流程', flow)
        + wrapSection('必要说明', notes)
        + guideTipHtml;
    }

    function buildTempExecGuide() {
      var intro = '<p>执行用例的主要界面，可导入用例、分配执行人、维护执行结果并归档。</p>';
      var flow = ''
        + '<ol class="page-guide-steps">'
        + '<li><span class="page-guide-star">*</span>执行开始方式（任选其一）：'
        + '<ul>'
        + '<li>方式一：点击顶部导航 <span class="page-guide-button">【用例导入】</span>。'
        + '<ul>'
        + '<li>Step1 拖拽用例到导入区，或点击导入区选择用例。</li>'
        + '<li>Step2 选择项目、版本后点击 <span class="page-guide-button">【确认入库】</span>。</li>'
        + '<li>Step3 用例会出现在当前页面，可直接执行。</li>'
        + '</ul>'
        + '</li>'
        + '<li>方式二：点击顶部导航 <span class="page-guide-button">【选择用例执行】</span>。'
        + '<ul>'
        + '<li>Step1 直接打开选择用例执行抽屉，勾选用例。</li>'
        + '<li>Step2 点击 <span class="page-guide-button">【转到执行】</span> 或右上角 <span class="page-guide-button">【批量转到执行】</span>。</li>'
        + '<li>Step3 自动跳回用例执行页，开始执行。</li>'
        + '</ul>'
        + '</li>'
        + '</ul>'
        + '</li>'
        + '<li>用例展示与切换：'
        + '<ul>'
        + '<li>方式一：工具栏（搜索框所在栏）点击 <span class="page-guide-button">【上一份】</span>/<span class="page-guide-button">【下一份】</span>。</li>'
        + '<li>方式二：点击顶部导航 <span class="page-guide-button">【执行分配】</span>，在项目分组/版本盒子中点击用例切换。</li>'
        + '</ul>'
        + '</li>'
        + '<li><span class="page-guide-star">*</span>专注区：'
        + '<ul>'
        + '<li>进入 <span class="page-guide-button">【执行分配】</span>，拖拽用例到专注区。</li>'
        + '<li>专注用例会同步到执行页工具栏的专注区，便于快速切换。</li>'
        + '</ul>'
        + '</li>'
        + '</ol>';
      var notes = ''
        + '<ul class="page-guide-notes">'
        + '<li><span class="page-guide-star">*</span><span class="page-guide-button">【归档】</span>：归档当前执行集并写入数据库，可在“用例归档”查看。</li>'
        + '<li><span class="page-guide-button">【解散归档】</span>：解除归档状态并回到版本盒子；不解散会一直保留在版本盒子中。</li>'
        + '<li>其他按钮（上一份/下一份、确认入库、转到执行等）用于切换与入库操作。</li>'
        + '</ul>';
      return ''
        + wrapSection('页面功能简介', intro)
        + wrapSection('操作流程', flow)
        + wrapSection('必要说明', notes)
        + wrapSection('用例导入模板', buildTemplateDownloadBlock())
        + wrapSection('XMind 用例结构', buildXmindEntryBlock())
        + guideTipHtml;
    }

    function buildCaseLibraryGuide() {
      var intro = '<p>集中管理用例库文件与条目，支持导入、编辑、转执行与历史查看。</p>';
      var flow = ''
        + '<ol class="page-guide-steps">'
        + '<li>点击顶部导航 <span class="page-guide-button">【导入用例】</span>，选择文件、项目与版本后点击 <span class="page-guide-button">【确认入库】</span>。</li>'
        + '<li>点击 <span class="page-guide-button">【查看&编辑】</span>，搜索并编辑用例条目。</li>'
        + '<li>点击 <span class="page-guide-button">【选择用例执行】</span>，勾选用例并转到执行。</li>'
        + '<li>点击 <span class="page-guide-button">【用例改动历史】</span> 查看导入、覆盖、编辑记录。</li>'
        + '</ol>';
      var notes = ''
        + '<ul class="page-guide-notes">'
        + '<li><span class="page-guide-button">【确认入库】</span>：完成导入写库，支持同名差异对比。</li>'
        + '<li><span class="page-guide-button">【转到执行】</span> / <span class="page-guide-button">【批量转到执行】</span>：将选中用例同步到执行页。</li>'
        + '<li>编辑或删除会记录历史，可在历史视图回溯。</li>'
        + '</ul>';
      return ''
        + wrapSection('页面功能简介', intro)
        + wrapSection('操作流程', flow)
        + wrapSection('必要说明', notes)
        + wrapSection('用例导入模板', buildTemplateDownloadBlock())
        + wrapSection('XMind 用例结构', buildXmindEntryBlock())
        + guideTipHtml;
    }

    function buildCaseArchiveGuide() {
      var intro = '<p>查看已归档的执行用例记录，支持按项目与版本筛选。</p>';
      var flow = ''
        + '<ol class="page-guide-steps">'
        + '<li>点击顶部导航 <span class="page-guide-button">【查看归档】</span> 打开筛选抽屉。</li>'
        + '<li>选择项目/版本并搜索，点击 <span class="page-guide-button">【查看】</span> 进入详情。</li>'
        + '<li>在详情页可搜索用例条目，点击 <span class="page-guide-button">【返回查看归档】</span> 返回列表。</li>'
        + '</ol>';
      var notes = ''
        + '<ul class="page-guide-notes">'
        + '<li>归档数据只读，来源于执行页归档操作。</li>'
        + '<li><span class="page-guide-button">【清空搜索】</span> 可快速重置筛选条件。</li>'
        + '</ul>';
      return ''
        + wrapSection('页面功能简介', intro)
        + wrapSection('操作流程', flow)
        + wrapSection('必要说明', notes)
        + guideTipHtml;
    }

    function buildExecOverviewGuide() {
      var intro = '<p>按项目/版本查看执行进度，快速定位人员执行详情。</p>';
      var flow = ''
        + '<ol class="page-guide-steps">'
        + '<li>点击项目卡片进入项目视图。</li>'
        + '<li>选择版本后查看版本汇总与人员进度。</li>'
        + '<li>点击人员卡片或进度条，打开执行列表抽屉。</li>'
        + '<li>在抽屉中可搜索用例条目并查看最新状态。</li>'
        + '</ol>';
      var notes = ''
        + '<ul class="page-guide-notes">'
        + '<li><span class="page-guide-button">【刷新】</span>：重新拉取可访问项目与执行统计。</li>'
        + '<li>执行列表抽屉支持搜索模块、标题与状态。</li>'
        + '</ul>';
      return ''
        + wrapSection('页面功能简介', intro)
        + wrapSection('操作流程', flow)
        + wrapSection('必要说明', notes)
        + guideTipHtml;
    }

    var guideTemplates = {
      auto: buildAutoGuide(),
      clean: buildWorkflowGuide(),
      casesgen: buildCaseGenGuide(),
      assign: buildAssignGuide(),
      models: buildModelsGuide(),
      tempexec: buildTempExecGuide(),
      'case-library': buildCaseLibraryGuide(),
      'case-archive': buildCaseArchiveGuide(),
      'exec-overview': buildExecOverviewGuide(),
    };

    var guideTitles = {
      auto: '一键执行说明',
      clean: '功能流程说明',
      casesgen: '用例生成说明',
      assign: '功能指派说明',
      models: '模型管理说明',
      tempexec: '用例执行说明',
      'case-library': '用例库说明',
      'case-archive': '用例归档说明',
      'exec-overview': '执行总览说明',
    };

    function hasGuide(tab) {
      if (!tab) return false;
      return Boolean(guideTemplates[tab]);
    }

    function triggerTemplateDownload(kind) {
      var api = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
      if (!api) return;
      if (kind === 'excel' && typeof api.downloadImportExcelTemplate === 'function') {
        api.downloadImportExcelTemplate();
        return;
      }
      if (kind === 'xmind' && typeof api.downloadImportXmindTemplate === 'function') {
        api.downloadImportXmindTemplate();
      }
    }

    function bindGuideActions(tab) {
      if (!bodyEl || !tab) return;
      var excelBtn = bodyEl.querySelector('[data-guide-template="excel"]');
      if (excelBtn) {
        excelBtn.addEventListener('click', function() {
          triggerTemplateDownload('excel');
        });
      }
      var xmindBtn = bodyEl.querySelector('[data-guide-template="xmind"]');
      if (xmindBtn) {
        xmindBtn.addEventListener('click', function() {
          triggerTemplateDownload('xmind');
        });
      }
      var xmindGuideBtn = bodyEl.querySelector('[data-guide-xmind="open"]');
      if (xmindGuideBtn) {
        xmindGuideBtn.addEventListener('click', function() {
          openXmindDrawer();
        });
      }
    }

    function renderGuide(tab) {
      if (!bodyEl) return;
      var content = guideTemplates[tab] || '';
      if (!content) {
        bodyEl.innerHTML = '<p class="hint" style="margin:0;">暂无页面说明</p>';
      } else {
        bodyEl.innerHTML = '<div class="page-guide-content">' + content + '</div>';
      }
      if (titleEl) titleEl.textContent = guideTitles[tab] || '页面说明';
      bindGuideActions(tab);
    }

    function openGuide(tab) {
      if (!tab) return;
      var drawer = ensureDrawer();
      if (!drawer) return;
      renderGuide(tab);
      drawer.open();
    }

    function updateGuideTrigger(tab) {
      if (!guideTriggerBtn) return;
      var available = hasGuide(tab);
      guideTriggerBtn.disabled = !available;
      if (guideTriggerBtn.setAttribute) {
        guideTriggerBtn.setAttribute('aria-disabled', available ? 'false' : 'true');
        guideTriggerBtn.setAttribute('title', available ? '打开页面说明' : '当前页面暂无说明');
      }
    }

    function handleGuideTriggerClick() {
      var tab = getActiveTab();
      if (!tab || !hasGuide(tab)) return;
      openGuide(tab);
    }

    function shouldAutoOpen(tab) {
      if (!tab) return false;
      if (shouldSkipAutoOpen()) return false;
      if (!isEnabled(tab)) return false;
      if (lastTab && lastTab === tab) return false;
      if (skipInitialTab && !skipInitialConsumed && skipInitialTab === tab) {
        skipInitialConsumed = true;
        return false;
      }
      return true;
    }

    function handleTabActivated(e) {
      var tab = e && e.detail ? e.detail.tab : '';
      if (!tab) return;
      if (shouldWaitForSettings()) {
        updateGuideTrigger(tab);
        return;
      }
      if (shouldAutoOpen(tab)) openGuide(tab);
      lastTab = tab;
      updateGuideTrigger(tab);
    }

    ensureSwitches();
    detectReloadSkip(getActiveTab());
    try {
      window.addEventListener('app-tab-activated', handleTabActivated);
    } catch (err) {
      // ignore
    }
    try {
      window.addEventListener('app-settings-loaded', function() {
        var activeTab = getActiveTab();
        if (!activeTab) return;
        if (shouldAutoOpen(activeTab)) openGuide(activeTab);
        lastTab = activeTab;
        updateGuideTrigger(activeTab);
      });
    } catch (err) {
      // ignore
    }
    var initialTab = getActiveTab();
    if (initialTab) {
      setTimeout(function() {
        if (shouldWaitForSettings()) {
          updateGuideTrigger(initialTab);
          return;
        }
        if (shouldAutoOpen(initialTab)) openGuide(initialTab);
        lastTab = initialTab;
        updateGuideTrigger(initialTab);
      }, 0);
    }
    if (guideTriggerBtn) {
      guideTriggerBtn.addEventListener('click', handleGuideTriggerClick);
    }

    return {
      openGuide: openGuide,
    };
  }

  window.app = window.app || {};
  window.app.pageGuide = { init: init };
})();
