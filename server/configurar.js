// Cria o arquivo .env sozinho: pede só a senha do PostgreSQL e gera o texto secreto.
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");

const env = path.join(__dirname, ".env");
const exemplo = path.join(__dirname, ".env.example");

if (fs.existsSync(env)) {
  console.log("A configuracao (.env) ja existe.");
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Digite a senha do PostgreSQL e aperte Enter: ", senha => {
  rl.close();
  senha = senha.trim();
  if (!senha) { console.log("Senha vazia. Rode de novo."); process.exit(1); }

  let t = fs.readFileSync(exemplo, "utf8").replace(/\r?\n/g, "\n");
  const segredo = crypto.randomBytes(32).toString("hex");
  t = t.replace(/^DB_SENHA=.*$/m, () => "DB_SENHA=" + senha)
       .replace(/^SEGREDO_TOKEN=.*$/m, () => "SEGREDO_TOKEN=" + segredo);
  fs.writeFileSync(env, t.replace(/\n/g, "\r\n"));
  console.log("Configuracao salva.");
});
