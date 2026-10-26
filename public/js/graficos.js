// Gráficos da tela de economia (Chart.js)
const Graficos = (() => {
  const css = getComputedStyle(document.documentElement);
  const cor = (nome) => css.getPropertyValue(nome).trim();

  const COR_RECEITAS = cor('--serie-receitas');
  const COR_GASTOS = cor('--serie-gastos');
  const COR_GRADE = cor('--grade');
  const COR_EIXO = cor('--eixo');
  const TEXTO_SUAVE = cor('--suave');
  const TEXTO = cor('--texto');

  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = TEXTO_SUAVE;

  const moeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const moedaCompacta = (v) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

  const nomeMes = (mes) => {
    const [ano, m] = mes.split('-').map(Number);
    const nome = new Date(ano, m - 1, 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    return `${nome}/${String(ano).slice(2)}`;
  };

  const tooltipBase = {
    backgroundColor: '#ffffff',
    titleColor: TEXTO,
    bodyColor: TEXTO,
    footerColor: TEXTO_SUAVE,
    borderColor: COR_EIXO,
    borderWidth: 1,
    padding: 10,
    boxPadding: 4,
    usePointStyle: true,
  };

  // Escreve o valor na ponta de cada barra (gráfico de categorias)
  const rotuloNaPonta = {
    id: 'rotuloNaPonta',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = `12px ${Chart.defaults.font.family}`;
      ctx.fillStyle = TEXTO;
      ctx.textBaseline = 'middle';
      chart.getDatasetMeta(0).data.forEach((barra, i) => {
        ctx.fillText(moeda(chart.data.datasets[0].data[i]), barra.x + 6, barra.y);
      });
      ctx.restore();
    },
  };

  let evolucao = null;

  function desenharEvolucao(canvas, historico) {
    const dados = {
      labels: historico.map((h) => nomeMes(h.mes)),
      datasets: [
        { label: 'Recebido', data: historico.map((h) => h.receitas), backgroundColor: COR_RECEITAS },
        { label: 'Gastos', data: historico.map((h) => h.gastos), backgroundColor: COR_GASTOS },
      ],
    };

    if (evolucao) {
      evolucao.data = dados;
      evolucao.$historico = historico;
      evolucao.update();
      return;
    }

    evolucao = new Chart(canvas, {
      type: 'bar',
      data: dados,
      options: {
        maintainAspectRatio: false,
        datasets: {
          bar: {
            maxBarThickness: 24,
            categoryPercentage: 0.6,
            barPercentage: 0.85,
            borderRadius: { topLeft: 4, topRight: 4 },
            borderSkipped: 'start',
          },
        },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${moeda(c.parsed.y)}`,
              footer: (itens) => {
                const h = evolucao.$historico[itens[0].dataIndex];
                return `Economia: ${moeda(h.economia)}`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, border: { color: COR_EIXO } },
          y: {
            beginAtZero: true,
            grid: { color: COR_GRADE },
            border: { display: false },
            ticks: { maxTicksLimit: 5, callback: (v) => moedaCompacta(v) },
          },
        },
      },
    });
    evolucao.$historico = historico;
  }

  // Barras horizontais com o valor na ponta. itens: [{ nome, valor }] já ordenados do maior para o menor.
  // Uma instância de gráfico por canvas; 'complemento' completa o tooltip (ex.: 'dos gastos').
  const barras = new Map();

  function barrasHorizontais(canvas, area, itens, cor, complemento) {
    area.style.height = `${Math.max(180, itens.length * 38 + 30)}px`;

    const dados = {
      labels: itens.map((i) => i.nome),
      datasets: [{ data: itens.map((i) => i.valor), backgroundColor: cor }],
    };

    if (barras.has(canvas)) {
      const grafico = barras.get(canvas);
      grafico.data = dados;
      grafico.update();
      return;
    }

    barras.set(canvas, new Chart(canvas, {
      type: 'bar',
      data: dados,
      plugins: [rotuloNaPonta],
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        layout: { padding: { right: 84 } }, // espaço para o valor escrito na ponta da barra maior
        datasets: {
          bar: {
            maxBarThickness: 22,
            borderRadius: { topRight: 4, bottomRight: 4 },
            borderSkipped: 'start',
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              label: (c) => {
                const total = c.dataset.data.reduce((s, v) => s + v, 0);
                return ` ${moeda(c.parsed.x)} (${((c.parsed.x / total) * 100).toFixed(1)}% ${complemento})`;
              },
            },
          },
        },
        scales: {
          x: { display: false, beginAtZero: true },
          y: { grid: { display: false }, border: { color: COR_EIXO }, ticks: { color: TEXTO } },
        },
      },
    }));
  }

  const desenharCategorias = (canvas, area, itens) => barrasHorizontais(canvas, area, itens, COR_GASTOS, 'dos gastos');
  const desenharDistribuicao = (canvas, area, itens) =>
    barrasHorizontais(canvas, area, itens, COR_RECEITAS, 'do patrimônio');

  return { desenharEvolucao, desenharCategorias, desenharDistribuicao, nomeMes, moeda };
})();
