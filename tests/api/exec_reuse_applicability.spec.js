const { test, expect, request } = require('@playwright/test');

test.describe('exec reuse applicability api', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: adminUser, password: adminPass },
    });
    expect(res.status()).toBe(200);
    return (await res.json()).access_token;
  }

  test('适用性规则批量保存并在校验失败时保持原子性', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(String(health && health.db_file ? health.db_file : '')).toContain('test');

    const stamp = Date.now();
    const projectRes = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: `reuse-applicability-${stamp}`, description: 'reuse applicability api' },
    });
    expect(projectRes.status()).toBe(201);
    const projectId = (await projectRes.json()).id;

    const versionRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(versionRes.status()).toBe(201);
    const versionId = (await versionRes.json()).id;

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: `skin-reuse-${stamp}.json`,
        source: 'apitest',
        reuse_enabled: true,
        items: [
          { module: '付费皮肤', title: '付费解锁', expected: '成功', priority: 'P1', precondition: '', steps: '尝试解锁', remark: '' },
          { module: '小鱼干皮肤', title: '小鱼干解锁', expected: '成功', priority: 'P1', precondition: '', steps: '尝试解锁', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFileId = (await importRes.json()).id;

    const upsertRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertRes.status()).toBe(200);
    const execSet = await upsertRes.json();
    const execSetId = execSet.id;

    const reuseOnRes = await ctx.patch(`${apiBase}/api/exec/sets/${execSetId}`, {
      headers,
      data: { reuse_enabled: true },
    });
    expect(reuseOnRes.status()).toBe(200);

    const casesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesRes.status()).toBe(200);
    const execCases = await casesRes.json();
    expect(execCases).toHaveLength(2);

    const profile = 'character-skin-unlock-v1';
    const presets = [
      { id: 'preset-a', text: 'A皮肤', applicability: { profile, value: 'paid' } },
      { id: 'preset-b', text: 'B皮肤', applicability: { profile, value: 'fish' } },
    ];
    const paidCase = execCases.find((item) => item.module === '付费皮肤');
    const fishCase = execCases.find((item) => item.module === '小鱼干皮肤');
    const payload = {
      reuse_presets: presets,
      cases: [
        {
          case_id: paidCase.id,
          status: '未执行',
          reuse_details: [
            { id: 'paid-a', presetId: 'preset-a', text: 'A皮肤', note: '', status: '未执行', removed: false },
            { id: 'paid-b', presetId: 'preset-b', text: 'B皮肤', note: '', status: '不适用', removed: false, statusOrigin: 'auto-applicability', statusOriginProfile: profile },
          ],
        },
        {
          case_id: fishCase.id,
          status: '未执行',
          reuse_details: [
            { id: 'fish-a', presetId: 'preset-a', text: 'A皮肤', note: '', status: '不适用', removed: false, statusOrigin: 'auto-applicability', statusOriginProfile: profile },
            { id: 'fish-b', presetId: 'preset-b', text: 'B皮肤', note: '', status: '未执行', removed: false },
          ],
        },
      ],
    };

    const applyRes = await ctx.patch(`${apiBase}/api/exec/sets/${execSetId}/reuse-applicability`, {
      headers,
      data: payload,
    });
    expect(applyRes.status()).toBe(200);
    const applied = await applyRes.json();
    expect(applied.updated_cases).toBe(2);
    expect(applied.updated_case_ids.sort()).toEqual([paidCase.id, fishCase.id].sort());
    expect(applied.reuse_presets).toEqual(presets);

    const afterRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(afterRes.status()).toBe(200);
    const afterCases = await afterRes.json();
    const afterPaid = afterCases.find((item) => item.id === paidCase.id);
    const afterFish = afterCases.find((item) => item.id === fishCase.id);
    expect(afterPaid.reuse_details[1].status).toBe('不适用');
    expect(afterPaid.reuse_details[1].statusOrigin).toBe('auto-applicability');
    expect(afterFish.reuse_details[0].status).toBe('不适用');

    const invalidPresets = [
      { id: 'preset-a', text: 'A皮肤', applicability: { profile, value: 'condition' } },
      presets[1],
    ];
    const invalidRes = await ctx.patch(`${apiBase}/api/exec/sets/${execSetId}/reuse-applicability`, {
      headers,
      data: {
        reuse_presets: invalidPresets,
        cases: [
          { case_id: paidCase.id, status: '失败', reuse_details: afterPaid.reuse_details },
          { case_id: 999999999, status: '未执行', reuse_details: [] },
        ],
      },
    });
    expect(invalidRes.status()).toBe(400);

    const finalCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(finalCasesRes.status()).toBe(200);
    const finalPaid = (await finalCasesRes.json()).find((item) => item.id === paidCase.id);
    expect(finalPaid.status).toBe('未执行');
    expect(finalPaid.reuse_details).toEqual(afterPaid.reuse_details);

    const setsRes = await ctx.get(`${apiBase}/api/exec/sets?project_id=${projectId}`, { headers });
    expect(setsRes.status()).toBe(200);
    const finalSet = (await setsRes.json()).find((item) => item.id === execSetId);
    expect(finalSet.reuse_presets).toEqual(presets);

    await ctx.dispose();
  });
});
