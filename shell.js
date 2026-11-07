// Estrutura do app: barra do topo, dock flutuante, menu "+", busca (Ctrl+K) e avisos.
(() => {
  const $ = s => document.querySelector(s);
  const sa = s => Kliky.semAcento(String(s || ""));
  const IC = n => Temas.ico(n, 18);

  const IR = [
    { id: "hoje", nome: "Hoje", ic: "home" }, { id: "agenda", nome: "Agenda", ic: "cal" }, { id: "kliky", nome: "Kliky", ic: "bot" },
    { id: "contas", nome: "Contas", ic: "money" }, { id: "habitos", nome: "Hábitos", ic: "flame" }, { id: "grupos", nome: "Grupos", ic: "users" },
    { id: "perfil", nome: "Perfil", ic: "user" }, { id: "editar-perfil", nome: "Editar perfil", ic: "edit" }, { id: "aparencia", nome: "Aparência e papel de parede", ic: "palette" },
    { id: "plano", nome: "Plano", ic: "star" }, { id: "config", nome: "Configurações", ic: "gear" }
  ];

  // ---------- Barra do topo ----------
  const topo = $("#topo");
  const marcarTopo = () => topo.classList.toggle("solido", !document.body.classList.contains("em-hoje") || scrollY > 150);
  addEventListener("scroll", marcarTopo, { passive: true });
  window.aoRenderizar = nome => {
    if (nome !== "hoje" && window.pararHoje) window.pararHoje();
    marcarTopo(); fecharPopovers(); atualizarSino();
  };

  // ---------- Popovers (menu +, avisos) ----------
  const pop = document.createElement("div");
  pop.className = "pop"; pop.hidden = true; document.body.appendChild(pop);
  let popDe = null;
  function fecharPopovers() { pop.hidden = true; popDe = null; $("#maisBt").setAttribute("aria-expanded", "false"); }
  function abrirPop(de, html, classe) {
    if (popDe === de) return fecharPopovers();
    pop.className = "pop " + classe; pop.innerHTML = html; pop.hidden = false; popDe = de;
    Temas.preencherIcones(pop);
    return true;
  }
  document.addEventListener("click", e => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest("#maisBt, #sino")) fecharPopovers(); });

  $("#maisBt").addEventListener("click", () => {
    const abriu = abrirPop("mais", `
      <button data-novo="kliky"><span data-ico="bot" data-tam="18"></span><div><b>Escrever com o Kliky</b><small>"dentista sexta 15h"</small></div></button>
      <a href="#novo"><span data-ico="cal" data-tam="18"></span><div><b>Compromisso</b><small>Data, hora e lembrete</small></div></a>
      <a href="#novo/tarefa"><span data-ico="task" data-tam="18"></span><div><b>Tarefa</b><small>Entra no seu dia sozinha</small></div></a>
      <a href="#contas"><span data-ico="money" data-tam="18"></span><div><b>Conta</b><small>Vencimento e valor</small></div></a>
      <a href="#habitos"><span data-ico="flame" data-tam="18"></span><div><b>Hábito</b><small>Marque todo dia</small></div></a>`, "pop-mais");
    $("#maisBt").setAttribute("aria-expanded", abriu ? "true" : "false");
  });
  pop.addEventListener("click", e => {
    if (e.target.closest("[data-novo='kliky']")) { fecharPopovers(); abrirBusca("", true); }
    else if (e.target.closest("a")) fecharPopovers();
  });

  // ---------- Avisos (sino) ----------
  function avisosAgora() {
    const agora = new Date(), lista = [];
    for (const c of S.contas) {
      if (c.paga) continue;
      const d = diaDeConta(c.vencimento);
      if (d <= somarDias(inicioDoDia(), 2)) lista.push({ txt: `${c.descricao} · ${real(c.valor)}`, sub: d < inicioDoDia() ? "atrasada" : mesmoDia(d, agora) ? "vence hoje" : "vence " + dataCurta(d), href: "#contas", forte: d < inicioDoDia() });
    }
    for (const e of S.eventos) {
      if (e.tipo !== "evento" || !e.inicio || e.concluido) continue;
      const ini = new Date(e.inicio), dif = ini - agora;
      if (dif > 0 && dif < 24 * 3600000) lista.push({ txt: e.titulo, sub: e.dia_todo ? "hoje" : "às " + horaTxt(ini), href: "#editar/" + e.id });
    }
    return lista;
  }
  function atualizarSino() {
    const n = S.eu ? avisosAgora().length : 0;
    $("#sinoPonto").hidden = !n;
  }
  $("#sino").addEventListener("click", () => {
    const l = avisosAgora();
    abrirPop("sino", `<div class="pop-tit">Avisos</div>` + (l.length
      ? l.map(a => `<a href="${a.href}"><div><b>${esc(a.txt)}</b><small class="${a.forte ? "atrasada" : ""}">${esc(a.sub)}</small></div></a>`).join("")
      : `<p class="vazio pad">Nada pendente. Tudo em dia.</p>`), "pop-sino");
  });

  // ---------- Busca / comandos ----------
  const pal = document.createElement("div");
  pal.className = "pal"; pal.hidden = true;
  pal.innerHTML = `<div class="pal-fundo"></div>
    <div class="pal-caixa" role="dialog" aria-modal="true" aria-label="Buscar">
      <div class="pal-campo"><span data-ico="search" data-tam="18"></span><input id="palIn" placeholder="Buscar ou escrever para o Kliky…" autocomplete="off" maxlength="200"><kbd>Esc</kbd></div>
      <div class="pal-lista" id="palLista" role="listbox"></div>
      <div class="pal-rodape"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span></div>
    </div>`;
  document.body.appendChild(pal);
  const palIn = pal.querySelector("#palIn"), palLista = pal.querySelector("#palLista");
  let itens = [], sel = 0;

  function montar(q) {
    const n = sa(q.trim()), r = [];
    const bate = t => !n || sa(t).includes(n);
    IR.filter(t => bate(t.nome)).slice(0, n ? 4 : 11).forEach(t => r.push({ ic: t.ic, tit: t.nome, sub: n ? "Ir para" : "", ir: "#" + t.id }));
    if (n) {
      S.eventos.filter(e => bate(e.titulo)).slice(0, 5).forEach(e => r.push({ ic: e.tipo === "tarefa" ? "task" : "cal", tit: e.titulo, sub: e.tipo === "tarefa" ? "Tarefa" : e.inicio ? dataCurta(new Date(e.inicio)) + (e.dia_todo ? "" : " · " + horaTxt(new Date(e.inicio))) : "Compromisso", ir: "#editar/" + e.id }));
      S.contas.filter(c => bate(c.descricao)).slice(0, 3).forEach(c => r.push({ ic: "money", tit: c.descricao, sub: real(c.valor) + (c.paga ? " · paga" : ""), ir: "#contas" }));
      S.habitos.filter(h => bate(h.nome)).slice(0, 3).forEach(h => r.push({ ic: "flame", tit: h.nome, sub: "Hábito", ir: "#habitos" }));
    } else {
      S.eventos.filter(e => e.tipo === "evento" && e.inicio && new Date(e.inicio) > new Date()).sort((a, b) => new Date(a.inicio) - new Date(b.inicio)).slice(0, 3)
        .forEach(e => r.push({ ic: "cal", tit: e.titulo, sub: "Próximo · " + dataCurta(new Date(e.inicio)), ir: "#editar/" + e.id }));
    }
    if (q.trim().length > 2) r.push({ ic: "bot", tit: `Criar com o Kliky: "${q.trim()}"`, sub: premium() ? "Cria compromisso, tarefa, conta ou hábito" : "Premium", criar: q.trim() });
    return r;
  }
  function desenhar() {
    palLista.innerHTML = itens.length ? itens.map((i, k) => `<button class="pal-item ${k === sel ? "sel" : ""}" data-k="${k}" role="option"><span class="ic">${IC(i.ic)}</span><span class="tx"><b>${esc(i.tit)}</b>${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</span></button>`).join("") : `<p class="vazio pad">Nada encontrado.</p>`;
    const s = palLista.querySelector(".sel"); if (s) s.scrollIntoView({ block: "nearest" });
  }
  async function executar(i) {
    if (!i) return;
    if (i.ir) { fecharBusca(); location.hash = i.ir.slice(1); return; }
    if (i.criar) {
      if (!premium()) { fecharBusca(); toast("O assistente Kliky é do Premium."); location.hash = "plano"; return; }
      const t = i.criar; fecharBusca();
      const r = await criarPeloKliky(t);
      if (r) { toast(r); render(); atualizarSino(); }
    }
  }
  function abrirBusca(q = "", criar = false) {
    fecharPopovers(); pal.hidden = false; palIn.value = q;
    itens = montar(q); sel = criar ? itens.length - 1 : 0; desenhar(); palIn.focus();
    if (criar) palIn.placeholder = "Escreva: dentista sexta 15h";
  }
  function fecharBusca() { pal.hidden = true; palIn.placeholder = "Buscar ou escrever para o Kliky…"; }
  palIn.addEventListener("input", () => { itens = montar(palIn.value); sel = 0; desenhar(); });
  palIn.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, itens.length); desenhar(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + itens.length) % Math.max(1, itens.length); desenhar(); }
    else if (e.key === "Enter") { e.preventDefault(); executar(itens[sel]); }
  });
  palLista.addEventListener("click", e => { const b = e.target.closest(".pal-item"); if (b) executar(itens[Number(b.dataset.k)]); });
  pal.querySelector(".pal-fundo").addEventListener("click", fecharBusca);
  $("#abrirBusca").addEventListener("click", () => abrirBusca());
  addEventListener("keydown", e => {
    const campo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.hidden ? abrirBusca() : fecharBusca(); }
    else if (e.key === "Escape") { if (!pal.hidden) fecharBusca(); else fecharPopovers(); }
    else if (e.key === "/" && !campo && pal.hidden) { e.preventDefault(); abrirBusca(); }
  });

  Temas.preencherIcones();
})();
