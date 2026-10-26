// Aba Metas: caixinhas para guardar dinheiro (usa api, $, moeda, escapar, inputMes... de economia.js)
const Metas = (() => {
  // [nome, ícone]
  const TIPOS_META = {
    reserva: ['Reserva', '💰'],
    viagem: ['Viagem', '✈️'],
    ferias: ['Férias', '🏖️'],
    casa: ['Casa', '🏠'],
    carro: ['Carro', '🚗'],
    estudos: ['Estudos', '🎓'],
    casamento: ['Casamento', '💍'],
    presentes: ['Presentes', '🎁'],
    eletronicos: ['Eletrônicos', '💻'],
    pet: ['Pet', '🐶'],
    emergencia: ['Emergência', '🛡️'],
    saude: ['Saúde', '❤️'],
    filhos: ['Filhos', '👶'],
    festa: ['Festa', '🎉'],
  };
  const NOMES_MES = (mes) => {
    const [ano, m] = mes.split('-').map(Number);
    return new Date(ano, m - 1, 1).toLocaleString('pt-BR', { month: 'long' });
  };
  const mesCurto = (iso) => {
    const [ano, m] = iso.split('-').map(Number);
    return `${new Date(ano, m - 1, 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}/${ano}`;
  };

  let caixinhas = [];
  let caixinhaAtual = null; // caixinha aberta no diálogo (editar, guardar, resgatar, histórico)

  // ---------- Cálculos ----------

  // Meses entre o mês atual e o mês da data alvo (mínimo 1)
  function mesesAte(dataAlvo) {
    const hoje = new Date();
    const [ano, m] = dataAlvo.split('-').map(Number);
    return (ano - hoje.getFullYear()) * 12 + (m - 1 - hoje.getMonth());
  }

  function detalhesMeta(c) {
    if (!c.meta) return { pct: null, linhas: [] };
    const pct = Math.min((c.saldo / c.meta) * 100, 100);
    const falta = Math.max(c.meta - c.saldo, 0);
    const linhas = [];

    if (falta === 0) return { pct, atingida: true, linhas };

    if (c.data_alvo) {
      const meses = mesesAte(c.data_alvo);
      if (meses < 0) {
        linhas.push(`A data alvo (${mesCurto(c.data_alvo)}) já passou — faltam ${moeda(falta)}.`);
      } else {
        const porMes = falta / Math.max(meses, 1);
        linhas.push(`Guarde cerca de <strong>${moeda(porMes)}/mês</strong> para chegar até ${mesCurto(c.data_alvo)}.`);
      }
    }
    return { pct, falta, linhas };
  }

  // ---------- Renderização ----------

  function renderizarResumo() {
    const total = caixinhas.reduce((s, c) => s + c.saldo, 0);
    const doMes = caixinhas.reduce((s, c) => s + c.movimento_mes, 0);
    const nomeMes = NOMES_MES(inputMes.value);

    $('metas-total').textContent = moeda(total);
    $('metas-mes-rotulo').textContent = `Guardado em ${nomeMes}`;
    $('metas-mes').textContent = (doMes > 0 ? '+' : '') + moeda(doMes);

    const elLivre = $('metas-livre');
    if (ultimoResumo) {
      const livre = ultimoResumo.totais.economia - doMes;
      elLivre.textContent = moeda(livre);
      elLivre.className = livre >= 0 ? 'positivo' : 'negativo';
    }
  }

  function cartaoCaixinha(c) {
    const { pct, falta, atingida, linhas } = detalhesMeta(c);
    const nomeMes = NOMES_MES(inputMes.value);

    const metaTexto =
      (c.tipo ? `${escapar(seletorTipos.info(c.tipo)[0])} · ` : '') +
      (c.meta ? `Meta: ${moeda(c.meta)}${c.data_alvo ? ` · até ${mesCurto(c.data_alvo)}` : ''}` : 'Sem meta definida');

    const progresso = c.meta
      ? `<div class="barra" role="progressbar" aria-valuenow="${pct.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
           <div style="width:${pct}%"></div>
         </div>
         <div class="cx-info">
           <span>${pct.toFixed(0)}% da meta</span>
           <span>${atingida ? '🎉 Meta atingida!' : `Faltam ${moeda(falta)}`}</span>
         </div>`
      : '';

    const mov = c.movimento_mes;
    const doMes =
      mov === 0
        ? `<p class="cx-mes">Nada guardado em ${nomeMes} ainda</p>`
        : `<p class="cx-mes ${mov > 0 ? 'positivo' : 'negativo'}">Em ${nomeMes}: ${mov > 0 ? '+' : '−'}${moeda(Math.abs(mov))}</p>`;

    return `<article class="caixinha cor-${c.cor}" data-id="${c.id}">
      <div class="cx-topo">
        <span class="cx-icone">${escapar(c.icone)}</span>
        <div class="cx-titulo">
          <h4>${escapar(c.nome)}</h4>
          <small>${metaTexto}</small>
        </div>
        <button class="cx-editar" data-acao="editar" title="Editar caixinha" aria-label="Editar caixinha">✎</button>
      </div>
      <p class="cx-saldo">${moeda(c.saldo)}</p>
      ${progresso}
      ${linhas.map((l) => `<p class="cx-dica">${l}</p>`).join('')}
      ${doMes}
      <div class="cx-acoes">
        <button data-acao="deposito">Guardar</button>
        <button data-acao="retirada" class="secundario">Resgatar</button>
        <button data-acao="historico" class="link">Histórico</button>
      </div>
    </article>`;
  }

  function renderizar() {
    renderizarResumo();
    $('lista-caixinhas').innerHTML =
      caixinhas.map(cartaoCaixinha).join('') +
      `<button class="caixinha nova" data-acao="nova">
         <span class="mais">+</span>
         <strong>Nova caixinha</strong>
         <small>Crie um espaço para guardar dinheiro para um objetivo</small>
       </button>`;
  }

  const seletorTipos = criarSeletorTipos({
    contexto: 'meta',
    container: $('cx-tipos'),
    padrao: TIPOS_META,
    elErro: $('erro-caixinha'),
  });
  let tiposCarregados = false;

  async function carregar() {
    if (!tiposCarregados) {
      await seletorTipos.carregar('reserva');
      tiposCarregados = true;
    }
    caixinhas = await api(`/api/metas/caixinhas?mes=${inputMes.value}`);
    renderizar();
  }

  // ---------- Diálogos ----------

  function abrir(dlg) {
    dlg.querySelectorAll('.erro').forEach((e) => (e.textContent = ''));
    dlg.showModal();
  }

  document.querySelectorAll('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-fechar]') || e.target === dlg) dlg.close();
    });
  });

  // Caixinhas antigas (sem tipo) abrem com o tipo padrão do mesmo ícone
  function tipoDaCaixinha(c) {
    if (c.tipo) return c.tipo;
    return Object.keys(TIPOS_META).find((k) => TIPOS_META[k][1] === c.icone) || 'reserva';
  }

  function abrirCaixinha(c) {
    caixinhaAtual = c || null;
    const form = $('form-caixinha');
    form.reset();
    seletorTipos.esconderForm();
    seletorTipos.renderizar(c ? tipoDaCaixinha(c) : 'reserva');
    $('dlg-caixinha-titulo').textContent = c ? 'Editar caixinha' : 'Nova caixinha';
    $('btn-excluir-caixinha').hidden = !c;
    if (c) {
      form.nome.value = c.nome;
      form.meta.value = c.meta ?? '';
      form.data_alvo.value = c.data_alvo ?? '';
      form.querySelector(`input[name="cor"][value="${c.cor}"]`).checked = true;
    }
    abrir($('dlg-caixinha'));
    form.nome.focus();
  }

  $('form-caixinha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target));
    dados.icone = seletorTipos.info(dados.tipo)[1]; // o ícone da caixinha vem do tipo escolhido
    try {
      await api(caixinhaAtual ? `/api/metas/caixinhas/${caixinhaAtual.id}` : '/api/metas/caixinhas', {
        method: caixinhaAtual ? 'PUT' : 'POST',
        body: JSON.stringify(dados),
      });
      $('dlg-caixinha').close();
      await carregar();
    } catch (err) {
      $('erro-caixinha').textContent = err.message;
    }
  });

  $('btn-excluir-caixinha').addEventListener('click', async () => {
    const c = caixinhaAtual;
    const aviso = c.saldo > 0 ? `\n\nEla tem ${moeda(c.saldo)} guardados — o histórico será apagado.` : '';
    if (!confirm(`Excluir a caixinha "${c.nome}"?${aviso}`)) return;
    try {
      await api(`/api/metas/caixinhas/${c.id}`, { method: 'DELETE' });
      $('dlg-caixinha').close();
      await carregar();
    } catch (err) {
      $('erro-caixinha').textContent = err.message;
    }
  });

  function abrirMovimento(c, tipo) {
    caixinhaAtual = c;
    const form = $('form-movimento');
    form.reset();
    form.tipo.value = tipo;
    form.data.value = dataPadrao();
    const guardar = tipo === 'deposito';
    $('dlg-movimento-titulo').textContent = `${guardar ? 'Guardar em' : 'Resgatar de'} ${c.icone} ${c.nome}`;
    $('dlg-movimento-sub').textContent = `Saldo atual: ${moeda(c.saldo)}`;
    $('btn-confirmar-movimento').textContent = guardar ? 'Guardar' : 'Resgatar';
    $('btn-confirmar-movimento').className = guardar ? '' : 'rosa';
    if (!guardar) form.valor.max = c.saldo;
    else form.valor.removeAttribute('max');
    abrir($('dlg-movimento'));
    form.valor.focus();
  }

  $('form-movimento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target));
    try {
      await api(`/api/metas/caixinhas/${caixinhaAtual.id}/movimentos`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
      $('dlg-movimento').close();
      await carregar();
    } catch (err) {
      $('erro-movimento').textContent = err.message;
    }
  });

  async function abrirHistorico(c) {
    caixinhaAtual = c;
    $('dlg-historico-titulo').textContent = `${c.icone} ${c.nome} — histórico`;
    const movimentos = await api(`/api/metas/caixinhas/${c.id}/movimentos`);
    $('lista-movimentos').innerHTML = movimentos.length
      ? movimentos
          .map(
            (m) => `<tr>
              <td>${dataBR(m.data)}</td>
              <td><span class="tag ${m.tipo === 'deposito' ? '' : 'rosa'}">${m.tipo === 'deposito' ? 'Guardado' : 'Resgatado'}</span></td>
              <td>${escapar(m.descricao)}</td>
              <td class="valor ${m.tipo === 'deposito' ? 'positivo' : 'negativo'}">${m.tipo === 'deposito' ? '+' : '−'}${moeda(m.valor)}</td>
              <td><button class="excluir" data-mov="${m.id}" title="Excluir">✕</button></td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="vazio">Nenhum movimento ainda.</td></tr>';
    if (!$('dlg-historico').open) abrir($('dlg-historico'));
  }

  $('lista-movimentos').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-mov]');
    if (!btn) return;
    e.stopPropagation(); // evita o handler global de exclusão de lançamentos
    if (!confirm('Excluir este movimento?')) return;
    try {
      await api(`/api/metas/movimentos/${btn.dataset.mov}`, { method: 'DELETE' });
      await carregar();
      await abrirHistorico(caixinhas.find((c) => c.id === caixinhaAtual.id));
    } catch (err) {
      alert(err.message);
    }
  });

  // Ações dos cartões
  $('lista-caixinhas').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const acao = btn.dataset.acao;
    if (acao === 'nova') return abrirCaixinha();

    const c = caixinhas.find((x) => x.id === Number(btn.closest('.caixinha').dataset.id));
    if (acao === 'editar') abrirCaixinha(c);
    else if (acao === 'historico') abrirHistorico(c);
    else abrirMovimento(c, acao);
  });

  return { carregar };
})();
