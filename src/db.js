require('dotenv').config();
const { Pool, types } = require('pg');

// Retorna NUMERIC como número em vez de string
types.setTypeParser(1700, (v) => parseFloat(v));
// Retorna DATE como 'AAAA-MM-DD' sem converter fuso horário
types.setTypeParser(1082, (v) => v);

// Aceita DATABASE_URL ou as variáveis PGHOST/PGUSER/PGPASSWORD/PGDATABASE (lidas automaticamente pelo pg)
if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  console.error('Conexão com o banco não configurada. Defina DATABASE_URL ou PGHOST etc. no .env (veja .env.example).');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
