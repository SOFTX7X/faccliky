// Senhas criptografadas e tokens de login (sem bibliotecas externas)
const crypto = require("crypto");

function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, sal, 64).toString("hex");
  return `${sal}:${hash}`;
}

function conferirSenha(senha, salvo) {
  const [sal, hash] = String(salvo).split(":");
  if (!sal || !hash) return false;
  const teste = crypto.scryptSync(senha, sal, 64);
  const original = Buffer.from(hash, "hex");
  return original.length === teste.length && crypto.timingSafeEqual(original, teste);
}

const b64 = obj => Buffer.from(JSON.stringify(obj)).toString("base64url");

function criarToken(usuarioId, segredo, dias = 30) {
  const corpo = b64({ id: usuarioId, exp: Date.now() + dias * 86400000 });
  const assinatura = crypto.createHmac("sha256", segredo).update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
}

function lerToken(token, segredo) {
  if (!token || !token.includes(".")) return null;
  const [corpo, assinatura] = token.split(".");
  const certa = crypto.createHmac("sha256", segredo).update(corpo).digest("base64url");
  if (assinatura.length !== certa.length ||
      !crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(certa))) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString());
    return dados.exp > Date.now() ? dados : null;
  } catch { return null; }
}

module.exports = { hashSenha, conferirSenha, criarToken, lerToken };
