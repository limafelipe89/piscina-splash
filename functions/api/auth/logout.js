// GET /api/auth/logout → apaga a sessão e volta para o início
import { cookie, redirecionar, COOKIE_SESSAO } from "../_auth.js";

export function onRequestGet() {
  return redirecionar("/", [cookie(COOKIE_SESSAO, "", 0)]);
}
