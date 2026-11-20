// Login com Google (OAuth 2.0 / OpenID Connect) e sessão em cookie assinado.
//
// Variáveis no Cloudflare Pages:
//   GOOGLE_CLIENT_ID      ID do cliente OAuth (Google Cloud)
//   GOOGLE_CLIENT_SECRET  segredo do cliente OAuth (tipo Secret)
//   ALLOWED_EMAILS        e-mails autorizados, separados por vírgula
//   SESSION_SECRET        opcional; se ausente, usa GOOGLE_CLIENT_SECRET para assinar a sessão

export const COOKIE_SESSAO = "piscina_sessao";
export const COOKIE_OAUTH = "piscina_oauth";
const DURACAO_SESSAO = 60 * 60 * 24 * 30; // 30 dias

const enc = new TextEncoder();
const dec = new TextDecoder();

export function googleAtivo(env) {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/* ---------- base64url ---------- */
export function b64url(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function deB64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
export function aleatorio(n = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

/* ---------- cookies ---------- */
export function lerCookie(request, nome) {
  const header = request.headers.get("Cookie") || "";
  for (const parte of header.split(";")) {
    const i = parte.indexOf("=");
    if (i > -1 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim();
  }
  return null;
}
export function cookie(nome, valor, maxAge, caminho = "/") {
  return `${nome}=${valor}; Path=${caminho}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

/* ---------- assinatura HMAC ---------- */
async function chave(env) {
  const segredo = env.SESSION_SECRET || env.GOOGLE_CLIENT_SECRET || "";
  return crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function criarSessao(env, usuario) {
  const dados = { ...usuario, exp: Math.floor(Date.now() / 1000) + DURACAO_SESSAO };
  const corpo = b64url(enc.encode(JSON.stringify(dados)));
  const assinatura = await crypto.subtle.sign("HMAC", await chave(env), enc.encode(corpo));
  return { valor: `${corpo}.${b64url(assinatura)}`, maxAge: DURACAO_SESSAO };
}

export async function lerSessao(request, env) {
  const valor = lerCookie(request, COOKIE_SESSAO);
  if (!valor) return null;
  const [corpo, assinatura] = valor.split(".");
  if (!corpo || !assinatura) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await chave(env), deB64url(assinatura), enc.encode(corpo));
    if (!ok) return null;
    const dados = JSON.parse(dec.decode(deB64url(corpo)));
    if (!dados.exp || dados.exp < Date.now() / 1000) return null;
    if (!emailPermitido(env, dados.email)) return null; // remover da lista corta o acesso na hora
    return { email: dados.email, nome: dados.nome, foto: dados.foto };
  } catch {
    return null;
  }
}

/* ---------- lista de autorizados ---------- */
export function emailPermitido(env, email) {
  if (!email) return false;
  const lista = String(env.ALLOWED_EMAILS || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(String(email).toLowerCase());
}

/* ---------- PKCE ---------- */
export async function desafioPKCE(verificador) {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(verificador));
  return b64url(hash);
}

/* ---------- id_token ---------- */
// O id_token chega direto do endpoint de token do Google por HTTPS (troca do código
// feita pelo servidor), então dispensa verificar a assinatura; conferimos as claims.
export function lerIdToken(idToken, clientId) {
  const partes = String(idToken || "").split(".");
  if (partes.length !== 3) throw new Error("id_token inválido");
  const c = JSON.parse(dec.decode(deB64url(partes[1])));
  if (c.aud !== clientId) throw new Error("aud inválido");
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") throw new Error("iss inválido");
  if (!c.exp || c.exp < Date.now() / 1000) throw new Error("token expirado");
  if (c.email_verified !== true && c.email_verified !== "true") throw new Error("e-mail não verificado");
  return { email: String(c.email).toLowerCase(), nome: c.name || c.given_name || c.email, foto: c.picture || null };
}

export function redirecionar(destino, cookies = []) {
  const h = new Headers({ Location: destino, "Cache-Control": "no-store" });
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}
