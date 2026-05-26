import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Alunos from './pages/Alunos';
import Faltas from './pages/Faltas';
import Importar from './pages/Importar';
import Turmas from './pages/Turmas';
import Dashboard from './pages/Dashboard';
import OCR from './pages/OCR';
import Professor from './pages/Professor';
import Pendentes from './pages/Pendentes';
import Distorcao from './pages/Distorcao';
import Usuarios from './pages/Usuarios';
import Login from './pages/Login';
import { api } from './api';
import { theme } from './styles';
import { ThemeProvider, useTheme } from './ThemeContext';
import { AnoProvider, useAno } from './AnoContext';
import { AuthProvider, useAuth } from './AuthContext';
import type { Role, PageKey } from './AuthContext';

// ─── Itens de navegação ────────────────────────────────────────────────────
// adminOnly: true  → visível apenas para admin
// pageKey          → chave usada no painel de permissões (viewers)
//                    se pageKey estiver definida, viewer só vê se permissoes===null
//                    ou se permissoes.includes(pageKey)
const NAV_ITEMS: { to: string; label: string; end?: boolean; badge?: boolean; adminOnly?: boolean; pageKey?: PageKey }[] = [
  { to: '/',          label: '📊 Dashboard', end: true,              pageKey: 'dashboard' },
  { to: '/importar',  label: '📥 Importar',  adminOnly: true },
  { to: '/turmas',    label: '👩‍🏫 Turmas',                            pageKey: 'turmas' },
  { to: '/alunos',    label: '👥 Alunos',                             pageKey: 'alunos' },
  { to: '/faltas',    label: '📋 Faltas',                             pageKey: 'faltas' },
  { to: '/distorcao', label: '📐 Distorção',                          pageKey: 'distorcao' },
  { to: '/ocr',       label: '📷 OCR',       adminOnly: true },
  { to: '/pendentes', label: '📋 Ata de Resultados', badge: true,    pageKey: 'pendentes' },
  { to: '/usuarios',  label: '👥 Usuários',  adminOnly: true },
];

const ANOS_DISPONIVEIS = [2025, 2026, 2027];

// ─── Guarda de rota: redireciona viewers para / se tentarem acessar rota admin ─
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ─── Guarda de rota: redireciona viewers sem permissão para / ─────────────────
function ViewerRoute({ children, pageKey }: { children: React.ReactNode; pageKey: PageKey }) {
  const { role, permissoes } = useAuth();
  if (role === 'admin') return <>{children}</>;          // admin: acesso total
  if (permissoes === null) return <>{children}</>;       // null = todas liberadas
  if (!permissoes.includes(pageKey)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppShell() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [nPendentes, setNPendentes] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const { theme: themeMode, toggle: toggleTheme } = useTheme();
  const { ano, setAno } = useAno();
  const { role, username, logout, permissoes } = useAuth();

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

  // Filtra itens do menu conforme o perfil e permissões
  const navItems = NAV_ITEMS.filter(item => {
    if (role === 'admin') return true;                    // admin vê tudo
    if (item.adminOnly) return false;                     // viewer nunca vê adminOnly
    if (!item.pageKey) return true;                       // sem pageKey → sempre visível
    if (permissoes === null) return true;                 // null = todas liberadas
    return permissoes.includes(item.pageKey);             // verifica whitelist
  });

  const navStyle: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 50,
    background: theme.primary,
    boxShadow: scrolled ? theme.shadowMd : 'none',
    transition: 'box-shadow 0.2s ease',
    userSelect: 'none', WebkitUserSelect: 'none',
  };

  const innerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 1,
    maxWidth: 1200, margin: '0 auto', padding: '0 8px', minHeight: 48,
  };

  const linkBase: React.CSSProperties = {
    color: '#bfdbfe', textDecoration: 'none', padding: '7px 8px',
    borderRadius: theme.radius, fontSize: 13, fontWeight: 500,
    transition: 'all 0.15s ease', whiteSpace: 'nowrap',
    userSelect: 'none', WebkitUserSelect: 'none',
  };

  const linkActive: React.CSSProperties = {
    ...linkBase, background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700,
  };

  const roleBadgeStyle: React.CSSProperties = {
    background: role === 'admin' ? 'rgba(16,185,129,0.25)' : 'rgba(251,191,36,0.25)',
    color: role === 'admin' ? '#6ee7b7' : '#fde68a',
    border: `1px solid ${role === 'admin' ? 'rgba(16,185,129,0.4)' : 'rgba(251,191,36,0.4)'}`,
    borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700,
    whiteSpace: 'nowrap',
  };

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: theme.bg }}>
        <nav style={navStyle}>
          <div style={innerStyle}>
            <NavLink to="/" end style={{ color: 'white', fontWeight: 800, marginRight: 4, fontSize: 15, textDecoration: 'none', whiteSpace: 'nowrap', letterSpacing: '-0.3px' }}>
              📚 Diário
            </NavLink>

            {/* Desktop menu */}
            <div style={{ display: 'flex', gap: 1, flex: 1, overflow: 'hidden' }}>
              {navItems.map(item => (
                <NavLink
                  key={item.to} to={item.to} end={item.end}
                  style={({ isActive }) => isActive ? linkActive : linkBase}
                >
                  {item.badge && nPendentes > 0 ? (
                    <span>{item.label}
                      <span style={{ marginLeft: 4, background: theme.danger, color: 'white', borderRadius: 10, padding: '0px 5px', fontSize: 11, fontWeight: 700 }}>{nPendentes}</span>
                    </span>
                  ) : item.label}
                </NavLink>
              ))}
            </div>

            {/* Badge de perfil + nome do usuário */}
            <span style={roleBadgeStyle} title={`${username || ''} — ${role === 'admin' ? 'Acesso completo' : 'Somente visualização'}`}>
              {role === 'admin' ? '🔑' : '👁️'} {(username || '').split(':')[0].substring(0, 10)}
            </span>

            {/* Seletor de ano */}
            <select
              value={ano} onChange={e => setAno(Number(e.target.value))}
              title="Ano letivo"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', borderRadius: 6, padding: '4px 6px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginLeft: 4, minWidth: 60 }}
            >
              {ANOS_DISPONIVEIS.map(a => <option key={a} value={a} style={{ background: theme.primary, color: 'white' }}>{a}</option>)}
            </select>

            {/* Theme toggle */}
            <button onClick={toggleTheme} title={themeMode === 'light' ? 'Modo escuro' : 'Modo claro'}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, fontSize: 16, lineHeight: 1 }}>
              {themeMode === 'light' ? '🌙' : '☀️'}
            </button>

            {/* Sair */}
            <button onClick={logout} title="Sair"
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '5px 7px', borderRadius: 6, fontSize: 12, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap' }}>
              ⬅ Sair
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuAberto(!menuAberto)}
              style={{ display: 'none', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', padding: '6px 10px', borderRadius: theme.radius, marginLeft: 'auto' }}
              className="mobile-menu-btn"
            >
              {menuAberto ? '✕' : '☰'}
            </button>

            {/* GitHub */}
            <a href="https://github.com/ricardojoliveira313/diario_classe" target="_blank" rel="noopener noreferrer"
              style={{ color: '#93c5fd', textDecoration: 'none', padding: '6px 8px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg height="15" width="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              <span style={{ display: 'inline' }}>GitHub</span>
            </a>
          </div>

          {/* Mobile menu dropdown */}
          {menuAberto && (
            <div style={{ display: 'none', flexDirection: 'column', padding: '8px 12px 12px', gap: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }} className="mobile-menu">
              {navItems.map(item => (
                <NavLink
                  key={item.to} to={item.to} end={item.end}
                  onClick={() => setMenuAberto(false)}
                  style={({ isActive }) => ({ ...linkBase, padding: '10px 12px', display: 'block', ...(isActive ? linkActive : {}) })}
                >
                  {item.badge && nPendentes > 0 ? `${item.label} (${nPendentes})` : item.label}
                </NavLink>
              ))}
              <button onClick={logout} style={{ ...linkBase, background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', textAlign: 'left', padding: '10px 12px' }}>
                ⬅ Sair
              </button>
            </div>
          )}
        </nav>

        <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<ViewerRoute pageKey="dashboard"><Dashboard /></ViewerRoute>} />
            <Route path="/importar" element={<AdminRoute><Importar /></AdminRoute>} />
            <Route path="/turmas" element={<ViewerRoute pageKey="turmas"><Turmas /></ViewerRoute>} />
            <Route path="/alunos" element={<ViewerRoute pageKey="alunos"><Alunos /></ViewerRoute>} />
            <Route path="/faltas" element={<ViewerRoute pageKey="faltas"><Faltas /></ViewerRoute>} />
            <Route path="/distorcao" element={<ViewerRoute pageKey="distorcao"><Distorcao /></ViewerRoute>} />
            <Route path="/ocr" element={<AdminRoute><OCR /></AdminRoute>} />
            <Route path="/professor" element={<Professor />} />
            <Route path="/pendentes" element={<ViewerRoute pageKey="pendentes"><Pendentes /></ViewerRoute>} />
            <Route path="/usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

// ─── Controle de autenticação ─────────────────────────────────────────────────
function AppContent() {
  const { role } = useAuth();
  if (!role) return <Login />;
  return <AppShell />;
}

function App() {
  return (
    <ThemeProvider>
      <AnoProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </AnoProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
