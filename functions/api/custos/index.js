// GET  /api/custos   → lista (mais recentes primeiro)
// POST /api/custos   → lança uma compra
import { json, erro } from "../_lib.js";
import { validarCusto } from "../_custos.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM custos ORDER BY data DESC, id DESC LIMIT 2000"
  ).all();
  return json({ custos: results });
}

export async function onRequestPost({ request, env, data }) {
  let c;
  try {
    c = validarCusto(await request.json());
  } catch (e) {
    return erro(e.message);
  }
  const res = await env.DB.prepare(
    `INSERT INTO custos (client_id, data, comprador, produto, quantidade, valor, loja, observacoes, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_id) DO NOTHING
     RETURNING *`
  ).bind(c.client_id, c.data, c.comprador, c.produto, c.quantidade, c.valor, c.loja, c.observacoes,
    data.usuario?.email || null).first();
  if (!res) {
    const existente = await env.DB.prepare("SELECT * FROM custos WHERE client_id = ?").bind(c.client_id).first();
    return json({ custo: existente, duplicado: true });
  }
  return json({ custo: res }, 201);
}
