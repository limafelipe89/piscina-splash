"use strict";

/* =========================================================
   Configuração
   ========================================================= */
const TIPOS = {
  manutencao: "Manutenção",
  antes: "Antes do banho",
  depois: "Depois do uso",
};

// IDs são estáveis: não renomeie um id existente, só o texto.
const TAREFAS = {
  manutencao: [
    ["aspecto", "Observar transparência, cor, odor e película escorregadia"],
    ["detritos", "Retirar folhas e detritos da superfície e do fundo"],
    ["escovar", "Escovar paredes, degraus e fundo"],
    ["filtro", "Limpar cestos, pré-filtro e filtro de pano (manual Splash)"],
    ["medir_cloro_ph", "Medir e anotar cloro livre e pH"],
    ["medir_alc", "Medir e anotar alcalinidade"],
    ["corrigir_ph", "Corrigir pH/alcalinidade só se estiver fora da faixa"],
    ["corrigir_cloro", "Corrigir cloro só conforme teste e rótulo"],
    ["aspirar", "Aspirar sujeira acumulada (procedimento compatível com o filtro)"],
    ["dosador", "Verificar dosador flutuante e completar pastilhas"],
    ["circulacao", "Verificar circulação e aquecimento solar; vazamentos ou ruídos"],
  ],
  antes: [
    ["cloro_faixa", "Medir cloro livre e confirmar que está na faixa"],
    ["ph_faixa", "Medir pH e confirmar que está na faixa"],
    ["transparente", "Água transparente e fundo bem visível"],
    ["sem_limo", "Paredes e degraus sem limo ou película escorregadia"],
    ["corrigido", "Se algo estava fora: corrigido e aguardado o tempo do rótulo"],
    ["remedido", "Após correção e circulação, medido novamente"],
    ["uso_intenso", "Uso intenso, chuva forte ou sujeira incomum: análises repetidas"],
  ],
  depois: [
    ["residuos", "Retirar folhas e resíduos da água"],
    ["filtrar", "Deixar a filtração funcionar conforme limites da Splash"],
    ["remedir", "Uso intenso: medir novamente cloro e pH"],
    ["registrar", "Registrar alteração de cor, turbidez ou consumo anormal de cloro"],
  ],
};

const LS = {
  codigo: "piscina.codigo",
  cache: "piscina.cache",
  pendentes: "piscina.pendentes",
  responsavel: "piscina.responsavel",
  acesso: "piscina.acesso",
};

/* =========================================================
   Avaliação das medições
   ========================================================= */
function avaliar(param, v) {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  switch (param) {
    case "cloro":
      if (v < 2) return { nivel: "fora", texto: "Abaixo de 2 ppm — não liberar banho" };
      if (v > 5) return { nivel: "atencao", texto: "Acima do usual — confira o rótulo" };
      return { nivel: "ok", texto: "Na faixa" };
    case "ph":
      if (v >= 7.2 && v <= 7.6) return { nivel: "ok", texto: "Na faixa (7,2–7,6)" };
      if (v >= 7.0 && v <= 7.8) return { nivel: "atencao", texto: v < 7.2 ? "Um pouco baixo — ajustar" : "Um pouco alto — ajustar" };
      return { nivel: "fora", texto: v < 7.0 ? "Muito baixo — corrigir" : "Muito alto — corrigir" };
    case "alcalinidade":
      if (v >= 80 && v <= 120) return { nivel: "ok", texto: "Na faixa (80–120)" };
      if (v >= 60 && v <= 150) return { nivel: "atencao", texto: v < 80 ? "Baixa — avaliar ajuste" : "Alta — avaliar ajuste" };
      return { nivel: "fora", texto: v < 60 ? "Muito baixa" : "Muito alta" };
    case "temperatura":
      return { nivel: "", texto: v > 32 ? "Água quente consome mais cloro" : "" };
  }
  return null;
}

const ROTULOS = {
  cloro: ["Cloro livre", "ppm"],
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
function fmt(n, casas) {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: casas ?? 0, maximumFractionDigits: casas ?? 2 });
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
  const dt = new Date(+a, +m - 1, +d);
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}
function diasDesde(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  const ms = new Date(new Date().toDateString()) - new Date(a, m - 1, d);
  return Math.round(ms / 86400000);
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

/* =========================================================
   Acesso (login Google / código / aberto)
   ========================================================= */
let acesso = lerLS(LS.acesso, { modo: null, usuario: null });

const ERROS_LOGIN = {
  nao_autorizado: "Este e-mail não está autorizado. Peça para incluírem você na lista.",
  login_cancelado: "Login cancelado.",
  login_expirado: "O login demorou demais. Tente de novo.",
  login_falhou: "Não foi possível concluir o login. Tente de novo.",
  google_nao_configurado: "O login com Google ainda não foi configurado no servidor.",
};

function mostrarLogin(msg) {
  const tela = $("#tela-login");
  const erro = $("#login-erro");
  erro.hidden = !msg;
  erro.textContent = msg || "";
  tela.hidden = false;
}

function renderUsuario() {
  const u = acesso.usuario;
  const botao = $("#botao-usuario");
  if (!u) { botao.hidden = true; $("#menu-usuario").hidden = true; return; }
  botao.hidden = false;
  $("#usuario-nome").textContent = u.nome || "";
  $("#usuario-email").textContent = u.email || "";
  const foto = $("#usuario-foto");
  if (u.foto) {
    foto.src = u.foto;
    foto.hidden = false;
    $("#usuario-inicial").textContent = "";
    foto.onerror = () => { foto.hidden = true; $("#usuario-inicial").textContent = (u.nome || u.email || "?")[0].toUpperCase(); };
  } else {
    foto.hidden = true;
    $("#usuario-inicial").textContent = (u.nome || u.email || "?")[0].toUpperCase();
  }
}

// Retorna true se o app pode carregar os dados.
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
    // sem internet: usa o último estado conhecido para continuar funcionando
  }
  renderUsuario();

  if (acesso.modo === "google" && !acesso.usuario) {
    let msg = ERROS_LOGIN[erroURL] || "";
    if (erroURL === "nao_autorizado" && params.get("email")) {
      msg = `O e-mail ${params.get("email")} não está autorizado. Peça para incluírem você na lista.`;
    }
    registros = [];
    gravarLS(LS.cache, []);
    mostrarLogin(msg);
    return false;
  }
  $("#tela-login").hidden = true;
  return true;
}

/* =========================================================
   Estado
   ========================================================= */
let registros = lerLS(LS.cache, []);
let pendentes = lerLS(LS.pendentes, []);

function todos() {
  const pend = pendentes.map((p) => ({ ...p, _pendente: true }));
  return [...pend, ...registros].sort((a, b) =>
    (b.data + (b.hora || "")).localeCompare(a.data + (a.hora || "")) || (b.id || 0) - (a.id || 0)
  );
}

async function carregar() {
  try {
    const dados = await api("/api/registros?limite=500");
    registros = dados.registros || [];
    gravarLS(LS.cache, registros);
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
      if (!(e instanceof ErroRede)) console.warn("Falha ao sincronizar", e);
    }
  }
  const enviados = pendentes.length - restantes.length;
  pendentes = restantes;
  gravarLS(LS.pendentes, pendentes);
  if (enviados) toast(`${enviados} registro(s) enviado(s)`);
}

/* =========================================================
   Navegação
   ========================================================= */
const TITULOS = { inicio: "Início", guia: "Guia", checklist: "Checklist", historico: "Histórico" };

function irPara(aba, { rolar = true } = {}) {
  if (!TITULOS[aba]) aba = "inicio";
  $$(".aba").forEach((s) => (s.hidden = s.id !== `aba-${aba}`));
  $$(".abas button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.aba === aba)));
  $("#titulo-aba").textContent = TITULOS[aba];
  if (location.hash !== `#${aba}`) history.replaceState(null, "", `#${aba}`);
  if (rolar) window.scrollTo({ top: 0 });
}

/* =========================================================
   Início
   ========================================================= */
function medidorHTML(param, valor) {
  const [rot, un] = ROTULOS[param];
  const av = avaliar(param, valor);
  const cls = av ? av.nivel : "";
  return `<div class="medidor ${cls}">
    <small>${rot}</small>
    <strong>${fmt(valor)}</strong>${un && valor !== null && valor !== undefined ? ` <small style="display:inline">${un}</small>` : ""}
    ${av && av.texto ? `<div class="estado">${esc(av.texto)}</div>` : ""}
  </div>`;
}

function renderInicio() {
  const lista = todos();
  const ultima = lista.find((r) => r.cloro !== null && r.cloro !== undefined || r.ph !== null && r.ph !== undefined);
  const box = $("#ultima-medicao");
  const ver = $("#veredito");

  if (!ultima) {
    box.innerHTML = '<p class="muted">Nenhuma medição ainda. Faça a primeira manutenção.</p>';
    $("#ultima-data").textContent = "";
    ver.hidden = true;
  } else {
    box.innerHTML = ["cloro", "ph", "alcalinidade", "temperatura"].map((p) => medidorHTML(p, ultima[p])).join("");
    $("#ultima-data").textContent = `${dataBR(ultima.data)}${ultima.hora ? " · " + ultima.hora : ""} · ${ultima.responsavel || ""}`;

    const avs = ["cloro", "ph"].map((p) => [p, avaliar(p, ultima[p])]);
    const faltando = avs.filter(([, a]) => !a).map(([p]) => ROTULOS[p][0]);
    const fora = avs.filter(([, a]) => a && a.nivel === "fora").map(([p]) => ROTULOS[p][0]);
    const atenc = avs.filter(([, a]) => a && a.nivel === "atencao").map(([p]) => ROTULOS[p][0]);
    const dias = diasDesde(ultima.data);
    const velha = dias !== null && dias >= 1
      ? `<small>Medição de ${dias === 1 ? "ontem" : dias + " dias atrás"}: meça de novo antes de liberar o banho.</small>`
      : "";

    let cls, txt;
    if (fora.length) { cls = "fora"; txt = `Não liberar banho: corrigir ${fora.join(" e ")}.`; }
    else if (faltando.length) { cls = "atencao"; txt = `Falta medir ${faltando.join(" e ")}.`; }
    else if (atenc.length) { cls = "atencao"; txt = `Atenção: ajustar ${atenc.join(" e ")}.`; }
    else { cls = "ok"; txt = "Cloro e pH dentro da faixa."; }
    ver.className = `veredito ${cls}`;
    ver.innerHTML = esc(txt) + velha;
    ver.hidden = false;
  }

  const mes = hojeISO().slice(0, 7);
  const doMes = lista.filter((r) => (r.data || "").startsWith(mes));
  $("#res-registros").textContent = doMes.length;
  $("#res-gasto").textContent = brl(doMes.reduce((s, r) => s + (Number(r.gasto) || 0), 0)).replace(",00", "");
  const ultManut = lista.find((r) => r.tipo === "manutencao");
  const d = ultManut ? diasDesde(ultManut.data) : null;
  $("#res-dias").textContent = d === null ? "–" : d;

  const av = $("#pendentes-aviso");
  if (pendentes.length) {
    av.hidden = false;
    av.textContent = `${pendentes.length} registro(s) salvo(s) só no celular, aguardando internet para enviar.`;
  } else av.hidden = true;
}

/* =========================================================
   Checklist (formulário)
   ========================================================= */
const form = () => $("#form");

function tipoAtual() {
  return $('input[name="tipo"]:checked', form()).value;
}

function renderTarefas(marcadas = []) {
  const tipo = tipoAtual();
  const ul = $("#lista-tarefas");
  ul.innerHTML = TAREFAS[tipo].map(([id, txt]) => `
    <li><label>
      <input type="checkbox" name="tarefa" value="${id}" ${marcadas.includes(id) ? "checked" : ""}>
      <span>${esc(txt)}</span>
    </label></li>`).join("");
  contarTarefas();
}

function contarTarefas() {
  const caixas = $$('input[name="tarefa"]', form());
  const feitas = caixas.filter((c) => c.checked).length;
  $("#contador-tarefas").textContent = `${feitas}/${caixas.length}`;
  $("#marcar-todas").textContent = feitas === caixas.length && caixas.length ? "Desmarcar todas" : "Marcar todas";
}

function atualizarDica(input) {
  const campo = input.closest(".medida");
  if (!campo) return;
  const v = num(input.value);
  const dica = $(".dica", campo);
  campo.classList.remove("ok", "atencao", "fora");
  if (v === null) { dica.textContent = ""; return; }
  if (Number.isNaN(v)) { campo.classList.add("fora"); dica.textContent = "Número inválido"; return; }
  const av = avaliar(input.name, v);
  if (av && av.nivel) campo.classList.add(av.nivel);
  dica.textContent = av ? av.texto : "";
}

function novoRegistro(tipo = "manutencao") {
  const f = form();
  f.reset();
  f.id.value = "";
  $(`input[name="tipo"][value="${tipo}"]`, f).checked = true;
  f.data.value = hojeISO();
  f.hora.value = horaAgora();
  f.responsavel.value = lerLS(LS.responsavel, "") || (acesso.usuario && acesso.usuario.nome) || "";
  $("#editando-aviso").hidden = true;
  $("#botao-salvar").textContent = "Salvar registro";
  renderTarefas();
  $$(".medida input", f).forEach(atualizarDica);
}

function editarRegistro(r) {
  const f = form();
  f.reset();
  f.id.value = r.id;
  $(`input[name="tipo"][value="${r.tipo}"]`, f).checked = true;
  f.data.value = r.data;
  f.hora.value = r.hora || "";
  f.responsavel.value = r.responsavel || "";
  for (const k of ["cloro", "ph", "alcalinidade", "temperatura", "gasto"]) {
    f[k].value = r[k] === null || r[k] === undefined ? "" : String(r[k]).replace(".", ",");
  }
  f.produtos.value = r.produtos || "";
  f.observacoes.value = r.observacoes || "";
  renderTarefas(r.tarefas || []);
  $$(".medida input", f).forEach(atualizarDica);
  $("#editando-aviso").hidden = false;
  $("#botao-salvar").textContent = "Salvar alterações";
  irPara("checklist");
}

function coletar() {
  const f = form();
  const dados = {
    tipo: tipoAtual(),
    data: f.data.value,
    hora: f.hora.value || null,
    responsavel: f.responsavel.value.trim(),
    tarefas: $$('input[name="tarefa"]:checked', f).map((c) => c.value),
    produtos: f.produtos.value.trim() || null,
    observacoes: f.observacoes.value.trim() || null,
  };
  const erros = [];
  for (const k of ["cloro", "ph", "alcalinidade", "temperatura", "gasto"]) {
    const v = num(f[k].value);
    if (Number.isNaN(v)) erros.push(`Valor inválido em ${k === "gasto" ? "valor gasto" : ROTULOS[k][0]}`);
    dados[k] = Number.isNaN(v) ? null : v;
  }
  if (!dados.data) erros.push("Informe a data");
  if (!dados.responsavel) erros.push("Informe quem fez a manutenção");
  return { dados, erros };
}

async function salvar(ev) {
  ev.preventDefault();
  const f = form();
  const { dados, erros } = coletar();
  if (erros.length) { toast(erros[0]); return; }
  gravarLS(LS.responsavel, dados.responsavel);

  const botao = $("#botao-salvar");
  botao.disabled = true;
  const id = f.id.value;
  try {
    if (id) {
      await api(`/api/registros/${id}`, { method: "PUT", body: JSON.stringify(dados) });
      toast("Registro atualizado");
    } else {
      dados.client_id = uuid();
      try {
        await api("/api/registros", { method: "POST", body: JSON.stringify(dados) });
        toast("Registro salvo");
      } catch (e) {
        if (!(e instanceof ErroRede)) throw e;
        pendentes.push(dados);
        gravarLS(LS.pendentes, pendentes);
        toast("Sem internet: salvo no celular e enviado depois");
      }
    }
    const tipo = dados.tipo;
    await carregar();
    novoRegistro(tipo);
    irPara("historico");
  } catch (e) {
    toast(e instanceof ErroRede ? "Sem internet: edição não enviada" : e.message);
  } finally {
    botao.disabled = false;
  }
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
  const filtro = $("#filtro-tipo").value;
  const lista = todos().filter((r) => !filtro || r.tipo === filtro);
  const box = $("#lista-historico");
  if (!lista.length) {
    box.innerHTML = '<div class="card vazio"><p class="muted">Nenhum registro encontrado.</p></div>';
    return;
  }
  box.innerHTML = lista.map((r, i) => {
    const defs = TAREFAS[r.tipo] || [];
    const feitas = (r.tarefas || []);
    const nomes = defs.filter(([id]) => feitas.includes(id)).map(([, t]) => t);
    const naoFeitas = defs.filter(([id]) => !feitas.includes(id)).map(([, t]) => t);
    return `<details class="reg" data-i="${i}">
      <summary>
        <div class="reg-topo">
          <strong>${esc(dataBR(r.data))}${r.hora ? " · " + esc(r.hora) : ""}</strong>
          <span class="reg-tipo ${r._pendente ? "pendente" : ""}">${r._pendente ? "Pendente" : esc(TIPOS[r.tipo] || r.tipo)}</span>
        </div>
        <div class="muted">${esc(r.responsavel)} · ${feitas.length}/${defs.length} tarefas${r.gasto ? " · " + brl(r.gasto) : ""}</div>
        <div class="chips">${chip("cloro", r.cloro)}${chip("ph", r.ph)}${chip("alcalinidade", r.alcalinidade)}${chip("temperatura", r.temperatura)}</div>
      </summary>
      <div class="reg-corpo">
        ${nomes.length ? `<div><h4>Feito</h4><ul>${nomes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
        ${naoFeitas.length ? `<div><h4>Não marcado</h4><ul>${naoFeitas.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
        ${r.produtos ? `<div><h4>Produtos aplicados</h4><p>${esc(r.produtos)}</p></div>` : ""}
        ${r.observacoes ? `<div><h4>Observações</h4><p>${esc(r.observacoes)}</p></div>` : ""}
        ${r.criado_por ? `<p class="muted">Lançado por ${esc(r.criado_por)}${r.atualizado_por ? ` · editado por ${esc(r.atualizado_por)}` : ""}</p>` : ""}
        ${r._pendente ? '<p class="muted">Aguardando internet para enviar.</p>' : `
        <div class="reg-acoes">
          <button type="button" class="botao botao-sec botao-peq" data-editar="${r.id}">Editar</button>
          <button type="button" class="botao botao-perigo botao-peq" data-excluir="${r.id}">Excluir</button>
        </div>`}
      </div>
    </details>`;
  }).join("");
}

async function excluir(id) {
  if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
  try {
    await api(`/api/registros/${id}`, { method: "DELETE" });
    toast("Registro excluído");
    await carregar();
  } catch (e) {
    toast(e instanceof ErroRede ? "Sem internet" : e.message);
  }
}

function exportarCSV() {
  const lista = todos();
  if (!lista.length) { toast("Nada para exportar"); return; }
  const cab = ["Data", "Hora", "Tipo", "Responsável", "Cloro livre (ppm)", "pH", "Alcalinidade (ppm)", "Temperatura (°C)", "Tarefas feitas", "Produtos", "Gasto (R$)", "Observações"];
  const cel = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = lista.map((r) => {
    const defs = TAREFAS[r.tipo] || [];
    const feitas = defs.filter(([id]) => (r.tarefas || []).includes(id)).map(([, t]) => t).join(" | ");
    return [r.data, r.hora, TIPOS[r.tipo], r.responsavel, r.cloro, r.ph, r.alcalinidade, r.temperatura, feitas, r.produtos, r.gasto, r.observacoes].map(cel).join(";");
  });
  const blob = new Blob(["﻿" + [cab.join(";"), ...linhas].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `piscina-registros-${hojeISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* =========================================================
   Render geral e eventos
   ========================================================= */
function renderResponsaveis() {
  const nomes = [...new Set(todos().map((r) => r.responsavel).filter(Boolean))].slice(0, 20);
  $("#lista-responsaveis").innerHTML = nomes.map((n) => `<option value="${esc(n)}">`).join("");
}

function renderTudo() {
  renderInicio();
  renderHistorico();
  renderResponsaveis();
}

function atualizarRede() {
  $("#status-rede").hidden = navigator.onLine;
}

document.addEventListener("DOMContentLoaded", () => {
  // abas
  $$(".abas button").forEach((b) => b.addEventListener("click", () => irPara(b.dataset.aba)));
  window.addEventListener("hashchange", () => irPara(location.hash.slice(1)));

  // atalhos da tela inicial
  $$("[data-novo]").forEach((b) => b.addEventListener("click", () => {
    novoRegistro(b.dataset.novo);
    irPara("checklist");
  }));

  // formulário
  const f = form();
  f.addEventListener("submit", salvar);
  f.addEventListener("change", (e) => {
    if (e.target.name === "tipo") renderTarefas();
    if (e.target.name === "tarefa") contarTarefas();
  });
  f.addEventListener("input", (e) => { if (e.target.closest(".medida")) atualizarDica(e.target); });
  $("#marcar-todas").addEventListener("click", () => {
    const caixas = $$('input[name="tarefa"]', f);
    const todasMarcadas = caixas.every((c) => c.checked);
    caixas.forEach((c) => (c.checked = !todasMarcadas));
    contarTarefas();
  });
  $("#cancelar-edicao").addEventListener("click", () => novoRegistro(tipoAtual()));

  // histórico
  $("#filtro-tipo").addEventListener("change", renderHistorico);
  $("#exportar").addEventListener("click", exportarCSV);
  $("#lista-historico").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-editar]");
    const ex = e.target.closest("[data-excluir]");
    if (ed) {
      const r = registros.find((x) => String(x.id) === ed.dataset.editar);
      if (r) editarRegistro(r);
    }
    if (ex) excluir(ex.dataset.excluir);
  });

  // rede
  window.addEventListener("online", () => { atualizarRede(); sincronizar().then(carregar); });
  window.addEventListener("offline", atualizarRede);
  atualizarRede();

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

  irPara(location.hash.slice(1) || "inicio", { rolar: false });
  renderTudo();
  verificarAcesso().then((ok) => {
    novoRegistro();
    if (ok) sincronizar().then(carregar);
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
});
