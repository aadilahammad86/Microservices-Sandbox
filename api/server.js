const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'portfolio_db',
  password: process.env.DB_PASSWORD || 'supersecretpassword',
  port: process.env.DB_PORT || 5432,
});

// Database Initialization & Seeding
const initDB = async () => {
  try {
    await pool.query(`
            CREATE TABLE IF NOT EXISTS server_metrics (
                id SERIAL PRIMARY KEY,
                server_name VARCHAR(50) NOT NULL,
                cpu_usage NUMERIC(5, 2) NOT NULL,
                ram_usage NUMERIC(5, 2) NOT NULL,
                status VARCHAR(20) NOT NULL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

    await pool.query(`
            CREATE TABLE IF NOT EXISTS deployment_logs (
                id SERIAL PRIMARY KEY,
                environment VARCHAR(50) NOT NULL,
                service VARCHAR(50) NOT NULL,
                version VARCHAR(20) NOT NULL,
                deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

    // Check if data already exists
    const countRes = await pool.query('SELECT COUNT(*) FROM server_metrics');
    if (parseInt(countRes.rows[0].count) === 0) {
      console.log("Seeding sample infrastructure data...");
      await pool.query(`
                INSERT INTO server_metrics (server_name, cpu_usage, ram_usage, status) VALUES 
                ('prod-web-eu-01', 45.2, 68.5, 'Healthy'),
                ('prod-web-eu-02', 52.8, 71.0, 'Healthy'),
                ('prod-db-master', 88.5, 92.1, 'Warning'),
                ('prod-cache-01', 12.0, 45.6, 'Healthy'),
                ('staging-app-01', 5.2, 22.1, 'Maintenance');
            `);

      await pool.query(`
                INSERT INTO deployment_logs (environment, service, version) VALUES 
                ('Production', 'Auth-Service', 'v2.1.4'),
                ('Production', 'Payment-Gateway', 'v1.12.0'),
                ('Staging', 'User-API', 'v3.0.1-beta'),
                ('Production', 'Frontend-UI', 'v5.4.2');
            `);
    }
    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize database (it might be starting up). Retrying in 5s...", err.message);
    setTimeout(initDB, 5000); // Retry mechanism for docker-compose timing
  }
};

initDB();

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'Operational', uptime: process.uptime(), timestamp: new Date() });
});

// Get Live Metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM server_metrics ORDER BY id ASC');
    // Simulate slight real-time fluctuation for visual effect on the frontend
    const dynamicData = result.rows.map(row => ({
      ...row,
      cpu_usage: row.status === 'Maintenance' ? 0 : Math.min(100, Math.max(0, (parseFloat(row.cpu_usage) + (Math.random() * 10 - 5)).toFixed(1))),
      ram_usage: row.status === 'Maintenance' ? 0 : Math.min(100, Math.max(0, (parseFloat(row.ram_usage) + (Math.random() * 4 - 2)).toFixed(1)))
    }));
    res.json(dynamicData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Deployment Logs
app.get('/api/deployments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deployment_logs ORDER BY deployed_at DESC LIMIT 5');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
});
