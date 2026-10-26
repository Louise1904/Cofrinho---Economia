require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const initDb = require('./initDb');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET não definida. Crie o arquivo .env (veja .env.example).');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/economia', require('./routes/economia'));
app.use('/api/metas', require('./routes/metas'));
app.use('/api/investimentos', require('./routes/investimentos'));
app.use('/api/tipos', require('./routes/tipos').router);

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Sistema rodando em http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Não foi possível conectar ao banco de dados:', err.message);
    process.exit(1);
  });
