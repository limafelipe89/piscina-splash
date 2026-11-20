// GET /api/auth/login → redireciona para a tela de login do Google
import { googleAtivo, aleatorio, desafioPKCE, cookie, redirecionar, COOKIE_OAUTH } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  if (!googleAtivo(env)) return redirecionar("/?erro=google_nao_configurado");

  const origem = new URL(request.url).origin;
  const estado = aleatorio(24);
  const verificador = aleatorio(48);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origem}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state: estado,
    code_challenge: await desafioPKCE(verificador),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  return redirecionar(url.toString(), [cookie(COOKIE_OAUTH, `${estado}.${verificador}`, 600, "/api/auth")]);
}
