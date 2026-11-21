// PUT    /api/lista/:id  { acao: "comprar", data, comprador, valor, quantidade?, loja? }
//        → lança a compra em Custos e tira o produto da lista
// DELETE /api/lista/:id  → exclusão lógica (só quem avisou)
import { json, erro } from "../_lib.js";
import { validarCusto } from "../_custos.js";
import { registrarLog, podeExcluir } from "../_log.js";

function lerId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function buscar(env, id) {
  return env.DB.prepare("SELECT * FROM lista_compras WHERE id = ? AND excluido_em IS NULL").bind(id).first();
}

export async function onRequestPut({ params, request, env, data }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  let b;
  try { b = await request.json(); } catch { return erro("Corpo inválido"); }
  if (b.acao !== "comprar") return erro("Ação inválida");

  const item = await buscar(env, id);
  if (!item) return erro("Item não encontrado", 404);
  if (item.status !== "faltando") return erro("Este item já foi comprado");

  let c;
  try {
    c = validarCusto({ ...b, produto: b.produto || item.produto, quantidade: b.quantidade || item.quantidade });
  } catch (e) {
    return erro(e.message);
  }

  const email = data.usuario?.email || null;
  const custo = await env.DB.prepare(
    `INSERT INTO custos (data, comprador, produto, quantidade, valor, loja, observacoes, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  ).bind(c.data, c.comprador, c.produto, c.quantidade, c.valor, c.loja, c.observacoes || "Da lista de compras", email).first();

  await env.DB.prepare(
    `UPDATE lista_compras SET status = 'comprado', comprado_por = ?, comprado_em = datetime('now'), custo_id = ?
     WHERE id = ? AND status = 'faltando'`
  ).bind(email, custo.id, id).run();

  await registrarLog(env, request, {
    email, acao: "lista_comprar", entidade: "lista", entidadeId: id,
    detalhes: { produto: custo.produto, valor: custo.valor, comprador: custo.comprador, custo_id: custo.id },
  });
  return json({ ok: true, custo });
}

export async function onRequestDelete({ params, request, env, data }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  const item = await buscar(env, id);
  if (!item) return erro("Item não encontrado", 404);

  if (!podeExcluir(env, data.usuario, { criado_por: item.pedido_por })) {
    await registrarLog(env, request, {
      email: data.usuario?.email, acao: "lista_excluir_negado", entidade: "lista", entidadeId: id,
      detalhes: { produto: item.produto, criado_por: item.pedido_por },
    });
    return erro("Só quem colocou o produto na lista pode tirá-lo", 403);
  }

  await env.DB.prepare(
    "UPDATE lista_compras SET excluido_em = datetime('now'), excluido_por = ? WHERE id = ?"
  ).bind(data.usuario?.email || null, id).run();
  await registrarLog(env, request, {
    email: data.usuario?.email, acao: "lista_excluir", entidade: "lista", entidadeId: id,
    detalhes: { produto: item.produto },
  });
  return json({ ok: true });
}
