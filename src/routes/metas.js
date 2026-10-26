const express = require('express');
const pool = require('../db');
const exigirLogin = require('../middleware/auth');
const { tipoPersonalizadoExiste } = require('./tipos');

const router = express.Router();
router.use(exigirLogin);

const CORES = ['azul', 'rosa', 'lilas', 'verde'];
const TIPOS_META = ['reserva', 'viagem', 'ferias', 'casa', 'carro', 'estudos', 'casamento', 'presentes', 'eletronicos', 'pet', 'emergencia', 'saude', 'filhos', 'festa'];

async function tipoValido(usuarioId, tipo) {
  return !tipo || TIPOS_META.includes(tipo) || tipoPersonalizadoExiste(usuarioId, 'meta', tipo);
}
const TIPOS_MOVIMENTO = ['deposito', 'retirada'];
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MES_REGEX = /^\d{4}-\d{2}$/;

function validarValor(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// Valida os campos de uma caixinha; devolve { erro } ou { dados }
function lerCaixinha(body) {
  const nome = (body.nome || '').trim();
  const icone = (body.icone || '💰').trim();
  const cor = body.cor || 'azul';
  const meta = body.meta === '' || body.meta == null ? null : validarValor(body.meta);
  const dataAlvo = body.data_alvo || null;
  const tipo = (body.tipo || '').trim() || null;

  if (!nome || nome.length > 60) return { erro: 'Informe um nome de até 60 caracteres.' };
  if (!icone || icone.length > 16) return { erro: 'Ícone inválido.' };
  if (!CORES.includes(cor)) return { erro: 'Cor inválida.' };
  if (body.meta !== '' && body.meta != null && !meta) return { erro: 'A meta deve ser um valor maior que zero.' };
  if (dataAlvo && !DATA_REGEX.test(dataAlvo)) return { erro: 'Data alvo inválida.' };
  if (tipo && tipo.length > 40) return { erro: 'Tipo inválido.' };

  return { dados: [nome, icone, cor, meta, dataAlvo, tipo] };
}

// Lista as caixinhas com saldo total e quanto foi guardado no mês informado
router.get('/caixinhas', async (req, res) => {
  const mes = req.query.mes;
  if (!MES_REGEX.test(mes || '')) return res.status(400).json({ erro: 'Mês inválido (use AAAA-MM).' });

  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.nome, c.icone, c.cor, c.meta, c.data_alvo, c.tipo,
              COALESCE(SUM(CASE WHEN m.tipo = 'deposito' THEN m.valor ELSE -m.valor END), 0)::float AS saldo,
              COALESCE(SUM(CASE WHEN m.tipo = 'deposito' THEN m.valor ELSE -m.valor END)
                         FILTER (WHERE TO_CHAR(m.data, 'YYYY-MM') = $2), 0)::float AS movimento_mes
         FROM caixinhas c
         LEFT JOIN caixinha_movimentos m ON m.caixinha_id = c.id
        WHERE c.usuario_id = $1
        GROUP BY c.id
        ORDER BY c.criado_em, c.id`,
      [req.usuario.id, mes]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar as caixinhas.' });
  }
});

router.post('/caixinhas', async (req, res) => {
  const { erro, dados } = lerCaixinha(req.body);
  if (erro) return res.status(400).json({ erro });

  try {
    if (!(await tipoValido(req.usuario.id, dados[5]))) return res.status(400).json({ erro: 'Tipo de meta inválido.' });
    const { rows } = await pool.query(
      `INSERT INTO caixinhas (usuario_id, nome, icone, cor, meta, data_alvo, tipo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nome, icone, cor, meta, data_alvo, tipo`,
      [req.usuario.id, ...dados]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar a caixinha.' });
  }
});

router.put('/caixinhas/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  const { erro, dados } = lerCaixinha(req.body);
  if (erro) return res.status(400).json({ erro });

  try {
    if (!(await tipoValido(req.usuario.id, dados[5]))) return res.status(400).json({ erro: 'Tipo de meta inválido.' });
    const { rows } = await pool.query(
      `UPDATE caixinhas SET nome = $3, icone = $4, cor = $5, meta = $6, data_alvo = $7, tipo = $8
        WHERE id = $1 AND usuario_id = $2
        RETURNING id, nome, icone, cor, meta, data_alvo, tipo`,
      [id, req.usuario.id, ...dados]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Caixinha não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar a caixinha.' });
  }
});

router.delete('/caixinhas/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  try {
    const { rowCount } = await pool.query('DELETE FROM caixinhas WHERE id = $1 AND usuario_id = $2', [
      id,
      req.usuario.id,
    ]);
    if (!rowCount) return res.status(404).json({ erro: 'Caixinha não encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir a caixinha.' });
  }
});

// ---------- Movimentos (guardar / resgatar) ----------

router.get('/caixinhas/:id/movimentos', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  try {
    const { rows } = await pool.query(
      `SELECT id, tipo, valor, data, descricao
         FROM caixinha_movimentos
        WHERE caixinha_id = $1 AND usuario_id = $2
        ORDER BY data DESC, id DESC`,
      [id, req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar o histórico.' });
  }
});

router.post('/caixinhas/:id/movimentos', async (req, res) => {
  const id = Number(req.params.id);
  const { tipo, data } = req.body;
  const valor = validarValor(req.body.valor);
  const descricao = (req.body.descricao || '').trim() || null;

  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  if (!TIPOS_MOVIMENTO.includes(tipo)) return res.status(400).json({ erro: 'Tipo de movimento inválido.' });
  if (!valor) return res.status(400).json({ erro: 'Informe um valor maior que zero.' });
  if (!DATA_REGEX.test(data || '')) return res.status(400).json({ erro: 'Informe a data.' });

  try {
    const { rows: caixa } = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN m.tipo = 'deposito' THEN m.valor ELSE -m.valor END), 0)::float AS saldo
         FROM caixinhas c
         LEFT JOIN caixinha_movimentos m ON m.caixinha_id = c.id
        WHERE c.id = $1 AND c.usuario_id = $2
        GROUP BY c.id`,
      [id, req.usuario.id]
    );
    if (!caixa.length) return res.status(404).json({ erro: 'Caixinha não encontrada.' });
    if (tipo === 'retirada' && valor > caixa[0].saldo + 0.001) {
      return res.status(400).json({ erro: 'O valor do resgate é maior que o saldo da caixinha.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO caixinha_movimentos (caixinha_id, usuario_id, tipo, valor, data, descricao)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tipo, valor, data, descricao`,
      [id, req.usuario.id, tipo, valor, data, descricao]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar o movimento.' });
  }
});

router.delete('/movimentos/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  try {
    const { rowCount } = await pool.query('DELETE FROM caixinha_movimentos WHERE id = $1 AND usuario_id = $2', [
      id,
      req.usuario.id,
    ]);
    if (!rowCount) return res.status(404).json({ erro: 'Movimento não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir o movimento.' });
  }
});

module.exports = router;
