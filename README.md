# Cofrinho — finanças leves

Sistema pessoal de economias (fase 1). Próximas fases: metas e investimentos.

## Tecnologias
- Node.js + Express (API)
- PostgreSQL no [Neon](https://neon.tech)
- HTML/CSS/JS puro (frontend em `public/`)

## Como configurar

1. **Crie o projeto no Neon**
   - Acesse https://console.neon.tech e clique em **New Project**
   - Nome: `sistema-economia`, região mais próxima (ex.: *AWS São Paulo – sa-east-1*)
   - Depois de criado, clique em **Connect** e copie a *connection string*

2. **Crie o arquivo `.env`** (copie de `.env.example`) e cole a connection string em `DATABASE_URL`.
   Troque `JWT_SECRET` por um texto longo e aleatório.

3. **Instale e rode**
   ```bash
   npm install
   npm run dev
   ```
   As tabelas são criadas automaticamente na primeira execução.

4. Acesse http://localhost:3000

## Banco de dados
| Tabela     | Conteúdo                                                        |
|------------|-----------------------------------------------------------------|
| `usuarios` | nome, e-mail (único) e senha (guardada com hash bcrypt)         |
| `receitas` | salário, bonificação, plantão ou outro, com valor e data        |
| `gastos`   | descrição, categoria, valor e data                              |
| `categorias_gasto` | categorias de gasto criadas pelo usuário (além das padrão) |
| `caixinhas` | metas: nome, ícone, cor, valor da meta e data alvo |
| `caixinha_movimentos` | quanto foi guardado ou resgatado de cada caixinha, com data |
| `investimentos` | nome, tipo (CDB, Tesouro, ações, FIIs, cripto...) e instituição |
| `investimento_movimentos` | aportes, resgates e atualizações do valor atual |
| `tipos_personalizados` | tipos de meta e de investimento criados pelo usuário |

Relatórios (Chart.js): recebido x gastos e gastos por categoria, com filtros de período (mês, 3/6/12 meses, ano ou personalizado), tipos de recebimento e categorias de gasto.

Economia do mês = total recebido − total de gastos.
