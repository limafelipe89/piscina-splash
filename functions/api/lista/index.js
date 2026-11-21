// GET  /api/lista  → produtos faltando + comprados nos últimos 60 dias
// POST /api/lista  → avisa que um produto está acabando { produto, quantidade?, observacao? }
import { json, erro } from "../_lib.js";
import { registrarLog } from "../_log.js";

function texto(v, max) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export async function onRequestGet({ env }) {
  const db = env.DB;
  const [faltando, comprados] = await Promise.all([
    db.prepare("SELECT * FROM lista_compras WHERE excluido_em IS NULL AND status = 'faltando' ORDER BY pedido_em DESC").all(),
    db.prepare(
      `SELECT l.*, c.valor AS valor, c.comprador AS comprador FROM lista_compras l
       LEFT JOIN custos c ON c.id = l.custo_id
       WHERE l.excluido_em IS NULL AND l.status = 'comprado' AND l.comprado_em >= datetime('now', '-60 days')
       ORDER BY l.comprado_em DESC LIMIT 50`
    ).all(),
  ]);
  return json({ faltando: faltando.results, comprados: comprados.results });
}

export async function onRequestPost({ request, env, data }) {
  let b;
  try { b = await request.json(); } catch { return erro("Corpo inválido"); }
  const produto = texto(b.produto, 120);
  if (!produto) return erro("Informe o produto");

  // evita o mesmo produto duas vezes na lista
  const existente = await env.DB.prepare(
    "SELECT * FROM lista_compras WHERE excluido_em IS NULL AND status = 'faltando' AND lower(produto) = lower(?)"
  ).bind(produto).first();
  if (existente) return json({ item: existente, jaNaLista: true });

  const item = await env.DB.prepare(
    `INSERT INTO lista_compras (produto, quantidade, observacao, pedido_por, pedido_nome)
     VALUES (?, ?, ?, ?, ?) RETURNING *`
  ).bind(produto, texto(b.quantidade, 40), texto(b.observacao, 500), data.usuario?.email || null, texto(b.nome, 60) || data.usuario?.nome || null).first();

  await registrarLog(env, request, {
    email: data.usuario?.email, acao: "lista_adicionar", entidade: "lista", entidadeId: item.id,
    detalhes: { produto: item.produto, quantidade: item.quantidade },
  });
  return json({ item }, 201);
}
