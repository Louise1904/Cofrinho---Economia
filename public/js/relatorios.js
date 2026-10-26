// Aba Relatórios com filtros de período, tipos de recebimento e categorias de gasto.
// Usa api, $, moeda, escapar, inputMes, nomeMesCompleto, TIPOS_RECEITA, NOMES_TIPO,
// nomeCategoria e iconeCategoria de economia.js.
const Relatorios = (() => {
  const { nomeMes } = Graficos;

  const estado = {
    periodo: '6', // 'mes' | '3' | '6' | '12' | 'ano' | 'personalizado'
    tipos: new Set(), // vazio = todos
    categorias: new Set(), // vazio = todas
  };
  let dados = null; // resposta da API para o intervalo atual
  let chaveDados = '';

  // ---------- Período ----------

  function somarMeses(mes, delta) {
    const [ano, m] = mes.split('-').map(Number);
    const d = new Date(ano, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function listaMeses(de, ate) {
    const meses = [];
    for (let m = de; m <= ate; m = somarMeses(m, 1)) meses.push(m);
    return meses;
  }

  function intervalo() {
    const fim = inputMes.value;
    switch (estado.periodo) {
      case 'mes':
        return [fim, fim];
      case 'ano':
        return [`${fim.slice(0, 4)}-01`, `${fim.slice(0, 4)}-12`];
      case 'personalizado': {
        let de = $('rel-de').value || somarMeses(fim, -5);
        let ate = $('rel-ate').value || fim;
        if (de > ate) [de, ate] = [ate, de];
        $('rel-de').value = de;
        $('rel-ate').value = ate;
        return [de, ate];
      }
      default:
        return [somarMeses(fim, -(Number(estado.periodo) - 1)), fim];
    }
  }

  function descreverPeriodo(de, ate) {
    if (de === ate) return nomeMesCompleto(de);
    const n = listaMeses(de, ate).length;
    return `${nomeMes(de)} a ${nomeMes(ate)} · ${n} meses`;
  }

  // ---------- Chips ----------

  function chips(container, opcoes, selecionados, rotuloTodos) {
    container.innerHTML =
      `<button type="button" data-valor="" class="${selecionados.size === 0 ? 'ativo' : ''}">${rotuloTodos}</button>` +
      opcoes
        .map(
          ([valor, rotulo]) =>
            `<button type="button" data-valor="${escapar(valor)}" class="${selecionados.has(valor) ? 'ativo' : ''}">${rotulo}</button>`
        )
        .join('');
  }

  function alternar(conjunto, valor) {
    if (valor === '') conjunto.clear();
    else if (conjunto.has(valor)) conjunto.delete(valor);
    else conjunto.add(valor);
  }

  // ---------- Renderização ----------

  function renderizar() {
    const [de, ate] = [dados.de, dados.ate];
    const meses = listaMeses(de, ate);

    // Chips: todos os tipos de recebimento; só as categorias que aparecem no período (ou já selecionadas)
    chips(
      $('rel-tipos'),
      Object.keys(TIPOS_RECEITA).map((t) => [t, `${TIPOS_RECEITA[t][1]} ${NOMES_TIPO[t]}`]),
      estado.tipos,
      'Todos'
    );
    const categoriasNoPeriodo = new Set([...dados.gastos.map((g) => g.categoria), ...estado.categorias]);
    chips(
      $('rel-categorias'),
      [...categoriasNoPeriodo]
        .sort((a, b) => nomeCategoria(a).localeCompare(nomeCategoria(b), 'pt-BR'))
        .map((c) => [c, `${iconeCategoria(c)} ${escapar(nomeCategoria(c))}`]),
      estado.categorias,
      'Todas'
    );

    // Aplica os filtros
    const receitas = dados.receitas.filter((r) => estado.tipos.size === 0 || estado.tipos.has(r.tipo));
    const gastos = dados.gastos.filter((g) => estado.categorias.size === 0 || estado.categorias.has(g.categoria));

    // Totais por mês (gráfico e tabela)
    const historico = meses.map((mes) => {
      const rec = receitas.filter((r) => r.mes === mes).reduce((s, r) => s + r.total, 0);
      const gas = gastos.filter((g) => g.mes === mes).reduce((s, g) => s + g.total, 0);
      return { mes, receitas: rec, gastos: gas, economia: rec - gas };
    });

    const totalRec = historico.reduce((s, h) => s + h.receitas, 0);
    const totalGas = historico.reduce((s, h) => s + h.gastos, 0);
    const economia = totalRec - totalGas;
    const maiorMes = historico.reduce((m, h) => (h.gastos > (m?.gastos ?? 0) ? h : m), null);

    // Resumo
    $('rel-recebido').textContent = moeda(totalRec);
    $('rel-gastos').textContent = moeda(totalGas);
    const elEco = $('rel-economia');
    elEco.textContent = moeda(economia);
    elEco.className = economia >= 0 ? 'positivo' : 'negativo';
    $('rel-economia-pct').textContent = totalRec > 0 ? `${((economia / totalRec) * 100).toFixed(1)}% do recebido` : '';
    $('rel-media').textContent = moeda(totalGas / meses.length);
    $('rel-maior-mes').textContent =
      meses.length > 1 && maiorMes ? `maior gasto: ${nomeMes(maiorMes.mes)} (${moeda(maiorMes.gastos)})` : '';

    // Descrição do que está sendo mostrado
    const partes = [descreverPeriodo(de, ate)];
    if (estado.tipos.size) partes.push(`${estado.tipos.size} tipo(s) de recebimento`);
    if (estado.categorias.size) partes.push(`${estado.categorias.size} categoria(s) de gasto`);
    $('rel-descricao').textContent = `Mostrando: ${partes.join(' · ')}`;
    $('rel-limpar').hidden = estado.periodo === '6' && !estado.tipos.size && !estado.categorias.size;

    // Gráfico de evolução + tabela
    $('sub-evolucao').textContent = descreverPeriodo(de, ate);
    Graficos.desenharEvolucao($('grafico-evolucao'), historico);
    $('tabela-evolucao').querySelector('tbody').innerHTML =
      historico
        .map(
          (h) => `<tr>
            <td>${nomeMes(h.mes)}</td>
            <td class="valor">${moeda(h.receitas)}</td>
            <td class="valor">${moeda(h.gastos)}</td>
            <td class="valor ${h.economia >= 0 ? 'positivo' : 'negativo'}">${moeda(h.economia)}</td>
          </tr>`
        )
        .join('') +
      `<tr class="total">
        <td>Total</td>
        <td class="valor">${moeda(totalRec)}</td>
        <td class="valor">${moeda(totalGas)}</td>
        <td class="valor ${economia >= 0 ? 'positivo' : 'negativo'}">${moeda(economia)}</td>
      </tr>`;

    // Gastos por categoria no período
    const porCategoria = {};
    for (const g of gastos) {
      const nome = nomeCategoria(g.categoria);
      porCategoria[nome] = (porCategoria[nome] || 0) + g.total;
    }
    const itens = Object.entries(porCategoria)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
    $('sub-categorias').textContent = descreverPeriodo(de, ate);
    $('categorias-vazio').hidden = itens.length > 0;
    $('grafico-categorias').style.visibility = itens.length ? 'visible' : 'hidden';
    Graficos.desenharCategorias($('grafico-categorias'), $('area-categorias'), itens);
  }

  async function carregar() {
    const [de, ate] = intervalo();
    const chave = `${de}|${ate}`;
    if (chave !== chaveDados || !dados) {
      dados = await api(`/api/economia/relatorio?de=${de}&ate=${ate}`);
      chaveDados = chave;
    }
    renderizar();
  }

  // Força buscar de novo (ex.: depois de um lançamento novo ou troca de mês)
  function recarregar() {
    chaveDados = '';
    return carregar();
  }

  // ---------- Eventos ----------

  $('rel-periodo').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-periodo]');
    if (!btn) return;
    estado.periodo = btn.dataset.periodo;
    document.querySelectorAll('#rel-periodo button').forEach((b) => b.classList.toggle('ativo', b === btn));
    $('rel-personalizado').hidden = estado.periodo !== 'personalizado';
    carregar();
  });

  for (const id of ['rel-de', 'rel-ate']) $(id).addEventListener('change', carregar);

  $('rel-tipos').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-valor]');
    if (!btn) return;
    alternar(estado.tipos, btn.dataset.valor);
    renderizar();
  });

  $('rel-categorias').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-valor]');
    if (!btn) return;
    alternar(estado.categorias, btn.dataset.valor);
    renderizar();
  });

  $('rel-limpar').addEventListener('click', () => {
    estado.tipos.clear();
    estado.categorias.clear();
    estado.periodo = '6';
    document.querySelectorAll('#rel-periodo button').forEach((b) => b.classList.toggle('ativo', b.dataset.periodo === '6'));
    $('rel-personalizado').hidden = true;
    carregar();
  });

  $('btn-tabela-evolucao').addEventListener('click', (e) => {
    const tabela = $('tabela-evolucao');
    tabela.hidden = !tabela.hidden;
    e.target.textContent = tabela.hidden ? 'Ver como tabela' : 'Esconder tabela';
  });

  return { carregar: recarregar };
})();
