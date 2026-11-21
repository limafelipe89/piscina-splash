// GET  /api/registros?limite=200  → lista (sem os excluídos)
// POST /api/registros            → cria
import { json, erro, validar, saida } from "../_lib.js";
import { registrarLog } from "../_log.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const limite = Math.min(Math.max(parseInt(url.searchParams.get("limite") || "200", 10) || 200, 1), 1000);
  const { results } = await env.DB.prepare(
    `SELECT * FROM registros WHERE excluido_em IS NULL
     ORDER BY data DESC, COALESCE(hora, '') DESC, id DESC LIMIT ?`
  ).bind(limite).all();
  return json({ registros: results.map(saida) });
}

export async function onRequestPost({ request, env, data }) {
  let r;
  try {
    r = validar(await request.json());
  } catch (e) {
    return erro(e.message);
  }

  // client_id evita duplicar quando o celular reenvia um registro feito offline
  const res = await env.DB.prepare(
    `INSERT INTO registros
       (client_id, data, hora, tipo, responsavel, cloro, ph, alcalinidade, temperatura, tarefas, produtos, gasto, observacoes, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_id) DO NOTHING
     RETURNING *`
  ).bind(
    r.client_id, r.data, r.hora, r.tipo, r.responsavel, r.cloro, r.ph, r.alcalinidade,
    r.temperatura, r.tarefas, r.produtos, r.gasto, r.observacoes, data.usuario?.email || null
  ).first();

  if (!res) {
    const existente = await env.DB.prepare("SELECT * FROM registros WHERE client_id = ?").bind(r.client_id).first();
    return json({ registro: existente ? saida(existente) : null, duplicado: true });
  }

  await registrarLog(env, request, {
    email: data.usuario?.email,
    acao: "registro_criar",
    entidade: "registro",
    entidadeId: res.id,
    detalhes: { data: res.data, responsavel: res.responsavel, cloro: res.cloro, ph: res.ph },
  });
  return json({ registro: saida(res) }, 201);
}
