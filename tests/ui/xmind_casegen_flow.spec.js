const fs = require('fs');
const { test, expect } = require('@playwright/test');

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+bB9sAAAAASUVORK5CYII=',
  'base64'
);

async function gotoCasesgenWorkflow(page, options) {
  const opts = options || {};
  if (opts.resetWorkflowStorage !== false) {
    await page.addInitScript((payload) => {
      try {
        if (typeof sessionStorage === 'undefined') return;
        var onceKey = String(payload && payload.onceKey ? payload.onceKey : '__pw-workflow-reset-once');
        if (sessionStorage.getItem(onceKey) === '1') return;
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(String(payload && payload.workflowKey ? payload.workflowKey : 'usecase-workflow-state-v1'));
        }
        sessionStorage.removeItem(String(payload && payload.activeTabKey ? payload.activeTabKey : 'usecase-active-tab'));
        sessionStorage.setItem(onceKey, '1');
      } catch (_) {}
    }, {
      workflowKey: 'usecase-workflow-state-v1',
      activeTabKey: 'usecase-active-tab',
      onceKey: '__pw-workflow-reset-once',
    });
  }
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/ai-workflow.html?tab=casesgen&_=' + Date.now().toString(36);
  await page.goto(url);
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  await page.waitForFunction(() => {
    var api = window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
    var globalObj = null;
    if (typeof MindElixir !== 'undefined') globalObj = MindElixir;
    else if (window && window.MindElixir) globalObj = window.MindElixir;
    var hasCtor = typeof globalObj === 'function' || Boolean(globalObj && typeof globalObj.default === 'function');
    return Boolean(api && typeof api.renderMindMap === 'function' && hasCtor);
  }, {}, { timeout: 20000 });
  await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
  return url;
}

async function captureBrowserStorageSnapshot(page, options) {
  const opts = options || {};
  const localKeys = Array.isArray(opts.localKeys) ? opts.localKeys.slice() : null;
  const sessionKeys = Array.isArray(opts.sessionKeys) ? opts.sessionKeys.slice() : null;
  return page.evaluate((payload) => {
    function dump(storage, keys) {
      var result = {};
      if (!storage) return result;
      if (Array.isArray(keys) && keys.length) {
        keys.forEach(function(key) {
          if (!key) return;
          try {
            var value = storage.getItem(String(key));
            if (value !== null && value !== undefined) {
              result[String(key)] = String(value);
            }
          } catch (_) {}
        });
        return result;
      }
      if (typeof storage.length !== 'number') return result;
      for (var i = 0; i < storage.length; i += 1) {
        var key = storage.key(i);
        if (!key) continue;
        result[String(key)] = String(storage.getItem(key) || '');
      }
      return result;
    }
    return {
      local: dump(typeof localStorage !== 'undefined' ? localStorage : null, payload && payload.localKeys),
      session: dump(typeof sessionStorage !== 'undefined' ? sessionStorage : null, payload && payload.sessionKeys),
    };
  }, {
    localKeys: localKeys,
    sessionKeys: sessionKeys,
  });
}

async function seedBrowserStorageSnapshot(page, snapshot) {
  await page.addInitScript((payload) => {
    function restore(storage, values) {
      if (!storage || !values || typeof values !== 'object') return;
      Object.keys(values).forEach(function(key) {
        try {
          storage.setItem(String(key), String(values[key] || ''));
        } catch (_) {}
      });
    }
    try {
      restore(typeof localStorage !== 'undefined' ? localStorage : null, payload && payload.local);
      restore(typeof sessionStorage !== 'undefined' ? sessionStorage : null, payload && payload.session);
    } catch (_) {}
  }, snapshot || { local: {}, session: {} });
}

async function mockCaseGenApisWithModel(page, token, user, options) {
  const opts = options || {};
  const modelRemoteId = opts.modelRemoteId || 901;
  const featureId = opts.featureId || 5001;
  const caseGenPrompt = opts.caseGenPrompt || '普通用例提示词';
  const xmindCaseGenPrompt = opts.xmindCaseGenPrompt || '基础提示词-XMind页';
  const modelBaseUrl = opts.modelBaseUrl || 'https://mock-model.local/v1/chat/completions';
  const modelName = opts.modelName || 'mock-model';
  const modelCapabilities = Array.isArray(opts.modelCapabilities) ? opts.modelCapabilities.slice() : [];
  const extraModels = Array.isArray(opts.extraModels) ? opts.extraModels.slice() : [];
  const modelId = String(modelRemoteId);
  const projects = Array.isArray(opts.projects) ? opts.projects : [];
  const versionsByProject = opts.versionsByProject && typeof opts.versionsByProject === 'object'
    ? opts.versionsByProject
    : {};
  const caseFilesByProject = opts.caseFilesByProject && typeof opts.caseFilesByProject === 'object'
    ? opts.caseFilesByProject
    : {};
  const caseItemsByCaseFile = opts.caseItemsByCaseFile && typeof opts.caseItemsByCaseFile === 'object'
    ? opts.caseItemsByCaseFile
    : {};

  await page.addInitScript((tk) => {
    try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
  }, token);

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;
    const method = route.request().method();
    const tokenHeader = route.request().headers().authorization || '';
    const authed = tokenHeader === `Bearer ${token}`;
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathName === '/api/users/me' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, user);
    }
    if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
    if (/^\/api\/projects\/[^/]+\/versions$/.test(pathName) && method === 'GET') {
      const projectId = String(pathName.split('/')[3] || '');
      return respond(200, Array.isArray(versionsByProject[projectId]) ? versionsByProject[projectId] : []);
    }
    if (pathName === '/api/case-files' && method === 'GET') {
      const projectId = String(url.searchParams.get('project_id') || '');
      return respond(200, Array.isArray(caseFilesByProject[projectId]) ? caseFilesByProject[projectId] : []);
    }
    if (pathName === '/api/case-files/import' && method === 'POST') {
      const body = route.request().postDataJSON ? route.request().postDataJSON() : {};
      return respond(200, {
        id: 9201,
        file_name_clean: body && body.file_name ? String(body.file_name).replace(/\.xmind$/i, '') : 'XMind入库结果',
        project_id: body && body.project_id ? Number(body.project_id) : null,
        version_id: body && body.version_id ? Number(body.version_id) : null,
      });
    }
    if (/^\/api\/case-files\/\d+\/items$/.test(pathName) && method === 'GET') {
      const caseFileId = String(pathName.split('/')[3] || '');
      return respond(200, Array.isArray(caseItemsByCaseFile[caseFileId]) ? caseItemsByCaseFile[caseFileId] : []);
    }
    if (/^\/api\/case-files\/\d+\/items\/append$/.test(pathName) && method === 'POST') {
      return respond(200, { appended: 1, overwritten: 0, skipped: 0 });
    }
    if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
    if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
    if (pathName === '/api/models' && method === 'GET') {
      const baseModel = {
        id: modelRemoteId,
        name: 'MockXmindCaseGenModel',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          provider: 'custom',
          baseUrl: modelBaseUrl,
          apiKey: 'mock-key',
          model: modelName,
          maxTokens: 1024,
          capabilities: modelCapabilities,
        },
      };
      return respond(200, [baseModel].concat(extraModels));
    }
    if (pathName === '/api/features' && method === 'GET') {
      return respond(200, [{
        id: featureId,
        name: 'default',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          caseGenId: modelId,
          caseGenPrompt: caseGenPrompt,
          xmindCaseGenId: modelId,
          xmindCaseGenPrompt: xmindCaseGenPrompt,
          xmindCaseGenReasoning: '',
          xmindCaseGenTemperature: 0.2,
        },
      }]);
    }
    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  });

  return { modelId: modelId };
}

async function installXmindProxyRecorder(page, options) {
  const input = options || {};
  const responseText = input.responseText || '{"modules":[]}';
  const status = Number(input.status || 200);
  await page.evaluate(({ responseText, status }) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client || typeof client.proxyModelRequest !== 'function') return;
    window.__xmindProxyCalls = [];
    client.proxyModelRequest = function(payload) {
      window.__xmindProxyCalls.push(JSON.parse(JSON.stringify(payload || {})));
      return Promise.resolve({
        ok: Number(status || 200) >= 200 && Number(status || 200) < 300,
        status: Number(status || 200),
        text: function() {
          return Promise.resolve(JSON.stringify({
            output: [{
              type: 'message',
              role: 'assistant',
              content: [{
                type: 'output_text',
                text: String(responseText || '{"modules":[]}'),
              }],
            }],
          }));
        },
      });
    };
  }, {
    responseText: String(responseText || '{"modules":[]}'),
    status: status,
  });
}

async function waitXmindModelAssigned(page, expectedModelId) {
  await page.waitForFunction((modelId) => {
    var state = window.app && window.app.state ? window.app.state : null;
    return Boolean(
      state &&
      state.assignments &&
      String(state.assignments.xmindCaseGenId || '') === String(modelId || '')
    );
  }, expectedModelId, { timeout: 10000 });
}

async function installXmindModelStub(page, delayMs) {
  await page.evaluate((delay) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    window.__xmindCasegenCalls = [];
    window.__xmindCasegenCounters = {};

    function flattenContent(content) {
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      return content.map(function(item) {
        if (!item || typeof item !== 'object') return '';
        if (item.type === 'text') return String(item.text || '');
        return '[image]';
      }).join('\n');
    }

    function parseJsonText(text) {
      var raw = String(text || '').trim();
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (err) {}
      var objStart = raw.indexOf('{');
      var objEnd = raw.lastIndexOf('}');
      if (objStart >= 0 && objEnd > objStart) {
        try {
          return JSON.parse(raw.slice(objStart, objEnd + 1));
        } catch (err2) {}
      }
      var arrStart = raw.indexOf('[');
      var arrEnd = raw.lastIndexOf(']');
      if (arrStart >= 0 && arrEnd > arrStart) {
        try {
          return JSON.parse(raw.slice(arrStart, arrEnd + 1));
        } catch (err3) {}
      }
      return null;
    }

    function extractSection(text, marker) {
      var source = String(text || '');
      var index = source.indexOf(marker);
      if (index === -1) return '';
      var rest = source.slice(index + marker.length);
      var next = rest.indexOf('\n\n【');
      if (next !== -1) rest = rest.slice(0, next);
      return String(rest || '').trim();
    }

    function nextCounter(key) {
      var map = window.__xmindCasegenCounters;
      var stableKey = String(key || 'default');
      map[stableKey] = Number(map[stableKey] || 0) + 1;
      return map[stableKey];
    }

    function makeCase(moduleName, title, index) {
      var order = Number(index) || 1;
      return {
        module: moduleName,
        title: title,
        priority: order % 2 === 0 ? 'P2' : 'P1',
        preconditions: moduleName + '前置条件',
        steps: [
          '1、进入' + moduleName,
          '2、执行' + title,
        ],
        expected: title + '执行成功',
      };
    }

    function makeModule(name, cases) {
      var list = Array.isArray(cases) ? cases : [];
      return {
        module: name,
        key_scenarios: [name + '主场景'],
        test_points: [name + '关键校验'],
        coupled_modules: [name + '关联模块'],
        cases: list,
      };
    }

    function shouldSimplifyDedupe(contract) {
      return window.__xmindCasegenDedupeTrim === true && Boolean(
        contract && (
          contract.simplify === true ||
          String(contract.dedupe_mode || '') === 'dedupe_simplify' ||
          String(contract.dedupeMode || '') === 'dedupe_simplify'
        )
      );
    }

    function buildDedupeResponseModules(userText, contract) {
      var dedupeModules = parseJsonText(extractSection(userText, '【需要去重精简的 AI 生成用例(JSON)】'));
      var sourceList = Array.isArray(dedupeModules) ? dedupeModules : [];
      var shouldTrim = shouldSimplifyDedupe(contract);
      return sourceList.map(function(item, index) {
        var moduleName = item && item.module ? String(item.module) : ('模块' + String(index + 1));
        var cases = Array.isArray(item && item.cases) ? item.cases.slice() : [];
        var nextCases = shouldTrim && cases.length > 1 ? cases.slice(0, 1) : cases;
        return makeModule(moduleName, nextCases);
      });
    }

    function buildDedupeRemovedCases(userText, contract) {
      var dedupeModules = parseJsonText(extractSection(userText, '【需要去重精简的 AI 生成用例(JSON)】'));
      var sourceList = Array.isArray(dedupeModules) ? dedupeModules : [];
      if (!shouldSimplifyDedupe(contract)) return [];
      var result = [];
      sourceList.forEach(function(item, index) {
        var moduleName = item && item.module ? String(item.module) : ('模块' + String(index + 1));
        var cases = Array.isArray(item && item.cases) ? item.cases : [];
        var keptTitle = cases[0] && cases[0].title ? String(cases[0].title || '') : '';
        cases.slice(1).forEach(function(caseItem, removedIndex) {
          var title = caseItem && caseItem.title ? String(caseItem.title || '') : '未命名用例';
          if (removedIndex % 2 === 0) {
            result.push({
              type: 'duplicate',
              module: moduleName,
              title: title,
              reason: '步骤重复',
              duplicate_with: keptTitle,
              duplicate_point: '校验目标相同',
            });
          } else {
            result.push({
              type: 'merge',
              module: moduleName,
              title: title,
              reason: '场景已合并',
              merged_from: [keptTitle, title],
              merged_into: keptTitle,
            });
          }
        });
      });
      return result;
    }

    function buildCoverageResponse(userText) {
      var segments = parseJsonText(extractSection(userText, '【需求片段(JSON)】'));
      var cases = parseJsonText(extractSection(userText, '【当前可见用例(JSON)】'));
      var segmentList = Array.isArray(segments) ? segments : [];
      var caseList = Array.isArray(cases) ? cases : [];
      var referenced = {};

      function findCaseId(keyword) {
        var found = '';
        caseList.some(function(item) {
          var title = String(item && item.title ? item.title : '');
          if (title.indexOf(keyword) === -1) return false;
          found = String(item.caseId || item.id || '');
          return true;
        });
        if (!found && caseList[0]) found = String(caseList[0].caseId || caseList[0].id || '');
        return found;
      }

      var responseSegments = segmentList.map(function(segment) {
        var text = String(segment && segment.text ? segment.text : '');
        var caseId = '';
        var status = 'uncovered';
        var reason = '暂无直接用例';
        if (text.indexOf('背景') !== -1 || text.indexOf('上下文') !== -1) {
          status = 'context';
          reason = '上下文说明';
        } else if (text.indexOf('成功') !== -1) {
          caseId = findCaseId('成功');
          status = caseId ? 'covered' : 'uncovered';
          reason = caseId ? '成功路径已覆盖' : reason;
        } else if (text.indexOf('失败') !== -1 || text.indexOf('错误') !== -1) {
          caseId = findCaseId('失败');
          status = caseId ? 'covered' : 'partial';
          reason = caseId ? '失败提示已覆盖' : '缺少完整失败校验';
        } else if (text.indexOf('退出登录') !== -1) {
          var relatedCaseId = findCaseId('会话');
          status = relatedCaseId ? 'partial' : 'uncovered';
          reason = relatedCaseId ? '存在关联会话校验' : reason;
          if (relatedCaseId) referenced[relatedCaseId] = true;
          return {
            segmentId: String(segment && segment.id ? segment.id : ''),
            status: status,
            caseIds: [],
            relatedCaseIds: relatedCaseId ? [relatedCaseId] : [],
            reason: reason,
          };
        }
        if (caseId) referenced[caseId] = true;
        return {
          segmentId: String(segment && segment.id ? segment.id : ''),
          status: status,
          caseIds: caseId ? [caseId] : [],
          relatedCaseIds: [],
          reason: reason,
        };
      });
      var unmapped = caseList.map(function(item) {
        return String(item && (item.caseId || item.id) ? (item.caseId || item.id) : '');
      }).filter(function(id) {
        return id && !referenced[id];
      });
      return {
        segments: responseSegments,
        unmapped_case_ids: unmapped,
        summary: {
          note: 'mock coverage response',
        },
      };
    }

    client.proxyModelRequest = function(payload, signal) {
      var modelPayload = payload && payload.payload ? payload.payload : {};
      var messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
      var promptText = flattenContent(messages[0] && messages[0].content);
      var userText = flattenContent(messages[1] && messages[1].content);
      var contract = parseJsonText(extractSection(userText, '【operation_contract(JSON)】'))
        || parseJsonText(extractSection(promptText, 'operation_contract(JSON)：'))
        || {};
      var visibleModules = parseJsonText(extractSection(userText, '【当前可见模块与用例(JSON)】'));
      var visibleList = Array.isArray(visibleModules) ? visibleModules : [];
      var firstVisibleModule = visibleList[0] && visibleList[0].module ? String(visibleList[0].module) : '登录模块';
      var targetModule = String(contract.targetModule || firstVisibleModule || '登录模块');
      var mode = String(contract.mode || '');
      var responseModules = [];

      if (mode === 'ai_dedupe_simplify') {
        responseModules = buildDedupeResponseModules(userText, contract);
      } else if (mode === 'requirement_coverage') {
        responseModules = [];
      } else if (mode === 'full_modules' || mode === 'regenerate_modules') {
        responseModules = [
          makeModule('登录模块'),
          makeModule('支付模块'),
        ];
      } else if (mode === 'full_cases') {
        responseModules = window.__xmindCasegenRootFullCasesModulesOnly === true
          ? [
            makeModule('登录模块'),
            makeModule('支付模块'),
          ]
          : [
            makeModule('登录模块', [
              makeCase('登录模块', '登录成功校验', 1),
              makeCase('登录模块', '登录失败提示', 2),
            ]),
            makeModule('支付模块', [
              makeCase('支付模块', '支付成功校验', 1),
              makeCase('支付模块', '支付失败提示', 2),
            ]),
          ];
      } else if (mode === 'existing_modules_cases') {
        responseModules = visibleList.map(function(item, index) {
          var moduleName = item && item.module ? String(item.module) : ('模块' + String(index + 1));
          return makeModule(moduleName, [
            makeCase(moduleName, moduleName + '-补全用例', 1),
          ]);
        });
      } else if (mode === 'topup_modules') {
        responseModules = [makeModule('消息模块')];
      } else if (mode === 'topup_modules_cases') {
        responseModules = [
          makeModule('技能按钮与界面状态', [
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-1', 1),
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-2', 2),
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-3', 3),
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-4', 4),
            makeCase('技能按钮与界面状态', '技能按钮与界面状态-补充-5', 5),
          ]),
          makeModule('异常状态与边界处理', [
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-1', 1),
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-2', 2),
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-3', 3),
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-4', 4),
            makeCase('异常状态与边界处理', '异常状态与边界处理-补充-5', 5),
          ]),
        ];
      } else if (mode === 'append_all_modules_cases') {
        var appendIndex = nextCounter('root:' + firstVisibleModule);
        responseModules = [
          makeModule(firstVisibleModule, [
            makeCase(firstVisibleModule, firstVisibleModule + '-追加-' + appendIndex, 1),
          ]),
          makeModule('消息模块', [
            makeCase('消息模块', '消息模块新增用例', 1),
          ]),
        ];
      } else if (mode === 'module_append_cases') {
        var moduleAppendIndex = nextCounter('module:' + targetModule);
        responseModules = [
          makeModule(targetModule, [
            makeCase(targetModule, targetModule + '-追加-' + moduleAppendIndex, 1),
          ]),
        ];
      } else if (mode === 'module_full_cases') {
        responseModules = String(window.__xmindCasegenEmptyModuleTitle || '') === targetModule
          ? [makeModule(targetModule, [])]
          : [
            makeModule(targetModule, [
              makeCase(targetModule, targetModule + '-完整-1', 1),
              makeCase(targetModule, targetModule + '-完整-2', 2),
            ]),
          ];
      } else {
        responseModules = [
          makeModule(targetModule, [
            makeCase(targetModule, targetModule + '-完整-1', 1),
            makeCase(targetModule, targetModule + '-完整-2', 2),
          ]),
        ];
      }

      window.__xmindCasegenCalls.push({
        prompt: promptText,
        user: userText,
        contract: contract,
        temperature: Number(modelPayload.temperature),
        responseModules: responseModules,
      });

      var content = JSON.stringify({ modules: responseModules });
      if (mode === 'ai_dedupe_simplify') {
        var removedCases = buildDedupeRemovedCases(userText, contract);
        content = JSON.stringify({
          modules: responseModules,
          removed_cases: removedCases,
          summary: {
            removed: removedCases.length,
            reason: removedCases.length ? '删除明显重复和高度重叠用例' : '未发现明显重复用例',
          },
        });
      } else if (mode === 'requirement_coverage') {
        content = JSON.stringify(buildCoverageResponse(userText));
      }
      var responseDelay = Number(delay) || 120;
      if (mode === 'ai_dedupe_simplify' && window.__xmindCasegenDedupeDelayMs !== undefined) {
        responseDelay = Number(window.__xmindCasegenDedupeDelayMs) || responseDelay;
      }
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          resolve({
            ok: true,
            status: 200,
            text: function() {
              return Promise.resolve(JSON.stringify({
                choices: [{ message: { content: content } }],
              }));
            },
          });
        }, responseDelay);
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', function() {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    };
  }, delayMs || 120);
}

async function installXmindModelRouteStub(page, delayMs) {
  const calls = [];

  function flattenContent(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content.map((item) => {
      if (!item || typeof item !== 'object') return '';
      if (item.type === 'text') return String(item.text || '');
      return '[image]';
    }).join('\n');
  }

  function parseJsonText(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {}
    const objStart = raw.indexOf('{');
    const objEnd = raw.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      try {
        return JSON.parse(raw.slice(objStart, objEnd + 1));
      } catch (_) {}
    }
    const arrStart = raw.indexOf('[');
    const arrEnd = raw.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
      try {
        return JSON.parse(raw.slice(arrStart, arrEnd + 1));
      } catch (_) {}
    }
    return null;
  }

  function extractSection(text, marker) {
    const source = String(text || '');
    const index = source.indexOf(marker);
    if (index === -1) return '';
    let rest = source.slice(index + marker.length);
    const next = rest.indexOf('\n\n【');
    if (next !== -1) rest = rest.slice(0, next);
    return String(rest || '').trim();
  }

  function makeCase(moduleName, title, index) {
    const order = Number(index) || 1;
    return {
      module: moduleName,
      title: title,
      priority: order % 2 === 0 ? 'P2' : 'P1',
      preconditions: moduleName + '前置条件',
      steps: [
        '1、进入' + moduleName,
        '2、执行' + title,
      ],
      expected: title + '执行成功',
    };
  }

  function makeModule(name, cases) {
    return {
      module: name,
      key_scenarios: [name + '主场景'],
      test_points: [name + '关键校验'],
      coupled_modules: [name + '关联模块'],
      cases: Array.isArray(cases) ? cases : [],
    };
  }

  function buildDedupeResponseModules(userText) {
    const dedupeModules = parseJsonText(extractSection(userText, '【需要去重精简的 AI 生成用例(JSON)】'));
    const sourceList = Array.isArray(dedupeModules) ? dedupeModules : [];
    return sourceList.map((item, index) => {
      const moduleName = item && item.module ? String(item.module) : `模块${index + 1}`;
      const cases = Array.isArray(item && item.cases) ? item.cases.slice() : [];
      return makeModule(moduleName, cases);
    });
  }

  await page.route('**/api/model-proxy', async (route) => {
    const request = route.request();
    const body = request.postDataJSON ? request.postDataJSON() : {};
    const modelPayload = body && body.payload ? body.payload : {};
    const messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
    const promptText = flattenContent(messages[0] && messages[0].content);
    const userText = flattenContent(messages[1] && messages[1].content);
    const contract = parseJsonText(extractSection(userText, '【operation_contract(JSON)】'))
      || parseJsonText(extractSection(promptText, 'operation_contract(JSON)：'))
      || {};
    const visibleModules = parseJsonText(extractSection(userText, '【当前可见模块与用例(JSON)】'));
    const visibleList = Array.isArray(visibleModules) ? visibleModules : [];
    const firstVisibleModule = visibleList[0] && visibleList[0].module
      ? String(visibleList[0].module)
      : '登录模块';
    const targetModule = String(contract.targetModule || firstVisibleModule || '登录模块');
    const mode = String(contract.mode || '');
    let responseModules = [];

    if (mode === 'ai_dedupe_simplify') {
      responseModules = buildDedupeResponseModules(userText);
    } else if (mode === 'full_modules' || mode === 'regenerate_modules') {
      responseModules = [
        makeModule('登录模块'),
        makeModule('支付模块'),
      ];
    } else if (mode === 'full_cases') {
      responseModules = [
        makeModule('登录模块', [
          makeCase('登录模块', '登录成功校验', 1),
          makeCase('登录模块', '登录失败提示', 2),
        ]),
        makeModule('支付模块', [
          makeCase('支付模块', '支付成功校验', 1),
          makeCase('支付模块', '支付失败提示', 2),
        ]),
      ];
    } else if (mode === 'module_full_cases' && targetModule === '登录模块') {
      responseModules = [
        makeModule('登录模块', [
          makeCase('登录模块', '登录成功校验', 1),
          makeCase('登录模块', '登录失败提示', 2),
        ]),
      ];
    } else if (mode === 'module_full_cases' && targetModule === '支付模块') {
      responseModules = [
        makeModule('支付模块', [
          makeCase('支付模块', '支付成功校验', 1),
          makeCase('支付模块', '支付失败提示', 2),
        ]),
      ];
    } else {
      responseModules = [
        makeModule(targetModule, [
          makeCase(targetModule, targetModule + '-完整-1', 1),
          makeCase(targetModule, targetModule + '-完整-2', 2),
        ]),
      ];
    }

    calls.push({
      mode,
      targetModule,
      responseModules,
    });
    if (Number(delayMs || 120) > 0) {
      await new Promise((resolve) => setTimeout(resolve, Number(delayMs || 120)));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        output: [{
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'output_text',
            text: JSON.stringify({ modules: responseModules }),
          }],
        }],
      }),
    });
  });

  return {
    getCalls() {
      return calls.slice();
    },
  };
}

async function installRootPipelineStaggeredStub(page) {
  await page.evaluate(() => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;

    function flattenContent(content) {
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      return content.map(function(item) {
        if (!item || typeof item !== 'object') return '';
        if (item.type === 'text') return String(item.text || '');
        return '[image]';
      }).join('\n');
    }

    function parseJsonText(text) {
      var raw = String(text || '').trim();
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (err) {}
      var objStart = raw.indexOf('{');
      var objEnd = raw.lastIndexOf('}');
      if (objStart >= 0 && objEnd > objStart) {
        try {
          return JSON.parse(raw.slice(objStart, objEnd + 1));
        } catch (err2) {}
      }
      return null;
    }

    function extractSection(text, marker) {
      var source = String(text || '');
      var index = source.indexOf(marker);
      if (index === -1) return '';
      var rest = source.slice(index + marker.length);
      var next = rest.indexOf('\n\n【');
      if (next !== -1) rest = rest.slice(0, next);
      return String(rest || '').trim();
    }

    function makeModule(name, cases) {
      return {
        module: name,
        key_scenarios: [name + '主场景'],
        test_points: [name + '关键校验'],
        coupled_modules: [name + '关联模块'],
        cases: Array.isArray(cases) ? cases : [],
      };
    }

    function makeCase(moduleName, title) {
      return {
        module: moduleName,
        title: title,
        priority: 'P1',
        preconditions: moduleName + '前置条件',
        steps: ['1、进入' + moduleName, '2、执行' + title],
        expected: title + '执行成功',
      };
    }

    function buildDedupeResponseModules(userText) {
      var dedupeModules = parseJsonText(extractSection(userText, '【需要去重精简的 AI 生成用例(JSON)】'));
      var sourceList = Array.isArray(dedupeModules) ? dedupeModules : [];
      return sourceList.map(function(item, index) {
        var moduleName = item && item.module ? String(item.module) : ('模块' + String(index + 1));
        return makeModule(moduleName, Array.isArray(item && item.cases) ? item.cases.slice() : []);
      });
    }

    window.__xmindPipelineCalls = [];
    client.proxyModelRequest = function(payload, signal) {
      var modelPayload = payload && payload.payload ? payload.payload : {};
      var messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
      var promptText = flattenContent(messages[0] && messages[0].content);
      var userText = flattenContent(messages[1] && messages[1].content);
      var contract = parseJsonText(extractSection(userText, '【operation_contract(JSON)】'))
        || parseJsonText(extractSection(promptText, 'operation_contract(JSON)：'))
        || {};
      var mode = String(contract.mode || '');
      var targetModule = String(contract.targetModule || '');
      var delayMs = 120;
      var responseModules = [];

      if (mode === 'ai_dedupe_simplify') {
        delayMs = 120;
        responseModules = buildDedupeResponseModules(userText);
      } else if (mode === 'full_cases') {
        delayMs = 120;
        responseModules = [
          makeModule('登录模块', [makeCase('登录模块', '登录模块-首批用例')]),
          makeModule('支付模块', [makeCase('支付模块', '支付模块-尾批用例')]),
        ];
      } else if (mode === 'module_full_cases' && targetModule === '登录模块') {
        delayMs = 900;
        responseModules = [makeModule('登录模块', [makeCase('登录模块', '登录模块-首批用例')])];
      } else if (mode === 'module_full_cases' && targetModule === '支付模块') {
        delayMs = 80;
        responseModules = [makeModule('支付模块', [makeCase('支付模块', '支付模块-尾批用例')])];
      } else {
        responseModules = [makeModule(targetModule || '默认模块', [makeCase(targetModule || '默认模块', '默认模块-完整-1')])];
      }

      window.__xmindPipelineCalls.push({
        mode: mode,
        targetModule: targetModule,
        startedAt: Date.now(),
      });
      var content = JSON.stringify({ modules: responseModules });
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          resolve({
            ok: true,
            status: 200,
            text: function() {
              return Promise.resolve(JSON.stringify({
                choices: [{ message: { content: content } }],
              }));
            },
          });
        }, delayMs);
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', function() {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    };
  });
}

async function installRootPipelineStaggeredRoute(page) {
  const calls = [];
  function flattenContent(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content.map((item) => {
      if (!item || typeof item !== 'object') return '';
      if (item.type === 'text') return String(item.text || '');
      return '[image]';
    }).join('\n');
  }
  function parseJsonText(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {}
    const objStart = raw.indexOf('{');
    const objEnd = raw.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      try {
        return JSON.parse(raw.slice(objStart, objEnd + 1));
      } catch (_) {}
    }
    return null;
  }
  function extractSection(text, marker) {
    const source = String(text || '');
    const index = source.indexOf(marker);
    if (index === -1) return '';
    let rest = source.slice(index + marker.length);
    const next = rest.indexOf('\n\n【');
    if (next !== -1) rest = rest.slice(0, next);
    return String(rest || '').trim();
  }
  function makeModule(name, cases) {
    return {
      module: name,
      key_scenarios: [name + '主场景'],
      test_points: [name + '关键校验'],
      coupled_modules: [name + '关联模块'],
      cases: Array.isArray(cases) ? cases : [],
    };
  }
  function makeCase(moduleName, title) {
    return {
      module: moduleName,
      title: title,
      priority: 'P1',
      preconditions: moduleName + '前置条件',
      steps: ['1、进入' + moduleName, '2、执行' + title],
      expected: title + '执行成功',
    };
  }
  function buildDedupeResponseModules(userText) {
    const dedupeModules = parseJsonText(extractSection(userText, '【需要去重精简的 AI 生成用例(JSON)】'));
    const sourceList = Array.isArray(dedupeModules) ? dedupeModules : [];
    return sourceList.map((item, index) => {
      const moduleName = item && item.module ? String(item.module) : `模块${index + 1}`;
      return makeModule(moduleName, Array.isArray(item && item.cases) ? item.cases.slice() : []);
    });
  }

  await page.route('**/api/model-proxy', async (route) => {
    const request = route.request();
    const body = request.postDataJSON ? request.postDataJSON() : {};
    const modelPayload = body && body.payload ? body.payload : {};
    const messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
    const promptText = flattenContent(messages[0] && messages[0].content);
    const userText = flattenContent(messages[1] && messages[1].content);
    const contract = parseJsonText(extractSection(userText, '【operation_contract(JSON)】'))
      || parseJsonText(extractSection(promptText, 'operation_contract(JSON)：'))
      || {};
    const mode = String(contract.mode || '');
    const targetModule = String(contract.targetModule || '');
    let delayMs = 120;
    let responseModules = [];

    if (mode === 'ai_dedupe_simplify') {
      delayMs = 120;
      responseModules = buildDedupeResponseModules(userText);
    } else if (mode === 'full_cases') {
      delayMs = 120;
      responseModules = [
        makeModule('登录模块', [makeCase('登录模块', '登录模块-首批用例')]),
        makeModule('支付模块', [makeCase('支付模块', '支付模块-尾批用例')]),
      ];
    } else if (mode === 'module_full_cases' && targetModule === '登录模块') {
      delayMs = 900;
      responseModules = [makeModule('登录模块', [makeCase('登录模块', '登录模块-首批用例')])];
    } else if (mode === 'module_full_cases' && targetModule === '支付模块') {
      delayMs = 80;
      responseModules = [makeModule('支付模块', [makeCase('支付模块', '支付模块-尾批用例')])];
    } else {
      responseModules = [makeModule(targetModule || '默认模块', [makeCase(targetModule || '默认模块', '默认模块-完整-1')])];
    }

    calls.push({
      mode: mode,
      targetModule: targetModule,
      startedAt: Date.now(),
    });
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        output: [{
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'output_text',
            text: JSON.stringify({ modules: responseModules }),
          }],
        }],
      }),
    });
  });
  return {
    getCalls() {
      return calls.slice();
    },
  };
}

async function installRawXmindModelResponse(page, contentText, delayMs) {
  await page.evaluate(({ rawContent, delay }) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    client.proxyModelRequest = function(payload, signal) {
      var content = String(rawContent || '');
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          resolve({
            ok: true,
            status: 200,
            text: function() {
              return Promise.resolve(JSON.stringify({
                choices: [{ message: { content: content } }],
              }));
            },
          });
        }, Number(delay) || 120);
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', function() {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    };
  }, {
    rawContent: contentText,
    delay: delayMs || 120,
  });
}

async function installRejectedXmindModelResponse(page, messageText, delayMs) {
  await page.evaluate(({ message, delay }) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    client.proxyModelRequest = function(payload, signal) {
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          reject(new Error(String(message || '503 Service Unavailable')));
        }, Number(delay) || 120);
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', function() {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    };
  }, {
    message: messageText,
    delay: delayMs || 120,
  });
}

async function installXmindProxyHttpError(page, options) {
  const input = options || {};
  const status = Number(input.status || 503);
  const rawBody = input.rawBody || JSON.stringify({ detail: '连接模型服务失败：上游服务暂时不可用' });
  await page.evaluate(({ status, rawBody }) => {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client) return;
    client.proxyModelRequest = function() {
      return Promise.resolve({
        ok: Number(status) >= 200 && Number(status) < 300,
        status: Number(status),
        text: function() {
          return Promise.resolve(String(rawBody || ''));
        },
      });
    };
  }, {
    status: status,
    rawBody: String(rawBody || ''),
  });
}

async function installXmindProxyRoute(page, options) {
  const input = options || {};
  const calls = [];
  await page.route('**/api/model-proxy', async (route) => {
    const request = route.request();
    const body = request.postDataJSON ? request.postDataJSON() : {};
    calls.push({
      index: calls.length,
      body: body,
    });
    const callIndex = calls.length - 1;
    const delaysMs = Array.isArray(input.delaysMs) ? input.delaysMs : [];
    const delayMs = Number(delaysMs[callIndex] !== undefined ? delaysMs[callIndex] : (input.delayMs || 0));
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const responseTexts = Array.isArray(input.responseTexts) ? input.responseTexts : [];
    const responseText = String(
      responseTexts[callIndex] !== undefined
        ? responseTexts[callIndex]
        : (input.responseText || '{"modules":[]}')
    );
    const status = Number(
      Array.isArray(input.statuses) && input.statuses[callIndex] !== undefined
        ? input.statuses[callIndex]
        : (input.status || 200)
    );
    await route.fulfill({
      status: status,
      contentType: 'application/json',
      body: JSON.stringify({
        output: [{
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'output_text',
            text: responseText,
          }],
        }],
      }),
    });
  });
  return {
    getCallCount() {
      return calls.length;
    },
    getCalls() {
      return calls.slice();
    },
  };
}

async function seedDocumentRequirement(page, options) {
  const input = options || {};
  const text = input.text || '这是用于验证 XMind 用例生成的需求说明。';
  const requirementLabel = input.requirementLabel || 'XMind规则重构需求';
  await page.evaluate((payload) => {
    var rawTextEl = document.getElementById('rawText');
    if (rawTextEl) {
      rawTextEl.removeAttribute('readonly');
      rawTextEl.value = payload.text;
      rawTextEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.requirementLabel = payload.requirementLabel;
      window.app.state.requirementLabelSource = 'ui-test';
      window.app.state.lastRawImportName = 'xmind-requirement.docx';
      var docxImages = [];
      var imageCount = Number(payload.imageCount || 0);
      if (imageCount > 0 && payload.imageBytes && Array.isArray(payload.imageBytes)) {
        var imageTextOffsets = Array.isArray(payload.imageTextOffsets) ? payload.imageTextOffsets : [];
        for (var i = 0; i < imageCount; i += 1) {
          var bytes = new Uint8Array(payload.imageBytes);
          var file = new File([bytes], 'xmind-requirement-image-' + (i + 1) + '.png', { type: 'image/png' });
          var textOffset = Number(imageTextOffsets[i]);
          docxImages.push({
            index: i + 1,
            blob: file,
            textOffset: Number.isFinite(textOffset) && textOffset >= 0 ? textOffset : null,
          });
        }
      }
      window.app.state.requirementMedia = {
        docxImages: docxImages,
        pastedImages: [],
        lastDocxImageCount: docxImages.length,
        updatedAt: Date.now(),
      };
    }
  }, {
    text: text,
    requirementLabel: requirementLabel,
    imageCount: Number(input.imageCount || 0),
    imageBytes: Array.from(input.imageBytes || []),
    imageTextOffsets: Array.isArray(input.imageTextOffsets) ? input.imageTextOffsets : [],
  });
}

async function seedImportedBaseline(page, list) {
  const input = list && typeof list === 'object' && !Array.isArray(list) ? list : { list };
  const baseline = Array.isArray(input.list) && input.list.length ? input.list : [{
    module: '登录模块',
    title: '登录模块-基线用例',
    priority: 'P1',
    preconditions: '账号已存在',
    steps: ['1、进入登录页', '2、输入账号密码'],
    expected: '登录成功',
  }];
  await page.evaluate((payload) => {
    var caseTextEl = document.getElementById('caseText');
    var text = JSON.stringify(payload.list, null, 2);
    if (caseTextEl) {
      caseTextEl.removeAttribute('readonly');
      caseTextEl.value = text;
      caseTextEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.importedCases = [{
        name: 'baseline.json',
        text: text,
        list: payload.list,
        meta: payload.meta || null,
      }];
    }
  }, {
    list: baseline,
    meta: input.meta || null,
  });
}

async function seedAiSkeleton(page, modules) {
  const list = Array.isArray(modules) && modules.length ? modules : [{
    id: 'xmind-mod-login',
    title: '登录模块',
    scenarios: ['登录主场景'],
    points: ['账号密码校验'],
    coupled: ['用户中心'],
  }];
  await page.evaluate((payload) => {
    if (!window.app || !window.app.state) return;
    window.app.state.caseGenModules = payload.modules.slice();
    window.app.state.caseGenResults = {};
    window.app.state.caseSelections = {};
    window.app.state.caseGenSuggestions = {};
    window.app.state.caseGenModuleStatus = {};
    window.app.state.caseGenProgress = {};
    window.app.state.caseGenTiming = {};
    if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
      window.app.casesGenApi.renderCaseGeneration();
    }
  }, { modules: list });
}

async function seedAiCases(page, casesByModuleId) {
  const payload = casesByModuleId && typeof casesByModuleId === 'object' ? casesByModuleId : {};
  await page.evaluate((input) => {
    if (!window.app || !window.app.state) return;
    var nextResults = {};
    Object.keys(input || {}).forEach(function(moduleId) {
      nextResults[moduleId] = JSON.stringify(input[moduleId] || [], null, 2);
    });
    window.app.state.caseGenResults = nextResults;
    if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
      window.app.casesGenApi.renderCaseGeneration();
    }
  }, payload);
}

async function seedPrepState(page, options) {
  const input = options || {};
  await page.evaluate((payload) => {
    if (!window.app || !window.app.state) return;
    window.app.state.xmindCaseGen = window.app.state.xmindCaseGen || {};
    window.app.state.xmindCaseGen.prep = {
      step: Number(payload.step) || 3,
      requirementMode: payload.requirementMode || 'document',
      requirementSupplement: payload.requirementSupplement || '',
      manualRequirementLabel: payload.manualRequirementLabel || '',
      manualRequirementBlocks: Array.isArray(payload.manualRequirementBlocks) ? payload.manualRequirementBlocks.slice() : [],
      caseImportMode: payload.caseImportMode || 'skip',
      completed: payload.completed === true,
    };
  }, {
    step: input.step === undefined ? 3 : input.step,
    requirementMode: input.requirementMode || 'document',
    requirementSupplement: input.requirementSupplement || '',
    manualRequirementLabel: input.manualRequirementLabel || '',
    manualRequirementBlocks: input.manualRequirementBlocks || [],
    caseImportMode: input.caseImportMode || 'skip',
    completed: input.completed !== false,
  });
}

async function syncActiveWorkspaceSnapshotFromLiveState(page, options) {
  const input = options || {};
  await page.evaluate((payload) => {
    var app = window.app || {};
    var state = app.state;
    if (!state || !state.xmindCaseGen || !state.xmindCaseGen.workspaces) return false;
    var host = state.xmindCaseGen;
    var activeId = String(host.activeWorkspaceId || '');
    var record = activeId && host.workspaces ? host.workspaces[activeId] : null;
    if (!record) return false;

    function clone(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_) {
        return fallback;
      }
    }

    function ensureObject(value) {
      return value && typeof value === 'object' ? value : {};
    }

    function cloneRequirementMedia(value) {
      var source = value && typeof value === 'object' ? value : {};
      function cloneMediaList(list) {
        return (Array.isArray(list) ? list : []).map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var cloned = {};
          Object.keys(item).forEach(function(key) {
            cloned[key] = item[key];
          });
          return cloned;
        }).filter(Boolean);
      }
      return {
        docxImages: cloneMediaList(source.docxImages),
        pastedImages: cloneMediaList(source.pastedImages),
        lastDocxImageCount: Number(source.lastDocxImageCount || 0) || 0,
        updatedAt: Number(source.updatedAt || 0) || Date.now(),
      };
    }

    var rawTextEl = document.getElementById('rawText');
    var caseTextEl = document.getElementById('caseText');
    var fileNameEl = document.getElementById('fileName');
    var liveXmind = clone(state.xmindCaseGen, {}) || {};
    delete liveXmind.activeWorkspaceId;
    delete liveXmind.mirrorWorkspaceId;
    delete liveXmind.workspaceOrder;
    delete liveXmind.workspaces;
    delete liveXmind.nextWorkspaceSeq;
    delete liveXmind.openButtonDotVisible;

    record.snapshot = ensureObject(record.snapshot);
    record.snapshot.shared = ensureObject(record.snapshot.shared);
    record.snapshot.xmind = ensureObject(record.snapshot.xmind);

    record.snapshot.shared.requirementLabel = String(
      payload.requirementLabel || state.requirementLabel || ''
    );
    record.snapshot.shared.requirementLabelSource = String(
      payload.requirementLabelSource || state.requirementLabelSource || 'ui-test'
    );
    record.snapshot.shared.lastRawImportName = String(
      payload.lastRawImportName || state.lastRawImportName || ''
    );
    record.snapshot.shared.rawText = String(
      payload.rawText || (rawTextEl && rawTextEl.value ? rawTextEl.value : '')
    );
    record.snapshot.shared.caseText = String(
      payload.caseText || (caseTextEl && caseTextEl.value ? caseTextEl.value : '')
    );
    record.snapshot.shared.importedCases = clone(state.importedCases, []);
    record.snapshot.shared.caseGenModules = clone(state.caseGenModules, []);
    record.snapshot.shared.caseGenSource = String(state.caseGenSource || '');
    record.snapshot.shared.caseGenResults = clone(state.caseGenResults, {});
    record.snapshot.shared.caseSelections = clone(state.caseSelections, {});
    record.snapshot.shared.caseGenSuggestions = clone(state.caseGenSuggestions, {});
    record.snapshot.shared.caseGenModuleStatus = clone(state.caseGenModuleStatus, {});
    record.snapshot.shared.caseGenProgress = clone(state.caseGenProgress, {});
    record.snapshot.shared.caseGenTiming = clone(state.caseGenTiming, {});
    record.snapshot.shared.caseGenProgressNotice = clone(state.caseGenProgressNotice, {});
    record.snapshot.shared.caseGenSettings = clone(state.caseGenSettings, {});
    record.snapshot.shared.requirementMedia = cloneRequirementMedia(state.requirementMedia);

    Object.keys(liveXmind).forEach(function(key) {
      record.snapshot.xmind[key] = clone(liveXmind[key], liveXmind[key]);
    });

    if (payload.prep && typeof payload.prep === 'object') {
      record.snapshot.xmind.prep = ensureObject(record.snapshot.xmind.prep);
      Object.keys(payload.prep).forEach(function(key) {
        record.snapshot.xmind.prep[key] = clone(payload.prep[key], payload.prep[key]);
      });
    }

    if (payload.workspaceName) {
      record.name = String(payload.workspaceName || '');
    } else if (record.snapshot.shared.requirementLabel) {
      record.name = String(record.snapshot.shared.requirementLabel || '');
    }
    record.updatedAt = Date.now();

    state.requirementLabel = String(record.snapshot.shared.requirementLabel || '');
    state.requirementLabelSource = String(record.snapshot.shared.requirementLabelSource || '');
    state.lastRawImportName = String(record.snapshot.shared.lastRawImportName || '');
    state.importedCases = clone(record.snapshot.shared.importedCases, []);
    state.caseGenModules = clone(record.snapshot.shared.caseGenModules, []);
    state.caseGenSource = String(record.snapshot.shared.caseGenSource || '');
    state.caseGenResults = clone(record.snapshot.shared.caseGenResults, {});
    state.caseSelections = clone(record.snapshot.shared.caseSelections, {});
    state.caseGenSuggestions = clone(record.snapshot.shared.caseGenSuggestions, {});
    state.caseGenModuleStatus = clone(record.snapshot.shared.caseGenModuleStatus, {});
    state.caseGenProgress = clone(record.snapshot.shared.caseGenProgress, {});
    state.caseGenTiming = clone(record.snapshot.shared.caseGenTiming, {});
    state.caseGenProgressNotice = clone(record.snapshot.shared.caseGenProgressNotice, {});
    state.caseGenSettings = clone(record.snapshot.shared.caseGenSettings, state.caseGenSettings || {});
    state.requirementMedia = clone(record.snapshot.shared.requirementMedia, state.requirementMedia || {});
    if (rawTextEl) rawTextEl.value = String(record.snapshot.shared.rawText || '');
    if (caseTextEl) caseTextEl.value = String(record.snapshot.shared.caseText || '');
    if (fileNameEl) {
      fileNameEl.textContent = state.lastRawImportName
        ? String(state.lastRawImportName || '')
        : '未选择文件';
    }
    Object.keys(record.snapshot.xmind).forEach(function(key) {
      state.xmindCaseGen[key] = clone(record.snapshot.xmind[key], record.snapshot.xmind[key]);
    });

    if (app.persistWorkflowStateNow && typeof app.persistWorkflowStateNow === 'function') {
      app.persistWorkflowStateNow();
    }
    return true;
  }, {
    requirementLabel: input.requirementLabel || '',
    requirementLabelSource: input.requirementLabelSource || '',
    lastRawImportName: input.lastRawImportName || '',
    rawText: input.rawText || '',
    caseText: input.caseText || '',
    workspaceName: input.workspaceName || '',
    prep: input.prep || null,
  });
  await page.evaluate(() => {
    var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
    if (api && typeof api.hydrateActiveWorkspaceSnapshot === 'function') {
      api.hydrateActiveWorkspaceSnapshot();
    }
    if (api && typeof api.render === 'function') {
      api.render({ reason: 'test-sync-active-workspace-snapshot', persist: false, centerRootAfterRender: true });
    }
  });
}

async function clickElementById(page, id) {
  await page.evaluate((targetId) => {
    var el = document.getElementById(targetId);
    if (el && typeof el.click === 'function') el.click();
  }, id);
}

async function dispatchFileDropToZone(page, zoneId, options) {
  const input = options || {};
  await page.evaluate((payload) => {
    var zone = document.getElementById(payload.zoneId);
    if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
    var dt = new DataTransfer();
    var list = Array.isArray(payload.files) ? payload.files : [];
    list.forEach(function(item) {
      if (!item) return;
      dt.items.add(new File([String(item.text || '')], String(item.name || 'payload.txt'), {
        type: String(item.mimeType || 'text/plain'),
      }));
    });
    function dispatch(type) {
      var evt = null;
      if (typeof Event === 'function') {
        evt = new Event(type, { bubbles: true, cancelable: true });
      } else if (document && document.createEvent) {
        evt = document.createEvent('Event');
        evt.initEvent(type, true, true);
      }
      if (!evt) return;
      try {
        Object.defineProperty(evt, 'dataTransfer', { value: dt });
      } catch (_) {
        evt.dataTransfer = dt;
      }
      zone.dispatchEvent(evt);
    }
    dispatch('dragover');
    dispatch('drop');
  }, {
    zoneId: String(zoneId || ''),
    files: Array.isArray(input.files) ? input.files : [],
  });
}

async function openXmindCaseGenDrawer(page) {
  let drawerOpen = await page.evaluate(() => {
    var drawer = document.getElementById('xmindCaseGenDrawer');
    return Boolean(drawer && drawer.classList && drawer.classList.contains('open'));
  });
  if (!drawerOpen) {
    await page.waitForTimeout(260);
    drawerOpen = await page.evaluate(() => {
      var drawer = document.getElementById('xmindCaseGenDrawer');
      return Boolean(drawer && drawer.classList && drawer.classList.contains('open'));
    });
  }
  if (!drawerOpen) {
    await page.click('#caseGenModulesTabBtn');
    await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
    await page.click('#xmindCaseGenOpenBtn');
  }
  await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
  await page.waitForFunction(() => {
    var controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
    var addBtn = document.getElementById('xmindCaseGenWorkspaceAddBtn');
    var debug = window.app && window.app.__xmindCasegenDebug ? window.app.__xmindCasegenDebug : null;
    if (controls && controls.getBoundingClientRect) {
      var rect = controls.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    if (addBtn && addBtn.getBoundingClientRect) {
      var addRect = addBtn.getBoundingClientRect();
      if (addRect.width > 0 && addRect.height > 0) return true;
    }
    return Boolean(debug && (debug.phase === 'render-success' || /error/.test(String(debug.phase || ''))));
  }, {}, { timeout: 15000 });
  const hasWorkspace = await page.evaluate(() => {
    return document.querySelectorAll('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').length > 0;
  });
  if (!hasWorkspace) {
    await page.click('#xmindCaseGenWorkspaceAddBtn');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
    const summaryOpen = await page.locator('#xmindCaseGenSummaryOverlay').evaluate((el) => {
      return Boolean(el && el.classList && el.classList.contains('is-open'));
    }).catch(() => false);
    if (summaryOpen) {
      await page.click('#xmindCaseGenSummaryCloseBtn');
      await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);
    }
  }
  await page.waitForFunction(() => {
    var controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
    if (!controls || !controls.getBoundingClientRect) return false;
    var rect = controls.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, {}, { timeout: 15000 });
  const renderInfo = await page.evaluate(() => {
    var controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
    var rect = controls && controls.getBoundingClientRect ? controls.getBoundingClientRect() : null;
    return {
      debug: window.app && window.app.__xmindCasegenDebug ? window.app.__xmindCasegenDebug : null,
      hasControls: Boolean(rect && rect.width > 0 && rect.height > 0),
      containerText: document.getElementById('xmindCaseGenMindContainer')
        ? String(document.getElementById('xmindCaseGenMindContainer').textContent || '').trim()
        : '',
    };
  });
  expect(/error/i.test(String(renderInfo.debug && renderInfo.debug.phase ? renderInfo.debug.phase : '')), JSON.stringify(renderInfo)).toBe(false);
  expect(renderInfo.hasControls, JSON.stringify(renderInfo)).toBeTruthy();
}

async function createXmindWorkspaceByManualPrep(page, name, description, options) {
  const opts = options || {};
  if (opts.useExistingWorkspace === true) {
    const summaryOpen = await page.locator('#xmindCaseGenSummaryOverlay').evaluate((el) => {
      return Boolean(el && el.classList && el.classList.contains('is-open'));
    }).catch(() => false);
    if (!summaryOpen) {
      await page.click('#xmindCaseGenSummaryBtn');
    }
  } else {
    await page.click('#xmindCaseGenWorkspaceAddBtn');
  }
  await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
  await page.evaluate((payload) => {
    var app = window.app || {};
    var state = app.state;
    if (!state || !state.xmindCaseGen) return;
    var prep = state.xmindCaseGen.prep = state.xmindCaseGen.prep || {};
    prep.step = payload.completePrep ? 3 : 1;
    prep.requirementMode = 'manual';
    prep.requirementSupplement = '';
    prep.manualRequirementLabel = String(payload.name || '未命名需求');
    prep.manualRequirementBlocks = [{
      type: 'text',
      text: String(payload.description || '需求描述'),
    }];
    prep.caseImportMode = payload.completePrep ? 'skip' : '';
    prep.baseLocked = payload.completePrep === true;
    prep.completed = payload.completePrep === true;
  }, {
    name: String(name || '未命名需求'),
    description: String(description || '需求描述'),
    completePrep: opts.completePrep === true,
  });
  await syncActiveWorkspaceSnapshotFromLiveState(page, {
    workspaceName: String(name || '未命名需求'),
    requirementLabel: '',
    requirementLabelSource: '',
    prep: {
      step: opts.completePrep === true ? 3 : 1,
      requirementMode: 'manual',
      manualRequirementLabel: String(name || '未命名需求'),
      manualRequirementBlocks: [{
        type: 'text',
        text: String(description || '需求描述'),
      }],
      caseImportMode: opts.completePrep === true ? 'skip' : '',
      baseLocked: opts.completePrep === true,
      completed: opts.completePrep === true,
    },
  });
  await page.click('#xmindCaseGenSummaryCloseBtn');
  await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);
  if (opts.completePrep === true) {
    await page.waitForFunction((expected) => {
      var st = window.app && window.app.state ? window.app.state : null;
      var host = st && st.xmindCaseGen ? st.xmindCaseGen : null;
      var activeId = host ? String(host.activeWorkspaceId || '') : '';
      var record = activeId && host && host.workspaces ? host.workspaces[activeId] : null;
      var snap = record && record.snapshot ? record.snapshot : null;
      var prep = snap && snap.xmind ? snap.xmind.prep : null;
      return Boolean(prep && prep.completed === true && String(prep.manualRequirementLabel || '') === String(expected || ''));
    }, String(name || '未命名需求'), { timeout: 20000 });
    return;
  }
}

async function createXmindWorkspaceByDocumentDraft(page, fileName, fileText, options) {
  const opts = options || {};
  if (opts.useExistingWorkspace === true) {
    const summaryOpen = await page.locator('#xmindCaseGenSummaryOverlay').evaluate((el) => {
      return Boolean(el && el.classList && el.classList.contains('is-open'));
    }).catch(() => false);
    if (!summaryOpen) {
      await page.click('#xmindCaseGenSummaryBtn');
    }
  } else {
    await page.click('#xmindCaseGenWorkspaceAddBtn');
  }
  await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
  await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
  await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
    files: [{
      name: String(fileName || 'draft.txt'),
      text: String(fileText || '需求正文'),
      mimeType: 'text/plain',
    }],
  });
  await page.waitForFunction((expectedName, expectedText) => {
    var rawText = document.getElementById('rawText');
    var fileNameEl = document.getElementById('fileName');
    var textReady = Boolean(rawText && String(rawText.value || '').indexOf(String(expectedText || '')) !== -1);
    var fileReady = Boolean(fileNameEl && String(fileNameEl.textContent || '').indexOf(String(expectedName || '')) !== -1);
    return textReady && fileReady;
  }, String(fileName || 'draft.txt'), String(fileText || '需求正文'), { timeout: 20000 });
  await page.click('#xmindCaseGenSummaryCloseBtn');
  await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);
}

async function clickXmindWorkspaceClose(page, label) {
  const targetLabel = label === undefined || label === null ? '' : String(label || '');
  const clicked = await page.evaluate((expectedLabel) => {
    var scope = document.getElementById('xmindCaseGenWorkspaceList');
    if (!scope) return false;
    var tabs = scope.querySelectorAll('[data-xmind-workspace-tab]');
    var targetId = '';
    Array.prototype.some.call(tabs, function(node) {
      if (!node) return false;
      if (!expectedLabel) {
        targetId = String(node.getAttribute('data-xmind-workspace-tab') || '');
        return true;
      }
      var text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.indexOf(expectedLabel) === -1) return false;
      targetId = String(node.getAttribute('data-xmind-workspace-tab') || '');
      return true;
    });
    var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
    if (!targetId || !api || typeof api.closeWorkspace !== 'function') return false;
    return api.closeWorkspace(targetId) === true;
  }, targetLabel);
  expect(clicked).toBe(true);
}

async function clickXmindWorkspaceCloseUi(page, label) {
  const targetLabel = String(label || '').trim();
  const tab = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
    hasText: targetLabel,
  }).first();
  await expect(tab).toBeVisible();
  const closeButton = tab.locator('[data-xmind-workspace-close]').first();
  await expect(closeButton).toBeVisible();
  await closeButton.click();
}

async function waitForNodeText(page, text) {
  await page.waitForFunction((expected) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(expected) !== -1;
    });
  }, text, { timeout: 15000 });
}

async function waitForNodeTextAbsent(page, text) {
  await page.waitForFunction((expected) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return !Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(expected) !== -1;
    });
  }, text, { timeout: 15000 });
}

async function waitForNodeStatus(page, topicText, statusText) {
  await page.waitForFunction(({ topic, status }) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      var badge = node && node.querySelector ? node.querySelector('.xmind-node-status-badge') : null;
      var badgeText = badge && badge.textContent ? String(badge.textContent).replace(/\s+/g, ' ').trim() : '';
      return badgeText.indexOf(status) !== -1;
    });
  }, { topic: topicText, status: statusText }, { timeout: 15000 });
}

async function waitForNodeStatusAbsent(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.every.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return true;
      return !(node.querySelector && node.querySelector('.xmind-node-status-badge'));
    });
  }, topicText, { timeout: 15000 });
}

async function waitForNodeClass(page, topicText, className) {
  await page.waitForFunction(({ topic, className: expectedClass }) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      return label.indexOf(topic) !== -1 && node.classList && node.classList.contains(expectedClass);
    });
  }, { topic: topicText, className }, { timeout: 15000 });
}

async function selectXmindNode(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      return stableLabel === topic || label === topic;
    });
  }, topicText, { timeout: 15000 });
  const clicked = await page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!(stableLabel === topic || label === topic)) return false;
      target = textEl || node;
      return true;
    });
    if (!target || !target.getBoundingClientRect) return false;
    var rect = target.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(function(type) {
      var init = {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        button: 0,
        buttons: type === 'mouseup' || type === 'click' ? 0 : 1,
        which: 1,
      };
      try {
        if (type.indexOf('pointer') === 0 && typeof PointerEvent === 'function') {
          target.dispatchEvent(new PointerEvent(type, init));
        } else {
          target.dispatchEvent(new MouseEvent(type, init));
        }
      } catch (err) {
        target.dispatchEvent(new MouseEvent(type === 'pointerdown' ? 'mousedown' : type, init));
      }
    });
    return true;
  }, topicText);
  expect(clicked).toBeTruthy();
}

async function selectXmindNodeText(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      return stableLabel === topic || label === topic;
    });
  }, topicText, { timeout: 15000 });
  const selectionState = await page.evaluate((topic) => {
    if (typeof window === 'undefined' || !window || typeof window.getSelection !== 'function') return '';
    if (typeof document === 'undefined' || !document || typeof document.createRange !== 'function') return '';
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var textEl = null;
    Array.prototype.some.call(nodes, function(node) {
      var currentTextEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = currentTextEl
        ? String((typeof currentTextEl.innerText === 'string' ? currentTextEl.innerText : currentTextEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!(stableLabel === topic || label === topic)) return false;
      textEl = currentTextEl;
      return true;
    });
    if (!textEl) return '';
    var selection = null;
    try {
      selection = window.getSelection();
    } catch (err) {
      selection = null;
    }
    if (!selection) return '';
    var range = document.createRange();
    range.selectNodeContents(textEl);
    selection.removeAllRanges();
    selection.addRange(range);
    return {
      rangeCount: Number(selection.rangeCount || 0),
      isCollapsed: selection.isCollapsed === true,
      text: String(selection.toString() || ''),
    };
  }, topicText);
  expect(selectionState).toBeTruthy();
  expect(Number(selectionState.rangeCount || 0)).toBeGreaterThan(0);
  expect(Boolean(selectionState.isCollapsed)).toBe(false);
}

async function clickXmindNodeQuickAction(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      var btn = node.querySelector && node.querySelector('.xmind-node-quick-action');
      return (stableLabel === topic || label === topic) && Boolean(btn && btn.disabled !== true);
    });
  }, topicText, { timeout: 15000 });
  const clicked = await page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!(stableLabel === topic || label === topic)) return false;
      if (!node.querySelector || !node.querySelector('.xmind-node-quick-action')) return false;
      target = node;
      return true;
    });
    if (!target || !target.querySelector) return false;
    var btn = target.querySelector('.xmind-node-quick-action');
    if (!btn || btn.disabled || typeof btn.click !== 'function') return false;
    btn.click();
    return true;
  }, topicText);
  expect(clicked).toBeTruthy();
}

async function getNodeQuickActionId(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(topic) !== -1 && Boolean(node.querySelector && node.querySelector('.xmind-node-quick-action'));
    });
  }, topicText, { timeout: 15000 });
  return page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var found = '';
    Array.prototype.some.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      if (content.indexOf(topic) === -1) return false;
      var btn = node && node.querySelector ? node.querySelector('.xmind-node-quick-action') : null;
      if (!btn) return false;
      found = btn && btn.getAttribute ? String(btn.getAttribute('data-mind-node-quick') || '') : '';
      return Boolean(found);
    });
    return found;
  }, topicText);
}

async function openNodeContextMenu(page, topicText) {
  async function dispatchContextMenu(candidateIndex) {
    const result = await page.evaluate(({ topic, index }) => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      var exactMatches = [];
      var structuralMatches = [];
      var fuzzyMatches = [];
      Array.prototype.forEach.call(nodes, function(node) {
        if (!node) return;
        var textEl = node.querySelector ? node.querySelector('.text') : null;
        var label = textEl
          ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
          : '';
        var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
        var content = node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : label;
        var isStructuralNode = Boolean(
          node.classList
          && (node.classList.contains('xmind-casegen-node-root') || node.classList.contains('xmind-casegen-node-module'))
        );
        if (label === topic || stableLabel === topic) {
          exactMatches.push(node);
          return;
        }
        if (isStructuralNode && (stableLabel.indexOf(topic) !== -1 || label.indexOf(topic) !== -1 || content.indexOf(topic) !== -1)) {
          structuralMatches.push(node);
          return;
        }
        if (label.indexOf(topic) !== -1 || content.indexOf(topic) !== -1) {
          fuzzyMatches.push(node);
        }
      });
      var candidates = exactMatches.concat(structuralMatches, fuzzyMatches);
      var target = candidates[Number(index) || 0] || null;
      if (!target || !target.getBoundingClientRect) return false;
      var rect = target.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      var centerX = rect.left + (rect.width / 2);
      var centerY = rect.top + (rect.height / 2);
      var eventTarget = target;
      eventTarget.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
      }));
      eventTarget.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        button: 2,
        buttons: 2,
        which: 3,
      }));
      eventTarget.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        button: 2,
        buttons: 0,
        which: 3,
      }));
      eventTarget.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        button: 2,
        buttons: 2,
        which: 3,
      }));
      return {
        opened: true,
        candidateCount: candidates.length,
      };
    }, {
      topic: topicText,
      index: Number(candidateIndex) || 0,
    });
    expect(result && result.opened).toBeTruthy();
    return result;
  }

  var dispatchInfo = await dispatchContextMenu(0);
  var maxCandidates = dispatchInfo && dispatchInfo.candidateCount ? dispatchInfo.candidateCount : 1;
  var menuOpened = false;
  for (var i = 0; i < maxCandidates; i += 1) {
    if (i > 0) dispatchInfo = await dispatchContextMenu(i);
    try {
      await page.waitForFunction(() => {
        var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
        return buttons && buttons.length > 0;
      }, {}, { timeout: i === 0 ? 3000 : 1500 });
      menuOpened = true;
      break;
    } catch (err) {
      menuOpened = false;
    }
  }
  expect(menuOpened).toBeTruthy();
}

async function openRootContextMenu(page) {
  const target = page.locator('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text').first();
  await expect(target).toBeVisible();
  async function dispatchRootContextMenu() {
    return page.evaluate(() => {
      var node = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
      if (!node) return false;
      var rect = node.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      ['pointerdown', 'mousedown', 'mouseup', 'contextmenu'].forEach(function(type) {
        var init = {
          bubbles: true,
          cancelable: true,
          clientX: centerX,
          clientY: centerY,
          button: 2,
          buttons: type === 'mouseup' ? 0 : 2,
          which: 3,
        };
        try {
          if (type.indexOf('pointer') === 0 && typeof PointerEvent === 'function') {
            node.dispatchEvent(new PointerEvent(type, init));
          } else {
            node.dispatchEvent(new MouseEvent(type, init));
          }
        } catch (err) {
          node.dispatchEvent(new MouseEvent(type === 'pointerdown' ? 'mousedown' : type, init));
        }
      });
      return true;
    });
  }
  var opened = false;
  for (var i = 0; i < 4; i += 1) {
    try {
      await target.click({ button: 'right', force: true });
    } catch (err) {
      // 根节点可能暂时处于当前视口外，回退到基于坐标的右键派发。
    }
    try {
      await page.waitForFunction(() => {
        var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
        return buttons && buttons.length > 0;
      }, {}, { timeout: i === 0 ? 2500 : 1500 });
      opened = true;
      break;
    } catch (err) {
      opened = false;
      await dispatchRootContextMenu();
      try {
        await page.waitForFunction(() => {
          var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
          return buttons && buttons.length > 0;
        }, {}, { timeout: 1200 });
        opened = true;
        break;
      } catch (fallbackErr) {
        opened = false;
      }
    }
  }
  expect(opened).toBeTruthy();
}

async function getContextMenuItems(page) {
  await page.waitForFunction(() => {
    var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
    return buttons && buttons.length > 0;
  }, {}, { timeout: 10000 });
  return page.evaluate(() => {
    var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
    return Array.prototype.map.call(buttons, function(btn) {
      return {
        label: String(btn.textContent || '').trim(),
        disabled: btn.disabled === true,
      };
    });
  });
}

async function clickContextMenuAction(page, label) {
  const actionLabel = String(label || '').trim();
  const clickedDirectly = await page.evaluate((text) => {
    var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
    for (var i = 0; i < buttons.length; i += 1) {
      var btn = buttons[i];
      if (String(btn.textContent || '').trim() !== String(text || '').trim()) continue;
      if (btn.disabled === true) return false;
      btn.click();
      return true;
    }
    return false;
  }, actionLabel);
  if (clickedDirectly) return;
  const button = page.locator('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn', {
    hasText: actionLabel,
  }).first();
  await expect(button).toBeVisible();
  try {
    await button.click({ force: true, timeout: 2500 });
    return;
  } catch (err) {
    const clicked = await page.evaluate((text) => {
      var buttons = document.querySelectorAll('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn');
      for (var i = 0; i < buttons.length; i += 1) {
        var btn = buttons[i];
        if (String(btn.textContent || '').trim() !== String(text || '').trim()) continue;
        btn.click();
        return true;
      }
      return false;
    }, actionLabel);
    expect(clicked).toBeTruthy();
  }
}

async function waitXmindDrawerClosedStable(page) {
  await page.waitForFunction(() => {
    var drawer = document.getElementById('xmindCaseGenDrawer');
    var body = document.body;
    var root = document.documentElement;
    if (!drawer || !body || !root) return false;
    return !drawer.classList.contains('open')
      && !drawer.classList.contains('closing')
      && !body.classList.contains('drawer-open')
      && !root.classList.contains('drawer-open');
  }, {}, { timeout: 10000 });
}

async function clickVisibleContextMenuAction(page, label) {
  const actionLabel = String(label || '').trim();
  const button = page.locator('.xmind-node-context-menu.is-open .xmind-node-context-menu-btn', {
    hasText: actionLabel,
  }).first();
  await expect(button).toBeVisible();
  await button.click({ force: true });
}

async function readTopupHighlightMetrics(page) {
  return page.evaluate(() => {
    var frame = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
    if (!frame || !nodes || !nodes.length || !frame.getBoundingClientRect) return null;
    var minLeft = Infinity;
    var minTop = Infinity;
    var maxRight = -Infinity;
    var maxBottom = -Infinity;
    Array.prototype.forEach.call(nodes, function(node) {
      if (!node || !node.getBoundingClientRect) return;
      var rect = node.getBoundingClientRect();
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
      maxRight = Math.max(maxRight, rect.right);
      maxBottom = Math.max(maxBottom, rect.bottom);
    });
    if (!isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) return null;
    var frameRect = frame.getBoundingClientRect();
    return {
      highlightedNodeCount: nodes.length,
      frame: {
        left: frameRect.left,
        top: frameRect.top,
        right: frameRect.right,
        bottom: frameRect.bottom,
      },
      union: {
        left: minLeft,
        top: minTop,
        right: maxRight,
        bottom: maxBottom,
      },
    };
  });
}

async function readAllTopupHighlightFrames(page) {
  return page.evaluate(() => {
    var frameNodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
    var highlightNodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
    var counts = {};
    Array.prototype.forEach.call(highlightNodes, function(node) {
      var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
      if (!token) return;
      counts[token] = Number(counts[token] || 0) + 1;
    });
    return Array.prototype.map.call(frameNodes, function(frame) {
      var token = frame && frame.getAttribute ? String(frame.getAttribute('data-xmind-casegen-topup-frame') || '') : '';
      var label = '';
      var labelEl = frame && frame.querySelector ? frame.querySelector('.xmind-casegen-topup-highlight-label') : null;
      if (labelEl && labelEl.textContent) label = String(labelEl.textContent || '').trim();
      var rect = frame && frame.getBoundingClientRect ? frame.getBoundingClientRect() : null;
      return {
        token: token,
        label: label,
        highlightedNodeCount: Number(counts[token] || 0),
        rect: rect ? {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        } : null,
      };
    });
  });
}

async function readTopupHighlightGroups(page) {
  return page.evaluate(() => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
    var groups = {};
    Array.prototype.forEach.call(nodes, function(node) {
      var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
      if (!token) return;
      if (!groups[token]) {
        groups[token] = {
          token: token,
          label: node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-label') || '') : '',
          nodeCount: 0,
        };
      }
      groups[token].nodeCount += 1;
    });
    return Object.keys(groups).map(function(key) {
      return groups[key];
    });
  });
}

async function panXmindCasegenCanvas(page, deltaX, deltaY) {
  return page.evaluate(({ dx, dy }) => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
      || document.getElementById('xmindCaseGenMindContainer');
    var canvas = document.querySelector('#xmindCaseGenMindContainer [data-mind-canvas]');
    var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
    if (!viewer || !canvas || !map) return { before: '', after: '', dispatched: false };
    var rect = canvas.getBoundingClientRect();
    var before = map.style && map.style.transform ? String(map.style.transform || '') : '';
    canvas.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: Number(dx) || 0,
      deltaY: Number(dy) || 0,
      clientX: rect.left + (rect.width / 2),
      clientY: rect.top + (rect.height / 2),
    }));
    var after = map.style && map.style.transform ? String(map.style.transform || '') : '';
    return {
      before: before,
      after: after,
      dispatched: true,
    };
  }, { dx: deltaX, dy: deltaY });
}

async function toggleXmindCasegenNodeCollapse(page, text) {
  return page.evaluate((expected) => {
    var needle = String(expected || '').trim();
    if (!needle) return false;
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = Array.prototype.find.call(nodes, function(node) {
      var content = node && node.textContent ? String(node.textContent).replace(/\s+/g, ' ').trim() : '';
      return content.indexOf(needle) !== -1;
    });
    if (!target) return false;
    var parent = target.parentElement;
    var expander = parent && parent.querySelector ? parent.querySelector('me-epd') : null;
    if (!expander && target.nextElementSibling && target.nextElementSibling.tagName === 'ME-EPD') {
      expander = target.nextElementSibling;
    }
    if (!expander && target.previousElementSibling && target.previousElementSibling.tagName === 'ME-EPD') {
      expander = target.previousElementSibling;
    }
    if (!expander) return false;
    if (typeof expander.click === 'function') {
      expander.click();
      return true;
    }
    if (typeof expander.dispatchEvent !== 'function') return false;
    expander.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, text);
}

async function readXmindCasegenViewSnapshot(page) {
  return page.evaluate(() => {
    var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
    var drawer = document.getElementById('xmindCaseGenDrawer');
    var state = window.app && window.app.state && window.app.state.xmindCaseGen
      ? window.app.state.xmindCaseGen
      : null;
    return {
      activeTab: window.app && window.app.state ? String(window.app.state.activeTab || '') : '',
      drawerOpen: Boolean(drawer && drawer.classList && drawer.classList.contains('open')),
      drawerFullscreen: Boolean(drawer && drawer.classList && drawer.classList.contains('xmind-drawer-fullscreen')),
      transform: map && map.style ? String(map.style.transform || '') : '',
      viewState: state && state.viewState ? JSON.parse(JSON.stringify(state.viewState)) : null,
    };
  });
}

async function readXmindRootCenter(page) {
  return page.evaluate(() => {
    var textEl = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
    if (!textEl || !textEl.getBoundingClientRect) return null;
    var rect = textEl.getBoundingClientRect();
    return {
      x: Number(rect.left + (rect.width / 2)),
      y: Number(rect.top + (rect.height / 2)),
    };
  });
}

async function readXmindRootOffsetFromViewer(page) {
  return page.evaluate(() => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
      || document.getElementById('xmindCaseGenMindContainer');
    var textEl = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
    if (!viewer || !viewer.getBoundingClientRect || !textEl || !textEl.getBoundingClientRect) return null;
    var viewerRect = viewer.getBoundingClientRect();
    var rect = textEl.getBoundingClientRect();
    return {
      dx: Number((rect.left + (rect.width / 2)) - (viewerRect.left + (viewerRect.width / 2))),
      dy: Number((rect.top + (rect.height / 2)) - (viewerRect.top + (viewerRect.height / 2))),
    };
  });
}

async function waitForPaintFrames(page, count) {
  const frameCount = Number(count) > 0 ? Number(count) : 1;
  await page.evaluate((nextCount) => {
    return new Promise((resolve) => {
      var remaining = nextCount;
      function step() {
        remaining -= 1;
        if (remaining <= 0) {
          resolve(true);
          return;
        }
        window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    });
  }, frameCount);
}

function parseMindTransformText(text) {
  const raw = String(text || '');
  const translate3dMatch = raw.match(/translate3d\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*,/i);
  const translateMatch = translate3dMatch || raw.match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/i);
  const scaleMatch = raw.match(/scale\(\s*(-?\d+(?:\.\d+)?)\s*\)/i);
  return {
    x: translateMatch ? Number(translateMatch[1] || 0) : 0,
    y: translateMatch ? Number(translateMatch[2] || 0) : 0,
    scale: scaleMatch ? Number(scaleMatch[1] || 1) : 1,
  };
}

async function readCaseResults(page, moduleId) {
  return page.evaluate((id) => {
    if (!window.app || !window.app.state || !window.app.state.caseGenResults) return [];
    var raw = String(window.app.state.caseGenResults[id] || '');
    if (!raw.trim()) return [];
    try {
      return JSON.parse(raw);
    } catch (err) {
      return [];
    }
  }, moduleId);
}

async function waitForAnyGeneratedCases(page) {
  await page.waitForFunction(() => {
    var state = window.app && window.app.state ? window.app.state : null;
    var results = state && state.caseGenResults && typeof state.caseGenResults === 'object'
      ? state.caseGenResults
      : {};
    return Object.keys(results).some(function(key) {
      var raw = String(results[key] || '').trim();
      if (!raw) return false;
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch (err) {
        return false;
      }
    });
  }, {}, { timeout: 15000 });
}

async function readState(page) {
  return page.evaluate(() => {
    if (!window.app || !window.app.state) return null;
    return JSON.parse(JSON.stringify(window.app.state));
  });
}

async function readXmindToolbarOverview(page) {
  return page.evaluate(() => {
    var taskEl = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-task-state]');
    var moduleEl = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-count-modules] strong');
    var caseEl = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-count-cases] strong');
    var dedupeEl = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-count-dedupe]');
    var dedupeCountEl = dedupeEl ? dedupeEl.querySelector('strong') : null;
    return {
      state: taskEl ? String(taskEl.getAttribute('data-xmind-casegen-task-state') || '') : '',
      label: taskEl ? String(taskEl.textContent || '').replace(/\s+/g, ' ').trim() : '',
      modules: moduleEl ? Number(moduleEl.textContent || 0) : -1,
      cases: caseEl ? Number(caseEl.textContent || 0) : -1,
      dedupeRemoved: dedupeCountEl ? Number(dedupeCountEl.textContent || 0) : null,
      dedupeText: dedupeEl ? String(dedupeEl.textContent || '').replace(/\s+/g, ' ').trim() : '',
    };
  });
}

async function readActiveXmindWorkspaceProgress(page) {
  return page.evaluate(() => {
    var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
    var items = api && typeof api.getWorkspaceProgressItems === 'function'
      ? api.getWorkspaceProgressItems()
      : [];
    var active = null;
    (Array.isArray(items) ? items : []).some(function(item) {
      if (item && item.active) {
        active = item;
        return true;
      }
      return false;
    });
    active = active || (Array.isArray(items) && items.length ? items[0] : null);
    return {
      modules: active ? Number(active.moduleCount || 0) : -1,
      cases: active ? Number(active.caseCount || 0) : -1,
      statusText: active ? String(active.statusText || '') : '',
    };
  });
}

async function autoAcceptXmindConfirm(page) {
  await page.evaluate(() => {
    window.__xmindConfirmPayload = null;
    window.confirm = function(message) {
      window.__xmindConfirmPayload = {
        message: String(message || ''),
      };
      return true;
    };
    if (window.app && window.app.confirmDrawer) {
      window.app.confirmDrawer.open = function(payload) {
        window.__xmindConfirmPayload = payload || null;
        return Promise.resolve({ ok: true });
      };
    }
  });
}

async function ctrlClickXmindNodes(page, topics) {
  await page.keyboard.down('Control');
  try {
    for (const topic of topics || []) {
      const point = await page.evaluate((expected) => {
        var needle = String(expected || '').trim();
        var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
        var target = null;
        Array.prototype.some.call(nodes, function(node) {
          var textEl = node && node.querySelector ? node.querySelector('.text') : null;
          var label = textEl
            ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
            : '';
          var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
          if (!(stableLabel === needle || label === needle)) return false;
          target = textEl && textEl.getBoundingClientRect ? textEl : node;
          return true;
        });
        if (!target || !target.getBoundingClientRect) return null;
        var rect = target.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        return {
          x: rect.left + (rect.width / 2),
          y: rect.top + (rect.height / 2),
        };
      }, topic);
      expect(point).toBeTruthy();
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(240);
    }
  } finally {
    await page.keyboard.up('Control');
  }
}

async function clickXmindNode(page, topicText) {
  await page.waitForFunction((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    return Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      return stableLabel === topic || label === topic;
    });
  }, topicText, { timeout: 15000 });
  const clicked = await page.evaluate((topic) => {
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var target = null;
    Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!(stableLabel === topic || label === topic)) return false;
      target = node;
      return true;
    });
    if (!target || !target.getBoundingClientRect) return false;
    var rect = target.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    var centerX = rect.left + (rect.width / 2);
    var centerY = rect.top + (rect.height / 2);
    ['mousemove', 'mousedown', 'mouseup', 'click'].forEach(function(type) {
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        button: 0,
        buttons: type === 'mousedown' ? 1 : 0,
      }));
    });
    return true;
  }, topicText);
  expect(clicked).toBeTruthy();
  await page.waitForTimeout(80);
}

async function dragBoxSelectXmindNodes(page, topics) {
  async function readLayout() {
    return page.evaluate((inputTopics) => {
      var expected = Array.isArray(inputTopics) ? inputTopics.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean) : [];
      var canvas = document.querySelector('#xmindCaseGenMindContainer [data-mind-canvas]');
      var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
        || document.getElementById('xmindCaseGenMindContainer');
      var boundsTarget = canvas && canvas.getBoundingClientRect ? canvas : viewer;
      if (!boundsTarget || !boundsTarget.getBoundingClientRect) return null;
      var boundsRect = boundsTarget.getBoundingClientRect();
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      var minLeft = Infinity;
      var minTop = Infinity;
      var maxRight = -Infinity;
      var maxBottom = -Infinity;
      var matchedCount = 0;
      expected.forEach(function(topic) {
        Array.prototype.some.call(nodes, function(node) {
          if (!node || !node.getBoundingClientRect) return false;
          var textEl = node.querySelector ? node.querySelector('.text') : null;
          var label = textEl
            ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
            : '';
          var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
          if (!(stableLabel === topic || label === topic)) return false;
          var targetRect = textEl && textEl.getBoundingClientRect ? textEl.getBoundingClientRect() : node.getBoundingClientRect();
          minLeft = Math.min(minLeft, targetRect.left);
          minTop = Math.min(minTop, targetRect.top);
          maxRight = Math.max(maxRight, targetRect.right);
          maxBottom = Math.max(maxBottom, targetRect.bottom);
          matchedCount += 1;
          return true;
        });
      });
      if (!matchedCount || !isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) return null;
      return {
        bounds: {
          left: boundsRect.left,
          top: boundsRect.top,
          right: boundsRect.right,
          bottom: boundsRect.bottom,
        },
        target: {
          left: minLeft,
          top: minTop,
          right: maxRight,
          bottom: maxBottom,
        },
        matchedCount: matchedCount,
      };
    }, topics);
  }

  var layout = await readLayout();
  for (var attempt = 0; attempt < 3; attempt += 1) {
    await page.waitForTimeout(160);
    var nextLayout = await readLayout();
    if (!layout || !nextLayout) {
      layout = nextLayout;
      continue;
    }
    var stableX = Math.abs(Number(layout.target.left || 0) - Number(nextLayout.target.left || 0)) < 2;
    var stableY = Math.abs(Number(layout.target.top || 0) - Number(nextLayout.target.top || 0)) < 2;
    layout = nextLayout;
    if (stableX && stableY) break;
  }

  expect(layout && layout.matchedCount).toBe((topics || []).length);

  var attempts = [
    { x: 12, y: 10 },
    { x: 18, y: 12 },
    { x: 24, y: 14 },
    { x: 28, y: 16 },
  ];
  var selectedCount = 0;
  for (const padding of attempts) {
    var rect = {
      startX: Math.max(layout.bounds.left + 8, layout.target.left - padding.x),
      startY: Math.max(layout.bounds.top + 8, layout.target.top - padding.y),
      endX: Math.min(layout.bounds.right - 8, layout.target.right + padding.x),
      endY: Math.min(layout.bounds.bottom - 8, layout.target.bottom + padding.y),
    };
    await page.mouse.move(rect.startX, rect.startY);
    await page.mouse.down();
    await page.mouse.move(rect.endX, rect.endY, { steps: 18 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    selectedCount = await readSelectedXmindNodeCount(page);
    if (selectedCount >= (topics || []).length) break;
  }
}

async function beginHeldDragBoxSelectXmindNodes(page, topics) {
  async function readLayout() {
    return page.evaluate((inputTopics) => {
      var expected = Array.isArray(inputTopics) ? inputTopics.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean) : [];
      var canvas = document.querySelector('#xmindCaseGenMindContainer [data-mind-canvas]');
      var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
        || document.getElementById('xmindCaseGenMindContainer');
      var boundsTarget = canvas && canvas.getBoundingClientRect ? canvas : viewer;
      if (!boundsTarget || !boundsTarget.getBoundingClientRect) return null;
      var boundsRect = boundsTarget.getBoundingClientRect();
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      var minLeft = Infinity;
      var minTop = Infinity;
      var maxRight = -Infinity;
      var maxBottom = -Infinity;
      var matchedCount = 0;
      expected.forEach(function(topic) {
        Array.prototype.some.call(nodes, function(node) {
          if (!node || !node.getBoundingClientRect) return false;
          var textEl = node.querySelector ? node.querySelector('.text') : null;
          var label = textEl
            ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
            : '';
          var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
          if (!(stableLabel === topic || label === topic)) return false;
          var targetRect = textEl && textEl.getBoundingClientRect ? textEl.getBoundingClientRect() : node.getBoundingClientRect();
          minLeft = Math.min(minLeft, targetRect.left);
          minTop = Math.min(minTop, targetRect.top);
          maxRight = Math.max(maxRight, targetRect.right);
          maxBottom = Math.max(maxBottom, targetRect.bottom);
          matchedCount += 1;
          return true;
        });
      });
      if (!matchedCount || !isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) return null;
      return {
        bounds: {
          left: boundsRect.left,
          top: boundsRect.top,
          right: boundsRect.right,
          bottom: boundsRect.bottom,
        },
        target: {
          left: minLeft,
          top: minTop,
          right: maxRight,
          bottom: maxBottom,
        },
        matchedCount: matchedCount,
      };
    }, topics);
  }

  var layout = await readLayout();
  for (var attempt = 0; attempt < 3; attempt += 1) {
    await page.waitForTimeout(160);
    var nextLayout = await readLayout();
    if (!layout || !nextLayout) {
      layout = nextLayout;
      continue;
    }
    var stableX = Math.abs(Number(layout.target.left || 0) - Number(nextLayout.target.left || 0)) < 2;
    var stableY = Math.abs(Number(layout.target.top || 0) - Number(nextLayout.target.top || 0)) < 2;
    layout = nextLayout;
    if (stableX && stableY) break;
  }

  expect(layout && layout.matchedCount).toBe((topics || []).length);

  var padding = { x: 18, y: 12 };
  var rect = {
    startX: Math.max(layout.bounds.left + 8, layout.target.left - padding.x),
    startY: Math.max(layout.bounds.top + 8, layout.target.top - padding.y),
    endX: Math.min(layout.bounds.right - 8, layout.target.right + padding.x),
    endY: Math.min(layout.bounds.bottom - 8, layout.target.bottom + padding.y),
  };
  await page.mouse.move(rect.startX, rect.startY);
  await page.mouse.down();
  await page.mouse.move(rect.endX, rect.endY, { steps: 18 });
  return rect;
}

async function pressDeleteInXmind(page) {
  const hasViewer = await page.evaluate(() => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
      || document.getElementById('xmindCaseGenMindContainer');
    if (!viewer || typeof viewer.focus !== 'function') return false;
    if (typeof viewer.focus === 'function') viewer.focus();
    return true;
  });
  expect(hasViewer).toBeTruthy();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(60);
}

async function pressDeleteUndoInXmind(page) {
  const hasViewer = await page.evaluate(() => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
      || document.getElementById('xmindCaseGenMindContainer');
    if (!viewer || typeof viewer.focus !== 'function') return false;
    viewer.focus();
    return true;
  });
  expect(hasViewer).toBeTruthy();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
}

async function pressDeleteRedoInXmind(page) {
  const hasViewer = await page.evaluate(() => {
    var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
      || document.getElementById('xmindCaseGenMindContainer');
    if (!viewer || typeof viewer.focus !== 'function') return false;
    viewer.focus();
    return true;
  });
  expect(hasViewer).toBeTruthy();
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(120);
}

async function readSelectedXmindNodeCount(page) {
  return page.evaluate(() => {
    var selected = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-box-selected, #xmindCaseGenMindContainer .selected');
    var seen = {};
    Array.prototype.forEach.call(selected || [], function(node) {
      var host = node && node.closest ? node.closest('me-tpc') : node;
      var textEl = host && host.querySelector ? host.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!stableLabel) return;
      seen[stableLabel] = true;
    });
    return Object.keys(seen).length;
  });
}

async function readSelectedXmindNodeLabels(page) {
  return page.evaluate(() => {
    var selected = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-box-selected, #xmindCaseGenMindContainer .selected');
    var labels = [];
    var seen = {};
    Array.prototype.forEach.call(selected || [], function(node) {
      var host = node && node.closest ? node.closest('me-tpc') : node;
      var textEl = host && host.querySelector ? host.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!stableLabel || seen[stableLabel]) return;
      seen[stableLabel] = true;
      labels.push(stableLabel);
    });
    return labels;
  });
}

async function readSelectedXmindVisualState(page, topics) {
  return page.evaluate((expectedTopics) => {
    var targets = Array.isArray(expectedTopics) ? expectedTopics.map(function(item) {
      return String(item || '').trim();
    }).filter(Boolean) : [];
    var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
    var result = {};
    Array.prototype.forEach.call(nodes || [], function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      var stableLabel = label.replace(/\s*\+AI\s*$/, '').trim();
      if (!stableLabel || targets.indexOf(stableLabel) === -1 || result[stableLabel]) return;
      var selectedCarrier = node.classList && node.classList.contains('xmind-box-selected')
        ? node
        : (textEl && textEl.classList && textEl.classList.contains('selected') ? textEl : null);
      if (!selectedCarrier && node.classList && node.classList.contains('selected')) selectedCarrier = node;
      if (!selectedCarrier && node.querySelector) selectedCarrier = node.querySelector('.selected');
      var computedTarget = textEl || selectedCarrier || node;
      var style = computedTarget && typeof window !== 'undefined' && window.getComputedStyle
        ? window.getComputedStyle(computedTarget)
        : null;
      result[stableLabel] = {
        hostBoxSelected: Boolean(node.classList && node.classList.contains('xmind-box-selected')),
        hostSelected: Boolean(node.classList && node.classList.contains('selected')),
        selectedCarrierTag: selectedCarrier && selectedCarrier.tagName ? String(selectedCarrier.tagName).toLowerCase() : '',
        selectedCarrierClass: selectedCarrier && selectedCarrier.className ? String(selectedCarrier.className) : '',
        boxShadow: style ? String(style.boxShadow || '') : '',
        outlineStyle: style ? String(style.outlineStyle || '') : '',
        outlineWidth: style ? String(style.outlineWidth || '') : '',
        backgroundColor: style ? String(style.backgroundColor || '') : '',
      };
    });
    return result;
  }, Array.isArray(topics) ? topics : []);
}

test.describe('XMind 用例生成抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('首次进入 XMind 页签抽屉时仅展示新建生成，创建后会自动打开前置准备', async ({ page }) => {
    const token = 'xmind-tabs-first-token';
    const user = { id: 801, username: 'tabs-first' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);

    await page.click('#caseGenModulesTabBtn');
    await page.click('#xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(0);
    await expect(page.locator('#xmindCaseGenWorkspaceAddBtn')).toHaveText('新建生成');
    await expect(page.locator('#xmindCaseGenMindContainer')).toContainText('暂无生成页签');

    await page.click('#xmindCaseGenWorkspaceAddBtn');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogTitle')).toHaveText('生成前置准备');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
  });

  test('不同 XMind 生成页签的前置准备配置彼此独立，切换后会回到各自状态', async ({ page }) => {
    const token = 'xmind-tabs-isolation-token';
    const user = { id: 802, username: 'tabs-isolation' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);

    await page.click('#caseGenModulesTabBtn');
    await page.click('#xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);

    await page.click('#xmindCaseGenWorkspaceAddBtn');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
    await page.click('label:has(input[name="xmindRequirementMode"][value="manual"])');
    await page.fill('#xmindCaseGenManualRequirementLabel', '页签A需求');
    await page.fill('#xmindCaseGenManualRequirementText', '这是页签A的需求描述');
    await expect(page.locator('#xmindCaseGenManualRequirementText')).toHaveValue('这是页签A的需求描述');
    await page.click('#xmindCaseGenSummaryCloseBtn');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]:first-child')).toContainText('页签A需求');

    await page.click('#xmindCaseGenWorkspaceAddBtn');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(2);
    await expect(page.locator('input[name="xmindRequirementMode"][value="manual"]')).not.toBeChecked();
    await expect(page.locator('#xmindCaseGenManualRequirementText')).toHaveCount(0);
    await page.click('label:has(input[name="xmindRequirementMode"][value="manual"])');
    await page.fill('#xmindCaseGenManualRequirementLabel', '页签B需求');
    await expect(page.locator('#xmindCaseGenManualRequirementText')).toHaveValue('');
    await page.fill('#xmindCaseGenManualRequirementText', '这是页签B的需求描述');
    await expect(page.locator('#xmindCaseGenManualRequirementText')).toHaveValue('这是页签B的需求描述');
    await page.click('#xmindCaseGenSummaryCloseBtn');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]:nth-child(2)')).toContainText('页签B需求');

    await page.click('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]:first-child');
    await page.click('#xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenManualRequirementLabel')).toHaveValue('页签A需求');
    await expect(page.locator('#xmindCaseGenManualRequirementText')).toHaveValue('这是页签A的需求描述');
    await page.click('#xmindCaseGenSummaryCloseBtn');

    await page.click('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]:nth-child(2)');
    await page.click('#xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenManualRequirementLabel')).toHaveValue('页签B需求');
    await expect(page.locator('#xmindCaseGenManualRequirementText')).toHaveValue('这是页签B的需求描述');
  });

  test('左下角 xmind 用例生成进度面板复用 XMind 页签摘要，并支持点击切换对应页签', async ({ page }) => {
    const token = 'xmind-progress-panel-token';
    const user = { id: 8022, username: 'xmind-progress-panel' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '侧栏摘要-A', '这是侧栏摘要 A 的需求描述', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await createXmindWorkspaceByManualPrep(page, '侧栏摘要-B', '这是侧栏摘要 B 的需求描述', {
      completePrep: true,
    });

    await expect(page.locator('#sidebarTabCasegen')).toContainText('xmind用例生成进度');
    await expect(page.locator('#caseGenProgressPanel .title')).toHaveText('xmind用例生成进度');
    await expect(page.locator('#caseGenProgressList [data-casegen-workspace]')).toHaveCount(2);

    const summaries = await page.evaluate(() => {
      function normalizeText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
      }
      var tabs = Array.prototype.map.call(
        document.querySelectorAll('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab] .xmind-casegen-tab-label'),
        function(node) {
          return normalizeText(node ? node.textContent : '');
        }
      );
      var panel = Array.prototype.map.call(
        document.querySelectorAll('#caseGenProgressList [data-casegen-workspace] .titles'),
        function(node) {
          return normalizeText(node ? node.textContent : '');
        }
      );
      return { tabs: tabs, panel: panel };
    });
    expect(summaries.panel).toEqual(summaries.tabs);

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);
    await page.waitForTimeout(400);

    await page.locator('#caseGenProgressList [data-casegen-workspace]').first().dispatchEvent('click');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('侧栏摘要-A');
  });

  test('用例生成页会拆分旧流程模块区与 XMind 模块区，切换 XMind 页签不会覆盖旧流程模块', async ({ page }) => {
    const token = 'xmind-module-mirror-tabs-token';
    const user = { id: 80221, username: 'xmind-module-mirror-tabs' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '模块镜像-A', '这是模块镜像 A 的需求描述', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await createXmindWorkspaceByManualPrep(page, '模块镜像-B', '这是模块镜像 B 的需求描述', {
      completePrep: true,
    });

    const workspaceIds = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      return host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
    });
    expect(workspaceIds).toHaveLength(2);

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    await page.evaluate(({ ids }) => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.xmindCaseGen || !state.xmindCaseGen.workspaces) return;
      var host = state.xmindCaseGen;
      function buildCases(moduleTitle, caseTitle) {
        return JSON.stringify([{
          module: moduleTitle,
          title: caseTitle,
          priority: 'P1',
          preconditions: moduleTitle + '前置条件',
          steps: ['1、进入' + moduleTitle, '2、执行' + caseTitle],
          expected: caseTitle + '执行成功',
        }], null, 2);
      }
      function applyWorkspace(record, moduleId, moduleTitle, caseTitle) {
        if (!record || !record.snapshot || !record.snapshot.shared) return;
        record.snapshot.shared.caseGenModules = [{
          id: moduleId,
          title: moduleTitle,
          module: moduleTitle,
          key_scenarios: [moduleTitle + '主场景'],
          test_points: [moduleTitle + '关键校验'],
          coupled_modules: [],
        }];
        record.snapshot.shared.caseGenResults = {};
        record.snapshot.shared.caseGenResults[moduleId] = buildCases(moduleTitle, caseTitle);
        record.snapshot.shared.caseSelections = {};
        record.snapshot.shared.caseGenSuggestions = {};
        record.snapshot.shared.caseGenModuleStatus = {};
        record.snapshot.shared.caseGenProgress = {};
        record.snapshot.shared.caseGenTiming = {};
        record.snapshot.shared.caseGenProgressNotice = {};
      }
      applyWorkspace(host.workspaces[ids[0]], 'mirror-mod-a', '镜像模块-A', '镜像用例-A');
      applyWorkspace(host.workspaces[ids[1]], 'mirror-mod-b', '镜像模块-B', '镜像用例-B');
      host.activeWorkspaceId = String(ids[1] || '');
      state.requirementLabel = '旧流程需求-A';
      state.requirementLabelSource = 'import';
      state.lastRawImportName = '旧流程需求A.docx';
      state.importedCases = [{
        id: 'legacy-import-1',
        name: '旧流程用例导入-A.json',
        text: buildCases('旧流程模块-1', '旧流程用例-1'),
        list: [{
          module: '旧流程模块-1',
          title: '旧流程用例-1',
          priority: 'P1',
          preconditions: '旧流程前置条件',
          steps: ['1、进入旧流程页面', '2、执行旧流程操作'],
          expected: '旧流程结果正确',
        }],
      }];
      state.requirementMedia = {
        docxImages: [],
        pastedImages: [],
        lastDocxImageCount: 0,
        updatedAt: Date.now(),
      };
      state.caseGenLegacy = {
        requirementLabel: '旧流程需求-A',
        requirementLabelSource: 'import',
        lastRawImportName: '旧流程需求A.docx',
        rawText: '这里是旧流程需求原文',
        caseText: buildCases('旧流程模块-1', '旧流程用例-1'),
        importedCases: JSON.parse(JSON.stringify(state.importedCases || [])),
        requirementMedia: JSON.parse(JSON.stringify(state.requirementMedia || {})),
        modules: [{
          id: 'legacy-mod-1',
          title: '旧流程模块-1',
          module: '旧流程模块-1',
          key_scenarios: ['旧流程主场景'],
          test_points: ['旧流程关键校验'],
          coupled_modules: [],
        }],
        source: '旧流程拆分结果',
        results: {
          'legacy-mod-1': buildCases('旧流程模块-1', '旧流程用例-1'),
        },
        selections: {},
        suggestions: {},
        moduleStatus: {},
        progress: {},
        timing: {},
        progressNotice: {},
      };
      state.caseGenModules = JSON.parse(JSON.stringify(host.workspaces[ids[1]].snapshot.shared.caseGenModules || []));
      state.caseGenResults = JSON.parse(JSON.stringify(host.workspaces[ids[1]].snapshot.shared.caseGenResults || {}));
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      state.caseGenProgressNotice = {};
      var rawTextEl = document.getElementById('rawText');
      var fileNameEl = document.getElementById('fileName');
      var caseTextEl = document.getElementById('caseText');
      if (rawTextEl) rawTextEl.value = '这里是旧流程需求原文';
      if (fileNameEl) fileNameEl.textContent = '旧流程需求A.docx';
      if (caseTextEl) caseTextEl.value = buildCases('旧流程模块-1', '旧流程用例-1');
      if (window.app && window.app.casesCoreApi) {
        if (typeof window.app.casesCoreApi.renderImportedCaseList === 'function') {
          window.app.casesCoreApi.renderImportedCaseList();
        }
        if (typeof window.app.casesCoreApi.syncCaseTextWithImports === 'function') {
          window.app.casesCoreApi.syncCaseTextWithImports();
        }
      }
    }, { ids: workspaceIds });

    await clickElementById(page, 'caseGenLegacyModulesTabBtn');
    await expect(page.locator('#casegenLegacyModulesPanel')).toHaveClass(/is-active/);
    await expect(page.locator('#casesGenerationContainer')).toContainText('旧流程模块-1');
    await expect(page.locator('#casesGenerationContainer')).toContainText('旧流程用例-1');
    await expect(page.locator('#casesGenerationContainer')).not.toContainText('镜像模块-B');
    await expect(page.locator('#caseFileList')).toContainText('旧流程用例导入-A.json');

    await clickElementById(page, 'caseGenModulesTabBtn');
    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace]')).toHaveCount(2);
    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace]').first()).toContainText('模块镜像-A');
    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace].active')).toContainText('模块镜像-B');
    const mirrorActiveStyle = await page.evaluate(() => {
      var active = document.querySelector('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace].active');
      var inactive = document.querySelector('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace]:not(.active)');
      if (!active || !inactive || typeof window.getComputedStyle !== 'function') return null;
      var activeStyle = window.getComputedStyle(active);
      var inactiveStyle = window.getComputedStyle(inactive);
      return {
        ariaCurrent: active.getAttribute('aria-current') || '',
        activeBorderColor: String(activeStyle.borderColor || ''),
        inactiveBorderColor: String(inactiveStyle.borderColor || ''),
        activeBoxShadow: String(activeStyle.boxShadow || ''),
        inactiveBoxShadow: String(inactiveStyle.boxShadow || ''),
      };
    });
    expect(mirrorActiveStyle).toBeTruthy();
    expect(mirrorActiveStyle.ariaCurrent).toBe('page');
    expect(mirrorActiveStyle.activeBorderColor).not.toBe(mirrorActiveStyle.inactiveBorderColor);
    expect(mirrorActiveStyle.activeBoxShadow).not.toBe(mirrorActiveStyle.inactiveBoxShadow);
    await expect(page.locator('#caseGenXmindModulesContainer')).toContainText('镜像模块-B');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace]').first().click();
    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace].active')).toContainText('模块镜像-A');
    await expect(page.locator('#caseGenXmindModulesContainer')).toContainText('镜像模块-A');
    await expect(page.locator('#caseGenXmindModulesContainer')).not.toContainText('镜像模块-B');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);
    await page.locator('#caseGenXmindModulesContainer [data-xmind-mirror-view]').first().click();
    await expect(page.locator('#caseGenViewDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenViewDrawerTitle')).toContainText('用例视图 - 镜像模块-A');
    await expect(page.locator('#caseGenViewDrawerBody')).toContainText('镜像用例-A');
    await expect(page.locator('#caseGenViewDrawerBody')).toContainText('1、进入镜像模块-A');
    await expect(page.locator('#caseGenViewDrawerBody')).not.toContainText('1、进入镜像模块-A / 2、执行镜像用例-A');
    await page.click('#closeCaseGenViewDrawerBtn');
    await expect(page.locator('#caseGenViewDrawer')).not.toHaveClass(/open/);

    await page.locator('#caseGenXmindModulesContainer [data-open-xmind-workspace]').first().click();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('模块镜像-A');
    await waitForNodeText(page, '镜像模块-A');
    await waitForNodeText(page, '镜像用例-A');
    await expect(page.locator('#xmindCaseGenMindContainer')).not.toContainText('镜像模块-B');
    await page.click('#closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);

    await page.click('#xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('模块镜像-A');
    await waitForNodeText(page, '镜像模块-A');
    await waitForNodeText(page, '镜像用例-A');
    await page.click('#closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      return Boolean(
        state
        && state.lastRawImportName === '旧流程需求A.docx'
        && state.requirementLabel === '旧流程需求-A'
        && Array.isArray(state.importedCases)
        && state.importedCases.length === 1
      );
    }, null, { timeout: 10000 });
    await expect(page.locator('#caseFileList')).toContainText('旧流程用例导入-A.json');
    const restoredLegacyContext = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var rawTextEl = document.getElementById('rawText');
      var caseTextEl = document.getElementById('caseText');
      return {
        requirementLabel: state ? String(state.requirementLabel || '') : '',
        lastRawImportName: state ? String(state.lastRawImportName || '') : '',
        importedCount: state && Array.isArray(state.importedCases) ? state.importedCases.length : 0,
        rawText: rawTextEl ? String(rawTextEl.value || '') : '',
        caseText: caseTextEl ? String(caseTextEl.value || '') : '',
      };
    });
    expect(restoredLegacyContext.requirementLabel).toBe('旧流程需求-A');
    expect(restoredLegacyContext.lastRawImportName).toBe('旧流程需求A.docx');
    expect(restoredLegacyContext.importedCount).toBe(1);
    expect(restoredLegacyContext.rawText).toContain('旧流程需求原文');
    expect(restoredLegacyContext.caseText).toContain('旧流程用例-1');

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('auto');
      }
    });
    await page.waitForFunction(() => {
      return window.app && window.app.state && window.app.state.activeTab === 'auto';
    }, null, { timeout: 10000 });
    await expect(page.locator('section[data-section-id="auto-import"]')).toBeVisible();
    const contextAfterLeavingCasesgen = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var rawTextEl = document.getElementById('rawText');
      var caseTextEl = document.getElementById('caseText');
      return {
        requirementLabel: state ? String(state.requirementLabel || '') : '',
        lastRawImportName: state ? String(state.lastRawImportName || '') : '',
        importedCount: state && Array.isArray(state.importedCases) ? state.importedCases.length : 0,
        rawText: rawTextEl ? String(rawTextEl.value || '') : '',
        caseText: caseTextEl ? String(caseTextEl.value || '') : '',
      };
    });
    expect(contextAfterLeavingCasesgen.requirementLabel).toBe('旧流程需求-A');
    expect(contextAfterLeavingCasesgen.lastRawImportName).toBe('旧流程需求A.docx');
    expect(contextAfterLeavingCasesgen.importedCount).toBe(1);
    expect(contextAfterLeavingCasesgen.rawText).toContain('旧流程需求原文');
    expect(contextAfterLeavingCasesgen.caseText).toContain('旧流程用例-1');

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('casesgen');
      }
    });
    await page.waitForFunction(() => {
      return window.app && window.app.state && window.app.state.activeTab === 'casesgen';
    }, null, { timeout: 10000 });
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      return Boolean(
        state
        && state.lastRawImportName === '旧流程需求A.docx'
        && state.requirementLabel === '旧流程需求-A'
        && Array.isArray(state.importedCases)
        && state.importedCases.length === 1
      );
    }, null, { timeout: 10000 });
    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await expect(page.locator('#caseFileList')).toContainText('旧流程用例导入-A.json');
  });

  test('旧流程用例生成进行中时，打开或重开 XMind 不会清掉运行态', async ({ page }) => {
    const token = 'xmind-legacy-running-guard-token';
    const user = { id: 80224, username: 'xmind-legacy-running-guard' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '运行态隔离-XMind', '这是用于验证旧流程运行态隔离的 XMind 需求', {
      useExistingWorkspace: true,
      completePrep: true,
    });

    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);

    await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.xmindCaseGen || !state.xmindCaseGen.workspaces) return;
      var host = state.xmindCaseGen;
      var workspaceId = String(host.activeWorkspaceId || (host.workspaceOrder && host.workspaceOrder[0]) || '');
      var record = workspaceId ? host.workspaces[workspaceId] : null;
      function buildCases(moduleTitle, caseTitle) {
        return JSON.stringify([{
          module: moduleTitle,
          title: caseTitle,
          priority: 'P1',
          preconditions: moduleTitle + '前置条件',
          steps: ['1、进入' + moduleTitle, '2、执行' + caseTitle],
          expected: caseTitle + '执行成功',
        }], null, 2);
      }
      if (record && record.snapshot && record.snapshot.shared) {
        record.snapshot.shared.caseGenModules = [{
          id: 'xmind-running-guard-mod',
          title: 'XMind镜像模块',
          module: 'XMind镜像模块',
          key_scenarios: ['XMind镜像主场景'],
          test_points: ['XMind镜像关键校验'],
          coupled_modules: [],
        }];
        record.snapshot.shared.caseGenResults = {
          'xmind-running-guard-mod': buildCases('XMind镜像模块', 'XMind镜像用例'),
        };
        record.snapshot.shared.caseSelections = {};
        record.snapshot.shared.caseGenSuggestions = {};
        record.snapshot.shared.caseGenModuleStatus = {
          'xmind-running-guard-mod': { text: '已生成 1 条用例', type: 'ok' },
        };
        record.snapshot.shared.caseGenProgress = {};
        record.snapshot.shared.caseGenTiming = {};
        record.snapshot.shared.caseGenProgressNotice = {};
        record.snapshot.shared.caseGenSource = 'xmind-running-guard';
      }
      host.mirrorWorkspaceId = workspaceId;
      state.caseGenLegacy = {
        requirementLabel: '旧流程运行态需求',
        requirementLabelSource: 'import',
        lastRawImportName: 'legacy-running.docx',
        rawText: '旧流程运行态需求正文',
        caseText: '',
        importedCases: [],
        requirementMedia: {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: Date.now(),
        },
        modules: [{
          id: 'legacy-running-mod',
          title: '旧流程运行中模块',
          module: '旧流程运行中模块',
          key_scenarios: ['旧流程主场景'],
          test_points: ['旧流程关键校验'],
          coupled_modules: [],
        }],
        source: 'legacy-running-source',
        results: {},
        selections: {},
        suggestions: {},
        moduleStatus: {
          'legacy-running-mod': { text: '正在生成【旧流程运行中模块】的测试用例...', type: '' },
        },
        progress: {},
        timing: {},
        progressNotice: {},
        running: ['legacy-running-mod'],
      };
      state.caseGenModules = JSON.parse(JSON.stringify(state.caseGenLegacy.modules || []));
      state.caseGenSource = 'legacy-running-source';
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {
        'legacy-running-mod': { text: '正在生成【旧流程运行中模块】的测试用例...', type: '' },
      };
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      state.caseGenProgressNotice = {};
      state.caseGenSettings = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? state.caseGenSettings
        : {};
      state.caseGenSettings.activeTab = 'legacy-modules';
      if (window.app && typeof window.app.setCaseModuleRunning === 'function') {
        window.app.setCaseModuleRunning('legacy-running-mod', true);
      } else {
        state.caseGenRunning = new Set(['legacy-running-mod']);
      }
      if (window.app && window.app.casesGenApi) {
        if (typeof window.app.casesGenApi.syncLegacyCaseGenState === 'function') {
          window.app.casesGenApi.syncLegacyCaseGenState({ persist: false, force: true });
        }
        if (typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
          window.app.casesGenApi.renderCaseGeneration();
        }
      }
    });

    async function expectLegacyRunning(expectedActiveView) {
      await clickElementById(page, 'caseGenLegacyModulesTabBtn');
      await expect(page.locator('#casegenLegacyModulesPanel')).toHaveClass(/is-active/);
      await expect(page.locator('[data-generate="legacy-running-mod"]')).toBeDisabled();
      await expect(page.locator('[data-generate="legacy-running-mod"]')).toHaveText('生成中...');
      const runningState = await page.evaluate(() => {
        var state = window.app && window.app.state ? window.app.state : null;
        var running = state && state.caseGenRunning instanceof Set ? Array.from(state.caseGenRunning) : [];
        var legacy = state && state.caseGenLegacy && Array.isArray(state.caseGenLegacy.running)
          ? state.caseGenLegacy.running.slice()
          : [];
        var activeView = state && state.caseGenSettings ? String(state.caseGenSettings.activeTab || '') : '';
        return {
          running: running,
          legacy: legacy,
          activeView: activeView,
        };
      });
      expect(runningState.running).toContain('legacy-running-mod');
      expect(runningState.legacy).toContain('legacy-running-mod');
      expect(runningState.activeView).toBe(expectedActiveView || 'legacy-modules');
    }

    await expectLegacyRunning('legacy-modules');

    await clickElementById(page, 'xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('运行态隔离-XMind');
    await waitForNodeText(page, 'XMind镜像模块');
    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);
    await expectLegacyRunning('legacy-modules');

    await clickElementById(page, 'caseGenModulesTabBtn');
    await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
    await expect(page.locator('#caseGenXmindModulesContainer')).toContainText('XMind镜像模块');
    await page.locator('#caseGenXmindModulesContainer [data-open-xmind-workspace]').first().click();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('运行态隔离-XMind');
    await waitForNodeText(page, 'XMind镜像模块');
    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);
    await expectLegacyRunning('legacy-modules');

    await clickElementById(page, 'caseGenModulesTabBtn');
    const progressCard = page.locator('#caseGenProgressList [data-casegen-workspace]').first();
    await expect(progressCard).toContainText('运行态隔离-XMind');
    await progressCard.click();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('运行态隔离-XMind');
    await waitForNodeText(page, 'XMind镜像模块');
    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);
    await expectLegacyRunning('legacy-modules');
  });

  test('通过 XMind 页签切换或重开 workspace 时，测试用例导入状态会跟随当前 workspace 同步', async ({ page }) => {
    const token = 'token-xmind-case-import-status-sync';
    const user = { id: 312, username: 'demo_user_case_status_sync', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '导入状态-A', '需求A：已导入 1 份用例。', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await createXmindWorkspaceByManualPrep(page, '导入状态-B', '需求B：当前没有任何导入用例。', {
      completePrep: true,
    });

    const workspaceIds = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      return host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
    });
    expect(workspaceIds).toHaveLength(2);

    await page.evaluate(({ ids }) => {
      function buildCases(moduleTitle, caseTitle) {
        return JSON.stringify([{
          module: moduleTitle,
          title: caseTitle,
          priority: 'P1',
          preconditions: moduleTitle + '前置条件',
          steps: ['1、进入' + moduleTitle, '2、执行' + caseTitle],
          expected: caseTitle + '执行成功',
        }], null, 2);
      }
      var state = window.app && window.app.state ? window.app.state : null;
      var casesApi = window.app && window.app.casesCoreApi ? window.app.casesCoreApi : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      if (!state || !host || !host.workspaces) return;
      var workspaceA = host.workspaces[ids[0]];
      var workspaceB = host.workspaces[ids[1]];
      if (!workspaceA || !workspaceA.snapshot || !workspaceA.snapshot.shared) return;
      if (!workspaceB || !workspaceB.snapshot || !workspaceB.snapshot.shared) return;

      var importedText = buildCases('导入模块-A', '导入用例-A');
      workspaceA.snapshot.shared.importedCases = [{
        id: 'sync-import-a',
        name: '导入状态-A.json',
        text: importedText,
        list: [{
          module: '导入模块-A',
          title: '导入用例-A',
          priority: 'P1',
          preconditions: '导入模块-A前置条件',
          steps: ['1、进入导入模块-A', '2、执行导入用例-A'],
          expected: '导入用例-A执行成功',
        }],
        meta: {
          sourceType: 'case-library-select',
          caseFileId: 7001,
          projectId: 91,
          versionId: 9201,
          fileName: '导入状态-A.json',
        },
      }];
      workspaceA.snapshot.shared.caseText = importedText;
      workspaceB.snapshot.shared.importedCases = [];
      workspaceB.snapshot.shared.caseText = '';

      host.activeWorkspaceId = String(ids[0] || '');
      host.mirrorWorkspaceId = String(ids[0] || '');
      state.requirementLabel = String(workspaceA.snapshot.shared.requirementLabel || '');
      state.requirementLabelSource = String(workspaceA.snapshot.shared.requirementLabelSource || '');
      state.lastRawImportName = String(workspaceA.snapshot.shared.lastRawImportName || '');
      state.importedCases = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.importedCases || []));
      state.caseGenModules = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.caseGenModules || []));
      state.caseGenSource = String(workspaceA.snapshot.shared.caseGenSource || '');
      state.caseGenResults = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.caseGenResults || {}));
      state.caseSelections = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.caseSelections || {}));
      state.caseGenSuggestions = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.caseGenSuggestions || {}));
      state.caseGenModuleStatus = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.caseGenModuleStatus || {}));
      state.caseGenProgress = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.caseGenProgress || {}));
      state.caseGenTiming = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.caseGenTiming || {}));
      state.caseGenProgressNotice = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.caseGenProgressNotice || {}));
      state.caseGenSettings = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.caseGenSettings || state.caseGenSettings || {}));
      state.requirementMedia = JSON.parse(JSON.stringify(workspaceA.snapshot.shared.requirementMedia || state.requirementMedia || {}));
      var caseTextEl = document.getElementById('caseText');
      if (caseTextEl) caseTextEl.value = importedText;
      if (casesApi && typeof casesApi.renderImportedCaseList === 'function') {
        casesApi.renderImportedCaseList();
      }
      if (casesApi && typeof casesApi.syncCaseTextWithImports === 'function') {
        casesApi.syncCaseTextWithImports({ skipStatusSync: true });
      }
      var caseStatusEl = document.getElementById('caseStatus');
      if (caseStatusEl) {
        caseStatusEl.textContent = '已导入 1 份用例';
        caseStatusEl.className = 'status ok';
      }
    }, { ids: workspaceIds });

    await expect(page.locator('#caseFileList')).toContainText('导入状态-A.json');
    await expect(page.locator('#caseStatus')).toContainText('已导入 1 份');

    await page.click('#closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);
    await page.evaluate((workspaceId) => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.openWorkspace === 'function') {
        api.openWorkspace(workspaceId);
      }
    }, workspaceIds[1]);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('导入状态-B');
    await expect(page.locator('#caseFileList')).toContainText('未导入文件');
    await expect.poll(async () => {
      return page.locator('#caseStatus').evaluate((el) => {
        return el && typeof el.textContent === 'string' ? el.textContent.trim() : '';
      });
    }).toBe('');

    await page.click('#closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);
    await page.evaluate((workspaceId) => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.openWorkspace === 'function') {
        api.openWorkspace(workspaceId);
      }
    }, workspaceIds[0]);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('导入状态-A');
    await expect(page.locator('#caseFileList')).toContainText('导入状态-A.json');
    await expect(page.locator('#caseStatus')).toContainText('已导入 1 份');
  });

  test('XMind 页签重置或删除后，模块区镜像页签会同步更新标题、状态和存在性', async ({ page }) => {
    const token = 'xmind-module-mirror-sync-token';
    const user = { id: 80222, username: 'xmind-module-mirror-sync' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '同步页签-A', '这是同步页签 A 的需求描述', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await createXmindWorkspaceByManualPrep(page, '同步页签-B', '这是同步页签 B 的需求描述', {
      completePrep: true,
    });

    const workspaceIds = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      return host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
    });
    expect(workspaceIds).toHaveLength(2);

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (!api || typeof api.close !== 'function') return;
      api.close();
    });
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await page.click('#caseGenModulesTabBtn');
    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace]')).toHaveCount(2);
    await expect(page.locator('#caseGenWorkspaceMirrorTabs')).toContainText('同步页签-A');
    await expect(page.locator('#caseGenWorkspaceMirrorTabs')).toContainText('同步页签-B');

    await openXmindCaseGenDrawer(page);
    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (!api || typeof api.resetAllState !== 'function') return false;
      return api.resetAllState({
        reason: 'test-mirror-sync-reset',
        reopenPrepDialog: false,
        toastText: '',
      });
    });
    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (!api || typeof api.close !== 'function') return;
      api.close();
    });
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace]')).toHaveCount(2);
    await expect(page.locator('#caseGenWorkspaceMirrorTabs')).not.toContainText('同步页签-B');
    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace].active')).toContainText('生成2');
    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace].active')).toContainText('待准备');

    await openXmindCaseGenDrawer(page);
    await page.evaluate((workspaceId) => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (!workspaceId || !api || typeof api.closeWorkspace !== 'function') return false;
      return api.closeWorkspace(String(workspaceId || ''), { skipConfirm: true });
    }, workspaceIds[0]);
    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (!api || typeof api.close !== 'function') return;
      api.close();
    });
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace]')).toHaveCount(1);
    await expect(page.locator('#caseGenWorkspaceMirrorTabs')).not.toContainText('同步页签-A');
    await expect(page.locator('#caseGenWorkspaceMirrorTabs')).toContainText('生成2');
  });

  test('关闭抽屉后切换镜像页签只更新镜像选择，重新打开或走进度入口时不会串写其他 workspace 数据', async ({ page }) => {
    const token = 'xmind-mirror-selection-isolation-token';
    const user = { id: 80223, username: 'xmind-mirror-selection-isolation' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '镜像隔离-A', '这是镜像隔离 A 的需求描述', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await createXmindWorkspaceByManualPrep(page, '镜像隔离-B', '这是镜像隔离 B 的需求描述', {
      completePrep: true,
    });

    const workspaceIds = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      return host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
    });
    expect(workspaceIds).toHaveLength(2);

    await page.evaluate(({ ids }) => {
      var app = window.app || {};
      var state = app.state;
      if (!state || !state.xmindCaseGen || !state.xmindCaseGen.workspaces) return false;
      var host = state.xmindCaseGen;

      function clone(value, fallback) {
        try {
          return JSON.parse(JSON.stringify(value));
        } catch (_) {
          return fallback;
        }
      }

      function buildCases(moduleTitle, caseTitle) {
        return JSON.stringify([{
          module: moduleTitle,
          title: caseTitle,
          priority: 'P1',
          preconditions: moduleTitle + '前置条件',
          steps: ['1、进入' + moduleTitle, '2、执行' + caseTitle],
          expected: caseTitle + '执行成功',
        }], null, 2);
      }

      function applyWorkspace(record, workspaceTitle, moduleId, moduleTitle, caseTitle) {
        if (!record) return;
        record.name = workspaceTitle;
        record.snapshot = record.snapshot && typeof record.snapshot === 'object' ? record.snapshot : {};
        record.snapshot.shared = record.snapshot.shared && typeof record.snapshot.shared === 'object'
          ? record.snapshot.shared
          : {};
        record.snapshot.xmind = record.snapshot.xmind && typeof record.snapshot.xmind === 'object'
          ? record.snapshot.xmind
          : {};
        record.snapshot.shared.requirementLabel = workspaceTitle;
        record.snapshot.shared.requirementLabelSource = 'workspace';
        record.snapshot.shared.caseGenModules = [{
          id: moduleId,
          title: moduleTitle,
          module: moduleTitle,
          key_scenarios: [moduleTitle + '主场景'],
          test_points: [moduleTitle + '关键校验'],
          coupled_modules: [],
        }];
        record.snapshot.shared.caseGenResults = {};
        record.snapshot.shared.caseGenResults[moduleId] = buildCases(moduleTitle, caseTitle);
        record.snapshot.shared.caseSelections = {};
        record.snapshot.shared.caseGenSuggestions = {};
        record.snapshot.shared.caseGenModuleStatus = {};
        record.snapshot.shared.caseGenProgress = {};
        record.snapshot.shared.caseGenTiming = {};
        record.snapshot.shared.caseGenProgressNotice = {};
        record.snapshot.xmind.prep = record.snapshot.xmind.prep && typeof record.snapshot.xmind.prep === 'object'
          ? record.snapshot.xmind.prep
          : {};
        record.snapshot.xmind.prep.requirementMode = 'manual';
        record.snapshot.xmind.prep.manualRequirementLabel = workspaceTitle;
        record.snapshot.xmind.prep.completed = true;
      }

      function applyLiveFromRecord(record) {
        if (!record || !record.snapshot) return;
        var shared = record.snapshot.shared && typeof record.snapshot.shared === 'object'
          ? record.snapshot.shared
          : {};
        var xmind = record.snapshot.xmind && typeof record.snapshot.xmind === 'object'
          ? record.snapshot.xmind
          : {};
        state.requirementLabel = String(shared.requirementLabel || '');
        state.requirementLabelSource = String(shared.requirementLabelSource || '');
        state.lastRawImportName = String(shared.lastRawImportName || '');
        state.importedCases = clone(shared.importedCases, []);
        state.caseGenModules = clone(shared.caseGenModules, []);
        state.caseGenSource = String(shared.caseGenSource || '');
        state.caseGenResults = clone(shared.caseGenResults, {});
        state.caseSelections = clone(shared.caseSelections, {});
        state.caseGenSuggestions = clone(shared.caseGenSuggestions, {});
        state.caseGenModuleStatus = clone(shared.caseGenModuleStatus, {});
        state.caseGenProgress = clone(shared.caseGenProgress, {});
        state.caseGenTiming = clone(shared.caseGenTiming, {});
        state.caseGenProgressNotice = clone(shared.caseGenProgressNotice, {});
        state.caseGenSettings = clone(shared.caseGenSettings, state.caseGenSettings || {});
        state.requirementMedia = clone(shared.requirementMedia, state.requirementMedia || {});
        Object.keys(xmind).forEach(function(key) {
          if (key === 'activeWorkspaceId' || key === 'mirrorWorkspaceId' || key === 'workspaceOrder' || key === 'workspaces' || key === 'nextWorkspaceSeq' || key === 'openButtonDotVisible') {
            return;
          }
          state.xmindCaseGen[key] = clone(xmind[key], xmind[key]);
        });
      }

      applyWorkspace(host.workspaces[ids[0]], '镜像隔离-A', 'mirror-guard-mod-a', '镜像模块-A', '镜像用例-A');
      applyWorkspace(host.workspaces[ids[1]], '镜像隔离-B', 'mirror-guard-mod-b', '镜像模块-B', '镜像用例-B');
      host.activeWorkspaceId = String(ids[0] || '');
      host.mirrorWorkspaceId = String(ids[0] || '');
      applyLiveFromRecord(host.workspaces[ids[0]]);
      if (app.persistWorkflowStateNow && typeof app.persistWorkflowStateNow === 'function') {
        app.persistWorkflowStateNow();
      }
      return true;
    }, { ids: workspaceIds });

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    await clickElementById(page, 'caseGenModulesTabBtn');
    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace].active')).toContainText('镜像隔离-A');

    await page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace]').nth(1).click();
    await expect(page.locator('#caseGenWorkspaceMirrorTabs [data-casegen-module-workspace].active')).toContainText('镜像隔离-B');
    await expect(page.locator('#caseGenXmindModulesContainer')).toContainText('镜像模块-B');
    await expect(page.locator('#caseGenXmindModulesContainer')).not.toContainText('镜像模块-A');

    const selectionState = await page.evaluate(() => {
      var host = window.app && window.app.state ? window.app.state.xmindCaseGen : null;
      return host ? {
        activeWorkspaceId: String(host.activeWorkspaceId || ''),
        mirrorWorkspaceId: String(host.mirrorWorkspaceId || ''),
      } : null;
    });
    expect(selectionState.activeWorkspaceId).toBe(workspaceIds[0]);
    expect(selectionState.mirrorWorkspaceId).toBe(workspaceIds[1]);

    await page.evaluate(() => {
      if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
        window.app.persistWorkflowStateNow();
      }
    });

    const snapshotSummary = await page.evaluate(({ ids }) => {
      var host = window.app && window.app.state ? window.app.state.xmindCaseGen : null;
      if (!host || !host.workspaces) return null;

      function parseTitles(rawValue) {
        try {
          var list = JSON.parse(String(rawValue || '[]'));
          return Array.isArray(list) ? list.map(function(item) { return String(item && item.title ? item.title : ''); }).filter(Boolean) : [];
        } catch (_) {
          return [];
        }
      }

      function pick(id) {
        var record = host.workspaces[id];
        var shared = record && record.snapshot && record.snapshot.shared ? record.snapshot.shared : {};
        return {
          title: String(record && record.name ? record.name : ''),
          modules: Array.isArray(shared.caseGenModules)
            ? shared.caseGenModules.map(function(item) { return String(item && (item.title || item.module || '') || ''); }).filter(Boolean)
            : [],
          cases: Object.keys(shared.caseGenResults || {}).reduce(function(result, moduleId) {
            return result.concat(parseTitles(shared.caseGenResults[moduleId]));
          }, []),
        };
      }

      return {
        first: pick(ids[0]),
        second: pick(ids[1]),
      };
    }, { ids: workspaceIds });
    expect(snapshotSummary.first).toEqual({
      title: '镜像隔离-A',
      modules: ['镜像模块-A'],
      cases: ['镜像用例-A'],
    });
    expect(snapshotSummary.second).toEqual({
      title: '镜像隔离-B',
      modules: ['镜像模块-B'],
      cases: ['镜像用例-B'],
    });

    await page.click('#xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('镜像隔离-B');
    await waitForNodeText(page, '镜像模块-B');
    await waitForNodeText(page, '镜像用例-B');
    await waitForNodeTextAbsent(page, '镜像模块-A');

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    const progressCards = page.locator('#caseGenProgressList [data-casegen-workspace]');
    await expect(progressCards).toHaveCount(2);
    await progressCards.first().click();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('镜像隔离-A');
    await waitForNodeText(page, '镜像模块-A');
    await waitForNodeText(page, '镜像用例-A');
    await waitForNodeTextAbsent(page, '镜像模块-B');

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    await progressCards.nth(1).click();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('镜像隔离-B');
    await waitForNodeText(page, '镜像模块-B');
    await waitForNodeText(page, '镜像用例-B');
    await waitForNodeTextAbsent(page, '镜像模块-A');
  });

  test('新建页签后若直接关闭前置准备，仍保留新页签的空白初始态，不会继承上一个页签名称', async ({ page }) => {
    const token = 'xmind-tabs-blank-create-token';
    const user = { id: 8023, username: 'tabs-blank-create' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '上一个页签', '这是上一个页签的需求描述', {
      useExistingWorkspace: true,
    });
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').first()).toContainText('上一个页签');

    await page.click('#xmindCaseGenWorkspaceAddBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenSummaryCloseBtn');

    const newWorkspaceState = await page.evaluate(() => {
      var host = window.app && window.app.state ? window.app.state.xmindCaseGen : null;
      var activeId = host ? String(host.activeWorkspaceId || '') : '';
      var activeTab = document.querySelector('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active');
      var activeRecord = activeId && host && host.workspaces ? host.workspaces[activeId] : null;
      var snapshot = activeRecord && activeRecord.snapshot ? activeRecord.snapshot : null;
      var prep = snapshot && snapshot.xmind && snapshot.xmind.prep ? snapshot.xmind.prep : null;
      var shared = snapshot && snapshot.shared ? snapshot.shared : null;
      return {
        activeWorkspaceId: activeId,
        activeTabText: activeTab ? String(activeTab.textContent || '').replace(/\s+/g, ' ').trim() : '',
        workspaceOrder: host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [],
        recordName: activeRecord ? String(activeRecord.name || '') : '',
        manualRequirementLabel: prep ? String(prep.manualRequirementLabel || '') : '',
        requirementMode: prep ? String(prep.requirementMode || '') : '',
        requirementLabel: shared ? String(shared.requirementLabel || '') : '',
      };
    });

    expect(newWorkspaceState.workspaceOrder.length).toBe(2);
    expect(String(newWorkspaceState.activeWorkspaceId || '')).toBe(String(newWorkspaceState.workspaceOrder[1] || ''));
    expect(newWorkspaceState.activeTabText).toContain('生成2');
    expect(newWorkspaceState.activeTabText).not.toContain('上一个页签');
    expect(newWorkspaceState.recordName).toBe('生成2');
    expect(newWorkspaceState.manualRequirementLabel).toBe('');
    expect(newWorkspaceState.requirementMode).toBe('');
    expect(newWorkspaceState.requirementLabel).toBe('');
  });

  test('不同 XMind 生成页签可独立并发生成，并各自完成回写而不遗留假运行状态', async ({ page }) => {
    const token = 'xmind-tabs-concurrent-isolation-token';
    const user = { id: 8022, username: 'tabs-concurrent-isolation' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 900);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '并发页签A', '并发页签A的需求描述', {
      completePrep: true,
      useExistingWorkspace: true,
    });
    await createXmindWorkspaceByManualPrep(page, '并发页签B', '并发页签B的需求描述', {
      completePrep: true,
    });

    const tabA = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '并发页签A',
    }).first();
    const tabB = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '并发页签B',
    }).first();

    await tabA.click();
    await waitForNodeText(page, '并发页签A');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeStatus(page, '并发页签A', '生成中');

    await tabB.click();
    await waitForNodeText(page, '并发页签B');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeStatus(page, '并发页签B', '生成中');

    const concurrentRunning = await page.evaluate(() => {
      try {
        var raw = localStorage.getItem('tap-xmind-casegen-tasks');
        var list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) return [];
        return list.filter(function(item) {
          return item && item.status === 'running';
        }).map(function(item) {
          return String(item.workspaceId || '');
        }).filter(Boolean);
      } catch (err) {
        return [];
      }
    });
    expect(new Set(concurrentRunning).size).toBe(2);

    await page.waitForFunction(() => {
      try {
        var raw = localStorage.getItem('tap-xmind-casegen-tasks');
        var list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) && list.every(function(item) {
          return !item || item.status !== 'running';
        });
      } catch (err) {
        return true;
      }
    }, {}, { timeout: 15000 });

    await waitForNodeStatusAbsent(page, '并发页签B');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await expect(page.locator('#xmindCaseGenInterruptBtn')).toBeDisabled();
    const workspaceBState = await page.evaluate(() => {
      var st = window.app && window.app.state ? window.app.state : null;
      var host = st && st.xmindCaseGen ? st.xmindCaseGen : null;
      var activeId = host ? String(host.activeWorkspaceId || '') : '';
      var record = activeId && host && host.workspaces ? host.workspaces[activeId] : null;
      var snapshot = record && record.snapshot ? record.snapshot : null;
      var xmind = snapshot && snapshot.xmind ? snapshot.xmind : null;
      var shared = snapshot && snapshot.shared ? snapshot.shared : null;
      return {
        rootRunning: Boolean(xmind && xmind.root && xmind.root.running === true),
        rootTaskId: xmind && xmind.root ? String(xmind.root.taskId || '') : '',
        moduleCount: shared && Array.isArray(shared.caseGenModules) ? shared.caseGenModules.length : 0,
      };
    });
    expect(workspaceBState.rootRunning).toBe(false);
    expect(workspaceBState.rootTaskId).toBe('');
    expect(workspaceBState.moduleCount).toBe(2);

    await tabA.click();
    await waitForNodeText(page, '并发页签A');
    await waitForNodeStatusAbsent(page, '并发页签A');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await expect(page.locator('#xmindCaseGenInterruptBtn')).toBeDisabled();
    const workspaceAState = await page.evaluate(() => {
      var st = window.app && window.app.state ? window.app.state : null;
      var host = st && st.xmindCaseGen ? st.xmindCaseGen : null;
      var activeId = host ? String(host.activeWorkspaceId || '') : '';
      var record = activeId && host && host.workspaces ? host.workspaces[activeId] : null;
      var snapshot = record && record.snapshot ? record.snapshot : null;
      var xmind = snapshot && snapshot.xmind ? snapshot.xmind : null;
      var shared = snapshot && snapshot.shared ? snapshot.shared : null;
      return {
        rootRunning: Boolean(xmind && xmind.root && xmind.root.running === true),
        rootTaskId: xmind && xmind.root ? String(xmind.root.taskId || '') : '',
        moduleCount: shared && Array.isArray(shared.caseGenModules) ? shared.caseGenModules.length : 0,
      };
    });
    expect(workspaceAState.rootRunning).toBe(false);
    expect(workspaceAState.rootTaskId).toBe('');
    expect(workspaceAState.moduleCount).toBe(2);
  });

  test('XMind 任务缓存写入失败时，双页签并发生成仍会继续完成', async ({ page }) => {
    await page.addInitScript(() => {
      var originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (String(key || '') === 'tap-xmind-casegen-tasks') {
          var err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        }
        return originalSetItem.apply(this, arguments);
      };
    });

    const token = 'xmind-task-storage-fallback-token';
    const user = { id: 8023, username: 'xmind-task-storage-fallback' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '缓存失败-A', '需求A：任务缓存写入失败时，当前页仍要继续生成。', {
      completePrep: true,
      useExistingWorkspace: true,
    });
    await createXmindWorkspaceByManualPrep(page, '缓存失败-B', '需求B：另一个页签不能因为缓存写入失败被打回已准备。', {
      completePrep: true,
    });

    const tabA = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '缓存失败-A',
    }).first();
    const tabB = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '缓存失败-B',
    }).first();

    await tabA.click();
    await waitForNodeText(page, '缓存失败-A');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeStatus(page, '缓存失败-A', '生成中');

    await tabB.click();
    await waitForNodeText(page, '缓存失败-B');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeStatus(page, '缓存失败-B', '生成中');

    await page.waitForFunction(() => {
      var app = window.app || {};
      var api = app.xmindCasegenApi;
      var recovery = app.__xmindCasegenTaskStorageRecovered;
      if (!api || typeof api.getWorkspaceProgressItems !== 'function' || !recovery) return false;
      var items = api.getWorkspaceProgressItems();
      var summary = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item || !item.title) return;
        summary[String(item.title || '')] = {
          moduleCount: Number(item.moduleCount || 0),
          caseCount: Number(item.caseCount || 0),
          statusText: String(item.statusText || ''),
        };
      });
      return String(recovery.reason || '') === 'write-failed-volatile'
        && summary['缓存失败-A']
        && summary['缓存失败-B']
        && summary['缓存失败-A'].moduleCount === 2
        && summary['缓存失败-A'].caseCount === 4
        && summary['缓存失败-A'].statusText === '未入库'
        && summary['缓存失败-B'].moduleCount === 2
        && summary['缓存失败-B'].caseCount === 4
        && summary['缓存失败-B'].statusText === '未入库';
    }, {}, { timeout: 20000 });

    const progressCards = page.locator('#caseGenProgressList [data-casegen-workspace]');
    await expect(progressCards).toHaveCount(2);
    await expect(progressCards.first()).toContainText('缓存失败-A');
    await expect(progressCards.first()).toContainText('2 模块');
    await expect(progressCards.first()).toContainText('4 用例');
    await expect(progressCards.nth(1)).toContainText('缓存失败-B');
    await expect(progressCards.nth(1)).toContainText('2 模块');
    await expect(progressCards.nth(1)).toContainText('4 用例');

    const recoveryInfo = await page.evaluate(() => {
      return window.app && window.app.__xmindCasegenTaskStorageRecovered
        ? {
            reason: String(window.app.__xmindCasegenTaskStorageRecovered.reason || ''),
          }
        : null;
    });
    expect(recoveryInfo).toEqual({ reason: 'write-failed-volatile' });
  });

  test('全屏或复原后手动切换 XMind 页签，不会让画布连续左右抖动', async ({ page }) => {
    const token = 'xmind-tabs-switch-after-fullscreen-stable-token';
    const user = { id: 8024, username: 'tabs-fullscreen-stable' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 900);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '切页稳定-A', '需求A：用于验证全屏切页稳定性。', {
      completePrep: true,
      useExistingWorkspace: true,
    });
    await createXmindWorkspaceByManualPrep(page, '切页稳定-B', '需求B：用于验证全屏切页稳定性。', {
      completePrep: true,
    });

    const tabA = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '切页稳定-A',
    }).first();
    const tabB = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '切页稳定-B',
    }).first();

    await tabA.click();
    await waitForNodeText(page, '切页稳定-A');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeStatusAbsent(page, '切页稳定-A');
    await waitForNodeText(page, '登录模块');
    await panXmindCasegenCanvas(page, 220, 120);
    await page.click('#xmindCaseGenMindContainer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    await page.click('#xmindCaseGenMindContainer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/xmind-drawer-fullscreen/);

    await tabB.click();
    await waitForNodeText(page, '切页稳定-B');
    await tabA.click();
    await waitForNodeText(page, '切页稳定-A');
    await waitForNodeText(page, '登录模块');

    const rootCenterBefore = await readXmindRootCenter(page);
    expect(rootCenterBefore).not.toBeNull();
    await page.waitForTimeout(900);
    const rootCenterAfter = await readXmindRootCenter(page);
    expect(rootCenterAfter).not.toBeNull();
    expect(Math.abs(rootCenterAfter.x - rootCenterBefore.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(rootCenterAfter.y - rootCenterBefore.y)).toBeLessThanOrEqual(6);
  });

  test('一个页签生成中时，另一个已完成页签入库关闭后切回前者，不会让画布抖动', async ({ page }) => {
    const token = 'xmind-tabs-store-close-running-stable-token';
    const user = { id: 8025, username: 'tabs-store-close-running-stable' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      projects: [{ id: 1, name: '项目A' }],
      versionsByProject: {
        '1': [{ id: 11, name: 'v1.0.0' }],
      },
    });
    const responseText = JSON.stringify({
      modules: [{
        module: '登录模块',
        key_scenarios: ['登录主场景'],
        test_points: ['账号密码校验'],
        coupled_modules: ['用户中心'],
        cases: [{
          module: '登录模块',
          title: '登录成功校验',
          priority: 'P1',
          preconditions: '账号已存在',
          steps: ['1、进入登录页', '2、输入账号密码并提交'],
          expected: '登录成功',
        }],
      }, {
        module: '支付模块',
        key_scenarios: ['支付主场景'],
        test_points: ['支付结果校验'],
        coupled_modules: ['订单中心'],
        cases: [{
          module: '支付模块',
          title: '支付成功校验',
          priority: 'P1',
          preconditions: '订单待支付',
          steps: ['1、进入支付页', '2、完成支付'],
          expected: '支付成功',
        }],
      }],
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRoute(page, {
      delaysMs: [3200, 120],
      responseTexts: [responseText, responseText],
    });
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '生成中切回页签-A', '需求A：用于验证入库关闭后切回生成中页签不抖动。', {
      completePrep: true,
      useExistingWorkspace: true,
    });
    await createXmindWorkspaceByManualPrep(page, '已完成入库页签-B', '需求B：用于验证入库关闭后切回生成中页签不抖动。', {
      completePrep: true,
    });

    const tabA = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '生成中切回页签-A',
    }).first();
    const tabB = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '已完成入库页签-B',
    }).first();

    await tabA.click();
    await waitForNodeText(page, '生成中切回页签-A');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await page.waitForFunction(() => {
      var root = window.app && window.app.state && window.app.state.xmindCaseGen
        ? window.app.state.xmindCaseGen.root
        : null;
      return Boolean(root && root.running === true);
    }, {}, { timeout: 15000 });
    const panResultBeforeStore = await panXmindCasegenCanvas(page, 240, 130);
    expect(panResultBeforeStore.dispatched).toBeTruthy();
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      return Boolean(map && map.style && String(map.style.transform || '') !== String(beforeTransform || ''));
    }, panResultBeforeStore.before || '', { timeout: 10000 });
    await waitForPaintFrames(page, 2);
    const rootCenterBeforeStore = await readXmindRootCenter(page);
    expect(rootCenterBeforeStore).not.toBeNull();
    const rootOffsetBeforeStore = await readXmindRootOffsetFromViewer(page);
    expect(rootOffsetBeforeStore).not.toBeNull();

    await tabB.click();
    await waitForNodeText(page, '已完成入库页签-B');
    const workspaceASnapshotView = await page.evaluate(() => {
      var host = window.app && window.app.state ? window.app.state.xmindCaseGen : null;
      if (!host || !host.workspaces) return null;
      var targetId = '';
      Object.keys(host.workspaces).forEach(function(id) {
        var record = host.workspaces[id];
        if (!record || targetId) return;
        if (String(record.name || '').trim() === '生成中切回页签-A') {
          targetId = id;
        }
      });
      var record = targetId ? host.workspaces[targetId] : null;
      var snapshot = record && record.snapshot ? record.snapshot : null;
      var xmind = snapshot && snapshot.xmind ? snapshot.xmind : null;
      var view = xmind && xmind.viewState ? xmind.viewState : null;
      return {
        transform: view ? String(view.transform || '') : '',
        drawerOpen: Boolean(view && view.drawerOpen === true),
        viewTreeSignature: view ? String(view.treeSourceSignature || '') : '',
        treeSignature: xmind ? String(xmind.treeSourceSignature || '') : '',
      };
    });
    expect(workspaceASnapshotView).not.toBeNull();
    expect(String(workspaceASnapshotView.transform || '')).toContain('translate3d(');
    await seedAiSkeleton(page, [{
      id: 'xmind-store-stable-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-store-stable-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedAiCases(page, {
      'xmind-store-stable-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
      'xmind-store-stable-pay': [{
        module: '支付模块',
        title: '支付成功校验',
        priority: 'P1',
        preconditions: '订单待支付',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    });
    await page.evaluate(() => {
      if (window.app && window.app.xmindCasegenApi && typeof window.app.xmindCasegenApi.render === 'function') {
        window.app.xmindCasegenApi.render({ reason: 'ui-test-store-close-seed', persist: false });
      }
    });
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await clickElementById(page, 'xmindCaseGenStoreBtn');
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await page.fill('#caseGenDbStoreEntryNameInput', '已完成入库页签-B-确认名');
    await page.selectOption('#caseGenDbStoreProjectSelect', '1');
    await page.selectOption('#caseGenDbStoreVersionSelect', '11');
    const importRequestPromise = page.waitForRequest((request) => {
      return request.url().indexOf('/api/case-files/import') !== -1 && request.method() === 'POST';
    });
    await page.click('#caseGenDbStoreConfirmBtn');
    await importRequestPromise;

    await expect(page.locator('.temp-center-toast').last()).toContainText('入库并关闭页签成功');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('生成中切回页签-A');
    await waitForNodeText(page, '生成中切回页签-A');
    await waitForPaintFrames(page, 2);
    await page.waitForFunction(({ beforeDx, beforeDy }) => {
      var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
        || document.getElementById('xmindCaseGenMindContainer');
      var rootText = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
      if (!viewer || !viewer.getBoundingClientRect || !rootText || !rootText.getBoundingClientRect) return false;
      var viewerRect = viewer.getBoundingClientRect();
      var rect = rootText.getBoundingClientRect();
      var dx = Number((rect.left + (rect.width / 2)) - (viewerRect.left + (viewerRect.width / 2)));
      var dy = Number((rect.top + (rect.height / 2)) - (viewerRect.top + (viewerRect.height / 2)));
      return Math.abs(dx - Number(beforeDx || 0)) <= 8 && Math.abs(dy - Number(beforeDy || 0)) <= 8;
    }, {
      beforeDx: rootOffsetBeforeStore.dx,
      beforeDy: rootOffsetBeforeStore.dy,
    }, { timeout: 10000 });

    const rootCenterAfterStore = await readXmindRootCenter(page);
    expect(rootCenterAfterStore).not.toBeNull();
    const rootOffsetAfterStore = await readXmindRootOffsetFromViewer(page);
    expect(rootOffsetAfterStore).not.toBeNull();
    expect(Math.abs(rootOffsetAfterStore.dx - rootOffsetBeforeStore.dx)).toBeLessThanOrEqual(8);
    expect(Math.abs(rootOffsetAfterStore.dy - rootOffsetBeforeStore.dy)).toBeLessThanOrEqual(8);

    await page.waitForTimeout(900);
    await page.waitForFunction(() => {
      var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
        || document.getElementById('xmindCaseGenMindContainer');
      var rootText = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
      return Boolean(viewer && rootText && rootText.getBoundingClientRect && viewer.getBoundingClientRect);
    }, {}, { timeout: 5000 });
    const rootCenterStable = await readXmindRootCenter(page);
    expect(rootCenterStable).not.toBeNull();
    const rootOffsetStable = await readXmindRootOffsetFromViewer(page);
    expect(rootOffsetStable).not.toBeNull();
    expect(Math.abs(rootOffsetStable.dx - rootOffsetAfterStore.dx)).toBeLessThanOrEqual(6);
    expect(Math.abs(rootOffsetStable.dy - rootOffsetAfterStore.dy)).toBeLessThanOrEqual(6);
  });

  test('XMind 生成页签创建后刷新页面，仍会保留页签列表与当前活动页签', async ({ page }) => {
    const token = 'xmind-tabs-refresh-persist-token';
    const user = { id: 8021, username: 'tabs-refresh-persist' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '刷新保留-A', '这是刷新保留 A 的需求描述', {
      useExistingWorkspace: true,
    });
    await createXmindWorkspaceByManualPrep(page, '刷新保留-B', '这是刷新保留 B 的需求描述', {});
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(2);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('刷新保留-B');

    const refreshUrl = page.url();
    await page.goto(refreshUrl, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);

    let drawerOpen = await page.evaluate(() => {
      var drawer = document.getElementById('xmindCaseGenDrawer');
      return Boolean(drawer && drawer.classList && drawer.classList.contains('open'));
    });
    if (!drawerOpen) {
      await page.click('#caseGenModulesTabBtn');
      await page.click('#xmindCaseGenOpenBtn');
    }

    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(2);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').nth(0)).toContainText('刷新保留-A');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').nth(1)).toContainText('刷新保留-B');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('刷新保留-B');

    const hostState = await page.evaluate(() => {
      var st = window.app && window.app.state ? window.app.state : null;
      var host = st && st.xmindCaseGen ? st.xmindCaseGen : null;
      return host ? {
        activeWorkspaceId: String(host.activeWorkspaceId || ''),
        workspaceOrder: Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [],
      } : null;
    });
    expect(hostState).toBeTruthy();
    expect(Array.isArray(hostState.workspaceOrder) ? hostState.workspaceOrder.length : 0).toBe(2);
    expect(String(hostState.activeWorkspaceId || '')).toBe(String(hostState.workspaceOrder[1] || ''));
  });

  test('触发一次超大工作流缓存自动清理后，重新完成前置准备再刷新页面不会卡死', async ({ page }) => {
    const token = 'xmind-oversize-recovery-refresh-token';
    const user = { id: 8123, username: 'xmind-oversize-recovery' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await page.addInitScript(() => {
      try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('__pw-xmind-oversize-once') === '1') {
          return;
        }
        localStorage.setItem('usecase-workflow-state-v1', 'x'.repeat(1600001));
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('__pw-xmind-oversize-once', '1');
        }
      } catch (_) {}
    });

    await gotoCasesgenWorkflow(page, {
      resetWorkflowStorage: false,
    });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '超限恢复后刷新需求', '需求：先发生一次超限缓存自动清理，再完成前置准备后刷新，页面也不能无响应。', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('超限恢复后刷新需求');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 25000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('超限恢复后刷新需求');
    await waitForNodeText(page, '超限恢复后刷新需求');

    const restoreState = await page.evaluate(() => {
      var app = window.app || {};
      var state = app.state || {};
      var host = state.xmindCaseGen || {};
      var activeId = String(host.activeWorkspaceId || '');
      var record = activeId && host.workspaces ? host.workspaces[activeId] : null;
      var prep = record && record.snapshot && record.snapshot.xmind ? record.snapshot.xmind.prep : null;
      var debug = app.__xmindCasegenDebug || null;
      return {
        activeWorkspaceId: activeId,
        workspaceCount: host.workspaces && typeof host.workspaces === 'object'
          ? Object.keys(host.workspaces).length
          : 0,
        prepCompleted: Boolean(prep && prep.completed === true),
        prepLabel: prep ? String(prep.manualRequirementLabel || '') : '',
        debugPhase: debug ? String(debug.phase || '') : '',
      };
    });
    expect(restoreState.workspaceCount).toBeGreaterThan(0);
    expect(restoreState.activeWorkspaceId).not.toBe('');
    expect(restoreState.prepCompleted).toBe(true);
    expect(restoreState.prepLabel).toBe('超限恢复后刷新需求');
    expect(/error/i.test(String(restoreState.debugPhase || ''))).toBe(false);
  });

  test('触发一次超大工作流缓存自动清理后，重新导入需求并完成前置准备再刷新页面不会卡死', async ({ page }) => {
    const token = 'xmind-oversize-recovery-doc-refresh-token';
    const user = { id: 8124, username: 'xmind-oversize-recovery-doc' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await page.addInitScript(() => {
      try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('__pw-xmind-oversize-doc-once') === '1') {
          return;
        }
        localStorage.setItem('usecase-workflow-state-v1', 'x'.repeat(1600001));
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('__pw-xmind-oversize-doc-once', '1');
        }
      } catch (_) {}
    });

    await gotoCasesgenWorkflow(page, {
      resetWorkflowStorage: false,
    });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);
    await seedDocumentRequirement(page, {
      text: '需求：先触发一次超限缓存清理，再重新导入需求文档并完成前置准备，刷新后页面仍然可恢复。',
      requirementLabel: '超限恢复后文档需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: '超限恢复后文档需求',
      requirementLabel: '超限恢复后文档需求',
      requirementLabelSource: 'ui-test',
      lastRawImportName: 'oversize-recovered.docx',
      rawText: '需求：先触发一次超限缓存清理，再重新导入需求文档并完成前置准备，刷新后页面仍然可恢复。',
      prep: {
        step: 3,
        requirementMode: 'document',
        caseImportMode: 'skip',
        completed: true,
        baseLocked: true,
      },
    });
    await waitForNodeText(page, '超限恢复后文档需求');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 25000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await waitForNodeText(page, '超限恢复后文档需求');

    const restoreState = await page.evaluate(() => {
      var app = window.app || {};
      var state = app.state || {};
      var host = state.xmindCaseGen || {};
      var activeId = String(host.activeWorkspaceId || '');
      var record = activeId && host.workspaces ? host.workspaces[activeId] : null;
      var prep = record && record.snapshot && record.snapshot.xmind ? record.snapshot.xmind.prep : null;
      var shared = record && record.snapshot && record.snapshot.shared ? record.snapshot.shared : null;
      return {
        activeWorkspaceId: activeId,
        requirementLabel: shared ? String(shared.requirementLabel || '') : '',
        lastRawImportName: shared ? String(shared.lastRawImportName || '') : '',
        prepCompleted: Boolean(prep && prep.completed === true),
        requirementMode: prep ? String(prep.requirementMode || '') : '',
      };
    });
    expect(restoreState.activeWorkspaceId).not.toBe('');
    expect(restoreState.requirementLabel).toBe('超限恢复后文档需求');
    expect(restoreState.lastRawImportName).toBe('oversize-recovered.docx');
    expect(restoreState.prepCompleted).toBe(true);
    expect(restoreState.requirementMode).toBe('document');
  });

  test('超大工作流缓存被清理时，旧的 XMind 任务缓存不会复活已删除的旧页签', async ({ page }) => {
    const token = 'xmind-oversize-stale-task-token';
    const user = { id: 8125, username: 'xmind-oversize-stale-task' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});
    const staleTask = {
      id: 'xmind-casegen-stale-task',
      status: 'done',
      scope: 'root',
      actionId: 'full_modules',
      historyActionLabel: '生成全量模块',
      workspaceId: 'xmind-workspace-stale',
      resultRaw: '{"modules":[]}',
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 5000,
      endedAt: Date.now() - 1000,
      restoreContext: {
        workspaceId: 'xmind-workspace-stale',
        requirementLabel: '旧任务恢复需求',
        requirementLabelSource: 'manual',
        lastRawImportName: '',
        rawText: '旧任务遗留需求正文',
        caseText: '',
        importedCases: [],
        caseGenModules: [],
        caseGenResults: {},
        operationSnapshots: [],
        nextSnapshotId: 1,
        history: [],
        rootPipeline: null,
        prep: {
          step: 3,
          requirementMode: 'manual',
          requirementSupplement: '',
          manualRequirementLabel: '旧任务恢复需求',
          manualRequirementBlocks: [{
            type: 'text',
            text: '旧任务遗留需求正文',
          }],
          caseImportMode: 'skip',
          completed: true,
          baseLocked: true,
        },
        viewState: {
          drawerOpen: true,
          fullscreen: false,
          transform: '',
          scaleVal: 1,
          scrollLeft: 0,
          scrollTop: 0,
          collapsedNodeKeys: [],
          treeSourceSignature: '',
          updatedAt: Date.now() - 2000,
        },
      },
    };

    await page.addInitScript((payload) => {
      try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('__pw-xmind-oversize-stale-task-once') === '1') {
          return;
        }
        localStorage.setItem('usecase-workflow-state-v1', 'x'.repeat(1600001));
        localStorage.setItem('tap-xmind-casegen-tasks', JSON.stringify([payload.task]));
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('__pw-xmind-oversize-stale-task-once', '1');
        }
      } catch (_) {}
    }, {
      task: staleTask,
    });

    await gotoCasesgenWorkflow(page, {
      resetWorkflowStorage: false,
    });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await page.waitForTimeout(800);

    const recoveredState = await page.evaluate(() => {
      var app = window.app || {};
      var state = app.state || {};
      var host = state.xmindCaseGen || {};
      var order = Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
      var activeId = String(host.activeWorkspaceId || '');
      var labels = order.map(function(id) {
        var record = host.workspaces && host.workspaces[id] ? host.workspaces[id] : null;
        return record ? String(record.name || '') : '';
      });
      return {
        workspaceOrder: order,
        activeWorkspaceId: activeId,
        labels: labels,
      };
    });

    expect(recoveredState.workspaceOrder).toEqual([]);
    expect(recoveredState.activeWorkspaceId).toBe('');
    expect(recoveredState.labels).toEqual([]);

    await openXmindCaseGenDrawer(page);
    await createXmindWorkspaceByManualPrep(page, '清理后新建页签', '需求：旧任务缓存被清掉后，重新完成前置准备并刷新，不应再被旧页签污染。', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await waitForNodeText(page, '清理后新建页签');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 25000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('清理后新建页签');
    await waitForNodeText(page, '清理后新建页签');
    await expect(page.locator('#xmindCaseGenWorkspaceList')).not.toContainText('旧任务恢复需求');
  });

  test('两个已生成的 XMind 页签在刷新后切换查看时，都会保留各自根节点与用例结果', async ({ page }) => {
    const token = 'xmind-tabs-refresh-keep-generated-results-token';
    const user = { id: 8022, username: 'tabs-refresh-keep-generated-results' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelRouteStub(page, 80);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '刷新结果保留-A', '需求A：刷新后要保留该页签的完整生成结果。', {
      completePrep: true,
      useExistingWorkspace: true,
    });
    await waitForNodeText(page, '刷新结果保留-A');
    await openNodeContextMenu(page, '刷新结果保留-A');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付成功校验');

    await createXmindWorkspaceByManualPrep(page, '刷新结果保留-B', '需求B：刷新后切回时也要保留完整生成结果。', {
      completePrep: true,
    });
    await waitForNodeText(page, '刷新结果保留-B');
    await openNodeContextMenu(page, '刷新结果保留-B');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付成功校验');

    const tabA = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '刷新结果保留-A',
    }).first();
    const tabB = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '刷新结果保留-B',
    }).first();

    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('刷新结果保留-B');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(2);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('刷新结果保留-B');

    await waitForNodeText(page, '刷新结果保留-B');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付成功校验');

    await tabA.click();
    await waitForNodeText(page, '刷新结果保留-A');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付成功校验');

    await tabB.click();
    await waitForNodeText(page, '刷新结果保留-B');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付成功校验');
    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);
    await page.waitForTimeout(900);
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);
  });

  test('XMind 页签栏中，新建生成按钮应紧跟在已有页签后方，不应额外右偏', async ({ page }) => {
    const token = 'xmind-tabs-layout-token';
    const user = { id: 803, username: 'tabs-layout' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '页签一', '页签一 的描述', {
      useExistingWorkspace: true,
    });
    await createXmindWorkspaceByManualPrep(page, '页签二', '页签二 的描述');

    const tabs = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]');
    const addButton = page.locator('#xmindCaseGenWorkspaceAddBtn');
    const addBox = await addButton.boundingBox();
    expect(addBox).toBeTruthy();
    const visibleTabs = await tabs.evaluateAll((nodes) => nodes.map((node) => {
      var rect = node.getBoundingClientRect();
      return {
        text: (node.textContent || '').trim(),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }).filter((item) => item.width > 5 && item.height > 5));

    await expect(addButton).toBeDisabled();
    await expect(addButton).toHaveAttribute('title', '最多仅支持 2 个生成页签');

    expect(visibleTabs.length).toBeGreaterThanOrEqual(2);
    const prevTab = visibleTabs[visibleTabs.length - 2];
    const lastTab = visibleTabs[visibleTabs.length - 1];
    const gapTabs = Math.round(lastTab.x - (prevTab.x + prevTab.width));
    const gapAdd = Math.round(addBox.x - (lastTab.x + lastTab.width));

    expect(Math.abs(gapAdd - gapTabs)).toBeLessThanOrEqual(10);
    expect(Math.abs(Math.round(addBox.width) - Math.round(lastTab.width))).toBeLessThanOrEqual(16);
  });

  test('XMind 页签关闭按钮在 hover 时不应发生位置位移', async ({ page }) => {
    const token = 'xmind-tab-close-stable-token';
    const user = { id: 804, username: 'tabs-close-stable' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await page.click('#xmindCaseGenWorkspaceAddBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('label:has(input[name="xmindRequirementMode"][value="manual"])');
    await page.fill('#xmindCaseGenManualRequirementLabel', '关闭按钮稳定');
    await page.fill('#xmindCaseGenManualRequirementText', '关闭按钮 hover 不应推动位置');
    await page.click('#xmindCaseGenSummaryCloseBtn');

    const closeButton = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-close]').first();
    const before = await closeButton.boundingBox();
    expect(before).toBeTruthy();
    await closeButton.hover();
    const after = await closeButton.boundingBox();
    expect(after).toBeTruthy();

    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  });

  test('已完成前置准备但尚未生成的页签，关闭前仍会弹出二次确认', async ({ page }) => {
    const token = 'xmind-tab-close-confirm-prep-token';
    const user = { id: 805, username: 'tabs-close-confirm-prep' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);
    await createXmindWorkspaceByManualPrep(page, '仅完成准备页签', '完成前置准备但还未开始生成', {
      completePrep: true,
      useExistingWorkspace: true,
    });

    await page.evaluate(() => {
      window.__xmindCloseConfirmCalls = [];
      window.__xmindNativeConfirmCalls = [];
      window.confirm = function(message) {
        window.__xmindNativeConfirmCalls.push({
          message: String(message || ''),
        });
        return false;
      };
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindCloseConfirmCalls.push(payload || null);
          return Promise.resolve({ ok: false });
        };
      }
    });

    await clickXmindWorkspaceClose(page);
    await expect.poll(async () => {
      return await page.evaluate(() => {
        var drawerCount = Array.isArray(window.__xmindCloseConfirmCalls) ? window.__xmindCloseConfirmCalls.length : 0;
        var nativeCount = Array.isArray(window.__xmindNativeConfirmCalls) ? window.__xmindNativeConfirmCalls.length : 0;
        return drawerCount + nativeCount;
      });
    }).toBe(1);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
    const payload = await page.evaluate(() => {
      if (Array.isArray(window.__xmindCloseConfirmCalls) && window.__xmindCloseConfirmCalls.length) {
        return window.__xmindCloseConfirmCalls[0];
      }
      if (Array.isArray(window.__xmindNativeConfirmCalls) && window.__xmindNativeConfirmCalls.length) {
        return window.__xmindNativeConfirmCalls[0];
      }
      return null;
    });
    expect(payload).toBeTruthy();
    expect(String(payload.title || '关闭生成页签')).toContain('关闭生成页签');
    expect(String(payload.message || '')).toContain('前置准备');
  });

  test('多个 XMind 页签时，关闭按钮会准确关闭当前点击的目标页签', async ({ page }) => {
    const token = 'xmind-tab-close-target-token';
    const user = { id: 806, username: 'tabs-close-target' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '页签一', '第一页签需求', {
      completePrep: true,
      useExistingWorkspace: true,
    });
    await createXmindWorkspaceByManualPrep(page, '页签二', '第二页签需求', { completePrep: true });

    await page.evaluate(() => {
      window.__xmindCloseConfirmCalls = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindCloseConfirmCalls.push(payload || null);
          var st = window.app && window.app.state ? window.app.state : null;
          var host = st && st.xmindCaseGen ? st.xmindCaseGen : null;
          if (host && Array.isArray(host.workspaceOrder) && host.workspaceOrder.length >= 2) {
            host.workspaceOrder = [host.workspaceOrder[1], host.workspaceOrder[0]];
          }
          return Promise.resolve({ ok: true });
        };
      }
    });

    await clickXmindWorkspaceClose(page, '页签二');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindCloseConfirmCalls) ? window.__xmindCloseConfirmCalls.length : 0);
    }).toBe(1);

    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
    const tabTexts = await page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').evaluateAll((nodes) => {
      return nodes.map((node) => String(node.textContent || '').replace(/\s+/g, ' ').trim());
    });
    expect(tabTexts.some((text) => text.indexOf('页签二') !== -1)).toBe(false);
    expect(tabTexts.some((text) => text.indexOf('页签一') !== -1)).toBe(true);
  });

  test('未完成前置准备但已填写手填需求的页签，关闭前也会弹出二次确认', async ({ page }) => {
    const token = 'xmind-tab-close-confirm-manual-draft-token';
    const user = { id: 807, username: 'tabs-close-confirm-manual-draft' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);
    await createXmindWorkspaceByManualPrep(page, '手填草稿需求', '这里只填写了 step1 草稿，还没有完成整个前置准备。', {
      useExistingWorkspace: true,
    });

    await page.evaluate(() => {
      window.__xmindCloseConfirmCalls = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindCloseConfirmCalls.push(payload || null);
          return Promise.resolve({ ok: false });
        };
      }
    });

    await clickXmindWorkspaceCloseUi(page, '手填草稿需求');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindCloseConfirmCalls) ? window.__xmindCloseConfirmCalls.length : 0);
    }).toBe(1);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toContainText('手填草稿需求');
    const payload = await page.evaluate(() => {
      return Array.isArray(window.__xmindCloseConfirmCalls) && window.__xmindCloseConfirmCalls.length
        ? window.__xmindCloseConfirmCalls[0]
        : null;
    });
    expect(payload).toBeTruthy();
    expect(String(payload.message || '')).toContain('关闭后不会保留');
  });

  test('混合文档与手填草稿的多个 XMind 页签，真实点击关闭按钮时只会关闭目标页签', async ({ page }) => {
    const token = 'xmind-tab-close-ui-mixed-draft-token';
    const user = { id: 808, username: 'tabs-close-ui-mixed-draft' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {});

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByDocumentDraft(page, '需求A.txt', '这是需求 A 的文档草稿。', {
      useExistingWorkspace: true,
    });
    await createXmindWorkspaceByDocumentDraft(page, '需求B.txt', '这是需求 B 的文档草稿。');
    await createXmindWorkspaceByManualPrep(page, '需求C', '这是需求 C 的手填草稿。', {});

    await page.evaluate(() => {
      window.__xmindCloseConfirmCalls = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindCloseConfirmCalls.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
    });

    const beforeMap = await page.evaluate(() => {
      var st = window.app && window.app.state ? window.app.state : null;
      var host = st && st.xmindCaseGen ? st.xmindCaseGen : null;
      var order = host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
      return order.map(function(id) {
        var node = document.querySelector('[data-xmind-workspace-tab="' + String(id || '') + '"]');
        var closeBtn = node ? node.querySelector('[data-xmind-workspace-close]') : null;
        var rect = closeBtn && closeBtn.getBoundingClientRect ? closeBtn.getBoundingClientRect() : null;
        var hit = null;
        if (rect && rect.width > 0 && rect.height > 0 && document.elementFromPoint) {
          hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        var hitClose = hit && hit.closest ? hit.closest('[data-xmind-workspace-close]') : null;
        return {
          id: String(id || ''),
          title: node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : '',
          closeId: closeBtn ? String(closeBtn.getAttribute('data-xmind-workspace-close') || '') : '',
          hitCloseId: hitClose ? String(hitClose.getAttribute('data-xmind-workspace-close') || '') : '',
        };
      });
    });
    expect(beforeMap.length).toBe(3);
    expect(beforeMap.some((item) => item.title.indexOf('需求A') !== -1)).toBe(true);
    expect(beforeMap.some((item) => item.title.indexOf('需求B') !== -1)).toBe(true);
    expect(beforeMap.some((item) => item.title.indexOf('需求C') !== -1)).toBe(true);
    const targetBefore = beforeMap.find((item) => item.title.indexOf('需求C') !== -1);
    expect(targetBefore).toBeTruthy();
    expect(targetBefore.closeId).toBe(targetBefore.id);
    expect(targetBefore.hitCloseId).toBe(targetBefore.id);

    await clickXmindWorkspaceCloseUi(page, '需求C');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindCloseConfirmCalls) ? window.__xmindCloseConfirmCalls.length : 0);
    }).toBe(1);

    const closeDebug = await page.evaluate(() => {
      var debug = window.app && window.app.__xmindCasegenDebug ? window.app.__xmindCasegenDebug : null;
      return debug && debug.closeWorkspaceAction ? JSON.parse(JSON.stringify(debug.closeWorkspaceAction)) : null;
    });
    expect(closeDebug).toBeTruthy();
    expect(String(closeDebug.workspaceId || '')).toBe(String(targetBefore.id || ''));

    const payload = await page.evaluate(() => {
      return Array.isArray(window.__xmindCloseConfirmCalls) && window.__xmindCloseConfirmCalls.length
        ? window.__xmindCloseConfirmCalls[0]
        : null;
    });
    expect(payload).toBeTruthy();
    expect(String(payload.message || '')).toContain('需求C');

    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(2);
    const afterMap = await page.evaluate(() => {
      var st = window.app && window.app.state ? window.app.state : null;
      var host = st && st.xmindCaseGen ? st.xmindCaseGen : null;
      var order = host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
      return order.map(function(id) {
        var node = document.querySelector('[data-xmind-workspace-tab="' + String(id || '') + '"]');
        return {
          id: String(id || ''),
          title: node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : '',
        };
      });
    });
    const tabTexts = await page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').evaluateAll((nodes) => {
      return nodes.map((node) => String(node.textContent || '').replace(/\s+/g, ' ').trim());
    });
    const afterState = {
      afterMap: afterMap,
      tabTexts: tabTexts,
      closeDebug: closeDebug,
      targetBefore: targetBefore,
    };
    expect(tabTexts.some((text) => text.indexOf('需求A') !== -1), JSON.stringify(afterState)).toBe(true);
    expect(tabTexts.some((text) => text.indexOf('需求B') !== -1), JSON.stringify(afterState)).toBe(true);
    expect(tabTexts.some((text) => text.indexOf('需求C') !== -1), JSON.stringify(afterState)).toBe(false);
    expect(afterMap.some((item) => item.id === String(targetBefore.id || '')), JSON.stringify(afterState)).toBe(false);
  });

  test('前置准备 step1 的需求文档模式复用拖拽上传样式，并在导入后允许下一步', async ({ page }) => {
    const token = 'token-xmind-prep-document-zone';
    const user = { id: 11, username: 'demo_user_11', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await expect(page.locator('label.xmind-casegen-prep-choice.is-success').filter({ has: page.locator('input[name="xmindRequirementMode"][value="document"]') })).toHaveClass(/is-active/);
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toBeVisible();
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('原始需求');
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('拖拽或点击选择');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.evaluate((payload) => {
      var zone = document.getElementById('xmindCaseGenPrepRequirementDropzone');
      if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
      var dt = new DataTransfer();
      dt.items.add(new File([payload.text], payload.name, { type: 'text/plain' }));
      function dispatch(type) {
        var evt = null;
        if (typeof Event === 'function') {
          evt = new Event(type, { bubbles: true, cancelable: true });
        } else if (document && document.createEvent) {
          evt = document.createEvent('Event');
          evt.initEvent(type, true, true);
        }
        if (!evt) return;
        try {
          Object.defineProperty(evt, 'dataTransfer', { value: dt });
        } catch (_) {
          evt.dataTransfer = dt;
        }
        zone.dispatchEvent(evt);
      }
      dispatch('dragover');
      dispatch('drop');
    }, {
      name: 'xmind-step1-requirement.txt',
      text: '需求正文：支持用户拖拽导入原始需求文档，并同步到 XMind 生成上下文。',
    });

    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('支持用户拖拽导入原始需求文档') !== -1);
    }, {}, { timeout: 20000 });
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('已导入');
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('xmind-step1-requirement.txt');
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('图片 0 张');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();
  });

  test('前置准备 step1 导入需求后展示需求图片数量', async ({ page }) => {
    const token = 'token-xmind-prep-document-image-count';
    const user = { id: 112, username: 'demo_user_112', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求正文：导入文档后应在生成前置准备中展示图片数量。',
      requirementLabel: 'XMind图片数量需求',
      imageCount: 2,
      imageBytes: ONE_PIXEL_PNG,
    });
    await seedPrepState(page, {
      step: 1,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: false,
    });
    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenSummaryBtn');

    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('已导入');
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('正文 26 字');
    await expect(page.locator('#xmindCaseGenPrepRequirementDropzone')).toContainText('图片 2 张');
  });

  test('前置准备 step1 的手填需求模式会实时更新下一步按钮状态', async ({ page }) => {
    const token = 'token-xmind-prep-manual-realtime';
    const user = { id: 111, username: 'demo_user_111', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.check('input[name="xmindRequirementMode"][value="manual"]', { force: true });
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.fill('#xmindCaseGenManualRequirementText', '手填需求：支持用户填写需求描述后立即进入下一步。');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.fill('#xmindCaseGenManualRequirementLabel', '手填需求根节点');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();

    await page.fill('#xmindCaseGenManualRequirementText', '');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.fill('#xmindCaseGenManualRequirementText', '重新填写需求描述后恢复可下一步。');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();

    await page.fill('#xmindCaseGenManualRequirementLabel', '');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();
  });

  test('前置准备 step2 的已有用例导入复用拖拽上传样式，并在导入后允许下一步', async ({ page }) => {
    const token = 'token-xmind-prep-cases-zone';
    const user = { id: 12, username: 'demo_user_12', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await page.evaluate((payload) => {
      var zone = document.getElementById('xmindCaseGenPrepRequirementDropzone');
      if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
      var dt = new DataTransfer();
      dt.items.add(new File([payload.text], payload.name, { type: 'text/plain' }));
      function dispatch(type) {
        var evt = null;
        if (typeof Event === 'function') {
          evt = new Event(type, { bubbles: true, cancelable: true });
        } else if (document && document.createEvent) {
          evt = document.createEvent('Event');
          evt.initEvent(type, true, true);
        }
        if (!evt) return;
        try {
          Object.defineProperty(evt, 'dataTransfer', { value: dt });
        } catch (_) {
          evt.dataTransfer = dt;
        }
        zone.dispatchEvent(evt);
      }
      dispatch('dragover');
      dispatch('drop');
    }, {
      name: 'xmind-step2-requirement.txt',
      text: '需求正文：支持在 step2 拖拽导入参考用例。',
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('支持在 step2 拖拽导入参考用例') !== -1);
    }, {}, { timeout: 20000 });
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');

    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step2');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('导入已有用例');
    await page.check('input[name="xmindCaseImportMode"][value="import"]', { force: true });
    await expect(page.locator('#xmindCaseGenPrepCasesDropzone')).toBeVisible();
    await expect(page.locator('#xmindCaseGenPrepCasesDropzone')).toContainText('测试用例');
    await expect(page.locator('#xmindCaseGenPrepCasesDropzone')).toContainText('拖拽或点击选择');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-action="select-cases-library"]')).toBeVisible();
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    await page.evaluate((payload) => {
      var zone = document.getElementById('xmindCaseGenPrepCasesDropzone');
      if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
      var dt = new DataTransfer();
      dt.items.add(new File([payload.text], payload.name, { type: 'application/json' }));
      function dispatch(type) {
        var evt = null;
        if (typeof Event === 'function') {
          evt = new Event(type, { bubbles: true, cancelable: true });
        } else if (document && document.createEvent) {
          evt = document.createEvent('Event');
          evt.initEvent(type, true, true);
        }
        if (!evt) return;
        try {
          Object.defineProperty(evt, 'dataTransfer', { value: dt });
        } catch (_) {
          evt.dataTransfer = dt;
        }
        zone.dispatchEvent(evt);
      }
      dispatch('dragover');
      dispatch('drop');
    }, {
      name: 'xmind-step2-cases.json',
      text: JSON.stringify([{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }]),
    });

    await page.waitForFunction(() => {
      var st = window.app && window.app.state ? window.app.state : null;
      return Boolean(st && Array.isArray(st.importedCases) && st.importedCases.length > 0);
    }, {}, { timeout: 20000 });
    await expect(page.locator('#xmindCaseGenPrepCasesDropzone')).toContainText('当前共 1 条');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody .xmind-casegen-prep-filelist')).toContainText('已导入已有用例');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();
  });

  test('XMind 入口与页签并排显示，后台完成后按钮显示小红点，点开后消失', async ({ page }) => {
    const token = 'token-xmind-open-entry-dot';
    const user = { id: 14, username: 'demo_user_14', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 260);

    const tabbarInfo = await page.evaluate(() => {
      var tabbar = document.querySelector('.casegen-tabbar');
      var children = tabbar ? Array.prototype.map.call(tabbar.children || [], function(node) {
        return node && node.id ? String(node.id) : '';
      }).filter(Boolean) : [];
      var btn = document.getElementById('xmindCaseGenOpenBtn');
      return {
        childIds: children,
        className: btn ? String(btn.className || '') : '',
        insideTabbar: Boolean(tabbar && btn && tabbar.contains(btn)),
        insideLegacyActions: Boolean(btn && btn.closest && btn.closest('.casegen-tabbar-actions')),
      };
    });
    expect(tabbarInfo.insideTabbar).toBeTruthy();
    expect(tabbarInfo.insideLegacyActions).toBeFalsy();
    expect(tabbarInfo.className).toContain('casegen-tab');
    expect(tabbarInfo.className).toContain('casegen-tab-launcher');

    await seedDocumentRequirement(page, {
      text: '需求：后台完成后，XMind 入口按钮需要出现未读提示。',
      requirementLabel: 'XMind入口红点需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await expect(page.locator('#xmindCaseGenInterruptBtn')).toBeEnabled();
    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await page.waitForFunction(() => {
      var btn = document.getElementById('xmindCaseGenOpenBtn');
      var xmind = window.app && window.app.state ? window.app.state.xmindCaseGen : null;
      return Boolean(
        btn &&
        btn.classList &&
        btn.classList.contains('has-notice-dot') &&
        xmind &&
        xmind.openButtonDotVisible === true
      );
    }, {}, { timeout: 10000 });

    await page.click('#xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await page.waitForFunction(() => {
      var btn = document.getElementById('xmindCaseGenOpenBtn');
      var xmind = window.app && window.app.state ? window.app.state.xmindCaseGen : null;
      return Boolean(
        btn &&
        btn.classList &&
        !btn.classList.contains('has-notice-dot') &&
        xmind &&
        xmind.openButtonDotVisible === false
      );
    }, {}, { timeout: 10000 });
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
  });

  test('step2 导入已有用例并确认后，视图会重新定位到根节点', async ({ page }) => {
    const token = 'token-xmind-prep-import-centers-root';
    const user = { id: 13, username: 'demo_user_13', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await page.evaluate((payload) => {
      var zone = document.getElementById('xmindCaseGenPrepRequirementDropzone');
      if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
      var dt = new DataTransfer();
      dt.items.add(new File([payload.text], payload.name, { type: 'text/plain' }));
      function dispatch(type) {
        var evt = null;
        if (typeof Event === 'function') {
          evt = new Event(type, { bubbles: true, cancelable: true });
        } else if (document && document.createEvent) {
          evt = document.createEvent('Event');
          evt.initEvent(type, true, true);
        }
        if (!evt) return;
        try {
          Object.defineProperty(evt, 'dataTransfer', { value: dt });
        } catch (_) {
          evt.dataTransfer = dt;
        }
        zone.dispatchEvent(evt);
      }
      dispatch('dragover');
      dispatch('drop');
    }, {
      name: 'xmind-prep-center-root-requirement.txt',
      text: '需求正文：完成导入已有用例并确认后，画布需要回到根节点。',
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('画布需要回到根节点') !== -1);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.check('input[name="xmindCaseImportMode"][value="import"]', { force: true });
    await page.evaluate((payload) => {
      var zone = document.getElementById('xmindCaseGenPrepCasesDropzone');
      if (!zone || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return;
      var dt = new DataTransfer();
      dt.items.add(new File([payload.text], payload.name, { type: 'application/json' }));
      function dispatch(type) {
        var evt = null;
        if (typeof Event === 'function') {
          evt = new Event(type, { bubbles: true, cancelable: true });
        } else if (document && document.createEvent) {
          evt = document.createEvent('Event');
          evt.initEvent(type, true, true);
        }
        if (!evt) return;
        try {
          Object.defineProperty(evt, 'dataTransfer', { value: dt });
        } catch (_) {
          evt.dataTransfer = dt;
        }
        zone.dispatchEvent(evt);
      }
      dispatch('dragover');
      dispatch('drop');
    }, {
      name: 'xmind-prep-center-root-cases.json',
      text: JSON.stringify([{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }]),
    });
    await page.waitForFunction(() => {
      var st = window.app && window.app.state ? window.app.state : null;
      return Boolean(st && Array.isArray(st.importedCases) && st.importedCases.length > 0);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step3');

    const panResult = await panXmindCasegenCanvas(page, 260, 180);
    expect(panResult.dispatched).toBeTruthy();
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      return Boolean(map && map.style && String(map.style.transform || '') !== String(beforeTransform || ''));
    }, panResult.before || '', { timeout: 10000 });

    const centerBeforeConfirm = await page.evaluate(() => {
      var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
        || document.getElementById('xmindCaseGenMindContainer');
      var textEl = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
      if (!viewer || !viewer.getBoundingClientRect || !textEl || !textEl.getBoundingClientRect) return null;
      var viewerRect = viewer.getBoundingClientRect();
      var nodeRect = textEl.getBoundingClientRect();
      return {
        dx: Math.abs((nodeRect.left + (nodeRect.width / 2)) - (viewerRect.left + (viewerRect.width / 2))),
        dy: Math.abs((nodeRect.top + (nodeRect.height / 2)) - (viewerRect.top + (viewerRect.height / 2))),
      };
    });
    expect(centerBeforeConfirm).not.toBeNull();
    expect(Math.max(centerBeforeConfirm.dx, centerBeforeConfirm.dy)).toBeGreaterThan(30);

    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);
    await page.waitForFunction(() => {
      var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
        || document.getElementById('xmindCaseGenMindContainer');
      var textEl = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
      if (!viewer || !viewer.getBoundingClientRect || !textEl || !textEl.getBoundingClientRect) return false;
      var viewerRect = viewer.getBoundingClientRect();
      var nodeRect = textEl.getBoundingClientRect();
      var dx = Math.abs((nodeRect.left + (nodeRect.width / 2)) - (viewerRect.left + (viewerRect.width / 2)));
      var dy = Math.abs((nodeRect.top + (nodeRect.height / 2)) - (viewerRect.top + (viewerRect.height / 2)));
      return dx <= 10 && dy <= 10;
    }, {}, { timeout: 10000 });
  });

  test('已有用例时关闭后重新通过入口进入，会重新定位到根节点', async ({ page }) => {
    const token = 'token-xmind-reopen-centers-root';
    const user = { id: 131, username: 'demo_user_131', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：重新进入 XMind 用例生成时，需要先回到根节点视角。',
      requirementLabel: 'XMind重进定位根节点需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-root-reopen-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-root-reopen-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付成功校验'],
      coupled: ['订单中心'],
    }]);
    await seedAiCases(page, {
      'xmind-root-reopen-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
      'xmind-root-reopen-pay': [{
        module: '支付模块',
        title: '支付成功校验',
        priority: 'P1',
        preconditions: '订单已创建',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付成功校验');

    const panResult = await panXmindCasegenCanvas(page, 280, 180);
    expect(panResult.dispatched).toBeTruthy();
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      return Boolean(map && map.style && String(map.style.transform || '') !== String(beforeTransform || ''));
    }, panResult.before || '', { timeout: 10000 });

    const centerBeforeReopen = await page.evaluate(() => {
      var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
        || document.getElementById('xmindCaseGenMindContainer');
      var textEl = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
      if (!viewer || !viewer.getBoundingClientRect || !textEl || !textEl.getBoundingClientRect) return null;
      var viewerRect = viewer.getBoundingClientRect();
      var nodeRect = textEl.getBoundingClientRect();
      return {
        dx: Math.abs((nodeRect.left + (nodeRect.width / 2)) - (viewerRect.left + (viewerRect.width / 2))),
        dy: Math.abs((nodeRect.top + (nodeRect.height / 2)) - (viewerRect.top + (viewerRect.height / 2))),
      };
    });
    expect(centerBeforeReopen).not.toBeNull();
    expect(Math.max(centerBeforeReopen.dx, centerBeforeReopen.dy)).toBeGreaterThan(30);

    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录成功校验');
    const reopenFrameOffsets = await page.evaluate(() => {
      return new Promise((resolve) => {
        var samples = [];
        function takeSample() {
          var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
            || document.getElementById('xmindCaseGenMindContainer');
          var textEl = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
          if (!viewer || !viewer.getBoundingClientRect || !textEl || !textEl.getBoundingClientRect) {
            window.requestAnimationFrame(takeSample);
            return;
          }
          var viewerRect = viewer.getBoundingClientRect();
          var nodeRect = textEl.getBoundingClientRect();
          samples.push({
            dx: Number((nodeRect.left + (nodeRect.width / 2)) - (viewerRect.left + (viewerRect.width / 2))),
            dy: Number((nodeRect.top + (nodeRect.height / 2)) - (viewerRect.top + (viewerRect.height / 2))),
          });
          if (samples.length >= 6) {
            resolve(samples);
            return;
          }
          window.requestAnimationFrame(takeSample);
        }
        window.requestAnimationFrame(takeSample);
      });
    });
    expect(reopenFrameOffsets.length).toBeGreaterThanOrEqual(6);
    reopenFrameOffsets.forEach((offset) => {
      expect(Math.abs(Number(offset.dx || 0))).toBeLessThanOrEqual(12);
      expect(Math.abs(Number(offset.dy || 0))).toBeLessThanOrEqual(12);
    });
    await page.waitForFunction(() => {
      var viewer = document.querySelector('#xmindCaseGenMindContainer .xmind-structure-viewer')
        || document.getElementById('xmindCaseGenMindContainer');
      var textEl = document.querySelector('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-root .text');
      if (!viewer || !viewer.getBoundingClientRect || !textEl || !textEl.getBoundingClientRect) return false;
      var viewerRect = viewer.getBoundingClientRect();
      var nodeRect = textEl.getBoundingClientRect();
      var dx = Math.abs((nodeRect.left + (nodeRect.width / 2)) - (viewerRect.left + (viewerRect.width / 2)));
      var dy = Math.abs((nodeRect.top + (nodeRect.height / 2)) - (viewerRect.top + (viewerRect.height / 2)));
      return dx <= 10 && dy <= 10;
    }, {}, { timeout: 10000 });
    await waitForPaintFrames(page, 2);
    const centerAfterReopen = await readXmindRootCenter(page);
    expect(centerAfterReopen).not.toBeNull();
    await page.waitForTimeout(900);
    const centerStableAfterReopen = await readXmindRootCenter(page);
    expect(centerStableAfterReopen).not.toBeNull();
    expect(Math.abs(centerStableAfterReopen.x - centerAfterReopen.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(centerStableAfterReopen.y - centerAfterReopen.y)).toBeLessThanOrEqual(6);
  });

  test('前置准备改为单步 3 步流程，并在确认后锁定前两步', async ({ page }) => {
    const token = 'token-xmind-prep';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await page.waitForFunction(() => Boolean(document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]')), {}, { timeout: 10000 });
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenPrepResetBtn')).toBeVisible();
    await expect(page.locator('#xmindCaseGenSummaryDialogBody .xmind-casegen-prep-step')).toHaveCount(3);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody .xmind-casegen-prep-step').nth(1)).not.toHaveClass(/is-done/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();
    const footerStyle = await page.locator('#xmindCaseGenSummaryDialogBody .xmind-casegen-prep-footer').evaluate((el) => {
      var style = window.getComputedStyle(el);
      return {
        position: style.position,
        bottom: style.bottom,
      };
    });
    expect(footerStyle.position).toBe('sticky');
    expect(footerStyle.bottom).toBe('0px');

    await page.check('input[name="xmindRequirementMode"][value="manual"]', { force: true });
    await expect(page.locator('label.xmind-casegen-prep-choice.is-success').filter({ has: page.locator('input[name="xmindRequirementMode"][value="manual"]') })).toHaveClass(/is-active/);
    await page.fill('#xmindCaseGenManualRequirementLabel', '移动端订单确认需求');
    await page.fill('#xmindCaseGenManualRequirementText', '手填需求：支持用户在移动端完成订单确认。');
    await page.click('[data-prep-action="upload-manual-images"]');
    await page.locator('input[type="file"][accept="image/*"]').last().setInputFiles({
      name: 'requirement.png',
      mimeType: 'image/png',
      buffer: ONE_PIXEL_PNG,
    });
    await expect(page.locator('.xmind-casegen-prep-image-item')).toHaveCount(1);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeEnabled();

    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step2');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('导入已有用例');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();
    await page.locator('label.xmind-casegen-prep-choice').filter({ has: page.locator('input[name="xmindCaseImportMode"][value="skip"]') }).click();
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step2');
    await expect(page.locator('label.xmind-casegen-prep-choice').filter({ has: page.locator('input[name="xmindCaseImportMode"][value="skip"]') })).toHaveClass(/is-active/);
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');

    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step3');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('确认后，step1 和 step2 在本次生成中都不可更改');
    await page.fill('#xmindCaseGenOptionCustomRequirement', '标题保持简洁');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('去重设置');
    await expect(page.locator('[data-casegen-setting-card="dedupeSimplify"]')).toHaveClass(/is-off/);
    await expect(page.locator('input[data-casegen-setting="dedupeSimplify"]')).not.toBeChecked();
    await page.locator('input[data-casegen-setting="dedupeSimplify"]').check({ force: true });
    await expect(page.locator('[data-casegen-setting-card="dedupeSimplify"]')).toHaveClass(/is-on/);
    await expect(page.locator('[data-casegen-setting-card="needFunctionCondition"]')).toHaveClass(/is-on/);
    await expect(page.locator('[data-casegen-setting-card="needNumericValidation"]')).toHaveClass(/is-on/);
    await page.locator('input[data-casegen-setting="needBoundary"]').check({ force: true });
    await page.locator('input[data-casegen-setting="needSpecial"]').check({ force: true });
    await page.locator('input[data-casegen-setting="specialWeakNetwork"]').check({ force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);
    await waitForNodeText(page, '移动端订单确认需求');

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step3');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="prev"]')).toBeEnabled();
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="prev"]');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step2');
    await expect(page.locator('input[name="xmindCaseImportMode"][value="skip"]')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-action="import-cases"]')).toHaveCount(0);
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="prev"]');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('input[name="xmindRequirementMode"][value="manual"]')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenManualRequirementLabel')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenManualRequirementText')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-action="upload-manual-images"]')).toBeDisabled();
    await clickElementById(page, 'xmindCaseGenSummaryCloseBtn');
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step3');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var prep = state && state.xmindCaseGen ? state.xmindCaseGen.prep : null;
      return Boolean(prep && Array.isArray(prep.manualRequirementBlocks) && prep.manualRequirementBlocks.length === 2);
    }, {}, { timeout: 20000 });

    const state = await readState(page);
    expect(state && state.xmindCaseGen && state.xmindCaseGen.prep).toBeTruthy();
    expect(state.xmindCaseGen.prep.requirementMode).toBe('manual');
    expect(state.xmindCaseGen.prep.caseImportMode).toBe('skip');
    expect(state.xmindCaseGen.prep.baseLocked).toBe(true);
    expect(state.xmindCaseGen.prep.completed).toBe(true);
    expect(state.xmindCaseGen.prep.manualRequirementLabel).toBe('移动端订单确认需求');
    expect(Array.isArray(state.xmindCaseGen.prep.manualRequirementBlocks)).toBeTruthy();
    expect(state.xmindCaseGen.prep.manualRequirementBlocks.length).toBe(2);
    expect(state.caseGenSettings.customRequirement).toBe('标题保持简洁');
    expect(state.caseGenSettings.dedupeSimplify).toBe(true);
    expect(state.caseGenSettings.needFunctionCondition).toBe(true);
    expect(state.caseGenSettings.needNumericValidation).toBe(true);
    expect(state.caseGenSettings.needBoundary).toBe(true);
    expect(state.caseGenSettings.needSpecial).toBe(true);
    expect(state.caseGenSettings.specialWeakNetwork).toBe(true);
  });

  test('前置准备支持重置，确认后会清空当前导入与生成结果并回到 step1', async ({ page }) => {
    const token = 'token-xmind-prep-reset';
    const user = { id: 101, username: 'demo_user_101', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
    });
    await seedDocumentRequirement(page, {
      text: '需求：重置后需要恢复为未导入、未生成的初始状态。',
      requirementLabel: 'XMind重置需求',
    });
    await seedImportedBaseline(page, [{
      module: '登录模块',
      title: '登录模块-基线用例',
      priority: 'P1',
      preconditions: '账号已存在',
      steps: ['1、进入登录页', '2、输入账号密码'],
      expected: '登录成功',
    }]);
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'import',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');

    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);
    await expect(page.locator('.temp-center-toast').last()).toContainText('已重置当前 XMind 生成内容');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();

    const resetState = await page.evaluate(() => {
      var st = window.app && window.app.state ? window.app.state : {};
      return {
        rawText: document.getElementById('rawText') ? String(document.getElementById('rawText').value || '') : '',
        caseText: document.getElementById('caseText') ? String(document.getElementById('caseText').value || '') : '',
        requirementLabel: String(st.requirementLabel || ''),
        importedCount: Array.isArray(st.importedCases) ? st.importedCases.length : -1,
        moduleCount: Array.isArray(st.caseGenModules) ? st.caseGenModules.length : -1,
        resultCount: st.caseGenResults && typeof st.caseGenResults === 'object' ? Object.keys(st.caseGenResults).length : -1,
        prep: st.xmindCaseGen && st.xmindCaseGen.prep ? {
          step: Number(st.xmindCaseGen.prep.step || 0),
          requirementMode: String(st.xmindCaseGen.prep.requirementMode || ''),
          caseImportMode: String(st.xmindCaseGen.prep.caseImportMode || ''),
          completed: st.xmindCaseGen.prep.completed === true,
          baseLocked: st.xmindCaseGen.prep.baseLocked === true,
        } : null,
      };
    });

    expect(resetState.rawText).toBe('');
    expect(resetState.caseText).toBe('');
    expect(resetState.requirementLabel).toBe('');
    expect(resetState.importedCount).toBe(0);
    expect(resetState.moduleCount).toBe(0);
    expect(resetState.resultCount).toBe(0);
    expect(resetState.prep).not.toBeNull();
    expect(resetState.prep.step).toBe(1);
    expect(resetState.prep.requirementMode).toBe('');
    expect(resetState.prep.caseImportMode).toBe('');
    expect(resetState.prep.completed).toBe(false);
    expect(resetState.prep.baseLocked).toBe(false);
  });

  test('重置前置准备后重新完成 step1-3，根节点仍可重新执行全量生成并使用新需求上下文', async ({ page }) => {
    const token = 'token-xmind-prep-reset-regenerate';
    const user = { id: 102, username: 'demo_user_102', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 160);
    await autoAcceptXmindConfirm(page);
    await openXmindCaseGenDrawer(page);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-first.txt',
        mimeType: 'text/plain',
        text: '需求正文：第一次生成，仅用于构造重置前的上下文。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('第一次生成') !== -1);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]', { force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);
    await waitForNodeText(page, 'xmind-reset-first');

    await openRootContextMenu(page);
    await clickVisibleContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForAnyGeneratedCases(page);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('生成1');
    await page.click('#xmindCaseGenSummaryCloseBtn');
    await waitForNodeText(page, '当前需求');
    await waitForNodeTextAbsent(page, 'xmind-reset-first');

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);

    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-second.txt',
        mimeType: 'text/plain',
        text: '需求正文：第二次生成，重置后应该使用这一轮的新需求重新生成模块和用例。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('第二次生成') !== -1);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]', { force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await waitForNodeText(page, 'xmind-reset-second');
    await openRootContextMenu(page);
    const resetItems = await getContextMenuItems(page);
    expect(Array.from(new Set(resetItems.map((item) => item.label)))).toEqual(['生成全量用例', '生成全量模块']);
    await clickVisibleContextMenuAction(page, '生成全量用例');

    await waitForNodeStatus(page, 'xmind-reset-second', '生成中');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForAnyGeneratedCases(page);
    await waitForNodeStatusAbsent(page, 'xmind-reset-second');

    const lastRootFullCasesCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      for (var i = calls.length - 1; i >= 0; i -= 1) {
        var item = calls[i];
        if (!item || !item.contract) continue;
        if (String(item.contract.scope || '') !== 'root') continue;
        if (String(item.contract.mode || '') !== 'full_cases') continue;
        return {
          user: String(item.user || ''),
          prompt: String(item.prompt || ''),
        };
      }
      return null;
    });
    expect(lastRootFullCasesCall).toBeTruthy();
    expect(lastRootFullCasesCall.user).toContain('【需求正文】\n需求正文：第二次生成，重置后应该使用这一轮的新需求重新生成模块和用例。');
    expect(lastRootFullCasesCall.user).not.toContain('第一次生成，仅用于构造重置前的上下文');
  });

  test('当前 step1 选中的需求来源会决定 XMind 生成上下文', async ({ page }) => {
    const token = 'token-xmind-prep-source-selection';
    const user = { id: 1002, username: 'demo_user_1002', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    async function runWithSelectedRequirementMode(mode, requirementLabel, manualRequirementLabel) {
      await gotoCasesgenWorkflow(page);
      await waitXmindModelAssigned(page, mockInfo.modelId);
      await installXmindModelStub(page, 180);
      await autoAcceptXmindConfirm(page);
      await page.evaluate(() => {
        if (window.app && window.app.xmindCasegenApi && typeof window.app.xmindCasegenApi.resetAllState === 'function') {
          window.app.xmindCasegenApi.resetAllState({ silentBlocked: true });
        }
      });
      await page.evaluate(() => {
        if (!window.app || !window.app.state) return;
        window.app.state.caseGenSettings = window.app.state.caseGenSettings || {};
        window.app.state.caseGenSettings.needFunctionCondition = false;
        window.app.state.caseGenSettings.needNumericValidation = false;
        window.app.state.caseGenSettings.needBoundary = false;
        window.app.state.caseGenSettings.needMobile = false;
        window.app.state.caseGenSettings.needSpecial = false;
        window.app.state.caseGenSettings.specialRepeatOperation = false;
        window.app.state.caseGenSettings.specialMultiTouch = false;
        window.app.state.caseGenSettings.specialRepeatExecution = false;
        window.app.state.caseGenSettings.specialWeakNetwork = false;
        window.app.state.caseGenSettings.specialInterruptResume = false;
      });
      await seedDocumentRequirement(page, {
        text: '需求正文：文档上下文只应在选中文档模式时提交。',
        requirementLabel: requirementLabel,
      });
      await seedPrepState(page, {
        step: 3,
        requirementMode: mode,
        manualRequirementLabel: manualRequirementLabel,
        manualRequirementBlocks: [{ type: 'text', text: '手填需求：手填上下文只应在选中手填模式时提交。' }],
        caseImportMode: 'skip',
        completed: true,
      });
      await openXmindCaseGenDrawer(page);
      await waitForNodeText(page, mode === 'manual' ? manualRequirementLabel : requirementLabel);
      await openRootContextMenu(page);
      const items = await getContextMenuItems(page);
      const fullCasesAction = items.some((item) => item.label === '生成全量用例') ? '生成全量用例' : '重新生成全量用例';
      await clickContextMenuAction(page, fullCasesAction);
      await waitForNodeStatus(page, mode === 'manual' ? manualRequirementLabel : requirementLabel, '生成中');
      await waitForNodeStatusAbsent(page, mode === 'manual' ? manualRequirementLabel : requirementLabel);
      return page.evaluate(() => {
        var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
        for (var i = calls.length - 1; i >= 0; i -= 1) {
          var item = calls[i];
          if (!item || !item.contract) continue;
          if (String(item.contract.scope || '') !== 'root') continue;
          if (String(item.contract.mode || '') !== 'full_cases') continue;
          return {
            user: String(item.user || ''),
          };
        }
        return null;
      });
    }

    const manualCall = await runWithSelectedRequirementMode('manual', 'XMind双来源切换需求-文档', 'XMind双来源切换需求-手填');
    expect(manualCall).toBeTruthy();
    expect(manualCall.user).toContain('【需求标识】\nXMind双来源切换需求-手填');
    expect(manualCall.user).toContain('【手填需求描述】\n手填需求：手填上下文只应在选中手填模式时提交。');
    expect(manualCall.user).not.toContain('需求正文：文档上下文只应在选中文档模式时提交。');

    const documentCall = await runWithSelectedRequirementMode('document', 'XMind双来源切换需求-文档', 'XMind双来源切换需求-手填');
    expect(documentCall).toBeTruthy();
    expect(documentCall.user).toContain('【需求标识】\nXMind双来源切换需求-文档');
    expect(documentCall.user).toContain('【需求正文】\n需求正文：文档上下文只应在选中文档模式时提交。');
    expect(documentCall.user).not.toContain('手填需求：手填上下文只应在选中手填模式时提交。');
  });

  test('根节点右键触发生成前置准备时，会先收起右键菜单', async ({ page }) => {
    const token = 'token-xmind-prep-hides-context-menu';
    const user = { id: 1003, username: 'demo_user_1003', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await openRootContextMenu(page);
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(1);
    await clickContextMenuAction(page, '生成全量用例');

    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(0);
  });

  test('前置准备已完成后，点击右键生成动作也会立即收起右键菜单', async ({ page }) => {
    const token = 'token-xmind-generate-hides-context-menu';
    const user = { id: 10031, username: 'demo_user_10031', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 900);
    await seedDocumentRequirement(page, {
      text: '需求：验证右键点击生成动作后，菜单会立即消失。',
      requirementLabel: 'XMind右键收起需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind右键收起需求');
    await openRootContextMenu(page);
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(1);
    await clickContextMenuAction(page, '生成全量模块');

    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(0);
    await waitForNodeStatus(page, 'XMind右键收起需求', '生成中');
  });

  test('先选中节点再右键并真实点击生成动作时，也会立即收起右键菜单', async ({ page }) => {
    const token = 'token-xmind-selected-node-hides-context-menu';
    const user = { id: 10032, username: 'demo_user_10032', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：验证先选中节点再右键触发生成时，菜单会立即关闭。',
      requirementLabel: 'XMind选中节点右键收起需求',
    });
    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind选中节点右键收起需求');
    await selectXmindNode(page, 'XMind选中节点右键收起需求');
    await openNodeContextMenu(page, 'XMind选中节点右键收起需求');
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(1);

    await clickVisibleContextMenuAction(page, '生成全量用例');

    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(0);
  });

  test('节点文字被选中后再右键并真实点击生成动作时，也会立即收起右键菜单', async ({ page }) => {
    const token = 'token-xmind-selected-text-hides-context-menu';
    const user = { id: 10033, username: 'demo_user_10033', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：验证节点文字被浏览器原生选中后，再右键生成时，菜单会立即关闭。',
      requirementLabel: 'XMind文字选中右键收起需求',
    });
    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind文字选中右键收起需求');
    await selectXmindNodeText(page, 'XMind文字选中右键收起需求');
    await openNodeContextMenu(page, 'XMind文字选中右键收起需求');
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(1);

    await clickVisibleContextMenuAction(page, '生成全量用例');

    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('step1');
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(0);
  });

  test('重置前置准备后重新生成，真实 proxy 请求只携带当前一轮需求与图片上下文', async ({ page }) => {
    const token = 'token-xmind-prep-reset-proxy-context';
    const user = { id: 103, username: 'demo_user_103', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      modelBaseUrl: 'https://mock-model.local/v1/responses',
      modelName: 'gpt-5.4',
      modelCapabilities: ['vision', 'reasoning', 'chat'],
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[],"cases":[{"module":"登录模块","title":"登录成功校验","priority":"P1","preconditions":"账号已存在","steps":["1、进入登录页","2、输入正确账号密码并提交"],"expected":"登录成功"}]}]}',
    });
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
    });

    await seedDocumentRequirement(page, {
      text: '需求正文：第一次生成，附带图片上下文。',
      requirementLabel: '第一次需求',
      imageCount: 1,
      imageBytes: ONE_PIXEL_PNG,
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await openXmindCaseGenDrawer(page);

    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(1);

    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);

    await seedDocumentRequirement(page, {
      text: '需求正文：第二次生成，重置后只允许携带这一轮的新需求与图片。',
      requirementLabel: '第二次需求',
      imageCount: 1,
      imageBytes: ONE_PIXEL_PNG,
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await clickElementById(page, 'xmindCaseGenSummaryCloseBtn');
    await page.evaluate(() => {
      if (window.app && window.app.xmindCasegenApi && typeof window.app.xmindCasegenApi.render === 'function') {
        window.app.xmindCasegenApi.render({ reason: 'ui-test-after-reset' });
      }
    });
    await waitForNodeText(page, '第二次需求');

    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(2);

    const proxyCalls = await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls : []);
    expect(proxyCalls.length).toBeGreaterThanOrEqual(2);
    const lastCall = proxyCalls[proxyCalls.length - 1] || {};
    const payload = lastCall && lastCall.payload ? lastCall.payload : {};
    const content = Array.isArray(payload.input) && payload.input[0] && Array.isArray(payload.input[0].content)
      ? payload.input[0].content
      : [];
    const textBlocks = content.filter((item) => item && item.type === 'input_text').map((item) => String(item.text || ''));
    const imageBlocks = content.filter((item) => item && item.type === 'input_image');
    expect(imageBlocks.length).toBe(1);
    expect(textBlocks.join('\n')).toContain('【需求正文】\n需求正文：第二次生成，重置后只允许携带这一轮的新需求与图片。');
    expect(textBlocks.join('\n')).not.toContain('第一次生成，附带图片上下文');
  });

  test('重置前置准备后重新导入需求，不应再被旧工作流数据触发二次确认导入', async ({ page }) => {
    const token = 'token-xmind-prep-reset-no-second-import-confirm';
    const user = { id: 104, username: 'demo_user_104', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
      var cleanedTextEl = document.getElementById('cleanedText');
      if (cleanedTextEl) {
        cleanedTextEl.value = '历史清洗结果：这里模拟页面中仍残留其他工作流数据。';
        cleanedTextEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);

    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-import-after-cleaned.txt',
        mimeType: 'text/plain',
        text: '需求正文：reset 之后重新导入，不应该再次触发确认导入新需求。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('不应该再次触发确认导入新需求') !== -1);
    }, {}, { timeout: 20000 });

    const confirmPayloads = await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads : []);
    expect(confirmPayloads.length).toBe(1);
    expect(String(confirmPayloads[0] && confirmPayloads[0].title || '')).toContain('确认重置前置准备');
  });

  test('重置前置准备后通过真实 step1 文档导入重新完成准备，根节点仍可正常发起真实 proxy 生成', async ({ page }) => {
    const token = 'token-xmind-prep-reset-real-import-and-generate';
    const user = { id: 105, username: 'demo_user_105', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[],"cases":[{"module":"登录模块","title":"登录成功校验","priority":"P1","preconditions":"账号已存在","steps":["1、进入登录页","2、输入账号密码并提交"],"expected":"登录成功"}]}]}',
    });
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
      var cleanedTextEl = document.getElementById('cleanedText');
      if (cleanedTextEl) {
        cleanedTextEl.value = '历史清洗结果：用于模拟 reset 前页面仍有共享工作流数据。';
        cleanedTextEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);

    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-real-import.txt',
        mimeType: 'text/plain',
        text: '需求正文：真实 step1 文档导入后，仍应可以继续完成准备并正常发起生成。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('真实 step1 文档导入后') !== -1);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]', { force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await waitForNodeText(page, 'xmind-reset-real-import');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(1);

    const lastProxyCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls : [];
      return calls.length ? calls[calls.length - 1] : null;
    });
    expect(lastProxyCall).toBeTruthy();
    expect(JSON.stringify(lastProxyCall || {})).toContain('真实 step1 文档导入后');
  });

  test('重置前置准备后通过真实 step1 文档导入重新完成准备，根节点仍可正常发起全量模块生成', async ({ page }) => {
    const token = 'token-xmind-prep-reset-real-import-full-modules';
    const user = { id: 106, username: 'demo_user_106', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[]},{"module":"支付模块","key_scenarios":["支付主流程"],"test_points":["支付结果校验"],"coupled_modules":["订单中心"]}]}',
    });
    await page.evaluate(() => {
      window.__xmindPrepResetConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindPrepResetConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
      var splitResultEl = document.getElementById('splitResult');
      if (splitResultEl) {
        splitResultEl.value = '历史模块拆分结果：用于模拟 reset 前页面仍有共享工作流数据。';
        splitResultEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenSummaryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await page.click('#xmindCaseGenPrepResetBtn');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindPrepResetConfirmPayloads) ? window.__xmindPrepResetConfirmPayloads.length : 0);
    }).toBe(1);

    await page.check('input[name="xmindRequirementMode"][value="document"]', { force: true });
    await dispatchFileDropToZone(page, 'xmindCaseGenPrepRequirementDropzone', {
      files: [{
        name: 'xmind-reset-real-import-modules.txt',
        mimeType: 'text/plain',
        text: '需求正文：reset 后重新导入，再执行全量模块生成，也应可以正常发起。',
      }],
    });
    await page.waitForFunction(() => {
      var rawText = document.getElementById('rawText');
      return Boolean(rawText && String(rawText.value || '').indexOf('全量模块生成') !== -1);
    }, {}, { timeout: 20000 });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.check('input[name="xmindCaseImportMode"][value="skip"]', { force: true });
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="next"]');
    await page.click('#xmindCaseGenSummaryDialogBody [data-prep-nav="confirm"]');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await waitForNodeText(page, 'xmind-reset-real-import-modules');
    await openRootContextMenu(page);
    const rootItems = await getContextMenuItems(page);
    expect(rootItems.map((item) => item.label)).toEqual(['生成全量用例', '生成全量模块']);
    await clickContextMenuAction(page, '生成全量模块');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(1);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
  });

  test('页面刷新后保持在 XMind 用例生成页面，全屏刷新会恢复为非全屏并保留折叠状态', async ({ page }) => {
    test.setTimeout(60000);
    const token = 'token-xmind-refresh-viewstate';
    const user = { id: 61, username: 'demo_user_refresh_view', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    const modules = [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
        title: '支付模块',
        scenarios: ['支付主场景'],
        points: ['支付结果校验'],
        coupled: ['订单中心'],
    }];
    const casesByModuleId = {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
      'xmind-mod-pay': [{
        module: '支付模块',
        title: '支付成功校验',
        priority: 'P1',
        preconditions: '订单待支付',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    };
    await openXmindCaseGenDrawer(page);
    await createXmindWorkspaceByManualPrep(page, 'XMind刷新视图需求', '需求：刷新后需要保持 XMind 用例生成页的当前视图状态。', {
      completePrep: true,
    });
    await seedAiSkeleton(page, modules);
    await seedAiCases(page, casesByModuleId);
    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: 'XMind刷新视图需求',
      requirementLabel: 'XMind刷新视图需求',
      requirementLabelSource: 'workspace',
      prep: {
        step: 3,
        requirementMode: 'manual',
        manualRequirementLabel: 'XMind刷新视图需求',
        caseImportMode: 'skip',
        completed: true,
      },
    });
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    const beforeZoomSnapshot = await readXmindCasegenViewSnapshot(page);
    const beforeZoomTransform = parseMindTransformText(beforeZoomSnapshot.transform || '');
    await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-in"]');
    await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-in"]');
    await expect.poll(async () => {
      const snapshot = await readXmindCasegenViewSnapshot(page);
      return parseMindTransformText(snapshot && snapshot.transform ? snapshot.transform : '').scale;
    }).toBeGreaterThan(beforeZoomTransform.scale);
    const panResult = await panXmindCasegenCanvas(page, 180, 120);
    expect(panResult.dispatched).toBeTruthy();
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      if (!map || !map.style) return false;
      return String(map.style.transform || '') !== String(beforeTransform || '');
    }, beforeZoomSnapshot.transform || panResult.before || '', { timeout: 15000 });
    await page.click('#xmindCaseGenMindContainer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    expect(await toggleXmindCasegenNodeCollapse(page, '登录模块')).toBeTruthy();
    await waitForNodeTextAbsent(page, '登录模块-完整-1');
    await page.waitForTimeout(160);
    await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.xmindCaseGen) return;
      state.xmindCaseGen.viewState = state.xmindCaseGen.viewState || {};
      state.xmindCaseGen.viewState.collapsedNodeKeys = ['module::登录模块'];
      state.xmindCaseGen.viewState.updatedAt = Date.now();
      var host = state.xmindCaseGen;
      var activeId = host ? String(host.activeWorkspaceId || '') : '';
      var record = activeId && host && host.workspaces ? host.workspaces[activeId] : null;
      if (record && record.snapshot && record.snapshot.xmind) {
        record.snapshot.xmind.viewState = record.snapshot.xmind.viewState || {};
        record.snapshot.xmind.viewState.collapsedNodeKeys = ['module::登录模块'];
        record.snapshot.xmind.viewState.updatedAt = Date.now();
      }
    });
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    await expect.poll(async () => {
      const snapshot = await readXmindCasegenViewSnapshot(page);
      return snapshot && snapshot.viewState ? snapshot.viewState.collapsedNodeKeys : [];
    }).toContain('module::登录模块');
    await page.evaluate(() => {
      if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
        window.app.persistWorkflowStateNow();
      }
    });

    const beforeReload = await readXmindCasegenViewSnapshot(page);
    expect(beforeReload.activeTab).toBe('casesgen');
    expect(beforeReload.drawerOpen).toBe(true);
    expect(beforeReload.drawerFullscreen).toBe(true);
    expect(beforeReload.transform).not.toBe('');
    expect(parseMindTransformText(beforeReload.transform || '').scale).toBeGreaterThan(beforeZoomTransform.scale);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/xmind-drawer-fullscreen/);
    await expect.poll(async () => {
      return await page.evaluate(() => {
        return {
          bodyOpen: Boolean(document.body && document.body.classList.contains('drawer-open')),
          rootOpen: Boolean(document.documentElement && document.documentElement.classList.contains('drawer-open')),
        };
      });
    }).toEqual({
      bodyOpen: true,
      rootOpen: true,
    });
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');

    await expect.poll(async () => {
      const snapshot = await readXmindCasegenViewSnapshot(page);
      return snapshot && snapshot.viewState
        ? {
            drawerOpen: snapshot.drawerOpen,
            drawerFullscreen: snapshot.drawerFullscreen,
            viewDrawerOpen: snapshot.viewState.drawerOpen,
            viewFullscreen: snapshot.viewState.fullscreen,
            viewTransform: snapshot.viewState.transform,
          }
        : null;
    }).toEqual({
      drawerOpen: true,
      drawerFullscreen: false,
      viewDrawerOpen: true,
      viewFullscreen: false,
      viewTransform: expect.any(String),
    });
    const afterReload = await readXmindCasegenViewSnapshot(page);
    expect(afterReload.activeTab).toBe('casesgen');
    expect(afterReload.drawerOpen).toBe(true);
    expect(afterReload.drawerFullscreen).toBe(false);
    expect(afterReload.transform).not.toBe(beforeReload.transform);
    expect(afterReload.viewState).toBeTruthy();
    expect(afterReload.viewState.drawerOpen).toBe(true);
    expect(afterReload.viewState.fullscreen).toBe(false);
    expect(afterReload.viewState.transform).not.toBe(beforeReload.transform);
    expect(afterReload.viewState.collapsedNodeKeys).toContain('module::登录模块');
  });

  test('全屏展示抽屉在较大 XMind 结构下刷新页面，会恢复为非全屏且不会无响应', async ({ page }) => {
    test.setTimeout(60000);
    const token = 'token-xmind-refresh-fullscreen-large-tree';
    const user = { id: 612, username: 'demo_user_refresh_fullscreen_large', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    const modules = [];
    const casesByModuleId = {};
    for (let i = 1; i <= 12; i += 1) {
      const moduleId = `xmind-large-mod-${i}`;
      const moduleTitle = `大型模块-${i}`;
      modules.push({
        id: moduleId,
        title: moduleTitle,
        scenarios: [`${moduleTitle}主场景`],
        points: [`${moduleTitle}关键校验`],
        coupled: i % 2 === 0 ? ['公共能力'] : ['外部依赖'],
      });
      casesByModuleId[moduleId] = [];
      for (let j = 1; j <= 5; j += 1) {
        casesByModuleId[moduleId].push({
          module: moduleTitle,
          title: `${moduleTitle}-用例-${j}`,
          priority: j === 1 ? 'P0' : 'P1',
          preconditions: `${moduleTitle}前置条件-${j}`,
          steps: [
            `1、进入${moduleTitle}`,
            `2、执行${moduleTitle}操作-${j}`,
            `3、校验${moduleTitle}结果-${j}`,
          ],
          expected: `${moduleTitle}结果-${j}正确`,
        });
      }
    }

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await openXmindCaseGenDrawer(page);
    await seedDocumentRequirement(page, {
      text: '需求：验证 XMind 用例生成抽屉在全屏且节点较多时刷新页面，不会导致页面恢复无响应。',
      requirementLabel: 'XMind全屏刷新稳定性需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await seedAiSkeleton(page, modules);
    await seedAiCases(page, casesByModuleId);
    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: 'XMind全屏刷新稳定性需求',
      requirementLabel: 'XMind全屏刷新稳定性需求',
      requirementLabelSource: 'ui-test',
      lastRawImportName: 'xmind-fullscreen-refresh.docx',
      prep: {
        step: 3,
        requirementMode: 'document',
        caseImportMode: 'skip',
        completed: true,
      },
    });
    await waitForNodeText(page, '大型模块-1');
    await waitForNodeText(page, '大型模块-12');
    await page.click('#xmindCaseGenMindContainer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 25000 });
    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/xmind-drawer-fullscreen/);
    await expect.poll(async () => {
      return await page.evaluate(() => {
        var state = window.app && window.app.state && window.app.state.xmindCaseGen
          ? window.app.state.xmindCaseGen
          : null;
        return Boolean(state && state.viewState && state.viewState.fullscreen === true);
      });
    }).toBe(false);
    await waitForNodeText(page, '大型模块-1');
    await waitForNodeText(page, '大型模块-12');
    await page.click('#xmindCaseGenMindContainer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    await page.click('#xmindCaseGenMindContainer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/xmind-drawer-fullscreen/);
  });

  test('非全屏恢复后的 XMind 抽屉可以正常关闭且不会自动重开', async ({ page }) => {
    const token = 'token-xmind-refresh-close-stays-closed';
    const user = { id: 9031, username: 'xmind-refresh-close-stays-closed', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    const modules = [{
      id: 'xmind-close-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }];
    const casesByModuleId = {
      'xmind-close-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
    };

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 120);
    await openXmindCaseGenDrawer(page);
    await createXmindWorkspaceByManualPrep(page, 'XMind关闭恢复需求', '需求：刷新恢复后的非全屏抽屉需要支持正常关闭且不会自动重开。', {
      completePrep: true,
    });
    await seedAiSkeleton(page, modules);
    await seedAiCases(page, casesByModuleId);
    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: 'XMind关闭恢复需求',
      requirementLabel: 'XMind关闭恢复需求',
      requirementLabelSource: 'workspace',
      prep: {
        step: 3,
        requirementMode: 'manual',
        manualRequirementLabel: 'XMind关闭恢复需求',
        caseImportMode: 'skip',
        completed: true,
      },
    });
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '登录成功校验');
    await page.evaluate(() => {
      if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
        window.app.persistWorkflowStateNow();
      }
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/xmind-drawer-fullscreen/);
    await page.locator('#closeXmindCaseGenDrawerBtn').click({ force: true });
    await waitXmindDrawerClosedStable(page);
    await page.waitForTimeout(900);
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);
    await expect.poll(async () => {
      return await page.evaluate(() => {
        return {
          bodyOpen: Boolean(document.body && document.body.classList.contains('drawer-open')),
          rootOpen: Boolean(document.documentElement && document.documentElement.classList.contains('drawer-open')),
        };
      });
    }).toEqual({
      bodyOpen: false,
      rootOpen: false,
    });
  });

  test('刷新前未打开 XMind 用例生成抽屉时，刷新后不会自动打开', async ({ page }) => {
    const token = 'token-xmind-refresh-closed-stays-closed';
    const user = { id: 8026, username: 'xmind-refresh-closed-stays-closed', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    const routeCtl = await installXmindProxyRoute(page, {
      delaysMs: [1800, 120],
      responseText: JSON.stringify({
        modules: [{
          module: '登录模块',
          key_scenarios: ['账号登录'],
          test_points: ['登录成功'],
          coupled_modules: [],
        }],
      }),
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);
    await createXmindWorkspaceByManualPrep(page, '刷新关闭保持关闭需求', '需求：刷新前关闭 XMind 抽屉，刷新后不应自动重开。', {
      completePrep: true,
      useExistingWorkspace: true,
    });
    await waitForNodeText(page, '刷新关闭保持关闭需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeStatus(page, '刷新关闭保持关闭需求', '生成中');
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(1);
    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);
    await expect.poll(async () => {
      return await page.evaluate(() => {
        var list = JSON.parse(localStorage.getItem('tap-xmind-casegen-tasks') || '[]');
        var task = Array.isArray(list) && list.length ? list[0] : null;
        return Boolean(
          task
          && task.restoreContext
          && task.restoreContext.viewState
          && task.restoreContext.viewState.drawerOpen === false
        );
      });
    }).toBe(true);

    await page.evaluate(() => {
      if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
        window.app.persistWorkflowStateNow();
      }
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(1200);

    const afterReload = await page.evaluate(() => {
      var drawer = document.getElementById('xmindCaseGenDrawer');
      var state = window.app && window.app.state ? window.app.state : null;
      var xmind = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      return {
        drawerOpen: Boolean(drawer && drawer.classList && drawer.classList.contains('open')),
        activeTab: state ? String(state.activeTab || '') : '',
        viewDrawerOpen: Boolean(xmind && xmind.viewState && xmind.viewState.drawerOpen === true),
        workspaceCount: xmind && Array.isArray(xmind.workspaceOrder) ? xmind.workspaceOrder.length : 0,
        activeWorkspaceId: xmind ? String(xmind.activeWorkspaceId || '') : '',
      };
    });

    expect(afterReload.activeTab).toBe('casesgen');
    expect(afterReload.drawerOpen).toBe(false);
    expect(afterReload.viewDrawerOpen).toBe(false);
    expect(afterReload.workspaceCount).toBe(1);
    expect(afterReload.activeWorkspaceId).not.toBe('');
  });

  test('关闭抽屉后若缓存残留旧的终态恢复意图，刷新后仍保持关闭', async ({ page }) => {
    const token = 'token-xmind-closed-terminal-restore-ignored';
    const user = { id: 8027, username: 'xmind-closed-terminal-restore-ignored', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);
    await createXmindWorkspaceByManualPrep(page, '终态脏恢复忽略需求', '需求：关闭抽屉后，终态旧缓存不应再把抽屉重新拉开。', {
      completePrep: true,
      useExistingWorkspace: true,
    });
    await waitForNodeText(page, '终态脏恢复忽略需求');
    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);

    const injected = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      var workspaceId = host ? String(host.activeWorkspaceId || '') : '';
      var viewState = host && host.viewState ? host.viewState : null;
      var staleUpdatedAt = Math.max(1, Number(viewState && viewState.updatedAt || 0) - 1000);
      var staleTask = {
        id: 'xmind-terminal-stale-restore',
        status: 'done',
        scope: 'root',
        workspaceId: workspaceId,
        actionId: 'root-full-modules',
        createdAt: staleUpdatedAt,
        updatedAt: staleUpdatedAt,
        endedAt: staleUpdatedAt,
        restoreContext: {
          workspaceId: workspaceId,
          requirementLabel: '终态脏恢复忽略需求',
          requirementLabelSource: 'manual',
          rawText: '需求：关闭抽屉后，终态旧缓存不应再把抽屉重新拉开。',
          caseGenModules: [],
          rootPipeline: null,
          prep: host && host.prep ? JSON.parse(JSON.stringify(host.prep)) : {},
          viewState: {
            drawerOpen: true,
            fullscreen: false,
            transform: 'translate(12px, 8px) scale(1)',
            scaleVal: 1,
            scrollLeft: 0,
            scrollTop: 0,
            hasManualViewport: true,
            collapsedNodeKeys: [],
            treeSourceSignature: String(host && host.treeSourceSignature || ''),
            updatedAt: staleUpdatedAt,
          },
        },
      };
      localStorage.setItem('tap-xmind-casegen-tasks', JSON.stringify([staleTask]));
      if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
        window.app.persistWorkflowStateNow();
      }
      return {
        workspaceId: workspaceId,
        viewUpdatedAt: Number(viewState && viewState.updatedAt || 0),
        staleUpdatedAt: staleUpdatedAt,
      };
    });

    expect(injected.workspaceId).toBeTruthy();
    expect(injected.viewUpdatedAt).toBeGreaterThan(injected.staleUpdatedAt);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await expect(page.locator('section[data-section-id="casesgen"]')).toBeVisible();
    await page.waitForTimeout(800);

    const afterReload = await page.evaluate(() => {
      var drawer = document.getElementById('xmindCaseGenDrawer');
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      var tasks = [];
      try {
        tasks = JSON.parse(localStorage.getItem('tap-xmind-casegen-tasks') || '[]');
      } catch (err) {
        tasks = [];
      }
      return {
        drawerOpen: Boolean(drawer && drawer.classList && drawer.classList.contains('open')),
        liveViewDrawerOpen: Boolean(host && host.viewState && host.viewState.drawerOpen === true),
        taskDrawerOpenCount: (Array.isArray(tasks) ? tasks : []).filter(function(item) {
          return Boolean(
            item
            && item.restoreContext
            && item.restoreContext.viewState
            && item.restoreContext.viewState.drawerOpen === true
          );
        }).length,
      };
    });

    expect(afterReload.drawerOpen).toBe(false);
    expect(afterReload.liveViewDrawerOpen).toBe(false);
    expect(afterReload.taskDrawerOpenCount).toBe(0);
  });

  test('工具栏支持查看生成记录，并展示根节点与模块节点的生成摘要', async ({ page }) => {
    const token = 'token-xmind-history';
    const user = { id: 21, username: 'demo_user_history', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：需要记录 XMind 根节点和模块节点的生成历史。',
      requirementLabel: 'XMind生成记录需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    expect(await page.evaluate(() => {
      return {
        summaryInLeading: Boolean(document.querySelector('#xmindCaseGenMindContainer .xmind-controls-leading-host #xmindCaseGenSummaryBtn')),
        overviewVisible: Boolean(document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-inline-overview]')),
        historyVisible: Boolean(document.querySelector('#xmindCaseGenMindContainer #xmindCaseGenHistoryBtn')),
        dedupeVisible: Boolean(document.querySelector('#xmindCaseGenMindContainer #xmindCaseGenDedupeBtn')),
        coverageVisible: Boolean(document.querySelector('#xmindCaseGenMindContainer #xmindCaseGenCoverageBtn')),
        storeVisible: Boolean(document.querySelector('#xmindCaseGenMindContainer #xmindCaseGenStoreBtn')),
        deleteUndoVisible: Boolean(document.querySelector('#xmindCaseGenMindContainer #xmindCaseGenDeleteUndoBtn')),
        deleteRedoVisible: Boolean(document.querySelector('#xmindCaseGenMindContainer #xmindCaseGenDeleteRedoBtn')),
        exportVisible: Boolean(document.querySelector('#xmindCaseGenMindContainer #xmindCaseGenExportBtn')),
        exportMarkdownVisible: Boolean(document.querySelector('#xmindCaseGenMindContainer #xmindCaseGenExportMarkdownBtn')),
      };
    })).toEqual({
      summaryInLeading: true,
      overviewVisible: true,
      historyVisible: true,
      dedupeVisible: true,
      coverageVisible: true,
      storeVisible: true,
      deleteUndoVisible: true,
      deleteRedoVisible: true,
      exportVisible: true,
      exportMarkdownVisible: true,
    });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogTitle')).toHaveText('生成记录');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('暂无生成记录');
    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).not.toHaveClass(/is-open/);

    await openNodeContextMenu(page, 'XMind生成记录需求');
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    await expect(page.locator('.xmind-casegen-history-card')).toHaveCount(2);

    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('模块节点 · 登录模块');
    await expect(latestCard).toContainText('生成全量用例');
    await expect(latestCard).toContainText('生成模块 1 个');
    await expect(latestCard).toContainText('登录模块');
    await expect(latestCard).toContainText('2 条用例');

    const previousCard = page.locator('.xmind-casegen-history-card').nth(1);
    await expect(previousCard).toContainText('根节点 · XMind生成记录需求');
    await expect(previousCard).toContainText('生成全量模块');
    await expect(previousCard).toContainText('生成模块 2 个');
    await expect(previousCard).toContainText('登录模块');
    await expect(previousCard).toContainText('支付模块');
    await expect(previousCard).toContainText('0 条用例');
  });

  test('需求覆盖按钮会调用模型并按原文片段展示对应用例', async ({ page }) => {
    const token = 'token-xmind-requirement-coverage';
    const user = { id: 227, username: 'demo_user_requirement_coverage', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 1500);
    const coverageRequirementLines = [
        '1. 用户登录成功后进入首页',
        '2. 用户登录失败时展示错误提示',
        '3. 用户可以退出登录',
        '4. 用户登录成功后首页展示欢迎语',
      ].concat(Array.from({ length: 24 }, function(_, index) {
        return String(index + 5) + '. 补充检查项 ' + String(index + 1) + ' 需要在需求覆盖视图中保持原文阅读连续性';
      }));
    await seedDocumentRequirement(page, {
      text: coverageRequirementLines.join('\n'),
      requirementLabel: 'XMind需求覆盖需求',
      imageCount: 1,
      imageBytes: ONE_PIXEL_PNG,
      imageTextOffsets: [coverageRequirementLines[0].length + 1],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await openXmindCaseGenDrawer(page);
    await seedAiSkeleton(page, [{
      id: 'xmind-coverage-login',
      title: '登录模块',
      scenarios: ['登录主流程'],
      points: ['成功和失败提示'],
      coupled: [],
    }]);
    await seedAiCases(page, {
      'xmind-coverage-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入正确账号密码'],
        expected: '进入首页',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码'],
        expected: '展示错误提示',
      }, {
        module: '登录模块',
        title: '登录会话清理关联检查',
        priority: 'P2',
        preconditions: '账号已登录',
        steps: ['1、刷新会话状态', '2、检查登录态清理结果'],
        expected: '会话状态正确收敛',
      }],
    });

    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: 'XMind需求覆盖需求',
      requirementLabel: 'XMind需求覆盖需求',
      requirementLabelSource: 'ui-test',
      lastRawImportName: 'xmind-requirement.docx',
      rawText: coverageRequirementLines.join('\n'),
      prep: {
        step: 3,
        requirementMode: 'document',
        caseImportMode: 'skip',
        completed: true,
      },
    });
    await expect(page.locator('#xmindCaseGenCoverageBtn')).toBeEnabled();
    await clickElementById(page, 'xmindCaseGenCoverageBtn');
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogTitle')).toHaveText('需求覆盖');
    await expect(page.locator('#xmindCaseGenSummaryDialog')).toHaveClass(/xmind-casegen-coverage-dialog/);
    await expect(page.locator('#xmindCaseGenCoverageBtn')).toHaveClass(/is-running/);
    await expect(page.locator('#xmindCaseGenCoverageBtn')).toContainText('分析中');
    await expect(page.locator('#xmindCaseGenCoverageBtn .xmind-casegen-coverage-spinner')).toHaveCount(1);
    await expect(page.locator('.xmind-casegen-coverage-notice.is-running .xmind-casegen-coverage-spinner')).toHaveCount(1);
    await expect(page.locator('.xmind-casegen-coverage-reanalyze.is-running .xmind-casegen-coverage-spinner')).toHaveCount(1);
    const coverageSpinnerStyle = await page.evaluate(() => {
      var spinner = document.querySelector('.xmind-casegen-coverage-notice.is-running .xmind-casegen-coverage-spinner');
      var style = spinner && typeof getComputedStyle === 'function' ? getComputedStyle(spinner) : null;
      return {
        transformableDisplay: style ? String(style.display || '') !== 'inline' : false,
        boxSizing: style ? String(style.boxSizing || '') : '',
        animationName: style ? String(style.animationName || '') : '',
        width: style ? String(style.width || '') : '',
        height: style ? String(style.height || '') : '',
      };
    });
    expect(coverageSpinnerStyle).toEqual({
      transformableDisplay: true,
      boxSizing: 'border-box',
      animationName: 'xmindCasegenToolbarSpin',
      width: '14px',
      height: '14px',
    });
    await expect(page.locator('.xmind-casegen-coverage-segment')).toHaveCount(coverageRequirementLines.length);
    await expect(page.locator('.xmind-casegen-coverage-segment-list')).toHaveClass(/xmind-casegen-coverage-document/);
    await expect(page.locator('.xmind-casegen-coverage-image')).toHaveCount(1);
    await expect(page.locator('.xmind-casegen-coverage-image figcaption')).toHaveText('需求图片 1');
    await expect(page.locator('.xmind-casegen-coverage-image img')).toHaveAttribute('src', /^blob:/);
    const mediaOrder = await page.evaluate(() => {
      var article = document.querySelector('.xmind-casegen-coverage-segment-list');
      if (!article) return [];
      return Array.prototype.slice.call(article.children || []).map(function(node) {
        if (node && node.matches && node.matches('.xmind-casegen-coverage-image')) return 'image';
        if (node && node.getAttribute) return String(node.getAttribute('data-coverage-segment') || '');
        return String(node && node.tagName || '');
      });
    });
    expect(mediaOrder.slice(0, 3)).toEqual(['REQ-001', 'image', 'REQ-002']);
    await expect(page.locator('.xmind-casegen-coverage-source-legend')).toContainText('已覆盖 3');
    await expect(page.locator('.xmind-casegen-coverage-source-legend')).toContainText('部分覆盖 1');
    await expect(page.locator('.xmind-casegen-coverage-source-legend')).toContainText('未覆盖 24');
    await expect(page.locator('.xmind-casegen-coverage-source-legend')).toContainText('上下文 0');
    await expect(page.locator('.xmind-casegen-coverage-segment.is-partial').filter({ hasText: '退出登录' })).toHaveCount(1);
    const coverageStatusStyles = await page.evaluate(() => {
      function readStyle(selector) {
        var node = document.querySelector(selector);
        var style = node && typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
        return style ? {
          backgroundColor: String(style.backgroundColor || ''),
          borderColor: String(style.borderColor || ''),
          color: String(style.color || ''),
          textDecorationLine: String(style.textDecorationLine || ''),
          textDecorationStyle: String(style.textDecorationStyle || ''),
        } : null;
      }
      function findSegment(text) {
        return Array.prototype.slice.call(document.querySelectorAll('.xmind-casegen-coverage-segment')).filter(function(item) {
          return String(item.textContent || '').indexOf(text) !== -1;
        })[0] || null;
      }
      function readSegment(text) {
        var node = findSegment(text);
        var style = node && typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
        return style ? {
          display: String(style.display || ''),
          backgroundColor: String(style.backgroundColor || ''),
          color: String(style.color || ''),
          textDecorationLine: String(style.textDecorationLine || ''),
          textDecorationStyle: String(style.textDecorationStyle || ''),
          status: String(node.getAttribute('data-coverage-status') || ''),
        } : null;
      }
      var uncovered = findSegment('补充检查项 20');
      return {
        summary: {
          covered: readStyle('.xmind-casegen-coverage-summary-jump.is-covered'),
          partial: readStyle('.xmind-casegen-coverage-summary-jump.is-partial'),
          uncovered: readStyle('.xmind-casegen-coverage-summary-jump.is-uncovered'),
          context: readStyle('.xmind-casegen-coverage-summary-jump.is-context'),
        },
        legend: {
          covered: readStyle('.xmind-casegen-coverage-source-legend-item.is-covered'),
          partial: readStyle('.xmind-casegen-coverage-source-legend-item.is-partial'),
          uncovered: readStyle('.xmind-casegen-coverage-source-legend-item.is-uncovered'),
          context: readStyle('.xmind-casegen-coverage-source-legend-item.is-context'),
        },
        segment: {
          covered: readSegment('登录成功'),
          partial: readSegment('退出登录'),
          uncovered: readSegment('补充检查项 20'),
        },
        uncoveredSelectedText: uncovered ? String(uncovered.textContent || '') : '',
      };
    });
    expect(coverageStatusStyles.summary.covered).toBeTruthy();
    expect(coverageStatusStyles.summary.partial).toBeTruthy();
    expect(coverageStatusStyles.summary.uncovered).toBeTruthy();
    expect(coverageStatusStyles.summary.context).toBeTruthy();
    expect(new Set([
      coverageStatusStyles.summary.covered.backgroundColor,
      coverageStatusStyles.summary.partial.backgroundColor,
      coverageStatusStyles.summary.uncovered.backgroundColor,
      coverageStatusStyles.summary.context.backgroundColor,
    ]).size).toBe(4);
    expect(new Set([
      coverageStatusStyles.legend.covered.backgroundColor,
      coverageStatusStyles.legend.partial.backgroundColor,
      coverageStatusStyles.legend.uncovered.backgroundColor,
      coverageStatusStyles.legend.context.backgroundColor,
    ]).size).toBe(4);
    expect(coverageStatusStyles.segment.covered.display).toBe('inline');
    expect(coverageStatusStyles.segment.covered.status).toBe('covered');
    expect(coverageStatusStyles.segment.partial.status).toBe('partial');
    expect(coverageStatusStyles.segment.uncovered.status).toBe('uncovered');
    expect(coverageStatusStyles.segment.covered.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(coverageStatusStyles.segment.partial.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(coverageStatusStyles.segment.uncovered.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(new Set([
      coverageStatusStyles.segment.covered.backgroundColor,
      coverageStatusStyles.segment.partial.backgroundColor,
      coverageStatusStyles.segment.uncovered.backgroundColor,
    ]).size).toBe(3);
    expect(coverageStatusStyles.segment.covered.textDecorationLine).toContain('underline');
    expect(coverageStatusStyles.segment.partial.textDecorationLine).toContain('underline');
    expect(coverageStatusStyles.segment.partial.textDecorationStyle).toBe('dashed');
    expect(coverageStatusStyles.segment.uncovered.textDecorationLine).toContain('underline');
    expect(coverageStatusStyles.uncoveredSelectedText).toContain('补充检查项 20');
    const documentTextStyle = await page.evaluate(() => {
      var target = Array.prototype.slice.call(document.querySelectorAll('.xmind-casegen-coverage-segment')).filter(function(item) {
        return String(item.textContent || '').indexOf('补充检查项 20') !== -1;
      })[0];
      var covered = Array.prototype.slice.call(document.querySelectorAll('.xmind-casegen-coverage-segment')).filter(function(item) {
        return String(item.textContent || '').indexOf('登录成功') !== -1;
      })[0];
      if (!target || typeof getComputedStyle !== 'function') return null;
      var style = getComputedStyle(target);
      var coveredStyle = covered ? getComputedStyle(covered) : null;
      return {
        display: style.display,
        backgroundColor: style.backgroundColor,
        textDecorationLine: style.textDecorationLine,
        coveredStatus: covered ? String(covered.getAttribute('data-coverage-status') || '') : '',
        coveredTextDecorationLine: coveredStyle ? String(coveredStyle.textDecorationLine || '') : '',
      };
    });
    expect(documentTextStyle).toBeTruthy();
    expect(documentTextStyle.display).toBe('inline');
    expect(documentTextStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(documentTextStyle.textDecorationLine).toContain('underline');
    expect(documentTextStyle.coveredStatus).toBe('covered');
    expect(documentTextStyle.coveredTextDecorationLine).toContain('underline');
    await expect(page.locator('.xmind-casegen-coverage-selected-card')).toContainText('补充检查项 1');
    await expect(page.locator('.xmind-casegen-coverage-cases')).toContainText('暂未找到直接或关联对应的用例');

    await page.locator('[data-coverage-summary] [data-coverage-jump="covered"]').click();
    await expect(page.locator('.xmind-casegen-coverage-selected-card')).toContainText('登录成功');
    await page.locator('.xmind-casegen-coverage-segment.is-active').filter({ hasText: '登录成功' }).click();
    await expect(page.locator('.xmind-casegen-coverage-selected-card')).toContainText('登录成功');
    await page.locator('[data-coverage-summary] [data-coverage-jump="covered"]').click();
    await expect(page.locator('.xmind-casegen-coverage-selected-card')).toContainText('登录失败');
    await page.locator('[data-coverage-summary] [data-coverage-jump="partial"]').click();
    await expect(page.locator('.xmind-casegen-coverage-selected-card')).toContainText('退出登录');
    await expect(page.locator('.xmind-casegen-coverage-case-list')).toContainText('登录会话清理关联检查');
    await expect(page.locator('.xmind-casegen-coverage-case.is-related')).toContainText('关联');
    await page.locator('.xmind-casegen-coverage-case.is-related').click();
    await expect(page.locator('.xmind-casegen-coverage-segment.is-case-highlighted')).toContainText('退出登录');
    await page.locator('.xmind-casegen-coverage-source-legend [data-coverage-jump="uncovered"]').click();
    await expect(page.locator('.xmind-casegen-coverage-selected-card')).toContainText('补充检查项 1');

    await page.locator('.xmind-casegen-coverage-segment').filter({ hasText: '用户登录成功后进入首页' }).click();
    await expect(page.locator('.xmind-casegen-coverage-case-list')).toContainText('登录模块');
    await expect(page.locator('.xmind-casegen-coverage-case-list')).toContainText('登录成功校验');
    await expect(page.locator('.xmind-casegen-coverage-case-list')).not.toContainText('登录失败提示');
    await page.locator('.xmind-casegen-coverage-case').filter({ hasText: '登录成功校验' }).click();
    await expect(page.locator('.xmind-casegen-coverage-selected-card')).toContainText('用例关联片段');
    await expect(page.locator('.xmind-casegen-coverage-selected-item')).toHaveCount(2);
    await expect(page.locator('.xmind-casegen-coverage-selected-item').filter({ hasText: '用户登录成功后进入首页' })).toHaveClass(/is-active/);
    await expect(page.locator('.xmind-casegen-coverage-selected-item')).toContainText(['用户登录成功后进入首页', '用户登录成功后首页展示欢迎语']);
    await page.locator('.xmind-casegen-coverage-selected-item').filter({ hasText: '用户登录成功后首页展示欢迎语' }).click();
    await expect(page.locator('.xmind-casegen-coverage-segment.is-active')).toContainText('用户登录成功后首页展示欢迎语');
    await expect(page.locator('.xmind-casegen-coverage-case.is-active')).toContainText('登录成功校验');
    await expect(page.locator('.xmind-casegen-coverage-segment.is-case-highlighted')).toHaveCount(2);
    await expect(page.locator('.xmind-casegen-coverage-segment.is-case-highlighted')).toContainText([
      '用户登录成功后进入首页',
      '用户登录成功后首页展示欢迎语',
    ]);

    const scrollState = await page.evaluate(() => {
      var scroller = document.querySelector('[data-coverage-source-scroll]');
      var target = Array.prototype.slice.call(document.querySelectorAll('.xmind-casegen-coverage-segment')).filter(function(item) {
        return String(item.textContent || '').indexOf('补充检查项 20') !== -1;
      })[0];
      if (!scroller || !target) return { before: 0, after: 0 };
      target.scrollIntoView({ block: 'center' });
      var before = Number(scroller.scrollTop || 0);
      var beforeScrollerRect = scroller.getBoundingClientRect();
      var beforeTargetRect = target.getBoundingClientRect();
      var beforeOffsetTop = beforeTargetRect.top - beforeScrollerRect.top;
      target.click();
      var nextScroller = document.querySelector('[data-coverage-source-scroll]');
      var nextTarget = Array.prototype.slice.call(document.querySelectorAll('.xmind-casegen-coverage-segment')).filter(function(item) {
        return String(item.textContent || '').indexOf('补充检查项 20') !== -1;
      })[0];
      var scrollerRect = nextScroller && nextScroller.getBoundingClientRect ? nextScroller.getBoundingClientRect() : null;
      var targetRect = nextTarget && nextTarget.getBoundingClientRect ? nextTarget.getBoundingClientRect() : null;
      var selectedCard = document.querySelector('.xmind-casegen-coverage-selected-card');
      return {
        before: before,
        after: nextScroller ? Number(nextScroller.scrollTop || 0) : 0,
        offsetDelta: scrollerRect && targetRect ? Math.abs((targetRect.top - scrollerRect.top) - beforeOffsetTop) : 999,
        targetVisible: Boolean(scrollerRect && targetRect && targetRect.top >= scrollerRect.top && targetRect.bottom <= scrollerRect.bottom),
        selectedText: selectedCard ? String(selectedCard.textContent || '') : '',
      };
    });
    expect(scrollState.before).toBeGreaterThan(0);
    expect(scrollState.after).toBeGreaterThan(0);
    expect(scrollState.offsetDelta).toBeLessThan(8);
    expect(scrollState.targetVisible).toBe(true);
    expect(scrollState.selectedText).toContain('补充检查项 20');

    const requestInfo = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      var latest = null;
      for (var i = calls.length - 1; i >= 0; i -= 1) {
        if (calls[i] && calls[i].contract && String(calls[i].contract.mode || '') === 'requirement_coverage') {
          latest = calls[i];
          break;
        }
      }
      function parseJsonText(text) {
        var raw = String(text || '').trim();
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {}
        return null;
      }
      function extractSection(text, marker) {
        var source = String(text || '');
        var index = source.indexOf(marker);
        if (index === -1) return '';
        var rest = source.slice(index + marker.length);
        var next = rest.indexOf('\n\n【');
        if (next !== -1) rest = rest.slice(0, next);
        return String(rest || '').trim();
      }
      return latest ? {
        contract: latest.contract || {},
        prompt: String(latest.prompt || ''),
        user: String(latest.user || ''),
        segments: parseJsonText(extractSection(latest.user, '【需求片段(JSON)】')) || [],
        cases: parseJsonText(extractSection(latest.user, '【当前可见用例(JSON)】')) || [],
      } : null;
    });
    expect(requestInfo).toBeTruthy();
    expect(requestInfo.contract.mode).toBe('requirement_coverage');
    expect(requestInfo.contract.direct_requirement_coverage_only).toBe(false);
    expect(requestInfo.contract.include_related_requirement_cases).toBe(true);
    expect(requestInfo.contract.relation_scope).toBe('direct_and_related_requirement_cases');
    expect(requestInfo.prompt).toContain('直接覆盖和关联对应关系');
    expect(requestInfo.prompt).toContain('relatedCaseIds');
    expect(requestInfo.user).toContain('【需求原文完整文本】');
    expect(requestInfo.segments).toHaveLength(coverageRequirementLines.length);
    expect(requestInfo.cases).toHaveLength(3);
    expect(requestInfo.cases[0].caseId).toBe('TC-001');
  });

  test('需求覆盖结果按签名缓存，用例变化后提示重新分析', async ({ page }) => {
    const token = 'token-xmind-coverage-cache';
    const user = { id: 228, username: 'demo_user_coverage_cache', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 70);
    await seedDocumentRequirement(page, {
      text: [
        '1. 用户登录成功后进入首页',
        '2. 用户登录失败时展示错误提示',
      ].join('\n'),
      requirementLabel: 'XMind覆盖缓存需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await openXmindCaseGenDrawer(page);
    await seedAiSkeleton(page, [{
      id: 'xmind-coverage-cache-login',
      title: '登录模块',
      scenarios: ['登录主流程'],
      points: ['成功和失败提示'],
      coupled: [],
    }]);
    await seedAiCases(page, {
      'xmind-coverage-cache-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入正确账号密码'],
        expected: '进入首页',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码'],
        expected: '展示错误提示',
      }],
    });

    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: 'XMind覆盖缓存需求',
      requirementLabel: 'XMind覆盖缓存需求',
      requirementLabelSource: 'ui-test',
      lastRawImportName: 'xmind-coverage-cache.docx',
      rawText: [
        '1. 用户登录成功后进入首页',
        '2. 用户登录失败时展示错误提示',
      ].join('\n'),
      prep: {
        step: 3,
        requirementMode: 'document',
        caseImportMode: 'skip',
        completed: true,
      },
    });
    await clickElementById(page, 'xmindCaseGenCoverageBtn');
    await expect(page.locator('.xmind-casegen-coverage-summary')).toContainText('需求覆盖');
    await expect.poll(async () => {
      return page.evaluate(() => {
        var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
        return calls.filter(function(item) {
          return item && item.contract && String(item.contract.mode || '') === 'requirement_coverage';
        }).length;
      });
    }).toBe(1);

    await clickElementById(page, 'xmindCaseGenSummaryCloseBtn');
    await clickElementById(page, 'xmindCaseGenCoverageBtn');
    await expect(page.locator('.xmind-casegen-coverage-summary')).toContainText('需求覆盖');
    expect(await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      return calls.filter(function(item) {
        return item && item.contract && String(item.contract.mode || '') === 'requirement_coverage';
      }).length;
    })).toBe(1);

    await clickElementById(page, 'xmindCaseGenSummaryCloseBtn');
    await seedAiCases(page, {
      'xmind-coverage-cache-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入正确账号密码'],
        expected: '进入首页',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码'],
        expected: '展示错误提示',
      }, {
        module: '登录模块',
        title: '登录安全扩展校验',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、触发安全校验'],
        expected: '安全校验正常',
      }],
    });
    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: 'XMind覆盖缓存需求',
      requirementLabel: 'XMind覆盖缓存需求',
      requirementLabelSource: 'ui-test',
      lastRawImportName: 'xmind-coverage-cache.docx',
      rawText: [
        '1. 用户登录成功后进入首页',
        '2. 用户登录失败时展示错误提示',
      ].join('\n'),
      prep: {
        step: 3,
        requirementMode: 'document',
        caseImportMode: 'skip',
        completed: true,
      },
    });
    await clickElementById(page, 'xmindCaseGenCoverageBtn');
    await expect(page.locator('.xmind-casegen-coverage-notice.is-stale')).toContainText('已变化');
    await expect(page.locator('.xmind-casegen-coverage-reanalyze')).toHaveText('重新分析');
    expect(await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      return calls.filter(function(item) {
        return item && item.contract && String(item.contract.mode || '') === 'requirement_coverage';
      }).length;
    })).toBe(1);

    await page.locator('.xmind-casegen-coverage-reanalyze').click();
    await expect.poll(async () => {
      return page.evaluate(() => {
        var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
        return calls.filter(function(item) {
          return item && item.contract && String(item.contract.mode || '') === 'requirement_coverage';
        }).length;
      });
    }).toBe(2);
    await expect(page.locator('.xmind-casegen-coverage-notice.is-stale')).toHaveCount(0);
  });

  test('右上角模块用例统计会展示最近一次去重条数', async ({ page }) => {
    const token = 'token-xmind-dedupe-overview';
    const user = { id: 229, username: 'demo_user_dedupe_overview', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：右上角统计区需要同时展示模块数、用例数和最近一次去重条数。',
      requirementLabel: 'XMind去重统计需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await openXmindCaseGenDrawer(page);
    await seedAiSkeleton(page, [{
      id: 'xmind-dedupe-overview-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: [],
    }]);
    await seedAiCases(page, {
      'xmind-dedupe-overview-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入正确账号密码'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码'],
        expected: '展示错误提示',
      }],
    });
    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: 'XMind去重统计需求',
      requirementLabel: 'XMind去重统计需求',
      requirementLabelSource: 'ui-test',
      lastRawImportName: 'xmind-dedupe-overview.docx',
      rawText: '需求：右上角统计区需要同时展示模块数、用例数和最近一次去重条数。',
      prep: {
        step: 3,
        requirementMode: 'document',
        caseImportMode: 'skip',
        completed: true,
      },
    });
    await page.evaluate(() => {
      var app = window.app || {};
      var state = app.state || {};
      state.xmindCaseGen = state.xmindCaseGen || {};
      state.xmindCaseGen.dedupe = state.xmindCaseGen.dedupe || {};
      state.xmindCaseGen.dedupe.lastResult = {
        status: 'done',
        dedupeMode: 'dedupe_simplify',
        beforeCount: 5,
        afterCount: 2,
        removedCount: 3,
        moduleCount: 1,
        diagnostics: ['AI 用例去重精简完成，已去重精简 3 条用例'],
        dedupeRecords: [],
        updatedAt: Date.now(),
      };
      if (app.xmindCasegenApi && typeof app.xmindCasegenApi.render === 'function') {
        app.xmindCasegenApi.render({ reason: 'ui-test-dedupe-overview', persist: false });
      }
    });

    await expect.poll(async () => await readXmindToolbarOverview(page)).toMatchObject({
      state: 'idle',
      label: '当前没有生成任务',
      modules: 1,
      cases: 2,
      dedupeRemoved: 3,
    });
    await expect(page.locator('#xmindCaseGenMindContainer [data-xmind-casegen-count-dedupe]')).toHaveText(/去重\s*3\s*条/);
    await expect(page.locator('#xmindCaseGenMindContainer [data-xmind-casegen-count-dedupe]')).toHaveAttribute('title', /最近一次 AI 用例去重并精简移除 3 条用例/);
  });

  test('全量生成完成后会进入 AI 去重精简中，并按精简后的可见用例数刷新状态', async ({ page }) => {
    const token = 'token-xmind-auto-dedupe';
    const user = { id: 223, username: 'demo_user_auto_dedupe', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 80);
    await page.evaluate(() => {
      window.__xmindCasegenDedupeTrim = true;
      window.__xmindCasegenDedupeDelayMs = 900;
    });
    await seedDocumentRequirement(page, {
      text: '需求：登录和支付需要完整覆盖，自动去重时必须参考原始需求。',
      requirementLabel: 'XMind自动去重需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      requirementSupplement: '补充：保留关键异常提示覆盖。',
      caseImportMode: 'skip',
      completed: true,
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-old-login',
      title: '旧登录模块',
      scenarios: ['旧登录场景'],
      points: ['旧账号校验'],
      coupled: [],
    }]);
    await seedAiCases(page, {
      'xmind-mod-old-login': [{
        module: '旧登录模块',
        title: '旧登录用例',
        priority: 'P2',
        preconditions: '旧数据存在',
        steps: ['1、查看旧登录'],
        expected: '旧结果可见',
      }],
    });
    await page.evaluate(() => {
      window.app.state.caseGenSettings = window.app.state.caseGenSettings || {};
      window.app.state.caseGenSettings.dedupeSimplify = true;
    });

    await openXmindCaseGenDrawer(page);
    await openNodeContextMenu(page, 'XMind自动去重需求');
    await clickContextMenuAction(page, '重新生成全量用例');
    await waitForNodeStatus(page, 'XMind自动去重需求', '去重中');

    await expect.poll(async () => await readXmindToolbarOverview(page)).toMatchObject({
      state: 'running',
      modules: 2,
      cases: 4,
    });
    await expect.poll(async () => {
      return (await readXmindToolbarOverview(page)).label;
    }).toContain('AI 去重精简中');
    await expect.poll(async () => page.evaluate(() => {
      var dot = document.querySelector('#xmindCaseGenMindContainer .xmind-casegen-inline-task-indicator.is-running .xmind-casegen-inline-task-dot');
      var style = dot ? window.getComputedStyle(dot) : null;
      var rect = dot && dot.getBoundingClientRect ? dot.getBoundingClientRect() : null;
      return {
        transformableDisplay: style ? String(style.display || '') !== 'inline' : false,
        boxSizing: style ? String(style.boxSizing || '') : '',
        animationName: style ? String(style.animationName || '') : '',
        width: rect ? Math.round(rect.width) : 0,
        height: rect ? Math.round(rect.height) : 0,
      };
    })).toEqual({
      transformableDisplay: true,
      boxSizing: 'border-box',
      animationName: 'xmindCasegenToolbarSpin',
      width: 14,
      height: 14,
    });
    await expect.poll(async () => await readActiveXmindWorkspaceProgress(page)).toMatchObject({
      modules: 2,
      cases: 4,
      statusText: '去重中',
    });
    await expect(page.locator('#xmindCaseGenInterruptBtn')).toBeEnabled();
    await expect(page.locator('#xmindCaseGenStoreBtn')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenExportBtn')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenExportMarkdownBtn')).toBeDisabled();

    await waitForNodeTextAbsent(page, '登录失败提示');
    await waitForNodeTextAbsent(page, '支付失败提示');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付成功校验');
    await waitForNodeStatusAbsent(page, 'XMind自动去重需求');
    await expect(page.locator('#xmindCaseGenStatus')).toHaveText('已重新生成 2 个模块，2 条用例，已去重精简 2 条');
    await expect.poll(async () => await readXmindToolbarOverview(page)).toMatchObject({
      state: 'idle',
      label: '当前没有生成任务',
      modules: 2,
      cases: 2,
    });

    const dedupeCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      var matches = calls.filter(function(item) {
        return item && item.contract && String(item.contract.mode || '') === 'ai_dedupe_simplify';
      });
      var latest = matches[matches.length - 1] || null;
      function parseJsonText(text) {
        var raw = String(text || '').trim();
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {}
        return null;
      }
      function extractSection(text, marker) {
        var source = String(text || '');
        var index = source.indexOf(marker);
        if (index === -1) return '';
        var rest = source.slice(index + marker.length);
        var next = rest.indexOf('\n\n【');
        if (next !== -1) rest = rest.slice(0, next);
        return String(rest || '').trim();
      }
      return latest ? {
        count: matches.length,
        contract: latest.contract || {},
        prompt: String(latest.prompt || ''),
        user: String(latest.user || ''),
        temperature: Number(latest.temperature),
        modules: parseJsonText(extractSection(latest.user, '【需要去重精简的 AI 生成用例(JSON)】')) || [],
      } : null;
    });
    expect(dedupeCall).toBeTruthy();
    expect(dedupeCall.count).toBe(1);
    expect(dedupeCall.contract.dedupe_mode).toBe('dedupe_simplify');
    expect(dedupeCall.contract.simplify).toBe(true);
    expect(dedupeCall.contract.module_return_policy.return_all_input_modules).toBe(true);
    expect(dedupeCall.contract.module_return_policy.partial_modules_response_allowed).toBe(false);
    expect(dedupeCall.contract.dedupe_scope).toBe('all_input_modules_global');
    expect(dedupeCall.contract.cross_module_dedupe).toBe(true);
    expect(dedupeCall.contract.review_method).toBe('exhaustive_global_pairwise_scan');
    expect(dedupeCall.contract.duplicate_detection_policy.require_full_module_scan).toBe(true);
    expect(dedupeCall.contract.duplicate_detection_policy.require_global_case_scan).toBe(true);
    expect(dedupeCall.contract.duplicate_detection_policy.stop_after_first_duplicate).toBe(false);
    expect(dedupeCall.contract.duplicate_detection_policy.prefer_same_module_dedupe).toBe(false);
    expect(dedupeCall.contract.duplicate_detection_policy.cross_module_dedupe).toBe(true);
    expect(dedupeCall.contract.duplicate_detection_policy.duplicate_when_same_test_purpose_and_point).toBe(true);
    expect(dedupeCall.temperature).toBe(0.2);
    expect(dedupeCall.prompt).toContain('本次策略：去重并精简');
    expect(dedupeCall.prompt).toContain('所有输入模块下的用例视为一份完整用例集');
    expect(dedupeCall.prompt).toContain('跨模块也属于本次去重范围');
    expect(dedupeCall.prompt).toContain('具体测试目的和测试点基本一致');
    expect(dedupeCall.prompt).toContain('不能发现少量重复后提前停止');
    expect(dedupeCall.prompt).toContain('禁用/禁止/不可用');
    expect(dedupeCall.prompt).toContain('不得只返回发生变化的模块');
    expect(dedupeCall.prompt).toContain('duplicate_with');
    expect(dedupeCall.prompt).toContain('merged_from');
    expect(dedupeCall.user).toContain('需求：登录和支付需要完整覆盖');
    expect(dedupeCall.user).toContain('补充：保留关键异常提示覆盖。');
    expect(dedupeCall.modules).toHaveLength(2);
    expect(dedupeCall.modules[0].cases).toHaveLength(2);
    expect(dedupeCall.modules[1].cases).toHaveLength(2);

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestAutoHistoryCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestAutoHistoryCard).toContainText('去重记录');
    await expect(latestAutoHistoryCard.locator('.xmind-casegen-history-dedupe-summary')).toHaveText('已去重 2 条用例');
    await expect(latestAutoHistoryCard.locator('.xmind-casegen-history-dedupe-module-block')).toHaveCount(2);
    await expect(latestAutoHistoryCard.locator('.xmind-casegen-history-dedupe-case')).toContainText([
      '登录失败提示',
      '支付失败提示',
    ]);
    await expect(latestAutoHistoryCard.locator('.xmind-casegen-history-dedupe-badge.is-duplicate')).toHaveCount(2);
    await expect(latestAutoHistoryCard.locator('.xmind-casegen-history-dedupe-reason').nth(0)).toContainText('与「登录成功校验」重复');
    await expect(latestAutoHistoryCard.locator('.xmind-casegen-history-dedupe-reason').nth(0)).toContainText('重复点：校验目标相同');
  });

  test('全量生成自动去重未删除任何用例时，仍会留下去重完成痕迹', async ({ page }) => {
    const token = 'token-xmind-auto-dedupe-no-change';
    const user = { id: 227, username: 'demo_user_auto_dedupe_no_change', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 80);
    await seedDocumentRequirement(page, {
      text: '需求：自动去重即使没有删减，也必须保留执行痕迹和诊断。',
      requirementLabel: 'XMind自动去重无变化需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      requirementSupplement: '补充：保留全部可见覆盖结果。',
      caseImportMode: 'skip',
      completed: true,
    });
    await page.evaluate(() => {
      window.app.state.caseGenSettings = window.app.state.caseGenSettings || {};
      window.app.state.caseGenSettings.dedupeSimplify = false;
    });

    await openXmindCaseGenDrawer(page);
    await openNodeContextMenu(page, 'XMind自动去重无变化需求');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeStatus(page, 'XMind自动去重无变化需求', '去重中');
    await waitForNodeStatusAbsent(page, 'XMind自动去重无变化需求');
    await expect.poll(async () => await readXmindToolbarOverview(page)).toMatchObject({
      state: 'idle',
      label: '当前没有生成任务',
      modules: 2,
      cases: 4,
    });
    await expect(page.locator('#xmindCaseGenStatus')).toContainText('AI 用例去重完成，未发现可去重用例');
    await expect(page.locator('#xmindCaseGenStatus')).toContainText('已生成 2 个模块，4 条用例');

    const dedupeCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      var matches = calls.filter(function(item) {
        return item && item.contract && String(item.contract.mode || '') === 'ai_dedupe_simplify';
      });
      var latest = matches[matches.length - 1] || null;
      return latest ? {
        count: matches.length,
        contract: latest.contract || {},
        temperature: Number(latest.temperature),
      } : null;
    });
    expect(dedupeCall).toBeTruthy();
    expect(dedupeCall.count).toBe(1);
    expect(dedupeCall.contract.dedupe_mode).toBe('dedupe_only');
    expect(dedupeCall.contract.simplify).toBe(false);
    expect(dedupeCall.temperature).toBe(0.2);

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestHistoryCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestHistoryCard).toContainText('AI 用例去重完成，未发现可去重用例');
    await expect(latestHistoryCard).toContainText('已生成 2 个模块，4 条用例');
  });

  test('工具栏 AI 用例去重只发送当前可见 AI 用例，并保留导入基线用例', async ({ page }) => {
    const token = 'token-xmind-manual-dedupe';
    const user = { id: 224, username: 'demo_user_manual_dedupe', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 90);
    await page.evaluate(() => {
      window.__xmindCasegenDedupeTrim = true;
    });
    await seedDocumentRequirement(page, {
      text: '需求：登录模块需要覆盖成功、失败和基线导入用例。',
      requirementLabel: 'XMind手动去重需求',
    });
    await seedImportedBaseline(page, [{
      module: '登录模块',
      title: '登录模块-基线用例',
      priority: 'P1',
      preconditions: '存在导入基线',
      steps: ['1、查看基线'],
      expected: '基线用例保留',
    }]);
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-empty',
      title: '空模块',
      scenarios: ['暂无用例'],
      points: ['无'],
      coupled: [],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入正确账号密码'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录成功冗余校验',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、再次输入正确账号密码'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败冗余校验',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码'],
        expected: '提示密码错误',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      requirementSupplement: '补充：基线用例不能被改写。',
      caseImportMode: 'import',
      completed: true,
    });
    await page.evaluate(() => {
      window.app.state.caseGenSettings = window.app.state.caseGenSettings || {};
      window.app.state.caseGenSettings.dedupeSimplify = true;
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块-基线用例');
    await waitForNodeText(page, '登录成功冗余校验');
    await expect(page.locator('#xmindCaseGenDedupeBtn')).toBeEnabled();
    const dedupeCallCountBeforeConfirm = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      return calls.filter(function(item) {
        return item && item.contract && String(item.contract.mode || '') === 'ai_dedupe_simplify';
      }).length;
    });
    await clickElementById(page, 'xmindCaseGenDedupeBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerTitle')).toHaveText('确认 AI 用例去重');
    await expect(page.locator('#appConfirmDrawerConfirmBtn')).toHaveText('确认去重');
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('1 个模块、3 条 AI 生成用例');
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('执行去重并精简');
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('仅处理当前页签的 AI 生成层结果');
    await clickElementById(page, 'appConfirmDrawerCancelBtn');
    await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      return calls.filter(function(item) {
        return item && item.contract && String(item.contract.mode || '') === 'ai_dedupe_simplify';
      }).length;
    })).toBe(dedupeCallCountBeforeConfirm);
    await waitForNodeText(page, '登录成功冗余校验');
    await clickElementById(page, 'xmindCaseGenDedupeBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await clickElementById(page, 'appConfirmDrawerConfirmBtn');
    await waitForNodeStatus(page, 'XMind手动去重需求', '去重中');
    await waitForNodeTextAbsent(page, '登录成功冗余校验');
    await waitForNodeTextAbsent(page, '登录失败冗余校验');
    await waitForNodeText(page, '登录模块-基线用例');
    await waitForNodeText(page, '登录成功校验');
    await expect.poll(async () => await readXmindToolbarOverview(page)).toMatchObject({
      state: 'idle',
      label: '当前没有生成任务',
      modules: 2,
      cases: 2,
    });
    await expect.poll(async () => await readActiveXmindWorkspaceProgress(page)).toMatchObject({
      modules: 2,
      cases: 2,
    });
    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);
    await expect.poll(async () => await readActiveXmindWorkspaceProgress(page)).toMatchObject({
      modules: 2,
      cases: 2,
    });
    await expect(page.locator('#caseGenXmindModulesContainer')).toContainText('登录成功校验');
    await expect(page.locator('#caseGenXmindModulesContainer')).not.toContainText('登录成功冗余校验');
    await expect(page.locator('#caseGenXmindModulesContainer')).not.toContainText('登录失败冗余校验');
    await clickElementById(page, 'caseGenSettingsTabBtn');
    await expect(page.locator('#casegenSettingsPanel')).toHaveClass(/is-active/);
    await expect.poll(async () => await readActiveXmindWorkspaceProgress(page)).toMatchObject({
      modules: 2,
      cases: 2,
    });
    await clickElementById(page, 'caseGenModulesTabBtn');
    await expect(page.locator('#casegenModulesPanel')).toHaveClass(/is-active/);
    await expect.poll(async () => await readActiveXmindWorkspaceProgress(page)).toMatchObject({
      modules: 2,
      cases: 2,
    });
    await openXmindCaseGenDrawer(page);
    await expect.poll(async () => await readActiveXmindWorkspaceProgress(page)).toMatchObject({
      modules: 2,
      cases: 2,
    });
    await clickElementById(page, 'closeXmindCaseGenDrawerBtn');
    await waitXmindDrawerClosedStable(page);
    await expect.poll(async () => await readActiveXmindWorkspaceProgress(page)).toMatchObject({
      modules: 2,
      cases: 2,
    });
    await openXmindCaseGenDrawer(page);

    const requestInfo = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      var latest = null;
      for (var i = calls.length - 1; i >= 0; i -= 1) {
        if (calls[i] && calls[i].contract && String(calls[i].contract.mode || '') === 'ai_dedupe_simplify') {
          latest = calls[i];
          break;
        }
      }
      function parseJsonText(text) {
        var raw = String(text || '').trim();
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {}
        return null;
      }
      function extractSection(text, marker) {
        var source = String(text || '');
        var index = source.indexOf(marker);
        if (index === -1) return '';
        var rest = source.slice(index + marker.length);
        var next = rest.indexOf('\n\n【');
        if (next !== -1) rest = rest.slice(0, next);
        return String(rest || '').trim();
      }
      return latest ? {
        contract: latest.contract || {},
        prompt: String(latest.prompt || ''),
        user: String(latest.user || ''),
        temperature: Number(latest.temperature),
        modules: parseJsonText(extractSection(latest.user, '【需要去重精简的 AI 生成用例(JSON)】')) || [],
      } : null;
    });
    expect(requestInfo).toBeTruthy();
    expect(requestInfo.contract.dedupe_mode).toBe('dedupe_simplify');
    expect(requestInfo.contract.simplify).toBe(true);
    expect(requestInfo.contract.module_return_policy.return_all_input_modules).toBe(true);
    expect(requestInfo.contract.module_return_policy.partial_modules_response_allowed).toBe(false);
    expect(requestInfo.contract.dedupe_scope).toBe('all_input_modules_global');
    expect(requestInfo.contract.cross_module_dedupe).toBe(true);
    expect(requestInfo.contract.review_method).toBe('exhaustive_global_pairwise_scan');
    expect(requestInfo.contract.duplicate_detection_policy.require_full_module_scan).toBe(true);
    expect(requestInfo.contract.duplicate_detection_policy.require_global_case_scan).toBe(true);
    expect(requestInfo.contract.duplicate_detection_policy.stop_after_first_duplicate).toBe(false);
    expect(requestInfo.contract.duplicate_detection_policy.prefer_same_module_dedupe).toBe(false);
    expect(requestInfo.contract.duplicate_detection_policy.cross_module_dedupe).toBe(true);
    expect(requestInfo.contract.duplicate_detection_policy.duplicate_when_same_test_purpose_and_point).toBe(true);
    expect(requestInfo.temperature).toBe(0.2);
    expect(requestInfo.prompt).toContain('本次策略：去重并精简');
    expect(requestInfo.prompt).toContain('所有输入模块下的用例视为一份完整用例集');
    expect(requestInfo.prompt).toContain('跨模块也属于本次去重范围');
    expect(requestInfo.prompt).toContain('具体测试目的和测试点基本一致');
    expect(requestInfo.prompt).toContain('不能发现少量重复后提前停止');
    expect(requestInfo.prompt).toContain('不得只返回发生变化的模块');
    expect(requestInfo.prompt).toContain('duplicate_with');
    expect(requestInfo.prompt).toContain('merged_from');
    expect(requestInfo.user).toContain('需求：登录模块需要覆盖成功、失败和基线导入用例。');
    expect(requestInfo.user).toContain('补充：基线用例不能被改写。');
    expect(requestInfo.user).not.toContain('登录模块-基线用例');
    expect(requestInfo.modules).toHaveLength(1);
    expect(requestInfo.modules[0].module).toBe('登录模块');
    expect(requestInfo.modules[0].cases).toHaveLength(3);

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('AI用例去重');
    await expect(latestCard).toContainText('已去重精简 2 条用例');
    await expect(latestCard).toContainText('去重记录');
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-summary')).toHaveText('已去重 2 条用例');
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-module-block')).toHaveCount(1);
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-case')).toContainText([
      '登录成功冗余校验',
      '合并前 2 条用例',
    ]);
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-badge.is-duplicate')).toHaveCount(1);
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-badge.is-merge')).toHaveCount(1);
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-reason').nth(0)).toContainText('与「登录成功校验」重复');
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-reason').nth(0)).toContainText('重复点：校验目标相同');
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-reason').nth(1)).toContainText('合并前');
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-reason').nth(1)).toContainText('登录成功校验');
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-reason').nth(1)).toContainText('登录失败冗余校验');
    await expect(latestCard.locator('.xmind-casegen-history-dedupe-reason').nth(1)).toContainText('合并后');
  });

  test('工具栏 AI 用例去重默认仅去重，不主动精简用例', async ({ page }) => {
    const token = 'token-xmind-manual-dedupe-only';
    const user = { id: 226, username: 'demo_user_manual_dedupe_only', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 70);
    await page.evaluate(() => {
      window.__xmindCasegenDedupeTrim = true;
    });
    await seedDocumentRequirement(page, {
      text: '需求：默认去重只处理重复用例，不主动减少覆盖。',
      requirementLabel: 'XMind仅去重需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: [],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入正确账号密码'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码'],
        expected: '提示密码错误',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await expect(page.locator('#xmindCaseGenDedupeBtn')).toBeEnabled();
    await clickElementById(page, 'xmindCaseGenDedupeBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('执行仅去重');
    await clickElementById(page, 'appConfirmDrawerConfirmBtn');
    await waitForNodeStatus(page, 'XMind仅去重需求', '去重中');
    await waitForNodeStatusAbsent(page, 'XMind仅去重需求');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');

    const requestInfo = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      var latest = null;
      for (var i = calls.length - 1; i >= 0; i -= 1) {
        if (calls[i] && calls[i].contract && String(calls[i].contract.mode || '') === 'ai_dedupe_simplify') {
          latest = calls[i];
          break;
        }
      }
      return latest ? {
        contract: latest.contract || {},
        prompt: String(latest.prompt || ''),
        temperature: Number(latest.temperature),
      } : null;
    });
    expect(requestInfo).toBeTruthy();
    expect(requestInfo.contract.dedupe_mode).toBe('dedupe_only');
    expect(requestInfo.contract.simplify).toBe(false);
    expect(requestInfo.contract.module_return_policy.return_all_input_modules).toBe(true);
    expect(requestInfo.contract.module_return_policy.partial_modules_response_allowed).toBe(false);
    expect(requestInfo.contract.dedupe_scope).toBe('all_input_modules_global');
    expect(requestInfo.contract.cross_module_dedupe).toBe(true);
    expect(requestInfo.contract.review_method).toBe('exhaustive_global_pairwise_scan');
    expect(requestInfo.contract.duplicate_detection_policy.require_full_module_scan).toBe(true);
    expect(requestInfo.contract.duplicate_detection_policy.require_global_case_scan).toBe(true);
    expect(requestInfo.contract.duplicate_detection_policy.stop_after_first_duplicate).toBe(false);
    expect(requestInfo.contract.duplicate_detection_policy.prefer_same_module_dedupe).toBe(false);
    expect(requestInfo.contract.duplicate_detection_policy.cross_module_dedupe).toBe(true);
    expect(requestInfo.contract.duplicate_detection_policy.duplicate_when_same_test_purpose_and_point).toBe(true);
    expect(requestInfo.temperature).toBe(0.2);
    expect(requestInfo.prompt).toContain('本次策略：仅去重');
    expect(requestInfo.prompt).toContain('所有输入模块下的用例视为一份完整用例集');
    expect(requestInfo.prompt).toContain('跨模块也属于本次去重范围');
    expect(requestInfo.prompt).toContain('具体测试目的和测试点基本一致');
    expect(requestInfo.prompt).toContain('不能发现少量重复后提前停止');
    expect(requestInfo.prompt).toContain('不得只返回发生变化的模块');

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('AI用例去重');
    await expect(latestCard).toContainText('未发现可去重用例');
  });

  test('AI 用例去重失败时保留原用例并写入失败记录', async ({ page }) => {
    const token = 'token-xmind-dedupe-failure';
    const user = { id: 225, username: 'demo_user_dedupe_failure', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRejectedXmindModelResponse(page, 'dedupe unavailable', 100);
    await seedDocumentRequirement(page, {
      text: '需求：去重失败时不能删除已有 AI 用例。',
      requirementLabel: 'XMind去重失败需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入正确账号密码'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码'],
        expected: '提示密码错误',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenDedupeBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await clickElementById(page, 'appConfirmDrawerConfirmBtn');
    await waitForNodeStatus(page, 'XMind去重失败需求', '去重中');
    await expect(page.locator('#xmindCaseGenStatus')).toHaveText('AI 用例去重失败，已保留原结果');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('AI用例去重');
    await expect(latestCard).toContainText('AI 用例去重失败');
    await expect(latestCard).toContainText('dedupe unavailable');
  });

  test('XMind 工具栏支持导出 AI Markdown，并保持 XMind 导出可用', async ({ page }) => {
    const token = 'token-xmind-markdown-export';
    const user = { id: 221, username: 'demo_user_markdown_export', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 160);
    await seedDocumentRequirement(page, {
      text: '需求：生成模块和用例后，需要导出适合 AI 阅读和实现核对的 Markdown。',
      requirementLabel: 'XMindMarkdown导出需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMindMarkdown导出需求');
    await openNodeContextMenu(page, 'XMindMarkdown导出需求');
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');

    const [xmindDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      clickElementById(page, 'xmindCaseGenExportBtn'),
    ]);
    const xmindName = await xmindDownload.suggestedFilename();
    expect(xmindName).toMatch(/^XMindMarkdown导出需求_\d{14}\.xmind$/);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      clickElementById(page, 'xmindCaseGenExportMarkdownBtn'),
    ]);
    const name = await download.suggestedFilename();
    expect(name).toMatch(/^XMindMarkdown导出需求_ai_usecases_\d{14}\.md$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('# XMind AI 测试用例导出');
    expect(content).toContain('## 导出元数据');
    expect(content).toContain('## AI 审核骨架');
    expect(content).toContain('## 模块视图');
    expect(content).toContain('## 全局用例索引视图');
    expect(content).toContain('## 模块详情视图');
    expect(content).toContain('"schema_version": "2.0"');
    expect(content).toContain('"structured_payload_format": "json_code_blocks"');
    expect(content).toContain('| Case ID | 模块 | 优先级 | 标题 | 预期摘要 | 建议核对目标 |');
    expect(content).toContain('### M01 登录模块');
    expect(content).toContain('"module_record": {');
    expect(content).toContain('"case_id": "M01-C01"');
    expect(content).toContain('"module_id": "M01"');
    expect(content).toContain('"suggested_check_targets": [');
    expect(content).toContain('"permission_or_auth"');
    expect(content).toContain('"validation_or_error"');
    expect(content).toContain('"state_or_flow"');
    expect(content).toContain('"depends_on_modules": [');
    expect(content).toContain('"source_scope": "current_active_workspace_visible_nodes"');
    expect(content).toContain('| M01-C01 | 登录模块 | P1 | 登录模块-完整-1 | 登录模块-完整-1执行成功 | permission_or_auth, validation_or_error, state_or_flow |');
    await expect(page.locator('.temp-center-toast.ok', { hasText: '已导出 AI Markdown' })).toBeVisible();
  });

  test('XMind AI Markdown 在无用例模块下仍保留模块摘要', async ({ page }) => {
    const token = 'token-xmind-markdown-empty-modules';
    const user = { id: 222, username: 'demo_user_markdown_empty', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 120);
    await seedDocumentRequirement(page, {
      text: '需求：即使模块下还没有生成任何用例，Markdown 导出也需要保留模块摘要。',
      requirementLabel: 'XMindMarkdown空模块需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMindMarkdown空模块需求');
    await openNodeContextMenu(page, 'XMindMarkdown空模块需求');
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      clickElementById(page, 'xmindCaseGenExportMarkdownBtn'),
    ]);
    const name = await download.suggestedFilename();
    expect(name).toMatch(/^XMindMarkdown空模块需求_ai_usecases_\d{14}\.md$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('### M01 登录模块');
    expect(content).toContain('### M02 支付模块');
    expect(content).toContain('| M01 | 登录模块 | 0 |');
    expect(content).toContain('| M02 | 支付模块 | 0 |');
    expect(content).toContain('当前没有可导出的用例。');
    expect(content).toContain('当前模块暂无用例。');
    expect(content).toContain('"cases": []');
    expect(content).toContain('"empty_case_records": true');
  });

  test('工具栏在生成前置准备和生成记录之间展示总体状态与当前模块用例总数，并随新增删除实时刷新', async ({ page }) => {
    const token = 'token-xmind-toolbar-overview';
    const user = { id: 211, username: 'demo_user_toolbar_overview', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 260);
    await seedDocumentRequirement(page, {
      text: '需求：工具栏需要展示当前总体生成状态，以及当前画布的模块和用例总数。',
      requirementLabel: 'XMind工具栏总览需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await expect.poll(async () => {
      return await readXmindToolbarOverview(page);
    }).toEqual({
      state: 'idle',
      label: '当前没有生成任务',
      modules: 0,
      cases: 0,
    });

    await openNodeContextMenu(page, 'XMind工具栏总览需求');
    await clickContextMenuAction(page, '生成全量模块');
    await expect.poll(async () => {
      return (await readXmindToolbarOverview(page)).state;
    }).toBe('running');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await expect.poll(async () => {
      return await readXmindToolbarOverview(page);
    }).toEqual({
      state: 'idle',
      label: '当前没有生成任务',
      modules: 2,
      cases: 0,
    });

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(async () => {
      return (await readXmindToolbarOverview(page)).state;
    }).toBe('running');
    await waitForNodeText(page, '登录模块-完整-1');
    await expect.poll(async () => {
      return await readXmindToolbarOverview(page);
    }).toEqual({
      state: 'idle',
      label: '当前没有生成任务',
      modules: 2,
      cases: 2,
    });

    await autoAcceptXmindConfirm(page);
    await openNodeContextMenu(page, '登录模块-完整-1');
    await clickContextMenuAction(page, '删除');
    await page.waitForFunction(() => Boolean(window.__xmindConfirmPayload), {}, { timeout: 5000 });
    await waitForNodeTextAbsent(page, '登录模块-完整-1');
    await expect.poll(async () => {
      return await readXmindToolbarOverview(page);
    }).toEqual({
      state: 'idle',
      label: '当前没有生成任务',
      modules: 2,
      cases: 1,
    });
    await expect.poll(async () => {
      return await readActiveXmindWorkspaceProgress(page);
    }).toEqual({
      modules: 2,
      cases: 1,
      statusText: '未入库',
    });

    await autoAcceptXmindConfirm(page);
    await openNodeContextMenu(page, '支付模块');
    await clickContextMenuAction(page, '删除');
    await page.waitForFunction(() => Boolean(window.__xmindConfirmPayload), {}, { timeout: 5000 });
    await waitForNodeTextAbsent(page, '支付模块');
    await expect.poll(async () => {
      return await readXmindToolbarOverview(page);
    }).toEqual({
      state: 'idle',
      label: '当前没有生成任务',
      modules: 1,
      cases: 1,
    });
  });

  test('XMind 工具栏在全屏和非全屏下都会自动换层排布，避免搜索清空按钮被压坏', async ({ page }) => {
    const token = 'token-xmind-toolbar-nonfullscreen-layout';
    const user = { id: 212, username: 'demo_user_toolbar_layout', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await page.setViewportSize({ width: 1366, height: 820 });
    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：验证 XMind 工具栏在非全屏和全屏下都能合理排版，不会把清空按钮压坏。',
      requirementLabel: 'XMind工具栏布局需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await page.evaluate(() => {
      var status = document.getElementById('xmindCaseGenStatus');
      if (status) {
        status.textContent = '已选中 2 个节点，可继续删除或保存入库';
      }
    });

    const readToolbarLayout = async () => page.evaluate(() => {
      var drawer = document.getElementById('xmindCaseGenDrawer');
      var controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
      var utilityHost = controls ? controls.querySelector('[data-mind-utility-host]') : null;
      var searchGroup = controls ? controls.querySelector('.xmind-search-group') : null;
      var clearBtn = controls ? controls.querySelector('[data-mind-action="search-clear"]') : null;
      var interruptBtn = controls ? controls.querySelector('#xmindCaseGenInterruptBtn') : null;
      var clearStyle = clearBtn ? window.getComputedStyle(clearBtn) : null;
      var rect = controls && controls.getBoundingClientRect ? controls.getBoundingClientRect() : null;
      var utilityRect = utilityHost && utilityHost.getBoundingClientRect ? utilityHost.getBoundingClientRect() : null;
      var searchRect = searchGroup && searchGroup.getBoundingClientRect ? searchGroup.getBoundingClientRect() : null;
      var clearRect = clearBtn && clearBtn.getBoundingClientRect ? clearBtn.getBoundingClientRect() : null;
      var interruptRect = interruptBtn && interruptBtn.getBoundingClientRect ? interruptBtn.getBoundingClientRect() : null;
      return {
        drawerFullscreen: Boolean(drawer && drawer.classList && drawer.classList.contains('xmind-drawer-fullscreen')),
        controlsOverflowX: controls ? Math.max(0, controls.scrollWidth - controls.clientWidth) : 0,
        controlsOverflowY: controls ? Math.max(0, controls.scrollHeight - controls.clientHeight) : 0,
        controlsWidth: rect ? rect.width : 0,
        utilityBottom: utilityRect ? utilityRect.bottom : 0,
        searchTop: searchRect ? searchRect.top : 0,
        clearWidth: clearRect ? clearRect.width : 0,
        clearHeight: clearRect ? clearRect.height : 0,
        clearOverflowX: clearBtn ? Math.max(0, clearBtn.scrollWidth - clearBtn.clientWidth) : 0,
        clearText: clearBtn ? String(clearBtn.textContent || '').replace(/\s+/g, ' ').trim() : '',
        clearWritingMode: clearStyle ? String(clearStyle.writingMode || '') : '',
        clearWhiteSpace: clearStyle ? String(clearStyle.whiteSpace || '') : '',
        interruptWidth: interruptRect ? interruptRect.width : 0,
        interruptRight: interruptRect ? interruptRect.right : 0,
        utilityRight: utilityRect ? utilityRect.right : 0,
      };
    });

    const assertToolbarExpanded = (layout, expectedFullscreen) => {
      expect(layout.drawerFullscreen).toBe(expectedFullscreen);
      expect(layout.controlsWidth).toBeGreaterThan(900);
      expect(layout.controlsOverflowX).toBeLessThanOrEqual(4);
      expect(layout.searchTop).toBeGreaterThanOrEqual(layout.utilityBottom - 2);
      expect(layout.clearText).toBe('清空');
      expect(layout.clearWidth).toBeGreaterThan(46);
      expect(layout.clearHeight).toBeLessThan(layout.clearWidth);
      expect(layout.clearOverflowX).toBeLessThanOrEqual(1);
      expect(layout.clearWritingMode).toBe('horizontal-tb');
      expect(layout.clearWhiteSpace).toBe('nowrap');
      expect(layout.interruptWidth).toBeGreaterThan(80);
      expect(layout.interruptRight).toBeLessThanOrEqual(layout.utilityRight + 1);
    };

    const layout = await readToolbarLayout();
    expect(layout.drawerFullscreen).toBeFalsy();
    assertToolbarExpanded(layout, false);

    await page.click('#xmindCaseGenMindContainer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    await page.waitForTimeout(100);
    const fullscreenLayout = await readToolbarLayout();
    assertToolbarExpanded(fullscreenLayout, true);
    expect(fullscreenLayout.controlsWidth).toBeGreaterThan(layout.controlsWidth + 120);
  });

  test('XMind 工具栏支持收起与展开，收起后只保留展开入口', async ({ page }) => {
    const token = 'token-xmind-toolbar-collapse';
    const user = { id: 214, username: 'demo_user_toolbar_collapse', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await page.setViewportSize({ width: 1366, height: 820 });
    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：XMind 用例生成工具栏可以收起，收起后画布顶部只保留展开入口。',
      requirementLabel: 'XMind工具栏收起需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind工具栏收起需求');

    const readToolbarCollapseState = async () => page.evaluate(() => {
      function isVisible(el) {
        if (!el || !el.getBoundingClientRect) return false;
        var rect = el.getBoundingClientRect();
        var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
        return Boolean(
          rect.width > 0
          && rect.height > 0
          && (!style || (style.display !== 'none' && style.visibility !== 'hidden'))
        );
      }
      var controls = document.querySelector('#xmindCaseGenMindContainer [data-mind-controls]');
      var leading = controls ? controls.querySelector('.xmind-controls-leading') : null;
      var trailing = controls ? controls.querySelector('.xmind-controls-trailing') : null;
      var summaryBtn = controls ? controls.querySelector('#xmindCaseGenSummaryBtn') : null;
      var searchInput = controls ? controls.querySelector('[data-mind-search-input]') : null;
      var toggleButtons = controls ? controls.querySelectorAll('[data-xmind-casegen-toolbar-toggle]') : [];
      var toggleBtn = toggleButtons && toggleButtons.length ? toggleButtons[0] : null;
      var rect = controls && controls.getBoundingClientRect ? controls.getBoundingClientRect() : null;
      return {
        collapsed: Boolean(controls && controls.classList && controls.classList.contains('is-collapsed')),
        toggleCount: toggleButtons ? toggleButtons.length : 0,
        buttonText: toggleBtn ? String(toggleBtn.textContent || '').trim() : '',
        buttonExpanded: toggleBtn ? String(toggleBtn.getAttribute('aria-expanded') || '') : '',
        leadingVisible: isVisible(leading),
        trailingVisible: isVisible(trailing),
        summaryVisible: isVisible(summaryBtn),
        searchVisible: isVisible(searchInput),
        controlsHeight: rect ? rect.height : 0,
      };
    });

    const expanded = await readToolbarCollapseState();
    expect(expanded.collapsed).toBe(false);
    expect(expanded.toggleCount).toBe(1);
    expect(expanded.buttonText).toBe('收起工具栏');
    expect(expanded.buttonExpanded).toBe('true');
    expect(expanded.leadingVisible).toBe(true);
    expect(expanded.trailingVisible).toBe(true);
    expect(expanded.summaryVisible).toBe(true);
    expect(expanded.searchVisible).toBe(true);

    await page.click('#xmindCaseGenMindContainer [data-xmind-casegen-toolbar-toggle]');
    const collapsed = await readToolbarCollapseState();
    expect(collapsed.collapsed).toBe(true);
    expect(collapsed.toggleCount).toBe(1);
    expect(collapsed.buttonText).toBe('展开工具栏');
    expect(collapsed.buttonExpanded).toBe('false');
    expect(collapsed.leadingVisible).toBe(false);
    expect(collapsed.trailingVisible).toBe(false);
    expect(collapsed.summaryVisible).toBe(false);
    expect(collapsed.searchVisible).toBe(false);
    expect(collapsed.controlsHeight).toBeLessThan(expanded.controlsHeight);
    await waitForNodeText(page, 'XMind工具栏收起需求');

    await page.click('#xmindCaseGenMindContainer [data-xmind-casegen-toolbar-toggle]');
    const restored = await readToolbarCollapseState();
    expect(restored.collapsed).toBe(false);
    expect(restored.toggleCount).toBe(1);
    expect(restored.buttonText).toBe('收起工具栏');
    expect(restored.buttonExpanded).toBe('true');
    expect(restored.leadingVisible).toBe(true);
    expect(restored.trailingVisible).toBe(true);
    expect(restored.summaryVisible).toBe(true);
    expect(restored.searchVisible).toBe(true);
  });

  test('XMind 节点搜索保持输入焦点，回退与清空后不会误删已生成节点', async ({ page }) => {
    const token = 'token-xmind-search-focus-guard';
    const user = { id: 213, username: 'demo_user_search_focus_guard', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证 XMind 节点搜索在已有模块和用例时不会抢走搜索框焦点，也不会在清空搜索时误删节点。',
      requirementLabel: 'XMind搜索焦点保护需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind搜索焦点保护需求');
    await openNodeContextMenu(page, 'XMind搜索焦点保护需求');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeText(page, '支付模块-完整-1');

    const searchInput = page.locator('#xmindCaseGenMindContainer [data-mind-search-input]');
    const searchCount = page.locator('#xmindCaseGenMindContainer [data-mind-search-count]');
    const clearBtn = page.locator('#xmindCaseGenMindContainer [data-mind-action="search-clear"]');
    const nextBtn = page.locator('#xmindCaseGenMindContainer [data-mind-action="search-next"]');

    const readSearchMarkState = async () => page.evaluate(() => {
      var root = document.getElementById('xmindCaseGenMindContainer');
      var canvas = root ? root.querySelector('[data-mind-canvas]') : null;
      var active = root ? root.querySelector('me-tpc.xmind-search-active') : null;
      var hits = root ? root.querySelectorAll('me-tpc.xmind-search-hit') : [];
      var activeTextEl = active && active.querySelector ? (active.querySelector('.text') || active.querySelector('.box') || active) : active;
      var activeRect = activeTextEl && activeTextEl.getBoundingClientRect ? activeTextEl.getBoundingClientRect() : null;
      var canvasRect = canvas && canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      var dx = activeRect && canvasRect
        ? Math.abs((activeRect.left + activeRect.width / 2) - (canvasRect.left + canvasRect.width / 2))
        : null;
      var dy = activeRect && canvasRect
        ? Math.abs((activeRect.top + activeRect.height / 2) - (canvasRect.top + canvasRect.height / 2))
        : null;
      return {
        activeText: activeTextEl ? String(activeTextEl.textContent || '').replace(/\s+/g, ' ').trim() : '',
        hitCount: hits ? hits.length : 0,
        activeHasClass: Boolean(active),
        centerDx: dx,
        centerDy: dy,
      };
    });

    await searchInput.click();
    await searchInput.fill('登录模块-完整-1');
    await page.keyboard.press('Backspace');
    await expect(searchInput).toHaveValue('登录模块-完整-');
    await expect(searchCount).toHaveText(/1\s*\/\s*[1-9]\d*/);
    await expect.poll(async () => {
      return await readSearchMarkState();
    }).toMatchObject({
      activeHasClass: true,
      hitCount: 1,
      activeText: '登录模块-完整-1',
    });
    await expect.poll(async () => {
      return await page.evaluate(() => {
        var input = document.querySelector('#xmindCaseGenMindContainer [data-mind-search-input]');
        return Boolean(input && document.activeElement === input);
      });
    }).toBe(true);
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeText(page, '支付模块-完整-1');

    await searchInput.fill('模块-完整-1');
    await expect(searchCount).toHaveText(/1\s*\/\s*2/);
    await expect.poll(async () => {
      const state = await readSearchMarkState();
      return {
        activeText: state.activeText,
        hitCount: state.hitCount,
        centerDxOk: state.centerDx !== null && state.centerDx < 120,
        centerDyOk: state.centerDy !== null && state.centerDy < 120,
      };
    }).toEqual({
      activeText: '登录模块-完整-1',
      hitCount: 2,
      centerDxOk: true,
      centerDyOk: true,
    });
    await nextBtn.click();
    await expect(searchCount).toHaveText(/2\s*\/\s*2/);
    await expect.poll(async () => {
      const state = await readSearchMarkState();
      return {
        activeText: state.activeText,
        centerDxOk: state.centerDx !== null && state.centerDx < 120,
        centerDyOk: state.centerDy !== null && state.centerDy < 120,
      };
    }).toEqual({
      activeText: '支付模块-完整-1',
      centerDxOk: true,
      centerDyOk: true,
    });
    await nextBtn.click();
    await expect(searchCount).toHaveText(/1\s*\/\s*2/);
    await expect.poll(async () => {
      const state = await readSearchMarkState();
      return {
        activeText: state.activeText,
        centerDxOk: state.centerDx !== null && state.centerDx < 120,
        centerDyOk: state.centerDy !== null && state.centerDy < 120,
      };
    }).toEqual({
      activeText: '登录模块-完整-1',
      centerDxOk: true,
      centerDyOk: true,
    });

    await searchInput.fill('完全不存在的节点');
    await expect(searchCount).toHaveText(/0\s*\/\s*0/);
    await clearBtn.click();
    await expect(searchInput).toHaveValue('');
    await expect(searchCount).toHaveText(/0\s*\/\s*0/);
    await expect.poll(async () => {
      return await page.evaluate(() => {
        var input = document.querySelector('#xmindCaseGenMindContainer [data-mind-search-input]');
        return Boolean(input && document.activeElement === input);
      });
    }).toBe(true);
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeText(page, '支付模块-完整-1');
  });

  test('右侧导出XMind按钮替换为模型选择框，并支持直接切换 XMind 模型', async ({ page }) => {
    const token = 'token-xmind-inline-model-select';
    const user = { id: 211, username: 'demo_user_inline_model', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      modelRemoteId: 901,
      modelBaseUrl: 'https://mock-model-a.local/v1/responses',
      modelName: 'gpt-5.4-a',
      modelCapabilities: ['vision', 'reasoning', 'chat'],
      extraModels: [{
        id: 902,
        name: 'MockXmindCaseGenModel-B',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          provider: 'custom',
          baseUrl: 'https://mock-model-b.local/v1/responses',
          apiKey: 'mock-key-b',
          model: 'gpt-5.4-b',
          maxTokens: 2048,
          capabilities: ['vision', 'reasoning', 'chat'],
        },
      }],
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[]}]}',
    });
    await seedDocumentRequirement(page, {
      text: '需求：验证 XMind 右侧工具栏可直接切换模型。',
      requirementLabel: 'XMind模型切换需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind模型切换需求');
    await expect(page.locator('#xmindCaseGenMindContainer [data-mind-action="export-xmind"]')).toHaveClass(/xmind-casegen-default-export-hidden/);
    await expect(page.locator('#xmindCaseGenMindContainer [data-xmind-casegen-model-select]')).toBeVisible();

    const optionTexts = await page.locator('#xmindCaseGenMindContainer [data-xmind-casegen-model-select] option').allTextContents();
    expect(optionTexts).toEqual(['MockXmindCaseGenModel', 'MockXmindCaseGenModel-B']);

    await page.selectOption('#xmindCaseGenMindContainer [data-xmind-casegen-model-select]', '902');
    await expect.poll(async () => {
      return await page.evaluate(() => {
        var state = window.app && window.app.state ? window.app.state : null;
        return state && state.assignments ? String(state.assignments.xmindCaseGenId || '') : '';
      });
    }).toBe('902');

    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await expect.poll(async () => {
      return await page.evaluate(() => Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls.length : 0);
    }).toBeGreaterThanOrEqual(1);

    const lastCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindProxyCalls) ? window.__xmindProxyCalls : [];
      return calls.length ? calls[calls.length - 1] : null;
    });
    expect(lastCall).toBeTruthy();
    expect(String(lastCall.base_url || '')).toBe('https://mock-model-b.local/v1/responses');
  });

  test('生成记录会展示重复模块场景下的通俗未新增原因', async ({ page }) => {
    const token = 'token-xmind-history-nochange';
    const user = { id: 22, username: 'demo_user_history_reason', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRawXmindModelResponse(page, JSON.stringify({
      modules: [
        { module: '技能按钮与界面状态', cases: [] },
        { module: '异常状态与边界处理', cases: [] },
      ],
    }), 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证重复模块导致无新增时，生成记录会展示通俗原因。',
      requirementLabel: 'XMind未新增原因需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-skill',
      title: '技能按钮与界面状态',
      scenarios: ['技能按钮主场景'],
      points: ['按钮状态同步'],
      coupled: ['消息模块'],
    }, {
      id: 'xmind-mod-exception',
      title: '异常状态与边界处理',
      scenarios: ['异常状态场景'],
      points: ['边界处理提示'],
      coupled: ['技能按钮与界面状态'],
    }]);

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '技能按钮与界面状态');
    await waitForNodeText(page, '异常状态与边界处理');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '补全模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('根节点 · XMind未新增原因需求');
    await expect(latestCard).toContainText('补全模块');
    await expect(latestCard).toContainText('本次没有新增结果');
    await expect(latestCard).toContainText('未新增原因：');
    await expect(latestCard).toContainText('当前模块已经覆盖，不需要再补充新模块。');
    await expect(latestCard).toContainText('已有模块已覆盖 2 个');
  });

  test('生成记录会展示模型返回非 JSON 时的具体原因和返回片段', async ({ page }) => {
    const token = 'token-xmind-history-invalid-output';
    const user = { id: 23, username: 'demo_user_history_invalid_output', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRawXmindModelResponse(page, '我认为当前没有需要补充的模块，请直接沿用现有内容。', 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证模型返回普通文本时，生成记录要写出更具体的失败原因。',
      requirementLabel: 'XMind模型返回结构异常需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind模型返回结构异常需求');

    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('根节点 · XMind模型返回结构异常需求');
    await expect(latestCard).toContainText('生成全量模块');
    await expect(latestCard).toContainText('未新增原因：');
    await expect(latestCard).toContainText('模型返回的是说明文字，不是系统可识别的结果。');
    await expect(latestCard).toContainText('返回格式：说明文字');
    await expect(latestCard).toContainText('模型返回片段：');
    await expect(latestCard).toContainText('我认为当前没有需要补充的模块，请直接沿用现有内容。');
  });

  test('生成记录会把空模块数组显示为当前没有需要补充的新模块', async ({ page }) => {
    const token = 'token-xmind-history-empty-modules';
    const user = { id: 24, username: 'demo_user_history_empty_modules', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRawXmindModelResponse(page, '{"modules":[]}', 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证模型返回空模块数组时，历史记录会用通俗文案说明没有可补内容。',
      requirementLabel: 'XMind空模块数组需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind空模块数组需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '补全模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('未新增原因：');
    await expect(latestCard).toContainText('当前没有需要补充的新模块。');
    await expect(latestCard).toContainText('模块列表为空');
  });

  test('生成全量用例返回空用例时会回滚伪骨架，并且切换页签不会串用完成提示', async ({ page }) => {
    const token = 'token-xmind-full-cases-empty-workspace-isolation';
    const user = { id: 241, username: 'demo_user_full_cases_empty_isolation', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRawXmindModelResponse(page, JSON.stringify({
      modules: [{
        module: '登录模块',
        key_scenarios: ['登录主流程'],
        test_points: ['账号密码校验'],
        coupled_modules: ['用户中心'],
        cases: [],
      }, {
        module: '支付模块',
        key_scenarios: ['支付主流程'],
        test_points: ['支付结果校验'],
        coupled_modules: ['订单模块'],
        cases: [],
      }],
    }), 120);

    await openXmindCaseGenDrawer(page);
    await createXmindWorkspaceByManualPrep(page, '空结果页签-A', '需求A：模型可能返回模块骨架，但没有任何有效用例。', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await createXmindWorkspaceByManualPrep(page, '空结果页签-B', '需求B：该页签没有触发生成，不应继承其他页签的提示。', {
      completePrep: true,
    });

    const workspaceATab = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '空结果页签-A',
    });
    const workspaceBTab = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '空结果页签-B',
    });

    await workspaceATab.click();
    await waitForNodeText(page, '空结果页签-A');
    await openNodeContextMenu(page, '空结果页签-A');
    await clickContextMenuAction(page, '生成全量用例');

    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var xmind = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      var history = xmind && Array.isArray(xmind.history) ? xmind.history : [];
      var results = state && state.caseGenResults && typeof state.caseGenResults === 'object'
        ? state.caseGenResults
        : {};
      return Boolean(
        xmind
        && xmind.root
        && xmind.root.running !== true
        && history.length > 0
        && Array.isArray(state.caseGenModules)
        && state.caseGenModules.length === 0
        && Object.keys(results).length === 0
      );
    }, {}, { timeout: 15000 });

    await expect(page.locator('#xmindCaseGenStatus')).toHaveText('本轮未生成新的模块或用例');
    await expect(workspaceATab).toContainText('0 模块');
    await expect(workspaceATab).toContainText('0 用例');

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('根节点 · 空结果页签-A');
    await expect(latestCard).toContainText('本次没有新增结果');
    await expect(latestCard).toContainText('这次没有生成出任何模块或用例。');
    await expect(latestCard).not.toContainText('0 条用例');
    await clickElementById(page, 'xmindCaseGenHistoryBtn');

    await workspaceBTab.click();
    await waitForNodeText(page, '空结果页签-B');
    await expect.poll(async () => {
      return await page.locator('#xmindCaseGenStatus').evaluate((el) => String(el && el.textContent || '').trim());
    }).toBe('');
    await expect(workspaceBTab).toContainText('0 模块');
    await expect(workspaceBTab).toContainText('0 用例');

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('暂无生成记录');

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    const progressCardA = page.locator('#caseGenProgressList [data-casegen-workspace]', {
      hasText: '空结果页签-A',
    }).first();
    const progressCardB = page.locator('#caseGenProgressList [data-casegen-workspace]', {
      hasText: '空结果页签-B',
    }).first();

    await progressCardB.click();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('空结果页签-B');
    await waitForNodeText(page, '空结果页签-B');
    await expect.poll(async () => {
      return await page.locator('#xmindCaseGenStatus').evaluate((el) => String(el && el.textContent || '').trim());
    }).toBe('');
    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    await progressCardA.click();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('空结果页签-A');
    await waitForNodeText(page, '空结果页签-A');
    await expect(page.locator('#xmindCaseGenStatus')).toHaveText('本轮未生成新的模块或用例');
  });

  test('生成记录会把模型错误显示为通俗失败原因', async ({ page }) => {
    const token = 'token-xmind-history-model-error';
    const user = { id: 25, username: 'demo_user_history_model_error', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRejectedXmindModelResponse(page, '503 Service Unavailable', 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证模型调用出错时，生成记录会写出通俗失败原因。',
      requirementLabel: 'XMind模型调用错误需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind模型调用错误需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('生成失败');
    await expect(latestCard).toContainText('失败原因：');
    await expect(latestCard).toContainText('模型服务暂时不可用，请稍后重试。');
    await expect(latestCard).toContainText('错误信息：503 Service Unavailable');
  });

  test('生成记录会完整展示长错误信息，不再截断为省略号', async ({ page }) => {
    const token = 'token-xmind-history-long-error';
    const user = { id: 251, username: 'demo_user_history_long_error', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    const longError = 'HTTP 429: InvokeModel: operation error Bedrock Runtime: InvokeModel, exceeded maximum number of attempts, 3, https response headers: x-request-id=req-001 retry-after=60 upstream-trace=bedrock-limit-test long-tail-marker-bedrock-rate-limit';

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRejectedXmindModelResponse(page, longError, 120);
    await seedDocumentRequirement(page, {
      text: '需求：验证长错误信息在生成记录里会完整展示，不会被截断。',
      requirementLabel: 'XMind长错误信息需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind长错误信息需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('生成失败');
    await expect(latestCard).toContainText('long-tail-marker-bedrock-rate-limit');
    const errorBlock = latestCard.locator('.xmind-casegen-history-diagnostic-block').first();
    await expect(errorBlock).toContainText('错误信息：');
    await expect(errorBlock).toContainText('long-tail-marker-bedrock-rate-limit');
    const blockStyle = await errorBlock.evaluate((node) => {
      var textEl = node && node.querySelector ? node.querySelector('.xmind-casegen-history-diagnostic-block-text') : null;
      var target = textEl || node;
      var style = window.getComputedStyle(target);
      return {
        whiteSpace: String(style.whiteSpace || ''),
        textOverflow: String(style.textOverflow || ''),
      };
    });
    expect(blockStyle.whiteSpace).not.toBe('nowrap');
    expect(blockStyle.textOverflow).not.toBe('ellipsis');
  });

  test('DeepSeek 模型在 XMind 提示词下不会误判为 JSON 数组并可正常生成', async ({ page }) => {
    const token = 'token-xmind-deepseek-object-shape';
    const user = { id: 29, username: 'demo_user_deepseek_object_shape', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      modelBaseUrl: 'https://api.deepseek.com/chat/completions',
      modelName: 'deepseek-reasoner',
      modelCapabilities: ['chat'],
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyRecorder(page, {
      responseText: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[],"cases":[]}]}',
    });
    await seedDocumentRequirement(page, {
      text: '需求：验证 DeepSeek 在 XMind 提示词下按对象结构返回时仍可被正常解析。',
      requirementLabel: 'XMind DeepSeek 结构需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind DeepSeek 结构需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeText(page, '登录模块');
    await expect(page.locator('.temp-center-toast')).toHaveCount(0);
  });

  test('生成记录会展示代理返回的 HTTP 503 具体错误信息', async ({ page }) => {
    const token = 'token-xmind-history-http-503';
    const user = { id: 28, username: 'demo_user_history_http_503', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyHttpError(page, {
      status: 503,
      rawBody: JSON.stringify({
        detail: '连接模型服务失败：上游服务暂时不可用',
      }),
    });
    await seedDocumentRequirement(page, {
      text: '需求：验证代理 HTTP 503 时，生成记录会保留真实错误详情。',
      requirementLabel: 'XMind代理503需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind代理503需求');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('生成失败');
    await expect(latestCard).toContainText('失败原因：');
    await expect(latestCard).toContainText('模型服务暂时不可用，请稍后重试。');
    await expect(latestCard).toContainText('错误信息：HTTP 503：连接模型服务失败：上游服务暂时不可用');
  });

  test('补全失败时工具栏只显示短提示，详细错误写入生成记录', async ({ page }) => {
    const token = 'token-xmind-topup-error-short-status';
    const user = { id: 281, username: 'demo_user_topup_error_short_status', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindProxyHttpError(page, {
      status: 503,
      rawBody: JSON.stringify({
        detail: '连接模型服务失败：上游服务暂时不可用',
      }),
    });
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '成功页签-A', '需求A：已有成功结果，别的页签失败后不能被串成失败。', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-success',
      title: '成功模块',
      scenarios: ['成功主场景'],
      points: ['成功校验点'],
      coupled: ['成功关联模块'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-success': [{
        module: '成功模块',
        title: '成功用例',
        priority: 'P1',
        preconditions: '前置条件',
        steps: ['1、执行成功流程'],
        expected: '成功结果正确',
      }],
    });
    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: '成功页签-A',
    });

    await createXmindWorkspaceByManualPrep(page, 'XMind补全失败需求', '需求B：验证失败态只留在当前失败页签，不串到其他页签。', {
      completePrep: true,
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await syncActiveWorkspaceSnapshotFromLiveState(page, {
      workspaceName: 'XMind补全失败需求',
    });

    await waitForNodeText(page, 'XMind补全失败需求');
    await waitForNodeText(page, '登录模块');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '补全模块+用例');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var history = state && state.xmindCaseGen ? state.xmindCaseGen.history : null;
      return Boolean(Array.isArray(history) && history.length > 0);
    }, {}, { timeout: 15000 });

    await expect(page.locator('#xmindCaseGenStatus')).toHaveText('补全失败');
    await expect(page.locator('#xmindCaseGenStatus')).not.toContainText('HTTP 503');
    await expect(page.locator('#xmindCaseGenStatus')).not.toContainText('上游服务暂时不可用');
    const failedWorkspaceTab = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active');
    const successWorkspaceTab = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '成功页签-A',
    }).first();
    const failedProgressCard = page.locator('#caseGenProgressList [data-casegen-workspace]', {
      hasText: 'XMind补全失败需求',
    }).first();
    const successProgressCard = page.locator('#caseGenProgressList [data-casegen-workspace]', {
      hasText: '成功页签-A',
    }).first();

    await expect(failedWorkspaceTab).toContainText('失败');
    await expect(successWorkspaceTab).not.toContainText('失败');
    await expect(successWorkspaceTab).toContainText('未入库');
    await expect(failedProgressCard).toContainText('失败');
    await expect(successProgressCard).not.toContainText('失败');
    await expect(successProgressCard).toContainText('未入库');

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('补全失败');
    await expect(latestCard).toContainText('失败原因：');
    await expect(latestCard).toContainText('模型服务暂时不可用，请稍后重试。');
    await expect(latestCard).toContainText('错误信息：HTTP 503：连接模型服务失败：上游服务暂时不可用');
  });

  test('根节点支持生成全量模块与生成全量用例，并在刷新后恢复共享结果', async ({ page }) => {
    const token = 'token-xmind-root';
    const user = { id: 2, username: 'demo_user_2', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    const workflowUrl = await gotoCasesgenWorkflow(page);

    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 420);
    await seedDocumentRequirement(page, {
      text: '需求：支持登录与支付模块的完整测试覆盖。',
      requirementLabel: 'XMind根节点需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind根节点需求');

    await openNodeContextMenu(page, 'XMind根节点需求');
    const initialItems = await getContextMenuItems(page);
    expect(initialItems.map((item) => item.label)).toEqual(['生成全量用例', '生成全量模块']);
    await clickContextMenuAction(page, '生成全量模块');

    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');

    await openNodeContextMenu(page, 'XMind根节点需求');
    const skeletonItems = await getContextMenuItems(page);
    expect(skeletonItems.map((item) => item.label)).toEqual([
      '重新生成全量用例',
      '重新生成模块',
      '已有模块补全用例',
      '补全模块',
      '补全模块+用例',
      '放弃本次生成',
    ]);
    expect(skeletonItems[5].disabled).toBe(false);
    await clickContextMenuAction(page, '重新生成全量用例');

    await waitForNodeStatus(page, 'XMind根节点需求', '生成中');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeStatusAbsent(page, 'XMind根节点需求');

    const stateWithCases = await readState(page);
    const loginModuleWithCases = (stateWithCases.caseGenModules || []).find((item) => String(item.title || '') === '登录模块');
    expect(loginModuleWithCases).toBeTruthy();
    const loginCasesBeforeRegenModules = await readCaseResults(page, loginModuleWithCases.id);
    expect(loginCasesBeforeRegenModules.length).toBeGreaterThan(0);
    expect(loginCasesBeforeRegenModules[0].steps[0]).toMatch(/^1、/);
    expect(loginCasesBeforeRegenModules[0].steps[1]).toMatch(/^2、/);
    const renderedStepsNodeText = await page.evaluate(() => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc');
      var found = '';
      Array.prototype.some.call(nodes, function(node) {
        var textEl = node && node.querySelector ? node.querySelector('.text') : null;
        var content = textEl && typeof textEl.innerText === 'string'
          ? String(textEl.innerText || '')
          : (textEl && textEl.textContent ? String(textEl.textContent || '') : '');
        if (content.indexOf('1、进入登录模块') === -1) return false;
        if (content.indexOf('2、执行登录模块-完整-1') === -1) return false;
        found = content;
        return true;
      });
      return found;
    });
    expect(renderedStepsNodeText).toBeTruthy();
    expect(renderedStepsNodeText).not.toContain(' / ');

    await openNodeContextMenu(page, 'XMind根节点需求');
    const regenItems = await getContextMenuItems(page);
    expect(regenItems.map((item) => item.label)).toEqual([
      '重新生成全量用例',
      '重新生成模块',
      '已有模块补全用例',
      '补全模块',
      '补全模块+用例',
      '放弃本次生成',
    ]);

    await clickContextMenuAction(page, '重新生成全量用例');
    await waitForNodeStatus(page, 'XMind根节点需求', '生成中');
    await waitForNodeTextAbsent(page, '登录模块');
    await waitForNodeTextAbsent(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录模块-完整-1');
    await waitForNodeStatusAbsent(page, 'XMind根节点需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeText(page, '登录模块-完整-1');

    const stateAfterRegenCases = await readState(page);
    const loginModuleAfterRegenCases = (stateAfterRegenCases.caseGenModules || []).find((item) => String(item.title || '') === '登录模块');
    expect(loginModuleAfterRegenCases).toBeTruthy();
    const loginCasesAfterRegenCases = await readCaseResults(page, loginModuleAfterRegenCases.id);
    expect(loginCasesAfterRegenCases.length).toBeGreaterThan(0);
    const lastRootFullCasesCall = await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      for (var i = calls.length - 1; i >= 0; i -= 1) {
        var item = calls[i];
        if (!item || !item.contract) continue;
        if (String(item.contract.scope || '') !== 'root') continue;
        if (String(item.contract.mode || '') !== 'full_cases') continue;
        return {
          user: String(item.user || ''),
          prompt: String(item.prompt || ''),
        };
      }
      return null;
    });
    expect(lastRootFullCasesCall).toBeTruthy();
    expect(lastRootFullCasesCall.user).toContain('【需求正文】\n需求：支持登录与支付模块的完整测试覆盖。');
    expect(lastRootFullCasesCall.user).toContain('【当前可见模块与用例(JSON)】\n[]');
    expect(lastRootFullCasesCall.user).toContain('【当前 AI 生成层(JSON)】\n[]');

    await openNodeContextMenu(page, 'XMind根节点需求');
    await clickContextMenuAction(page, '重新生成模块');
    await waitForNodeStatus(page, 'XMind根节点需求', '生成中');
    await waitForNodeTextAbsent(page, '登录模块');
    await waitForNodeTextAbsent(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录模块-完整-1');
    await waitForNodeStatusAbsent(page, 'XMind根节点需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');

    const stateBeforeReload = await readState(page);
    const loginModule = (stateBeforeReload.caseGenModules || []).find((item) => String(item.title || '') === '登录模块');
    expect(loginModule).toBeTruthy();
    const loginCases = await readCaseResults(page, loginModule.id);
    expect(loginCases.length).toBe(0);

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await page.waitForFunction(() => {
      var api = window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
      return Boolean(api && typeof api.renderMindMap === 'function');
    }, {}, { timeout: 20000 });
    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录成功校验');
  });

  test('先生成模块再刷新，再重新生成全量用例并刷新，完成提示仍保留正确模块数', async ({ page }) => {
    const token = 'token-xmind-root-refresh-status';
    const user = { id: 212, username: 'demo_user_root_refresh_status', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    await installXmindModelRouteStub(page, 420);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：先生成模块后刷新，再生成完整用例并刷新，最终完成提示仍应保留正确模块数。',
      requirementLabel: 'XMind刷新提示需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind刷新提示需求');
    await openNodeContextMenu(page, 'XMind刷新提示需求');
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind刷新提示需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, 'XMind刷新提示需求');
    await clickContextMenuAction(page, '重新生成全量用例');
    await page.waitForFunction(() => {
      var state = window.app && window.app.state && window.app.state.xmindCaseGen
        ? window.app.state.xmindCaseGen
        : null;
      if (state && state.root && state.root.running === true) return true;
      try {
        var raw = localStorage.getItem('tap-xmind-casegen-tasks');
        var list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) && list.some(function(item) {
          return item && item.status === 'running';
        });
      } catch (err) {
        return false;
      }
    }, {}, { timeout: 10000 });

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await waitForNodeText(page, 'XMind刷新提示需求');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付成功校验');
    await expect(page.locator('#xmindCaseGenStatus')).toHaveText('已重新生成 2 个模块，4 条用例');
  });

  test('根节点生成全量用例会先展示模块骨架，再逐个展示模块用例', async ({ page }) => {
    const token = 'token-xmind-root-pipeline';
    const user = { id: 202, username: 'demo_user_202', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installRootPipelineStaggeredStub(page);
    await seedDocumentRequirement(page, {
      text: '需求：先生成模块骨架，再按模块依次补齐登录与支付用例。',
      requirementLabel: 'XMind分批展示需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind分批展示需求');
    await openNodeContextMenu(page, 'XMind分批展示需求');
    await clickContextMenuAction(page, '生成全量用例');

    await waitForNodeStatus(page, 'XMind分批展示需求', '生成中');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录模块-首批用例');
    await waitForNodeTextAbsent(page, '支付模块-尾批用例');
    const beforePan = await readXmindCasegenViewSnapshot(page);
    await panXmindCasegenCanvas(page, 320, 140);
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      return Boolean(map && map.style && String(map.style.transform || '') !== String(beforeTransform || ''));
    }, beforePan.transform || '', { timeout: 10000 });
    const rootBeforeStream = await readXmindRootCenter(page);
    expect(rootBeforeStream).not.toBeNull();
    const transformBeforeStream = await page.evaluate(() => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      return map && map.style ? String(map.style.transform || '') : '';
    });

    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var modules = state && Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      var login = modules.find(function(item) { return String(item && item.title || '') === '登录模块'; });
      var pay = modules.find(function(item) { return String(item && item.title || '') === '支付模块'; });
      var results = state && state.caseGenResults ? state.caseGenResults : {};
      var loginRaw = login && login.id && results[login.id] ? String(results[login.id] || '') : '';
      var payRaw = pay && pay.id && results[pay.id] ? String(results[pay.id] || '') : '';
      var root = state && state.xmindCaseGen && state.xmindCaseGen.root ? state.xmindCaseGen.root : null;
      return Boolean(
        root &&
        root.running === true &&
        payRaw.indexOf('支付模块-尾批用例') !== -1 &&
        loginRaw.indexOf('登录模块-首批用例') === -1
      );
    }, {}, { timeout: 15000 });
    expect(await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindPipelineCalls) ? window.__xmindPipelineCalls : [];
      return calls.filter(function(item) {
        return item && item.mode === 'ai_dedupe_simplify';
      }).length;
    })).toBe(0);
    await waitForNodeText(page, '支付模块-尾批用例');
    await waitForNodeTextAbsent(page, '登录模块-首批用例');
    const rootAfterFirstStream = await readXmindRootCenter(page);
    expect(rootAfterFirstStream).not.toBeNull();
    const transformAfterFirstStream = await page.evaluate(() => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      return map && map.style ? String(map.style.transform || '') : '';
    });
    const transformBeforeParsed = parseMindTransformText(transformBeforeStream);
    const transformAfterParsed = parseMindTransformText(transformAfterFirstStream);
    expect(Math.abs(transformAfterParsed.scale - transformBeforeParsed.scale)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(rootAfterFirstStream.x - rootBeforeStream.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(rootAfterFirstStream.y - rootBeforeStream.y)).toBeLessThanOrEqual(6);
    await page.waitForFunction(() => {
      var calls = Array.isArray(window.__xmindPipelineCalls) ? window.__xmindPipelineCalls : [];
      var loginCall = null;
      var payCall = null;
      calls.forEach(function(item) {
        if (!item) return;
        if (item.mode === 'module_full_cases' && item.targetModule === '登录模块') loginCall = item;
        if (item.mode === 'module_full_cases' && item.targetModule === '支付模块') payCall = item;
      });
      if (!loginCall || !payCall) return false;
      return Math.abs(Number(payCall.startedAt || 0) - Number(loginCall.startedAt || 0)) <= 400;
    }, {}, { timeout: 10000 });

    await waitForNodeText(page, '登录模块-首批用例');
    await waitForNodeText(page, '支付模块-尾批用例');
    const rootAfterAllStream = await readXmindRootCenter(page);
    expect(rootAfterAllStream).not.toBeNull();
    const transformAfterAllStream = await page.evaluate(() => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      return map && map.style ? String(map.style.transform || '') : '';
    });
    const transformAfterAllParsed = parseMindTransformText(transformAfterAllStream);
    expect(Math.abs(transformAfterAllParsed.scale - transformBeforeParsed.scale)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(rootAfterAllStream.x - rootBeforeStream.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(rootAfterAllStream.y - rootBeforeStream.y)).toBeLessThanOrEqual(6);
    await waitForNodeStatusAbsent(page, 'XMind分批展示需求');
    const pipelineCalls = await page.evaluate(() => {
      return Array.isArray(window.__xmindPipelineCalls) ? window.__xmindPipelineCalls.slice() : [];
    });
    expect(pipelineCalls.map(function(item) {
      return {
        mode: item.mode,
        targetModule: item.targetModule,
      };
    })).toEqual([
      { mode: 'full_cases', targetModule: '' },
      { mode: 'full_cases', targetModule: '' },
      { mode: 'module_full_cases', targetModule: '登录模块' },
      { mode: 'module_full_cases', targetModule: '支付模块' },
      { mode: 'ai_dedupe_simplify', targetModule: '' },
    ]);
  });

  test('导入用例作为主树基线后，根节点动作矩阵切换为补全模式并支持回滚到基线', async ({ page }) => {
    const token = 'token-xmind-baseline';
    const user = { id: 3, username: 'demo_user_3', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：在已有参考用例基础上补全消息模块与登录补充用例。',
      requirementLabel: 'XMind基线需求',
    });
    await seedImportedBaseline(page, [{
      module: '登录模块',
      title: '登录模块-基线用例',
      priority: 'P1',
      preconditions: '账号已存在',
      steps: ['1、进入登录页', '2、输入账号密码'],
      expected: '登录成功',
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'import',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块-基线用例');

    await openNodeContextMenu(page, 'XMind基线需求');
    const baselineItems = await getContextMenuItems(page);
    expect(baselineItems.map((item) => item.label)).toEqual([
      '补全模块',
      '补全模块+用例',
      '追加生成全部模块+用例',
      '放弃本次生成',
    ]);
    expect(baselineItems[3].disabled).toBe(true);
    await clickContextMenuAction(page, '追加生成全部模块+用例');

    await waitForNodeText(page, '登录模块-追加-1');
    await waitForNodeText(page, '消息模块');
    await waitForNodeText(page, '消息模块新增用例');

    await openNodeContextMenu(page, 'XMind基线需求');
    const afterAppendItems = await getContextMenuItems(page);
    expect(afterAppendItems[3].disabled).toBe(false);
    await clickContextMenuAction(page, '放弃本次生成');

    await waitForNodeText(page, '登录模块-基线用例');
    await waitForNodeTextAbsent(page, '登录模块-追加-1');
    await waitForNodeTextAbsent(page, '消息模块新增用例');
    await waitForNodeTextAbsent(page, '消息模块');
  });

  test('模块可并发生成，且根节点补模块动作不会阻塞现有模块生成', async ({ page }) => {
    const token = 'token-xmind-concurrency';
    const user = { id: 31, username: 'demo_user_31', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 900);
    await seedDocumentRequirement(page, {
      text: '需求：登录与支付模块允许独立生成，同时根节点可补充新模块。',
      requirementLabel: 'XMind并发需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await clickXmindNodeQuickAction(page, '登录模块');
    await waitForNodeStatus(page, '登录模块', '生成中');

    await openNodeContextMenu(page, 'XMind并发需求');
    const rootItemsWhileModuleRunning = await getContextMenuItems(page);
    expect(rootItemsWhileModuleRunning.find((item) => item.label === '重新生成全量用例').disabled).toBe(true);
    expect(rootItemsWhileModuleRunning.find((item) => item.label === '已有模块补全用例').disabled).toBe(true);
    expect(rootItemsWhileModuleRunning.find((item) => item.label === '补全模块').disabled).toBe(false);
    expect(rootItemsWhileModuleRunning.find((item) => item.label === '补全模块+用例').disabled).toBe(false);
    await clickContextMenuAction(page, '补全模块');
    await waitForNodeStatus(page, 'XMind并发需求', '生成中');

    await openNodeContextMenu(page, '支付模块');
    const payItemsWhileRootRunning = await getContextMenuItems(page);
    expect(payItemsWhileRootRunning.find((item) => item.label === '生成全量用例').disabled).toBe(false);
    expect(payItemsWhileRootRunning.find((item) => item.label === '追加生成').disabled).toBe(true);
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeStatus(page, '支付模块', '生成中');

    const runningState = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var xmind = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      var moduleMap = xmind && xmind.modules ? xmind.modules : {};
      var moduleRunningCount = Object.keys(moduleMap).filter(function(key) {
        return moduleMap[key] && moduleMap[key].running === true;
      }).length;
      return {
        rootRunning: Boolean(xmind && xmind.root && xmind.root.running === true),
        moduleRunningCount: moduleRunningCount,
      };
    });
    expect(runningState.rootRunning).toBe(true);
    expect(runningState.moduleRunningCount).toBeGreaterThanOrEqual(2);

    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeText(page, '支付模块-完整-1');
    await waitForNodeText(page, '消息模块');
    await waitForNodeStatusAbsent(page, '登录模块');
    await waitForNodeStatusAbsent(page, '支付模块');
    await waitForNodeStatusAbsent(page, 'XMind并发需求');
  });

  test('根节点追加全部模块+用例期间会阻塞模块用例生成', async ({ page }) => {
    const token = 'token-xmind-root-blocks-module';
    const user = { id: 32, username: 'demo_user_32', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 900);
    await seedDocumentRequirement(page, {
      text: '需求：基于参考用例追加补全所有模块和用例。',
      requirementLabel: 'XMind根冲突需求',
    });
    await seedImportedBaseline(page, [{
      module: '登录模块',
      title: '登录模块-基线用例',
      priority: 'P1',
      preconditions: '账号已存在',
      steps: ['1、进入登录页', '2、输入账号密码'],
      expected: '登录成功',
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'import',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块-基线用例');

    await openNodeContextMenu(page, 'XMind根冲突需求');
    await clickContextMenuAction(page, '追加生成全部模块+用例');
    await waitForNodeStatus(page, 'XMind根冲突需求', '生成中');

    await openNodeContextMenu(page, '登录模块');
    const moduleItemsWhileRootAppendRunning = await getContextMenuItems(page);
    expect(moduleItemsWhileRootAppendRunning.find((item) => item.label === '生成全量用例').disabled).toBe(true);
    expect(moduleItemsWhileRootAppendRunning.find((item) => item.label === '追加生成').disabled).toBe(true);
    expect(moduleItemsWhileRootAppendRunning.find((item) => item.label === '放弃本次生成').disabled).toBe(true);

    await waitForNodeText(page, '登录模块-追加-1');
    await waitForNodeText(page, '消息模块新增用例');
    await waitForNodeStatusAbsent(page, 'XMind根冲突需求');
  });

  test('根节点放弃本次生成按全局最近一次快照回退，不会误吞更早的模块骨架', async ({ page }) => {
    const token = 'token-xmind-global-rollback';
    const user = { id: 35, username: 'demo_user_35', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 220);
    await seedDocumentRequirement(page, {
      text: '需求：先由根节点生成模块，再由模块单独生成用例，根节点放弃时只回退最近一次模块生成。',
      requirementLabel: 'XMind全局快照需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind全局快照需求');

    await openNodeContextMenu(page, 'XMind全局快照需求');
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');

    await openNodeContextMenu(page, '登录模块');
    var loginModuleItems = await getContextMenuItems(page);
    expect(loginModuleItems.find((item) => item.label === '放弃本次生成').disabled).toBe(false);

    await openNodeContextMenu(page, '支付模块');
    var payModuleItems = await getContextMenuItems(page);
    expect(payModuleItems.find((item) => item.label === '放弃本次生成').disabled).toBe(true);

    await openNodeContextMenu(page, 'XMind全局快照需求');
    await clickContextMenuAction(page, '放弃本次生成');

    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeTextAbsent(page, '登录模块-完整-1');

    await openNodeContextMenu(page, '登录模块');
    loginModuleItems = await getContextMenuItems(page);
    expect(loginModuleItems.find((item) => item.label === '放弃本次生成').disabled).toBe(true);

    await openNodeContextMenu(page, 'XMind全局快照需求');
    var rootItemsAfterRollback = await getContextMenuItems(page);
    expect(rootItemsAfterRollback.find((item) => item.label === '放弃本次生成').disabled).toBe(false);
  });

  test('根节点已有模块补全用例会为已有用例模块新增内容渲染独立虚线框', async ({ page }) => {
    const token = 'token-xmind-root-existing-cases-highlight';
    const user = { id: 34, username: 'demo_user_34', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 900);
    await seedDocumentRequirement(page, {
      text: '需求：针对已有模块继续补全缺漏用例，并给新增用例标记本轮补全范围。',
      requirementLabel: 'XMind已有模块补全需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录模块-完整-1',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码'],
        expected: '登录成功',
      }],
      'xmind-mod-pay': [{
        module: '支付模块',
        title: '支付模块-完整-1',
        priority: 'P1',
        preconditions: '订单已创建',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeText(page, '支付模块-完整-1');
    await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-fit"]');
    await page.waitForTimeout(120);

    await openNodeContextMenu(page, 'XMind已有模块补全需求');
    await clickContextMenuAction(page, '已有模块补全用例');

    await waitForNodeStatus(page, 'XMind已有模块补全需求', '生成中');
    await page.waitForFunction(() => {
      var moduleBadges = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-module .xmind-node-status-badge');
      var placeholders = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-topup-placeholder');
      var casePendingCount = 0;
      Array.prototype.forEach.call(placeholders, function(node) {
        if (String(node.textContent || '').indexOf('补全用例中') !== -1) casePendingCount += 1;
      });
      return moduleBadges.length === 0 && casePendingCount === 2;
    }, {}, { timeout: 15000 });
    const pendingQuickActionOverlap = await page.evaluate(() => {
      function intersects(a, b) {
        if (!a || !b) return false;
        return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      }
      var quickButtons = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-module .xmind-node-quick-action');
      var placeholders = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-topup-placeholder');
      var placeholderRects = [];
      Array.prototype.forEach.call(placeholders, function(node) {
        if (!node || !node.getBoundingClientRect) return;
        var text = String(node.textContent || '');
        if (text.indexOf('补全用例中') === -1) return;
        placeholderRects.push(node.getBoundingClientRect());
      });
      return Array.prototype.some.call(quickButtons, function(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        return placeholderRects.some(function(target) { return intersects(rect, target); });
      });
    });
    expect(pendingQuickActionOverlap).toBe(false);

    await waitForNodeText(page, '登录模块-追加-1');
    await waitForNodeText(page, '支付模块-追加-1');
    await waitForNodeStatusAbsent(page, '登录模块');
    await waitForNodeStatusAbsent(page, '支付模块');
    await waitForNodeStatusAbsent(page, 'XMind已有模块补全需求');
    await page.click('#xmindCaseGenMindContainer [data-mind-action="zoom-fit"]');
    await page.waitForTimeout(180);
    await page.waitForFunction(() => {
      var frames = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
      return frames && frames.length === 2;
    }, {}, { timeout: 15000 });

    const groups = await readTopupHighlightGroups(page);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((item) => item.token)).size).toBe(2);
    expect(groups.every((item) => item.label === '本轮补全用例')).toBeTruthy();
    expect(groups.every((item) => item.nodeCount >= 5)).toBeTruthy();

    const frames = await readAllTopupHighlightFrames(page);
    expect(frames).toHaveLength(2);
    expect(frames.every((item) => item.label === '本轮补全用例')).toBeTruthy();
    expect(frames.every((item) => item.highlightedNodeCount >= 5)).toBeTruthy();

    await page.evaluate(() => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
      var targetToken = '';
      Array.prototype.some.call(nodes, function(node) {
        var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
        if (!token || targetToken) return false;
        targetToken = token;
        return true;
      });
      if (!targetToken) return;
      Array.prototype.forEach.call(nodes, function(node) {
        var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
        if (token !== targetToken || !node || !node.style) return;
        node.style.transform = 'translateY(2200px)';
      });
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(260);

    const framesAfterOffscreen = await readAllTopupHighlightFrames(page);
    expect(framesAfterOffscreen).toHaveLength(2);
  });

  test('根节点补全模块会在追加位置展示生成中占位，并在完成后框选新增模块', async ({ page }) => {
    const token = 'token-xmind-root-topup-modules';
    const user = { id: 36, username: 'demo_user_36', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 320);
    await seedDocumentRequirement(page, {
      text: '需求：在已有模块基础上补全一个新模块，并对新增模块进行高亮标记。',
      requirementLabel: 'XMind根补模块需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind根补模块需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, 'XMind根补模块需求');
    await clickContextMenuAction(page, '补全模块');

    await page.waitForFunction(() => {
      var placeholders = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-topup-placeholder');
      var hasPlaceholder = Array.prototype.some.call(placeholders, function(node) {
        return String(node.textContent || '').indexOf('补全模块中') !== -1;
      });
      var hasPendingLink = Boolean(document.querySelector('#xmindCaseGenMindContainer path[data-xmind-casegen-link="topup-pending"]'));
      return hasPlaceholder && hasPendingLink;
    }, {}, { timeout: 15000 });

    await waitForNodeText(page, '消息模块');
    await page.waitForFunction(() => {
      var frames = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
      return frames && frames.length === 1;
    }, {}, { timeout: 15000 });

    const groups = await readTopupHighlightGroups(page);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('本轮补全模块');
    expect(groups[0].nodeCount).toBeGreaterThanOrEqual(1);

    const frames = await readAllTopupHighlightFrames(page);
    expect(frames).toHaveLength(1);
    expect(frames[0].label).toBe('本轮补全模块');
    expect(frames[0].highlightedNodeCount).toBeGreaterThanOrEqual(1);
    expect(frames[0].rect).toBeTruthy();
  });

  test('根节点补全模块+用例为多个新增模块分别渲染独立追加虚线框', async ({ page }) => {
    const token = 'token-xmind-root-topup-frames';
    const user = { id: 33, username: 'demo_user_33', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 220);
    await seedDocumentRequirement(page, {
      text: '需求：已有模块基础上补全两个中文模块，并分别生成 5 条补充用例。',
      requirementLabel: 'XMind根追加高亮需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, 'XMind根追加高亮需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');

    await openNodeContextMenu(page, 'XMind根追加高亮需求');
    await clickContextMenuAction(page, '补全模块+用例');
    await page.waitForFunction(() => {
      var placeholders = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc.xmind-casegen-node-topup-placeholder');
      var hasPlaceholder = Array.prototype.some.call(placeholders, function(node) {
        return String(node.textContent || '').indexOf('补全模块+用例中') !== -1;
      });
      var hasPendingLink = Boolean(document.querySelector('#xmindCaseGenMindContainer path[data-xmind-casegen-link="topup-pending"]'));
      return hasPlaceholder && hasPendingLink;
    }, {}, { timeout: 15000 });

    await waitForNodeText(page, '技能按钮与界面状态');
    await waitForNodeText(page, '异常状态与边界处理');
    await waitForNodeText(page, '技能按钮与界面状态-补充-5');
    await waitForNodeText(page, '异常状态与边界处理-补充-5');

    await page.waitForFunction(() => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
      var groups = {};
      Array.prototype.forEach.call(nodes, function(node) {
        var token = node && node.getAttribute ? String(node.getAttribute('data-xmind-topup-highlight-token') || '') : '';
        if (!token) return;
        groups[token] = true;
      });
      return Object.keys(groups).length === 2;
    }, {}, { timeout: 15000 });

    const groups = await readTopupHighlightGroups(page);
    expect(groups).toHaveLength(2);
    expect(groups.map((item) => item.label)).toEqual(['本轮补全模块+用例 · 5 条', '本轮补全模块+用例 · 5 条']);
    expect(new Set(groups.map((item) => item.token)).size).toBe(2);
    expect(groups.every((item) => item.nodeCount >= 26)).toBeTruthy();

    const frames = await readAllTopupHighlightFrames(page);
    expect(new Set(frames.map((item) => item.token)).size).toBe(frames.length);
    frames.forEach((item) => {
      expect(item.label).toBe('本轮补全模块+用例 · 5 条');
      expect(item.highlightedNodeCount).toBeGreaterThanOrEqual(26);
      expect(item.rect).toBeTruthy();
    });
    if (frames.length === 2) {
      expect(
        Math.abs(frames[0].rect.left - frames[1].rect.left) > 3
        || Math.abs(frames[0].rect.top - frames[1].rect.top) > 3
      ).toBeTruthy();
    }
  });

  test('模块节点 +AI 默认动作会从全量生成切换为追加生成，并支持追加高亮与放弃回滚', async ({ page }) => {
    const token = 'token-xmind-module';
    const user = { id: 4, username: 'demo_user_4', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 220);
    await seedDocumentRequirement(page, {
      text: '需求：仅针对登录模块进行全量与追加生成。',
      requirementLabel: 'XMind模块需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块');
    const quickActionScope = await page.evaluate(() => {
      var allButtons = document.querySelectorAll('#xmindCaseGenMindContainer .xmind-node-quick-action');
      var nonModuleButtons = document.querySelectorAll('#xmindCaseGenMindContainer me-tpc:not(.xmind-casegen-node-module) .xmind-node-quick-action');
      return {
        all: allButtons.length,
        nonModule: nonModuleButtons.length,
      };
    });
    expect(quickActionScope.all).toBeGreaterThan(0);
    expect(quickActionScope.nonModule).toBe(0);

    await openNodeContextMenu(page, '登录模块');
    const emptyModuleItems = await getContextMenuItems(page);
    expect(emptyModuleItems.map((item) => item.label)).toEqual([
      '生成全量用例',
      '追加生成',
      '放弃本次生成',
      '删除',
    ]);
    expect(emptyModuleItems.find((item) => item.label === '生成全量用例').disabled).toBe(false);
    expect(emptyModuleItems.find((item) => item.label === '追加生成').disabled).toBe(true);
    expect(emptyModuleItems.find((item) => item.label === '放弃本次生成').disabled).toBe(true);

    let quickActionId = await getNodeQuickActionId(page, '登录模块');
    expect(quickActionId).toBe('module-full-cases');

    await clickXmindNodeQuickAction(page, '登录模块');
    await waitForNodeStatus(page, '登录模块', '生成中');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeStatusAbsent(page, '登录模块');
    expect(await page.evaluate(() => {
      var calls = Array.isArray(window.__xmindCasegenCalls) ? window.__xmindCasegenCalls : [];
      return calls.filter(function(item) {
        return item && item.contract && String(item.contract.mode || '') === 'ai_dedupe_simplify';
      }).length;
    })).toBe(0);

    await openNodeContextMenu(page, '登录模块');
    const fullCaseItems = await getContextMenuItems(page);
    expect(fullCaseItems.map((item) => item.label)).toEqual([
      '重新生成全量用例',
      '追加生成',
      '放弃本次生成',
      '删除',
    ]);
    await clickContextMenuAction(page, '重新生成全量用例');
    await waitForNodeStatus(page, '登录模块', '生成中');
    await waitForNodeTextAbsent(page, '登录模块-完整-1');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeStatusAbsent(page, '登录模块');

    quickActionId = await getNodeQuickActionId(page, '登录模块');
    expect(quickActionId).toBe('module-append');

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '追加生成');
    await waitForNodeText(page, '追加生成中');
    await page.waitForFunction(() => {
      return Boolean(document.querySelector('#xmindCaseGenMindContainer path[data-xmind-casegen-link="topup-pending"]'));
    }, {}, { timeout: 15000 });
    await waitForNodeText(page, '登录模块-追加-1');
    await page.waitForFunction(() => {
      var frame = document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
      if (!frame) return false;
      var label = frame.querySelector('.xmind-casegen-topup-highlight-label');
      return Boolean(label && String(label.textContent || '').indexOf('本轮追加用例') !== -1);
    }, {}, { timeout: 15000 });
    await page.waitForFunction(() => {
      var nodes = document.querySelectorAll('#xmindCaseGenMindContainer [data-xmind-topup-highlight-token]');
      return nodes && nodes.length >= 5;
    }, {}, { timeout: 15000 });

    var metricsBeforePan = await readTopupHighlightMetrics(page);
    expect(metricsBeforePan).toBeTruthy();
    expect(metricsBeforePan.highlightedNodeCount).toBeGreaterThanOrEqual(5);
    expect(metricsBeforePan.frame.left).toBeLessThan(metricsBeforePan.union.left - 8);
    expect(metricsBeforePan.frame.top).toBeLessThan(metricsBeforePan.union.top - 8);
    expect(metricsBeforePan.frame.right).toBeGreaterThan(metricsBeforePan.union.right + 8);
    expect(metricsBeforePan.frame.bottom).toBeGreaterThan(metricsBeforePan.union.bottom + 8);

    var panResult = await panXmindCasegenCanvas(page, 160, 90);
    expect(panResult.dispatched).toBeTruthy();
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      if (!map || !map.style) return false;
      return String(map.style.transform || '') !== String(beforeTransform || '');
    }, panResult.before, { timeout: 15000 });

    var metricsAfterPan = await readTopupHighlightMetrics(page);
    expect(metricsAfterPan).toBeTruthy();
    expect(Math.abs(metricsAfterPan.frame.left - metricsBeforePan.frame.left)).toBeGreaterThan(10);
    expect(Math.abs(metricsAfterPan.union.left - metricsBeforePan.union.left)).toBeGreaterThan(10);
    expect(Math.abs((metricsAfterPan.frame.left - metricsBeforePan.frame.left) - (metricsAfterPan.union.left - metricsBeforePan.union.left))).toBeLessThan(3);
    expect(Math.abs((metricsAfterPan.frame.top - metricsBeforePan.frame.top) - (metricsAfterPan.union.top - metricsBeforePan.union.top))).toBeLessThan(3);

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '放弃本次生成');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeTextAbsent(page, '登录模块-追加-1');
    await page.waitForFunction(() => {
      return !document.querySelector('#xmindCaseGenMindContainer [data-xmind-casegen-topup-frame]');
    }, {}, { timeout: 15000 });
  });

  test('用例子节点右键菜单支持删除，删除后会清空回退快照并以当前树为新的生成上下文', async ({ page }) => {
    const token = 'token-xmind-delete-case';
    const user = { id: 41, username: 'demo_user_41', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：允许在 XMind 中删除单条用例，并确保后续生成不再读取被删内容。',
      requirementLabel: 'XMind删除用例需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickXmindNodeQuickAction(page, '登录模块');
    await waitForNodeText(page, '登录模块-完整-1');
    await waitForNodeText(page, '登录模块前置条件');
    await autoAcceptXmindConfirm(page);

    await selectXmindNode(page, '登录模块前置条件');
    await openNodeContextMenu(page, '登录模块前置条件');
    const caseChildItems = await getContextMenuItems(page);
    expect(caseChildItems.map((item) => item.label)).toEqual(['删除']);
    expect(caseChildItems[0].disabled).toBe(false);
    await clickVisibleContextMenuAction(page, '删除');
    await expect(page.locator('.xmind-node-context-menu.is-open')).toHaveCount(0);
    await page.waitForFunction(() => Boolean(window.__xmindConfirmPayload), {}, { timeout: 5000 });

    await waitForNodeTextAbsent(page, '登录模块-完整-1');

    const stateAfterDelete = await readState(page);
    expect(stateAfterDelete.xmindCaseGen.operationSnapshots).toEqual([]);
    expect(stateAfterDelete.xmindCaseGen.lastOperationSnapshotId).toBe('');
    expect(stateAfterDelete.xmindCaseGen.rootSnapshotId).toBe('');

    await openNodeContextMenu(page, '登录模块');
    await clickVisibleContextMenuAction(page, '生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');

    const calls = await page.evaluate(() => window.__xmindCasegenCalls || []);
    const lastCall = calls[calls.length - 1] || null;
    expect(lastCall).toBeTruthy();
    expect(String(lastCall.user || '')).not.toContain('登录模块-完整-1');
  });

  test('支持按住 Ctrl 点击多个模块或用例后批量删除，后续生成上下文与当前可见树保持一致', async ({ page }) => {
    const token = 'token-xmind-delete-multi';
    const user = { id: 42, username: 'demo_user_42', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：支持多选批量删除模块和用例，删除后继续按当前画布生成。',
      requirementLabel: 'XMind批量删除需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码并提交'],
        expected: '提示账号或密码错误',
      }],
      'xmind-mod-pay': [{
        module: '支付模块',
        title: '支付成功校验',
        priority: 'P1',
        preconditions: '订单待支付',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '支付模块');
    await autoAcceptXmindConfirm(page);
    await clickXmindNode(page, '支付模块');
    await ctrlClickXmindNodes(page, ['登录成功校验']);
    await expect.poll(async () => {
      return await readSelectedXmindNodeCount(page);
    }).toBeGreaterThanOrEqual(2);
    await pressDeleteInXmind(page);
    await page.waitForFunction(() => Boolean(window.__xmindConfirmPayload), {}, { timeout: 5000 });

    await waitForNodeTextAbsent(page, '支付模块');
    await waitForNodeTextAbsent(page, '支付成功校验');
    await waitForNodeTextAbsent(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');

    const stateAfterDelete = await readState(page);
    expect((stateAfterDelete.caseGenModules || []).map((item) => item.title)).toEqual(['登录模块']);
    const loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录失败提示']);
    expect(stateAfterDelete.caseGenResults['xmind-mod-pay']).toBeUndefined();

    await beginHeldDragBoxSelectXmindNodes(page, ['登录失败提示']);
    await expect.poll(async () => {
      return await page.evaluate(() => {
        var rect = document.querySelector('#xmindCaseGenMindContainer .xmind-box-select-rect');
        if (!rect || typeof window === 'undefined' || !window.getComputedStyle) return '';
        return String(window.getComputedStyle(rect).display || '');
      });
    }).toBe('block');
    await page.mouse.up();
    await page.waitForTimeout(360);
    await expect.poll(async () => {
      return await readSelectedXmindNodeLabels(page);
    }).toEqual(['登录失败提示']);

    await openNodeContextMenu(page, '登录模块');
    await clickContextMenuAction(page, '重新生成全量用例');
    await waitForNodeText(page, '登录模块-完整-1');

    const calls = await page.evaluate(() => window.__xmindCasegenCalls || []);
    const lastCall = calls[calls.length - 1] || null;
    expect(lastCall).toBeTruthy();
    expect(String(lastCall.user || '')).not.toContain('支付模块');
    expect(String(lastCall.user || '')).not.toContain('登录成功校验');
    expect(String(lastCall.user || '')).toContain('登录失败提示');
  });

  test('工具栏支持撤回删除和恢复删除，且仅针对删除历史生效', async ({ page }) => {
    const token = 'token-xmind-delete-undo-toolbar';
    const user = { id: 45, username: 'demo_user_45', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：支持在 XMind 用例生成页撤回删除和恢复删除，且不影响生成历史。',
      requirementLabel: 'XMind删除撤回需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码并提交'],
        expected: '提示账号或密码错误',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');
    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenDeleteRedoBtn')).toBeDisabled();

    await autoAcceptXmindConfirm(page);
    await openNodeContextMenu(page, '登录成功校验');
    await clickContextMenuAction(page, '删除');
    await waitForNodeTextAbsent(page, '登录成功校验');

    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeEnabled();
    await expect(page.locator('#xmindCaseGenDeleteRedoBtn')).toBeDisabled();

    let stateAfterDelete = await readState(page);
    let loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录失败提示']);
    expect((stateAfterDelete.xmindCaseGen.deleteUndoStack || []).length).toBe(1);
    expect((stateAfterDelete.xmindCaseGen.deleteRedoStack || []).length).toBe(0);

    await page.click('#xmindCaseGenDeleteUndoBtn');
    await waitForNodeText(page, '登录成功校验');
    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeDisabled();
    await expect(page.locator('#xmindCaseGenDeleteRedoBtn')).toBeEnabled();

    stateAfterDelete = await readState(page);
    loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录成功校验', '登录失败提示']);
    expect((stateAfterDelete.xmindCaseGen.deleteUndoStack || []).length).toBe(0);
    expect((stateAfterDelete.xmindCaseGen.deleteRedoStack || []).length).toBe(1);
    expect((stateAfterDelete.xmindCaseGen.operationSnapshots || []).length).toBe(0);

    await page.click('#xmindCaseGenDeleteRedoBtn');
    await waitForNodeTextAbsent(page, '登录成功校验');
    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeEnabled();
    await expect(page.locator('#xmindCaseGenDeleteRedoBtn')).toBeDisabled();

    stateAfterDelete = await readState(page);
    loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录失败提示']);
    expect((stateAfterDelete.xmindCaseGen.deleteUndoStack || []).length).toBe(1);
    expect((stateAfterDelete.xmindCaseGen.deleteRedoStack || []).length).toBe(0);
  });

  test('键盘快捷键支持撤回删除和恢复删除', async ({ page }) => {
    const token = 'token-xmind-delete-undo-shortcut';
    const user = { id: 46, username: 'demo_user_46', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：支持通过快捷键撤回删除和恢复删除。',
      requirementLabel: 'XMind删除快捷键需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }, {
      id: 'xmind-mod-pay',
      title: '支付模块',
      scenarios: ['支付主场景'],
      points: ['支付结果校验'],
      coupled: ['订单中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
      'xmind-mod-pay': [{
        module: '支付模块',
        title: '支付成功校验',
        priority: 'P1',
        preconditions: '订单待支付',
        steps: ['1、进入支付页', '2、完成支付'],
        expected: '支付成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '支付模块');
    await autoAcceptXmindConfirm(page);
    await openNodeContextMenu(page, '支付模块');
    await clickContextMenuAction(page, '删除');
    await waitForNodeTextAbsent(page, '支付模块');
    let stateAfterUndo = await readState(page);
    expect((stateAfterUndo.xmindCaseGen.deleteUndoStack || []).length).toBe(1);
    expect((stateAfterUndo.xmindCaseGen.deleteRedoStack || []).length).toBe(0);

    await pressDeleteUndoInXmind(page);
    await waitForNodeText(page, '支付模块');

    stateAfterUndo = await readState(page);
    expect((stateAfterUndo.caseGenModules || []).map((item) => item.title)).toEqual(['登录模块', '支付模块']);
    expect((stateAfterUndo.xmindCaseGen.deleteUndoStack || []).length).toBe(0);
    expect((stateAfterUndo.xmindCaseGen.deleteRedoStack || []).length).toBe(1);

    await pressDeleteRedoInXmind(page);
    await waitForNodeTextAbsent(page, '支付模块');

    stateAfterUndo = await readState(page);
    expect((stateAfterUndo.caseGenModules || []).map((item) => item.title)).toEqual(['登录模块']);
    expect((stateAfterUndo.xmindCaseGen.deleteUndoStack || []).length).toBe(1);
    expect((stateAfterUndo.xmindCaseGen.deleteRedoStack || []).length).toBe(0);
  });

  test('普通单击节点会保持单选高亮，并能从多选收敛为当前节点', async ({ page }) => {
    const token = 'token-xmind-single-select';
    const user = { id: 44, username: 'demo_user_44', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：XMind 只读画布支持普通单击选中节点，同时兼容 Ctrl 多选。',
      requirementLabel: 'XMind单击选中需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码并提交'],
        expected: '提示账号或密码错误',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');

    await clickXmindNode(page, '登录成功校验');
    await expect.poll(async () => {
      return await readSelectedXmindNodeCount(page);
    }).toBe(1);
    await expect.poll(async () => {
      return await readSelectedXmindNodeLabels(page);
    }).toEqual(['登录成功校验']);

    await ctrlClickXmindNodes(page, ['登录失败提示']);
    await expect.poll(async () => {
      return await readSelectedXmindNodeCount(page);
    }).toBeGreaterThanOrEqual(2);

    await clickXmindNode(page, '登录模块');
    await expect.poll(async () => {
      return await readSelectedXmindNodeCount(page);
    }).toBe(1);
    await expect.poll(async () => {
      return await readSelectedXmindNodeLabels(page);
    }).toEqual(['登录模块']);
  });

  test('支持鼠标框选多条用例后批量删除', async ({ page }) => {
    const token = 'token-xmind-delete-box';
    const user = { id: 43, username: 'demo_user_43', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：支持在 XMind 中通过鼠标框选多条用例，再统一删除。',
      requirementLabel: 'XMind框选删除需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }, {
        module: '登录模块',
        title: '登录失败提示',
        priority: 'P2',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入错误密码并提交'],
        expected: '提示账号或密码错误',
      }, {
        module: '登录模块',
        title: '登录态保持校验',
        priority: 'P2',
        preconditions: '账号已登录',
        steps: ['1、重新进入首页', '2、检查登录状态'],
        expected: '登录态保持有效',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '登录成功校验');
    await waitForNodeText(page, '登录失败提示');
    await waitForNodeText(page, '登录态保持校验');
    await dragBoxSelectXmindNodes(page, ['登录成功校验', '登录失败提示']);
    await page.waitForTimeout(360);
    await expect.poll(async () => {
      return await readSelectedXmindNodeCount(page);
    }).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => {
      return await readSelectedXmindNodeLabels(page);
    }).toEqual(['登录成功校验', '登录失败提示']);
    const selectedVisualBeforeDelete = await readSelectedXmindVisualState(page, ['登录成功校验', '登录失败提示']);
    expect(Object.keys(selectedVisualBeforeDelete).sort()).toEqual(['登录失败提示', '登录成功校验']);
    Object.keys(selectedVisualBeforeDelete).forEach((key) => {
      const item = selectedVisualBeforeDelete[key] || {};
      const hasVisibleSelection = Boolean(
        item.hostBoxSelected
        || item.hostSelected
        || item.selectedCarrierClass
        || (item.boxShadow && item.boxShadow !== 'none')
        || (item.outlineStyle && item.outlineStyle !== 'none' && item.outlineWidth && item.outlineWidth !== '0px')
      );
      expect(hasVisibleSelection, JSON.stringify({ key, item })).toBeTruthy();
    });
    await page.evaluate(() => {
      window.__xmindConfirmPayload = null;
      window.__xmindConfirmResolve = null;
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindConfirmPayload = payload || null;
          return new Promise(function(resolve) {
            window.__xmindConfirmResolve = resolve;
          });
        };
      }
    });
    await pressDeleteInXmind(page);
    await page.waitForFunction(() => Boolean(window.__xmindConfirmPayload), {}, { timeout: 5000 });
    await expect.poll(async () => {
      return await readSelectedXmindNodeLabels(page);
    }).toEqual(['登录成功校验', '登录失败提示']);
    await page.evaluate(() => {
      if (typeof window.__xmindConfirmResolve === 'function') {
        window.__xmindConfirmResolve({ ok: true });
        window.__xmindConfirmResolve = null;
      }
    });

    await waitForNodeTextAbsent(page, '登录成功校验');
    await waitForNodeTextAbsent(page, '登录失败提示');
    await waitForNodeText(page, '登录态保持校验');

    const stateAfterDelete = await readState(page);
    const loginCases = JSON.parse(String(stateAfterDelete.caseGenResults['xmind-mod-login'] || '[]'));
    expect(loginCases.map((item) => item.title)).toEqual(['登录态保持校验']);
  });

  test('工具栏保存入库会标红未生成用例的模块，并给出悬浮提示', async ({ page }) => {
    const token = 'token-xmind-store-missing-module';
    const user = { id: 44, username: 'demo_user_44', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：保存入库前需要拦截没有生成用例的模块。',
      requirementLabel: 'XMind保存前模块校验需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');

    await waitForNodeClass(page, '登录模块', 'xmind-casegen-node-invalid');
    await expect(page.locator('.temp-center-toast').last()).toContainText('未生成用例');
  });

  test('工具栏保存入库会标红结构不合法的用例，并给出悬浮提示', async ({ page }) => {
    const token = 'token-xmind-store-invalid-case';
    const user = { id: 45, username: 'demo_user_45', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：保存入库前需要拦截结构不完整的用例。',
      requirementLabel: 'XMind保存前用例校验需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录异常空步骤用例',
        priority: 'P1',
        preconditions: '',
        steps: [],
        expected: '给出失败提示',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');

    await waitForNodeClass(page, '登录异常空步骤用例', 'xmind-casegen-node-invalid');
    await expect(page.locator('.temp-center-toast').last()).toContainText('格式不符合入库要求');
  });

  test('无导入用例时，工具栏保存入库会进入新用例入库抽屉', async ({ page }) => {
    const token = 'token-xmind-store-new';
    const user = { id: 46, username: 'demo_user_46', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      projects: [{ id: 1, name: '项目A' }],
      versionsByProject: {
        '1': [{ id: 11, name: 'v1.0.0' }],
      },
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：无导入用例时，保存入库应走新用例入库流程。',
      requirementLabel: 'XMind新用例入库需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');

    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreDrawerTitle')).toContainText('新用例入库');
  });

  test('基线来自用例库选择时，工具栏保存入库会进入旧用例追加入库抽屉并预选目标用例', async ({ page }) => {
    const token = 'token-xmind-store-append';
    const user = { id: 47, username: 'demo_user_47', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      projects: [{ id: 1, name: '项目A' }],
      versionsByProject: {
        '1': [{ id: 11, name: 'v1.0.0' }],
      },
      caseFilesByProject: {
        '1': [{
          id: 401,
          project_id: 1,
          version_id: 11,
          file_name_clean: '登录基线用例',
        }],
      },
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await autoAcceptXmindConfirm(page);
    await seedDocumentRequirement(page, {
      text: '需求：从用例库选择基线后，保存入库应走追加入库流程。',
      requirementLabel: 'XMind追加入库需求',
    });
    await seedImportedBaseline(page, {
      list: [{
        module: '登录模块',
        title: '登录模块-基线用例',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码'],
        expected: '登录成功',
      }],
      meta: {
        sourceType: 'case-library-select',
        caseFileId: 401,
        projectId: 1,
        versionId: 11,
        fileName: '登录基线用例',
      },
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录模块-新增追加入例',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、执行新的补充动作'],
        expected: '补充用例执行成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'import',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');

    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreDrawerTitle')).toContainText('旧用例追加入库');
    await expect.poll(async () => {
      return await page.$eval('#caseGenDbStoreProjectSelect', (el) => String(el.value || ''));
    }).toBe('1');
    await expect.poll(async () => {
      return await page.$eval('#caseGenDbStoreVersionSelect', (el) => String(el.value || ''));
    }).toBe('11');
    await expect.poll(async () => {
      return await page.$eval('#caseGenDbStoreCaseFileSelect', (el) => String(el.value || ''));
    }).toBe('401');
  });

  test('XMind 保存入库确认时会自动关闭当前生成页签，并清空当前结果与前置准备', async ({ page }) => {
    const token = 'token-xmind-store-no-selection-confirm';
    const user = { id: 48, username: 'demo_user_48', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user, {
      projects: [{ id: 1, name: '项目A' }],
      versionsByProject: {
        '1': [{ id: 11, name: 'v1.0.0' }],
      },
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await page.evaluate(() => {
      window.__xmindConfirmPayloads = [];
      if (window.app && window.app.confirmDrawer) {
        window.app.confirmDrawer.open = function(payload) {
          window.__xmindConfirmPayloads.push(payload || null);
          return Promise.resolve({ ok: true });
        };
      }
    });
    await seedDocumentRequirement(page, {
      text: '需求：XMind 入库默认按当前保留结果入库，不应再提示未选择用例。',
      requirementLabel: 'XMind默认全量入库需求',
    });
    await seedAiSkeleton(page, [{
      id: 'xmind-mod-login',
      title: '登录模块',
      scenarios: ['登录主场景'],
      points: ['账号密码校验'],
      coupled: ['用户中心'],
    }]);
    await seedAiCases(page, {
      'xmind-mod-login': [{
        module: '登录模块',
        title: '登录成功校验',
        priority: 'P1',
        preconditions: '账号已存在',
        steps: ['1、进入登录页', '2、输入账号密码并提交'],
        expected: '登录成功',
      }],
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await clickElementById(page, 'xmindCaseGenStoreBtn');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreEntryNameRow')).not.toHaveClass(/hidden/);
    await expect(page.locator('#caseGenDbStoreEntryNameInput')).toHaveValue('XMind默认全量入库需求');
    await page.fill('#caseGenDbStoreEntryNameInput', 'XMind默认全量入库需求-确认名');
    await page.selectOption('#caseGenDbStoreProjectSelect', '1');
    await page.selectOption('#caseGenDbStoreVersionSelect', '11');
    const importRequestPromise = page.waitForRequest((request) => {
      return request.url().indexOf('/api/case-files/import') !== -1 && request.method() === 'POST';
    });
    await page.click('#caseGenDbStoreConfirmBtn');
    const importRequest = await importRequestPromise;
    const importPayload = importRequest.postDataJSON ? importRequest.postDataJSON() : {};

    await expect.poll(async () => {
      return await page.evaluate(() => {
        return Array.isArray(window.__xmindConfirmPayloads) ? window.__xmindConfirmPayloads.length : 0;
      });
    }).toBe(0);
    expect(String(importPayload && importPayload.file_name)).toBe('XMind默认全量入库需求-确认名.xmind');
    await expect(page.locator('.temp-center-toast').last()).toContainText('入库并关闭页签成功');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(0);
    await expect(page.locator('#xmindCaseGenWorkspaceAddBtn')).toHaveText('新建生成');
    await expect.poll(async () => {
      return await page.evaluate(() => {
        return window.app && window.app.state && Array.isArray(window.app.state.caseGenModules)
          ? window.app.state.caseGenModules.length
          : -1;
      });
    }).toBe(0);

    const resetState = await page.evaluate(() => {
      var st = window.app && window.app.state ? window.app.state : {};
      return {
        rawText: document.getElementById('rawText') ? String(document.getElementById('rawText').value || '') : '',
        moduleCount: Array.isArray(st.caseGenModules) ? st.caseGenModules.length : -1,
        resultCount: st.caseGenResults && typeof st.caseGenResults === 'object' ? Object.keys(st.caseGenResults).length : -1,
        activeWorkspaceId: st.xmindCaseGen ? String(st.xmindCaseGen.activeWorkspaceId || '') : '',
        workspaceCount: st.xmindCaseGen && st.xmindCaseGen.workspaces && typeof st.xmindCaseGen.workspaces === 'object'
          ? Object.keys(st.xmindCaseGen.workspaces).length
          : -1,
        prep: st.xmindCaseGen && st.xmindCaseGen.prep ? {
          step: Number(st.xmindCaseGen.prep.step || 0),
          completed: st.xmindCaseGen.prep.completed === true,
          baseLocked: st.xmindCaseGen.prep.baseLocked === true,
        } : null,
      };
    });
    expect(resetState.rawText).toBe('');
    expect(resetState.moduleCount).toBe(0);
    expect(resetState.resultCount).toBe(0);
    expect(resetState.activeWorkspaceId).toBe('');
    expect(resetState.workspaceCount).toBe(0);
    expect(resetState.prep).not.toBeNull();
    expect(resetState.prep.step).toBe(1);
    expect(resetState.prep.completed).toBe(false);
    expect(resetState.prep.baseLocked).toBe(false);
    await expect(page.locator('#xmindCaseGenMindContainer')).toContainText('暂无生成页签');
  });

  test('XMind 生成在刷新后会自动恢复并继续完成，不再卡死在生成中', async ({ page }) => {
    const token = 'token-xmind-background-refresh';
    const user = { id: 301, username: 'demo_user_background_refresh', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    const workflowUrl = await gotoCasesgenWorkflow(page);
    const routeCtl = await installXmindProxyRoute(page, {
      delaysMs: [1500, 80],
      responseText: JSON.stringify({
        modules: [{
          module: '登录模块',
          key_scenarios: ['账号登录'],
          test_points: ['登录成功'],
          coupled_modules: [],
          cases: [{
            module: '登录模块',
            title: '登录成功校验',
            priority: 'P1',
            preconditions: '账号已存在',
            steps: ['1、进入登录页', '2、输入正确账号密码并提交'],
            expected: '登录成功',
          }],
        }],
      }),
    });

    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：刷新页面后，XMind 生成应自动恢复并继续执行。',
      requirementLabel: 'XMind后台恢复需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('#xmindCaseGenInterruptBtn')).toBeEnabled();

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await waitForNodeText(page, 'XMind后台恢复需求');
    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '登录成功校验');
    await expect(page.locator('#xmindCaseGenInterruptBtn')).toBeDisabled();
    const prepState = await page.evaluate(() => {
      var prep = window.app && window.app.state && window.app.state.xmindCaseGen
        ? window.app.state.xmindCaseGen.prep
        : null;
      return prep ? {
        completed: prep.completed === true,
        baseLocked: prep.baseLocked === true,
        requirementMode: String(prep.requirementMode || ''),
        caseImportMode: String(prep.caseImportMode || ''),
      } : null;
    });
    expect(prepState).not.toBeNull();
    expect(prepState.completed).toBe(true);
    expect(prepState.baseLocked).toBe(true);
    expect(prepState.requirementMode).toBe('document');
    expect(prepState.caseImportMode).toBe('skip');

    const taskState = await page.evaluate(() => {
      try {
        var raw = localStorage.getItem('tap-xmind-casegen-tasks');
        return raw ? JSON.parse(raw) : [];
      } catch (err) {
        return ['parse-error'];
      }
    });
    expect(Array.isArray(taskState) ? taskState.length : 1).toBe(0);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    expect(String(page.url())).toContain('ai-workflow.html');
    expect(String(page.url())).toContain('tab=casesgen');
    expect(String(workflowUrl)).toContain('ai-workflow.html');
    await openNodeContextMenu(page, 'XMind后台恢复需求');
    const rootItemsAfterRefresh = await getContextMenuItems(page);
    expect(rootItemsAfterRefresh.find((item) => item.label === '放弃本次生成').disabled).toBe(false);
    await clickContextMenuAction(page, '放弃本次生成');
    await waitForNodeText(page, 'XMind后台恢复需求');
    await waitForNodeTextAbsent(page, '登录模块');
    await waitForNodeTextAbsent(page, '登录成功校验');
  });

  test('某个 XMind 页签生成中刷新页面时，不会丢失其他空闲页签', async ({ page }) => {
    const token = 'token-xmind-background-refresh-keep-other-tabs';
    const user = { id: 305, username: 'demo_user_background_keep_tabs', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    await gotoCasesgenWorkflow(page);
    const routeCtl = await installXmindProxyRoute(page, {
      delaysMs: [1800, 120],
      responseText: JSON.stringify({
        modules: [{
          module: '登录模块',
          key_scenarios: ['账号登录'],
          test_points: ['登录成功'],
          coupled_modules: [],
        }],
      }),
    });

    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);
    await createXmindWorkspaceByManualPrep(page, '刷新保留页签-A', '需求A：刷新时该页签正在生成。', {
      completePrep: true,
      useExistingWorkspace: true,
    });
    await createXmindWorkspaceByManualPrep(page, '刷新保留页签-B', '需求B：刷新时该页签空闲但必须保留。', {
      completePrep: true,
    });

    const tabA = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '刷新保留页签-A',
    }).first();
    const tabB = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '刷新保留页签-B',
    }).first();

    await tabA.click();
    await waitForNodeText(page, '刷新保留页签-A');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量模块');
    await waitForNodeStatus(page, '刷新保留页签-A', '生成中');
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(1);

    await tabB.click();
    await waitForNodeText(page, '刷新保留页签-B');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('刷新保留页签-B');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(2);

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await page.waitForFunction(() => {
      return document.querySelectorAll('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').length >= 2;
    }, {}, { timeout: 20000 });
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(2);

    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(2);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('刷新保留页签-B');
    await expect(tabA).toContainText('刷新保留页签-A');
    await expect(tabB).toContainText('刷新保留页签-B');

    const hostState = await page.evaluate(() => {
      var host = window.app && window.app.state ? window.app.state.xmindCaseGen : null;
      return host ? {
        activeWorkspaceId: String(host.activeWorkspaceId || ''),
        workspaceOrder: Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [],
        workspaceCount: host.workspaces && typeof host.workspaces === 'object' ? Object.keys(host.workspaces).length : 0,
      } : null;
    });
    expect(hostState).not.toBeNull();
    expect(Array.isArray(hostState.workspaceOrder) ? hostState.workspaceOrder.length : 0).toBe(2);
    expect(Number(hostState.workspaceCount || 0)).toBe(2);

    await tabA.click();
    await waitForNodeText(page, '刷新保留页签-A');
    await waitForNodeText(page, '登录模块');
    await tabB.click();
    await waitForNodeText(page, '刷新保留页签-B');
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(2);
  });

  test('XMind 刷新接管后，生成完成不会改变当前画布位置', async ({ page }) => {
    const token = 'token-xmind-background-refresh-anchor';
    const user = { id: 304, username: 'demo_user_background_anchor', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    await gotoCasesgenWorkflow(page);
    const routeCtl = await installXmindProxyRoute(page, {
      delaysMs: [1500, 1200],
      responseText: JSON.stringify({
        modules: [{
          module: '消息模块',
          key_scenarios: ['消息发送'],
          test_points: ['发送成功'],
          coupled_modules: [],
          cases: [{
            module: '消息模块',
            title: '消息发送成功',
            priority: 'P1',
            preconditions: '已登录',
            steps: ['1、进入消息页', '2、发送消息'],
            expected: '消息发送成功',
          }],
        }],
      }),
    });

    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：刷新恢复后，生成完成不应导致当前画布位置漂移。',
      requirementLabel: 'XMind位置保持需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(1);

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await waitForNodeStatus(page, 'XMind位置保持需求', '生成中');

    const beforePan = await readXmindCasegenViewSnapshot(page);
    await panXmindCasegenCanvas(page, 360, 180);
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      return Boolean(map && map.style && String(map.style.transform || '') !== String(beforeTransform || ''));
    }, beforePan.transform || '', { timeout: 15000 });
    const centerBeforeComplete = await readXmindRootCenter(page);
    expect(centerBeforeComplete).not.toBeNull();

    await waitForNodeStatusAbsent(page, 'XMind位置保持需求');
    await waitForNodeText(page, '消息模块');
    await waitForNodeText(page, '消息发送成功');

    const centerAfterComplete = await readXmindRootCenter(page);
    expect(centerAfterComplete).not.toBeNull();
    expect(Math.abs(centerAfterComplete.x - centerBeforeComplete.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(centerAfterComplete.y - centerBeforeComplete.y)).toBeLessThanOrEqual(6);
  });

  test('XMind 关闭抽屉等待后台生成后重新进入，未移动页签回到根节点，已移动页签保留原位置', async ({ page }) => {
    const token = 'token-xmind-background-tab-viewport-restore';
    const user = { id: 305, username: 'demo_user_background_tab_viewport', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '后台视图-A', '需求A：关闭抽屉后重新进入，应保持根节点展示。', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await createXmindWorkspaceByManualPrep(page, '后台视图-B', '需求B：关闭抽屉后重新进入，应恢复之前手动移动的位置。', {
      completePrep: true,
    });

    const workspaceIds = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      return host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
    });
    expect(workspaceIds).toHaveLength(2);

    await page.evaluate(({ ids }) => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.xmindCaseGen || !state.xmindCaseGen.workspaces) return;
      var host = state.xmindCaseGen;
      function buildCases(moduleTitle, caseTitle) {
        return JSON.stringify([{
          module: moduleTitle,
          title: caseTitle,
          priority: 'P1',
          preconditions: moduleTitle + '前置条件',
          steps: ['1、进入' + moduleTitle, '2、执行' + caseTitle],
          expected: caseTitle + '执行成功',
        }], null, 2);
      }
      function applyWorkspace(record, workspaceTitle, moduleId, moduleTitle, caseTitle, viewState) {
        if (!record || !record.snapshot || !record.snapshot.shared || !record.snapshot.xmind) return;
        record.name = workspaceTitle;
        record.snapshot.shared.caseGenModules = [{
          id: moduleId,
          title: moduleTitle,
          module: moduleTitle,
          key_scenarios: [moduleTitle + '主场景'],
          test_points: [moduleTitle + '关键校验'],
          coupled_modules: [],
        }];
        record.snapshot.shared.requirementLabel = workspaceTitle;
        record.snapshot.shared.requirementLabelSource = 'workspace';
        record.snapshot.shared.caseGenResults = {};
        record.snapshot.shared.caseGenResults[moduleId] = buildCases(moduleTitle, caseTitle);
        record.snapshot.shared.caseSelections = {};
        record.snapshot.shared.caseGenSuggestions = {};
        record.snapshot.shared.caseGenModuleStatus = {};
        record.snapshot.shared.caseGenProgress = {};
        record.snapshot.shared.caseGenTiming = {};
        record.snapshot.shared.caseGenProgressNotice = {};
        record.snapshot.xmind.prep = record.snapshot.xmind.prep && typeof record.snapshot.xmind.prep === 'object'
          ? record.snapshot.xmind.prep
          : {};
        record.snapshot.xmind.prep.requirementMode = 'manual';
        record.snapshot.xmind.prep.manualRequirementLabel = workspaceTitle;
        record.snapshot.xmind.prep.completed = true;
        record.snapshot.xmind.viewState = {
          drawerOpen: false,
          fullscreen: false,
          transform: String(viewState && viewState.transform ? viewState.transform : ''),
          scaleVal: 1,
          scrollLeft: 0,
          scrollTop: 0,
          hasManualViewport: viewState && viewState.hasManualViewport === true,
          anchorState: null,
          collapsedNodeKeys: [],
          treeSourceSignature: '',
          updatedAt: Date.now(),
        };
      }
      applyWorkspace(host.workspaces[ids[0]], '后台视图-A', 'bg-mod-a', '后台模块-A', '后台用例-A', {
        transform: 'translate3d(520px, 180px, 0px) scale(1)',
        hasManualViewport: false,
      });
      applyWorkspace(host.workspaces[ids[1]], '后台视图-B', 'bg-mod-b', '后台模块-B', '后台用例-B', {
        transform: 'translate3d(-260px, 140px, 0px) scale(1)',
        hasManualViewport: true,
      });
      host.activeWorkspaceId = String(ids[0] || '');
      var activeSnapshot = host.workspaces[ids[0]] && host.workspaces[ids[0]].snapshot
        ? host.workspaces[ids[0]].snapshot
        : null;
      var activeShared = activeSnapshot && activeSnapshot.shared ? activeSnapshot.shared : {};
      var activeXmind = activeSnapshot && activeSnapshot.xmind ? activeSnapshot.xmind : {};
      state.requirementLabel = String(activeShared.requirementLabel || '');
      state.requirementLabelSource = String(activeShared.requirementLabelSource || '');
      state.lastRawImportName = String(activeShared.lastRawImportName || '');
      state.rawText = String(activeShared.rawText || '');
      state.caseText = String(activeShared.caseText || '');
      state.importedCases = JSON.parse(JSON.stringify(activeShared.importedCases || []));
      state.caseGenModules = JSON.parse(JSON.stringify(activeShared.caseGenModules || []));
      state.caseGenSource = String(activeShared.caseGenSource || '');
      state.caseGenResults = JSON.parse(JSON.stringify(activeShared.caseGenResults || {}));
      state.caseSelections = JSON.parse(JSON.stringify(activeShared.caseSelections || {}));
      state.caseGenSuggestions = JSON.parse(JSON.stringify(activeShared.caseGenSuggestions || {}));
      state.caseGenModuleStatus = JSON.parse(JSON.stringify(activeShared.caseGenModuleStatus || {}));
      state.caseGenProgress = JSON.parse(JSON.stringify(activeShared.caseGenProgress || {}));
      state.caseGenTiming = JSON.parse(JSON.stringify(activeShared.caseGenTiming || {}));
      state.caseGenProgressNotice = JSON.parse(JSON.stringify(activeShared.caseGenProgressNotice || {}));
      state.caseGenSettings = JSON.parse(JSON.stringify(activeShared.caseGenSettings || state.caseGenSettings || {}));
      state.requirementMedia = JSON.parse(JSON.stringify(activeShared.requirementMedia || state.requirementMedia || {}));
      Object.keys(activeXmind || {}).forEach(function(key) {
        state.xmindCaseGen[key] = JSON.parse(JSON.stringify(activeXmind[key]));
      });
    }, { ids: workspaceIds });

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await page.click('#xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await waitForNodeText(page, '后台视图-A');
    await waitForNodeText(page, '后台模块-A');

    const offsetA = await readXmindRootOffsetFromViewer(page);
    expect(offsetA).not.toBeNull();
    expect(Math.abs(Number(offsetA.dx || 0))).toBeLessThanOrEqual(10);
    expect(Math.abs(Number(offsetA.dy || 0))).toBeLessThanOrEqual(10);

    await page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').nth(1).click();
    await waitForNodeText(page, '后台视图-B');
    await waitForNodeText(page, '后台模块-B');

    const offsetB = await readXmindRootOffsetFromViewer(page);
    expect(offsetB).not.toBeNull();
    expect(Math.max(Math.abs(Number(offsetB.dx || 0)), Math.abs(Number(offsetB.dy || 0)))).toBeGreaterThan(60);

    const viewB = await readXmindCasegenViewSnapshot(page);
    const transformB = parseMindTransformText(viewB.transform || '');
    expect(transformB.x).toBeCloseTo(-260, 0);
    expect(transformB.y).toBeCloseTo(140, 0);
  });

  test('XMind 页签手动移动画布后，重进页面和切换页签都会保持各自位置', async ({ page }) => {
    const token = 'token-xmind-manual-viewport-sticky';
    const user = { id: 306, username: 'demo_user_manual_viewport_sticky', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '手动视图-A', '需求A：手动移动视图后应保持当前位置。', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await createXmindWorkspaceByManualPrep(page, '手动视图-B', '需求B：切换页签后也要回到自己的位置。', {
      completePrep: true,
    });

    const workspaceIds = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      return host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
    });
    expect(workspaceIds).toHaveLength(2);

    await page.evaluate(({ ids }) => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.xmindCaseGen || !state.xmindCaseGen.workspaces) return;
      var host = state.xmindCaseGen;
      function buildCases(moduleTitle, caseTitle) {
        return JSON.stringify([{
          module: moduleTitle,
          title: caseTitle,
          priority: 'P1',
          preconditions: moduleTitle + '前置条件',
          steps: ['1、进入' + moduleTitle, '2、执行' + caseTitle],
          expected: caseTitle + '执行成功',
        }], null, 2);
      }
      function applyWorkspace(record, workspaceTitle, moduleId, moduleTitle, caseTitle) {
        if (!record || !record.snapshot || !record.snapshot.shared || !record.snapshot.xmind) return;
        record.name = workspaceTitle;
        record.snapshot.shared.requirementLabel = workspaceTitle;
        record.snapshot.shared.requirementLabelSource = 'workspace';
        record.snapshot.shared.caseGenModules = [{
          id: moduleId,
          title: moduleTitle,
          module: moduleTitle,
          key_scenarios: [moduleTitle + '主场景'],
          test_points: [moduleTitle + '关键校验'],
          coupled_modules: [],
        }];
        record.snapshot.shared.caseGenResults = {};
        record.snapshot.shared.caseGenResults[moduleId] = buildCases(moduleTitle, caseTitle);
        record.snapshot.xmind.prep = record.snapshot.xmind.prep && typeof record.snapshot.xmind.prep === 'object'
          ? record.snapshot.xmind.prep
          : {};
        record.snapshot.xmind.prep.requirementMode = 'manual';
        record.snapshot.xmind.prep.manualRequirementLabel = workspaceTitle;
        record.snapshot.xmind.prep.completed = true;
      }
      function applyActiveWorkspace(snapshot) {
        var shared = snapshot && snapshot.shared ? snapshot.shared : {};
        var xmind = snapshot && snapshot.xmind ? snapshot.xmind : {};
        state.requirementLabel = String(shared.requirementLabel || '');
        state.requirementLabelSource = String(shared.requirementLabelSource || '');
        state.lastRawImportName = String(shared.lastRawImportName || '');
        state.rawText = String(shared.rawText || '');
        state.caseText = String(shared.caseText || '');
        state.importedCases = JSON.parse(JSON.stringify(shared.importedCases || []));
        state.caseGenModules = JSON.parse(JSON.stringify(shared.caseGenModules || []));
        state.caseGenSource = String(shared.caseGenSource || '');
        state.caseGenResults = JSON.parse(JSON.stringify(shared.caseGenResults || {}));
        state.caseSelections = JSON.parse(JSON.stringify(shared.caseSelections || {}));
        state.caseGenSuggestions = JSON.parse(JSON.stringify(shared.caseGenSuggestions || {}));
        state.caseGenModuleStatus = JSON.parse(JSON.stringify(shared.caseGenModuleStatus || {}));
        state.caseGenProgress = JSON.parse(JSON.stringify(shared.caseGenProgress || {}));
        state.caseGenTiming = JSON.parse(JSON.stringify(shared.caseGenTiming || {}));
        state.caseGenProgressNotice = JSON.parse(JSON.stringify(shared.caseGenProgressNotice || {}));
        state.caseGenSettings = JSON.parse(JSON.stringify(shared.caseGenSettings || state.caseGenSettings || {}));
        state.requirementMedia = JSON.parse(JSON.stringify(shared.requirementMedia || state.requirementMedia || {}));
        Object.keys(xmind || {}).forEach(function(key) {
          state.xmindCaseGen[key] = JSON.parse(JSON.stringify(xmind[key]));
        });
      }
      applyWorkspace(host.workspaces[ids[0]], '手动视图-A', 'manual-mod-a', '手动模块-A', '手动用例-A');
      applyWorkspace(host.workspaces[ids[1]], '手动视图-B', 'manual-mod-b', '手动模块-B', '手动用例-B');
      host.activeWorkspaceId = String(ids[0] || '');
      applyActiveWorkspace(host.workspaces[ids[0]].snapshot);
    }, { ids: workspaceIds });

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.render === 'function') {
        api.render({ reason: 'manual-viewport-test', persist: false, centerRootAfterRender: true });
      }
    });
    await waitForNodeText(page, '手动视图-A');
    await waitForNodeText(page, '手动模块-A');

    const beforePan = await readXmindCasegenViewSnapshot(page);
    await panXmindCasegenCanvas(page, 260, 120);
    await page.waitForFunction((beforeTransform) => {
      var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
      return Boolean(map && map.style && String(map.style.transform || '') !== String(beforeTransform || ''));
    }, beforePan.transform || '', { timeout: 10000 });
    await page.waitForTimeout(180);
    const movedView = await readXmindCasegenViewSnapshot(page);
    const movedTransform = parseMindTransformText(movedView.transform || '');
    expect(Math.max(Math.abs(movedTransform.x), Math.abs(movedTransform.y))).toBeGreaterThan(30);

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await page.click('#xmindCaseGenOpenBtn');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await waitForNodeText(page, '手动视图-A');
    await waitForNodeText(page, '手动模块-A');
    const reopenedView = await readXmindCasegenViewSnapshot(page);
    const reopenedTransform = parseMindTransformText(reopenedView.transform || '');
    expect(reopenedTransform.x).toBeCloseTo(movedTransform.x, 0);
    expect(reopenedTransform.y).toBeCloseTo(movedTransform.y, 0);
    expect(reopenedView.viewState && reopenedView.viewState.hasManualViewport).toBe(true);

    await page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').nth(1).click();
    await waitForNodeText(page, '手动视图-B');
    await waitForNodeText(page, '手动模块-B');

    await page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]').nth(0).click();
    await waitForNodeText(page, '手动视图-A');
    await waitForNodeText(page, '手动模块-A');
    const switchedBackView = await readXmindCasegenViewSnapshot(page);
    const switchedBackTransform = parseMindTransformText(switchedBackView.transform || '');
    expect(switchedBackTransform.x).toBeCloseTo(movedTransform.x, 0);
    expect(switchedBackTransform.y).toBeCloseTo(movedTransform.y, 0);
    expect(switchedBackView.viewState && switchedBackView.viewState.hasManualViewport).toBe(true);
  });

  test('XMind 生成切换到其他页签后仍会在后台继续，返回后可看到完成结果', async ({ page }) => {
    const token = 'token-xmind-background-tab';
    const user = { id: 302, username: 'demo_user_background_tab', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    const routeCtl = await installXmindProxyRoute(page, {
      delayMs: 500,
      responseText: JSON.stringify({
        modules: [{
          module: '支付模块',
          key_scenarios: ['支付主流程'],
          test_points: ['支付成功'],
          coupled_modules: [],
          cases: [{
            module: '支付模块',
            title: '支付成功校验',
            priority: 'P1',
            preconditions: '订单已创建',
            steps: ['1、进入支付页', '2、完成支付'],
            expected: '支付成功',
          }],
        }],
      }),
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：切换到用例执行页后，XMind 生成也不能中断。',
      requirementLabel: 'XMind跨页签继续需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(1);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await expect(page.locator('[data-tab-btn="tempexec"]')).toHaveClass(/active/);
    await page.waitForTimeout(900);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('casesgen');
      }
    });
    await expect(page.locator('[data-tab-btn="casesgen"]')).toHaveClass(/active/);
    await openXmindCaseGenDrawer(page);
    await waitForNodeText(page, '支付模块');
    await waitForNodeText(page, '支付成功校验');
    await expect(page.locator('#xmindCaseGenInterruptBtn')).toBeDisabled();
  });

  test('关闭 XMind 抽屉后，后台完成会同步左下角进度摘要', async ({ page }) => {
    const token = 'token-xmind-progress-board-after-close';
    const user = { id: 307, username: 'demo_user_progress_board_after_close', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await installXmindModelStub(page, 180);
    await seedDocumentRequirement(page, {
      text: '需求：关闭 XMind 抽屉后，后台生成完成仍要同步左下角摘要。',
      requirementLabel: 'XMind后台摘要同步需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeStatus(page, 'XMind后台摘要同步需求', '生成中');

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);

    await page.waitForFunction(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (!api || typeof api.getWorkspaceProgressItems !== 'function') return false;
      var items = api.getWorkspaceProgressItems();
      if (!Array.isArray(items) || items.length !== 1) return false;
      var item = items[0] || {};
      return Number(item.moduleCount || 0) === 2
        && Number(item.caseCount || 0) === 4
        && String(item.statusText || '') === '未入库';
    }, {}, { timeout: 20000 });

    const progressCard = page.locator('#caseGenProgressList [data-casegen-workspace]').first();
    await expect(progressCard).toContainText('XMind后台摘要同步需求');
    await expect(progressCard).toContainText('2 模块');
    await expect(progressCard).toContainText('4 用例');
    await expect(progressCard).toContainText('未入库');
    await expect(page.locator('#xmindCaseGenDrawer')).not.toHaveClass(/open/);
  });

  test('两个 XMind 页签后台生成全量用例时，即使关闭抽屉并切回旧流程视图，也会各自保留独立结果', async ({ page }) => {
    const token = 'token-xmind-background-two-workspaces-complete';
    const user = { id: 308, username: 'demo_user_background_two_workspaces_complete', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await page.evaluate(() => {
      var client = window.app && window.app.apiClient ? window.app.apiClient : null;
      if (!client) return;

      function flattenContent(content) {
        if (typeof content === 'string') return content;
        if (!Array.isArray(content)) return '';
        return content.map(function(item) {
          if (!item || typeof item !== 'object') return '';
          if (item.type === 'text') return String(item.text || '');
          return '[image]';
        }).join('\n');
      }

      function parseJsonText(text) {
        var raw = String(text || '').trim();
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {}
        var objStart = raw.indexOf('{');
        var objEnd = raw.lastIndexOf('}');
        if (objStart >= 0 && objEnd > objStart) {
          try {
            return JSON.parse(raw.slice(objStart, objEnd + 1));
          } catch (err2) {}
        }
        return null;
      }

      function extractSection(text, marker) {
        var source = String(text || '');
        var index = source.indexOf(marker);
        if (index === -1) return '';
        var rest = source.slice(index + marker.length);
        var next = rest.indexOf('\n\n【');
        if (next !== -1) rest = rest.slice(0, next);
        return String(rest || '').trim();
      }

      function makeCase(moduleName, title, index) {
        var order = Number(index) || 1;
        return {
          module: moduleName,
          title: title,
          priority: order % 2 === 0 ? 'P2' : 'P1',
          preconditions: moduleName + '前置条件',
          steps: [
            '1、进入' + moduleName,
            '2、执行' + title,
          ],
          expected: title + '执行成功',
        };
      }

      function makeModule(name, cases) {
        return {
          module: name,
          key_scenarios: [name + '主场景'],
          test_points: [name + '关键校验'],
          coupled_modules: [name + '关联模块'],
          cases: Array.isArray(cases) ? cases : [],
        };
      }

      client.proxyModelRequest = function(payload, signal) {
        var modelPayload = payload && payload.payload ? payload.payload : {};
        var messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
        var promptText = flattenContent(messages[0] && messages[0].content);
        var userText = flattenContent(messages[1] && messages[1].content);
        var contract = parseJsonText(extractSection(userText, '【operation_contract(JSON)】'))
          || parseJsonText(extractSection(promptText, 'operation_contract(JSON)：'))
          || {};
        var mode = String(contract.mode || '');
        var targetModule = String(contract.targetModule || '');
        var workspaceLabel = userText.indexOf('后台摘要-B') !== -1 ? 'B' : 'A';
        var delayMs = workspaceLabel === 'B' ? 220 : 80;
        var responseModules = [];

        if (mode === 'full_cases') {
          responseModules = workspaceLabel === 'B'
            ? [
                makeModule('消息模块-B', [
                  makeCase('消息模块-B', '消息模块-B-成功', 1),
                  makeCase('消息模块-B', '消息模块-B-失败', 2),
                ]),
                makeModule('设置模块-B', [
                  makeCase('设置模块-B', '设置模块-B-成功', 1),
                  makeCase('设置模块-B', '设置模块-B-失败', 2),
                ]),
              ]
            : [
                makeModule('账户模块-A', [
                  makeCase('账户模块-A', '账户模块-A-成功', 1),
                  makeCase('账户模块-A', '账户模块-A-失败', 2),
                ]),
                makeModule('支付模块-A', [
                  makeCase('支付模块-A', '支付模块-A-成功', 1),
                  makeCase('支付模块-A', '支付模块-A-失败', 2),
                ]),
              ];
        } else if (mode === 'module_full_cases' && targetModule === '账户模块-A') {
          delayMs = 120;
          responseModules = [
            makeModule('账户模块-A', [
              makeCase('账户模块-A', '账户模块-A-成功', 1),
              makeCase('账户模块-A', '账户模块-A-失败', 2),
            ]),
          ];
        } else if (mode === 'module_full_cases' && targetModule === '支付模块-A') {
          delayMs = 140;
          responseModules = [
            makeModule('支付模块-A', [
              makeCase('支付模块-A', '支付模块-A-成功', 1),
              makeCase('支付模块-A', '支付模块-A-失败', 2),
            ]),
          ];
        } else if (mode === 'module_full_cases' && targetModule === '消息模块-B') {
          delayMs = 900;
          responseModules = [
            makeModule('消息模块-B', []),
          ];
        } else if (mode === 'module_full_cases' && targetModule === '设置模块-B') {
          delayMs = 980;
          responseModules = [
            makeModule('设置模块-B', []),
          ];
        } else {
          responseModules = [
            makeModule(targetModule || '默认模块', [
              makeCase(targetModule || '默认模块', (targetModule || '默认模块') + '-完整-1', 1),
            ]),
          ];
        }

        var content = JSON.stringify({ modules: responseModules });
        return new Promise(function(resolve, reject) {
          var timer = setTimeout(function() {
            resolve({
              ok: true,
              status: 200,
              text: function() {
                return Promise.resolve(JSON.stringify({
                  choices: [{ message: { content: content } }],
                }));
              },
            });
          }, delayMs);
          if (signal && typeof signal.addEventListener === 'function') {
            signal.addEventListener('abort', function() {
              clearTimeout(timer);
              reject(new Error('aborted'));
            }, { once: true });
          }
        });
      };
    });
    await openXmindCaseGenDrawer(page);

    await createXmindWorkspaceByManualPrep(page, '后台摘要-A', '需求A：后台生成完成后要保留自己的模块与用例统计。', {
      useExistingWorkspace: true,
      completePrep: true,
    });
    await createXmindWorkspaceByManualPrep(page, '后台摘要-B', '需求B：不能被其他页签的完成态覆盖或打回未执行。', {
      completePrep: true,
    });

    const tabA = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '后台摘要-A',
    }).first();
    const tabB = page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]', {
      hasText: '后台摘要-B',
    }).first();

    await tabA.click();
    await waitForNodeText(page, '后台摘要-A');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeStatus(page, '后台摘要-A', '生成中');

    await tabB.click();
    await waitForNodeText(page, '后台摘要-B');
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await waitForNodeStatus(page, '后台摘要-B', '生成中');

    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);
    await clickElementById(page, 'caseGenLegacyModulesTabBtn');
    const progressCardsBeforeComplete = page.locator('#caseGenProgressList [data-casegen-workspace]');
    await expect(progressCardsBeforeComplete).toHaveCount(2);
    var progressWorkspaceIdBeforeComplete = await progressCardsBeforeComplete.first().getAttribute('data-casegen-workspace');
    await page.evaluate((workspaceId) => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.openWorkspace === 'function') {
        api.openWorkspace(workspaceId);
      }
    }, String(progressWorkspaceIdBeforeComplete || ''));
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('后台摘要-A');
    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    await page.waitForFunction(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (!api || typeof api.getWorkspaceProgressItems !== 'function') return false;
      var items = api.getWorkspaceProgressItems();
      var summary = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item || !item.title) return;
        summary[String(item.title || '')] = {
          moduleCount: Number(item.moduleCount || 0),
          caseCount: Number(item.caseCount || 0),
          statusText: String(item.statusText || ''),
        };
      });
      return Boolean(
        summary['后台摘要-A']
        && summary['后台摘要-B']
        && summary['后台摘要-A'].moduleCount === 2
        && summary['后台摘要-A'].caseCount === 4
        && summary['后台摘要-A'].statusText === '未入库'
        && summary['后台摘要-B'].moduleCount === 2
        && summary['后台摘要-B'].statusText === '生成中'
      );
    }, {}, { timeout: 20000 });
    const taskStateAfterACompleted = await page.evaluate(() => {
      var host = window.app && window.app.state ? window.app.state.xmindCaseGen : null;
      var workspaceOrder = host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder : [];
      var workspaceBId = '';
      workspaceOrder.some(function(id) {
        var record = host && host.workspaces ? host.workspaces[id] : null;
        if (!record || String(record.name || '') !== '后台摘要-B') return false;
        workspaceBId = String(id || '');
        return true;
      });
      try {
        var raw = localStorage.getItem('tap-xmind-casegen-tasks');
        var list = raw ? JSON.parse(raw) : [];
        var scoped = Array.isArray(list) ? list.filter(function(item) {
          return item && String(item.workspaceId || '') === workspaceBId;
        }) : [];
        return {
          workspaceBId: workspaceBId,
          runningCount: scoped.filter(function(item) {
            return item && item.status === 'running';
          }).length,
          terminalRootCount: scoped.filter(function(item) {
            return item
              && item.scope === 'root'
              && (item.status === 'done' || item.status === 'error' || item.status === 'cancelled');
          }).length,
        };
      } catch (err) {
        return {
          workspaceBId: workspaceBId,
          runningCount: -1,
          terminalRootCount: -1,
        };
      }
    });
    expect(taskStateAfterACompleted.workspaceBId).toBeTruthy();
    expect(taskStateAfterACompleted.runningCount).toBeGreaterThan(0);
    expect(taskStateAfterACompleted.terminalRootCount).toBe(0);

    const progressCardsDuringRunning = page.locator('#caseGenProgressList [data-casegen-workspace]');
    await expect(progressCardsDuringRunning).toHaveCount(2);

    var progressWorkspaceIdDuringRunningA = await progressCardsDuringRunning.first().getAttribute('data-casegen-workspace');
    await page.evaluate((workspaceId) => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.openWorkspace === 'function') {
        api.openWorkspace(workspaceId);
      }
    }, String(progressWorkspaceIdDuringRunningA || ''));
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('后台摘要-A');
    await waitForNodeText(page, '账户模块-A');
    await waitForNodeText(page, '支付模块-A');
    await waitForNodeTextAbsent(page, '消息模块-B');
    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    var progressWorkspaceIdDuringRunningB = await progressCardsDuringRunning.nth(1).getAttribute('data-casegen-workspace');
    await page.evaluate((workspaceId) => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.openWorkspace === 'function') {
        api.openWorkspace(workspaceId);
      }
    }, String(progressWorkspaceIdDuringRunningB || ''));
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab].active')).toContainText('后台摘要-B');
    await waitForNodeText(page, '消息模块-B');
    await waitForNodeText(page, '设置模块-B');
    await waitForNodeTextAbsent(page, '账户模块-A');
    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    await page.waitForFunction(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (!api || typeof api.getWorkspaceProgressItems !== 'function') return false;
      var items = api.getWorkspaceProgressItems();
      var summary = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item || !item.title) return;
        summary[String(item.title || '')] = {
          moduleCount: Number(item.moduleCount || 0),
          caseCount: Number(item.caseCount || 0),
          statusText: String(item.statusText || ''),
        };
      });
      return Boolean(
        summary['后台摘要-A']
        && summary['后台摘要-B']
        && summary['后台摘要-A'].moduleCount === 2
        && summary['后台摘要-A'].caseCount === 4
        && summary['后台摘要-A'].statusText === '未入库'
        && summary['后台摘要-B'].moduleCount === 2
        && summary['后台摘要-B'].caseCount === 4
        && summary['后台摘要-B'].statusText === '未入库'
      );
    }, {}, { timeout: 20000 });
    await page.waitForTimeout(600);

    const closedRestoreState = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      var drawer = document.getElementById('xmindCaseGenDrawer');
      var tasks = [];
      try {
        tasks = JSON.parse(localStorage.getItem('tap-xmind-casegen-tasks') || '[]');
      } catch (err) {
        tasks = [];
      }
      var workspaceDrawerOpenCount = 0;
      (host && Array.isArray(host.workspaceOrder) ? host.workspaceOrder : []).forEach(function(id) {
        var record = host && host.workspaces ? host.workspaces[id] : null;
        var viewState = record && record.snapshot && record.snapshot.xmind
          ? record.snapshot.xmind.viewState
          : null;
        if (viewState && viewState.drawerOpen === true) {
          workspaceDrawerOpenCount += 1;
        }
      });
      var taskDrawerOpenCount = (Array.isArray(tasks) ? tasks : []).filter(function(item) {
        return Boolean(
          item
          && item.restoreContext
          && item.restoreContext.viewState
          && item.restoreContext.viewState.drawerOpen === true
        );
      }).length;
      return {
        drawerOpen: Boolean(drawer && drawer.classList && drawer.classList.contains('open')),
        liveViewDrawerOpen: Boolean(host && host.viewState && host.viewState.drawerOpen === true),
        workspaceDrawerOpenCount: workspaceDrawerOpenCount,
        taskDrawerOpenCount: taskDrawerOpenCount,
      };
    });
    expect(closedRestoreState.drawerOpen).toBe(false);
    expect(closedRestoreState.liveViewDrawerOpen).toBe(false);
    expect(closedRestoreState.workspaceDrawerOpenCount).toBe(0);
    expect(closedRestoreState.taskDrawerOpenCount).toBe(0);

    const workspaceSummary = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      if (!host || !host.workspaces) return [];

      function parseTitles(rawValue) {
        try {
          var parsed = JSON.parse(String(rawValue || '[]'));
          return Array.isArray(parsed)
            ? parsed.map(function(item) { return String(item && item.title ? item.title : ''); }).filter(Boolean)
            : [];
        } catch (err) {
          return [];
        }
      }

      return (Array.isArray(host.workspaceOrder) ? host.workspaceOrder : []).map(function(id) {
        var record = host.workspaces[id];
        var snapshot = record && record.snapshot ? record.snapshot : {};
        var shared = snapshot && snapshot.shared ? snapshot.shared : {};
        return {
          title: String(record && record.name ? record.name : ''),
          modules: Array.isArray(shared.caseGenModules)
            ? shared.caseGenModules.map(function(item) {
              return String(item && (item.title || item.module || '') || '');
            }).filter(Boolean)
            : [],
          cases: Object.keys(shared.caseGenResults || {}).reduce(function(result, moduleId) {
            return result.concat(parseTitles(shared.caseGenResults[moduleId]));
          }, []),
        };
      });
    });
    expect(workspaceSummary).toEqual([
      {
        title: '后台摘要-A',
        modules: ['账户模块-A', '支付模块-A'],
        cases: ['账户模块-A-成功', '账户模块-A-失败', '支付模块-A-成功', '支付模块-A-失败'],
      },
      {
        title: '后台摘要-B',
        modules: ['消息模块-B', '设置模块-B'],
        cases: ['消息模块-B-成功', '消息模块-B-失败', '设置模块-B-成功', '设置模块-B-失败'],
      },
    ]);

    const progressCards = page.locator('#caseGenProgressList [data-casegen-workspace]');
    await expect(progressCards).toHaveCount(2);
    await expect(progressCards.nth(0)).toContainText('后台摘要-A');
    await expect(progressCards.nth(0)).toContainText('2 模块');
    await expect(progressCards.nth(0)).toContainText('4 用例');
    await expect(progressCards.nth(1)).toContainText('后台摘要-B');
    await expect(progressCards.nth(1)).toContainText('2 模块');
    await expect(progressCards.nth(1)).toContainText('4 用例');

    var progressWorkspaceIdFinalA = await progressCards.first().getAttribute('data-casegen-workspace');
    await page.evaluate((workspaceId) => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.openWorkspace === 'function') {
        api.openWorkspace(workspaceId);
      }
    }, String(progressWorkspaceIdFinalA || ''));
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await waitForNodeText(page, '账户模块-A');
    await waitForNodeText(page, '支付模块-A');
    await waitForNodeTextAbsent(page, '消息模块-B');
    await page.evaluate(() => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.close === 'function') api.close();
    });
    await waitXmindDrawerClosedStable(page);

    var progressWorkspaceIdFinalB = await progressCards.nth(1).getAttribute('data-casegen-workspace');
    await page.evaluate((workspaceId) => {
      var api = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (api && typeof api.openWorkspace === 'function') {
        api.openWorkspace(workspaceId);
      }
    }, String(progressWorkspaceIdFinalB || ''));
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await waitForNodeText(page, '消息模块-B');
    await waitForNodeText(page, '设置模块-B');
    await waitForNodeTextAbsent(page, '账户模块-A');
  });

  test('根节点首轮生成会在缺少 step3 关键覆盖时自动补强一次，并落下补强后的结果', async ({ page }) => {
    const token = 'token-xmind-root-coverage-retry';
    const user = { id: 302, username: 'demo_user_root_retry', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：该功能需要达到10级后才解锁，每日最多可领取3次奖励，每次奖励50积分。',
      requirementLabel: 'XMind首轮补强需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });
    await page.evaluate(() => {
      var api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!api || typeof api.setCaseGenSettingValue !== 'function') return;
      api.setCaseGenSettingValue('needFunctionCondition', true);
      api.setCaseGenSettingValue('needNumericValidation', true);
      api.setCaseGenSettingValue('needBoundary', false);
      api.setCaseGenSettingValue('needMobile', false);
      api.setCaseGenSettingValue('needSpecial', false);
    });
    await page.evaluate(() => {
      var client = window.app && window.app.apiClient ? window.app.apiClient : null;
      if (!client) return;
      window.__xmindCoverageRetryCalls = [];
      client.proxyModelRequest = function(payload, signal) {
        var modelPayload = payload && payload.payload ? payload.payload : {};
        var messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
        var promptText = messages[0] && messages[0].content ? String(messages[0].content) : '';
        var userText = messages[1] && messages[1].content ? String(messages[1].content) : '';
        var index = window.__xmindCoverageRetryCalls.length;
        window.__xmindCoverageRetryCalls.push({
          prompt: promptText,
          user: userText,
        });
        var responseText = index === 0
          ? JSON.stringify({
              modules: [{
                module: '功能入口与基础流程',
                key_scenarios: ['入口展示'],
                test_points: ['页面展示正确'],
                coupled_modules: [],
                cases: [{
                  module: '功能入口与基础流程',
                  title: '入口展示校验',
                  priority: 'P1',
                  preconditions: '用户已登录',
                  steps: ['1、进入功能页', '2、查看入口状态'],
                  expected: '入口展示正确',
                }],
              }],
            })
          : JSON.stringify({
              modules: [{
                module: '功能解锁与可用条件',
                key_scenarios: ['10级解锁后可用'],
                test_points: ['等级门槛校验', '未解锁前不可使用'],
                coupled_modules: [],
                cases: [{
                  module: '功能解锁与可用条件',
                  title: '未达到10级时不可领取奖励',
                  priority: 'P1',
                  preconditions: '角色等级为9级',
                  steps: ['1、进入奖励页面', '2、尝试领取奖励'],
                  expected: '页面提示未解锁，无法领取奖励',
                }],
              }, {
                module: '奖励次数与积分数值验证',
                key_scenarios: ['每日次数限制'],
                test_points: ['每日最多3次', '单次奖励50积分'],
                coupled_modules: [],
                cases: [{
                  module: '奖励次数与积分数值验证',
                  title: '第4次领取时提示超过上限',
                  priority: 'P1',
                  preconditions: '当日已成功领取3次奖励',
                  steps: ['1、再次点击领取奖励', '2、检查积分变化'],
                  expected: '提示已达上限，积分不再增加50分',
                }],
              }],
            });
        return new Promise(function(resolve, reject) {
          var timer = setTimeout(function() {
            resolve({
              ok: true,
              status: 200,
              text: function() {
                return Promise.resolve(JSON.stringify({
                  choices: [{ message: { content: responseText } }],
                }));
              },
            });
          }, 90);
          if (signal && typeof signal.addEventListener === 'function') {
            signal.addEventListener('abort', function() {
              clearTimeout(timer);
              reject(new Error('aborted'));
            }, { once: true });
          }
        });
      };
    });

    await openXmindCaseGenDrawer(page);
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');

    await page.waitForFunction(() => {
      return Array.isArray(window.__xmindCoverageRetryCalls) && window.__xmindCoverageRetryCalls.length === 2;
    }, {}, { timeout: 15000 });
    await waitForNodeText(page, '功能解锁与可用条件');
    await waitForNodeText(page, '奖励次数与积分数值验证');
    await waitForNodeTextAbsent(page, '功能入口与基础流程');

    const retryCalls = await page.evaluate(() => window.__xmindCoverageRetryCalls || []);
    expect(retryCalls).toHaveLength(2);
    expect(String(retryCalls[1].user || '')).toContain('【首轮生成补强指令】');
    expect(String(retryCalls[1].user || '')).toContain('功能使用条件');
    expect(String(retryCalls[1].user || '')).toContain('数值验证');

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('功能解锁与可用条件');
    await expect(latestCard).toContainText('奖励次数与积分数值验证');
    await expect(latestCard).toContainText('自动补强覆盖：功能使用条件、数值验证');
  });

  test('工具栏中断生成会停止 XMind 后台任务，并且不会再落下已取消的结果', async ({ page }) => {
    const token = 'token-xmind-background-cancel';
    const user = { id: 303, username: 'demo_user_background_cancel', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    const routeCtl = await installXmindProxyRoute(page, {
      delayMs: 1500,
      responseText: JSON.stringify({
        modules: [{
          module: '支付模块',
          key_scenarios: ['支付主流程'],
          test_points: ['支付成功'],
          coupled_modules: [],
          cases: [{
            module: '支付模块',
            title: '支付成功校验',
            priority: 'P1',
            preconditions: '订单已创建',
            steps: ['1、进入支付页', '2、完成支付'],
            expected: '支付成功',
          }],
        }],
      }),
    });

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：允许用户中断当前 XMind 生成任务。',
      requirementLabel: 'XMind中断任务需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');
    await expect.poll(() => routeCtl.getCallCount()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('#xmindCaseGenInterruptBtn')).toBeEnabled();
    await clickElementById(page, 'xmindCaseGenInterruptBtn');
    await expect(page.locator('.temp-center-toast').last()).toContainText('已中断 1 个生成任务');
    await expect(page.locator('#xmindCaseGenInterruptBtn')).toBeDisabled();
    await page.waitForTimeout(1700);
    await waitForNodeTextAbsent(page, '支付模块');

    await clickElementById(page, 'xmindCaseGenHistoryBtn');
    const latestCard = page.locator('.xmind-casegen-history-card').nth(0);
    await expect(latestCard).toContainText('已中断');
    await expect(latestCard).toContainText('中断原因');
    await expect(latestCard).toContainText('已手动中断当前 XMind 生成任务');

    const taskState = await page.evaluate(() => {
      try {
        var raw = localStorage.getItem('tap-xmind-casegen-tasks');
        return raw ? JSON.parse(raw) : [];
      } catch (err) {
        return ['parse-error'];
      }
    });
    expect(Array.isArray(taskState) ? taskState.length : 1).toBe(0);
  });

  test('流式展示首个模块结果后刷新，已展示用例不会丢失且剩余模块可继续完成', async ({ page }) => {
    const token = 'token-xmind-stream-refresh-keep-partial';
    const user = { id: 302, username: 'demo_user_stream_refresh_keep_partial', role: 'user', level: 'member' };
    const mockInfo = await mockCaseGenApisWithModel(page, token, user);
    const routeCtl = await installRootPipelineStaggeredRoute(page);

    await gotoCasesgenWorkflow(page);
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await seedDocumentRequirement(page, {
      text: '需求：流式生成部分模块后刷新，已展示的模块用例不能丢失。',
      requirementLabel: 'XMind流式刷新保留需求',
    });
    await seedPrepState(page, {
      step: 3,
      requirementMode: 'document',
      caseImportMode: 'skip',
      completed: true,
    });

    await openXmindCaseGenDrawer(page);
    await openRootContextMenu(page);
    await clickContextMenuAction(page, '生成全量用例');

    await waitForNodeText(page, '登录模块');
    await waitForNodeText(page, '支付模块');
    await waitForNodeText(page, '支付模块-尾批用例');
    await waitForNodeTextAbsent(page, '登录模块-首批用例');

    const partialBeforeReload = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state) return null;
      var modules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      var pay = null;
      for (var i = 0; i < modules.length; i += 1) {
        if (String(modules[i] && modules[i].title || '') === '支付模块') {
          pay = modules[i];
          break;
        }
      }
      var raw = pay && pay.id && state.caseGenResults ? String(state.caseGenResults[pay.id] || '') : '';
      return {
        payModuleId: pay ? String(pay.id || '') : '',
        payHasCase: raw.indexOf('支付模块-尾批用例') !== -1,
      };
    });
    expect(partialBeforeReload).not.toBeNull();
    expect(partialBeforeReload.payHasCase).toBe(true);

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await waitXmindModelAssigned(page, mockInfo.modelId);
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await waitForNodeText(page, 'XMind流式刷新保留需求');
    await waitForNodeText(page, '支付模块');
    await waitForNodeText(page, '支付模块-尾批用例');
    await waitForNodeText(page, '登录模块-首批用例');
    await expect(page.locator('#xmindCaseGenStatus')).toHaveText('已生成 2 个模块，2 条用例');

    const finalState = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state) return null;
      var modules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      var summary = {};
      modules.forEach(function(item) {
        if (!item || !item.id) return;
        var raw = state.caseGenResults ? String(state.caseGenResults[item.id] || '') : '';
        summary[String(item.title || '')] = raw;
      });
      return summary;
    });
    expect(finalState).not.toBeNull();
    expect(String(finalState['支付模块'] || '')).toContain('支付模块-尾批用例');
    expect(String(finalState['登录模块'] || '')).toContain('登录模块-首批用例');
    expect(routeCtl.getCalls().length).toBeGreaterThanOrEqual(4);
  });
});
