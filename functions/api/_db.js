// Garante que as tabelas existam (uma vez por instância do Worker).
import { SCHEMA, INDICE, MIGRACOES } from "./_lib.js";

const SCHEMA_ACESSOS = `CREATE TABLE IF NOT EXISTS acessos (
  email TEXT PRIMARY KEY,
  nome TEXT,
  foto TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',   -- pendente | aprovado | recusado
  solicitado_em TEXT NOT NULL DEFAULT (datetime('now')),
  decidido_em TEXT,
  decidido_por TEXT,
  ultimo_acesso TEXT
)`;

const SCHEMA_CUSTOS = `CREATE TABLE IF NOT EXISTS custos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT UNIQUE,
  data TEXT NOT NULL,
  comprador TEXT NOT NULL,
  produto TEXT NOT NULL,
  quantidade TEXT,
  valor REAL NOT NULL,
  loja TEXT,
  observacoes TEXT,
  criado_por TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_por TEXT,
  atualizado_em TEXT
)`;
const INDICE_CUSTOS = "CREATE INDEX IF NOT EXISTS idx_custos_data ON custos (data DESC)";

let pronto = false;

export async function garantirBanco(env) {
  if (pronto) return;
  if (!env.DB) throw new Error("Banco de dados não configurado (binding DB).");
  const db = env.DB;
  await db.batch([db.prepare(SCHEMA), db.prepare(INDICE), db.prepare(SCHEMA_ACESSOS), db.prepare(SCHEMA_CUSTOS), db.prepare(INDICE_CUSTOS)]);
  for (const sql of MIGRACOES) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e.message || e))) throw e;
    }
  }
  pronto = true;
}
