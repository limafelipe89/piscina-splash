// GET  /api/registros?limite=200&tipo=manutencao  → lista
// POST /api/registros                             → cria
import { TIPOS, json, erro, validar, saida } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const limite = Math.min(Math.max(parseInt(url.searchParams.get("limite") || "200", 10) || 200, 1), 1000);
  const tipo = url.searchParams.get("tipo");

  let sql = "SELECT * FROM registros";
  const params = [];
  if (tipo && TIPOS.includes(tipo)) {
    sql += " WHERE tipo = ?";
    params.push(tipo);
  }
  sql += " ORDER BY data DESC, COALESCE(hora, '') DESC, id DESC LIMIT ?";
  params.push(limite);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ registros: results.map(saida) });
}

export async function onRequestPost({ request, env }) {
  let r;
  try {
    r = validar(await request.json());
  } catch (e) {
    return erro(e.message);
  }

  // client_id evita duplicar quando o celular reenvia um registro feito offline
  const res = await env.DB.prepare(
    `INSERT INTO registros
       (client_id, data, hora, tipo, responsavel, cloro, ph, alcalinidade, temperatura, tarefas, produtos, gasto, observacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_id) DO NOTHING
     RETURNING *`
  ).bind(
    r.client_id, r.data, r.hora, r.tipo, r.responsavel, r.cloro, r.ph, r.alcalinidade,
    r.temperatura, r.tarefas, r.produtos, r.gasto, r.observacoes
  ).first();

  if (!res) {
    const existente = await env.DB.prepare("SELECT * FROM registros WHERE client_id = ?").bind(r.client_id).first();
    return json({ registro: existente ? saida(existente) : null, duplicado: true });
  }
  return json({ registro: saida(res) }, 201);
}
