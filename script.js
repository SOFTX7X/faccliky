// Ícones, papéis de parede e faixa de palavras
Temas.preencherIcones();
const esc = s => String(s).replace(/"/g, "&quot;");
const papeis = document.getElementById("papeis");
if (papeis) papeis.innerHTML = Temas.PRONTOS.slice(0, 12).map(p => `<div class="papel-mini" style="background:${esc(p.css)}"></div>`).join("");
const palavras = ["Agenda", "Kliky", "Contas", "Hábitos", "Grupos", "Perfil", "Papéis de parede"];
const trilho = document.getElementById("trilho");
if (trilho) trilho.innerHTML = [...palavras, ...palavras].map(p => `<span>${p}</span>`).join("");
document.getElementById("ano").textContent = new Date().getFullYear();

// Menu do celular
const menu = document.getElementById("menu");
document.getElementById("menuBt").addEventListener("click", () => menu.classList.toggle("open"));
menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => menu.classList.remove("open")));

// Entrada suave ao rolar
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add("show"); io.unobserve(e.target);
  if (e.target.querySelector("#chips")) setTimeout(() => document.getElementById("chips").classList.add("riscar"), 700);
}), { threshold: 0.15 });
document.querySelectorAll(".rev").forEach(el => io.observe(el));

// Demonstração digitando
(function () {
  const frases = [
    { t: "dentista sexta às 15h", n: "Dentista", q: "Sexta, 15:00", a: "Aviso 1h antes" },
    { t: "pagar a luz dia 10, 120 reais", n: "Luz · R$ 120,00", q: "Dia 10", a: "Aviso 2 dias antes" },
    { t: "estudar inglês amanhã 8h", n: "Estudar inglês", q: "Amanhã, 08:00", a: "Aviso 15 min antes" }
  ];
  const caixa = document.getElementById("digita"), ev = document.getElementById("evento");
  const T = document.getElementById("evT"), Q = document.getElementById("evQ"), A = document.getElementById("evA");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { caixa.textContent = frases[0].t; ev.classList.add("on"); return; }
  let i = 0;
  async function ciclo() {
    const f = frases[i++ % frases.length];
    ev.classList.remove("on"); caixa.textContent = "";
    for (const c of f.t) { caixa.textContent += c; await new Promise(r => setTimeout(r, 55)); }
    await new Promise(r => setTimeout(r, 350));
    T.textContent = f.n; Q.textContent = f.q; A.textContent = f.a; ev.classList.add("on");
    setTimeout(ciclo, 3200);
  }
  const vis = new IntersectionObserver(es => { if (es[0].isIntersecting) { vis.disconnect(); ciclo(); } });
  vis.observe(caixa);
})();

// Fundo de quadradinhos (módulo pixels.js)
Pixels.iniciar(document.getElementById("pixels"), { foco: "dir", qtd: innerWidth < 700 ? 70 : 150 });
