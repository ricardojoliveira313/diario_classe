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
//
// ─── Permissões por página (viewers) ─────────────────────────────────────────
// O campo `permissoes` do usuário no Supabase controla quais abas o viewer vê.
// null = todas as abas de viewer liberadas (padrão retrocompatível)
// ["alunos","faltas"] = somente essas abas ficam visíveis

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './api';

export type Role = 'admin' | 'viewer';

// Chaves de página configuráveis para viewers
export const PAGINAS_VIEWER = [
  { key: 'dashboard',  label: '📊 Dashboard' },
  { key: 'turmas',     label: '👩‍🏫 Turmas' },
  { key: 'alunos',     label: '👥 Alunos' },
  { key: 'faltas',     label: '📋 Faltas' },
  { key: 'distorcao',  label: '📐 Distorção' },
  { key: 'pendentes',  label: '📋 Ata de Resultados' },
] as const;

export type PageKey = typeof PAGINAS_VIEWER[number]['key'];

interface AuthCtx {
  role: Role | null;
  username: string | null;
  /** null = todas as páginas liberadas; array = apenas essas páginas */
  permissoes: PageKey[] | null;
  login: (usuario: string, senha: string) => Promise<'admin' | 'viewer' | 'errado'>;
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

interface SessionState {
  role: Role;
  username: string;
  permissoes: PageKey[] | null;
}

const AuthContext = createContext<AuthCtx>({
  role: null, username: null, permissoes: null,
  login: () => Promise.resolve('errado' as const), logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState | null>(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      if (!s) return null;
      const parsed = JSON.parse(s);
      if ((parsed.role === 'admin' || parsed.role === 'viewer') && parsed.username) return parsed;
    } catch {}
    return null;
  });

  const login = async (usuario: string, senha: string): Promise<'admin' | 'viewer' | 'errado'> => {
    // 1º: VITE_USERS (rápido, sem DB) — usuários de env não têm permissões customizadas
    const envUser = USERS.find(
      u => u.usuario === usuario.trim().toLowerCase() && u.senha === senha
    );
    if (envUser) {
      const s: SessionState = { role: envUser.role, username: usuario.trim(), permissoes: null };
      setState(s);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      return envUser.role;
    }
    // 2º: tabela Usuario no Supabase (inclui campo permissoes)
    try {
      const { data } = await supabase
        .from('Usuario')
        .select('nome, senha, perfil, permissoes')
        .eq('nome', usuario.trim())
        .maybeSingle();
      if (data && data.senha === senha) {
        const role: Role = data.perfil === 'viewer' ? 'viewer' : 'admin';
        // Admin ignora permissoes; viewer usa o campo (null = tudo liberado)
        const permissoes: PageKey[] | null =
          role === 'admin' ? null : (Array.isArray(data.permissoes) ? data.permissoes : null);
        const s: SessionState = { role, username: usuario.trim(), permissoes };
        setState(s);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
        return role;
      }
    } catch {}
    return 'errado';
  };

  const logout = () => {
    setState(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{
      role: state?.role ?? null,
      username: state?.username ?? null,
      permissoes: state?.permissoes ?? null,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
