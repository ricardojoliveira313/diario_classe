import { useState, FormEvent } from 'react';
import { useAuth } from '../AuthContext';
import { theme } from '../styles';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha) { setErro('Preencha e-mail e senha.'); return; }
    setLoading(true);
    setErro('');
    const errMsg = await signIn(email.trim().toLowerCase(), senha);
    if (errMsg) setErro(errMsg);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${theme.primary} 0%, #1e3a5f 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'fadeIn 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📚</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.text, margin: 0 }}>
            Diário de Classe
          </h1>
          <p style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
            EMEIEF LUIZ GONZAGA
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 5 }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErro(''); }}
              placeholder="seu@email.com"
              autoFocus
              autoComplete="email"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 14px',
                border: `1px solid ${erro ? theme.danger : theme.border}`,
                borderRadius: 8,
                fontSize: 15,
                outline: 'none',
                transition: 'border-color 0.15s',
                fontFamily: 'inherit',
              }}
              onFocus={e => e.target.style.borderColor = theme.primary}
              onBlur={e => e.target.style.borderColor = erro ? theme.danger : theme.border}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 5 }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => { setSenha(e.target.value); setErro(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 44px 11px 14px',
                  border: `1px solid ${erro ? theme.danger : theme.border}`,
                  borderRadius: 8,
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  fontFamily: 'inherit',
                }}
                onFocus={e => e.target.style.borderColor = theme.primary}
                onBlur={e => e.target.style.borderColor = erro ? theme.danger : theme.border}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 16, color: theme.textSecondary, padding: 4,
                }}
                tabIndex={-1}
                title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {erro && (
            <div style={{
              background: '#fef2f2',
              border: `1px solid ${theme.danger}`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 13,
              color: theme.danger,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              ❌ {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? theme.textMuted : theme.primary,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'background 0.15s',
              fontFamily: 'inherit',
              letterSpacing: 0.3,
            }}
          >
            {loading ? '⏳ Entrando...' : '🔐 Entrar como Administrador'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, marginTop: 24, lineHeight: 1.5 }}>
          Acesso restrito à equipe pedagógica
        </p>
      </div>
    </div>
  );
}
