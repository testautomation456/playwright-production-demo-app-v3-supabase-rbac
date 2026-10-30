const { test, expect } = require('@playwright/test');
const { authHeaders } = require('../support/api');
const users = require('../support/users');

test.describe('customers CRUD', () => {
  let adminHeaders;
  let customerId;
  let payload;

  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext({ baseURL });
    adminHeaders = await authHeaders(request, users.admin);
    await request.dispose();
  });

  test.beforeEach(() => {
    // Unique per test so parallel tests never collide on unique columns.
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    payload = {
      customer_no: `CUST-T${suffix}`,
      name: 'Playwright Customer',
      email: `pw-${suffix}@example.com`,
      company: 'Automation Inc'
    };
  });

  test.afterEach(async ({ request }) => {
    // Clean up so repeated runs do not pile up data in the shared database.
    if (customerId) await request.delete(`/api/customers/${customerId}`, { headers: adminHeaders });
    customerId = undefined;
  });

  test('admin can create, update and delete a customer', async ({ request }) => {
    const created = await request.post('/api/customers', { headers: adminHeaders, data: payload });
    expect(created.status()).toBe(201);
    customerId = (await created.json()).customer.id;

    const updated = await request.put(`/api/customers/${customerId}`, { headers: adminHeaders, data: { tier: 'Gold' } });
    expect(updated.ok()).toBeTruthy();
    expect((await updated.json()).customer.tier).toBe('Gold');

    const deleted = await request.delete(`/api/customers/${customerId}`, { headers: adminHeaders });
    expect(deleted.ok()).toBeTruthy();

    const deletedAgain = await request.delete(`/api/customers/${customerId}`, { headers: adminHeaders });
    expect(deletedAgain.status()).toBe(404);
    customerId = undefined;
  });

  test('creating a customer without required fields returns 400', async ({ request }) => {
    const res = await request.post('/api/customers', { headers: adminHeaders, data: { name: 'Incomplete' } });
    expect(res.status()).toBe(400);
  });

  test('duplicate customer_no returns 409', async ({ request }) => {
    const first = await request.post('/api/customers', { headers: adminHeaders, data: payload });
    customerId = (await first.json()).customer.id;
    const duplicate = await request.post('/api/customers', { headers: adminHeaders, data: payload });
    expect(duplicate.status()).toBe(409);
  });

  test('manager can create but not delete a customer', async ({ request }) => {
    const managerHeaders = await authHeaders(request, users.manager);
    const created = await request.post('/api/customers', { headers: managerHeaders, data: payload });
    expect(created.status()).toBe(201);
    customerId = (await created.json()).customer.id;
    const res = await request.delete(`/api/customers/${customerId}`, { headers: managerHeaders });
    expect(res.status()).toBe(403);
  });
});
