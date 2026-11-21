// GET    /api/registros/:id
// PUT    /api/registros/:id  → atualiza
// DELETE /api/registros/:id  → exclusão lógica (só quem criou)
import { json, erro, validar, saida } from "../_lib.js";
import { registrarLog, diferencas, podeExcluir } from "../_log.js";

const CAMPOS = ["data", "hora", "responsavel", "cloro", "ph", "alcalinidade", "temperatura", "tarefas", "produtos", "observacoes"];

function lerId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function buscar(env, id) {
  return env.DB.prepare("SELECT * FROM registros WHERE id = ? AND excluido_em IS NULL").bind(id).first();
}

export async function onRequestGet({ params, env }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  const r = await buscar(env, id);
  return r ? json({ registro: saida(r) }) : erro("Registro não encontrado", 404);
}

export async function onRequestPut({ params, request, env, data }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  let r;
  try {
    r = validar(await request.json());
  } catch (e) {
    return erro(e.message);
  }
  const antes = await buscar(env, id);
  if (!antes) return erro("Registro não encontrado", 404);

  const res = await env.DB.prepare(
    `UPDATE registros SET
       data = ?, hora = ?, tipo = ?, responsavel = ?, cloro = ?, ph = ?, alcalinidade = ?,
       temperatura = ?, tarefas = ?, produtos = ?, gasto = ?, observacoes = ?,
       atualizado_em = datetime('now'), atualizado_por = ?
     WHERE id = ? AND excluido_em IS NULL
     RETURNING *`
  ).bind(
    r.data, r.hora, r.tipo, r.responsavel, r.cloro, r.ph, r.alcalinidade,
    r.temperatura, r.tarefas, r.produtos, r.gasto, r.observacoes, data.usuario?.email || null, id
  ).first();
  if (!res) return erro("Registro não encontrado", 404);

  await registrarLog(env, request, {
    email: data.usuario?.email,
    acao: "registro_editar",
    entidade: "registro",
    entidadeId: id,
    detalhes: { data: res.data, alteracoes: diferencas(antes, res, CAMPOS) },
  });
  return json({ registro: saida(res) });
}

export async function onRequestDelete({ params, request, env, data }) {
  const id = lerId(params);
  if (!id) return erro("ID inválido");
  const linha = await buscar(env, id);
  if (!linha) return erro("Registro não encontrado", 404);

  if (!podeExcluir(env, data.usuario, linha)) {
    await registrarLog(env, request, {
      email: data.usuario?.email, acao: "registro_excluir_negado", entidade: "registro", entidadeId: id,
      detalhes: { criado_por: linha.criado_por },
    });
    return erro("Só quem criou este registro pode excluí-lo", 403);
  }

  await env.DB.prepare(
    "UPDATE registros SET excluido_em = datetime('now'), excluido_por = ? WHERE id = ? AND excluido_em IS NULL"
  ).bind(data.usuario?.email || null, id).run();

  await registrarLog(env, request, {
    email: data.usuario?.email,
    acao: "registro_excluir",
    entidade: "registro",
    entidadeId: id,
    detalhes: { data: linha.data, responsavel: linha.responsavel, cloro: linha.cloro, ph: linha.ph },
  });
  return json({ ok: true });
}
