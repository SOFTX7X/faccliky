// Conexão com o PostgreSQL
const { Pool, types } = require("pg");

// Datas (sem hora) chegam como texto "AAAA-MM-DD", sem mudar de dia por causa do fuso
types.setTypeParser(1082, v => v);

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NOME || "faccliky",
  user: process.env.DB_USUARIO || "postgres",
  password: process.env.DB_SENHA || "",
  max: 10
});

pool.on("error", err => console.error("[banco] erro inesperado:", err.message));

module.exports = {
  query: (texto, params) => pool.query(texto, params)
};
