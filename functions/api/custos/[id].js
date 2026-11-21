// PUT    /api/custos/:id → edita
// DELETE /api/custos/:id → exclui
import { json, erro } from "../_lib.js";
import { validarCusto } from "../_custos.js";

function lerId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestPut({ params, request, env, data }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  let c;
  try {
    c = validarCusto(await request.json());
  } catch (e) {
    return erro(e.message);
  }
  const res = await env.DB.prepare(
    `UPDATE custos SET data = ?, comprador = ?, produto = ?, quantidade = ?, valor = ?, loja = ?, observacoes = ?,
       atualizado_por = ?, atualizado_em = datetime('now')
     WHERE id = ? RETURNING *`
  ).bind(c.data, c.comprador, c.produto, c.quantidade, c.valor, c.loja, c.observacoes,
    data.usuario?.email || null, id).first();
  return res ? json({ custo: res }) : erro("Lançamento não encontrado", 404);
}

export async function onRequestDelete({ params, env }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  const r = await env.DB.prepare("DELETE FROM custos WHERE id = ?").bind(id).run();
  return r.meta.changes ? json({ ok: true }) : erro("Lançamento não encontrado", 404);
}
