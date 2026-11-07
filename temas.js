// Temas: papéis de parede e capas prontos, ícones e utilidades para imagens
const Temas = (() => {
  const svg = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

  const ondas = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='900' height='260' viewBox='0 0 900 260'>
    <path d='M0 150 Q112 100 225 150 T450 150 T675 150 T900 150 V260 H0Z' fill='#7c3aed' fill-opacity='.16'/>
    <path d='M0 190 Q112 140 225 190 T450 190 T675 190 T900 190 V260 H0Z' fill='#ffffff' fill-opacity='.05'/></svg>`);
  const montanhas = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='900' height='320' viewBox='0 0 900 320'>
    <path d='M0 320V190L110 110L210 180L340 70L470 190L590 120L720 200L900 130V320Z' fill='#7c3aed' fill-opacity='.18'/>
    <path d='M0 320V250L150 190L270 250L410 180L550 260L690 200L900 250V320Z' fill='#9a9aa8' fill-opacity='.12'/></svg>`);

  const BASE = "#0e0e11";
  const PRONTOS = [
    { id: "grafite",   nome: "Grafite",   css: `linear-gradient(160deg,#1e1e26 0%,#0e0e11 72%)` },
    { id: "ametista",  nome: "Ametista",  css: `radial-gradient(80% 60% at 10% 0%,rgba(124,58,237,.46),transparent 70%),linear-gradient(160deg,#1a1326,#0e0e11)` },
    { id: "lavanda",   nome: "Lavanda",   css: `linear-gradient(135deg,#4c1d95 0%,#2a2540 52%,#16161b 100%)` },
    { id: "nevoa",     nome: "Névoa",     css: `radial-gradient(60% 50% at 85% 8%,rgba(167,139,250,.30),transparent 70%),radial-gradient(50% 50% at 8% 92%,rgba(120,120,140,.24),transparent 70%),#0f0f13` },
    { id: "aurora",    nome: "Aurora",    css: `radial-gradient(70% 42% at 28% 0%,rgba(139,92,246,.44),transparent 70%),radial-gradient(60% 42% at 82% 18%,rgba(113,113,130,.32),transparent 70%),linear-gradient(#15151b,#0e0e11)` },
    { id: "pontos",    nome: "Pontos",    css: `radial-gradient(circle,rgba(167,139,250,.20) 1.2px,transparent 1.7px) 0 0/24px 24px,linear-gradient(160deg,#18181f,#0e0e11)` },
    { id: "grade",     nome: "Grade",     css: `linear-gradient(rgba(167,139,250,.08) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(90deg,rgba(167,139,250,.08) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(160deg,#18181f,#0e0e11)` },
    { id: "diagonal",  nome: "Diagonal",  css: `repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0 2px,transparent 2px 16px),linear-gradient(160deg,#1b1b22,#0e0e11)` },
    { id: "circulos",  nome: "Círculos",  css: `repeating-radial-gradient(circle at 82% 18%,rgba(167,139,250,.12) 0 2px,transparent 2px 38px),linear-gradient(160deg,#18181f,#0e0e11)` },
    { id: "ondas",     nome: "Ondas",     css: `${ondas} center bottom/100% auto no-repeat,linear-gradient(180deg,#17171d,#0e0e11)` },
    { id: "montanhas", nome: "Montanhas", css: `${montanhas} center bottom/100% auto no-repeat,linear-gradient(180deg,#1d1530,#0e0e11 62%)` },
    { id: "concreto",  nome: "Concreto",  css: `linear-gradient(160deg,#3a3a45,#1a1a20)` }
  ];
  const PADRAO = PRONTOS[0];

  // Valor guardado -> CSS "background". Valor: null | "p:id" | imagem enviada (data URL já validada no servidor)
  function css(valor) {
    if (!valor) return PADRAO.css;
    if (valor.startsWith("p:")) return (PRONTOS.find(p => p.id === valor.slice(2)) || PADRAO).css;
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(valor)) return `url("${valor}") center/cover no-repeat,${BASE}`;
    return PADRAO.css;
  }

  function aplicar(papel, escuro) {
    const r = document.documentElement.style;
    r.setProperty("--papel", css(papel));
    r.setProperty("--escuro", String((escuro ?? 35) / 100));
  }

  // ---- Imagens: recorta, reduz e comprime no próprio navegador ----
  function prepararImagem(arquivo, { largura, altura, max, qualidade = 0.86 }) {
    return new Promise((ok, falha) => {
      if (!arquivo || !/^image\/(png|jpeg|webp|gif|bmp)$/.test(arquivo.type)) return falha(new Error("Escolha uma imagem (JPG, PNG ou WebP)."));
      if (arquivo.size > 20 * 1024 * 1024) return falha(new Error("Imagem muito grande (máx. 20 MB)."));
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("Não consegui abrir essa imagem.")); };
      img.onload = () => {
        URL.revokeObjectURL(url);
        const c = document.createElement("canvas");
        c.width = largura; c.height = altura;
        const g = c.getContext("2d");
        const escala = Math.max(largura / img.width, altura / img.height);
        const w = img.width * escala, h = img.height * escala;
        g.fillStyle = BASE; g.fillRect(0, 0, largura, altura);
        g.imageSmoothingQuality = "high";
        g.drawImage(img, (largura - w) / 2, (altura - h) / 2, w, h);
        let q = qualidade, data = c.toDataURL("image/jpeg", q);
        while (data.length > max && q > 0.35) { q -= 0.08; data = c.toDataURL("image/jpeg", q); }
        if (data.length > max) return falha(new Error("Imagem pesada demais. Tente outra."));
        ok(data);
      };
      img.src = url;
    });
  }

  // ---- Ícones (uma cor, traço fino) ----
  const D = {
    home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 14h.01M15 14h.01"/>',
    money: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 1-3 1-6 1-9.5z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21v-1a6 6 0 0 1 12 0v1M16 4.6a3.5 3.5 0 0 1 0 6.8M22 21v-1a6 6 0 0 0-4-5.6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
    star: '<path d="M12 2l3 6.9 7 .6-5.3 4.7 1.6 7.3L12 17.8 5.7 21.5l1.6-7.3L2 9.5l7-.6z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5-1.5-1.6-1.5-3 0-1 .8-1.7 1.9-1.7H17a4 4 0 0 0 4-4C21 6 17 3 12 3z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    arrowup: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    task: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>'
  };
  function ico(nome, tam = 20) {
    return `<svg class="ico" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${D[nome] || ""}</svg>`;
  }
  // Preenche <span data-ico="home"></span>
  function preencherIcones(raiz = document) {
    raiz.querySelectorAll("[data-ico]").forEach(el => { el.innerHTML = ico(el.dataset.ico, Number(el.dataset.tam) || 20); });
  }

  return { PRONTOS, css, aplicar, prepararImagem, ico, preencherIcones };
})();

// Aplica o tema guardado assim que possível (evita piscar)
try {
  const t = JSON.parse(localStorage.getItem("faccliky_tema") || "null");
  if (t) Temas.aplicar(t.papel, t.escuro);
} catch {}
