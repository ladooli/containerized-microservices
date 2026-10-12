const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const INSTANCE = process.env.HOSTNAME;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function log(req, status) {
  const source = req.headers['x-real-ip'] || req.ip;
  console.log(
    JSON.stringify({
      service: 'auth',
      instance: INSTANCE,
      method: req.method,
      path: req.originalUrl,
      source,
      status,
      timestamp: new Date().toISOString(),
    })
  );
}

async function connectWithRetry(attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await pool.query('SELECT 1');
      console.log(`[auth] connected to PostgreSQL`);
      return;
    } catch (err) {
      console.log(`[auth] database not ready, retry ${i}/${attempts}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('[auth] could not connect to PostgreSQL');
}

app.get('/auth', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    log(req, 200);
    res.json({ authorized: true, service: 'auth', instance: INSTANCE });
  } catch (err) {
    log(req, 503);
    res.status(503).json({ authorized: false, error: 'dependency unavailable' });
  }
});

app.get('/health', (req, res) => {
  log(req, 200);
  res.json({ status: 'ok', service: 'auth', instance: INSTANCE });
});

connectWithRetry()
  .then(() => {
    app.listen(PORT, () => console.log(`[auth] listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
