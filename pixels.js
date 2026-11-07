// Fundo de quadradinhos animado e leve: poucos pontos acendem e apagam e o brilho segue o mouse/dedo.
// Só desenha o que está ativo, ~20 quadros/s, pausa fora da tela e com a aba oculta.
const Pixels = (() => {
  function iniciar(cv, o = {}) {
    const g = cv.getContext("2d");
    const CEL = o.cel || 9, RAIO = o.raio || 150, COR = o.cor || "196,181,253", COR2 = o.cor2 || "167,139,250";
    const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, cols = 0, lin = 0, pts = [], mx = -999, my = -999, rodando = false, visivel = true, ult = 0;

    const sorteio = () => {
      if (o.foco === "dir") return { x: Math.min(cols - 1, Math.floor((1 - Math.random() ** 1.6) * cols)), y: Math.floor(Math.random() ** 1.5 * lin) };
      return { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * lin) };
    };
    const novo = () => ({ ...sorteio(), f: Math.random() * 6.28, v: 0.4 + Math.random() * 1.1, a: 0.25 + Math.random() * 0.5 });

    function medir() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / CEL); lin = Math.ceil(H / CEL);
      const n = Math.min(o.qtd || 120, Math.floor(cols * lin / 40));
      pts = Array.from({ length: n }, novo);
    }
    function quadro(t) {
      g.clearRect(0, 0, W, H);
      for (const p of pts) {
        const k = Math.sin(t / 1000 * p.v + p.f);
        if (k < 0.15) { if (k < -0.98) Object.assign(p, novo()); continue; }
        g.fillStyle = `rgba(${COR},${(k * p.a).toFixed(3)})`;
        g.fillRect(p.x * CEL + 1, p.y * CEL + 1, CEL - 2, CEL - 2);
      }
      if (mx > -900) {
        const c0 = Math.max(0, Math.floor((mx - RAIO) / CEL)), c1 = Math.min(cols, Math.ceil((mx + RAIO) / CEL));
        const l0 = Math.max(0, Math.floor((my - RAIO) / CEL)), l1 = Math.min(lin, Math.ceil((my + RAIO) / CEL));
        for (let l = l0; l < l1; l++) for (let c = c0; c < c1; c++) {
          const d = Math.hypot(c * CEL + CEL / 2 - mx, l * CEL + CEL / 2 - my) / RAIO;
          if (d >= 1) continue;
          const r = ((c * 73856093) ^ (l * 19349663)) >>> 0;
          g.fillStyle = `rgba(${COR2},${((1 - d) ** 1.6 * 0.55 * (0.55 + (r % 100) / 220)).toFixed(3)})`;
          g.fillRect(c * CEL + 1, l * CEL + 1, CEL - 2, CEL - 2);
        }
      }
    }
    function laco(t) {
      if (!rodando) return;
      if (t - ult > 50) { ult = t; quadro(t); }
      requestAnimationFrame(laco);
    }
    const ligar = () => { if (!rodando && !reduzido && visivel && !document.hidden) { rodando = true; requestAnimationFrame(laco); } };
    const desligar = () => { rodando = false; };

    const ro = new ResizeObserver(() => { medir(); if (reduzido) quadro(0); });
    ro.observe(cv);
    const io = new IntersectionObserver(es => { visivel = es[0].isIntersecting; visivel ? ligar() : desligar(); });
    io.observe(cv);
    const vis = () => document.hidden ? desligar() : ligar();
    const mover = e => {
      const r = cv.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
      if (mx < -RAIO || my < -RAIO || mx > r.width + RAIO || my > r.height + RAIO) mx = my = -999;
    };
    const sair = () => { mx = my = -999; };
    document.addEventListener("visibilitychange", vis);
    addEventListener("pointermove", mover, { passive: true });
    addEventListener("touchend", sair, { passive: true });
    document.addEventListener("pointerleave", sair);
    medir(); if (reduzido) quadro(0); else ligar();

    return { parar() { desligar(); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", vis); removeEventListener("pointermove", mover); removeEventListener("touchend", sair); document.removeEventListener("pointerleave", sair); } };
  }
  return { iniciar };
})();
