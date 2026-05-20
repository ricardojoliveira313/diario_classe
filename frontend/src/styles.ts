// ─── Design System — Tokens e estilos centralizados ───

export const theme = {
  primary: '#1e40af',
  primaryHover: '#1e3a8a',
  primaryLight: '#dbeafe',
  primaryBg: '#eff6ff',
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

export const DIAS_LETIVOS: Record<number, number> = {
  1: 4, 2: 13, 3: 22, 4: 18, 5: 20, 6: 21,
  7: 9, 8: 21, 9: 22, 10: 18, 11: 20, 12: 17,
};
