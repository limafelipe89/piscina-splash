// Roda antes de todas as rotas /api/*:
// 1) controle de acesso:
//    - com GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET: exige login Google de um e-mail em ALLOWED_EMAILS;
//    - senão, com ACCESS_CODE: exige o código no cabeçalho X-Access-Code;
//    - senão: aberto.
// 2) garante que a tabela exista no D1.
import { SCHEMA, INDICE, MIGRACOES, erro } from "./_lib.js";
import { googleAtivo, lerSessao } from "./_auth.js";

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

async function prepararBanco(db) {
  await db.batch([db.prepare(SCHEMA), db.prepare(INDICE)]);
  for (const sql of MIGRACOES) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e.message || e))) throw e;
    }
  }
}

export async function onRequest(context) {
  const { request, env, next, data } = context;
  const caminho = new URL(request.url).pathname;

  // rotas de login ficam livres
  if (caminho.startsWith("/api/auth/")) return next();

  if (googleAtivo(env)) {
    const usuario = await lerSessao(request, env);
    if (!usuario) return erro("Faça login com o Google", 401);
    data.usuario = usuario;
  } else if (env.ACCESS_CODE) {
    const enviado = request.headers.get("X-Access-Code") || "";
    if (!iguais(enviado, String(env.ACCESS_CODE))) return erro("Código de acesso inválido", 401);
  }

  if (!env.DB) {
    return erro("Banco de dados não configurado: crie o binding D1 com o nome DB no Cloudflare Pages.", 500);
  }

  try {
    if (!tabelaPronta) {
      await prepararBanco(env.DB);
      tabelaPronta = true;
    }
    return await next();
  } catch (e) {
    console.error(e);
    return erro("Erro interno no servidor", 500);
  }
}
