// GET /api/logs?antes=<id>&limite=100&email=  → atividades (só administrador), mais recentes primeiro
import { json, erro } from "../_lib.js";

export async function onRequestGet({ request, env, data }) {
  if (!(data.usuario && data.usuario.admin)) return erro("Apenas o administrador pode ver as atividades", 403);
  const url = new URL(request.url);
  const limite = Math.min(Math.max(parseInt(url.searchParams.get("limite") || "100", 10) || 100, 1), 500);
  const antes = parseInt(url.searchParams.get("antes") || "0", 10) || 0;
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();

  const cond = [];
  const params = [];
  if (antes > 0) { cond.push("id < ?"); params.push(antes); }
  if (email) { cond.push("email = ?"); params.push(email); }
  const sql = `SELECT id, quando, email, acao, entidade, entidade_id, detalhes FROM logs
    ${cond.length ? "WHERE " + cond.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`;
  params.push(limite);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  const logs = results.map((l) => {
    let detalhes = null;
    try { detalhes = l.detalhes ? JSON.parse(l.detalhes) : null; } catch { detalhes = l.detalhes; }
    return { ...l, detalhes };
  });
  return json({ logs, mais: logs.length === limite ? logs[logs.length - 1].id : null });
}
