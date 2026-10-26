// Tipos personalizados de metas e investimentos
const express = require('express');
const pool = require('../db');
const exigirLogin = require('../middleware/auth');

const router = express.Router();
router.use(exigirLogin);

const CONTEXTOS = ['meta', 'investimento'];

router.get('/:contexto', async (req, res) => {
  const { contexto } = req.params;
  if (!CONTEXTOS.includes(contexto)) return res.status(400).json({ erro: 'Contexto inválido.' });
  try {
    const { rows } = await pool.query(
      `SELECT id, nome, icone FROM tipos_personalizados
        WHERE usuario_id = $1 AND contexto = $2
        ORDER BY LOWER(nome)`,
      [req.usuario.id, contexto]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar os tipos.' });
  }
});

router.post('/:contexto', async (req, res) => {
  const { contexto } = req.params;
  const nome = (req.body.nome || '').trim();
  const icone = (req.body.icone || '').trim() || '🏷️';

  if (!CONTEXTOS.includes(contexto)) return res.status(400).json({ erro: 'Contexto inválido.' });
  if (!nome || nome.length > 40) return res.status(400).json({ erro: 'Informe um nome de até 40 caracteres.' });
  if (icone.length > 16) return res.status(400).json({ erro: 'Use apenas um emoji como ícone.' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO tipos_personalizados (usuario_id, contexto, nome, icone)
       VALUES ($1, $2, $3, $4) RETURNING id, nome, icone`,
      [req.usuario.id, contexto, nome, icone]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Você já tem um tipo com esse nome.' });
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar o tipo.' });
  }
});

// Metas e investimentos já cadastrados mantêm o nome do tipo mesmo após excluí-lo
router.delete('/:contexto/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM tipos_personalizados WHERE id = $1 AND usuario_id = $2 AND contexto = $3',
      [id, req.usuario.id, req.params.contexto]
    );
    if (!rowCount) return res.status(404).json({ erro: 'Tipo não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir o tipo.' });
  }
});

// Verifica se um tipo personalizado existe para o usuário (usado nas rotas de metas e investimentos)
async function tipoPersonalizadoExiste(usuarioId, contexto, nome) {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM tipos_personalizados WHERE usuario_id = $1 AND contexto = $2 AND nome = $3',
    [usuarioId, contexto, nome]
  );
  return rowCount > 0;
}

module.exports = { router, tipoPersonalizadoExiste };
