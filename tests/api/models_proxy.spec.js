const { test, expect, request } = require('@playwright/test');
const http = require('http');

test.describe('模型代理转发', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username, password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    return body.access_token;
  }

  test('代理转发可透传响应与头部', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        let payload = null;
        try {
          payload = raw ? JSON.parse(raw) : null;
        } catch (err) {
          payload = null;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          path: req.url,
          received: payload,
          auth: req.headers.authorization || '',
        }));
      });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const targetUrl = `http://127.0.0.1:${port}/v1/responses`;

    try {
      const proxyRes = await ctx.post(`${apiBase}/api/models/proxy`, {
        headers,
        data: {
          base_url: targetUrl,
          headers: { Authorization: 'Bearer sk-proxy' },
          body: { ping: 'pong' },
          timeout_sec: 5,
        },
      });
      expect(proxyRes.status()).toBe(200);
      const body = await proxyRes.json();
      expect(body.ok).toBe(true);
      expect(body.received && body.received.ping).toBe('pong');
      expect(body.auth).toBe('Bearer sk-proxy');
    } finally {
      server.close();
    }
  });
});
