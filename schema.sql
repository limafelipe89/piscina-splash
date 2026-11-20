-- Referência: a tabela é criada automaticamente pela API na primeira requisição.
-- Se preferir criar manualmente, rode este SQL no console do D1.
CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT UNIQUE,
  data TEXT NOT NULL,
  hora TEXT,
  tipo TEXT NOT NULL,            -- manutencao | antes | depois
  responsavel TEXT NOT NULL,
  cloro REAL,                    -- cloro livre (ppm)
  ph REAL,
  alcalinidade REAL,             -- ppm
  temperatura REAL,              -- °C
  tarefas TEXT NOT NULL DEFAULT '[]',  -- JSON com os IDs das tarefas marcadas
  produtos TEXT,
  gasto REAL,                    -- R$
  observacoes TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_registros_data ON registros (data DESC);
