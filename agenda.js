// Tela Agenda: visões Mês, Semana e Lista, com contas junto dos compromissos.
(() => {
  const $ = s => document.querySelector(s);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  S.agVista = S.agVista || "mes";
  S.agMes = S.agMes || 0;
  S.agSel = S.agSel || diaISO(new Date());

  const contasDoDia = d => S.contas.filter(c => !c.paga && mesmoDia(diaDeConta(c.vencimento), d));
  const itemConta = c => `<a class="item item-conta" href="#contas"><div class="item-corpo"><strong>${esc(c.descricao)}</strong><span class="item-meta"><span>${real(c.valor)}</span><span>vence hoje</span></span></div></a>`;
  const doISO = iso => { const [a, m, d] = iso.split("-").map(Number); return new Date(a, m - 1, d); };

  function mesGrade() {
    const hoje = inicioDoDia(), ref = new Date(hoje.getFullYear(), hoje.getMonth() + S.agMes, 1);
    const ini = somarDias(ref, -ref.getDay());
    const todas = Array.from({ length: 42 }, (_, i) => somarDias(ini, i));
    return { ref, celulas: todas[35].getMonth() === ref.getMonth() ? todas : todas.slice(0, 35) };
  }

  function painelDia() {
    const d = doISO(S.agSel), evs = eventosDoDia(d), cts = contasDoDia(d);
    return `<aside class="ag-painel">
      <header><div><small>${mesmoDia(d, new Date()) ? "Hoje" : ""}</small><h2>${esc(cap(d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })))}</h2></div>
        <a href="#novo" class="btn btn-small btn-icon" aria-label="Novo compromisso">${Temas.ico("plus", 18)}</a></header>
      ${evs.map(e => itemEvento(e)).join("")}${cts.map(itemConta).join("")}
      ${evs.length || cts.length ? "" : `<p class="vazio">Dia livre. Que tal escrever algo na busca (Ctrl+K)?</p>`}
    </aside>`;
  }

  function vistaMes() {
    const { ref, celulas } = mesGrade(), hoje = new Date();
    const titulo = cap(ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
    return `<div class="ag-mes-wrap">
      <section class="ag-mes">
        <div class="ag-nav"><h2>${esc(titulo)}</h2><div>
          <button class="ag-n" id="mAnt" aria-label="Mês anterior">${Temas.ico("chevron", 18)}</button>
          <button class="btn btn-ghost btn-small" id="mHoje">Hoje</button>
          <button class="ag-n" id="mProx" aria-label="Próximo mês">${Temas.ico("chevron", 18)}</button></div></div>
        <div class="ag-sem">${DIAS.map(d => `<span>${d}</span>`).join("")}</div>
        <div class="ag-grade">${celulas.map(d => {
          const evs = eventosDoDia(d), cts = contasDoDia(d), iso = diaISO(d), n = evs.length + cts.length;
          const chips = [...evs.map(e => ({ t: e.titulo, h: e.dia_todo ? "" : horaTxt(new Date(e.inicio)), c: "" })), ...cts.map(c => ({ t: c.descricao, h: "R$", c: "conta" }))];
          return `<button class="ag-dia ${d.getMonth() !== ref.getMonth() ? "fora" : ""} ${mesmoDia(d, hoje) ? "hoje" : ""} ${iso === S.agSel ? "sel" : ""}" data-dia="${iso}">
            <b>${d.getDate()}</b>
            <span class="ag-chips">${chips.slice(0, 2).map(c => `<i class="${c.c}"><em>${esc(c.h)}</em> ${esc(c.t)}</i>`).join("")}${n > 2 ? `<u>+${n - 2}</u>` : ""}</span>
            <span class="ag-pts">${"<s></s>".repeat(Math.min(n, 3))}</span>
          </button>`;
        }).join("")}</div>
      </section>
      ${painelDia()}
    </div>`;
  }

  function vistaSemana() {
    const base = somarDias(inicioDoDia(), S.semana * 7), dias = Array.from({ length: 7 }, (_, i) => somarDias(base, i));
    return `<div class="ag-nav"><h2>${esc(dataCurta(dias[0]))} — ${esc(dataCurta(dias[6]))}</h2><div>
        <button class="ag-n" id="sAnt" aria-label="Semana anterior">${Temas.ico("chevron", 18)}</button>
        <button class="btn btn-ghost btn-small" id="sHoje">Hoje</button>
        <button class="ag-n" id="sProx" aria-label="Próxima semana">${Temas.ico("chevron", 18)}</button></div></div>
      <div class="ag-semana">${dias.map(d => {
        const evs = eventosDoDia(d), cts = contasDoDia(d);
        return `<div class="ag-col ${mesmoDia(d, new Date()) ? "hoje" : ""}"><h3>${esc(d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""))} <b>${d.getDate()}</b></h3>
          ${evs.map(e => itemEvento(e)).join("")}${cts.map(itemConta).join("")}
          ${evs.length || cts.length ? "" : `<p class="vazio">Livre</p>`}</div>`;
      }).join("")}</div>`;
  }

  function vistaLista() {
    const hoje = inicioDoDia(), blocos = [];
    for (let i = 0; i < 30; i++) {
      const d = somarDias(hoje, i), evs = eventosDoDia(d), cts = contasDoDia(d);
      if (evs.length || cts.length) blocos.push(`<section class="ag-lista-dia"><h3>${esc(cap(d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })))}</h3>${evs.map(e => itemEvento(e)).join("")}${cts.map(itemConta).join("")}</section>`);
    }
    return blocos.length ? `<div class="ag-lista">${blocos.join("")}</div>` : `<p class="vazio">Nada marcado nos próximos 30 dias.</p>`;
  }

  telas.agenda = () => {
    const tarefas = S.eventos.filter(e => e.tipo === "tarefa").sort((a, b) => a.concluido - b.concluido || a.prioridade - b.prioridade);
    const v = S.agVista;
    tela.innerHTML = `
      <div class="ag-topo">
        <h1>Agenda</h1>
        <div class="ag-seg" role="tablist">${[["mes", "Mês"], ["semana", "Semana"], ["lista", "Lista"]].map(([k, n]) => `<button class="${v === k ? "on" : ""}" data-v="${k}" role="tab">${n}</button>`).join("")}</div>
        <a href="#novo" class="btn btn-small">${Temas.ico("plus", 16)} Novo</a>
      </div>
      ${v === "mes" ? vistaMes() : v === "semana" ? vistaSemana() : vistaLista()}
      <section class="bloco ag-tarefas">
        <div class="bloco-topo"><h2>Tarefas sem horário</h2><a class="link" href="#novo/tarefa">+ Tarefa</a></div>
        ${tarefas.length ? tarefas.map(e => itemEvento(e)).join("") : `<p class="vazio">Nenhuma tarefa. Crie uma e o Kliky encaixa no seu dia.</p>`}
      </section>`;

    tela.querySelectorAll("[data-v]").forEach(b => b.addEventListener("click", () => { S.agVista = b.dataset.v; render(); }));
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
    on("#mAnt", () => { S.agMes--; render(); }); on("#mProx", () => { S.agMes++; render(); });
    on("#mHoje", () => { S.agMes = 0; S.agSel = diaISO(new Date()); render(); });
    on("#sAnt", () => { S.semana--; render(); }); on("#sProx", () => { S.semana++; render(); }); on("#sHoje", () => { S.semana = 0; render(); });
    tela.querySelectorAll("[data-dia]").forEach(b => b.addEventListener("click", () => { S.agSel = b.dataset.dia; render(); }));
    ligarConcluir();
  };
})();
