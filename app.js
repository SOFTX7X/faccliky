// Faccliky: app da agenda inteligente
if (!Faccliky.token()) location.replace("entrar.html");

const { api } = Faccliky;
const $ = s => document.querySelector(s);
const tela = $("#conteudo");
const S = { eu: null, eventos: [], contas: [], habitos: [], agendas: [], semana: 0, chat: [] };

// ---------- Utilidades ----------
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const diaISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const horaTxt = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const real = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inicioDoDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const somarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mesmoDia = (a, b) => diaISO(a) === diaISO(b);
const dataLonga = d => d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const dataCurta = d => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const premium = () => S.eu && S.eu.plano.status !== "basico";
const diaDeConta = s => { const [a, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(a, m - 1, d); };

function toast(msg, ms = 3200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("mostrar");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("mostrar"), ms);
}
async function tentar(fn, ok) {
  try { const r = await fn(); if (ok) toast(ok); return r; }
  catch (e) {
    if (e.status === 402) { await carregarEu(); toast("Esse recurso é do Premium."); location.hash = "#plano"; }
    else toast(e.message);
    throw e;
  }
}
// Botão de excluir com confirmação no segundo toque
function confirmarToque(botao, acao) {
  if (botao.dataset.confirmar) { acao(); return; }
  const original = botao.textContent;
  botao.dataset.confirmar = "1";
  botao.textContent = "Toque de novo";
  botao.classList.add("perigo");
  setTimeout(() => { delete botao.dataset.confirmar; botao.textContent = original; botao.classList.remove("perigo"); }, 3000);
}

// ---------- Dados ----------
async function carregarEu() { S.eu = await api("GET", "/eu"); if (window.aoCarregarEu) window.aoCarregarEu(); }
async function carregarEventos() {
  const de = somarDias(inicioDoDia(), -60).toISOString();
  const ate = somarDias(inicioDoDia(), 180).toISOString();
  S.eventos = await api("GET", `/eventos?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`);
}
async function carregarContas() { S.contas = premium() ? await api("GET", "/contas") : []; }
async function carregarHabitos() { S.habitos = premium() ? await api("GET", "/habitos") : []; }
async function carregarAgendas() { S.agendas = await api("GET", "/agendas"); }
async function carregarTudo() {
  await carregarEu();
  await Promise.all([carregarEventos(), carregarContas(), carregarHabitos(), carregarAgendas()]);
}

const eventosDoDia = d => S.eventos.filter(e => e.tipo === "evento" && e.inicio && mesmoDia(new Date(e.inicio), d))
  .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
const tarefasPendentes = () => S.eventos.filter(e => e.tipo === "tarefa" && !e.concluido);

// ---------- Blocos reutilizáveis ----------
function bloqueio(titulo, texto) {
  return `<div class="bloqueio">
    <img src="assets/kliky.svg" alt="" width="110" height="126">
    <h2>${esc(titulo)}</h2>
    <p>${esc(texto)}</p>
    <a href="#plano" class="btn">Conhecer o Premium</a>
  </div>`;
}
function faixaPlano() {
  const p = S.eu.plano;
  if (p.status === "teste") {
    const dias = Math.max(1, Math.ceil((new Date(p.ate) - Date.now()) / 86400000));
    return `<a href="#plano" class="faixa">Teste grátis: falta${dias > 1 ? "m" : ""} <b>${dias} dia${dias > 1 ? "s" : ""}</b> de Premium</a>`;
  }
  if (p.status === "basico") return `<a href="#plano" class="faixa faixa-basico">Você está no plano Básico. <b>Assine o Premium</b> para usar o Kliky e tudo mais.</a>`;
  return "";
}
function itemEvento(e, hora = true) {
  const ini = e.ini || (e.inicio ? new Date(e.inicio) : null);
  const quando = e.dia_todo ? "Dia todo" : ini && hora ? horaTxt(ini) + (e.fim ? "–" + horaTxt(e.fim) : "") : "";
  const prio = e.prioridade === 1 ? `<span class="pill pill-alta">Importante</span>` : "";
  const grupo = e.agenda_nome ? `<span class="pill">${esc(e.agenda_nome)}</span>` : "";
  return `<div class="item ${e.concluido ? "feito" : ""} ${e.tipo === "tarefa" ? "item-tarefa" : ""}">
    ${e.tipo === "tarefa" ? `<button class="check ${e.concluido ? "ok" : ""}" data-concluir="${e.id}" aria-label="Concluir">${e.concluido ? "✓" : ""}</button>` : ""}
    <a class="item-corpo" href="#editar/${e.id}">
      <strong>${esc(e.titulo)}</strong>
      <span class="item-meta">${quando ? `<span>${quando}</span>` : ""}${e.local ? `<span>${esc(e.local)}</span>` : ""}${prio}${grupo}</span>
    </a>
  </div>`;
}
function ligarConcluir(raiz = tela) {
  raiz.querySelectorAll("[data-concluir]").forEach(b => b.addEventListener("click", async () => {
    const e = S.eventos.find(x => x.id === Number(b.dataset.concluir));
    const novo = await tentar(() => api("PUT", `/eventos/${e.id}`, { concluido: !e.concluido }));
    Object.assign(e, novo);
    if (novo.concluido) toast("Boa! Tarefa concluída");
    render();
  }));
}

// ---------- Telas ----------
const telas = {};

telas.agenda = () => {
  const base = somarDias(inicioDoDia(), S.semana * 7);
  const dias = [...Array(7)].map((_, i) => somarDias(base, i));
  const tarefas = S.eventos.filter(e => e.tipo === "tarefa").sort((a, b) => a.concluido - b.concluido || a.prioridade - b.prioridade);
  tela.innerHTML = `
    <div class="cabeca">
      <div><p class="sub">Próximos 7 dias</p><h1>Agenda</h1></div>
      <a href="#novo" class="btn btn-small">${Temas.ico("plus", 16)} Novo</a>
    </div>
    <div class="semana-nav">
      <button class="link" id="ant">‹ Anterior</button>
      <span>${esc(dataCurta(dias[0]))} — ${esc(dataCurta(dias[6]))}</span>
      <button class="link" id="prox">Próxima ›</button>
    </div>
    <div class="semana">
      ${dias.map(d => {
        const evs = eventosDoDia(d);
        return `<div class="dia ${mesmoDia(d, new Date()) ? "dia-hoje" : ""}">
          <h3>${esc(d.toLocaleDateString("pt-BR", { weekday: "short" }))} <b>${d.getDate()}</b></h3>
          ${evs.length ? evs.map(e => itemEvento(e)).join("") : `<p class="vazio">Livre</p>`}
        </div>`;
      }).join("")}
    </div>
    <section class="bloco">
      <div class="bloco-topo"><h2>Tarefas sem horário</h2><a class="link" href="#novo/tarefa">+ Tarefa</a></div>
      ${tarefas.length ? tarefas.map(e => itemEvento(e)).join("") : `<p class="vazio">Nenhuma tarefa. Crie uma e o Kliky encaixa no seu dia.</p>`}
    </section>`;
  $("#ant").addEventListener("click", () => { S.semana--; render(); });
  $("#prox").addEventListener("click", () => { S.semana++; render(); });
  ligarConcluir();
};

function formEvento(e = null, tipoInicial = "evento") {
  const ini = e && e.inicio ? new Date(e.inicio) : null;
  const tipo = e ? e.tipo : tipoInicial;
  const agendas = S.agendas;
  tela.innerHTML = `
    <div class="cabeca"><div><p class="sub"><a href="#agenda" class="link">‹ Agenda</a></p><h1>${e ? "Editar" : "Novo"}</h1></div></div>
    <form class="form cartao" id="fEv">
      <div class="seletor">
        <label><input type="radio" name="tipo" value="evento" ${tipo === "evento" ? "checked" : ""}><span>Compromisso</span></label>
        <label><input type="radio" name="tipo" value="tarefa" ${tipo === "tarefa" ? "checked" : ""}><span>Tarefa</span></label>
      </div>
      <label>Título<input name="titulo" required maxlength="160" value="${esc(e?.titulo)}" placeholder="Ex.: Dentista"></label>
      <div class="so-evento grade2">
        <label>Data<input type="date" name="data" value="${ini ? diaISO(ini) : diaISO(new Date())}"></label>
        <label>Hora<input type="time" name="hora" value="${ini && !e.dia_todo ? horaTxt(ini) : ""}"></label>
      </div>
      <label class="so-evento linha"><input type="checkbox" name="dia_todo" ${e?.dia_todo ? "checked" : ""}> Dia todo</label>
      <div class="grade2">
        <label>Duração
          <select name="duracao_min">${[15, 30, 45, 60, 90, 120, 180, 240].map(m => `<option value="${m}" ${(e?.duracao_min ?? 60) === m ? "selected" : ""}>${m < 60 ? m + " min" : m / 60 + " h"}</option>`).join("")}</select>
        </label>
        <label>Prioridade
          <select name="prioridade">${[[1, "Alta"], [2, "Média"], [3, "Baixa"]].map(([v, t]) => `<option value="${v}" ${(e?.prioridade ?? 2) === v ? "selected" : ""}>${t}</option>`).join("")}</select>
        </label>
      </div>
      <label class="so-evento">Lembrete
        <select name="lembrete_min">${[["", "Sem lembrete"], [10, "10 min antes"], [30, "30 min antes"], [60, "1 h antes"], [180, "3 h antes"], [1440, "1 dia antes"]].map(([v, t]) => `<option value="${v}" ${String(e?.lembrete_min ?? (e ? "" : 60)) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select>
      </label>
      <label>Local<input name="local" maxlength="160" value="${esc(e?.local)}" placeholder="Opcional"></label>
      ${agendas.length ? `<label>Agenda
        <select name="agenda_id"><option value="">Só minha</option>${agendas.map(a => `<option value="${a.id}" ${e?.agenda_id === a.id ? "selected" : ""}>${esc(a.nome)}</option>`).join("")}</select>
      </label>` : ""}
      <div class="acoes">
        <button class="btn" type="submit">Salvar</button>
        ${e ? `<button class="btn btn-ghost" type="button" id="excluir">Excluir</button>` : ""}
      </div>
    </form>`;
  const f = $("#fEv");
  const ajustar = () => f.classList.toggle("modo-tarefa", f.tipo.value === "tarefa");
  f.querySelectorAll("[name=tipo]").forEach(r => r.addEventListener("change", ajustar));
  ajustar();
  f.addEventListener("submit", async ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const corpo = {
      tipo: d.tipo, titulo: d.titulo, local: d.local || null,
      duracao_min: Number(d.duracao_min), prioridade: Number(d.prioridade),
      agenda_id: d.agenda_id ? Number(d.agenda_id) : null
    };
    if (d.tipo === "evento") {
      if (!d.data) return toast("Escolha a data.");
      const diaTodo = Boolean(d.dia_todo) || !d.hora;
      const [a, m, dd] = d.data.split("-").map(Number);
      const [hh, mm] = (diaTodo ? "09:00" : d.hora).split(":").map(Number);
      corpo.inicio = new Date(a, m - 1, dd, hh, mm).toISOString();
      corpo.dia_todo = diaTodo;
      corpo.lembrete_min = d.lembrete_min ? Number(d.lembrete_min) : null;
    } else {
      corpo.inicio = null; corpo.dia_todo = false; corpo.lembrete_min = null;
    }
    const salvo = await tentar(() => e ? api("PUT", `/eventos/${e.id}`, corpo) : api("POST", "/eventos", corpo), "Salvo");
    await carregarEventos();
    location.hash = salvo.tipo === "tarefa" ? "#agenda" : "#agenda";
  });
  const ex = $("#excluir");
  if (ex) ex.addEventListener("click", () => confirmarToque(ex, async () => {
    await tentar(() => api("DELETE", `/eventos/${e.id}`), "Excluído");
    S.eventos = S.eventos.filter(x => x.id !== e.id);
    location.hash = "#agenda";
  }));
}
telas.novo = arg => formEvento(null, arg === "tarefa" ? "tarefa" : "evento");
telas.editar = id => {
  const e = S.eventos.find(x => x.id === Number(id));
  if (!e) { location.hash = "#agenda"; return; }
  formEvento(e);
};

// ---------- Kliky (assistente) ----------
async function criarPeloKliky(frase) {
  const agora = new Date();
  const n = Kliky.semAcento(frase);
  const r = Kliky.interpretar(frase, agora);
  if (!r.titulo) return "Não entendi o que é. Tenta: \"dentista sexta 15h\".";

  if (r.tipo === "conta") {
    if (!r.vencimento) return `Qual o vencimento de "${r.titulo}"? Tenta: "pagar ${r.titulo.toLowerCase()} dia 10 R$ 100".`;
    const c = await tentar(() => api("POST", "/contas", { descricao: r.titulo, valor: r.valor || 0, vencimento: diaISO(r.vencimento) }));
    S.contas.push(c);
    return { msg: `Conta "${c.descricao}" de ${real(c.valor)} com vencimento ${dataCurta(r.vencimento)}.`, desfazer: ["contas", c.id] };
  }
  if (r.tipo === "habito") {
    const hb = await tentar(() => api("POST", "/habitos", { nome: r.titulo, meta_semana: 7 }));
    S.habitos.push(hb);
    return { msg: `Hábito "${hb.nome}" criado. Marque todo dia na tela Hábitos!`, desfazer: ["habitos", hb.id] };
  }
  const corpo = {
    tipo: r.tipo, titulo: r.titulo, prioridade: r.prioridade, duracao_min: r.duracao_min,
    inicio: r.inicio ? r.inicio.toISOString() : null, dia_todo: r.dia_todo, lembrete_min: r.lembrete_min
  };
  if (/\b(familia|equipe|grupo)\b/.test(n) && S.agendas.length) {
    const ag = S.agendas.find(a => n.includes(Kliky.semAcento(a.nome))) || null;
    if (ag) corpo.agenda_id = ag.id;
  }
  const ev = await tentar(() => api("POST", "/eventos", corpo));
  S.eventos.push(ev);
  if (ev.tipo === "tarefa") return { msg: `Tarefa "${ev.titulo}" anotada. Vou encaixar no seu dia.`, desfazer: ["eventos", ev.id] };
  const ini = new Date(ev.inicio);
  return {
    msg: `"${ev.titulo}" marcado para ${dataCurta(ini)}${ev.dia_todo ? " (dia todo)" : " às " + horaTxt(ini)}${ev.lembrete_min ? `. Aviso ${ev.lembrete_min >= 60 ? ev.lembrete_min / 60 + "h" : ev.lembrete_min + " min"} antes` : ""}.`,
    desfazer: ["eventos", ev.id]
  };
}
// Na tela Hoje o retorno vira texto
const _criar = criarPeloKliky;
criarPeloKliky = async f => { const r = await _criar(f); return typeof r === "string" ? r : r.msg; };

function responderPergunta(frase) {
  const n = Kliky.semAcento(frase);
  if (/\b(o que|quais?|tenho|agenda)\b.*\b(hoje|amanha)\b/.test(n) || /^(hoje|amanha)\??$/.test(n.trim())) {
    const d = /amanha/.test(n) ? somarDias(new Date(), 1) : new Date();
    const evs = eventosDoDia(d);
    return evs.length
      ? `${/amanha/.test(n) ? "Amanhã" : "Hoje"} você tem: ${evs.map(e => `${e.dia_todo ? "" : horaTxt(new Date(e.inicio)) + " "}${e.titulo}`).join(", ")}.`
      : `${/amanha/.test(n) ? "Amanhã" : "Hoje"} está livre!`;
  }
  if (/\b(contas?|vence|vencer|pagar)\b.*\?$|^(minhas )?contas\??$/.test(n)) {
    const ab = S.contas.filter(c => !c.paga);
    return ab.length ? `Contas em aberto: ${ab.map(c => `${c.descricao} (${real(c.valor)}, ${dataCurta(diaDeConta(c.vencimento))})`).join("; ")}.` : "Nenhuma conta em aberto.";
  }
  if (/^(oi|ola|e ai|bom dia|boa tarde|boa noite)\b/.test(n)) return `Oi, ${S.eu.nome.split(" ")[0]}! Me diga um compromisso, tarefa, conta ou hábito que eu organizo.`;
  if (/\b(ajuda|como funciona|o que voce faz)\b/.test(n)) return "Eu entendo frases como: \"dentista sexta 15h\", \"pagar luz dia 10 R$ 120\", \"estudar por 2h urgente\", \"beber água todo dia\" ou \"o que tenho amanhã?\".";
  return null;
}

telas.kliky = () => {
  if (!premium()) { tela.innerHTML = bloqueio("O Kliky é do Premium", "Com ele você escreve do seu jeito e ele cria compromissos, tarefas, contas e hábitos sozinho."); return; }
  if (!S.chat.length) S.chat.push({ de: "kliky", t: `Oi, ${S.eu.nome.split(" ")[0]}! Me diga o que precisa organizar.` });
  tela.innerHTML = `
    <div class="cabeca"><div><p class="sub">Seu assistente</p><h1>Kliky</h1></div></div>
    <section class="chat">
      <div class="chat-msgs" id="msgs">
        ${S.chat.map(m => `<div class="bolha bolha-${m.de}">${m.de === "kliky" ? `<img src="assets/kliky.svg" alt="" width="30" height="35">` : ""}<p>${esc(m.t)}${m.desfazer ? ` <button class="link" data-desfazer="${m.desfazer.join(":")}">Desfazer</button>` : ""}</p></div>`).join("")}
      </div>
      <div class="chips exemplos">
        ${["dentista sexta 15h", "pagar luz dia 10 R$ 120", "estudar por 2h urgente", "beber água todo dia", "o que tenho amanhã?"].map(x => `<button class="chip" data-ex="${esc(x)}">${esc(x)}</button>`).join("")}
      </div>
      <form class="rapido" id="fChat">
        <input name="t" placeholder="Escreva aqui…" autocomplete="off" maxlength="200">
        <button class="btn btn-small" type="submit">Enviar</button>
      </form>
    </section>`;
  const msgs = $("#msgs");
  msgs.scrollTop = msgs.scrollHeight;
  const f = $("#fChat");
  f.t.focus();
  async function enviar(t) {
    S.chat.push({ de: "eu", t });
    const resp = responderPergunta(t);
    if (resp) S.chat.push({ de: "kliky", t: resp });
    else {
      try {
        const r = await _criar(t);
        S.chat.push(typeof r === "string" ? { de: "kliky", t: r } : { de: "kliky", t: r.msg, desfazer: r.desfazer });
      } catch (e) { S.chat.push({ de: "kliky", t: "Não consegui salvar agora: " + e.message }); }
    }
    render();
  }
  f.addEventListener("submit", ev => { ev.preventDefault(); const t = f.t.value.trim(); if (t) enviar(t); });
  tela.querySelectorAll("[data-ex]").forEach(b => b.addEventListener("click", () => enviar(b.dataset.ex)));
  tela.querySelectorAll("[data-desfazer]").forEach(b => b.addEventListener("click", async () => {
    const [tipo, id] = b.dataset.desfazer.split(":");
    await tentar(() => api("DELETE", `/${tipo}/${id}`));
    const lista = { eventos: "eventos", contas: "contas", habitos: "habitos" }[tipo];
    S[lista] = S[lista].filter(x => x.id !== Number(id));
    S.chat.forEach(m => { if (m.desfazer && m.desfazer.join(":") === b.dataset.desfazer) delete m.desfazer; });
    S.chat.push({ de: "kliky", t: "Pronto, desfiz." });
    render();
  }));
};

// ---------- Contas ----------
telas.contas = () => {
  if (!premium()) { tela.innerHTML = bloqueio("Contas e metas são do Premium", "Veja seus vencimentos junto da agenda, receba avisos e controle quanto ainda pode gastar no mês."); return; }
  const hoje = new Date();
  const doMes = S.contas.filter(c => { const d = diaDeConta(c.vencimento); return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear(); });
  const total = doMes.reduce((s, c) => s + c.valor, 0);
  const pago = doMes.filter(c => c.paga).reduce((s, c) => s + c.valor, 0);
  const meta = S.eu.meta_gasto;
  const pct = meta ? Math.min(100, Math.round(total / meta * 100)) : 0;
  const lista = [...S.contas].sort((a, b) => a.paga - b.paga || diaDeConta(a.vencimento) - diaDeConta(b.vencimento));
  tela.innerHTML = `
    <div class="cabeca"><div><p class="sub">${esc(hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}</p><h1>Contas</h1></div></div>
    <section class="resumo">
      <div><span>Total do mês</span><strong>${real(total)}</strong></div>
      <div><span>Pago</span><strong class="verde">${real(pago)}</strong></div>
      <div><span>A pagar</span><strong class="rosa">${real(total - pago)}</strong></div>
      <div><span>${meta ? (total > meta ? "Passou da meta" : "Ainda pode gastar") : "Meta do mês"}</span><strong>${meta ? real(Math.abs(meta - total)) : "—"}</strong></div>
    </section>
    ${meta ? `<div class="barra ${total > meta ? "estourou" : ""}"><span style="width:${pct}%"></span></div><p class="sub centro">${pct}% da meta de ${real(meta)}</p>` : ""}
    <form class="form cartao linha-form" id="fMeta">
      <label>Meta de gasto do mês (R$)<input name="meta" inputmode="decimal" value="${meta ?? ""}" placeholder="Ex.: 1500"></label>
      <button class="btn btn-small" type="submit">Salvar meta</button>
    </form>
    <form class="form cartao" id="fConta">
      <h2>Nova conta</h2>
      <div class="grade3">
        <label>Descrição<input name="descricao" required maxlength="120" placeholder="Ex.: Luz"></label>
        <label>Valor (R$)<input name="valor" required inputmode="decimal" placeholder="0,00"></label>
        <label>Vencimento<input type="date" name="vencimento" required value="${diaISO(hoje)}"></label>
      </div>
      <button class="btn btn-small" type="submit">Adicionar</button>
    </form>
    <section class="bloco">
      ${lista.length ? lista.map(c => {
        const d = diaDeConta(c.vencimento);
        const atrasada = !c.paga && d < inicioDoDia();
        return `<div class="item ${c.paga ? "feito" : ""}">
          <button class="check ${c.paga ? "ok" : ""}" data-pagar="${c.id}" aria-label="Marcar como paga">${c.paga ? "✓" : ""}</button>
          <div class="item-corpo"><strong>${esc(c.descricao)}</strong>
            <span class="item-meta"><span>${real(c.valor)}</span><span class="${atrasada ? "atrasada" : ""}">${atrasada ? "Atrasada · " : ""}vence ${esc(dataCurta(d))}</span></span></div>
          <button class="link pequeno" data-apagar="${c.id}">Excluir</button>
        </div>`;
      }).join("") : `<p class="vazio">Nenhuma conta cadastrada.</p>`}
    </section>`;
  $("#fMeta").addEventListener("submit", async ev => {
    ev.preventDefault();
    const v = ev.target.meta.value.trim();
    S.eu = await tentar(() => api("PUT", "/eu", { meta_gasto: v ? v : null }), "Meta salva");
    render();
  });
  $("#fConta").addEventListener("submit", async ev => {
    ev.preventDefault();
    const c = await tentar(() => api("POST", "/contas", Object.fromEntries(new FormData(ev.target))), "Conta adicionada");
    S.contas.push(c);
    render();
  });
  tela.querySelectorAll("[data-pagar]").forEach(b => b.addEventListener("click", async () => {
    const c = S.contas.find(x => x.id === Number(b.dataset.pagar));
    Object.assign(c, await tentar(() => api("PUT", `/contas/${c.id}`, { paga: !c.paga })));
    render();
  }));
  tela.querySelectorAll("[data-apagar]").forEach(b => b.addEventListener("click", () => confirmarToque(b, async () => {
    await tentar(() => api("DELETE", `/contas/${b.dataset.apagar}`), "Conta excluída");
    S.contas = S.contas.filter(x => x.id !== Number(b.dataset.apagar));
    render();
  })));
};

// ---------- Hábitos ----------
async function marcarHabito(id, dia) {
  const r = await tentar(() => api("POST", `/habitos/${id}/marcar`, { dia }));
  const h = S.habitos.find(x => x.id === id);
  h.dias = r.marcado ? [...h.dias, dia] : h.dias.filter(d => d !== dia);
  if (r.marcado) toast("Mandou bem!");
  render();
}
function sequencia(h) {
  let n = 0, d = inicioDoDia();
  if (!h.dias.includes(diaISO(d))) d = somarDias(d, -1);
  while (h.dias.includes(diaISO(d))) { n++; d = somarDias(d, -1); }
  return n;
}
telas.habitos = () => {
  if (!premium()) { tela.innerHTML = bloqueio("Hábitos e metas são do Premium", "Acompanhe água, estudo, treino e leitura, com sequência e progresso da semana."); return; }
  const dias = [...Array(7)].map((_, i) => somarDias(inicioDoDia(), i - 6));
  tela.innerHTML = `
    <div class="cabeca"><div><p class="sub">Últimos 7 dias</p><h1>Hábitos</h1></div></div>
    <section class="bloco">
      ${S.habitos.length ? S.habitos.map(h => {
        const feitos = dias.filter(d => h.dias.includes(diaISO(d))).length;
        return `<div class="habito">
          <div class="habito-topo">
            <strong>${esc(h.nome)}</strong>
            <span class="pill">${sequencia(h)} dia${sequencia(h) === 1 ? "" : "s"}</span>
            <span class="sub">${feitos}/${h.meta_semana} na semana</span>
            <button class="link pequeno" data-apagar="${h.id}">Excluir</button>
          </div>
          <div class="habito-dias">
            ${dias.map(d => `<button class="bolinha ${h.dias.includes(diaISO(d)) ? "ok" : ""} ${mesmoDia(d, new Date()) ? "hoje" : ""}" data-h="${h.id}" data-d="${diaISO(d)}">
              <small>${esc(d.toLocaleDateString("pt-BR", { weekday: "narrow" }))}</small>${d.getDate()}</button>`).join("")}
          </div>
          <div class="barra"><span style="width:${Math.min(100, Math.round(feitos / h.meta_semana * 100))}%"></span></div>
        </div>`;
      }).join("") : `<p class="vazio">Nenhum hábito ainda. Crie o primeiro!</p>`}
    </section>
    <form class="form cartao" id="fHab">
      <h2>Novo hábito</h2>
      <div class="grade2">
        <label>Nome<input name="nome" required maxlength="80" placeholder="Ex.: Beber água"></label>
                <label>Vezes por semana<select name="meta_semana">${[7, 6, 5, 4, 3, 2, 1].map(n => `<option>${n}</option>`).join("")}</select></label>
      </div>
      <button class="btn btn-small" type="submit">Criar hábito</button>
    </form>`;
  tela.querySelectorAll("[data-h]").forEach(b => b.addEventListener("click", () => marcarHabito(Number(b.dataset.h), b.dataset.d)));
  $("#fHab").addEventListener("submit", async ev => {
    ev.preventDefault();
    const h = await tentar(() => api("POST", "/habitos", Object.fromEntries(new FormData(ev.target))), "Hábito criado");
    S.habitos.push(h);
    render();
  });
  tela.querySelectorAll("[data-apagar]").forEach(b => b.addEventListener("click", () => confirmarToque(b, async () => {
    await tentar(() => api("DELETE", `/habitos/${b.dataset.apagar}`), "Hábito excluído");
    S.habitos = S.habitos.filter(x => x.id !== Number(b.dataset.apagar));
    render();
  })));
};

// ---------- Grupos (agendas compartilhadas) ----------
telas.grupos = () => {
  const podeCriar = premium();
  tela.innerHTML = `
    <div class="cabeca"><div><p class="sub">Agendas compartilhadas</p><h1>Grupos</h1></div></div>
    <p class="sub">Os compromissos de um grupo aparecem na agenda de todos os membros. Para marcar, escolha o grupo no formulário do compromisso.</p>
    <section class="bloco">
      ${S.agendas.length ? S.agendas.map(a => `
        <div class="cartao grupo">
          <div class="bloco-topo"><h2>${esc(a.nome)}</h2>
            ${a.sou_dono ? `<button class="link pequeno" data-apagar-ag="${a.id}">Apagar grupo</button>`
              : `<button class="link pequeno" data-sair="${a.id}">Sair do grupo</button>`}
          </div>
          <div class="membros">${(a.membros || []).map(m => `<span class="pill">${esc(m.nome)}${m.usuario ? ` <small>@${esc(m.usuario)}</small>` : ""}${m.id === a.dono_id ? " · dono" : ""}
            ${a.sou_dono && m.id !== a.dono_id ? `<button class="x" data-remover="${a.id}:${m.id}" aria-label="Remover">✕</button>` : ""}</span>`).join("")}</div>
          ${a.sou_dono && podeCriar ? `<form class="linha-form" data-add="${a.id}">
            <input type="text" name="quem" required placeholder="@usuário ou e-mail de quem já tem conta" autocapitalize="none">
            <button class="btn btn-small" type="submit">Adicionar</button>
          </form>` : ""}
        </div>`).join("") : `<p class="vazio">Você ainda não participa de nenhum grupo.</p>`}
    </section>
    ${podeCriar ? `<form class="form cartao linha-form" id="fGrupo">
      <label>Novo grupo<input name="nome" required maxlength="80" placeholder="Ex.: Família, Equipe"></label>
      <button class="btn btn-small" type="submit">Criar grupo</button>
    </form>` : bloqueio("Criar grupos é do Premium", "Monte agendas da família ou da equipe. Você ainda vê os grupos em que foi convidado.")}`;
  const fG = $("#fGrupo");
  if (fG) fG.addEventListener("submit", async ev => {
    ev.preventDefault();
    await tentar(() => api("POST", "/agendas", { nome: ev.target.nome.value }), "Grupo criado");
    await carregarAgendas(); render();
  });
  tela.querySelectorAll("[data-add]").forEach(f => f.addEventListener("submit", async ev => {
    ev.preventDefault();
    await tentar(() => api("POST", `/agendas/${f.dataset.add}/membros`, { usuario: f.quem.value }), "Pessoa adicionada");
    await carregarAgendas(); render();
  }));
  tela.querySelectorAll("[data-remover]").forEach(b => b.addEventListener("click", async () => {
    const [a, m] = b.dataset.remover.split(":");
    await tentar(() => api("DELETE", `/agendas/${a}/membros/${m}`), "Removido");
    await carregarAgendas(); render();
  }));
  tela.querySelectorAll("[data-sair]").forEach(b => b.addEventListener("click", () => confirmarToque(b, async () => {
    await tentar(() => api("DELETE", `/agendas/${b.dataset.sair}/membros/${S.eu.id}`), "Você saiu do grupo");
    await Promise.all([carregarAgendas(), carregarEventos()]); render();
  })));
  tela.querySelectorAll("[data-apagar-ag]").forEach(b => b.addEventListener("click", () => confirmarToque(b, async () => {
    await tentar(() => api("DELETE", `/agendas/${b.dataset.apagarAg}`), "Grupo apagado");
    await Promise.all([carregarAgendas(), carregarEventos()]); render();
  })));
};

// ---------- Plano ----------
telas.plano = () => {
  const p = S.eu.plano;
  const ate = p.ate ? new Date(p.ate).toLocaleDateString("pt-BR") : null;
  const status = { premium: `Premium ativo até ${ate}`, teste: `Teste grátis até ${ate}`, basico: "Plano Básico" }[p.status];
  const link = window.FACCLIKY.CHECKOUT_URL;
  tela.innerHTML = `
    <div class="cabeca"><div><p class="sub">Sua assinatura</p><h1>Plano</h1></div></div>
    <section class="cartao plano-atual ${p.status}">
      <img src="assets/kliky.svg" alt="" width="80" height="92">
      <div><span class="sub">Seu plano</span><h2>${esc(status)}</h2></div>
    </section>
    <div class="plans">
      <div class="plan"><h3>Básico</h3><p class="price">Grátis</p>
        <ul><li>Agenda e compromissos</li><li>Tarefas e lembretes</li><li>Ver grupos em que foi convidado</li></ul></div>
      <div class="plan plan-pro"><span class="badge">Mais completo</span><h3>Premium</h3><p class="price">Premium</p>
        <ul><li>Tudo do Básico</li><li>Assistente Kliky</li><li>Dia planejado automático</li><li>Contas e metas de gasto</li><li>Hábitos e metas</li><li>Criar grupos compartilhados</li></ul>
        ${link ? `<a class="btn" href="${esc(link)}${link.includes("?") ? "&" : "?"}email=${encodeURIComponent(S.eu.email)}" target="_blank" rel="noopener">${p.status === "premium" ? "Renovar" : "Assinar Premium"}</a>`
          : `<button class="btn" disabled>Pagamento em breve</button>`}
      </div>
    </div>
    <p class="sub centro">Pagamento seguro pelo BravoPay. O Premium é liberado automaticamente após a confirmação.</p>`;
};

// ---------- Configurações ----------
telas.config = () => {
  const notif = "Notification" in window ? Notification.permission : "indisponivel";
  tela.innerHTML = `
    <div class="cabeca"><div><p class="sub"><a href="#perfil" class="link">‹ Perfil</a></p><h1>Configurações</h1></div></div>
    <section class="cartao config-linha">
      <div><strong>Avisos no aparelho</strong><p class="sub">${notif === "granted" ? "Ativados" : notif === "denied" ? "Bloqueados no navegador" : notif === "indisponivel" ? "Não suportado neste navegador" : "Receba lembretes dos compromissos"}</p></div>
      ${notif === "default" ? `<button class="btn btn-small" id="ativarNotif">Ativar</button>` : ""}
    </section>
    <a href="#plano" class="cartao config-linha so-cel"><div><strong>Plano</strong><p class="sub">Ver ou assinar o Premium</p></div><span>›</span></a>
    <form class="form cartao" id="fSenha">
      <h2>Trocar senha</h2>
      <div class="grade2">
        <label>Senha atual<input type="password" name="atual" required autocomplete="current-password"></label>
        <label>Nova senha<input type="password" name="nova" required minlength="6" autocomplete="new-password"></label>
      </div>
      <button class="btn btn-small" type="submit">Trocar senha</button>
    </form>
    <section class="cartao config-linha">
      <div><strong>Sair da conta</strong><p class="sub">Você pode entrar de novo quando quiser.</p></div>
      <button class="btn btn-ghost btn-small" id="sair">Sair</button>
    </section>
    <form class="form cartao perigo-zona" id="fExcluir">
      <h2>Excluir conta</h2>
      <p class="sub">Apaga sua conta e todos os seus dados. Não dá para desfazer.</p>
      <div class="linha-form">
        <input type="password" name="senha" required placeholder="Digite sua senha para confirmar" autocomplete="current-password">
        <button class="btn btn-ghost btn-small" type="submit">Excluir conta</button>
      </div>
    </form>`;
  const an = $("#ativarNotif");
  if (an) an.addEventListener("click", async () => { await Notification.requestPermission(); render(); });
  $("#fSenha").addEventListener("submit", async ev => {
    ev.preventDefault();
    await tentar(() => api("PUT", "/eu/senha", Object.fromEntries(new FormData(ev.target))), "Senha trocada");
    ev.target.reset();
  });
  $("#sair").addEventListener("click", () => Faccliky.sair());
  $("#fExcluir").addEventListener("submit", ev => {
    ev.preventDefault();
    const b = ev.target.querySelector("button");
    confirmarToque(b, async () => {
      await tentar(() => api("DELETE", "/eu", { senha: ev.target.senha.value }));
      Faccliky.sair();
    });
  });
};

// ---------- Navegação ----------
function render() {
  if (!S.eu) return; // ainda carregando
  const [nome, arg] = (location.hash.slice(1) || "hoje").split("/");
  const fn = telas[nome] || telas.hoje;
  document.querySelectorAll("#nav [data-tela]").forEach(a => {
    const ativa = a.dataset.tela === nome || (a.dataset.tela === "agenda" && ["novo", "editar"].includes(nome)) || (a.dataset.tela === "perfil" && nome === "editar-perfil");
    a.classList.toggle("ativo", ativa);
  });
  document.body.classList.toggle("em-hoje", nome === "hoje");
  fn(arg);
  if (window.aoRenderizar) window.aoRenderizar(nome);
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

// ---------- Lembretes ----------
function avisados() { try { return JSON.parse(localStorage.getItem("faccliky_avisados") || "{}"); } catch { return {}; } }
function salvarAvisados(o) { try { localStorage.setItem("faccliky_avisados", JSON.stringify(o)); } catch {} }
function avisar(titulo, corpo) {
  toast(`${titulo}: ${corpo}`, 8000);
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(titulo, { body: corpo, icon: "assets/kliky.svg" }); } catch {}
  }
}
function checarLembretes() {
  const agora = Date.now();
  const feitos = avisados();
  for (const e of S.eventos) {
    if (!e.inicio || e.lembrete_min === null || e.lembrete_min === undefined || e.concluido) continue;
    const ini = new Date(e.inicio).getTime();
    const chave = `e${e.id}@${e.inicio}`;
    if (agora >= ini - e.lembrete_min * 60000 && agora < ini && !feitos[chave]) {
      feitos[chave] = 1;
      avisar(e.titulo, `${e.dia_todo ? "hoje" : "às " + horaTxt(new Date(ini))}`);
    }
  }
  const hojeISO = diaISO(new Date());
  const amanha = somarDias(inicioDoDia(), 1);
  for (const c of S.contas) {
    const chave = `c${c.id}@${hojeISO}`;
    if (!c.paga && diaDeConta(c.vencimento) <= amanha && !feitos[chave]) {
      feitos[chave] = 1;
      const d = diaDeConta(c.vencimento);
      avisar(`Conta: ${c.descricao}`, `${real(c.valor)} ${d < inicioDoDia() ? "está atrasada" : mesmoDia(d, new Date()) ? "vence hoje" : "vence amanhã"}`);
    }
  }
  salvarAvisados(feitos);
}

// ---------- Início ----------
window.addEventListener("load", async () => {
  try {
    await carregarTudo();
    render();
    checarLembretes();
    setInterval(checarLembretes, 30000);
    setInterval(async () => { try { await carregarEventos(); } catch {} }, 5 * 60000);
  } catch (e) {
    tela.innerHTML = `<div class="bloqueio"><img src="assets/kliky.svg" alt="" width="100" height="115">
      <h2>Não consegui conectar</h2><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`;
  }
});
