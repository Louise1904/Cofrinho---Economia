const express = require('express');
const pool = require('../db');
const exigirLogin = require('../middleware/auth');

const router = express.Router();
router.use(exigirLogin);

const TIPOS_RECEITA = ['salario', 'bonificacao', 'plantao', 'outro'];
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MES_REGEX = /^\d{4}-\d{2}$/;

// Primeiro e último dia do mês 'AAAA-MM'
function intervaloDoMes(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const inicio = `${mes}-01`;
  const ultimoDia = new Date(ano, m, 0).getDate();
  const fim = `${mes}-${String(ultimoDia).padStart(2, '0')}`;
  return [inicio, fim];
}

function validarValor(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// Resumo + lançamentos de um mês
router.get('/resumo', async (req, res) => {
  const mes = req.query.mes;
  if (!MES_REGEX.test(mes || '')) return res.status(400).json({ erro: 'Mês inválido (use AAAA-MM).' });

  const [inicio, fim] = intervaloDoMes(mes);
  const uid = req.usuario.id;

  try {
    const [receitas, gastos] = await Promise.all([
      pool.query(
        `SELECT id, tipo, descricao, valor, data_recebimento
           FROM receitas
          WHERE usuario_id = $1 AND data_recebimento BETWEEN $2 AND $3
          ORDER BY data_recebimento, id`,
        [uid, inicio, fim]
      ),
      pool.query(
        `SELECT id, descricao, categoria, valor, data_gasto
           FROM gastos
          WHERE usuario_id = $1 AND data_gasto BETWEEN $2 AND $3
          ORDER BY data_gasto, id`,
        [uid, inicio, fim]
      ),
    ]);

    const porTipo = Object.fromEntries(TIPOS_RECEITA.map((t) => [t, 0]));
    for (const r of receitas.rows) porTipo[r.tipo] += r.valor;

    const totalReceitas = receitas.rows.reduce((s, r) => s + r.valor, 0);
    const totalGastos = gastos.rows.reduce((s, g) => s + g.valor, 0);

    res.json({
      mes,
      totais: {
        receitas: totalReceitas,
        gastos: totalGastos,
        economia: totalReceitas - totalGastos,
        porTipo,
      },
      receitas: receitas.rows,
      gastos: gastos.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar o resumo.' });
  }
});

router.post('/receitas', async (req, res) => {
  const { tipo, descricao, data_recebimento } = req.body;
  const valor = validarValor(req.body.valor);

  if (!TIPOS_RECEITA.includes(tipo)) return res.status(400).json({ erro: 'Tipo de receita inválido.' });
  if (!valor) return res.status(400).json({ erro: 'Informe um valor maior que zero.' });
  if (!DATA_REGEX.test(data_recebimento || '')) return res.status(400).json({ erro: 'Informe a data de recebimento.' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO receitas (usuario_id, tipo, descricao, valor, data_recebimento)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tipo, descricao, valor, data_recebimento`,
      [req.usuario.id, tipo, (descricao || '').trim() || null, valor, data_recebimento]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar a receita.' });
  }
});

// Exclui um lançamento do usuário logado (receitas ou gastos)
function rotaExcluir(tabela, nome) {
  return async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });
    try {
      const { rowCount } = await pool.query(`DELETE FROM ${tabela} WHERE id = $1 AND usuario_id = $2`, [
        id,
        req.usuario.id,
      ]);
      if (!rowCount) return res.status(404).json({ erro: `${nome} não encontrado(a).` });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: `Erro ao excluir ${nome.toLowerCase()}.` });
    }
  };
}

router.delete('/receitas/:id', rotaExcluir('receitas', 'Receita'));

router.post('/gastos', async (req, res) => {
  const descricao = (req.body.descricao || '').trim();
  const categoria = (req.body.categoria || 'outros').trim();
  const { data_gasto } = req.body;
  const valor = validarValor(req.body.valor);

  if (!descricao) return res.status(400).json({ erro: 'Informe a descrição do gasto.' });
  if (!categoria || categoria.length > 40) return res.status(400).json({ erro: 'Categoria inválida.' });
  if (!valor) return res.status(400).json({ erro: 'Informe um valor maior que zero.' });
  if (!DATA_REGEX.test(data_gasto || '')) return res.status(400).json({ erro: 'Informe a data do gasto.' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO gastos (usuario_id, descricao, categoria, valor, data_gasto)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, descricao, categoria, valor, data_gasto`,
      [req.usuario.id, descricao, categoria, valor, data_gasto]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar o gasto.' });
  }
});

router.delete('/gastos/:id', rotaExcluir('gastos', 'Gasto'));

// Dados do relatório: totais por mês, separados por tipo de recebimento e por categoria de gasto.
// Os filtros (tipos, categorias) são aplicados no navegador.
router.get('/relatorio', async (req, res) => {
  const { de, ate } = req.query;
  if (!MES_REGEX.test(de || '') || !MES_REGEX.test(ate || '')) {
    return res.status(400).json({ erro: 'Período inválido (use AAAA-MM).' });
  }
  if (de > ate) return res.status(400).json({ erro: 'O início do período deve ser antes do fim.' });
  const [anoDe, mesDe] = de.split('-').map(Number);
  const [anoAte, mesAte] = ate.split('-').map(Number);
  if ((anoAte - anoDe) * 12 + (mesAte - mesDe) >= 60) {
    return res.status(400).json({ erro: 'Escolha um período de no máximo 60 meses.' });
  }

  const params = [req.usuario.id, `${de}-01`, `${ate}-01`];
  try {
    const [receitas, gastos] = await Promise.all([
      pool.query(
        `SELECT TO_CHAR(data_recebimento, 'YYYY-MM') AS mes, tipo, SUM(valor)::float AS total
           FROM receitas
          WHERE usuario_id = $1 AND data_recebimento >= $2::date AND data_recebimento < $3::date + interval '1 month'
          GROUP BY 1, 2`,
        params
      ),
      pool.query(
        `SELECT TO_CHAR(data_gasto, 'YYYY-MM') AS mes, categoria, SUM(valor)::float AS total
           FROM gastos
          WHERE usuario_id = $1 AND data_gasto >= $2::date AND data_gasto < $3::date + interval '1 month'
          GROUP BY 1, 2`,
        params
      ),
    ]);
    res.json({ de, ate, receitas: receitas.rows, gastos: gastos.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar o relatório.' });
  }
});

// ---------- Categorias de gasto personalizadas ----------

router.get('/categorias', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nome FROM categorias_gasto WHERE usuario_id = $1 ORDER BY LOWER(nome)',
      [req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar as categorias.' });
  }
});

router.post('/categorias', async (req, res) => {
  const nome = (req.body.nome || '').trim();
  if (!nome || nome.length > 40) return res.status(400).json({ erro: 'Informe um nome de até 40 caracteres.' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO categorias_gasto (usuario_id, nome) VALUES ($1, $2) RETURNING id, nome',
      [req.usuario.id, nome]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Você já tem uma categoria com esse nome.' });
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar a categoria.' });
  }
});

// Os gastos já lançados mantêm o nome da categoria mesmo após excluí-la
router.delete('/categorias/:id', rotaExcluir('categorias_gasto', 'Categoria'));

module.exports = router;
