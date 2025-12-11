const { test, expect, request } = require('@playwright/test');

test.describe('auth change password', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';
  const tempPass = 'TempPwd123!';

  async function login(ctx, user, pwd) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: user, password: pwd },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBeTruthy();
    return body;
  }

  test('admin can change password and revert', async () => {
    const ctx = await request.newContext();

    // login with original password
    const loginRes = await login(ctx, adminUser, adminPass);
    const token = loginRes.access_token;

    // change password to temp
    const changeRes = await ctx.post(`${apiBase}/api/auth/password`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { old_password: adminPass, new_password: tempPass },
    });
    expect(changeRes.status()).toBe(200);

    // login with new password
    await login(ctx, adminUser, tempPass);

    // change back to original
    const relogin = await login(ctx, adminUser, tempPass);
    const token2 = relogin.access_token;
    const revertRes = await ctx.post(`${apiBase}/api/auth/password`, {
      headers: { Authorization: `Bearer ${token2}` },
      data: { old_password: tempPass, new_password: adminPass },
    });
    expect(revertRes.status()).toBe(200);
  });
});
