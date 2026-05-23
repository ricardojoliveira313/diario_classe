# PROMPT — Corrigir delay no login
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA
**Arquivos-alvo:** `frontend/src/main.tsx`, `frontend/src/pages/Login.tsx`
**Branch:** desenvolvimento atual

---

## PROBLEMA

Ao fazer login, o sistema demora porque `Login.tsx` executa `window.location.href = '/'`
— isso força um **reload completo da página** (rebaixa JS, CSS, refaz todas as queries do Supabase).

A causa raiz é que `main.tsx` tem `useEffect` declarados **após um return condicional**,
violando a regra de hooks do React (hooks não podem ser chamados condicionalmente).
Isso causava o bug original do F5. A solução foi usar `window.location.href`, mas
o efeito colateral é a lentidão.

---

## CORREÇÃO — `frontend/src/main.tsx`

### O que fazer:

Separar `AppContent` em **dois componentes**:
- `AppShell` — contém a navbar, rotas e os `useEffect` (só renderiza quando logado)
- `AppContent` — decide entre `<Login />` e `<AppShell />` sem violar hooks

### Localizar o início de `AppContent`:

```typescript
function AppContent() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [nPendentes, setNPendentes] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const { theme: themeMode, toggle: toggleTheme } = useTheme();
  const { ano, setAno } = useAno();
  const { role, username, logout } = useAuth();

  // Se não estiver logado, mostra tela de login
  if (!role) return <Login />;

  useEffect(() => {
```

### Substituir TODO o bloco `AppContent` por dois componentes separados:

```typescript
// ─── Shell principal (só renderiza quando logado) ────────────────────────────
function AppShell() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [nPendentes, setNPendentes] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const { theme: themeMode, toggle: toggleTheme } = useTheme();
  const { ano, setAno } = useAno();
  const { role, username, logout } = useAuth();

  useEffect(() => {
    api.contarPendentes().then(setNPendentes).catch(() => {});
    const id = setInterval(() => api.contarPendentes().then(setNPendentes).catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Filtra itens do menu conforme o perfil
  const navItems = NAV_ITEMS.filter(item => role === 'admin' || !item.adminOnly);

  // ── Cole aqui todo o restante do JSX que estava em AppContent ──
  // (a partir do `const navStyle: React.CSSProperties = {` até o fechamento do return)
  // Não alterar nada do JSX — apenas mover para dentro de AppShell
}

// ─── Controle de autenticação ─────────────────────────────────────────────────
function AppContent() {
  const { role } = useAuth();
  if (!role) return <Login />;
  return <AppShell />;
}
```

> ⚠️ **Atenção:** copiar todo o JSX que estava em `AppContent` (navbar, rotas, etc.)
> para dentro de `AppShell`. Não alterar o conteúdo — só reorganizar a estrutura.

---

## CORREÇÃO — `frontend/src/pages/Login.tsx`

Após a correção do `main.tsx`, o `window.location.href` deixa de ser necessário.
Quando o login é bem-sucedido, o React detecta a mudança de `role` no contexto
e renderiza `<AppShell />` automaticamente — sem reload.

### Localizar:
```typescript
} else {
  // Força navegação imediata — evita ficar na tela de login após autenticação
  window.location.href = '/';
}
```

### Substituir por:
```typescript
} else {
  // AppContent detecta role !== null e renderiza AppShell automaticamente
  // Não é necessário reload
}
```

> Ou seja: remover o `window.location.href = '/'` — o bloco `else` fica vazio
> (pode remover o else também, já que não há mais ação a tomar).

---

## RESULTADO ESPERADO

| Antes | Depois |
|---|---|
| Login → reload completo (2-4 segundos) | Login → troca de componente React (< 100ms) |
| F5 necessário em alguns casos | React re-renderiza automaticamente |
| Viola regra de hooks do React | Hooks corretos, sem violação |

---

## RESUMO

| # | Arquivo | O que fazer |
|---|---|---|
| 1 | `main.tsx` | Separar `AppContent` em `AppShell` (logado) + `AppContent` (decide login/app) |
| 2 | `Login.tsx` | Remover `window.location.href = '/'` |

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*
