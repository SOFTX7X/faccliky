// Ano no rodapé
document.getElementById("year").textContent = new Date().getFullYear();

// Menu do celular
const menu = document.getElementById("menu");
document.getElementById("menuToggle").addEventListener("click", () => menu.classList.toggle("open"));
menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => menu.classList.remove("open")));

// Animação ao rolar
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add("show");
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

// Kliky: falas do balão
const bubble = document.getElementById("botBubble");
const falas = [
  "Oi! Eu sou o Kliky 👋",
  "Me diz \"dentista sexta 15h\" que eu organizo.",
  "Eu te aviso antes das contas vencerem 💰",
  "Bora montar seu dia juntos? 🗓️",
  "Bebeu água hoje? Eu lembro você 💧"
];
let fala = 0;
setInterval(() => {
  bubble.classList.add("hide");
  setTimeout(() => {
    fala = (fala + 1) % falas.length;
    bubble.textContent = falas[fala];
    bubble.classList.remove("hide");
  }, 300);
}, 3500);

// Kliky: olhos seguem o mouse/dedo
const bot = document.getElementById("bot");
const eyes = document.getElementById("eyes");
function olhar(x, y) {
  const r = bot.getBoundingClientRect();
  const dx = (x - (r.left + r.width / 2)) / r.width;
  const dy = (y - (r.top + r.height / 2.6)) / r.height;
  const max = 6;
  eyes.style.transform = `translate(${Math.max(-max, Math.min(max, dx * 14))}px, ${Math.max(-max, Math.min(max, dy * 14))}px)`;
}
window.addEventListener("mousemove", e => olhar(e.clientX, e.clientY));
window.addEventListener("touchmove", e => olhar(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

// Demonstração: digitando
const exemplos = [
  { texto: "dentista sexta às 15h", titulo: "Dentista", quando: "Sexta, 15:00", aviso: "🔔 Aviso 1h antes" },
  { texto: "pagar luz dia 10", titulo: "Conta de luz", quando: "Dia 10, o dia todo", aviso: "💰 Aviso 2 dias antes" },
  { texto: "academia seg qua sex 7h", titulo: "Academia", quando: "Seg, Qua e Sex, 07:00", aviso: "🔥 Hábito da semana" },
  { texto: "reunião com a equipe amanhã 9h", titulo: "Reunião da equipe", quando: "Amanhã, 09:00", aviso: "👥 Compartilhado com 4 pessoas" }
];
const typing = document.getElementById("typing");
const demoEvent = document.getElementById("demoEvent");
const evTitle = document.getElementById("evTitle");
const evWhen = document.getElementById("evWhen");
const evAlert = document.getElementById("evAlert");
let ex = 0;

function digitar() {
  const atual = exemplos[ex];
  typing.textContent = "";
  demoEvent.classList.add("hide");
  let i = 0;
  const t = setInterval(() => {
    typing.textContent += atual.texto[i++];
    if (i >= atual.texto.length) {
      clearInterval(t);
      setTimeout(() => {
        evTitle.textContent = atual.titulo;
        evWhen.textContent = atual.quando;
        evAlert.textContent = atual.aviso;
        demoEvent.classList.remove("hide");
      }, 400);
      setTimeout(() => {
        ex = (ex + 1) % exemplos.length;
        digitar();
      }, 3200);
    }
  }, 70);
}
digitar();
