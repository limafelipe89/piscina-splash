// GET    /api/registros/:id
// PUT    /api/registros/:id  → atualiza
// DELETE /api/registros/:id  → exclui
import { json, erro, validar, saida } from "../_lib.js";

function lerId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestGet({ params, env }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  const r = await env.DB.prepare("SELECT * FROM registros WHERE id = ?").bind(id).first();
  return r ? json({ registro: saida(r) }) : erro("Registro não encontrado", 404);
}

export async function onRequestPut({ params, request, env }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  let r;
  try {
    r = validar(await request.json());
  } catch (e) {
    return erro(e.message);
  }
  const res = await env.DB.prepare(
    `UPDATE registros SET
       data = ?, hora = ?, tipo = ?, responsavel = ?, cloro = ?, ph = ?, alcalinidade = ?,
       temperatura = ?, tarefas = ?, produtos = ?, gasto = ?, observacoes = ?,
       atualizado_em = datetime('now')
     WHERE id = ?
     RETURNING *`
  ).bind(
    r.data, r.hora, r.tipo, r.responsavel, r.cloro, r.ph, r.alcalinidade,
    r.temperatura, r.tarefas, r.produtos, r.gasto, r.observacoes, id
  ).first();
  return res ? json({ registro: saida(res) }) : erro("Registro não encontrado", 404);
}

export async function onRequestDelete({ params, env }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  const res = await env.DB.prepare("DELETE FROM registros WHERE id = ?").bind(id).run();
  return res.meta.changes ? json({ ok: true }) : erro("Registro não encontrado", 404);
}
