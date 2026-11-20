// Utilidades compartilhadas pelas rotas da API.

export const TIPOS = ["manutencao", "antes", "depois"];

export const SCHEMA = `CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT UNIQUE,
  data TEXT NOT NULL,
  hora TEXT,
  tipo TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  cloro REAL,
  ph REAL,
  alcalinidade REAL,
  temperatura REAL,
  tarefas TEXT NOT NULL DEFAULT '[]',
  produtos TEXT,
  gasto REAL,
  observacoes TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT
)`;

export const INDICE = "CREATE INDEX IF NOT EXISTS idx_registros_data ON registros (data DESC)";

export function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function erro(msg, status = 400) {
  return json({ erro: msg }, status);
}

const FAIXAS = {
  cloro: [0, 20],
  ph: [0, 14],
  alcalinidade: [0, 1000],
  temperatura: [0, 50],
  gasto: [0, 100000],
};

function numero(v, campo) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  const [min, max] = FAIXAS[campo];
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Valor inválido em ${campo}`);
  return Math.round(n * 100) / 100;
}

function texto(v, max) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

// Valida e normaliza o corpo recebido. Lança Error com mensagem amigável.
export function validar(b) {
  if (!b || typeof b !== "object") throw new Error("Corpo inválido");
  if (!TIPOS.includes(b.tipo)) throw new Error("Tipo inválido");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.data || "")) throw new Error("Data inválida");
  if (b.hora && !/^\d{2}:\d{2}$/.test(b.hora)) throw new Error("Hora inválida");
  const responsavel = texto(b.responsavel, 60);
  if (!responsavel) throw new Error("Informe quem fez a manutenção");
  const tarefas = Array.isArray(b.tarefas)
    ? [...new Set(b.tarefas.filter((t) => typeof t === "string" && /^[a-z0-9_]{1,40}$/.test(t)))].slice(0, 50)
    : [];
  return {
    client_id: typeof b.client_id === "string" && /^[0-9a-f-]{8,64}$/i.test(b.client_id) ? b.client_id : null,
    data: b.data,
    hora: b.hora || null,
    tipo: b.tipo,
    responsavel,
    cloro: numero(b.cloro, "cloro"),
    ph: numero(b.ph, "ph"),
    alcalinidade: numero(b.alcalinidade, "alcalinidade"),
    temperatura: numero(b.temperatura, "temperatura"),
    tarefas: JSON.stringify(tarefas),
    produtos: texto(b.produtos, 1000),
    gasto: numero(b.gasto, "gasto"),
    observacoes: texto(b.observacoes, 2000),
  };
}

export function saida(linha) {
  let tarefas = [];
  try { tarefas = JSON.parse(linha.tarefas || "[]"); } catch { /* ignora */ }
  return { ...linha, tarefas };
}
