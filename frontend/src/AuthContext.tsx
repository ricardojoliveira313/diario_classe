// ─── Autenticação com usuário + senha ─────────────────────────────────────
// Usuários definidos via variável de ambiente (Render → Environment):
//
//   VITE_USERS=gestao:minhasenha:admin,secretaria:outrasenha:admin,escola:abc123:viewer
//
//   Formato de cada entrada: usuario:senha:perfil
//   Perfis disponíveis: admin (acesso total) | viewer (somente visualização)
//
// Padrões (se VITE_USERS não estiver definida):
//   gestao:gestao2026:admin
//   escola:escola2026:viewer
//
// A sessão persiste enquanto o browser estiver aberto (sessionStorage).

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type Role = 'admin' | 'viewer';

interface AuthCtx {
  role: Role | null;
  username: string | null;
  login: (usuario: string, senha: string) => 'admin' | 'viewer' | 'errado';
  logout: () => void;
}

// ─── Parse dos usuários da variável de ambiente ─────────────────────────────
const DEFAULT_USERS = 'gestao:gestao2026:admin,escola:escola2026:viewer';
const USERS_RAW = (import.meta as any).env?.VITE_USERS || DEFAULT_USERS;

interface UserEntry { usuario: string; senha: string; role: Role; }

const USERS: UserEntry[] = USERS_RAW
  .split(',')
  .map((entry: string) => entry.trim())
  .filter(Boolean)
  .map((entry: string) => {
    const parts = entry.split(':');
    if (parts.length < 3) return null;
    const [usuario, senha, roleRaw] = parts;
    const role: Role = roleRaw?.trim() === 'viewer' ? 'viewer' : 'admin';
    return { usuario: usuario.trim().toLowerCase(), senha: senha.trim(), role };
  })
  .filter(Boolean) as UserEntry[];

const SESSION_KEY = 'diario_auth';

const AuthContext = createContext<AuthCtx>({
  role: null, username: null,
  login: () => 'errado', logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ role: Role; username: string } | null>(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      if (!s) return null;
      const parsed = JSON.parse(s);
      if ((parsed.role === 'admin' || parsed.role === 'viewer') && parsed.username) return parsed;
    } catch {}
    return null;
  });

  const login = (usuario: string, senha: string): 'admin' | 'viewer' | 'errado' => {
    const user = USERS.find(
      u => u.usuario === usuario.trim().toLowerCase() && u.senha === senha
    );
    if (!user) return 'errado';
    const s = { role: user.role, username: usuario.trim() };
    setState(s);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return user.role;
  };

  const logout = () => {
    setState(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ role: state?.role ?? null, username: state?.username ?? null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
