// Seletor de tipos com opções padrão + tipos criados pelo usuário (metas e investimentos).
// Usa api, escapar e opcao de economia.js.
function criarSeletorTipos({ contexto, container, padrao, elErro, classeOpcoes = '' }) {
  let personalizados = [];

  // Formulário inline para criar um tipo novo, logo abaixo das opções
  const form = document.createElement('div');
  form.className = 'nova-categoria novo-tipo';
  form.hidden = true;
  form.innerHTML = `
    <input type="text" class="novo-tipo-icone" maxlength="16" placeholder="🙂" aria-label="Emoji do tipo" />
    <input type="text" class="novo-tipo-nome" maxlength="40" placeholder="Nome do novo tipo" aria-label="Nome do novo tipo" />
    <button type="button" class="rosa pequeno" data-tipo-salvar>Salvar</button>
    <button type="button" class="secundario pequeno" data-tipo-cancelar>Cancelar</button>`;
  container.after(form);
  const dica = document.createElement('p');
  dica.className = 'dica-emoji';
  dica.hidden = true;
  dica.textContent = 'Dica: no Windows, aperte Win + . (ponto) para escolher um emoji.';
  form.after(dica);
  if (classeOpcoes) container.classList.add(classeOpcoes);

  const inputNome = form.querySelector('.novo-tipo-nome');
  const inputIcone = form.querySelector('.novo-tipo-icone');

  function selecionado() {
    return container.querySelector('input:checked')?.value;
  }

  // [nome, ícone] de um tipo (padrão ou personalizado); tipos excluídos mostram o nome salvo
  function info(tipo) {
    if (padrao[tipo]) return padrao[tipo];
    const p = personalizados.find((t) => t.nome === tipo);
    return p ? [p.nome, p.icone] : [tipo || '', '🏷️'];
  }

  function renderizar(valor = selecionado()) {
    const opcoesPadrao = Object.entries(padrao).map(([chave, [nome, icone]]) => opcao('tipo', chave, nome, icone));
    const opcoesMinhas = personalizados.map((t) =>
      opcao(
        'tipo',
        t.nome,
        t.nome,
        escapar(t.icone),
        `<button type="button" class="opcao-excluir" data-excluir-tipo="${t.id}" title="Excluir tipo" aria-label="Excluir tipo ${escapar(t.nome)}">✕</button>`
      )
    );
    container.innerHTML =
      [...opcoesPadrao, ...opcoesMinhas].join('') + `<button type="button" class="opcao-nova" data-tipo-novo>+ Novo tipo</button>`;

    const radios = [...container.querySelectorAll('input')];
    const alvo = radios.find((r) => r.value === valor) || radios[0];
    alvo.checked = true;
  }

  async function carregar(valor) {
    personalizados = await api(`/api/tipos/${contexto}`);
    renderizar(valor);
  }

  function mostrarForm(mostrar) {
    form.hidden = dica.hidden = !mostrar;
    if (mostrar) {
      inputNome.value = '';
      inputIcone.value = '';
      inputNome.focus();
    }
  }

  async function salvar() {
    elErro.textContent = '';
    try {
      const novo = await api(`/api/tipos/${contexto}`, {
        method: 'POST',
        body: JSON.stringify({ nome: inputNome.value, icone: inputIcone.value }),
      });
      mostrarForm(false);
      await carregar(novo.nome);
    } catch (err) {
      elErro.textContent = err.message;
    }
  }

  container.addEventListener('click', async (e) => {
    if (e.target.closest('[data-tipo-novo]')) return mostrarForm(true);
    const btnExcluir = e.target.closest('[data-excluir-tipo]');
    if (!btnExcluir) return;
    e.preventDefault();
    if (!confirm('Excluir este tipo? O que já foi cadastrado com ele continua salvo.')) return;
    try {
      await api(`/api/tipos/${contexto}/${btnExcluir.dataset.excluirTipo}`, { method: 'DELETE' });
      await carregar();
    } catch (err) {
      elErro.textContent = err.message;
    }
  });
  form.querySelector('[data-tipo-salvar]').addEventListener('click', salvar);
  form.querySelector('[data-tipo-cancelar]').addEventListener('click', () => mostrarForm(false));
  for (const input of [inputNome, inputIcone]) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // não envia o formulário do diálogo
        salvar();
      }
    });
  }

  return { carregar, renderizar, selecionado, info, esconderForm: () => mostrarForm(false) };
}
