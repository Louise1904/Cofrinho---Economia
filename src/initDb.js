const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = initDb;

// Permite rodar direto: npm run db:init
if (require.main === module) {
  initDb()
    .then(() => {
      console.log('Tabelas criadas/verificadas com sucesso.');
      return pool.end();
    })
    .catch((err) => {
      console.error('Erro ao criar tabelas:', err.message);
      process.exit(1);
    });
}
