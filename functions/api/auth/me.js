// GET /api/auth/me → diz ao app qual modo de acesso está ativo e quem está logado
import { googleAtivo, lerSessao } from "../_auth.js";
import { garantirBanco } from "../_db.js";
import { json } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  if (!googleAtivo(env)) {
    return json({ modo: env.ACCESS_CODE ? "codigo" : "aberto", usuario: null });
  }
  await garantirBanco(env);
  const usuario = await lerSessao(request, env);
  let pendentes = 0;
  if (usuario && usuario.admin) {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM acessos WHERE status = 'pendente'").first();
    pendentes = r ? r.n : 0;
  }
  return json({ modo: "google", usuario, pendentes });
}
