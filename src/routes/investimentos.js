const express = require('express');
const pool = require('../db');
const exigirLogin = require('../middleware/auth');
const { tipoPersonalizadoExiste } = require('./tipos');

const router = express.Router();
router.use(exigirLogin);

const TIPOS = ['cdb', 'tesouro', 'lci_lca', 'poupanca', 'acoes', 'fiis', 'etf', 'cripto', 'previdencia', 'outro'];
const TIPOS_MOVIMENTO = ['aporte', 'resgate', 'saldo'];
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MES_REGEX = /^\d{4}-\d{2}$/;

function lerValor(valor, permitirZero = false) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || (!permitirZero && n === 0)) return null;
  return Math.round(n * 100) / 100;
}

function lerInvestimento(body) {
  const nome = (body.nome || '').trim();
  const tipo = body.tipo;
  const instituicao = (body.instituicao || '').trim() || null;

  if (!nome || nome.length > 80) return { erro: 'Informe um nome de até 80 caracteres.' };
  if (!tipo || tipo.length > 40) return { erro: 'Escolha o tipo do investimento.' };
  if (instituicao && instituicao.length > 60) return { erro: 'Instituição com no máximo 60 caracteres.' };
  return { dados: [nome, tipo, instituicao] };
}

async function tipoValido(usuarioId, tipo) {
  return TIPOS.includes(tipo) || tipoPersonalizadoExiste(usuarioId, 'investimento', tipo);
}

/*
 * Valor atual = última atualização de saldo + aportes − resgates feitos depois dela.
 * Sem atualização de saldo, o valor atual é simplesmente aportes − resgates.
 */
const SQL_RESUMO = `
  SELECT i.id, i.nome, i.tipo, i.instituicao,
         COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'aporte'), 0)::float  AS aportes,
         COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'resgate'), 0)::float AS resgates,
         ult.valor::float AS ultimo_saldo,
         ult.data         AS data_ultimo_saldo,
         COALESCE(SUM(CASE WHEN m.tipo = 'aporte' THEN m.valor WHEN m.tipo = 'resgate' THEN -m.valor END)
                    FILTER (WHERE ult.id IS NULL OR (m.data, m.id) > (ult.data, ult.id)), 0)::float AS movimento_pos_saldo,
         COALESCE(SUM(CASE WHEN m.tipo = 'aporte' THEN m.valor WHEN m.tipo = 'resgate' THEN -m.valor END)
                    FILTER (WHERE TO_CHAR(m.data, 'YYYY-MM') = $2), 0)::float AS aporte_mes
    FROM investimentos i
    LEFT JOIN LATERAL (
           SELECT id, valor, data FROM investimento_movimentos
            WHERE investimento_id = i.id AND tipo = 'saldo'
            ORDER BY data DESC, id DESC
            LIMIT 1
         ) ult ON TRUE
    LEFT JOIN investimento_movimentos m ON m.investimento_id = i.id
   WHERE i.usuario_id = $1 AND ($3::int IS NULL OR i.id = $3)
   GROUP BY i.id, ult.id, ult.valor, ult.data
   ORDER BY i.criado_em, i.id`;

function calcular(r) {
  const valorAtual = Math.round(((r.ultimo_saldo ?? 0) + r.movimento_pos_saldo) * 100) / 100;
  const investido = Math.round((r.aportes - r.resgates) * 100) / 100;
  const rendimento = Math.round((valorAtual - investido) * 100) / 100;
  const { movimento_pos_saldo, ...resto } = r;
  return { ...resto, valor_atual: valorAtual, investido, rendimento };
}

async function buscar(usuarioId, mes, id = null) {
  const { rows } = await pool.query(SQL_RESUMO, [usuarioId, mes, id]);
  return rows.map(calcular);
}

router.get('/', async (req, res) => {
  const mes = req.query.mes;
  if (!MES_REGEX.test(mes || '')) return res.status(400).json({ erro: 'Mês inválido (use AAAA-MM).' });
  try {
    res.json(await buscar(req.usuario.id, mes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar os investimentos.' });
  }
});

router.post('/', async (req, res) => {
  const { erro, dados } = lerInvestimento(req.body);
  if (erro) return res.status(400).json({ erro });
  try {
    if (!(await tipoValido(req.usuario.id, dados[1]))) return res.status(400).json({ erro: 'Tipo de investimento inválido.' });
    const { rows } = await pool.query(
      `INSERT INTO investimentos (usuario_id, nome, tipo, instituicao)
       VALUES ($1, $2, $3, $4) RETURNING id, nome, tipo, instituicao`,
      [req.usuario.id, ...dados]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar o investimento.' });
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  const { erro, dados } = lerInvestimento(req.body);
  if (erro) return res.status(400).json({ erro });
  try {
    if (!(await tipoValido(req.usuario.id, dados[1]))) return res.status(400).json({ erro: 'Tipo de investimento inválido.' });
    const { rows } = await pool.query(
      `UPDATE investimentos SET nome = $3, tipo = $4, instituicao = $5
        WHERE id = $1 AND usuario_id = $2
        RETURNING id, nome, tipo, instituicao`,
      [id, req.usuario.id, ...dados]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Investimento não encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar o investimento.' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  try {
    const { rowCount } = await pool.query('DELETE FROM investimentos WHERE id = $1 AND usuario_id = $2', [
      id,
      req.usuario.id,
    ]);
    if (!rowCount) return res.status(404).json({ erro: 'Investimento não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir o investimento.' });
  }
});

// ---------- Movimentos: aporte, resgate e atualização de saldo ----------

router.get('/:id/movimentos', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  try {
    const { rows } = await pool.query(
      `SELECT id, tipo, valor::float AS valor, data, descricao
         FROM investimento_movimentos
        WHERE investimento_id = $1 AND usuario_id = $2
        ORDER BY data DESC, id DESC`,
      [id, req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar o histórico.' });
  }
});

router.post('/:id/movimentos', async (req, res) => {
  const id = Number(req.params.id);
  const { tipo, data } = req.body;
  const valor = lerValor(req.body.valor, tipo === 'saldo');
  const descricao = (req.body.descricao || '').trim() || null;

  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
  if (!TIPOS_MOVIMENTO.includes(tipo)) return res.status(400).json({ erro: 'Tipo de movimento inválido.' });
  if (valor === null) return res.status(400).json({ erro: 'Informe um valor válido.' });
  if (!DATA_REGEX.test(data || '')) return res.status(400).json({ erro: 'Informe a data.' });

  try {
    const [inv] = await buscar(req.usuario.id, data.slice(0, 7), id);
    if (!inv) return res.status(404).json({ erro: 'Investimento não encontrado.' });
    if (tipo === 'resgate' && valor > inv.valor_atual + 0.001) {
      return res.status(400).json({ erro: 'O resgate é maior que o valor atual do investimento.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO investimento_movimentos (investimento_id, usuario_id, tipo, valor, data, descricao)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tipo, valor::float AS valor, data, descricao`,
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
    const { rowCount } = await pool.query(
      'DELETE FROM investimento_movimentos WHERE id = $1 AND usuario_id = $2',
      [id, req.usuario.id]
    );
    if (!rowCount) return res.status(404).json({ erro: 'Movimento não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir o movimento.' });
  }
});

module.exports = router;
