// Só administradores (ADMIN_EMAILS).
// GET  /api/acessos                          → lista pedidos e membros
// POST /api/acessos { email, acao }          → acao: "aprovar" | "recusar" | "remover"
//   aprovar um e-mail que nunca pediu acesso já o deixa liberado (convite).
import { json, erro } from "../_lib.js";
import { ehAdmin, ehFixo, listaAdmins, listaFixos } from "../_auth.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function soAdmin(data) {
  return data.usuario && data.usuario.admin;
}

export async function onRequestGet({ env, data }) {
  if (!soAdmin(data)) return erro("Apenas o administrador pode ver os acessos", 403);
  const { results } = await env.DB.prepare(
    `SELECT email, nome, foto, status, solicitado_em, decidido_em, decidido_por, ultimo_acesso
     FROM acessos
     ORDER BY CASE status WHEN 'pendente' THEN 0 WHEN 'aprovado' THEN 1 ELSE 2 END, solicitado_em DESC`
  ).all();
  return json({ acessos: results, admins: listaAdmins(env), fixos: listaFixos(env) });
}

export async function onRequestPost({ request, env, data }) {
  if (!soAdmin(data)) return erro("Apenas o administrador pode liberar acessos", 403);

  let corpo;
  try { corpo = await request.json(); } catch { return erro("Corpo inválido"); }
  const email = String(corpo.email || "").trim().toLowerCase();
  const acao = corpo.acao;
  if (!EMAIL_RE.test(email) || email.length > 254) return erro("E-mail inválido");
  if (!["aprovar", "recusar", "remover"].includes(acao)) return erro("Ação inválida");
  if (ehAdmin(env, email)) return erro("Administradores não podem ser alterados por aqui");
  if (ehFixo(env, email)) return erro("Este e-mail está liberado na variável ALLOWED_EMAILS do Cloudflare; tire de lá para remover");

  const quem = data.usuario.email;
  const db = env.DB;

  if (acao === "remover") {
    const r = await db.prepare("DELETE FROM acessos WHERE email = ?").bind(email).run();
    return r.meta.changes ? json({ ok: true }) : erro("E-mail não encontrado", 404);
  }

  const status = acao === "aprovar" ? "aprovado" : "recusado";
  await db.prepare(
    `INSERT INTO acessos (email, status, decidido_em, decidido_por)
     VALUES (?, ?, datetime('now'), ?)
     ON CONFLICT(email) DO UPDATE SET status = excluded.status, decidido_em = excluded.decidido_em, decidido_por = excluded.decidido_por`
  ).bind(email, status, quem).run();
  return json({ ok: true, email, status });
}
