const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;
const INSTANCE = process.env.HOSTNAME;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth:3000';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function log(req, status, extra = {}) {
  const source = req.headers['x-real-ip'] || req.ip;
  console.log(
    JSON.stringify({
      service: 'storage',
      instance: INSTANCE,
      method: req.method,
      path: req.originalUrl,
      source,
      status,
      timestamp: new Date().toISOString(),
      ...extra,
    })
  );
}

async function connectWithRetry(attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await pool.query('SELECT 1');
      console.log(`[storage] connected to PostgreSQL`);
      return;
    } catch (err) {
      console.log(`[storage] database not ready, retry ${i}/${attempts}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('[storage] could not connect to PostgreSQL');
}

app.get('/storage', async (req, res) => {
  let authResponse;

  try {
    authResponse = await axios.get(`${AUTH_SERVICE_URL}/auth`, { timeout: 3000 });
  } catch (err) {
    log(req, 503);
    return res.status(503).json({ error: 'auth service unavailable' });
  }

  if (!authResponse.data.authorized) {
    log(req, 403);
    return res.status(403).json({ error: 'forbidden' });
  }

  try {
    const result = await pool.query('SELECT id, name, description FROM items ORDER BY id');
    log(req, 200, { items: result.rows.length });
    return res.json({
      authorized: true,
      data: result.rows,
      service: 'storage',
      instance: INSTANCE,
      auth_instance: authResponse.data.instance,
    });
  } catch (err) {
    log(req, 500);
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/health', (req, res) => {
  log(req, 200);
  res.json({ status: 'ok', service: 'storage', instance: INSTANCE });
});

connectWithRetry()
  .then(() => {
    app.listen(PORT, () => console.log(`[storage] listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
