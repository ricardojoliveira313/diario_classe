// ─── Autenticação simples por senha ───────────────────────────────────────
// Duas senhas configuram dois papéis:
//   admin  → acesso completo (importar, editar, tudo)
//   viewer → somente visualização (sem importar, sem editar)
//
// Senhas definidas por variáveis de ambiente (Render → Environment):
//   VITE_ADMIN_PASSWORD  (padrão: "admin2026")
//   VITE_VIEWER_PASSWORD (padrão: "escola2026")
//
// A sessão persiste enquanto o browser estiver aberto (sessionStorage).
// Fecha o browser → precisa fazer login novamente.

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type Role = 'admin' | 'viewer';

interface AuthCtx {
  role: Role | null;
  login: (senha: string) => 'admin' | 'viewer' | 'errado';
  logout: () => void;
}

const ADMIN_PASS  = (import.meta as any).env?.VITE_ADMIN_PASSWORD  || 'admin2026';
const VIEWER_PASS = (import.meta as any).env?.VITE_VIEWER_PASSWORD || 'escola2026';
const SESSION_KEY = 'diario_role';

const AuthContext = createContext<AuthCtx>({ role: null, login: () => 'errado', logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(() => {
    const s = sessionStorage.getItem(SESSION_KEY);
    return s === 'admin' || s === 'viewer' ? s : null;
  });

  const login = (senha: string): 'admin' | 'viewer' | 'errado' => {
    if (senha === ADMIN_PASS)  { setRole('admin');  sessionStorage.setItem(SESSION_KEY, 'admin');  return 'admin'; }
    if (senha === VIEWER_PASS) { setRole('viewer'); sessionStorage.setItem(SESSION_KEY, 'viewer'); return 'viewer'; }
    return 'errado';
  };

  const logout = () => { setRole(null); sessionStorage.removeItem(SESSION_KEY); };

  return <AuthContext.Provider value={{ role, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
