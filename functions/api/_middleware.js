// Roda antes de todas as rotas /api/*:
// 1) confere o código de acesso (se a variável ACCESS_CODE estiver configurada);
// 2) garante que a tabela exista no D1.
import { SCHEMA, INDICE, erro } from "./_lib.js";

let tabelaPronta = false;

function iguais(a, b) {
  // comparação em tempo constante
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let dif = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) dif |= (ea[i] || 0) ^ (eb[i] || 0);
  return dif === 0;
}

export async function onRequest({ request, env, next }) {
  if (env.ACCESS_CODE) {
    const enviado = request.headers.get("X-Access-Code") || "";
    if (!iguais(enviado, String(env.ACCESS_CODE))) return erro("Código de acesso inválido", 401);
  }

  if (!env.DB) {
    return erro("Banco de dados não configurado: crie o binding D1 com o nome DB no Cloudflare Pages.", 500);
  }

  if (!tabelaPronta) {
    await env.DB.batch([env.DB.prepare(SCHEMA), env.DB.prepare(INDICE)]);
    tabelaPronta = true;
  }

  try {
    return await next();
  } catch (e) {
    console.error(e);
    return erro("Erro interno no servidor", 500);
  }
}
