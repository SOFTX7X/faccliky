// Tela "Hoje": capa em pixels, saudação, campo do Kliky e cartões do dia.
(() => {
  const $ = s => document.querySelector(s);
  let pixelsAtivo = null;
  const dia7 = (fim) => Array.from({ length: 7 }, (_, i) => somarDias(fim, i - 6));
  const SUGESTOES = ["dentista sexta 15h", "pagar luz dia 10 R$ 120", "estudar inglês amanhã 8h", "beber água todo dia"];

  window.pararHoje = () => { if (pixelsAtivo) { pixelsAtivo.parar(); pixelsAtivo = null; } };

  telas.hoje = () => {
    if (pixelsAtivo) { pixelsAtivo.parar(); pixelsAtivo = null; }
    const agora = new Date(), h = agora.getHours();
    const saud = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const hojeISO = diaISO(agora);
    const evHoje = eventosDoDia(agora);
    const pend = tarefasPendentes();
    const feitas = S.eventos.filter(e => e.tipo === "tarefa" && e.concluido).length;

    // próximo compromisso
    const prox = S.eventos.filter(e => e.tipo === "evento" && e.inicio && !e.concluido && new Date(e.inicio) > agora)
      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0];
    let proxTxt = "Nada marcado pela frente. Dia livre.";
    if (prox) {
      const ini = new Date(prox.inicio), min = Math.round((ini - agora) / 60000);
      const quando = min < 60 ? `em ${min} min` : min < 1440 ? `em ${Math.round(min / 60)} h` : dataCurta(ini);
      proxTxt = `Próximo: ${prox.titulo}${prox.dia_todo ? "" : " às " + horaTxt(ini)} · ${quando}`;
    }

    // progresso do dia
    const passados = evHoje.filter(e => !e.dia_todo && new Date(e.inicio) < agora).length;
    const totalDia = evHoje.length + pend.length + feitas;
    const pct = totalDia ? Math.round(((passados + feitas) / totalDia) * 100) : 0;

    // linha do tempo
    let dia;
    if (premium()) {
      const { linha, naoCoube } = Kliky.planejarDia(evHoje.filter(e => !e.concluido), pend, agora);
      const diaTodo = evHoje.filter(e => e.dia_todo);
      dia = `${diaTodo.map(e => itemEvento(e)).join("")}
        ${linha.length ? `<div class="linha-tempo">${linha.map(e => itemEvento(e)).join("")}</div>` : `<p class="vazio">Nada marcado para o resto de hoje. Aproveite!</p>`}
        ${naoCoube.length ? `<p class="aviso-leve">Não coube hoje: ${naoCoube.map(t => esc(t.titulo)).join(", ")}.</p>` : ""}`;
    } else {
      dia = evHoje.length ? evHoje.map(e => itemEvento(e)).join("") : `<p class="vazio">Nada marcado para hoje.</p>`;
    }

    // contas
    const limite = somarDias(inicioDoDia(), 3);
    const contasPerto = S.contas.filter(c => !c.paga && diaDeConta(c.vencimento) <= limite);
    const travado = (titulo, txt) => `<div class="h-trava">${Temas.ico("lock", 20)}<b>${titulo}</b><span>${txt}</span><a class="btn btn-small" href="#plano">Ver Premium</a></div>`;

    const cartaoContas = !premium() ? travado("Contas", "Vencimentos e metas de gasto no Premium.") :
      contasPerto.length ? contasPerto.map(c => `<a class="h-linha" href="#contas"><span><b>${esc(c.descricao)}</b><small class="${diaDeConta(c.vencimento) < inicioDoDia() ? "atrasada" : ""}">vence ${esc(dataCurta(diaDeConta(c.vencimento)))}</small></span><em>${real(c.valor)}</em></a>`).join("")
        : `<p class="vazio">Nenhuma conta vencendo nos próximos dias.</p>`;

    const dias7 = dia7(inicioDoDia());
    const cartaoHabitos = !premium() ? travado("Hábitos", "Acompanhe sua sequência no Premium.") :
      S.habitos.length ? S.habitos.map(hb => `
        <div class="h-hab">
          <span class="nome">${esc(hb.nome)}</span>
          <span class="seq">${Temas.ico("flame", 14)}${sequencia(hb)}</span>
          <div class="qd">${dias7.map((d, i) => {
            const iso = diaISO(d), on = hb.dias.includes(iso);
            return i === 6 ? `<button class="q hoje ${on ? "on" : ""}" data-habito="${hb.id}" aria-label="Marcar hoje"></button>` : `<i class="q ${on ? "on" : ""}"></i>`;
          }).join("")}</div>
        </div>`).join("") : `<p class="vazio">Sem hábitos ainda. Escreva "beber água todo dia" ali em cima.</p>`;

    const tarefas = pend.slice(0, 6);
    const cartaoTarefas = tarefas.length ? tarefas.map(t => `
        <div class="h-tar"><button class="check" data-concluir="${t.id}" aria-label="Concluir"></button>
        <a href="#editar/${t.id}"><b>${esc(t.titulo)}</b>${t.prioridade === 1 ? `<span class="pill pill-alta">Importante</span>` : ""}</a></div>`).join("") +
      (pend.length > 6 ? `<a class="link pequeno" href="#agenda">Ver todas (${pend.length})</a>` : "")
      : `<p class="vazio">Tudo feito por aqui.</p>`;

    const semana = dias7.map((_, i) => somarDias(inicioDoDia(), i)).map(d => {
      const n = eventosDoDia(d).length;
      return `<a href="#agenda" class="h-sem ${mesmoDia(d, agora) ? "hoje" : ""}"><small>${d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small><b>${d.getDate()}</b><i class="${n ? "tem" : ""}">${n || ""}</i></a>`;
    }).join("");

    tela.innerHTML = `
      <section class="h-capa" id="banner">
        <canvas class="h-pixels" id="pixelsCapa" aria-hidden="true"></canvas>
        <a class="h-trocar" href="#editar-perfil">${Temas.ico("image", 15)} Trocar capa</a>
        <div class="h-saud">
          <h1>${saud}, ${esc(S.eu.nome.split(" ")[0])}.</h1>
          <p class="data">${esc(dataLonga(agora))}</p>
          <p class="prox">${Temas.ico("clock", 15)} ${esc(proxTxt)}</p>
        </div>
      </section>
      <div class="h-corpo">
        <form class="h-compor" id="rapido" autocomplete="off">
          <div class="h-compor-linha">
            <img src="assets/kliky.svg" alt="" width="30" height="35">
            <input name="t" placeholder="Escreva: dentista sexta 15h" maxlength="200" aria-label="Escrever para o Kliky">
            <button class="h-enviar" type="submit" aria-label="Criar">${Temas.ico("arrowup", 18)}</button>
          </div>
          <div class="h-sug">${SUGESTOES.map(s => `<button type="button" data-sug="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        </form>
        ${faixaPlano()}
        <div class="h-grid">
          <section class="h-card h-dia">
            <header><h2>Seu dia</h2>
              <div class="h-ring" style="--p:${pct}" title="${pct}% do dia"><span>${totalDia ? pct + "%" : "–"}</span></div>
              ${premium() ? `<button class="link" id="reorg">${Temas.ico("refresh", 15)} Reorganizar</button>` : ""}
            </header>${dia}
          </section>
          <section class="h-card"><header><h2>Hábitos</h2><a class="link" href="#habitos">Ver todos</a></header>${cartaoHabitos}</section>
          <section class="h-card"><header><h2>Tarefas</h2><span class="h-cont">${pend.length}</span></header>${cartaoTarefas}</section>
          <section class="h-card"><header><h2>Contas</h2><a class="link" href="#contas">Ver todas</a></header>${cartaoContas}</section>
          <section class="h-card"><header><h2>Semana</h2><a class="link" href="#agenda">Agenda</a></header><div class="h-semana">${semana}</div></section>
        </div>
      </div>`;

    Perfil.pintarBanner($("#banner"), S.eu.capa || "p:ametista");
    pixelsAtivo = Pixels.iniciar($("#pixelsCapa"), { qtd: 110, raio: 120 });

    const form = $("#rapido");
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      const t = form.t.value.trim();
      if (!t) return;
      if (!premium()) { toast("O assistente Kliky é do Premium. Use o botão + para criar um compromisso."); return; }
      const r = await criarPeloKliky(t);
      if (r) { form.reset(); toast(r); render(); }
    });
    form.querySelectorAll("[data-sug]").forEach(b => b.addEventListener("click", () => { form.t.value = b.dataset.sug; form.t.focus(); }));
    const reorg = $("#reorg");
    if (reorg) reorg.addEventListener("click", () => { render(); toast("Dia reorganizado a partir de agora"); });
    ligarConcluir();
    tela.querySelectorAll("[data-habito]").forEach(b => b.addEventListener("click", () => marcarHabito(Number(b.dataset.habito), hojeISO)));
  };
})();
