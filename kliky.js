// Kliky: entende frases em português e planeja o dia
const Kliky = (() => {
  const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const DIAS = [
    ["domingo", "dom"], ["segunda", "segunda-feira", "seg"], ["terca", "terca-feira", "ter"],
    ["quarta", "quarta-feira", "qua"], ["quinta", "quinta-feira", "qui"], ["sexta", "sexta-feira", "sex"],
    ["sabado", "sab"]
  ];
  const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  // Remove trechos já entendidos da frase (mantendo o resto para virar título)
  function remover(orig, norm, re) {
    const m = norm.match(re);
    if (!m) return [orig, norm, null];
    const i = m.index, f = i + m[0].length;
    return [orig.slice(0, i) + " " + orig.slice(f), norm.slice(0, i) + " " + norm.slice(f), m];
  }

  function interpretar(frase, agora = new Date()) {
    let o = " " + String(frase || "").trim() + " ";
    let n = semAcento(o);
    let m;
    const r = { tipo: "evento", titulo: "", inicio: null, dia_todo: false, lembrete_min: null, prioridade: 2, duracao_min: 60, valor: null };

    // Lembrete: "30 min antes", "1h antes", "1 dia antes"
    [o, n, m] = remover(o, n, /\b(?:me\s+)?(?:avis[ae]r?|lembr[ae]r?)?\s*(\d+)\s*(min|minutos?|h|horas?|dias?)\s+antes\b/);
    if (m) r.lembrete_min = Number(m[1]) * (m[2].startsWith("d") ? 1440 : m[2].startsWith("h") ? 60 : 1);

    // Duração: "por 2h", "durante 30 min"
    [o, n, m] = remover(o, n, /\b(?:por|durante)\s+(\d+)\s*(min|minutos?|h|horas?)\b/);
    if (m) r.duracao_min = Number(m[1]) * (m[2].startsWith("h") ? 60 : 1);

    // Valor: "R$ 120,50", "120 reais"
    [o, n, m] = remover(o, n, /(?:r\$\s*(\d+(?:[.,]\d{1,2})?)|\b(\d+(?:[.,]\d{1,2})?)\s*(?:reais|conto))/);
    if (m) r.valor = Number((m[1] || m[2]).replace(",", "."));

    // Prioridade
    [o, n, m] = remover(o, n, /\b(urgente|importante|prioridade alta)\b/);
    if (m) r.prioridade = 1;

    // Data
    let data = null;
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const somar = d => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + d);

    if (([o, n, m] = remover(o, n, /\bdepois de amanha\b/), m)) data = somar(2);
    else if (([o, n, m] = remover(o, n, /\bamanha\b/), m)) data = somar(1);
    else if (([o, n, m] = remover(o, n, /\bhoje\b/), m)) data = somar(0);
    else if (([o, n, m] = remover(o, n, /\b(?:(?:no|na|nesta|neste|nessa|proxim[ao]|essa|esse)\s+)?(domingo|dom|segunda(?:-feira)?|seg|terca(?:-feira)?|ter|quarta(?:-feira)?|qua|quinta(?:-feira)?|qui|sexta(?:-feira)?|sex|sabado|sab)\b(?:\s+que vem)?/), m)) {
      const alvo = DIAS.findIndex(nomes => nomes.includes(m[1]));
      let dif = (alvo - hoje.getDay() + 7) % 7;
      if (dif === 0) dif = 7;
      data = somar(dif);
    }
    else if (([o, n, m] = remover(o, n, /\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/), m)) {
      let ano = m[3] ? Number(m[3]) : hoje.getFullYear();
      if (ano < 100) ano += 2000;
      data = new Date(ano, Number(m[2]) - 1, Number(m[1]));
      if (!m[3] && data < hoje) data.setFullYear(ano + 1);
    }
    else if (([o, n, m] = remover(o, n, new RegExp(`\\b(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${MESES.join("|")})\\b`)), m)) {
      data = new Date(hoje.getFullYear(), MESES.indexOf(m[2]), Number(m[1]));
      if (data < hoje) data.setFullYear(hoje.getFullYear() + 1);
    }
    else if (([o, n, m] = remover(o, n, /\b(?:no\s+)?dia\s+(\d{1,2})\b/), m)) {
      data = new Date(hoje.getFullYear(), hoje.getMonth(), Number(m[1]));
      if (data < hoje) data = new Date(hoje.getFullYear(), hoje.getMonth() + 1, Number(m[1]));
    }
    else if (([o, n, m] = remover(o, n, /\b(?:na\s+)?semana que vem\b/), m)) data = somar(7);

    // Hora
    let hora = null, min = 0;
    if (([o, n, m] = remover(o, n, /\b(?:as|a|de|pelas|ao)?\s*meio[- ]dia(?:\s+e\s+meia)?\b/), m)) { hora = 12; min = /meia$/.test(m[0]) ? 30 : 0; }
    else if (([o, n, m] = remover(o, n, /\b(?:as|a)?\s*meia[- ]noite\b/), m)) { hora = 0; }
    else if (([o, n, m] = remover(o, n, /\b(?:as|a|pelas|por volta das)?\s*(\d{1,2})\s*(?:h|:|hs|horas?)\s*(\d{2})?\b(?:\s*(?:da|de)\s+(manha|tarde|noite))?/), m) ||
             ([o, n, m] = remover(o, n, /\b(?:as|pelas)\s+(\d{1,2})\b(?:\s*e\s*(\d{2}|meia))?(?:\s*(?:da|de)\s+(manha|tarde|noite))?/), m)) {
      hora = Number(m[1]);
      min = m[2] === "meia" ? 30 : Number(m[2] || 0);
      if ((m[3] === "tarde" || m[3] === "noite") && hora < 12) hora += 12;
    }
    else if (([o, n, m] = remover(o, n, /\b(?:de|pela|a)\s+(manha|tarde|noite)\b/), m)) {
      hora = { manha: 9, tarde: 15, noite: 19 }[m[1]];
    }
    if (hora !== null && (hora > 23 || min > 59)) { hora = null; min = 0; }

    // Tipo
    const ehConta = /\b(pagar|conta|boleto|fatura|parcela|aluguel)\b/.test(n);
    if (ehConta) {
      r.tipo = "conta";
      r.vencimento = data || (hora !== null ? hoje : null);
    } else if (/\b(todo dia|todos os dias|diariamente|habito)\b/.test(n) && hora === null && !data) {
      r.tipo = "habito";
      [o, n] = remover(o, n, /\b(todo dia|todos os dias|diariamente|habito( de)?)\b/);
    } else if (data || hora !== null) {
      r.tipo = "evento";
      if (!data) {
        data = somar(0);
        const teste = new Date(data); teste.setHours(hora, min);
        if (teste <= agora) data = somar(1);
      }
      const d = new Date(data);
      if (hora === null) { r.dia_todo = true; d.setHours(9, 0, 0, 0); }
      else d.setHours(hora, min, 0, 0);
      r.inicio = d;
      if (r.lembrete_min === null) r.lembrete_min = r.dia_todo ? null : 60;
    } else {
      r.tipo = "tarefa";
    }

    // Título: limpa palavras de ligação que sobraram
    let t = o.replace(/\s+/g, " ").trim()
      .replace(/^(me\s+)?(lembr[ae](r)?\s+(de\s+)?|marcar?\s+|agendar?\s+|criar?\s+|anotar?\s+|tenho\s+(que\s+)?|preciso\s+(de\s+)?)/i, "")
      .replace(/\s+(no|na|as|às|a|de|do|da|em|para|pra|e|com)$/i, "")
      .replace(/^(no|na|as|às|a|de|em|o|um|uma)\s+/i, "")
      .replace(/[,.;-]+$/, "").trim();
    if (r.tipo === "conta") t = t.replace(/^(pagar\s+(a\s+|o\s+)?)?((conta|boleto|fatura)\s+(de\s+|da\s+|do\s+)?)?/i, "") || "Conta";
    r.titulo = t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
    return r;
  }

  // Planejamento automático do dia:
  // compromissos com horário ficam fixos; tarefas entram nos espaços livres,
  // da mais importante para a menos importante, com 10 min de pausa entre elas.
  function planejarDia(eventosDoDia, tarefas, agora = new Date(), inicioDia = 8, fimDia = 22) {
    const base = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const hm = h => new Date(base.getTime() + h * 3600000);
    const cursor = new Date(Math.max(hm(inicioDia), Math.ceil(agora / 300000) * 300000));
    const fim = hm(fimDia);
    const PAUSA = 10 * 60000;

    const fixos = eventosDoDia
      .filter(e => e.inicio && !e.dia_todo)
      .map(e => ({ ...e, ini: new Date(e.inicio), fim: new Date(new Date(e.inicio).getTime() + (e.duracao_min || 60) * 60000), fixo: true }))
      .sort((a, b) => a.ini - b.ini);

    const fila = tarefas
      .filter(t => !t.concluido)
      .sort((a, b) => (a.prioridade - b.prioridade) || (a.duracao_min - b.duracao_min));

    const plano = [];
    const naoCoube = [];
    const ocupado = [...fixos];
    for (const t of fila) {
      const dur = (t.duracao_min || 30) * 60000;
      // tenta cada início possível: agora e logo depois de cada bloco ocupado
      const candidatos = [cursor, ...ocupado.map(b => new Date(b.fim.getTime() + PAUSA))]
        .filter(c => c >= cursor)
        .sort((a, b) => a - b);
      let achou = null;
      for (const ini of candidatos) {
        const f = new Date(ini.getTime() + dur);
        if (f > fim) break;
        const choque = ocupado.some(b => b.ini.getTime() - PAUSA < f.getTime() && b.fim.getTime() + PAUSA > ini.getTime());
        if (!choque) { achou = { ini, fim: f }; break; }
      }
      if (achou) {
        const bloco = { ...t, ...achou, fixo: false };
        plano.push(bloco);
        ocupado.push(bloco);
      } else naoCoube.push(t);
    }

    const linha = [...fixos, ...plano].sort((a, b) => a.ini - b.ini);
    return { linha, naoCoube };
  }

  return { interpretar, planejarDia, semAcento };
})();

if (typeof module !== "undefined") module.exports = Kliky;
