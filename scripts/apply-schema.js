require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

async function main() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Database schema applied successfully.');
}

main()
  .catch((error) => {
    console.error('Schema failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
