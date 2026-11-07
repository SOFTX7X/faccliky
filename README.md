# Faccliky

Agenda inteligente com o assistente **Kliky**. 7 dias de Premium grátis; depois, plano Básico grátis ou assinatura Premium.

## O que tem

| Parte | Arquivos |
|---|---|
| Página inicial | `index.html`, `style.css`, `script.js` |
| Entrar / criar conta | `entrar.html` |
| App (Hoje, Agenda, Kliky, Contas, Hábitos, Grupos, Plano, Configurações) | `app.html`, `app.js`, `app.css`, `kliky.js` |
| Servidor (API) + banco | `server/` |

**Plano Básico:** agenda, tarefas, lembretes e ver grupos em que foi convidado.
**Premium / teste:** tudo do Básico + Kliky, dia planejado automático, contas e metas de gasto, hábitos, criar grupos compartilhados.

## Rodar no PC (Windows)

1. **Banco:** no PostgreSQL, crie um banco chamado `faccliky` (separado do BLACKE).
2. **Configuração:** em `server/`, copie `.env.example` para `.env` e preencha a senha do PostgreSQL e o `SEGREDO_TOKEN`.
3. **Iniciar:** dê dois cliques em `server/iniciar.bat`. Ele instala o necessário, cria as tabelas sozinho e reinicia se o servidor cair.
4. **Testar:** abra `http://localhost:3100/api/saude`. Deve aparecer `"ok":true`.

## Publicar

1. **Túnel Cloudflare** próprio apontando para `http://localhost:3100`, por exemplo `api.seudominio.com`.
2. Em `config.js`, troque `API_URL` por `https://api.seudominio.com/api`.
3. Em `server/.env`, coloque o endereço do site em `ORIGENS`.
4. Publique o site na Vercel (é só HTML, sem build).

## Cobrança (BravoPay)

1. Em `config.js`, coloque o link de pagamento do Premium em `CHECKOUT_URL`.
2. No BravoPay, configure o webhook para `https://api.seudominio.com/api/pagamento/webhook?segredo=SEU_SEGREDO` (o mesmo valor de `BRAVOPAY_SEGREDO_WEBHOOK` no `.env`).
3. Cada pagamento aprovado libera 30 dias de Premium para o e-mail da compra (`DIAS_PREMIUM_POR_PAGAMENTO`).

> Os nomes dos campos do webhook (`id`, `status`, `email`, `amount`) estão em `server/server.js`, na rota `/api/pagamento/webhook`. Ajuste conforme a documentação do BravoPay.

## Backup

Faça backup do banco `faccliky` com `pg_dump` para o HD (E:) e para o Google Drive.
