// PUT    /api/custos/:id → edita
// DELETE /api/custos/:id → exclusão lógica (só quem lançou)
import { json, erro } from "../_lib.js";
import { validarCusto } from "../_custos.js";
import { registrarLog, diferencas, podeExcluir } from "../_log.js";

const CAMPOS = ["data", "comprador", "produto", "quantidade", "valor", "loja", "observacoes"];

function lerId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function buscar(env, id) {
  return env.DB.prepare("SELECT * FROM custos WHERE id = ? AND excluido_em IS NULL").bind(id).first();
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
  const antes = await buscar(env, id);
  if (!antes) return erro("Lançamento não encontrado", 404);

  const res = await env.DB.prepare(
    `UPDATE custos SET data = ?, comprador = ?, produto = ?, quantidade = ?, valor = ?, loja = ?, observacoes = ?,
       atualizado_por = ?, atualizado_em = datetime('now')
     WHERE id = ? AND excluido_em IS NULL RETURNING *`
  ).bind(c.data, c.comprador, c.produto, c.quantidade, c.valor, c.loja, c.observacoes,
    data.usuario?.email || null, id).first();
  if (!res) return erro("Lançamento não encontrado", 404);

  await registrarLog(env, request, {
    email: data.usuario?.email,
    acao: "custo_editar",
    entidade: "custo",
    entidadeId: id,
    detalhes: { produto: res.produto, alteracoes: diferencas(antes, res, CAMPOS) },
  });
  return json({ custo: res });
}

export async function onRequestDelete({ params, request, env, data }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  const linha = await buscar(env, id);
  if (!linha) return erro("Lançamento não encontrado", 404);

  if (!podeExcluir(env, data.usuario, linha)) {
    await registrarLog(env, request, {
      email: data.usuario?.email, acao: "custo_excluir_negado", entidade: "custo", entidadeId: id,
      detalhes: { criado_por: linha.criado_por },
    });
    return erro("Só quem lançou esta compra pode excluí-la", 403);
  }

  await env.DB.prepare(
    "UPDATE custos SET excluido_em = datetime('now'), excluido_por = ? WHERE id = ? AND excluido_em IS NULL"
  ).bind(data.usuario?.email || null, id).run();

  await registrarLog(env, request, {
    email: data.usuario?.email,
    acao: "custo_excluir",
    entidade: "custo",
    entidadeId: id,
    detalhes: { data: linha.data, comprador: linha.comprador, produto: linha.produto, valor: linha.valor },
  });
  return json({ ok: true });
}
