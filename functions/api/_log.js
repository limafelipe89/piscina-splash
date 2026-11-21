// Log de ações dos usuários (tabela `logs`) e regra de exclusão.
import { googleAtivo } from "./_auth.js";

// Registra uma ação. Nunca derruba a requisição se o log falhar.
export async function registrarLog(env, request, { email, acao, entidade = null, entidadeId = null, detalhes = null }) {
  try {
    const ip = request?.headers.get("CF-Connecting-IP") || null;
    const agente = (request?.headers.get("User-Agent") || "").slice(0, 200) || null;
    await env.DB.prepare(
      `INSERT INTO logs (email, acao, entidade, entidade_id, detalhes, ip, agente)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      email || null, acao, entidade, entidadeId === null ? null : String(entidadeId),
      detalhes ? JSON.stringify(detalhes).slice(0, 4000) : null, ip, agente
    ).run();
  } catch (e) {
    console.error("Falha ao gravar log", acao, e);
  }
}

// Campos que mudaram entre a linha antiga e a nova: { campo: [antes, depois] }
export function diferencas(antes, depois, campos) {
  const mudou = {};
  for (const c of campos) {
    const a = antes?.[c] ?? null;
    const d = depois?.[c] ?? null;
    if (String(a) !== String(d)) mudou[c] = [a, d];
  }
  return mudou;
}

// Só quem criou pode excluir. Registros antigos sem criador: só o administrador.
// Sem login Google (modo código/aberto) não há identidade, então a exclusão fica liberada.
export function podeExcluir(env, usuario, linha) {
  if (!googleAtivo(env)) return true;
  if (!usuario) return false;
  if (linha.criado_por) return linha.criado_por.toLowerCase() === usuario.email.toLowerCase();
  return !!usuario.admin;
}
