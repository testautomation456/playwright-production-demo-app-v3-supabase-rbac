const { test, expect } = require('@playwright/test');
const { authHeaders } = require('../support/api');
const users = require('../support/users');

test('API login and protected dashboard work', async ({ request }) => {
  const headers = await authHeaders(request, users.admin);
  const res = await request.get('/api/dashboard', { headers });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.metrics.customers).toBeGreaterThan(0);
});

test('login with wrong password returns 401', async ({ request }) => {
  const res = await request.post('/api/auth/login', { data: { username: users.admin.email, password: 'nope' } });
  expect(res.status()).toBe(401);
});

test('protected endpoint without token returns 401', async ({ request }) => {
  const res = await request.get('/api/dashboard');
  expect(res.status()).toBe(401);
});

test('user role receives 403 for admin API', async ({ request }) => {
  const headers = await authHeaders(request, users.user);
  const res = await request.get('/api/admin/users', { headers });
  expect(res.status()).toBe(403);
});

test('manager can read customers API', async ({ request }) => {
  const headers = await authHeaders(request, users.manager);
  const res = await request.get('/api/customers', { headers });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(Array.isArray(data.customers)).toBeTruthy();
});

test('admin cannot create a user with an invalid role', async ({ request }) => {
  const headers = await authHeaders(request, users.admin);
  const res = await request.post('/api/admin/users', {
    headers,
    data: { name: 'Bad Role', email: `bad-${Date.now()}@example.com`, password: 'x12345', role: 'superuser' }
  });
  expect(res.status()).toBe(400);
});
