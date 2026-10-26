const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const exigirLogin = require('../middleware/auth');

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function criarSessao(res, usuario) {
  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post('/cadastro', async (req, res) => {
  const nome = (req.body.nome || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const senha = req.body.senha || '';

  if (!nome) return res.status(400).json({ erro: 'Informe o nome.' });
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ erro: 'E-mail inválido.' });
  if (senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });

  try {
    const existe = await pool.query('SELECT 1 FROM usuarios WHERE email = $1', [email]);
    if (existe.rowCount) return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });

    const senhaHash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email',
      [nome, email, senhaHash]
    );

    criarSessao(res, rows[0]);
    res.status(201).json({ usuario: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
  }
});

router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const senha = req.body.senha || '';

  try {
    const { rows } = await pool.query('SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    criarSessao(res, usuario);
    res.json({ usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao fazer login.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', exigirLogin, (req, res) => {
  res.json({ usuario: req.usuario });
});

module.exports = router;
