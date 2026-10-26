const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');
const subtitulo = document.getElementById('subtitulo');

// Se já estiver logado, vai direto para a tela de economia
fetch('/api/auth/me').then((r) => {
  if (r.ok) window.location.href = '/economia.html';
});

document.querySelectorAll('[data-ir]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const cadastro = btn.dataset.ir === 'cadastro';
    formCadastro.hidden = !cadastro;
    formLogin.hidden = cadastro;
    subtitulo.textContent = cadastro ? 'Crie sua conta' : 'Entre na sua conta';
  });
});

async function enviar(url, dados, elErro) {
  elErro.textContent = '';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    const json = await resp.json();
    if (!resp.ok) {
      elErro.textContent = json.erro || 'Algo deu errado.';
      return;
    }
    window.location.href = '/economia.html';
  } catch {
    elErro.textContent = 'Não foi possível conectar ao servidor.';
  }
}

formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(formLogin));
  enviar('/api/auth/login', dados, document.getElementById('erro-login'));
});

formCadastro.addEventListener('submit', (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(formCadastro));
  const elErro = document.getElementById('erro-cadastro');
  if (dados.senha !== dados.confirma) {
    elErro.textContent = 'As senhas não conferem.';
    return;
  }
  delete dados.confirma;
  enviar('/api/auth/cadastro', dados, elErro);
});
