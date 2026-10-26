-- Usuários do sistema
CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(180) NOT NULL UNIQUE,
  senha_hash  VARCHAR(255) NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entradas de dinheiro: salário, bonificação, plantão, outros
CREATE TABLE IF NOT EXISTS receitas (
  id               SERIAL PRIMARY KEY,
  usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo             VARCHAR(20) NOT NULL CHECK (tipo IN ('salario', 'bonificacao', 'plantao', 'outro')),
  descricao        VARCHAR(200),
  valor            NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data_recebimento DATE NOT NULL,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saídas de dinheiro
CREATE TABLE IF NOT EXISTS gastos (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  descricao   VARCHAR(200) NOT NULL,
  categoria   VARCHAR(40) NOT NULL DEFAULT 'outros',
  valor       NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data_gasto  DATE NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receitas_usuario_data ON receitas (usuario_id, data_recebimento);
CREATE INDEX IF NOT EXISTS idx_gastos_usuario_data   ON gastos   (usuario_id, data_gasto);

-- Categorias de gasto criadas pelo próprio usuário (além das categorias padrão)
CREATE TABLE IF NOT EXISTS categorias_gasto (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        VARCHAR(40) NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_usuario_nome ON categorias_gasto (usuario_id, LOWER(nome));

-- Metas: caixinhas onde o usuário guarda dinheiro para um objetivo
CREATE TABLE IF NOT EXISTS caixinhas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        VARCHAR(60) NOT NULL,
  icone       VARCHAR(16) NOT NULL DEFAULT '💰',
  cor         VARCHAR(10) NOT NULL DEFAULT 'azul' CHECK (cor IN ('azul', 'rosa', 'lilas', 'verde')),
  meta        NUMERIC(12, 2) CHECK (meta IS NULL OR meta > 0),
  data_alvo   DATE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Depósitos (guardar) e retiradas (resgatar) de cada caixinha
CREATE TABLE IF NOT EXISTS caixinha_movimentos (
  id           SERIAL PRIMARY KEY,
  caixinha_id  INTEGER NOT NULL REFERENCES caixinhas(id) ON DELETE CASCADE,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo         VARCHAR(10) NOT NULL CHECK (tipo IN ('deposito', 'retirada')),
  valor        NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data         DATE NOT NULL,
  descricao    VARCHAR(200),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caixinhas_usuario ON caixinhas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_caixinha_data ON caixinha_movimentos (caixinha_id, data);

-- Investimentos (CDB, Tesouro, ações, FIIs, cripto...)
CREATE TABLE IF NOT EXISTS investimentos (
  id           SERIAL PRIMARY KEY,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome         VARCHAR(80) NOT NULL,
  tipo         VARCHAR(20) NOT NULL,
  instituicao  VARCHAR(60),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- aporte = dinheiro colocado; resgate = dinheiro retirado;
-- saldo = atualização do valor atual do investimento (conferido no banco/corretora)
CREATE TABLE IF NOT EXISTS investimento_movimentos (
  id               SERIAL PRIMARY KEY,
  investimento_id  INTEGER NOT NULL REFERENCES investimentos(id) ON DELETE CASCADE,
  usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo             VARCHAR(10) NOT NULL CHECK (tipo IN ('aporte', 'resgate', 'saldo')),
  valor            NUMERIC(14, 2) NOT NULL CHECK (valor >= 0),
  data             DATE NOT NULL,
  descricao        VARCHAR(200),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investimentos_usuario ON investimentos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_inv_movimentos ON investimento_movimentos (investimento_id, data);

-- Tipos criados pelo usuário para metas (caixinhas) e investimentos
CREATE TABLE IF NOT EXISTS tipos_personalizados (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  contexto    VARCHAR(20) NOT NULL CHECK (contexto IN ('meta', 'investimento')),
  nome        VARCHAR(40) NOT NULL,
  icone       VARCHAR(16) NOT NULL DEFAULT '🏷️',
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_usuario_nome ON tipos_personalizados (usuario_id, contexto, LOWER(nome));

-- Caixinhas passam a ter um tipo; investimentos aceitam nomes de tipos personalizados
ALTER TABLE caixinhas ADD COLUMN IF NOT EXISTS tipo VARCHAR(40);
ALTER TABLE investimentos ALTER COLUMN tipo TYPE VARCHAR(40);
