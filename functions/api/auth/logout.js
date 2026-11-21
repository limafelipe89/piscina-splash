// GET /api/auth/logout → apaga a sessão e volta para o início
import { cookie, redirecionar, lerSessao, COOKIE_SESSAO } from "../_auth.js";
import { garantirBanco } from "../_db.js";
import { registrarLog } from "../_log.js";

export async function onRequestGet({ request, env }) {
  try {
    if (env.DB) {
      await garantirBanco(env);
      const usuario = await lerSessao(request, env);
      if (usuario) await registrarLog(env, request, { email: usuario.email, acao: "logout" });
    }
  } catch (e) {
    console.error(e);
  }
  return redirecionar("/", [cookie(COOKIE_SESSAO, "", 0)]);
}
