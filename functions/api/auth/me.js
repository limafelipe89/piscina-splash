// GET /api/auth/me → diz ao app qual modo de acesso está ativo e quem está logado
import { googleAtivo, lerSessao } from "../_auth.js";
import { json } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  if (googleAtivo(env)) {
    return json({ modo: "google", usuario: await lerSessao(request, env) });
  }
  return json({ modo: env.ACCESS_CODE ? "codigo" : "aberto", usuario: null });
}
