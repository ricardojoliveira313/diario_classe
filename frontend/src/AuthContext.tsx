// ─── Autenticação com usuário + senha ─────────────────────────────────────
// Usuários definidos via variável de ambiente (Render → Environment):
//
//   VITE_USERS=gestao:minhasenha:admin,secretaria:outrasenha:admin,escola:abc123:viewer
//
//   Formato de cada entrada: usuario:senha:perfil
//   Perfis disponíveis: admin (acesso total) | viewer (somente visualização)
//
// Se VITE_USERS não estiver definida, não há usuários de atalho — o login
// usa exclusivamente a tabela Usuario no Supabase (cadastre por lá).
//
// A sessão persiste enquanto o browser estiver aberto (sessionStorage).
//
// ─── Permissões por página (viewers) ─────────────────────────────────────────
// O campo `permissoes` do usuário no Supabase controla quais abas o viewer vê.
// null = todas as abas de viewer liberadas (padrão retrocompatível)
// ["alunos","faltas"] = somente essas abas ficam visíveis
//
// ─── Capacidades especiais (viewers) ─────────────────────────────────────────
// Guardadas também no array `permissoes`:
//   "editar_cpf"      → pode editar CPF dos alunos
//   "editar_cor_raca" → pode editar Cor/Raça dos alunos
//   "faltas_todas"    → pode lançar faltas em todas as turmas
//   "acessar_genero"  → pode consultar a aba Gênero e emitir relatórios

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
  { key: 'bffrequencia', label: '💚 BF - Frequência' },
  { key: 'ocorrencias',label: '📋 Ocorrências' },
  { key: 'distorcao',  label: '📐 Distorção' },
  { key: 'pendentes',  label: '📋 Ata de Resultados' },
  { key: 'historico',  label: '📜 Histórico Escolar' },
  { key: 'formularios', label: '📄 Formulários' },
  { key: 'bilhetes',    label: '📝 Bilhetes' },
  { key: 'capa',        label: '✉️ Capa de Envelope' },
  { key: 'educacenso',  label: '🔗 Educacenso' },
  { key: 'situacoes',   label: '🔄 Situações' },
  { key: 'analitico',   label: '📈 Painel Analítico' },
  { key: 'faixaetaria', label: '📅 Faixa Etária' },
] as const;

export type PageKey = typeof PAGINAS_VIEWER[number]['key'];

// Capacidades especiais (permissões granulares além das páginas)
export const CAPABILITIES = [
  { key: 'acessar_genero',  label: '👫 Pode consultar a aba Gênero' },
  { key: 'editar_cpf',      label: '✏️ Pode editar CPF dos alunos' },
  { key: 'editar_cor_raca', label: '🎨 Pode editar Cor/Raça dos alunos' },
  { key: 'faltas_todas',    label: '📋 Pode lançar faltas em todas as turmas' },
] as const;

export type CapabilityKey = typeof CAPABILITIES[number]['key'];
export type PermKey = PageKey | CapabilityKey;

interface AuthCtx {
  role: Role | null;
  username: string | null;
  /** null = todas as páginas liberadas; array = apenas essas páginas + capacidades */
  permissoes: PermKey[] | null;
  /** null = sem turma restrita; UUID = professor restrito a essa turma */
  turmaId: string | null;
  // Capacidades computadas (shortcut para não testar permissoes em todo lugar)
  podeEditarCpf: boolean;
  podeEditarCorRaca: boolean;
  podeEditarTodasFaltas: boolean;
  podeAcessarGenero: boolean;
  login: (usuario: string, senha: string) => Promise<'admin' | 'viewer' | 'errado' | 'erro_conexao'>;
  logout: () => void;
}

// ─── Parse dos usuários da variável de ambiente ─────────────────────────────
// SEM fallback hardcoded: uma lista de usuário/senha fixa no código-fonte vai
// para o bundle JS público, visível a qualquer visitante (achado crítico da
// auditoria de ago/2026). Login sem VITE_USERS configurada cai direto na
// tabela Usuario do Supabase via RPC verificar_login (senha nunca em claro).
const VITE_USERS = (import.meta as any).env?.VITE_USERS || '';
const USERS_RAW = VITE_USERS;

interface UserEntry { usuario: string; senha: string; role: Role; }

const parseUsers = (raw: string): UserEntry[] => raw
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

const USERS: UserEntry[] = parseUsers(USERS_RAW);

const SESSION_KEY = 'diario_auth';

interface SessionState {
  role: Role;
  username: string;
  permissoes: PermKey[] | null;
  turmaId: string | null;
}

function hasCapability(permissoes: PermKey[] | null, key: CapabilityKey, role: Role): boolean {
  if (role === 'admin') return true;
  if (permissoes === null) return false; // null = todas as páginas, mas NÃO capacidades especiais
  return permissoes.includes(key);
}

const AuthContext = createContext<AuthCtx>({
  role: null, username: null, permissoes: null, turmaId: null,
  podeEditarCpf: false, podeEditarCorRaca: false, podeEditarTodasFaltas: false,
  podeAcessarGenero: false,
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

  const login = async (usuario: string, senha: string): Promise<'admin' | 'viewer' | 'errado' | 'erro_conexao'> => {
    // 1º: VITE_USERS (rápido, sem DB) — usuários de env não têm permissões customizadas
    const envUser = USERS.find(
      u => u.usuario === usuario.trim().toLowerCase() && u.senha === senha
    );
    if (envUser) {
      const s: SessionState = { role: envUser.role, username: usuario.trim(), permissoes: null, turmaId: null };
      setState(s);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      return envUser.role;
    }
    // 2º: tabela Usuario no Supabase — senha nunca trafega em claro pela API;
    // a comparação acontece dentro do banco via função verificar_login (RPC)
    try {
      const { data, error } = await supabase.rpc('verificar_login', {
        p_nome: usuario.trim(),
        p_senha: senha,
      });
      // Falha de conexão/indisponibilidade do Supabase — não é "senha errada",
      // é o servidor não ter respondido. Diferencia pra não confundir o usuário.
      if (error) return 'erro_conexao';
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        const role: Role = row.perfil === 'viewer' ? 'viewer' : 'admin';
        // Admin ignora permissoes; viewer usa o campo (null = tudo liberado)
        const permissoes: PermKey[] | null =
          role === 'admin' ? null : (Array.isArray(row.permissoes) ? row.permissoes : null);
        const turmaId: string | null = role === 'admin' ? null : (row.turma_id ?? null);
        const s: SessionState = { role, username: usuario.trim(), permissoes, turmaId };
        setState(s);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
        return role;
      }
    } catch {
      return 'erro_conexao';
    }
    return 'errado';
  };

  const logout = () => {
    setState(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const role = state?.role ?? null;
  const permissoes = state?.permissoes ?? null;

  return (
    <AuthContext.Provider value={{
      role,
      username: state?.username ?? null,
      permissoes,
      turmaId: state?.turmaId ?? null,
      podeEditarCpf:        hasCapability(permissoes, 'editar_cpf',      role ?? 'viewer'),
      podeEditarCorRaca:    hasCapability(permissoes, 'editar_cor_raca',  role ?? 'viewer'),
      podeEditarTodasFaltas:hasCapability(permissoes, 'faltas_todas',     role ?? 'viewer'),
      podeAcessarGenero:    hasCapability(permissoes, 'acessar_genero',   role ?? 'viewer'),
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
