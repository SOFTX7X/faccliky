-- Faccliky: estrutura do banco de dados (PostgreSQL)
-- Pode rodar quantas vezes quiser: só cria o que ainda não existe.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  senha_hash    TEXT         NOT NULL,
  meta_gasto    NUMERIC(12,2),
  teste_ate     TIMESTAMPTZ  NOT NULL DEFAULT (now() + interval '7 days'),
  premium_ate   TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Agendas compartilhadas (família, equipe)
CREATE TABLE IF NOT EXISTS agendas (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(80) NOT NULL,
  dono_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agenda_membros (
  agenda_id  INTEGER NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (agenda_id, usuario_id)
);

-- Compromissos e tarefas
CREATE TABLE IF NOT EXISTS eventos (
  id           SERIAL PRIMARY KEY,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  agenda_id    INTEGER REFERENCES agendas(id) ON DELETE CASCADE,
  tipo         VARCHAR(10) NOT NULL DEFAULT 'evento',   -- 'evento' (tem horário) ou 'tarefa' (sem horário fixo)
  titulo       VARCHAR(160) NOT NULL,
  local        VARCHAR(160),
  inicio       TIMESTAMPTZ,
  dia_todo     BOOLEAN NOT NULL DEFAULT false,
  duracao_min  INTEGER NOT NULL DEFAULT 60,
  prioridade   SMALLINT NOT NULL DEFAULT 2,             -- 1 alta, 2 média, 3 baixa
  lembrete_min INTEGER,                                 -- minutos antes para avisar
  concluido    BOOLEAN NOT NULL DEFAULT false,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eventos_usuario_inicio ON eventos (usuario_id, inicio);
CREATE INDEX IF NOT EXISTS eventos_agenda ON eventos (agenda_id);

-- Contas a pagar
CREATE TABLE IF NOT EXISTS contas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  descricao   VARCHAR(120) NOT NULL,
  valor       NUMERIC(12,2) NOT NULL DEFAULT 0,
  vencimento  DATE NOT NULL,
  paga        BOOLEAN NOT NULL DEFAULT false,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contas_usuario_venc ON contas (usuario_id, vencimento);

-- Hábitos
CREATE TABLE IF NOT EXISTS habitos (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        VARCHAR(80) NOT NULL,
  icone       VARCHAR(16) NOT NULL DEFAULT '⭐',
  meta_semana SMALLINT NOT NULL DEFAULT 7,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habito_registros (
  habito_id INTEGER NOT NULL REFERENCES habitos(id) ON DELETE CASCADE,
  dia       DATE NOT NULL,
  PRIMARY KEY (habito_id, dia)
);

-- Pagamentos (BravoPay)
CREATE TABLE IF NOT EXISTS pagamentos (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  gateway     VARCHAR(30) NOT NULL DEFAULT 'bravopay',
  referencia  VARCHAR(120) UNIQUE,
  status      VARCHAR(30) NOT NULL,
  valor       NUMERIC(12,2),
  dados       JSONB,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Perfil e aparência (v2)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS usuario      VARCHAR(20);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bio          VARCHAR(160);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar       TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS capa         TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS papel        TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS papel_escuro SMALLINT NOT NULL DEFAULT 35;
UPDATE usuarios SET usuario = 'user' || id WHERE usuario IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_unico ON usuarios (lower(usuario));
