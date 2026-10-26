// Aba Investimentos (usa api, $, moeda, escapar, dataBR, opcao, inputMes... de economia.js)
const Investimentos = (() => {
  // [nome, ícone, cor do cartão]
  const TIPOS = {
    cdb: ['CDB', '🏦', 'azul'],
    tesouro: ['Tesouro Direto', '🏛️', 'azul'],
    lci_lca: ['LCI / LCA', '🏡', 'azul'],
    poupanca: ['Poupança', '🐷', 'azul'],
    acoes: ['Ações', '📈', 'lilas'],
    fiis: ['Fundos imobiliários', '🏢', 'lilas'],
    etf: ['ETFs', '🌎', 'lilas'],
    cripto: ['Cripto', '🪙', 'rosa'],
    previdencia: ['Previdência', '🛡️', 'verde'],
    outro: ['Outro', '✨', 'verde'],
  };
  const MOVIMENTOS = {
    aporte: { titulo: 'Aportar em', botao: 'Aportar', rotulo: 'Valor do aporte', tag: 'Aporte', classe: '' },
    resgate: { titulo: 'Resgatar de', botao: 'Resgatar', rotulo: 'Valor do resgate', tag: 'Resgate', classe: 'rosa' },
    saldo: { titulo: 'Atualizar valor de', botao: 'Atualizar', rotulo: 'Quanto vale hoje', tag: 'Valor atualizado', classe: 'lilas' },
  };

  const nomeMes = (mes) => {
    const [ano, m] = mes.split('-').map(Number);
    return new Date(ano, m - 1, 1).toLocaleString('pt-BR', { month: 'long' });
  };
  const pct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`;
  const comSinal = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${moeda(Math.abs(v))}`;

  let investimentos = [];
  let atual = null; // investimento aberto em um diálogo

  // ---------- Renderização ----------

  function renderizarResumo() {
    const total = investimentos.reduce((s, i) => s + i.valor_atual, 0);
    const aplicado = investimentos.reduce((s, i) => s + i.investido, 0);
    const rendimento = total - aplicado;
    const doMes = investimentos.reduce((s, i) => s + i.aporte_mes, 0);

    $('inv-total').textContent = moeda(total);
    $('inv-aplicado').textContent = moeda(aplicado);

    const elRend = $('inv-rendimento');
    elRend.textContent = comSinal(rendimento);
    elRend.className = rendimento >= 0 ? 'positivo' : 'negativo';
    $('inv-rendimento-pct').textContent = aplicado > 0 ? `${pct((rendimento / aplicado) * 100)} sobre o aplicado` : '';

    $('inv-mes-rotulo').textContent = `Aportado em ${nomeMes(inputMes.value)}`;
    $('inv-mes').textContent = comSinal(doMes);
  }

  function cartao(i) {
    const [nomeTipo, icone, cor = 'verde'] = seletorTipos.info(i.tipo);
    const rendPct = i.investido > 0 ? ` (${pct((i.rendimento / i.investido) * 100)})` : '';
    const classeRend = i.rendimento >= 0 ? 'positivo' : 'negativo';
    const atualizado = i.data_ultimo_saldo
      ? `Valor atualizado em ${dataBR(i.data_ultimo_saldo)}`
      : 'Valor ainda não atualizado — use “Atualizar valor”';
    const mes = nomeMes(inputMes.value);
    const doMes =
      i.aporte_mes === 0
        ? `<p class="cx-mes">Nenhum aporte em ${mes}</p>`
        : `<p class="cx-mes ${i.aporte_mes > 0 ? 'positivo' : 'negativo'}">Em ${mes}: ${comSinal(i.aporte_mes)}</p>`;

    return `<article class="caixinha investimento cor-${cor}" data-id="${i.id}">
      <div class="cx-topo">
        <span class="cx-icone">${escapar(icone)}</span>
        <div class="cx-titulo">
          <h4>${escapar(i.nome)}</h4>
          <small>${escapar(nomeTipo)}${i.instituicao ? ` · ${escapar(i.instituicao)}` : ''}</small>
        </div>
        <button class="cx-editar" data-acao="editar" title="Editar investimento" aria-label="Editar investimento">✎</button>
      </div>
      <p class="cx-saldo">${moeda(i.valor_atual)}</p>
      <div class="inv-numeros">
        <div><span>Aplicado</span><strong>${moeda(i.investido)}</strong></div>
        <div><span>Rendimento</span><strong class="${classeRend}">${comSinal(i.rendimento)}${rendPct}</strong></div>
      </div>
      <p class="inv-atualizado">${atualizado}</p>
      ${doMes}
      <div class="cx-acoes">
        <button data-acao="aporte">Aportar</button>
        <button data-acao="resgate" class="secundario">Resgatar</button>
        <button data-acao="saldo" class="secundario">Atualizar valor</button>
      </div>
      <button data-acao="historico" class="link inv-historico">Ver histórico</button>
    </article>`;
  }

  function renderizarDistribuicao() {
    const porTipo = {};
    for (const i of investimentos) {
      if (i.valor_atual <= 0) continue;
      const nome = seletorTipos.info(i.tipo)[0];
      porTipo[nome] = (porTipo[nome] || 0) + i.valor_atual;
    }
    const itens = Object.entries(porTipo)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);

    $('inv-distribuicao').hidden = itens.length === 0;
    if (itens.length) Graficos.desenharDistribuicao($('grafico-distribuicao'), $('area-distribuicao'), itens);
  }

  function renderizar() {
    renderizarResumo();
    $('lista-investimentos').innerHTML =
      investimentos.map(cartao).join('') +
      `<button class="caixinha nova" data-acao="novo">
         <span class="mais">+</span>
         <strong>Novo investimento</strong>
         <small>CDB, Tesouro, ações, FIIs, cripto…</small>
       </button>`;
    renderizarDistribuicao();
  }

  const seletorTipos = criarSeletorTipos({
    contexto: 'investimento',
    container: $('inv-tipos'),
    padrao: TIPOS,
    elErro: $('erro-investimento'),
  });
  let tiposCarregados = false;

  async function carregar() {
    if (!tiposCarregados) {
      await seletorTipos.carregar('cdb');
      tiposCarregados = true;
    }
    investimentos = await api(`/api/investimentos?mes=${inputMes.value}`);
    renderizar();
  }

  // ---------- Criar / editar ----------

  function abrirInvestimento(i) {
    atual = i || null;
    const form = $('form-investimento');
    form.reset();
    $('dlg-investimento-titulo').textContent = i ? 'Editar investimento' : 'Novo investimento';
    $('btn-excluir-investimento').hidden = !i;
    $('inv-inicial').hidden = !!i;
    form.data_inicial.value = dataPadrao();
    seletorTipos.esconderForm();
    seletorTipos.renderizar(i ? i.tipo : 'cdb');
    if (i) {
      form.nome.value = i.nome;
      form.instituicao.value = i.instituicao ?? '';
    }
    $('erro-investimento').textContent = '';
    $('dlg-investimento').showModal();
    form.nome.focus();
  }

  $('form-investimento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { valor_inicial, data_inicial, ...dados } = Object.fromEntries(new FormData(e.target));
    try {
      if (atual) {
        await api(`/api/investimentos/${atual.id}`, { method: 'PUT', body: JSON.stringify(dados) });
      } else {
        const novo = await api('/api/investimentos', { method: 'POST', body: JSON.stringify(dados) });
        if (Number(valor_inicial) > 0) {
          await api(`/api/investimentos/${novo.id}/movimentos`, {
            method: 'POST',
            body: JSON.stringify({ tipo: 'aporte', valor: valor_inicial, data: data_inicial, descricao: 'Valor inicial' }),
          });
        }
      }
      $('dlg-investimento').close();
      await carregar();
    } catch (err) {
      $('erro-investimento').textContent = err.message;
    }
  });

  $('btn-excluir-investimento').addEventListener('click', async () => {
    if (!confirm(`Excluir o investimento "${atual.nome}"? Todo o histórico dele será apagado.`)) return;
    try {
      await api(`/api/investimentos/${atual.id}`, { method: 'DELETE' });
      $('dlg-investimento').close();
      await carregar();
    } catch (err) {
      $('erro-investimento').textContent = err.message;
    }
  });

  // ---------- Aporte / resgate / atualizar valor ----------

  function abrirMovimento(i, tipo) {
    atual = i;
    const m = MOVIMENTOS[tipo];
    const form = $('form-inv-movimento');
    form.reset();
    form.tipo.value = tipo;
    form.data.value = dataPadrao();
    $('dlg-inv-movimento-titulo').textContent = `${m.titulo} ${i.nome}`;
    $('dlg-inv-movimento-sub').textContent = `Valor atual: ${moeda(i.valor_atual)} · Aplicado: ${moeda(i.investido)}`;
    $('inv-mov-valor-rotulo').textContent = m.rotulo;
    $('inv-mov-dica').hidden = tipo !== 'saldo';
    $('btn-confirmar-inv-movimento').textContent = m.botao;
    $('btn-confirmar-inv-movimento').className = m.classe === 'rosa' ? 'rosa' : '';
    if (tipo === 'saldo') form.valor.value = i.valor_atual.toFixed(2);
    $('erro-inv-movimento').textContent = '';
    $('dlg-inv-movimento').showModal();
    form.valor.focus();
    form.valor.select();
  }

  $('form-inv-movimento').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/api/investimentos/${atual.id}/movimentos`, {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
      });
      $('dlg-inv-movimento').close();
      await carregar();
    } catch (err) {
      $('erro-inv-movimento').textContent = err.message;
    }
  });

  // ---------- Histórico ----------

  async function abrirHistorico(i) {
    atual = i;
    $('dlg-inv-historico-titulo').textContent = `${seletorTipos.info(i.tipo)[1]} ${i.nome} — histórico`;
    const movimentos = await api(`/api/investimentos/${i.id}/movimentos`);
    $('lista-inv-movimentos').innerHTML = movimentos.length
      ? movimentos
          .map((m) => {
            const info = MOVIMENTOS[m.tipo];
            const valor =
              m.tipo === 'saldo'
                ? `<td class="valor">${moeda(m.valor)}</td>`
                : `<td class="valor ${m.tipo === 'aporte' ? 'positivo' : 'negativo'}">${m.tipo === 'aporte' ? '+' : '−'}${moeda(m.valor)}</td>`;
            return `<tr>
              <td>${dataBR(m.data)}</td>
              <td><span class="tag ${info.classe}">${info.tag}</span></td>
              <td>${escapar(m.descricao)}</td>
              ${valor}
              <td><button class="excluir" data-inv-mov="${m.id}" title="Excluir">✕</button></td>
            </tr>`;
          })
          .join('')
      : '<tr><td colspan="5" class="vazio">Nenhum movimento ainda.</td></tr>';
    if (!$('dlg-inv-historico').open) $('dlg-inv-historico').showModal();
  }

  $('lista-inv-movimentos').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-inv-mov]');
    if (!btn) return;
    e.stopPropagation(); // evita o handler global de exclusão de lançamentos
    if (!confirm('Excluir este movimento?')) return;
    try {
      await api(`/api/investimentos/movimentos/${btn.dataset.invMov}`, { method: 'DELETE' });
      await carregar();
      await abrirHistorico(investimentos.find((x) => x.id === atual.id));
    } catch (err) {
      alert(err.message);
    }
  });

  // Ações dos cartões
  $('lista-investimentos').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const acao = btn.dataset.acao;
    if (acao === 'novo') return abrirInvestimento();

    const i = investimentos.find((x) => x.id === Number(btn.closest('.caixinha').dataset.id));
    if (acao === 'editar') abrirInvestimento(i);
    else if (acao === 'historico') abrirHistorico(i);
    else abrirMovimento(i, acao);
  });

  return { carregar };
})();
