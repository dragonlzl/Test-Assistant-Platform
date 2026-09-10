'use strict';

async function installPersistentModelTaskRoute(page, options) {
  const input = options || {};
  const tasksById = new Map();
  const taskIdByRequestKey = new Map();
  const createCalls = [];
  const cancelCalls = [];
  const proxyCalls = [];
  const responseTexts = Array.isArray(input.responseTexts) ? input.responseTexts.slice() : [];
  const defaultResponseText = String(input.responseText || '{"modules":[]}');
  const completeAfterMs = Math.max(0, Number(input.completeAfterMs || 0));

  function syncTask(task) {
    if (!task || task.status !== 'running') return task;
    if (Date.now() < Number(task.__completeAt || 0)) return task;
    task.status = 'succeeded';
    task.upstream_status = 200;
    task.response_content_type = 'application/json';
    task.completed_at = new Date().toISOString();
    task.updated_at = task.completed_at;
    return task;
  }

  function serializeTask(task) {
    const next = Object.assign({}, syncTask(task));
    delete next.__completeAt;
    return next;
  }

  await page.route('**/api/model-proxy', async (route) => {
    proxyCalls.push({
      method: route.request().method(),
      body: route.request().postDataJSON ? route.request().postDataJSON() : {},
    });
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: '不应回退到同步模型代理' }),
    });
  });

  await page.route('**/api/model-tasks**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathName = url.pathname;
    const method = request.method();
    const respond = (status, body) => route.fulfill({
      status: status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (pathName === '/api/model-tasks/cancel-by-owner' && method === 'POST') {
      const body = request.postDataJSON ? request.postDataJSON() : {};
      const ownerKey = String(body && body.owner_key ? body.owner_key : '');
      const cancelledIds = [];
      tasksById.forEach((task) => {
        syncTask(task);
        if (task.owner_key !== ownerKey) return;
        if (!['queued', 'running', 'cancel_requested'].includes(task.status)) return;
        task.status = 'cancelled';
        task.error = '用户已中断生成';
        task.cancel_requested_at = new Date().toISOString();
        task.completed_at = task.cancel_requested_at;
        task.updated_at = task.cancel_requested_at;
        cancelledIds.push(task.id);
      });
      cancelCalls.push({ ownerKey: ownerKey, taskIds: cancelledIds.slice() });
      return respond(200, { cancelled_count: cancelledIds.length, task_ids: cancelledIds });
    }

    if (pathName === '/api/model-tasks' && method === 'POST') {
      const body = request.postDataJSON ? request.postDataJSON() : {};
      const requestKey = String(body && body.idempotency_key ? body.idempotency_key : '');
      const existingId = taskIdByRequestKey.get(requestKey);
      createCalls.push({
        requestKey: requestKey,
        ownerKey: String(body && body.owner_key ? body.owner_key : ''),
        resumeOnly: body && body.resume_only === true,
        existingTaskId: existingId || '',
      });
      if (existingId && tasksById.has(existingId)) {
        return respond(202, serializeTask(tasksById.get(existingId)));
      }
      if (body && body.resume_only === true) {
        return respond(409, { detail: '待恢复的后端任务不存在' });
      }
      const index = tasksById.size;
      const taskId = 'mock-model-task-' + String(index + 1);
      const now = new Date().toISOString();
      const responseText = String(
        responseTexts[index] !== undefined ? responseTexts[index] : defaultResponseText
      );
      const task = {
        id: taskId,
        user_id: 1,
        model_config_id: Number(body && body.model_config_id ? body.model_config_id : 0),
        scene: String(body && body.scene ? body.scene : 'generation'),
        owner_key: String(body && body.owner_key ? body.owner_key : ''),
        idempotency_key: requestKey,
        status: 'running',
        timeout_sec: Number(body && body.timeout_sec ? body.timeout_sec : 60),
        upstream_status: null,
        response_content_type: null,
        response_body: JSON.stringify({
          output: [{
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: responseText }],
          }],
        }),
        error: '',
        cancel_requested_at: null,
        started_at: now,
        completed_at: null,
        created_at: now,
        updated_at: now,
        __completeAt: Date.now() + completeAfterMs,
      };
      tasksById.set(taskId, task);
      taskIdByRequestKey.set(requestKey, taskId);
      return respond(202, serializeTask(task));
    }

    const taskMatch = pathName.match(/^\/api\/model-tasks\/([^/]+)$/);
    if (taskMatch && method === 'GET') {
      const taskId = decodeURIComponent(taskMatch[1]);
      if (!tasksById.has(taskId)) return respond(404, { detail: '模型任务不存在' });
      return respond(200, serializeTask(tasksById.get(taskId)));
    }

    const cancelMatch = pathName.match(/^\/api\/model-tasks\/([^/]+)\/cancel$/);
    if (cancelMatch && method === 'POST') {
      const taskId = decodeURIComponent(cancelMatch[1]);
      const task = tasksById.get(taskId);
      if (!task) return respond(404, { detail: '模型任务不存在' });
      syncTask(task);
      if (['queued', 'running', 'cancel_requested'].includes(task.status)) {
        task.status = 'cancelled';
        task.error = '用户已中断生成';
        task.cancel_requested_at = new Date().toISOString();
        task.completed_at = task.cancel_requested_at;
        task.updated_at = task.cancel_requested_at;
      }
      cancelCalls.push({ ownerKey: task.owner_key, taskIds: [task.id] });
      return respond(200, serializeTask(task));
    }

    if (pathName === '/api/model-tasks' && method === 'GET') {
      return respond(200, Array.from(tasksById.values()).map(serializeTask));
    }
    return respond(404, { detail: 'not found' });
  });

  return {
    getCreateCalls() {
      return createCalls.slice();
    },
    getCancelCalls() {
      return cancelCalls.slice();
    },
    getProxyCallCount() {
      return proxyCalls.length;
    },
    getTasks() {
      return Array.from(tasksById.values()).map(serializeTask);
    },
  };
}

module.exports = {
  installPersistentModelTaskRoute,
};
