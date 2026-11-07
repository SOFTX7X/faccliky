// Comunicação com o servidor (usado pelo login e pelo app)
const Faccliky = (() => {
  const CHAVE = "faccliky_token";
  const token = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
  const salvarToken = t => { try { localStorage.setItem(CHAVE, t); } catch {} };
  const sair = () => { try { localStorage.removeItem(CHAVE); } catch {} location.href = "entrar.html"; };

  async function api(metodo, caminho, corpo) {
    let res;
    try {
      res = await fetch(window.FACCLIKY.API_URL + caminho, {
        method: metodo,
        headers: { "Content-Type": "application/json", ...(token() ? { Authorization: "Bearer " + token() } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined
      });
    } catch {
      throw Object.assign(new Error("Sem conexão com o servidor. Tente de novo em instantes."), { status: 0 });
    }
    let dados = {};
    try { dados = await res.json(); } catch {}
    if (res.status === 401 && token() && !caminho.startsWith("/entrar")) { sair(); }
    if (!res.ok) throw Object.assign(new Error(dados.erro || "Algo deu errado."), { status: res.status });
    return dados;
  }

  return { api, token, salvarToken, sair };
})();
