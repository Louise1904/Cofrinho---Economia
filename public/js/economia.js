// [nome, ícone]
const TIPOS_RECEITA = {
  salario: ['Salário', '💼'],
  bonificacao: ['Bonificação', '🎁'],
  plantao: ['Plantão', '💻'],
  outro: ['Outro', '✨'],
};
const NOMES_TIPO = Object.fromEntries(Object.entries(TIPOS_RECEITA).map(([k, [nome]]) => [k, nome]));
const CATEGORIAS_PADRAO = {
  moradia: ['Moradia', '🏠'],
  alimentacao: ['Alimentação', '🛒'],
  transporte: ['Transporte', '🚗'],
  saude: ['Saúde', '💊'],
  educacao: ['Educação', '📚'],
  lazer: ['Lazer', '🎬'],
  contas: ['Contas da casa', '💡'],
  outros: ['Outros', '📦'],
};
const ICONE_PERSONALIZADA = '🏷️';

const { moeda, nomeMes } = Graficos;
const dataBR = (iso) => iso.split('-').reverse().join('/');
const $ = (id) => document.getElementById(id);
const nomeCategoria = (c) => CATEGORIAS_PADRAO[c]?.[0] || c;
const iconeCategoria = (c) => CATEGORIAS_PADRAO[c]?.[1] || ICONE_PERSONALIZADA;

const inputMes = $('mes');
let categoriasPersonalizadas = [];

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Data padrão dos formulários: hoje, se for o mês selecionado; senão, dia 1 do mês
function dataPadrao() {
  const hoje = hojeISO();
  return hoje.startsWith(inputMes.value) ? hoje : `${inputMes.value}-01`;
}

async function api(url, opcoes = {}) {
  const resp = await fetch(url, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json' },
  });
  if (resp.status === 401) {
    window.location.href = '/';
    throw new Error('Não autenticado');
  }
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.erro || 'Algo deu errado.');
  return json;
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ---------- Opções clicáveis (tipo de recebimento e categoria) ----------

function opcao(nome, valor, rotulo, icone, extra = '') {
  return `<label class="opcao">
    <input type="radio" name="${nome}" value="${escapar(valor)}" />
    <span><i aria-hidden="true">${icone}</i>${escapar(rotulo)}${extra}</span>
  </label>`;
}

$('rec-tipos').innerHTML = Object.entries(TIPOS_RECEITA)
  .map(([valor, [rotulo, icone]]) => opcao('tipo', valor, rotulo, icone))
  .join('');
$('form-receita').querySelector('input[value="salario"]').checked = true;

function categoriaSelecionada() {
  return $('gas-categorias').querySelector('input:checked')?.value;
}

function renderizarCategorias(selecionada = categoriaSelecionada() || 'outros') {
  const padrao = Object.entries(CATEGORIAS_PADRAO).map(([valor, [rotulo, icone]]) =>
    opcao('categoria', valor, rotulo, icone)
  );
  const minhas = categoriasPersonalizadas.map((c) =>
    opcao(
      'categoria',
      c.nome,
      c.nome,
      ICONE_PERSONALIZADA,
      `<button type="button" class="opcao-excluir" data-excluir-categoria="${c.id}" title="Excluir categoria" aria-label="Excluir categoria ${escapar(c.nome)}">✕</button>`
    )
  );

  $('gas-categorias').innerHTML =
    [...padrao, ...minhas].join('') +
    `<button type="button" class="opcao-nova" id="btn-nova-categoria">+ Nova categoria</button>`;

  const radios = [...$('gas-categorias').querySelectorAll('input')];
  (radios.find((r) => r.value === selecionada) || radios.find((r) => r.value === 'outros')).checked = true;
}

async function carregarCategorias(selecionada) {
  categoriasPersonalizadas = await api('/api/economia/categorias');
  renderizarCategorias(selecionada);
}

function mostrarNovaCategoria(mostrar) {
  $('nova-categoria').hidden = !mostrar;
  if (mostrar) {
    $('nova-categoria-nome').value = '';
    $('nova-categoria-nome').focus();
  }
}

$('gas-categorias').addEventListener('click', (e) => {
  if (e.target.closest('#btn-nova-categoria')) mostrarNovaCategoria(true);
});
$('btn-cancelar-categoria').addEventListener('click', () => mostrarNovaCategoria(false));

async function salvarCategoria() {
  const elErro = $('erro-gasto');
  elErro.textContent = '';
  try {
    const nova = await api('/api/economia/categorias', {
      method: 'POST',
      body: JSON.stringify({ nome: $('nova-categoria-nome').value }),
    });
    $('nova-categoria').hidden = true;
    await carregarCategorias(nova.nome);
  } catch (err) {
    elErro.textContent = err.message;
  }
}

$('btn-salvar-categoria').addEventListener('click', salvarCategoria);
$('nova-categoria-nome').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    salvarCategoria();
  }
});

// ---------- Resumo, listas e gráficos ----------

function renderizar(dados) {
  const { totais, receitas, gastos } = dados;

  $('total-receitas').textContent = moeda(totais.receitas);
  $('total-gastos').textContent = moeda(totais.gastos);

  const elEconomia = $('total-economia');
  elEconomia.textContent = moeda(totais.economia);
  elEconomia.className = totais.economia >= 0 ? 'positivo' : 'negativo';

  $('detalhe-receitas').innerHTML = Object.entries(totais.porTipo)
    .filter(([, v]) => v > 0)
    .map(([t, v]) => `${NOMES_TIPO[t]}: ${moeda(v)}`)
    .join('<br>');

  $('percentual-economia').textContent =
    totais.receitas > 0 ? `${((totais.economia / totais.receitas) * 100).toFixed(1)}% do que você recebeu` : '';

  renderizarReceitas(receitas);
  renderizarGastos(gastos);
}

// ---------- Filtros dos lançamentos ----------

const filtros = {
  receitas: { busca: '', grupo: '', ordem: 'recentes' },
  gastos: { busca: '', grupo: '', ordem: 'recentes' },
};

const ORDENACOES = {
  recentes: (a, b) => b.data.localeCompare(a.data) || b.id - a.id,
  antigos: (a, b) => a.data.localeCompare(b.data) || a.id - b.id,
  maior: (a, b) => b.valor - a.valor,
  menor: (a, b) => a.valor - b.valor,
};

// Sem acentos e minúsculo, para a busca achar "plantao" em "Plantão"
const normalizar = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Aplica busca, grupo (tipo/categoria) e ordem; os chips mostram só os grupos que existem no mês
function aplicarFiltro(chave, itens, grupoDe, rotuloGrupo) {
  const f = filtros[chave];
  const contagem = {};
  for (const i of itens) contagem[grupoDe(i)] = (contagem[grupoDe(i)] || 0) + 1;
  if (f.grupo && !contagem[f.grupo]) f.grupo = '';

  const painel = $(`filtros-${chave}`);
  painel.hidden = itens.length === 0;
  painel.querySelector('.chips-filtro').innerHTML =
    `<button type="button" data-grupo="" class="${f.grupo === '' ? 'ativo' : ''}">Todos <small>${itens.length}</small></button>` +
    Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([g, n]) =>
          `<button type="button" data-grupo="${escapar(g)}" class="${f.grupo === g ? 'ativo' : ''}">${rotuloGrupo(g)} <small>${n}</small></button>`
      )
      .join('');

  const busca = normalizar(f.busca);
  const filtrados = itens
    .filter((i) => !f.grupo || grupoDe(i) === f.grupo)
    .filter((i) => !busca || normalizar(i.descricao).includes(busca))
    .sort(ORDENACOES[f.ordem]);

  const filtrando = filtrados.length !== itens.length;
  const total = filtrados.reduce((s, i) => s + i.valor, 0);
  painel.querySelector('.resultado-filtro').innerHTML = filtrando
    ? `Mostrando <strong>${filtrados.length}</strong> de ${itens.length} · total <strong>${moeda(total)}</strong>
       <button type="button" class="link" data-limpar>Limpar filtros</button>`
    : '';
  return { filtrados, filtrando };
}

function renderizarReceitas(receitas = ultimoResumo?.receitas || []) {
  const itens = receitas.map((r) => ({ ...r, data: r.data_recebimento }));
  const { filtrados, filtrando } = aplicarFiltro(
    'receitas',
    itens,
    (r) => r.tipo,
    (t) => `${TIPOS_RECEITA[t][1]} ${NOMES_TIPO[t]}`
  );

  $('lista-receitas').innerHTML = filtrados.length
    ? filtrados
        .map(
          (r) => `<tr>
            <td>${dataBR(r.data)}</td>
            <td><span class="tag">${TIPOS_RECEITA[r.tipo][1]} ${NOMES_TIPO[r.tipo]}</span></td>
            <td>${escapar(r.descricao)}</td>
            <td class="valor positivo">${moeda(r.valor)}</td>
            <td><button class="excluir" data-tipo="receitas" data-id="${r.id}" title="Excluir">✕</button></td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="vazio">${filtrando ? 'Nenhum recebimento encontrado com esses filtros.' : 'Nenhum recebimento neste mês.'}</td></tr>`;
}

function renderizarGastos(gastos = ultimoResumo?.gastos || []) {
  const itens = gastos.map((g) => ({ ...g, data: g.data_gasto }));
  const { filtrados, filtrando } = aplicarFiltro(
    'gastos',
    itens,
    (g) => g.categoria,
    (c) => `${iconeCategoria(c)} ${escapar(nomeCategoria(c))}`
  );

  $('lista-gastos').innerHTML = filtrados.length
    ? filtrados
        .map(
          (g) => `<tr>
            <td>${dataBR(g.data)}</td>
            <td>${escapar(g.descricao)}</td>
            <td><span class="tag rosa">${iconeCategoria(g.categoria)} ${escapar(nomeCategoria(g.categoria))}</span></td>
            <td class="valor negativo">${moeda(g.valor)}</td>
            <td><button class="excluir" data-tipo="gastos" data-id="${g.id}" title="Excluir">✕</button></td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="vazio">${filtrando ? 'Nenhum gasto encontrado com esses filtros.' : 'Nenhum gasto neste mês.'}</td></tr>`;
}

const RENDERIZAR_LISTA = { receitas: () => renderizarReceitas(), gastos: () => renderizarGastos() };

for (const chave of Object.keys(filtros)) {
  const painel = $(`filtros-${chave}`);
  const busca = painel.querySelector('[data-filtro="busca"]');
  busca.addEventListener('input', () => {
    filtros[chave].busca = busca.value;
    RENDERIZAR_LISTA[chave]();
  });
  painel.querySelector('[data-filtro="ordem"]').addEventListener('change', (e) => {
    filtros[chave].ordem = e.target.value;
    RENDERIZAR_LISTA[chave]();
  });
  painel.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-grupo]');
    const limpar = e.target.closest('[data-limpar]');
    if (!chip && !limpar) return;
    if (chip) filtros[chave].grupo = chip.dataset.grupo;
    if (limpar) {
      filtros[chave].busca = busca.value = '';
      filtros[chave].grupo = '';
    }
    RENDERIZAR_LISTA[chave]();
  });
}

function nomeMesCompleto(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const nome = new Date(ano, m - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

let ultimoResumo = null;
const ABAS = ['lancamentos', 'metas', 'investimentos', 'relatorios'];
let abaAtual = ABAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'lancamentos';

// Os gráficos só são desenhados com a aba Relatórios visível (o canvas precisa ter tamanho)
async function carregarRelatorios() {
  if (abaAtual !== 'relatorios' || !ultimoResumo) return;
  await Relatorios.carregar();
}

async function carregar() {
  if (!inputMes.value) inputMes.value = hojeISO().slice(0, 7);
  atualizarSeletorMes();
  ultimoResumo = await api(`/api/economia/resumo?mes=${inputMes.value}`);
  renderizar(ultimoResumo);
  $('rec-data').value = dataPadrao();
  $('gas-data').value = dataPadrao();
  await carregarAbaAtual();
}

function carregarAbaAtual() {
  if (abaAtual === 'metas') return Metas.carregar();
  if (abaAtual === 'investimentos') return Investimentos.carregar();
  return carregarRelatorios();
}

// ---------- Abas ----------

function trocarAba(aba) {
  abaAtual = aba;
  document.querySelectorAll('.abas button').forEach((b) => {
    const ativa = b.dataset.aba === aba;
    b.classList.toggle('ativa', ativa);
    b.setAttribute('aria-selected', ativa);
  });
  for (const a of ABAS) $(`aba-${a}`).hidden = a !== aba;
  history.replaceState(null, '', aba === 'lancamentos' ? location.pathname : `#${aba}`);
  if (ultimoResumo) carregarAbaAtual();
}

document.querySelectorAll('.abas button').forEach((b) => b.addEventListener('click', () => trocarAba(b.dataset.aba)));

// ---------- Seletor de mês ----------

function atualizarSeletorMes() {
  $('mes-nome').textContent = nomeMesCompleto(inputMes.value);
  $('mes-hoje').hidden = inputMes.value === hojeISO().slice(0, 7);
}

function mudarMes(delta) {
  const [ano, m] = inputMes.value.split('-').map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  inputMes.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  carregar();
}

$('mes-anterior').addEventListener('click', () => mudarMes(-1));
$('mes-proximo').addEventListener('click', () => mudarMes(1));
$('mes-hoje').addEventListener('click', () => {
  inputMes.value = hojeISO().slice(0, 7);
  carregar();
});
document.querySelector('.mes-atual').addEventListener('click', (e) => {
  e.preventDefault();
  try {
    inputMes.showPicker();
  } catch {
    inputMes.focus();
  }
});

// ---------- Formulários ----------

function ligarFormulario(form, url, elErro, validar) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    elErro.textContent = '';
    const dados = Object.fromEntries(new FormData(form));
    const problema = validar && validar(dados);
    if (problema) {
      elErro.textContent = problema;
      return;
    }
    try {
      await api(url, { method: 'POST', body: JSON.stringify(dados) });
      form.querySelector('[name="valor"]').value = '';
      form.querySelector('[name="descricao"]').value = '';
      await carregar();
    } catch (err) {
      elErro.textContent = err.message;
    }
  });
}

ligarFormulario($('form-receita'), '/api/economia/receitas', $('erro-receita'));
ligarFormulario($('form-gasto'), '/api/economia/gastos', $('erro-gasto'), (dados) =>
  dados.categoria ? null : 'Escolha uma categoria.'
);

// Exclusões (lançamentos e categorias) por delegação de eventos
document.addEventListener('click', async (e) => {
  const btnLancamento = e.target.closest('button.excluir');
  const btnCategoria = e.target.closest('button[data-excluir-categoria]');
  if (!btnLancamento && !btnCategoria) return;

  const mensagem = btnCategoria
    ? 'Excluir esta categoria? Os gastos já lançados nela continuam salvos.'
    : 'Deseja excluir este lançamento?';
  if (!confirm(mensagem)) return;

  try {
    if (btnCategoria) {
      await api(`/api/economia/categorias/${btnCategoria.dataset.excluirCategoria}`, { method: 'DELETE' });
      await carregarCategorias();
    } else {
      await api(`/api/economia/${btnLancamento.dataset.tipo}/${btnLancamento.dataset.id}`, { method: 'DELETE' });
      await carregar();
    }
  } catch (err) {
    alert(err.message);
  }
});

$('btn-sair').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

inputMes.addEventListener('change', carregar);

// Inicialização (depois de todos os scripts carregados, inclusive metas.js)
document.addEventListener('DOMContentLoaded', async () => {
  const { usuario } = await api('/api/auth/me');
  const partes = usuario.nome.trim().split(/\s+/);
  $('nome-usuario').textContent = `Olá, ${partes[0]}`;
  $('email-usuario').textContent = usuario.email;
  $('avatar').textContent = (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  inputMes.value = hojeISO().slice(0, 7);
  await carregarCategorias('outros');
  trocarAba(abaAtual);
  await carregar();
});
