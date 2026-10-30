const { expect } = require('@playwright/test');

// Logs in through the API and returns an Authorization header object.
async function authHeaders(request, { email, password }) {
  const res = await request.post('/api/auth/login', { data: { username: email, password } });
  expect(res.ok(), `login failed for ${email}`).toBeTruthy();
  const { token } = await res.json();
  return { Authorization: `Bearer ${token}` };
}

module.exports = { authHeaders };
