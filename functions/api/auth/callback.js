// GET /api/auth/callback → o Google volta aqui com ?code=…&state=…
import {
  googleAtivo, lerCookie, cookie, redirecionar, lerIdToken, emailPermitido, criarSessao,
  COOKIE_OAUTH, COOKIE_SESSAO,
} from "../_auth.js";

export async function onRequestGet({ request, env }) {
  if (!googleAtivo(env)) return redirecionar("/?erro=google_nao_configurado");

  const url = new URL(request.url);
  const limpar = cookie(COOKIE_OAUTH, "", 0, "/api/auth");
  const falha = (motivo) => redirecionar(`/?erro=${motivo}`, [limpar]);

  if (url.searchParams.get("error")) return falha("login_cancelado");

  const [estadoSalvo, verificador] = (lerCookie(request, COOKIE_OAUTH) || "").split(".");
  const estado = url.searchParams.get("state");
  const codigo = url.searchParams.get("code");
  if (!estadoSalvo || !verificador || !codigo || estado !== estadoSalvo) return falha("login_expirado");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/callback`,
      grant_type: "authorization_code",
      code_verifier: verificador,
    }),
  });
  if (!resp.ok) {
    console.error("Falha na troca do código", resp.status, await resp.text());
    return falha("login_falhou");
  }

  let usuario;
  try {
    usuario = lerIdToken((await resp.json()).id_token, env.GOOGLE_CLIENT_ID);
  } catch (e) {
    console.error("id_token rejeitado", e.message);
    return falha("login_falhou");
  }

  if (!emailPermitido(env, usuario.email)) {
    return falha(`nao_autorizado&email=${encodeURIComponent(usuario.email)}`);
  }

  const sessao = await criarSessao(env, usuario);
  return redirecionar("/#inicio", [limpar, cookie(COOKIE_SESSAO, sessao.valor, sessao.maxAge)]);
}
