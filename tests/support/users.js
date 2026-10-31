// The admin password is internal-only and comes from the environment (.env locally, a secret in CI).
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
if (!adminPassword) {
  throw new Error('TEST_ADMIN_PASSWORD is not set. Add it to .env (local) or to GitHub Secrets (CI).');
}

module.exports = {
  admin: { email: 'admin@example.com', password: adminPassword },
  manager: { email: 'manager@example.com', password: 'manager123' },
  user: { email: 'user@example.com', password: 'user123' }
};
