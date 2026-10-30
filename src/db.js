const { Pool } = require('pg');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('\n[DB WARNING] DATABASE_URL is not set. API/database features will fail until you configure Supabase Postgres.\n');
}

function isRemoteDatabase(url) {
  return url && !url.includes('localhost') && !url.includes('127.0.0.1');
}

function cleanConnectionString(url) {
  if (!url) return url;

  try {
    const parsed = new URL(url);

    // Prevent sslmode=require from overriding the ssl object below.
    ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].forEach((param) => {
      parsed.searchParams.delete(param);
    });

    return parsed.toString();
  } catch (error) {
    console.warn('[DB WARNING] Could not parse DATABASE_URL; using it as provided.');
    return url;
  }
}

const shouldUseSsl = isRemoteDatabase(databaseUrl);
const connectionString = shouldUseSsl ? cleanConnectionString(databaseUrl) : databaseUrl;

const pool = new Pool({
  connectionString,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX || 8),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function query(text, params = []) {
  const start = Date.now();

  try {
    const result = await pool.query(text, params);

    if (process.env.SQL_LOG === 'true') {
      console.log('[SQL]', { text, rows: result.rowCount, ms: Date.now() - start });
    }

    return result;
  } catch (error) {
    console.error('[SQL ERROR]', error.message);
    throw error;
  }
}

async function ping() {
  const result = await query('select now() as now, current_database() as database');
  return result.rows[0];
}

module.exports = { pool, query, ping };