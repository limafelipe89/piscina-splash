"use strict";

/* =========================================================
   Configuração
   ========================================================= */
// Lista única do que foi feito. IDs são estáveis: não renomeie um id, só o texto.
const TAREFAS = [
  ["detritos", "Tirei folhas e sujeira da água"],
  ["escovar", "Escovei paredes e fundo"],
  ["bordas", "Limpei as bordas"],
  ["aspirar", "Aspirei o fundo"],
  ["filtro", "Limpei o cesto e o filtro"],
  ["dosador", "Conferi as pastilhas no dosador"],
  ["corrigir", "Coloquei produto para corrigir a água"],
  ["circulacao", "Bomba e aquecimento funcionando"],
];

// Tarefas da versão anterior (só para mostrar registros antigos no histórico).
const TAREFAS_ANTIGAS = {
  aspecto: "Observei cor, transparência e limo", medir_cloro_ph: "Medi cloro e pH", medir_alc: "Medi alcalinidade",
  corrigir_ph: "Corrigi pH/alcalinidade", corrigir_cloro: "Corrigi o cloro", cloro_faixa: "Cloro conferido antes do banho",
  ph_faixa: "pH conferido antes do banho", transparente: "Água transparente", sem_limo: "Sem limo nas paredes",
  corrigido: "Corrigido e aguardado o tempo do rótulo", remedido: "Medido novamente", uso_intenso: "Análises repetidas após uso intenso",
  residuos: "Retirei resíduos", filtrar: "Deixei filtrar", remedir: "Medi de novo após uso", registrar: "Anotei alterações na água",
};
const NOME_TAREFA = { ...TAREFAS_ANTIGAS, ...Object.fromEntries(TAREFAS) };

const LS = {
  codigo: "piscina.codigo",
  cache: "piscina.cache",
  pendentes: "piscina.pendentes",
  responsavel: "piscina.responsavel",
  acesso: "piscina.acesso",
  custos: "piscina.custos",
  lista: "piscina.lista",
};

/* =========================================================
   Avaliação das medições
   ========================================================= */
function avaliar(param, v) {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  switch (param) {
    case "cloro":
      if (v < 2) return { nivel: "fora", texto: "Baixo — não liberar banho" };
      if (v > 5) return { nivel: "atencao", texto: "Alto — confira o rótulo" };
      return { nivel: "ok", texto: "Bom" };
    case "ph":
      if (v >= 7.2 && v <= 7.6) return { nivel: "ok", texto: "Bom (7,2 a 7,6)" };
      if (v >= 7.0 && v <= 7.8) return { nivel: "atencao", texto: v < 7.2 ? "Um pouco baixo" : "Um pouco alto" };
      return { nivel: "fora", texto: v < 7.0 ? "Muito baixo — corrigir" : "Muito alto — corrigir" };
    case "alcalinidade":
      if (v >= 80 && v <= 120) return { nivel: "ok", texto: "Boa (80 a 120)" };
      if (v >= 60 && v <= 150) return { nivel: "atencao", texto: v < 80 ? "Baixa" : "Alta" };
      return { nivel: "fora", texto: v < 60 ? "Muito baixa" : "Muito alta" };
    case "temperatura":
      return { nivel: "", texto: "" };
  }
  return null;
}

const ROTULOS = {
  cloro: ["Cloro", "ppm"],
  ph: ["pH", ""],
  alcalinidade: ["Alcalinidade", "ppm"],
  temperatura: ["Temperatura", "°C"],
};

/* =========================================================
   Utilidades
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function num(txt) {
  if (txt === null || txt === undefined) return null;
  const s = String(txt).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function lerValorBR(txt) {
  const s = String(txt || "").replace(/[R$\s]/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : NaN;
}
function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
function brl(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function hojeISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function horaAgora() {
  return new Date().toTimeString().slice(0, 5);
}
function dataBR(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return new Date(+a, +m - 1, +d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}
function dataCurta(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function dataHoraBR(sqlUTC) {
  if (!sqlUTC) return "";
  const d = new Date(sqlUTC.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? sqlUTC : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function diasDesde(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  return Math.round((new Date(new Date().toDateString()) - new Date(a, m - 1, d)) / 86400000);
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function lerLS(k, padrao) {
  try { const v = localStorage.getItem(k); return v === null ? padrao : JSON.parse(v); } catch { return padrao; }
}
function gravarLS(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ }
}
function baixarCSV(nome, linhas) {
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function celCSV(v) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

/* =========================================================
   API
   ========================================================= */
class ErroRede extends Error {}

let pedindoCodigo = null;
function pedirCodigo() {
  if (pedindoCodigo) return pedindoCodigo;
  pedindoCodigo = new Promise((resolve) => {
    const dlg = $("#dialogo-acesso");
    const input = $("#codigo-acesso");
    input.value = "";
    dlg.showModal();
    setTimeout(() => input.focus(), 50);
    dlg.addEventListener("close", function fechar() {
      dlg.removeEventListener("close", fechar);
      pedindoCodigo = null;
      const cod = input.value.trim();
      if (cod) gravarLS(LS.codigo, cod);
      resolve(!!cod);
    });
  });
  return pedindoCodigo;
}

async function api(caminho, opcoes = {}, tentativa = 0) {
  const headers = { "Content-Type": "application/json", ...(opcoes.headers || {}) };
  const cod = lerLS(LS.codigo, "");
  if (cod) headers["X-Access-Code"] = cod;
  let resp;
  try {
    resp = await fetch(caminho, { ...opcoes, headers });
  } catch {
    throw new ErroRede("Sem conexão");
  }
  if (resp.status === 401 && acesso.modo === "google") {
    mostrarLogin("Sua sessão expirou. Entre novamente.");
    throw new Error("Faça login para continuar");
  }
  if (resp.status === 401 && tentativa < 3) {
    if (cod) $("#erro-acesso").hidden = false;
    const ok = await pedirCodigo();
    if (!ok) throw new Error("Acesso não autorizado");
    $("#erro-acesso").hidden = true;
    return api(caminho, opcoes, tentativa + 1);
  }
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || `Erro ${resp.status}`);
  return dados;
}

function erroAmigavel(e) {
  return e instanceof ErroRede ? "Sem internet. Tente de novo quando conectar." : e.message;
}

/* =========================================================
   Acesso (login Google)
   ========================================================= */
let acesso = lerLS(LS.acesso, { modo: null, usuario: null });

const ERROS_LOGIN = {
  nao_autorizado: "Este e-mail não está autorizado.",
  aguardando: "Pedido de acesso enviado. Assim que for liberado, toque em Entrar com Google de novo.",
  recusado: "Seu acesso não foi liberado.",
  login_cancelado: "Login cancelado.",
  login_expirado: "O login demorou demais. Tente de novo.",
  login_falhou: "Não foi possível entrar. Tente de novo.",
  google_nao_configurado: "O login com Google ainda não foi configurado.",
};

const ehAdmin = () => !!(acesso.usuario && acesso.usuario.admin);
const meuEmail = () => (acesso.usuario && acesso.usuario.email ? acesso.usuario.email.toLowerCase() : null);

// Mesma regra do servidor: só quem criou exclui (antigos sem criador: administrador).
function possoExcluir(criadoPor) {
  if (acesso.modo !== "google") return true;
  if (!meuEmail()) return false;
  if (criadoPor) return criadoPor.toLowerCase() === meuEmail();
  return ehAdmin();
}

function mostrarLogin(msg) {
  const erro = $("#login-erro");
  erro.hidden = !msg;
  erro.textContent = msg || "";
  $("#tela-login").hidden = false;
}

function renderUsuario() {
  const u = acesso.usuario;
  const botao = $("#botao-usuario");
  if (!u) { botao.hidden = true; $("#menu-usuario").hidden = true; renderPedidosAcesso(); return; }
  botao.hidden = false;
  $("#usuario-nome").textContent = u.nome || "";
  $("#usuario-email").textContent = u.email || "";
  const foto = $("#usuario-foto");
  const inicial = (u.nome || u.email || "?")[0].toUpperCase();
  if (u.foto) {
    foto.src = u.foto;
    foto.hidden = false;
    $("#usuario-inicial").textContent = "";
    foto.onerror = () => { foto.hidden = true; $("#usuario-inicial").textContent = inicial; };
  } else {
    foto.hidden = true;
    $("#usuario-inicial").textContent = inicial;
  }
  $("#botao-atividades").hidden = !ehAdmin();
  renderPedidosAcesso();
}

function renderPedidosAcesso() {
  const n = ehAdmin() ? Number(acesso.pendentes || 0) : 0;
  $("#botao-acessos").hidden = !ehAdmin();
  $("#botao-acessos").textContent = n ? `Gerenciar acessos (${n})` : "Gerenciar acessos";
  const badge = $("#usuario-badge");
  badge.hidden = !n;
  badge.textContent = n;
  const aviso = $("#aviso-acessos");
  aviso.hidden = !n;
  aviso.textContent = n === 1 ? "1 pessoa pediu acesso. Toque para liberar ou recusar." : `${n} pessoas pediram acesso. Toque para liberar ou recusar.`;
}

async function verificarAcesso() {
  const params = new URLSearchParams(location.search);
  const erroURL = params.get("erro");
  if (erroURL) history.replaceState(null, "", location.pathname + location.hash);

  try {
    const r = await fetch("/api/auth/me", { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error();
    acesso = await r.json();
    gravarLS(LS.acesso, acesso);
  } catch {
    // sem internet: segue com o último estado conhecido
  }
  renderUsuario();

  if (acesso.modo === "google" && !acesso.usuario) {
    let msg = ERROS_LOGIN[erroURL] || "";
    const emailURL = params.get("email");
    if (erroURL === "aguardando" && emailURL) msg = `Pedido de acesso de ${emailURL} enviado. Assim que for liberado, toque em Entrar com Google de novo.`;
    else if (erroURL === "recusado" && emailURL) msg = `O acesso de ${emailURL} não foi liberado.`;
    registros = []; custos = []; lista = { faltando: [], comprados: [] };
    gravarLS(LS.cache, []); gravarLS(LS.custos, []); gravarLS(LS.lista, lista);
    mostrarLogin(msg);
    return false;
  }
  $("#tela-login").hidden = true;
  return true;
}

/* =========================================================
   Estado e carregamento
   ========================================================= */
let registros = lerLS(LS.cache, []);
let pendentes = lerLS(LS.pendentes, []);
let custos = lerLS(LS.custos, []);
let lista = lerLS(LS.lista, { faltando: [], comprados: [] });

function todosRegistros() {
  const pend = pendentes.map((p) => ({ ...p, _pendente: true }));
  return [...pend, ...registros].sort((a, b) =>
    (b.data + (b.hora || "")).localeCompare(a.data + (a.hora || "")) || (b.id || 0) - (a.id || 0)
  );
}

async function carregar() {
  try {
    const [r, c, l] = await Promise.all([api("/api/registros?limite=500"), api("/api/custos"), api("/api/lista")]);
    registros = r.registros || [];
    custos = c.custos || [];
    lista = { faltando: l.faltando || [], comprados: l.comprados || [] };
    gravarLS(LS.cache, registros);
    gravarLS(LS.custos, custos);
    gravarLS(LS.lista, lista);
  } catch (e) {
    if (!(e instanceof ErroRede)) toast(e.message);
  }
  renderTudo();
}

async function sincronizar() {
  if (!pendentes.length) return;
  const restantes = [];
  for (const p of pendentes) {
    try {
      await api("/api/registros", { method: "POST", body: JSON.stringify(p) });
    } catch (e) {
      restantes.push(p);
    }
  }
  const enviados = pendentes.length - restantes.length;
  pendentes = restantes;
  gravarLS(LS.pendentes, pendentes);
  if (enviados) toast(`${enviados} registro(s) enviado(s)`);
}

/* =========================================================
   Navegação (tela inicial com botões + botão Voltar)
   ========================================================= */
const TITULOS = {
  inicio: "Início", registrar: "Registrar", sucesso: "Pronto", faltando: "Está acabando", comprei: "Comprei",
  gastos: "Gastos", historico: "Histórico", guia: "Guia", acessos: "Acessos", atividades: "Atividades",
};
const SO_ADMIN = ["acessos", "atividades"];
let abaAtual = "inicio";

function irPara(aba, { rolar = true } = {}) {
  if (!TITULOS[aba]) aba = "inicio";
  if (SO_ADMIN.includes(aba) && !ehAdmin()) aba = "inicio";
  abaAtual = aba;
  $$(".aba").forEach((s) => (s.hidden = s.id !== `aba-${aba}`));
  $("#titulo-aba").textContent = TITULOS[aba];
  $("#botao-voltar").hidden = aba === "inicio";
  renderSaudacao();
  if (location.hash !== `#${aba}`) history.replaceState(null, "", `#${aba}`);
  if (rolar) window.scrollTo({ top: 0 });
  if (aba === "acessos") carregarAcessos();
  if (aba === "atividades") carregarAtividades(true);
}

function primeiroNome() {
  const n = (acesso.usuario && acesso.usuario.nome) || lerLS(LS.responsavel, "") || "";
  return n.split(" ")[0];
}
function renderSaudacao() {
  const nome = primeiroNome();
  $("#topo-sub").textContent = abaAtual === "inicio" && nome ? `Olá, ${nome}` : "Piscina Splash";
}

/* =========================================================
   Início
   ========================================================= */
function vereditoMedicao(r) {
  const tem = (v) => v !== null && v !== undefined;
  if (!r || (!tem(r.cloro) && !tem(r.ph))) return null;
  const NOME = { cloro: "o cloro", ph: "o pH" };
  const avs = ["cloro", "ph"].map((p) => [p, avaliar(p, r[p])]);
  const faltando = avs.filter(([, a]) => !a).map(([p]) => NOME[p]);
  const fora = avs.filter(([, a]) => a && a.nivel === "fora").map(([p]) => NOME[p]);
  const atenc = avs.filter(([, a]) => a && a.nivel === "atencao").map(([p]) => NOME[p]);
  const lista2 = (l) => l.join(" e ");
  if (fora.length) return { nivel: "fora", titulo: "Não liberar o banho", texto: `Corrija ${lista2(fora)} antes de usar a piscina. Veja como no Guia.` };
  if (faltando.length) return { nivel: "atencao", titulo: "Medição incompleta", texto: `Falta medir ${lista2(faltando)}.` };
  if (atenc.length) {
    const t = lista2(atenc);
    return { nivel: "atencao", titulo: "Precisa ajustar", texto: `${t[0].toUpperCase() + t.slice(1)} ${atenc.length > 1 ? "estão" : "está"} um pouco fora do ideal. Veja no Guia como corrigir.` };
  }
  return { nivel: "ok", titulo: "Pode liberar o banho", texto: "Cloro e pH estão bons." };
}

function renderInicio() {
  const lst = todosRegistros();
  const tem = (v) => v !== null && v !== undefined;
  const ultima = lst.find((r) => tem(r.cloro) || tem(r.ph));
  const box = $("#status-agua");
  const ver = vereditoMedicao(ultima);

  if (!ver) {
    box.className = "status-agua neutro";
    $("#status-titulo").textContent = "Ainda sem medição";
    $("#status-texto").textContent = "Toque em Registrar para anotar a medição.";
    $("#status-valores").textContent = "";
  } else {
    const dias = diasDesde(ultima.data);
    const quando = dias === 0 ? `hoje${ultima.hora ? " às " + ultima.hora : ""}` : dias === 1 ? "ontem" : `há ${dias} dias`;
    let { nivel, titulo, texto } = ver;
    if (dias >= 1 && nivel === "ok") { nivel = "atencao"; titulo = "Meça de novo antes do banho"; texto = `A última medição estava boa, mas foi ${quando}.`; }
    box.className = `status-agua ${nivel}`;
    $("#status-titulo").textContent = titulo;
    $("#status-texto").textContent = texto;
    const valores = ["cloro", "ph", "alcalinidade"].filter((p) => tem(ultima[p])).map((p) => `${ROTULOS[p][0]} ${fmt(ultima[p])}`).join(" · ");
    $("#status-valores").textContent = `${valores} — medido ${quando} por ${ultima.responsavel || "–"}`;
  }

  const nf = (lista.faltando || []).length;
  const badge = $("#badge-faltando");
  badge.hidden = !nf;
  badge.textContent = nf;

  const mes = hojeISO().slice(0, 7);
  const gastoMes = custos.filter((c) => (c.data || "").startsWith(mes)).reduce((s, c) => s + (Number(c.valor) || 0), 0);
  $("#tile-gasto").textContent = gastoMes ? `${brl(gastoMes)} este mês` : "Prestação de contas";

  const av = $("#pendentes-aviso");
  av.hidden = !pendentes.length;
  av.textContent = pendentes.length ? `${pendentes.length} registro(s) guardado(s) no celular, esperando internet para enviar.` : "";
  renderSaudacao();
}

/* =========================================================
   Registrar (3 passos)
   ========================================================= */
const form = () => $("#form");
let passoAtual = 1;

function mostrarPasso(n) {
  passoAtual = n;
  $$(".passo", form()).forEach((p) => (p.hidden = Number(p.dataset.passo) !== n));
  $$("[data-passo-ind]").forEach((s) => s.classList.toggle("feito", Number(s.dataset.passoInd) <= n));
  $("#passo-voltar").textContent = n === 1 ? "Cancelar" : "Voltar";
  $("#passo-proximo").hidden = n === 3;
  $("#botao-salvar").hidden = n !== 3;
  if (n === 3) {
    atualizarResumoQuem();
    // produto de limpar bordas só aparece se a limpeza das bordas foi marcada
    const bordas = !!$('input[name="tarefa"][value="bordas"]:checked', form());
    $('[data-produto="Limpa bordas"]', form()).hidden = !bordas;
  }
  window.scrollTo({ top: 0 });
}

function montarChipsValor() {
  $$(".chips-valor").forEach((box) => {
    box.innerHTML = box.dataset.valores.split(";").map((v) => `<button type="button" data-valor="${v}">${v}</button>`).join("");
  });
}

function sincronizarChips(medida) {
  const input = $("input", medida);
  const v = num(input.value);
  $$(".chips-valor button", medida).forEach((b) => b.classList.toggle("sel", v !== null && !Number.isNaN(v) && num(b.dataset.valor) === v));
}

function atualizarDica(input) {
  const campo = input.closest(".medida");
  if (!campo) return;
  const v = num(input.value);
  const dica = $(".dica", campo);
  campo.classList.remove("ok", "atencao", "fora");
  if (v === null) dica.textContent = "";
  else if (Number.isNaN(v)) { campo.classList.add("fora"); dica.textContent = "Número inválido"; }
  else {
    const av = avaliar(input.name, v);
    if (av && av.nivel) campo.classList.add(av.nivel);
    dica.textContent = av ? av.texto : "";
  }
  sincronizarChips(campo);
}

function renderTarefas(marcadas = []) {
  $("#lista-tarefas").innerHTML = TAREFAS.map(([id, txt]) => `
    <li><label>
      <input type="checkbox" name="tarefa" value="${id}" ${marcadas.includes(id) ? "checked" : ""}>
      <span>${esc(txt)}</span>
    </label></li>`).join("");
}

function nomePadrao() {
  return lerLS(LS.responsavel, "") || (acesso.usuario && acesso.usuario.nome) || "";
}

function atualizarResumoQuem() {
  const f = form();
  const quando = f.data.value === hojeISO() ? "hoje" : dataCurta(f.data.value);
  $("#quem-quando-resumo").textContent = `${f.responsavel.value || "Sem nome"} · ${quando}${f.hora.value ? " às " + f.hora.value : ""}`;
}

function novoRegistro() {
  const f = form();
  f.reset();
  f.id.value = "";
  f.data.value = hojeISO();
  f.hora.value = horaAgora();
  f.responsavel.value = nomePadrao();
  $("#editando-aviso").hidden = true;
  $(".mais-medida").open = false;
  $(".quem-quando", f).open = false;
  renderTarefas();
  $$(".medida input", f).forEach(atualizarDica);
  mostrarPasso(1);
}

function editarRegistro(r) {
  const f = form();
  f.reset();
  f.id.value = r.id;
  f.data.value = r.data;
  f.hora.value = r.hora || "";
  f.responsavel.value = r.responsavel || "";
  for (const k of ["cloro", "ph", "alcalinidade", "temperatura"]) {
    f[k].value = r[k] === null || r[k] === undefined ? "" : String(r[k]).replace(".", ",");
  }
  $(".mais-medida").open = r.alcalinidade !== null && r.alcalinidade !== undefined;
  f.produtos.value = r.produtos || "";
  f.observacoes.value = r.observacoes || "";
  renderTarefas(r.tarefas || []);
  $$(".medida input", f).forEach(atualizarDica);
  $("#editando-aviso").hidden = false;
  irPara("registrar");
  mostrarPasso(1);
}

function adicionarProduto(nome) {
  const ta = form().produtos;
  const atual = ta.value.trim();
  if (atual.toLowerCase().includes(nome.toLowerCase())) return;
  ta.value = atual ? `${atual}; ${nome}` : nome;
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

async function salvarRegistro(ev) {
  ev.preventDefault();
  if (passoAtual !== 3) return;
  const f = form();
  const dados = {
    tipo: "registro",
    data: f.data.value,
    hora: f.hora.value || null,
    responsavel: f.responsavel.value.trim(),
    tarefas: $$('input[name="tarefa"]:checked', f).map((c) => c.value),
    produtos: f.produtos.value.trim() || null,
    observacoes: f.observacoes.value.trim() || null,
  };
  for (const k of ["cloro", "ph", "alcalinidade", "temperatura"]) {
    const v = num(f[k].value);
    if (Number.isNaN(v)) { mostrarPasso(1); return toast(`Valor inválido em ${ROTULOS[k][0]}`); }
    dados[k] = v;
  }
  if (!dados.responsavel || !dados.data) { $(".quem-quando", f).open = true; return toast("Informe quem fez e a data"); }
  const vazio = dados.cloro === null && dados.ph === null && dados.alcalinidade === null && !dados.tarefas.length && !dados.produtos && !dados.observacoes;
  if (vazio) { mostrarPasso(1); return toast("Preencha a medição ou marque o que foi feito"); }
  gravarLS(LS.responsavel, dados.responsavel);

  const editando = !!f.id.value;
  const botao = $("#botao-salvar");
  botao.disabled = true;
  let offline = false;
  try {
    if (editando) {
      await api(`/api/registros/${f.id.value}`, { method: "PUT", body: JSON.stringify(dados) });
    } else {
      dados.client_id = uuid();
      try {
        await api("/api/registros", { method: "POST", body: JSON.stringify(dados) });
      } catch (e) {
        if (!(e instanceof ErroRede)) throw e;
        pendentes.push(dados);
        gravarLS(LS.pendentes, pendentes);
        offline = true;
      }
    }
    mostrarSucesso(dados, { editando, offline });
    novoRegistro();
    carregar();
  } catch (e) {
    toast(erroAmigavel(e));
  } finally {
    botao.disabled = false;
  }
}

function mostrarSucesso(dados, { editando, offline }) {
  $("#sucesso-titulo").textContent = editando ? "Registro atualizado!" : "Registro salvo!";
  const ver = vereditoMedicao(dados);
  const box = $("#sucesso-veredito");
  if (ver) {
    box.className = `veredito ${ver.nivel}`;
    box.innerHTML = `${esc(ver.titulo)}<small>${esc(ver.texto)}</small>`;
    box.hidden = false;
  } else box.hidden = true;
  $("#sucesso-texto").textContent = offline ? "Você está sem internet. O registro ficou guardado no celular e será enviado sozinho quando a conexão voltar." : "Obrigado por cuidar da piscina.";
  irPara("sucesso");
}

/* =========================================================
   Histórico
   ========================================================= */
function chip(param, v) {
  if (v === null || v === undefined) return "";
  const av = avaliar(param, v);
  const [rot, un] = ROTULOS[param];
  return `<span class="chip ${av ? av.nivel : ""}">${rot} ${fmt(v)}${un ? " " + un : ""}</span>`;
}

function renderHistorico() {
  const lst = todosRegistros();
  const box = $("#lista-historico");
  if (!lst.length) {
    box.innerHTML = '<div class="card vazio"><p class="muted">Nenhum registro ainda.</p></div>';
    return;
  }
  box.innerHTML = lst.map((r) => {
    const feitas = (r.tarefas || []).map((id) => NOME_TAREFA[id] || id);
    return `<details class="reg">
      <summary>
        <div class="reg-topo">
          <strong>${esc(dataBR(r.data))}${r.hora ? " · " + esc(r.hora) : ""}</strong>
          ${r._pendente ? '<span class="reg-tipo pendente">Não enviado</span>' : ""}
        </div>
        <div class="muted">${esc(r.responsavel)}${feitas.length ? ` · ${feitas.length} serviço(s)` : ""}</div>
        <div class="chips">${chip("cloro", r.cloro)}${chip("ph", r.ph)}${chip("alcalinidade", r.alcalinidade)}${chip("temperatura", r.temperatura)}</div>
      </summary>
      <div class="reg-corpo">
        ${feitas.length ? `<div><h4>O que foi feito</h4><ul>${feitas.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
        ${r.produtos ? `<div><h4>Produtos colocados</h4><p>${esc(r.produtos)}</p></div>` : ""}
        ${r.observacoes ? `<div><h4>Observação</h4><p>${esc(r.observacoes)}</p></div>` : ""}
        ${r.criado_por ? `<p class="muted">Lançado por ${esc(r.criado_por)}${r.atualizado_por ? ` · editado por ${esc(r.atualizado_por)}` : ""}</p>` : ""}
        ${r._pendente ? "" : `
        <div class="reg-acoes">
          <button type="button" class="botao botao-sec botao-peq" data-editar="${r.id}">Editar</button>
          ${possoExcluir(r.criado_por) ? `<button type="button" class="botao botao-perigo botao-peq" data-excluir="${r.id}">Excluir</button>` : ""}
        </div>`}
      </div>
    </details>`;
  }).join("");
}

async function excluirRegistro(id) {
  if (!confirm("Excluir este registro?")) return;
  try {
    await api(`/api/registros/${id}`, { method: "DELETE" });
    toast("Registro excluído");
    await carregar();
  } catch (e) {
    toast(erroAmigavel(e));
  }
}

function exportarRegistrosCSV() {
  const lst = todosRegistros();
  if (!lst.length) return toast("Nada para exportar");
  const cab = ["Data", "Hora", "Quem fez", "Cloro (ppm)", "pH", "Alcalinidade (ppm)", "O que foi feito", "Produtos colocados", "Observação"];
  const linhas = lst.map((r) => [r.data, r.hora, r.responsavel, r.cloro, r.ph, r.alcalinidade,
    (r.tarefas || []).map((id) => NOME_TAREFA[id] || id).join(" | "), r.produtos, r.observacoes].map(celCSV).join(";"));
  baixarCSV(`piscina-registros-${hojeISO()}.csv`, [cab.join(";"), ...linhas]);
}

/* =========================================================
   Compras: lista do que falta + gastos
   ========================================================= */
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
let mesCustos = hojeISO().slice(0, 7);

function rotuloMes(ym) {
  if (ym === "todos") return "Todo o período";
  const [a, m] = ym.split("-");
  return `${NOMES_MES[+m - 1]} de ${a}`;
}
function custosDoPeriodo() {
  return custos.filter((c) => mesCustos === "todos" || (c.data || "").startsWith(mesCustos));
}

function renderLista() {
  const f = lista.faltando || [];
  // tela "Está acabando": o que já foi avisado
  $("#lista-faltando").innerHTML = f.length ? f.map((i) => `
    <div class="item-lista">
      <div><strong>${esc(i.produto)}</strong>${i.quantidade ? ` · ${esc(i.quantidade)}` : ""}
        <div class="muted">Avisado por ${esc(i.pedido_nome || i.pedido_por || "–")} em ${esc(dataHoraBR(i.pedido_em))}</div></div>
      ${possoExcluir(i.pedido_por) ? `<div class="reg-acoes"><button type="button" class="botao botao-perigo botao-peq" data-tirar="${i.id}">Tirar da lista</button></div>` : ""}
    </div>`).join("") : '<p class="muted">Nada na lista. Toque em um produto acima para avisar que está acabando.</p>';

  // tela "Comprei": um botão grande por item faltando
  $("#lista-comprar").innerHTML = f.length ? f.map((i) => `
    <button type="button" class="botao-comprar" data-comprei="${i.id}">
      <span><strong>${esc(i.produto)}</strong><small>Avisado por ${esc(i.pedido_nome || i.pedido_por || "–")}</small></span>
      <span class="seta">Comprei ›</span>
    </button>`).join("") : '<p class="muted">Nada na lista de faltando. Se comprou algo, toque em "Comprei outra coisa".</p>';

  const c = lista.comprados || [];
  $("#lista-comprados").innerHTML = c.length
    ? `<h3>Comprados recentemente</h3>` + c.slice(0, 8).map((i) =>
      `<p><strong>${esc(i.produto)}</strong> · ${esc(i.comprador || "")} · ${i.valor ? brl(i.valor) : ""} · ${esc(dataHoraBR(i.comprado_em).slice(0, 5))}</p>`).join("")
    : "";
}

function renderMesesCustos() {
  const sel = $("#custo-mes");
  const meses = new Set([hojeISO().slice(0, 7), ...custos.map((c) => (c.data || "").slice(0, 7)).filter(Boolean)]);
  const opcoes = [...meses].sort().reverse();
  if (mesCustos !== "todos" && !opcoes.includes(mesCustos)) mesCustos = opcoes[0];
  sel.innerHTML = opcoes.map((m) => `<option value="${m}">${esc(rotuloMes(m))}</option>`).join("") + `<option value="todos">Todo o período</option>`;
  sel.value = mesCustos;
}

function renderCustos() {
  renderMesesCustos();
  const per = custosDoPeriodo();
  const total = per.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  $("#custo-total").textContent = brl(total);
  $("#custo-qtd").textContent = per.length ? `${per.length} compra(s) · ${rotuloMes(mesCustos)}` : `Nenhuma compra em ${rotuloMes(mesCustos)}`;

  const porPessoa = {};
  for (const c of per) porPessoa[c.comprador] = (porPessoa[c.comprador] || 0) + (Number(c.valor) || 0);
  $("#custo-por-pessoa").innerHTML = Object.entries(porPessoa).sort((a, b) => b[1] - a[1]).map(([nome, v]) => `
    <li><span>${esc(nome)}</span><strong>${brl(v)}</strong>
      <span class="barra"><span style="width:${total ? Math.max(3, (v / total) * 100) : 0}%"></span></span></li>`).join("");
  $("#custo-exportar").hidden = !per.length;

  let html = "";
  let dia = "";
  for (const c of per) {
    if (c.data !== dia) { dia = c.data; html += `<p class="custo-dia">${esc(dataBR(c.data))}</p>`; }
    const det = [c.quantidade, c.loja].filter(Boolean).map(esc).join(" · ");
    html += `<details class="custo">
      <summary class="custo-topo"><strong>${esc(c.produto)}</strong><span class="custo-valor">${brl(c.valor)}</span></summary>
      <div class="muted">${esc(c.comprador)}${det ? " · " + det : ""}</div>
      ${c.observacoes ? `<div class="muted">${esc(c.observacoes)}</div>` : ""}
      ${c.criado_por ? `<div class="muted">Lançado por ${esc(c.criado_por)}${c.atualizado_por ? ` · editado por ${esc(c.atualizado_por)}` : ""}</div>` : ""}
      <div class="reg-acoes">
        <button type="button" class="botao botao-sec botao-peq" data-editar-custo="${c.id}">Editar</button>
        ${possoExcluir(c.criado_por) ? `<button type="button" class="botao botao-perigo botao-peq" data-excluir-custo="${c.id}">Excluir</button>` : ""}
      </div>
    </details>`;
  }
  $("#lista-custos").innerHTML = html;
}

async function avisarFalta(produto) {
  if (!produto) { toast("Escreva o produto que está acabando"); return false; }
  try {
    const r = await api("/api/lista", { method: "POST", body: JSON.stringify({ produto, nome: nomePadrao() }) });
    toast(r.jaNaLista ? `${produto} já estava na lista` : `${produto} adicionado à lista`);
    await carregar();
    return true;
  } catch (e) {
    toast(erroAmigavel(e));
    return false;
  }
}

async function tirarDaLista(id) {
  if (!confirm("Tirar este produto da lista?")) return;
  try {
    await api(`/api/lista/${id}`, { method: "DELETE" });
    toast("Produto retirado da lista");
    await carregar();
  } catch (e) {
    toast(erroAmigavel(e));
  }
}

// Janela única para: "Comprei" (item da lista), compra avulsa e edição de compra
function atualizarResumoCompra() {
  const f = $("#form-compra");
  const quando = f.data.value === hojeISO() ? "hoje" : dataCurta(f.data.value);
  $("#compra-resumo").textContent = `Comprado por ${f.comprador.value || "–"} · ${quando}`;
}

function abrirCompra({ item = null, custo = null } = {}) {
  const f = $("#form-compra");
  f.reset();
  f.item_id.value = item ? item.id : "";
  f.custo_id.value = custo ? custo.id : "";
  f.produto.value = item ? item.produto : custo ? custo.produto : "";
  f.produto.readOnly = !!item;
  f.quantidade.value = item ? item.quantidade || "" : custo ? custo.quantidade || "" : "";
  f.valor.value = custo ? String(custo.valor).replace(".", ",") : "";
  f.comprador.value = custo ? custo.comprador : nomePadrao();
  f.data.value = custo ? custo.data : hojeISO();
  f.loja.value = custo ? custo.loja || "" : "";
  $(".quem-quando", f).open = !!custo;
  atualizarResumoCompra();
  $("#compra-titulo").textContent = item ? `Comprei: ${item.produto}` : custo ? "Editar compra" : "Comprei outra coisa";
  $("#dialogo-compra").showModal();
  setTimeout(() => (item || custo ? f.valor : f.produto).focus(), 60);
}

async function salvarCompra(ev) {
  ev.preventDefault();
  const f = $("#form-compra");
  const dados = {
    data: f.data.value,
    comprador: f.comprador.value.trim(),
    produto: f.produto.value.trim(),
    quantidade: f.quantidade.value.trim() || null,
    valor: lerValorBR(f.valor.value),
    loja: f.loja.value.trim() || null,
  };
  if (!dados.produto) return toast("Informe o produto");
  if (!dados.valor || Number.isNaN(dados.valor) || dados.valor <= 0) return toast("Informe o valor");
  if (!dados.comprador) return toast("Informe quem comprou");
  if (!dados.data) return toast("Informe a data");

  const botao = $("#compra-salvar");
  botao.disabled = true;
  try {
    if (f.item_id.value) {
      await api(`/api/lista/${f.item_id.value}`, { method: "PUT", body: JSON.stringify({ acao: "comprar", ...dados }) });
      toast("Compra registrada e retirada da lista");
    } else if (f.custo_id.value) {
      const antigo = custos.find((c) => String(c.id) === f.custo_id.value);
      await api(`/api/custos/${f.custo_id.value}`, { method: "PUT", body: JSON.stringify({ ...dados, observacoes: antigo?.observacoes || null }) });
      toast("Compra atualizada");
    } else {
      await api("/api/custos", { method: "POST", body: JSON.stringify({ ...dados, client_id: uuid() }) });
      toast("Compra lançada");
    }
    gravarLS(LS.responsavel, dados.comprador);
    mesCustos = dados.data.slice(0, 7);
    $("#dialogo-compra").close();
    await carregar();
  } catch (e) {
    toast(erroAmigavel(e));
  } finally {
    botao.disabled = false;
  }
}

async function excluirCusto(id) {
  if (!confirm("Excluir esta compra?")) return;
  try {
    await api(`/api/custos/${id}`, { method: "DELETE" });
    toast("Compra excluída");
    await carregar();
  } catch (e) {
    toast(erroAmigavel(e));
  }
}

function exportarCustosCSV() {
  const per = custosDoPeriodo();
  if (!per.length) return toast("Nada para exportar");
  const valor = (v) => (typeof v === "number" ? v.toFixed(2).replace(".", ",") : v);
  const cab = ["Data", "Quem comprou", "Produto", "Quantidade", "Valor (R$)", "Loja", "Observação"];
  const linhas = [...per].reverse().map((c) =>
    [c.data, c.comprador, c.produto, c.quantidade, valor(Number(c.valor)), c.loja, c.observacoes].map(celCSV).join(";"));
  const total = per.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  linhas.push(["", "", "TOTAL", "", valor(total), "", ""].map(celCSV).join(";"), "");
  const porPessoa = {};
  for (const c of per) porPessoa[c.comprador] = (porPessoa[c.comprador] || 0) + Number(c.valor || 0);
  for (const [nome, v] of Object.entries(porPessoa)) linhas.push(["", nome, "Total da pessoa", "", valor(v), "", ""].map(celCSV).join(";"));
  baixarCSV(`piscina-gastos-${mesCustos}.csv`, [cab.join(";"), ...linhas]);
}

/* =========================================================
   Acessos (administrador)
   ========================================================= */
let acessos = [];

function pessoaHTML(p, botoes) {
  const ini = esc((p.nome || p.email || "?")[0].toUpperCase());
  const foto = p.foto ? `<img src="${esc(p.foto)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ini;
  const quando = p.status === "pendente" ? `pediu em ${esc(dataHoraBR(p.solicitado_em))}`
    : p.ultimo_acesso ? `último acesso ${esc(dataHoraBR(p.ultimo_acesso))}`
    : p.decidido_em ? `liberado em ${esc(dataHoraBR(p.decidido_em))}` : "";
  return `<div class="pessoa">
    <span class="pessoa-foto">${foto}</span>
    <div class="pessoa-info"><strong>${esc(p.nome || p.email)}</strong><small>${esc(p.email)}${quando ? " · " + quando : ""}</small></div>
    <div class="reg-acoes">${botoes}</div>
  </div>`;
}
function botaoAcao(email, acao, texto, classe) {
  return `<button type="button" class="botao ${classe} botao-peq" data-acesso="${esc(acao)}" data-email="${esc(email)}">${texto}</button>`;
}

function renderAcessos(admins = [], fixos = []) {
  const pend = acessos.filter((a) => a.status === "pendente");
  const aprov = acessos.filter((a) => a.status === "aprovado");
  const rec = acessos.filter((a) => a.status === "recusado");
  $("#acessos-pendentes").innerHTML = pend.length
    ? pend.map((p) => pessoaHTML(p, botaoAcao(p.email, "aprovar", "Liberar", "") + botaoAcao(p.email, "recusar", "Recusar", "botao-perigo"))).join("")
    : '<p class="muted">Nenhum pedido no momento.</p>';
  const eu = acesso.usuario || {};
  const adminsHTML = admins.map((e) => pessoaHTML({ email: e, nome: e === eu.email ? eu.nome : e, foto: e === eu.email ? eu.foto : null }, '<span class="muted">Administrador</span>')).join("");
  const fixosHTML = fixos.map((e) => pessoaHTML({ email: e, nome: e }, '<span class="muted">Liberado na configuração do Cloudflare</span>')).join("");
  $("#acessos-aprovados").innerHTML = adminsHTML + fixosHTML + aprov.map((p) => pessoaHTML(p, botaoAcao(p.email, "remover", "Remover acesso", "botao-perigo"))).join("");
  $("#card-recusados").hidden = !rec.length;
  $("#acessos-recusados").innerHTML = rec.map((p) => pessoaHTML(p, botaoAcao(p.email, "aprovar", "Liberar", "botao-sec") + botaoAcao(p.email, "remover", "Apagar", "botao-perigo"))).join("");
  acesso.pendentes = pend.length;
  renderPedidosAcesso();
}

async function carregarAcessos() {
  try {
    const d = await api("/api/acessos");
    acessos = d.acessos || [];
    renderAcessos(d.admins || [], d.fixos || []);
  } catch (e) {
    toast(erroAmigavel(e));
  }
}

async function acaoAcesso(email, acao) {
  if (acao === "remover" && !confirm(`Remover o acesso de ${email}?`)) return;
  try {
    await api("/api/acessos", { method: "POST", body: JSON.stringify({ email, acao }) });
    toast(acao === "aprovar" ? "Acesso liberado" : acao === "recusar" ? "Pedido recusado" : "Acesso removido");
    await carregarAcessos();
  } catch (e) {
    toast(erroAmigavel(e));
  }
}

/* =========================================================
   Atividades (log) — administrador
   ========================================================= */
let atividadesAntes = null;

const CAMPO_NOME = {
  data: "data", hora: "hora", responsavel: "quem fez", cloro: "cloro", ph: "pH", alcalinidade: "alcalinidade",
  temperatura: "temperatura", tarefas: "serviços", produtos: "produtos", observacoes: "observação",
  comprador: "quem comprou", produto: "produto", quantidade: "quantidade", valor: "valor", loja: "loja", gasto: "gasto", tipo: "tipo",
};

function descreverLog(l) {
  const d = l.detalhes || {};
  const v = (x) => (x === null || x === undefined || x === "" ? "–" : x);
  const alt = d.alteracoes ? Object.entries(d.alteracoes).map(([c, [a, b]]) => `${CAMPO_NOME[c] || c}: ${v(a)} → ${v(b)}`).join("; ") : "";
  switch (l.acao) {
    case "login": return ["entrou no site", ""];
    case "logout": return ["saiu do site", ""];
    case "pedido_acesso": return ["pediu acesso ao site", d.nome || ""];
    case "login_aguardando": return ["tentou entrar (aguardando liberação)", ""];
    case "login_recusado": return ["tentou entrar (acesso recusado)", ""];
    case "acesso_aprovar": return [`liberou o acesso de ${l.entidade_id}`, ""];
    case "acesso_recusar": return [`recusou o acesso de ${l.entidade_id}`, ""];
    case "acesso_remover": return [`removeu o acesso de ${l.entidade_id}`, ""];
    case "registro_criar": return ["fez um registro", `${dataCurta(d.data)} · cloro ${v(d.cloro)} · pH ${v(d.ph)}`];
    case "registro_editar": return ["editou um registro", `${dataCurta(d.data)}${alt ? " · " + alt : ""}`];
    case "registro_excluir": return ["excluiu um registro", `${dataCurta(d.data)} · ${v(d.responsavel)}`];
    case "registro_excluir_negado": return ["tentou excluir registro de outra pessoa (bloqueado)", `criado por ${v(d.criado_por)}`];
    case "custo_criar": return ["lançou uma compra", `${v(d.produto)} · ${brl(d.valor)} · ${v(d.comprador)}`];
    case "custo_editar": return ["editou uma compra", `${v(d.produto)}${alt ? " · " + alt : ""}`];
    case "custo_excluir": return ["excluiu uma compra", `${v(d.produto)} · ${brl(d.valor)}`];
    case "custo_excluir_negado": return ["tentou excluir compra de outra pessoa (bloqueado)", `lançada por ${v(d.criado_por)}`];
    case "lista_adicionar": return ["avisou que está acabando", `${v(d.produto)}${d.quantidade ? " · " + d.quantidade : ""}`];
    case "lista_comprar": return ["marcou como comprado", `${v(d.produto)} · ${brl(d.valor)} · ${v(d.comprador)}`];
    case "lista_excluir": return ["tirou da lista de compras", v(d.produto)];
    case "lista_excluir_negado": return ["tentou tirar da lista item de outra pessoa (bloqueado)", v(d.produto)];
    default: return [l.acao, ""];
  }
}

async function carregarAtividades(reiniciar = false) {
  if (reiniciar) atividadesAntes = null;
  try {
    const q = atividadesAntes ? `?antes=${atividadesAntes}` : "";
    const d = await api(`/api/logs${q}`);
    const html = (d.logs || []).map((l) => {
      const [acao, det] = descreverLog(l);
      return `<div class="atividade ${/negado|recusado/.test(l.acao) ? "negado" : ""}">
        <div class="atividade-topo"><strong>${esc(l.email || "–")}</strong><small>${esc(dataHoraBR(l.quando))}</small></div>
        <div>${esc(acao)}</div>${det ? `<div class="det">${esc(det)}</div>` : ""}
      </div>`;
    }).join("");
    const box = $("#lista-atividades");
    if (reiniciar) box.innerHTML = html || '<p class="muted">Nenhuma atividade registrada ainda.</p>';
    else box.insertAdjacentHTML("beforeend", html);
    atividadesAntes = d.mais;
    $("#atividades-mais").hidden = !d.mais;
  } catch (e) {
    toast(erroAmigavel(e));
  }
}

/* =========================================================
   Render geral e eventos
   ========================================================= */
function renderResponsaveis() {
  const nomes = new Set([nomePadrao(), ...todosRegistros().map((r) => r.responsavel), ...custos.map((c) => c.comprador)].filter(Boolean));
  $("#lista-responsaveis").innerHTML = [...nomes].slice(0, 20).map((n) => `<option value="${esc(n)}">`).join("");
}

function renderTudo() {
  renderInicio();
  renderHistorico();
  renderLista();
  renderCustos();
  renderResponsaveis();
}

function atualizarRede() {
  $("#status-rede").hidden = navigator.onLine;
}

document.addEventListener("DOMContentLoaded", () => {
  montarChipsValor();

  // navegação
  $("#botao-voltar").addEventListener("click", () => {
    if (abaAtual === "registrar" && passoAtual > 1) return mostrarPasso(passoAtual - 1);
    irPara("inicio");
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ir]");
    if (!b) return;
    if (b.dataset.ir === "registrar" && !form().id.value) novoRegistro();
    irPara(b.dataset.ir);
  });

  // registrar: passos
  const f = form();
  f.addEventListener("submit", salvarRegistro);
  f.addEventListener("keydown", (e) => {
    // Enter no teclado do celular não envia o formulário antes do último passo
    if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); e.target.blur(); }
  });
  $("#passo-proximo").addEventListener("click", () => mostrarPasso(Math.min(3, passoAtual + 1)));
  $("#passo-voltar").addEventListener("click", () => {
    if (passoAtual === 1) { novoRegistro(); irPara("inicio"); } else mostrarPasso(passoAtual - 1);
  });
  $("#cancelar-edicao").addEventListener("click", () => { novoRegistro(); irPara("historico"); });
  f.addEventListener("click", (e) => {
    const chip = e.target.closest(".chips-valor button");
    if (chip) {
      const medida = chip.closest(".medida");
      const input = $("input", medida);
      input.value = chip.classList.contains("sel") ? "" : chip.dataset.valor; // tocar de novo desmarca
      atualizarDica(input);
    }
    const prod = e.target.closest("[data-produto]");
    if (prod) adicionarProduto(prod.dataset.produto);
  });
  f.addEventListener("input", (e) => {
    if (e.target.closest(".medida")) atualizarDica(e.target);
    if (["responsavel", "data", "hora"].includes(e.target.name)) atualizarResumoQuem();
  });

  // histórico
  $("#exportar").addEventListener("click", exportarRegistrosCSV);
  $("#lista-historico").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-editar]");
    const ex = e.target.closest("[data-excluir]");
    if (ed) { const r = registros.find((x) => String(x.id) === ed.dataset.editar); if (r) editarRegistro(r); }
    if (ex) excluirRegistro(ex.dataset.excluir);
  });

  // está acabando
  $("#form-lista").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#lista-produto");
    avisarFalta(input.value.trim()).then((ok) => { if (ok) input.value = ""; });
  });
  $("#chips-faltando").addEventListener("click", (e) => {
    const b = e.target.closest("[data-falta]");
    if (b) avisarFalta(b.dataset.falta);
  });
  $("#lista-faltando").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tirar]");
    if (t) tirarDaLista(t.dataset.tirar);
  });

  // comprei
  $("#lista-comprar").addEventListener("click", (e) => {
    const c = e.target.closest("[data-comprei]");
    if (c) { const item = lista.faltando.find((i) => String(i.id) === c.dataset.comprei); if (item) abrirCompra({ item }); }
  });
  $("#custo-novo").addEventListener("click", () => abrirCompra());
  $("#form-compra").addEventListener("submit", salvarCompra);
  $("#form-compra").addEventListener("input", (e) => { if (["comprador", "data"].includes(e.target.name)) atualizarResumoCompra(); });
  $("#compra-cancelar").addEventListener("click", () => $("#dialogo-compra").close());

  // gastos
  $("#custo-mes").addEventListener("change", (e) => { mesCustos = e.target.value; renderCustos(); });
  $("#custo-exportar").addEventListener("click", exportarCustosCSV);
  $("#lista-custos").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-editar-custo]");
    const ex = e.target.closest("[data-excluir-custo]");
    if (ed) { const c = custos.find((x) => String(x.id) === ed.dataset.editarCusto); if (c) abrirCompra({ custo: c }); }
    if (ex) excluirCusto(ex.dataset.excluirCusto);
  });

  // menu do usuário
  const botaoUsuario = $("#botao-usuario");
  const menu = $("#menu-usuario");
  botaoUsuario.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    botaoUsuario.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; botaoUsuario.setAttribute("aria-expanded", "false"); }
  });
  $("#botao-acessos").addEventListener("click", () => { menu.hidden = true; irPara("acessos"); });
  $("#botao-atividades").addEventListener("click", () => { menu.hidden = true; irPara("atividades"); });
  $("#aviso-acessos").addEventListener("click", () => irPara("acessos"));
  $("#atividades-mais").addEventListener("click", () => carregarAtividades(false));

  // acessos
  $("#aba-acessos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-acesso]");
    if (b) acaoAcesso(b.dataset.email, b.dataset.acesso);
  });
  $("#form-convite").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("E-mail inválido");
    e.target.reset();
    acaoAcesso(email, "aprovar");
  });

  // rede
  window.addEventListener("online", () => { atualizarRede(); sincronizar().then(carregar); });
  window.addEventListener("offline", atualizarRede);
  atualizarRede();

  novoRegistro();
  const abaInicial = location.hash.slice(1) || "inicio";
  const abrir = ["sucesso", "registrar"].includes(abaInicial) ? "inicio" : abaInicial;
  irPara(SO_ADMIN.includes(abrir) ? "inicio" : abrir, { rolar: false });
  renderTudo();
  verificarAcesso().then((ok) => {
    novoRegistro();
    renderTudo();
    if (ok && SO_ADMIN.includes(abrir)) irPara(abrir);
    if (ok) sincronizar().then(carregar);
  });

  if ("serviceWorker" in navigator) {
    const tinhaControle = !!navigator.serviceWorker.controller;
    let recarregou = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (tinhaControle && !recarregou) { recarregou = true; location.reload(); }
    });
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
  }
});
