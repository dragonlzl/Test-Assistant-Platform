const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function initPage(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
  await page.evaluate(() => {
    if (window.app && typeof window.app.init === 'function') window.app.init();
  });
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });
}

test.describe('需求澄清视图渲染稳定性', () => {
  test('等待澄清期间心跳更新不应重建输入节点', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
      } catch (_) {}
    });

    await initPage(page, base + '/ai-workflow.html?tab=auto');

    const result = await page.evaluate(() => {
      if (!window.app || !window.app.state) {
        return { ok: false, reason: 'no_state' };
      }
      var st = window.app.state;
      st.reviewRows = [{
        index: 0,
        source: { '类别': '需求模糊' },
        category: '需求模糊',
        point: '技能触发时机描述不一致',
        reason: '条件字段缺少严格定义',
        branch: '夜晚/白天切换时是否可触发',
        clarification: '',
      }];
      if (!(st.reviewClarifications && typeof st.reviewClarifications.set === 'function')) {
        st.reviewClarifications = new Map();
      }
      st.reviewClarifications.set(0, '');

      var toggle = document.getElementById('autoNeedClarify');
      if (!toggle) return { ok: false, reason: 'no_toggle' };
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));

      var container = document.getElementById('autoClarifyContainer');
      if (!container) return { ok: false, reason: 'no_container' };
      var textarea = container.querySelector('textarea[data-clarify-index="0"]');
      if (!textarea) {
        return { ok: false, reason: 'no_textarea_after_enable' };
      }

      textarea.value = '澄清中';
      var beforeNode = textarea;

      for (var i = 0; i < 5; i += 1) {
        var task = {
          id: 'e2e-clarify-render-task',
          kind: 'full',
          status: 'running',
          stepIndex: 1,
          stepKey: 'review',
          updatedAt: Date.now(),
          heartbeatAt: Date.now(),
        };
        try {
          window.dispatchEvent(new CustomEvent('auto-workflow-task', {
            detail: { task: task, action: 'heartbeat' },
          }));
        } catch (_) {}
      }

      var afterNode = container.querySelector('textarea[data-clarify-index="0"]');
      return {
        ok: true,
        sameNode: beforeNode === afterNode,
        value: afterNode ? String(afterNode.value || '') : '',
      };
    });

    expect(result && result.ok).toBe(true);
    expect(result.sameNode).toBe(true);
    expect(result.value).toBe('澄清中');
  });
});
