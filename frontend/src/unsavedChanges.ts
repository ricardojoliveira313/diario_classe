// ─── Aviso de alterações não salvas ao trocar de aba ───────────────────────
// O React Router (BrowserRouter simples, sem data router) não tem como
// bloquear uma navegação interna — diferente de fechar/recarregar a página
// (window.beforeunload), clicar num link do menu não passa por nenhum
// evento do navegador. Esse módulo é um canal simples pra uma página avisar
// "eu tenho alterações não salvas" e o menu (em outro componente) consultar
// isso antes de deixar o clique navegar.
let getter: (() => boolean) | null = null;

export function registrarAlteracoesNaoSalvas(fn: (() => boolean) | null) {
  getter = fn;
}

export function existemAlteracoesNaoSalvas(): boolean {
  return getter ? getter() : false;
}
