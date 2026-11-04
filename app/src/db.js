// Ligação à Azure SQL Database através do Private Endpoint (sem IP público)
const sql = require('mssql');

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect({
      server: process.env.DB_SERVER,       // ex: cloudnova-sql-xxxx.database.windows.net -> resolve para IP privado
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    }).catch((err) => { poolPromise = null; throw err; });
  }
  return poolPromise;
}

async function init() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.Acessos', 'U') IS NULL
    CREATE TABLE dbo.Acessos (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Utilizador NVARCHAR(256) NOT NULL,
      DataHora DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )`);
}

async function registarAcesso(utilizador) {
  await init();
  const pool = await getPool();
  await pool.request()
    .input('u', sql.NVarChar(256), utilizador)
    .query('INSERT INTO dbo.Acessos (Utilizador) VALUES (@u)');
  const r = await pool.request().query(
    'SELECT TOP 5 Utilizador, DataHora FROM dbo.Acessos ORDER BY Id DESC; SELECT COUNT(*) AS Total FROM dbo.Acessos'
  );
  return { ultimos: r.recordsets[0], total: r.recordsets[1][0].Total };
}

module.exports = { registarAcesso };
