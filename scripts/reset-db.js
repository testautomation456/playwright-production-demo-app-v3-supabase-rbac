require('dotenv').config();
const { pool } = require('../src/db');

async function main() {
  await pool.query('drop table if exists audit_logs, orders, products, customers, app_users cascade');
  console.log('Database tables dropped. Run npm run db:seed to recreate seed data.');
}

main()
  .catch((error) => {
    console.error('Reset failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
