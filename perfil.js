// Perfil, Editar perfil e Aparência (usa S, tela, api, tentar, toast, telas do app.js)
const Perfil = (() => {
  const $ = s => document.querySelector(s);
  const iniciais = nome => {
    const p = String(nome || "?").trim().split(/\s+/);
    return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  };
  const avatar = (u, extra = "") => u && u.avatar
    ? `<img class="avatar ${extra}" src="${esc(u.avatar)}" alt="">`
    : `<span class="avatar ${extra}">${esc(iniciais(u && u.nome))}</span>`;
  const pintar = (el, valor) => { if (el) el.style.setProperty("--capa", Temas.css(valor)); };

  // Chamado sempre que a conta é (re)carregada
  function aoCarregar() {
    const e = S.eu;
    Temas.aplicar(e.papel, e.papel_escuro);
    try { localStorage.setItem("faccliky_tema", JSON.stringify({ papel: e.papel, escuro: e.papel_escuro })); } catch {}
    const nav = $("#navUsuario");
    if (nav) nav.innerHTML = `${avatar(e)}<div><b>${esc(e.nome)}</b><small>@${esc(e.usuario || "")}</small></div>`;
    const topo = $("#topoAvatar");
    if (topo) topo.innerHTML = avatar(e);
    Temas.preencherIcones();
  }
  async function salvar(campos, aviso) {
    S.eu = await tentar(() => api("PUT", "/eu", campos), aviso);
    aoCarregar();
    return S.eu;
  }

  // ---------- Perfil ----------
  telas.perfil = () => {
    const e = S.eu, agora = new Date();
    const doMes = S.eventos.filter(x => x.tipo === "evento" && x.inicio && new Date(x.inicio).getMonth() === agora.getMonth() && new Date(x.inicio).getFullYear() === agora.getFullYear()).length;
    const feitas = S.eventos.filter(x => x.tipo === "tarefa" && x.concluido).length;
    const melhor = S.habitos.length ? Math.max(...S.habitos.map(sequencia)) : null;
    const dCria = new Date(e.criado_em);
    const desde = isNaN(dCria) ? "—" : dCria.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    const plano = { premium: "Premium", teste: "Teste grátis", basico: "Básico" }[e.plano.status];
    tela.innerHTML = `
      <section>
        <div class="perfil-capa" id="capa"></div>
        <div class="perfil-topo">
          ${avatar(e)}
          <div class="perfil-nome">
            <h1>${esc(e.nome)}</h1>
            <span class="arroba">@${esc(e.usuario || "")}</span> <span class="pill ${e.plano.status === "basico" ? "" : "pill-alta"}">${plano}</span>
          </div>
          <a href="#editar-perfil" class="btn btn-ghost btn-small">${Temas.ico("edit", 16)} Editar perfil</a>
        </div>
        ${e.bio ? `<p class="perfil-bio">${esc(e.bio)}</p>` : ""}
      </section>
      <section class="stats">
        <div><strong>${doMes}</strong><span>Compromissos no mês</span></div>
        <div><strong>${feitas}</strong><span>Tarefas concluídas</span></div>
        <div><strong>${melhor === null ? "—" : melhor}</strong><span>Melhor sequência</span></div>
        <div><strong>${esc(desde)}</strong><span>Membro desde</span></div>
      </section>
      <section class="cartao lista-links">
        <a href="#editar-perfil"><span class="ic">${Temas.ico("user")}</span><div><b>Editar perfil</b><small>Foto, capa, apelido e @usuário</small></div><span class="fim">${Temas.ico("chevron", 18)}</span></a>
        <a href="#aparencia"><span class="ic">${Temas.ico("palette")}</span><div><b>Aparência</b><small>Papel de parede e fundo</small></div><span class="fim">${Temas.ico("chevron", 18)}</span></a>
        <a href="#plano"><span class="ic">${Temas.ico("star")}</span><div><b>Plano</b><small>${esc(plano)}</small></div><span class="fim">${Temas.ico("chevron", 18)}</span></a>
        <a href="#config"><span class="ic">${Temas.ico("gear")}</span><div><b>Configurações</b><small>Avisos, senha e conta</small></div><span class="fim">${Temas.ico("chevron", 18)}</span></a>
        <button id="sairPerfil"><span class="ic">${Temas.ico("logout")}</span><div><b>Sair</b><small>Encerrar a sessão neste aparelho</small></div></button>
      </section>`;
    pintar($("#capa"), e.capa);
    $("#sairPerfil").addEventListener("click", () => Faccliky.sair());
  };

  // ---------- Editar perfil ----------
  telas["editar-perfil"] = () => {
    const e = S.eu;
    const rasc = { avatar: e.avatar, capa: e.capa };
    tela.innerHTML = `
      <div class="cabeca"><div><p class="sub"><a href="#perfil" class="link">‹ Perfil</a></p><h1>Editar perfil</h1></div></div>
      <section class="edicao-previa">
        <div class="perfil-capa" id="pvCapa"></div>
        <div class="acoes-img"><button type="button" class="btn btn-ghost btn-small" id="pickCapa">${Temas.ico("camera", 16)} Alterar capa</button></div>
        <div class="perfil-topo">
          <div class="avatar-edit"><span id="pvAvatar"></span><button type="button" class="btn btn-icon" id="pickAvatar" aria-label="Alterar foto">${Temas.ico("camera", 16)}</button></div>
          <div class="perfil-nome"><button type="button" class="link pequeno" id="rmAvatar">Remover foto</button></div>
        </div>
      </section>
      <input type="file" accept="image/*" id="fileAvatar" hidden>
      <input type="file" accept="image/*" id="fileCapa" hidden>
      <section class="cartao form">
        <h2>Capas prontas</h2>
        <div class="capas" id="capas">
          ${Temas.PRONTOS.slice(0, 8).map(p => `<button type="button" class="papel-opcao" data-capa="p:${p.id}" style="background:${esc(p.css)}" aria-label="${esc(p.nome)}"><span class="nome">${esc(p.nome)}</span><span class="ok">${Temas.ico("check", 14)}</span></button>`).join("")}
        </div>
        <div class="acoes"><button type="button" class="btn btn-text btn-small" id="rmCapa">Sem capa</button></div>
      </section>
      <form class="form cartao" id="fPerfil">
        <label>Apelido<input name="nome" required maxlength="80" value="${esc(e.nome)}" placeholder="Como quer ser chamado"></label>
        <label>@usuário<span class="campo-arroba"><input name="usuario" required maxlength="20" value="${esc(e.usuario || "")}" placeholder="seu.usuario" autocapitalize="none" autocomplete="off"></span></label>
        <label>Bio<textarea name="bio" maxlength="160" placeholder="Fale um pouco sobre você (opcional)">${esc(e.bio || "")}</textarea></label>
        <p class="msg" id="msgPerfil"></p>
        <div class="acoes">
          <button class="btn" type="submit">Salvar alterações</button>
          <a href="#perfil" class="btn btn-ghost">Cancelar</a>
        </div>
      </form>`;
    const f = $("#fPerfil");
    const atualizar = () => {
      pintar($("#pvCapa"), rasc.capa);
      $("#pvAvatar").innerHTML = avatar({ avatar: rasc.avatar, nome: f.nome.value }, "grande");
      document.querySelectorAll("#capas [data-capa]").forEach(b => b.classList.toggle("sel", b.dataset.capa === rasc.capa));
    };
    atualizar();
    f.nome.addEventListener("input", atualizar);

    $("#pickAvatar").addEventListener("click", () => $("#fileAvatar").click());
    $("#pickCapa").addEventListener("click", () => $("#fileCapa").click());
    $("#rmAvatar").addEventListener("click", () => { rasc.avatar = null; atualizar(); });
    $("#rmCapa").addEventListener("click", () => { rasc.capa = null; atualizar(); });
    document.querySelectorAll("#capas [data-capa]").forEach(b => b.addEventListener("click", () => { rasc.capa = b.dataset.capa; atualizar(); }));
    $("#fileAvatar").addEventListener("change", async ev => {
      const arq = ev.target.files[0]; ev.target.value = "";
      if (!arq) return;
      try { rasc.avatar = await Temas.prepararImagem(arq, { largura: 256, altura: 256, max: 110000 }); atualizar(); }
      catch (er) { toast(er.message); }
    });
    $("#fileCapa").addEventListener("change", async ev => {
      const arq = ev.target.files[0]; ev.target.value = "";
      if (!arq) return;
      try { rasc.capa = await Temas.prepararImagem(arq, { largura: 1200, altura: 400, max: 420000, qualidade: .82 }); atualizar(); }
      catch (er) { toast(er.message); }
    });
    f.addEventListener("submit", async ev => {
      ev.preventDefault();
      const botao = f.querySelector("button[type=submit]");
      botao.disabled = true; $("#msgPerfil").textContent = "";
      try {
        await salvar({ nome: f.nome.value, usuario: f.usuario.value, bio: f.bio.value.trim() || null, avatar: rasc.avatar, capa: rasc.capa }, "Perfil salvo");
        location.hash = "#perfil";
      } catch (er) { $("#msgPerfil").textContent = er.message; botao.disabled = false; }
    });
  };

  // ---------- Aparência ----------
  telas.aparencia = () => {
    const e = S.eu;
    const custom = e.papel && !e.papel.startsWith("p:");
    const sel = e.papel || "p:grafite";
    tela.innerHTML = `
      <div class="cabeca"><div><p class="sub"><a href="#perfil" class="link">‹ Perfil</a></p><h1>Aparência</h1></div></div>
      <section class="cartao form">
        <h2>Papel de parede</h2>
        <p class="sub">Escolha o fundo do seu app. Ele fica salvo na sua conta e aparece em qualquer aparelho.</p>
        <div class="papeis-grade" id="grade">
          ${Temas.PRONTOS.map(p => `<button type="button" class="papel-opcao ${sel === "p:" + p.id ? "sel" : ""}" data-papel="p:${p.id}" style="background:${esc(p.css)}" aria-label="${esc(p.nome)}"><span class="nome">${esc(p.nome)}</span><span class="ok">${Temas.ico("check", 14)}</span></button>`).join("")}
          ${custom ? `<button type="button" class="papel-opcao sel" id="meuPapel" aria-label="Sua imagem"><span class="nome">Sua imagem</span><span class="ok">${Temas.ico("check", 14)}</span></button>` : ""}
          <button type="button" class="papel-opcao papel-enviar" id="enviarPapel">${Temas.ico("upload", 22)}Enviar imagem</button>
        </div>
        <input type="file" accept="image/*" id="filePapel" hidden>
        <label>Escurecer o fundo
          <input type="range" id="escuro" min="0" max="85" value="${e.papel_escuro ?? 35}">
        </label>
        <div class="acoes"><button type="button" class="btn btn-ghost btn-small" id="padrao">Voltar ao padrão</button></div>
      </section>`;
    const meu = $("#meuPapel");
    if (meu) meu.style.background = Temas.css(e.papel);
    document.querySelectorAll("#grade [data-papel]").forEach(b => b.addEventListener("click", async () => {
      try { await salvar({ papel: b.dataset.papel }); telas.aparencia(); } catch {}
    }));
    $("#enviarPapel").addEventListener("click", () => $("#filePapel").click());
    $("#filePapel").addEventListener("change", async ev => {
      const arq = ev.target.files[0]; ev.target.value = "";
      if (!arq) return;
      try {
        const img = await Temas.prepararImagem(arq, { largura: 1280, altura: 720, max: 420000, qualidade: .8 });
        await salvar({ papel: img }, "Papel de parede aplicado");
        telas.aparencia();
      } catch (er) { toast(er.message); }
    });
    const barra = $("#escuro");
    barra.addEventListener("input", () => Temas.aplicar(S.eu.papel, Number(barra.value)));
    barra.addEventListener("change", async () => { try { await salvar({ papel_escuro: Number(barra.value) }); } catch {} });
    $("#padrao").addEventListener("click", async () => {
      try { await salvar({ papel: null, papel_escuro: 35 }, "Voltou ao padrão"); telas.aparencia(); } catch {}
    });
  };

  window.aoCarregarEu = aoCarregar;
  return { avatar, pintarBanner: pintar, aoCarregar };
})();
