(function() {
  var loaded = false;
  var sources = [];
  function node(id) { return document.getElementById(id); }
  function api() { return window.app && window.app.apiClient; }
  function message(id, text) { node(id).textContent = text || ''; }
  function fail(id, error) { message(id, error && error.message ? error.message : '请求失败'); }
  function request(path, method, payload) { return api().integrationRequest(path, method, payload); }
  function button(label, handler) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'secondary';
    el.textContent = label;
    el.addEventListener('click', handler);
    return el;
  }
  function hideSecret() {
    node('mcpTokenSecret').value = '';
    node('mcpTokenReveal').classList.add('hidden');
  }
  async function refreshTokens() {
    try {
      var rows = await request('mcp-tokens');
      var list = node('mcpTokenList');
      list.textContent = '';
      rows.forEach(function(row) {
        var item = document.createElement('p');
        var expiry = new Date(row.expires_at + (/Z$|[+-]\d\d:\d\d$/.test(row.expires_at) ? '' : 'Z'));
        var expired = expiry.getTime() <= Date.now();
        item.appendChild(document.createTextNode(row.name + ' · ' + row.token_prefix + '… · '
          + (row.read_only ? '只读' : '按本人权限读写') + ' · '
          + (row.revoked ? '已撤销' : expired ? '已过期' : '到期：' + expiry.toLocaleString()) + ' '));
        if (!row.revoked && !expired) item.appendChild(button('撤销', async function() {
          try {
            await request('mcp-tokens/' + row.id, 'DELETE');
            hideSecret();
            await refreshTokens();
            message('mcpTokenStatus', '凭据已撤销');
          } catch (err) { fail('mcpTokenStatus', err); }
        }));
        list.appendChild(item);
      });
      if (!rows.length) list.textContent = '尚未生成 MCP 凭据。';
    } catch (err) { fail('mcpTokenStatus', err); }
  }
  async function refreshSources() {
    try {
      sources = await api().listKnowledgeSources();
      var select = node('knowledgeSourceSelect');
      select.textContent = '';
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '请选择已授权的项目知识库';
      select.appendChild(empty);
      var list = node('knowledgeSourceList');
      list.textContent = '';
      sources.forEach(function(source) {
        var option = document.createElement('option');
        option.value = String(source.id);
        option.textContent = '项目 ' + source.project_id + ' · ' + source.name;
        select.appendChild(option);
        var row = document.createElement('p');
        row.appendChild(document.createTextNode(option.textContent + ' '));
        row.appendChild(button('停用', async function() {
          try {
            await request('knowledge-base/sources/' + source.id, 'DELETE');
            await refreshSources();
            message('knowledgeSourceStatus', '知识库已停用');
          } catch (err) { fail('knowledgeSourceStatus', err); }
        }));
        list.appendChild(row);
      });
      message('knowledgeSourceStatus', sources.length ? '' : '暂无已授权知识库，请联系管理员登记。');
    } catch (err) { fail('knowledgeSourceStatus', err); }
  }
  async function start() {
    if (loaded || !node('mcpAccessPanel') || !api()) return;
    var state = window.app.state || {};
    if (!state.currentUser) return;
    loaded = true;
    node('mcpServerAddress').textContent = new URL('mcp', window.location.href).href;
    node('hideMcpToken').addEventListener('click', hideSecret);
    window.addEventListener('pagehide', hideSecret);
    node('copyMcpToken').addEventListener('click', async function() {
      try {
        await navigator.clipboard.writeText(node('mcpTokenSecret').value);
        message('mcpTokenStatus', '凭据已复制');
      } catch (err) { message('mcpTokenStatus', '无法自动复制，请选中文本手动复制。'); }
    });
    node('createMcpToken').addEventListener('click', async function() {
      var createButton = node('createMcpToken');
      createButton.disabled = true;
      hideSecret();
      try {
        var result = await request('mcp-tokens', 'POST', {
          name: node('mcpTokenName').value.trim(), expires_in_days: Number(node('mcpTokenDays').value),
          read_only: node('mcpTokenReadOnly').checked,
        });
        node('mcpTokenSecret').value = result.token;
        node('mcpTokenReveal').classList.remove('hidden');
        message('mcpTokenStatus', '凭据已生成，仅本次可查看完整内容。');
        await refreshTokens();
      } catch (err) { fail('mcpTokenStatus', err); }
      finally { createButton.disabled = false; }
    });
    node('refreshMcpTokens').addEventListener('click', refreshTokens);
    node('refreshKnowledgeSources').addEventListener('click', refreshSources);
    node('knowledgeSourceSelect').addEventListener('change', function() {
      var selected = sources.find(function(item) { return String(item.id) === node('knowledgeSourceSelect').value; });
      if (!selected) return;
      node('knowledgeBaseBaseUrlInput').value = selected.base_url;
      node('knowledgeBaseBaseUrlInput').dispatchEvent(new Event('input', { bubbles: true }));
      message('knowledgeSourceStatus', '已选中 ' + selected.name + '，点击上方“保存地址”应用。');
    });
    if (state.currentUser.role === 'admin') {
      node('knowledgeSourceAdmin').classList.remove('hidden');
      try {
        var projects = await api().listProjects();
        projects.forEach(function(project) {
          var option = document.createElement('option');
          option.value = String(project.id);
          option.textContent = project.name;
          node('knowledgeSourceProject').appendChild(option);
        });
      } catch (err) { fail('knowledgeSourceStatus', err); }
      node('registerKnowledgeSource').addEventListener('click', async function() {
        node('registerKnowledgeSource').disabled = true;
        try {
          await request('knowledge-base/sources', 'POST', {
            project_id: Number(node('knowledgeSourceProject').value),
            name: node('knowledgeSourceName').value.trim(), base_url: node('knowledgeSourceUrl').value.trim(),
          });
          await refreshSources();
          message('knowledgeSourceStatus', '知识库已绑定到所选项目');
        } catch (err) { fail('knowledgeSourceStatus', err); }
        finally { node('registerKnowledgeSource').disabled = false; }
      });
    }
    await Promise.all([refreshTokens(), refreshSources()]);
  }
  window.addEventListener('app-auth-ready', start);
  document.addEventListener('DOMContentLoaded', start);
})();
