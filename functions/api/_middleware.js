// Roda antes de todas as rotas /api/*:
// 1) controle de acesso:
//    - com GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET: exige login Google de um administrador
//      (ADMIN_EMAILS) ou de um membro aprovado na tabela `acessos`;
//    - senão, com ACCESS_CODE: exige o código no cabeçalho X-Access-Code;
//    - senão: aberto.
// 2) garante que a tabela exista no D1.
import { erro } from "./_lib.js";
import { googleAtivo, lerSessao } from "./_auth.js";
import { garantirBanco } from "./_db.js";

function iguais(a, b) {
  // comparação em tempo constante
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let dif = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) dif |= (ea[i] || 0) ^ (eb[i] || 0);
  return dif === 0;
}

export async function onRequest(context) {
  const { request, env, next, data } = context;
  const caminho = new URL(request.url).pathname;

  // rotas de login ficam livres
  if (caminho.startsWith("/api/auth/")) return next();

  if (!env.DB) {
    return erro("Banco de dados não configurado: crie o binding D1 com o nome DB.", 500);
  }
  try {
    await garantirBanco(env);
  } catch (e) {
    console.error(e);
    return erro("Erro ao preparar o banco de dados", 500);
  }

  if (googleAtivo(env)) {
    const usuario = await lerSessao(request, env);
    if (!usuario) return erro("Faça login com o Google", 401);
    data.usuario = usuario;
  } else if (env.ACCESS_CODE) {
    const enviado = request.headers.get("X-Access-Code") || "";
    if (!iguais(enviado, String(env.ACCESS_CODE))) return erro("Código de acesso inválido", 401);
  }

  try {
    return await next();
  } catch (e) {
    console.error(e);
    return erro("Erro interno no servidor", 500);
  }
}
