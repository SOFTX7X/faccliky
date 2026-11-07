// Faccliky: servidor da API (roda no PC)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { hashSenha, conferirSenha, criarToken, lerToken } = require("./seguranca");

// ---------- Configuração (.env) ----------
function carregarEnv() {
  const arq = path.join(__dirname, ".env");
  if (!fs.existsSync(arq)) return;
  for (const linha of fs.readFileSync(arq, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
carregarEnv();

const PORTA = Number(process.env.PORTA || 3100);
const SEGREDO = process.env.SEGREDO_TOKEN;
const ORIGENS = (process.env.ORIGENS || "http://localhost:5500,http://127.0.0.1:5500")
  .split(",").map(s => s.trim()).filter(Boolean);
const BRAVOPAY_SEGREDO = process.env.BRAVOPAY_SEGREDO_WEBHOOK || "";
const DIAS_PREMIUM = Number(process.env.DIAS_PREMIUM_POR_PAGAMENTO || 30);

// ---------- Ajudantes ----------
class Erro extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

function texto(v, max, obrig = false, campo = "campo") {
  if (v === undefined || v === null || v === "") {
    if (obrig) throw new Erro(400, `Preencha ${campo}.`);
    return null;
  }
  const s = String(v).trim();
  if (obrig && !s) throw new Erro(400, `Preencha ${campo}.`);
  if (s.length > max) throw new Erro(400, `${campo} muito longo (máx. ${max}).`);
  return s;
}
function inteiro(v, min, max, padrao) {
  if (v === undefined || v === null || v === "") return padrao;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Erro(400, "Número inválido.");
  return n;
}
function numero(v, padrao = null) {
  if (v === undefined || v === null || v === "") return padrao;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1e10) throw new Erro(400, "Valor inválido.");
  return Math.round(n * 100) / 100;
}
function dataHora(v) {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  if (isNaN(d)) throw new Erro(400, "Data inválida.");
  return d.toISOString();
}
function dia(v, obrig = true) {
  if (!v && !obrig) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ""))) throw new Erro(400, "Data inválida (use AAAA-MM-DD).");
  return v;
}
function bool(v, padrao = false) { return v === undefined ? padrao : Boolean(v); }

function plano(u) {
  const agora = Date.now();
  if (u.premium_ate && new Date(u.premium_ate) > agora) return { status: "premium", ate: u.premium_ate };
  if (u.teste_ate && new Date(u.teste_ate) > agora) return { status: "teste", ate: u.teste_ate };
  return { status: "basico", ate: null };
}
const temPremium = u => plano(u).status !== "basico";

function publico(u) {
  return {
    id: u.id, nome: u.nome, email: u.email,
    meta_gasto: u.meta_gasto === null ? null : Number(u.meta_gasto),
    criado_em: u.criado_em, plano: plano(u)
  };
}

// Limite simples de tentativas (login/cadastro)
const tentativas = new Map();
function limitar(chave, max = 10, janelaMs = 15 * 60000) {
  const agora = Date.now();
  const t = tentativas.get(chave) || { n: 0, desde: agora };
  if (agora - t.desde > janelaMs) { t.n = 0; t.desde = agora; }
  t.n++;
  tentativas.set(chave, t);
  if (t.n > max) throw new Erro(429, "Muitas tentativas. Aguarde alguns minutos.");
}

function lerCorpo(req, limite = 100000) {
  return new Promise((ok, falha) => {
    let dados = "";
    req.on("data", c => {
      dados += c;
      if (dados.length > limite) { falha(new Erro(413, "Dados grandes demais.")); req.destroy(); }
    });
    req.on("end", () => {
      if (!dados) return ok({ bruto: "", json: {} });
      try { ok({ bruto: dados, json: JSON.parse(dados) }); }
      catch { falha(new Erro(400, "JSON inválido.")); }
    });
    req.on("error", falha);
  });
}

// ---------- Rotas ----------
function criarServidor(db) {
  const rotas = [];
  const rota = (metodo, padrao, fn, opcoes = {}) => {
    const chaves = [];
    const re = new RegExp("^" + padrao.replace(/:(\w+)/g, (_, k) => { chaves.push(k); return "(\\d+)"; }) + "/?$");
    rotas.push({ metodo, re, chaves, fn, ...opcoes });
  };

  async function usuarioAtual(req) {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const dados = lerToken(token, SEGREDO);
    if (!dados) throw new Erro(401, "Faça login novamente.");
    const { rows } = await db.query("SELECT * FROM usuarios WHERE id = $1", [dados.id]);
    if (!rows[0]) throw new Erro(401, "Conta não encontrada.");
    return rows[0];
  }
  function exigirPremium(u) {
    if (!temPremium(u)) throw new Erro(402, "Recurso do Premium. Assine para continuar usando.");
  }
  async function ehMembro(agendaId, usuarioId) {
    const { rows } = await db.query(
      "SELECT 1 FROM agenda_membros WHERE agenda_id = $1 AND usuario_id = $2", [agendaId, usuarioId]);
    return rows.length > 0;
  }
  async function eventoPermitido(id, u) {
    const { rows } = await db.query("SELECT * FROM eventos WHERE id = $1", [id]);
    const ev = rows[0];
    if (!ev) throw new Erro(404, "Compromisso não encontrado.");
    if (ev.usuario_id === u.id) return ev;
    if (ev.agenda_id && await ehMembro(ev.agenda_id, u.id)) return ev;
    throw new Erro(404, "Compromisso não encontrado.");
  }

  // Saúde
  rota("GET", "/api/saude", async () => ({ ok: true, nome: "Faccliky", hora: new Date().toISOString() }), { publica: true });

  // Cadastro e login
  rota("POST", "/api/cadastro", async ({ corpo, ip }) => {
    limitar("cad:" + ip, 8);
    const nome = texto(corpo.nome, 80, true, "o nome");
    const email = texto(corpo.email, 160, true, "o e-mail").toLowerCase();
    const senha = String(corpo.senha || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Erro(400, "E-mail inválido.");
    if (senha.length < 6 || senha.length > 200) throw new Erro(400, "A senha precisa ter pelo menos 6 caracteres.");
    const existe = await db.query("SELECT id FROM usuarios WHERE email = $1", [email]);
    if (existe.rows.length) throw new Erro(409, "Este e-mail já tem conta. Entre com ele.");
    const { rows } = await db.query(
      "INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING *",
      [nome, email, hashSenha(senha)]);
    return { status: 201, dados: { token: criarToken(rows[0].id, SEGREDO), usuario: publico(rows[0]) } };
  }, { publica: true });

  rota("POST", "/api/entrar", async ({ corpo, ip }) => {
    limitar("ent:" + ip, 12);
    const email = String(corpo.email || "").trim().toLowerCase();
    const { rows } = await db.query("SELECT * FROM usuarios WHERE email = $1", [email]);
    if (!rows[0] || !conferirSenha(String(corpo.senha || ""), rows[0].senha_hash))
      throw new Erro(401, "E-mail ou senha incorretos.");
    return { token: criarToken(rows[0].id, SEGREDO), usuario: publico(rows[0]) };
  }, { publica: true });

  // Minha conta
  rota("GET", "/api/eu", async ({ u }) => publico(u));
  rota("PUT", "/api/eu", async ({ u, corpo }) => {
    const nome = corpo.nome !== undefined ? texto(corpo.nome, 80, true, "o nome") : u.nome;
    const meta = corpo.meta_gasto !== undefined ? numero(corpo.meta_gasto) : u.meta_gasto;
    const { rows } = await db.query(
      "UPDATE usuarios SET nome = $1, meta_gasto = $2 WHERE id = $3 RETURNING *", [nome, meta, u.id]);
    return publico(rows[0]);
  });
  rota("PUT", "/api/eu/senha", async ({ u, corpo }) => {
    if (!conferirSenha(String(corpo.atual || ""), u.senha_hash)) throw new Erro(400, "Senha atual incorreta.");
    const nova = String(corpo.nova || "");
    if (nova.length < 6 || nova.length > 200) throw new Erro(400, "A nova senha precisa ter pelo menos 6 caracteres.");
    await db.query("UPDATE usuarios SET senha_hash = $1 WHERE id = $2 RETURNING id", [hashSenha(nova), u.id]);
    return { ok: true };
  });
  rota("DELETE", "/api/eu", async ({ u, corpo }) => {
    if (!conferirSenha(String(corpo.senha || ""), u.senha_hash)) throw new Erro(400, "Senha incorreta.");
    await db.query("DELETE FROM usuarios WHERE id = $1 RETURNING id", [u.id]);
    return { ok: true };
  });

  // Compromissos e tarefas
  rota("GET", "/api/eventos", async ({ u, url }) => {
    const de = url.searchParams.get("de");
    const ate = url.searchParams.get("ate");
    const { rows } = await db.query(
      `SELECT e.*, a.nome AS agenda_nome, us.nome AS autor
         FROM eventos e
         LEFT JOIN agendas a ON a.id = e.agenda_id
         JOIN usuarios us ON us.id = e.usuario_id
        WHERE (e.usuario_id = $1 OR e.agenda_id IN (SELECT agenda_id FROM agenda_membros WHERE usuario_id = $1))
          AND ($2::timestamptz IS NULL OR e.inicio IS NULL OR e.inicio >= $2::timestamptz)
          AND ($3::timestamptz IS NULL OR e.inicio IS NULL OR e.inicio < $3::timestamptz)
        ORDER BY e.inicio NULLS LAST, e.prioridade, e.id
        LIMIT 2000`,
      [u.id, de ? dataHora(de) : null, ate ? dataHora(ate) : null]);
    return rows;
  });

  async function dadosEvento(corpo, u, atual = {}) {
    const tem = k => corpo[k] !== undefined;
    const tipo = tem("tipo") ? (corpo.tipo === "tarefa" ? "tarefa" : "evento") : (atual.tipo || "evento");
    const d = {
      tipo,
      titulo: tem("titulo") ? texto(corpo.titulo, 160, true, "o título") : atual.titulo,
      local: tem("local") ? texto(corpo.local, 160) : (atual.local ?? null),
      inicio: tem("inicio") ? dataHora(corpo.inicio) : (atual.inicio ? new Date(atual.inicio).toISOString() : null),
      dia_todo: tem("dia_todo") ? bool(corpo.dia_todo) : (atual.dia_todo ?? false),
      duracao_min: tem("duracao_min") ? inteiro(corpo.duracao_min, 5, 1440, 60) : (atual.duracao_min ?? 60),
      prioridade: tem("prioridade") ? inteiro(corpo.prioridade, 1, 3, 2) : (atual.prioridade ?? 2),
      lembrete_min: tem("lembrete_min") ? inteiro(corpo.lembrete_min, 0, 10080, null) : (atual.lembrete_min ?? null),
      concluido: tem("concluido") ? bool(corpo.concluido) : (atual.concluido ?? false),
      agenda_id: tem("agenda_id") ? (corpo.agenda_id ? inteiro(corpo.agenda_id, 1, 2e9, null) : null) : (atual.agenda_id ?? null)
    };
    if (!d.titulo) throw new Erro(400, "Preencha o título.");
    if (d.tipo === "evento" && !d.inicio) throw new Erro(400, "Informe a data e a hora.");
    if (d.agenda_id && !(await ehMembro(d.agenda_id, u.id))) throw new Erro(403, "Você não participa dessa agenda.");
    return d;
  }

  rota("POST", "/api/eventos", async ({ u, corpo }) => {
    const d = await dadosEvento(corpo, u);
    const { rows } = await db.query(
      `INSERT INTO eventos (usuario_id, agenda_id, tipo, titulo, local, inicio, dia_todo, duracao_min, prioridade, lembrete_min, concluido)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [u.id, d.agenda_id, d.tipo, d.titulo, d.local, d.inicio, d.dia_todo, d.duracao_min, d.prioridade, d.lembrete_min, d.concluido]);
    return { status: 201, dados: rows[0] };
  });

  rota("PUT", "/api/eventos/:id", async ({ u, corpo, p }) => {
    const atual = await eventoPermitido(p.id, u);
    const d = await dadosEvento(corpo, u, atual);
    const { rows } = await db.query(
      `UPDATE eventos SET agenda_id=$1, tipo=$2, titulo=$3, local=$4, inicio=$5, dia_todo=$6,
              duracao_min=$7, prioridade=$8, lembrete_min=$9, concluido=$10
        WHERE id=$11 RETURNING *`,
      [d.agenda_id, d.tipo, d.titulo, d.local, d.inicio, d.dia_todo, d.duracao_min, d.prioridade, d.lembrete_min, d.concluido, atual.id]);
    return rows[0];
  });

  rota("DELETE", "/api/eventos/:id", async ({ u, p }) => {
    const ev = await eventoPermitido(p.id, u);
    await db.query("DELETE FROM eventos WHERE id = $1 RETURNING id", [ev.id]);
    return { ok: true };
  });

  // Contas a pagar (Premium)
  rota("GET", "/api/contas", async ({ u }) => {
    exigirPremium(u);
    const { rows } = await db.query(
      "SELECT * FROM contas WHERE usuario_id = $1 ORDER BY paga, vencimento, id LIMIT 1000", [u.id]);
    return rows.map(c => ({ ...c, valor: Number(c.valor) }));
  });
  rota("POST", "/api/contas", async ({ u, corpo }) => {
    exigirPremium(u);
    const { rows } = await db.query(
      "INSERT INTO contas (usuario_id, descricao, valor, vencimento, paga) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [u.id, texto(corpo.descricao, 120, true, "a descrição"), numero(corpo.valor, 0), dia(corpo.vencimento), bool(corpo.paga)]);
    return { status: 201, dados: { ...rows[0], valor: Number(rows[0].valor) } };
  });
  rota("PUT", "/api/contas/:id", async ({ u, corpo, p }) => {
    exigirPremium(u);
    const { rows: atual } = await db.query("SELECT * FROM contas WHERE id = $1 AND usuario_id = $2", [p.id, u.id]);
    if (!atual[0]) throw new Erro(404, "Conta não encontrada.");
    const a = atual[0];
    const venc = a.vencimento instanceof Date ? a.vencimento.toISOString().slice(0, 10) : String(a.vencimento).slice(0, 10);
    const { rows } = await db.query(
      "UPDATE contas SET descricao=$1, valor=$2, vencimento=$3, paga=$4 WHERE id=$5 RETURNING *",
      [corpo.descricao !== undefined ? texto(corpo.descricao, 120, true, "a descrição") : a.descricao,
       corpo.valor !== undefined ? numero(corpo.valor, 0) : a.valor,
       corpo.vencimento !== undefined ? dia(corpo.vencimento) : venc,
       corpo.paga !== undefined ? bool(corpo.paga) : a.paga, a.id]);
    return { ...rows[0], valor: Number(rows[0].valor) };
  });
  rota("DELETE", "/api/contas/:id", async ({ u, p }) => {
    exigirPremium(u);
    const { rows } = await db.query("DELETE FROM contas WHERE id = $1 AND usuario_id = $2 RETURNING id", [p.id, u.id]);
    if (!rows[0]) throw new Erro(404, "Conta não encontrada.");
    return { ok: true };
  });

  // Hábitos (Premium)
  rota("GET", "/api/habitos", async ({ u }) => {
    exigirPremium(u);
    const { rows } = await db.query(
      `SELECT h.*, COALESCE(
          (SELECT json_agg(to_char(r.dia, 'YYYY-MM-DD') ORDER BY r.dia)
             FROM habito_registros r WHERE r.habito_id = h.id AND r.dia >= CURRENT_DATE - 60), '[]') AS dias
         FROM habitos h WHERE h.usuario_id = $1 ORDER BY h.id`, [u.id]);
    return rows;
  });
  rota("POST", "/api/habitos", async ({ u, corpo }) => {
    exigirPremium(u);
    const { rows } = await db.query(
      "INSERT INTO habitos (usuario_id, nome, icone, meta_semana) VALUES ($1,$2,$3,$4) RETURNING *",
      [u.id, texto(corpo.nome, 80, true, "o nome"), texto(corpo.icone, 16) || "⭐", inteiro(corpo.meta_semana, 1, 7, 7)]);
    return { status: 201, dados: { ...rows[0], dias: [] } };
  });
  rota("DELETE", "/api/habitos/:id", async ({ u, p }) => {
    exigirPremium(u);
    const { rows } = await db.query("DELETE FROM habitos WHERE id = $1 AND usuario_id = $2 RETURNING id", [p.id, u.id]);
    if (!rows[0]) throw new Erro(404, "Hábito não encontrado.");
    return { ok: true };
  });
  rota("POST", "/api/habitos/:id/marcar", async ({ u, corpo, p }) => {
    exigirPremium(u);
    const { rows: h } = await db.query("SELECT id FROM habitos WHERE id = $1 AND usuario_id = $2", [p.id, u.id]);
    if (!h[0]) throw new Erro(404, "Hábito não encontrado.");
    const d = dia(corpo.dia);
    const apagou = await db.query("DELETE FROM habito_registros WHERE habito_id = $1 AND dia = $2 RETURNING dia", [p.id, d]);
    if (apagou.rows.length) return { marcado: false };
    await db.query("INSERT INTO habito_registros (habito_id, dia) VALUES ($1, $2) RETURNING dia", [p.id, d]);
    return { marcado: true };
  });

  // Agendas compartilhadas
  rota("GET", "/api/agendas", async ({ u }) => {
    const { rows } = await db.query(
      `SELECT a.id, a.nome, a.dono_id, (a.dono_id = $1) AS sou_dono,
              (SELECT json_agg(json_build_object('id', us.id, 'nome', us.nome, 'email', us.email) ORDER BY us.nome)
                 FROM agenda_membros m JOIN usuarios us ON us.id = m.usuario_id WHERE m.agenda_id = a.id) AS membros
         FROM agendas a
        WHERE a.id IN (SELECT agenda_id FROM agenda_membros WHERE usuario_id = $1)
        ORDER BY a.id`, [u.id]);
    return rows;
  });
  rota("POST", "/api/agendas", async ({ u, corpo }) => {
    exigirPremium(u);
    const { rows } = await db.query(
      "INSERT INTO agendas (nome, dono_id) VALUES ($1, $2) RETURNING *", [texto(corpo.nome, 80, true, "o nome"), u.id]);
    await db.query("INSERT INTO agenda_membros (agenda_id, usuario_id) VALUES ($1, $2) RETURNING agenda_id", [rows[0].id, u.id]);
    return { status: 201, dados: rows[0] };
  });
  async function agendaDoDono(id, u) {
    const { rows } = await db.query("SELECT * FROM agendas WHERE id = $1 AND dono_id = $2", [id, u.id]);
    if (!rows[0]) throw new Erro(404, "Agenda não encontrada ou você não é o dono.");
    return rows[0];
  }
  rota("DELETE", "/api/agendas/:id", async ({ u, p }) => {
    await agendaDoDono(p.id, u);
    await db.query("DELETE FROM agendas WHERE id = $1 RETURNING id", [p.id]);
    return { ok: true };
  });
  rota("POST", "/api/agendas/:id/membros", async ({ u, corpo, p }) => {
    exigirPremium(u);
    await agendaDoDono(p.id, u);
    const email = String(corpo.email || "").trim().toLowerCase();
    const { rows } = await db.query("SELECT id, nome, email FROM usuarios WHERE email = $1", [email]);
    if (!rows[0]) throw new Erro(404, "Essa pessoa ainda não tem conta no Faccliky.");
    await db.query(
      "INSERT INTO agenda_membros (agenda_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING agenda_id",
      [p.id, rows[0].id]);
    return rows[0];
  });
  rota("DELETE", "/api/agendas/:id/membros/:membro", async ({ u, p }) => {
    // O dono remove qualquer um; o membro pode sair sozinho.
    const { rows } = await db.query("SELECT * FROM agendas WHERE id = $1", [p.id]);
    const a = rows[0];
    if (!a) throw new Erro(404, "Agenda não encontrada.");
    if (a.dono_id !== u.id && p.membro !== u.id) throw new Erro(403, "Só o dono pode remover membros.");
    if (p.membro === a.dono_id) throw new Erro(400, "O dono não pode sair. Apague a agenda.");
    await db.query("DELETE FROM agenda_membros WHERE agenda_id = $1 AND usuario_id = $2 RETURNING agenda_id", [p.id, p.membro]);
    return { ok: true };
  });

  // Pagamento BravoPay (webhook)
  // Ajuste os nomes dos campos conforme a documentação do BravoPay.
  rota("POST", "/api/pagamento/webhook", async ({ corpo, req }) => {
    if (!BRAVOPAY_SEGREDO) throw new Erro(503, "Webhook não configurado.");
    const recebido = String(req.headers["x-faccliky-segredo"] || new URL(req.url, "http://x").searchParams.get("segredo") || "");
    const a = Buffer.from(recebido), b = Buffer.from(BRAVOPAY_SEGREDO);
    if (a.length !== b.length || !require("crypto").timingSafeEqual(a, b)) throw new Erro(401, "Não autorizado.");

    const referencia = texto(corpo.id || corpo.transaction_id || corpo.referencia, 120, true, "a referência");
    const status = String(corpo.status || "").toLowerCase();
    const email = String(corpo.email || corpo.customer?.email || corpo.cliente?.email || "").trim().toLowerCase();
    const valor = numero(corpo.valor ?? corpo.amount ?? null);
    const aprovado = ["aprovado", "approved", "paid", "pago", "completed", "concluido"].includes(status);

    const { rows: us } = await db.query("SELECT * FROM usuarios WHERE email = $1", [email]);
    const usuario = us[0] || null;
    const ja = await db.query("SELECT id, status FROM pagamentos WHERE referencia = $1", [referencia]);
    if (ja.rows[0]) {
      await db.query("UPDATE pagamentos SET status = $1, dados = $2 WHERE referencia = $3 RETURNING id",
        [status, JSON.stringify(corpo), referencia]);
      if (ja.rows[0].status === status) return { ok: true, repetido: true };
    } else {
      await db.query(
        "INSERT INTO pagamentos (usuario_id, referencia, status, valor, dados) VALUES ($1,$2,$3,$4,$5) RETURNING id",
        [usuario?.id || null, referencia, status, valor, JSON.stringify(corpo)]);
    }
    if (aprovado && usuario) {
      await db.query(
        `UPDATE usuarios SET premium_ate = GREATEST(COALESCE(premium_ate, now()), now()) + ($1 || ' days')::interval
          WHERE id = $2 RETURNING id`, [String(DIAS_PREMIUM), usuario.id]);
    }
    return { ok: true, premium_liberado: Boolean(aprovado && usuario) };
  }, { publica: true });

  // ---------- Servidor HTTP ----------
  return http.createServer(async (req, res) => {
    const origem = req.headers.origin;
    if (origem && (ORIGENS.includes(origem) || ORIGENS.includes("*"))) {
      res.setHeader("Access-Control-Allow-Origin", origem);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    const responder = (status, dados) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(dados));
    };
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

    try {
      const url = new URL(req.url, "http://localhost");
      let achou = null, p = {};
      for (const r of rotas) {
        const m = url.pathname.match(r.re);
        if (m && r.metodo === req.method) {
          achou = r;
          r.chaves.forEach((k, i) => { p[k] = Number(m[i + 1]); });
          break;
        }
      }
      if (!achou) return responder(404, { erro: "Rota não encontrada." });

      const ip = String(req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "");
      const corpo = ["POST", "PUT", "DELETE"].includes(req.method) ? (await lerCorpo(req)).json : {};
      const u = achou.publica ? null : await usuarioAtual(req);
      const r = await achou.fn({ req, url, corpo, p, u, ip });
      if (r && r.status && "dados" in r) return responder(r.status, r.dados);
      responder(200, r);
    } catch (e) {
      if (e instanceof Erro) return responder(e.status, { erro: e.message });
      console.error("[erro]", e);
      responder(500, { erro: "Erro no servidor. Tente de novo." });
    }
  });
}

// ---------- Iniciar ----------
async function iniciar() {
  if (!SEGREDO || SEGREDO.length < 32) {
    console.error("Configure SEGREDO_TOKEN no arquivo .env (pelo menos 32 caracteres).");
    process.exit(1);
  }
  const db = require("./db");
  await db.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  criarServidor(db).listen(PORTA, () => console.log(`Faccliky API rodando em http://localhost:${PORTA}`));
}

if (require.main === module) {
  iniciar().catch(e => { console.error("Falha ao iniciar:", e.message); process.exit(1); });
}

module.exports = { criarServidor, plano };
