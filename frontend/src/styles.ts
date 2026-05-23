// ─── Design System — Tokens e estilos centralizados ───

export const theme = {
  primary: '#1e40af',
  primaryHover: '#1e3a8a',
  primaryLight: '#dbeafe',
  primaryBg: '#eff6ff',
  // Cor de texto azul — escura no light, clara no dark (para evitar baixo contraste)
  primaryText: 'var(--primary-text)',
  sky: '#0ea5e9',
  skyHover: '#0284c7',
  success: '#10b981',
  successHover: '#059669',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningHover: '#d97706',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerHover: '#dc2626',
  dangerLight: '#fee2e2',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
  orange: '#f97316',
  orangeLight: '#ffedd5',
  bg: 'var(--bg)',
  card: 'var(--bg-card)',
  text: 'var(--text)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  border: 'var(--border)',
  borderLight: 'var(--border-light)',
  shadowSm: 'var(--shadow-sm)',
  shadow: 'var(--shadow)',
  shadowMd: 'var(--shadow-md)',
  shadowLg: 'var(--shadow-lg)',
  radius: '8px',
  radiusMd: '12px',
  radiusLg: '16px',
};

export type BtnVariant = 'primary' | 'success' | 'danger' | 'warning' | 'sky' | 'ghost';

export function btn(variant: BtnVariant = 'primary', opts: { small?: boolean; full?: boolean; outline?: boolean } = {}): React.CSSProperties {
  const colors = {
    primary: { bg: theme.primary, hover: theme.primaryHover, text: '#fff' },
    success: { bg: theme.success, hover: theme.successHover, text: '#fff' },
    danger: { bg: theme.danger, hover: theme.dangerHover, text: '#fff' },
    warning: { bg: theme.warning, hover: theme.warningHover, text: '#fff' },
    sky: { bg: theme.sky, hover: theme.skyHover, text: '#fff' },
    ghost: { bg: 'var(--ghost-bg)', hover: 'var(--ghost-hover)', text: theme.text },
  };
  const c = colors[variant];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: opts.outline ? `1.5px solid ${c.bg}` : 'none',
    cursor: 'pointer',
    fontWeight: 600,
    borderRadius: theme.radius,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    ...(opts.small ? { padding: '8px 14px', fontSize: 13 } : { padding: '12px 20px', fontSize: 15 }),
    ...(opts.full ? { width: '100%' } : {}),
    background: opts.outline ? 'transparent' : c.bg,
    color: opts.outline ? c.bg : c.text,
  };
}

export const input: React.CSSProperties = {
  padding: '11px 14px',
  borderRadius: theme.radius,
  border: `1.5px solid ${theme.border}`,
  width: '100%',
  fontSize: 15,
  background: 'var(--input-bg)',
  color: 'var(--text)',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

export const label: React.CSSProperties = {
  fontSize: 13,
  color: theme.textSecondary,
  fontWeight: 600,
  marginBottom: 5,
  display: 'block',
};

export function card(p: React.CSSProperties = {}): React.CSSProperties {
  return { background: theme.card, borderRadius: theme.radius, boxShadow: theme.shadow, overflow: 'hidden', ...p };
}

export function row(index: number, extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '10px 16px',
    display: 'grid',
    gap: 8,
    alignItems: 'center',
    borderBottom: `1px solid ${theme.borderLight}`,
    background: index % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)',
    transition: 'background 0.15s ease',
    ...extra,
  };
}

export const SITUACAO_COR: Record<string, string> = {
  ATIVO: '#16a34a', REMA: '#ea580c', BXTR: '#9333ea', TRAN: '#0284c7', 'N COM': '#dc2626', ABAN: '#6b7280',
};

export const SITUACAO_LABEL: Record<string, string> = {
  ATIVO: 'Ativo', REMA: 'Remanejado', BXTR: 'Baixa Transf.', TRAN: 'Transferido', 'N COM': 'N. Compareceu', ABAN: 'Abandono',
};

export const SITUACOES = ['ATIVO', 'REMA', 'BXTR', 'TRAN', 'N COM', 'ABAN'];

export const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Calendário Escolar 2026 — EMEIEF Luiz Gonzaga — Santo André/SP ────────

/** Feriados fixos que se repetem todo ano (chave: 'MM-DD') */
export const FERIADOS_FIXOS: Record<string, string> = {
  '01-01': 'Ano Novo',
  '04-08': 'Aniversário de Santo André',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalhador',
  '07-09': 'Revolução Constitucionalista (SP)',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '10-13': 'Dia do Professor',
  '10-28': 'Dia do Servidor Público',
  '11-02': 'Dia de Finados',
  '11-20': 'Dia da Consciência Negra',
  '12-25': 'Natal',
};

/** Feriados e emendas móveis por ano (chave: 'MM-DD') */
export const FERIADOS_MOVEIS: Record<number, Record<string, string>> = {
  2026: {
    '02-16': 'Emenda Carnaval',
    '02-17': 'Carnaval',
    '04-03': 'Sexta-feira Santa',
    '04-20': 'Emenda Tiradentes',
    '06-04': 'Corpus Christi',
    '06-05': 'Emenda Corpus Christi',
    '07-10': 'Emenda Revolução Constitucionalista',
  },
};

/** Sábados que são dias letivos (compensação) */
export const SABADOS_LETIVOS: Record<number, string[]> = {
  2026: ['2026-06-27', '2026-12-12'],
};

/** Períodos de recesso/férias sem aulas para alunos */
export const RECESSO_ESCOLAR: Record<number, Array<{ inicio: string; fim: string; descricao: string }>> = {
  2026: [
    { inicio: '2026-01-01', fim: '2026-02-05', descricao: 'Férias de verão' },
    { inicio: '2026-07-09', fim: '2026-07-28', descricao: 'Recesso escolar — julho' },
    { inicio: '2026-12-23', fim: '2026-12-31', descricao: 'Recesso de final de ano' },
  ],
};

export function getFeriado(ano: number, mes: number, dia: number): string | null {
  const mmdd = String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
  return FERIADOS_FIXOS[mmdd] ?? FERIADOS_MOVEIS[ano]?.[mmdd] ?? null;
}

export function isRecesso(ano: number, mes: number, dia: number): string | null {
  const data = new Date(ano, mes - 1, dia);
  for (const r of (RECESSO_ESCOLAR[ano] ?? [])) {
    if (data >= new Date(r.inicio) && data <= new Date(r.fim)) return r.descricao;
  }
  return null;
}

export function isSabadoLetivo(ano: number, mes: number, dia: number): boolean {
  const s = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return (SABADOS_LETIVOS[ano] ?? []).includes(s);
}

// Calendário letivo por ano e mês — atualize anualmente
export const DIAS_LETIVOS_ANO: Record<number, Record<number, number>> = {
  2025: { 1: 0, 2: 19, 3: 21, 4: 19, 5: 21, 6: 20, 7: 10, 8: 21, 9: 22, 10: 19, 11: 20, 12: 15 },
  2026: { 1: 0, 2: 13, 3: 22, 4: 18, 5: 20, 6: 21, 7: 9, 8: 21, 9: 21, 10: 19, 11: 19, 12: 17 },
  2027: { 1: 0, 2: 20, 3: 23, 4: 18, 5: 21, 6: 20, 7: 10, 8: 22, 9: 22, 10: 20, 11: 20, 12: 14 },
};

export function getDiasLetivos(mes: number, ano: number): number {
  return (DIAS_LETIVOS_ANO[ano] ?? DIAS_LETIVOS_ANO[2026])[mes] ?? 22;
}

// Compatibilidade retroativa
export const DIAS_LETIVOS: Record<number, number> = DIAS_LETIVOS_ANO[2026];
