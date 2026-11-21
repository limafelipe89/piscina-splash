// Validação dos lançamentos de custos.

function texto(v, max) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export function validarCusto(b) {
  if (!b || typeof b !== "object") throw new Error("Corpo inválido");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.data || "")) throw new Error("Data inválida");
  const comprador = texto(b.comprador, 60);
  if (!comprador) throw new Error("Informe quem fez a compra");
  const produto = texto(b.produto, 120);
  if (!produto) throw new Error("Informe o produto");
  let valor = b.valor;
  if (typeof valor !== "number") {
    const s = String(valor ?? "").replace(/[R$\s]/g, "");
    valor = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  }
  if (!Number.isFinite(valor) || valor <= 0 || valor > 1000000) throw new Error("Informe um valor válido");
  return {
    client_id: typeof b.client_id === "string" && /^[0-9a-f-]{8,64}$/i.test(b.client_id) ? b.client_id : null,
    data: b.data,
    comprador,
    produto,
    quantidade: texto(b.quantidade, 40),
    valor: Math.round(valor * 100) / 100,
    loja: texto(b.loja, 80),
    observacoes: texto(b.observacoes, 1000),
  };
}
