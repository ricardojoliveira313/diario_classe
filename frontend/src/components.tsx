import { theme, SITUACAO_COR, SITUACAO_LABEL } from './styles';

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      border: `3px solid ${theme.border}`,
      borderTopColor: theme.primary,
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
      display: 'inline-block',
    }} />
  );
}

export function Loading({ text = 'Carregando...' }: { text?: string }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 48, color: theme.textSecondary }}>
      <Spinner size={28} />
      <p style={{ marginTop: 12, fontSize: 14 }}>{text}</p>
    </div>
  );
}

export function EmptyState({ icon, message, action }: { icon: string; message: string; action?: { label: string; href: string } }) {
  return (
    <div style={{ textAlign: 'center', color: theme.textSecondary, marginTop: 60, animation: 'fadeIn 0.3s ease both' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 15, marginBottom: action ? 12 : 0 }}>{message}</p>
      {action && <a href={action.href} style={{ color: theme.primary, fontWeight: 600, fontSize: 14 }}>→ {action.label}</a>}
    </div>
  );
}

export function StatCard({ label, val, color, sub }: { label: string; val: string | number; color: string; sub?: string }) {
  return (
    <div style={{
      background: theme.card,
      borderRadius: theme.radius,
      padding: '12px 14px',
      boxShadow: theme.shadow,
      textAlign: 'center',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    }}>
      <div style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.2 }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function BadgeSituacao({ situacao }: { situacao: string }) {
  const cor = SITUACAO_COR[situacao] ?? theme.textSecondary;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: cor, background: `${cor}18`,
      border: `1px solid ${cor}40`,
      borderRadius: 4, padding: '2px 6px',
      display: 'inline-block',
    }}>
      {SITUACAO_LABEL[situacao] ?? situacao}
    </span>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      padding: 12,
      background: theme.dangerLight,
      borderRadius: theme.radius,
      border: `1px solid ${theme.danger}`,
      color: theme.danger,
      fontSize: 13,
      animation: 'fadeIn 0.2s ease both',
    }}>
      ⚠️ {message}
    </div>
  );
}

export function SuccessBox({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{
      background: theme.successLight,
      borderRadius: theme.radiusMd,
      padding: 24,
      textAlign: 'center',
      border: `2px solid ${theme.success}`,
      animation: 'scaleIn 0.3s ease both',
    }}>
      <div style={{ fontSize: 40 }}>✅</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: theme.successHover, marginTop: 8 }}>{title}</p>
      {children}
    </div>
  );
}

export function ProgressBar({ current, total }: { current: number; total: number }) {
  if (total === 0) return null;
  return (
    <div style={{ height: 8, background: theme.border, borderRadius: 4, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
      <div style={{
        height: '100%',
        background: `linear-gradient(90deg, ${theme.primary}, ${theme.sky})`,
        transition: 'width 0.3s ease',
        width: `${(current / total) * 100}%`,
        borderRadius: 4,
      }} />
    </div>
  );
}

export function FileRow({ name, size, onRemove }: { name: string; size: number; onRemove: () => void }) {
  const ext = name.split('.').pop()?.toLowerCase();
  const icon = ext === 'pdf' ? '📄' : ext === 'xlsx' ? '📊' : ext === 'xls' ? '📋' : '📝';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px', background: theme.card,
      borderRadius: theme.radius, marginBottom: 4, fontSize: 13,
      border: `1px solid ${theme.borderLight}`,
    }}>
      <span>{icon}</span>
      <span style={{ flex: 1, fontWeight: 500 }}>{name}</span>
      <span style={{ fontSize: 11, color: theme.textMuted }}>{(size / 1024).toFixed(0)} KB</span>
      <button onClick={onRemove} style={{
        border: 'none', background: 'none', cursor: 'pointer',
        color: theme.danger, fontSize: 16, padding: '2px 4px', borderRadius: 4,
      }}>✕</button>
    </div>
  );
}
