// Entrada do Cloudflare Worker.
// - /api/*  → mesmas rotas de functions/api (reaproveitadas aqui)
// - resto   → arquivos estáticos de public/ (binding ASSETS)
import { onRequest as middleware } from "../functions/api/_middleware.js";
import * as registros from "../functions/api/registros/index.js";
import * as registroId from "../functions/api/registros/[id].js";
import * as login from "../functions/api/auth/login.js";
import * as callback from "../functions/api/auth/callback.js";
import * as me from "../functions/api/auth/me.js";
import * as logout from "../functions/api/auth/logout.js";

const ROTAS = [
  [/^\/api\/registros\/?$/, registros, []],
  [/^\/api\/registros\/([^/]+)\/?$/, registroId, ["id"]],
  [/^\/api\/auth\/login\/?$/, login, []],
  [/^\/api\/auth\/callback\/?$/, callback, []],
  [/^\/api\/auth\/me\/?$/, me, []],
  [/^\/api\/auth\/logout\/?$/, logout, []],
];

function respostaJson(dados, status) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function acharRota(pathname, metodo) {
  for (const [regex, modulo, nomes] of ROTAS) {
    const m = pathname.match(regex);
    if (!m) continue;
    const params = Object.fromEntries(nomes.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
    const nome = "onRequest" + metodo.charAt(0) + metodo.slice(1).toLowerCase();
    return { handler: modulo[nome] || modulo.onRequest || null, params, existe: true };
  }
  return { handler: null, params: {}, existe: false };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const { handler, params, existe } = acharRota(url.pathname, request.method);
    const context = {
      request,
      env,
      params,
      data: {},
      waitUntil: ctx.waitUntil.bind(ctx),
    };
    context.next = async () => {
      if (!existe) return respostaJson({ erro: "Rota não encontrada" }, 404);
      if (!handler) return respostaJson({ erro: "Método não permitido" }, 405);
      return handler(context);
    };
    return middleware(context);
  },
};
