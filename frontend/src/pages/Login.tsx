import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { theme, btn } from '../styles';

export default function Login() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const handleLogin = () => {
    if (!usuario.trim()) { setErro('Digite o usuário.'); return; }
    if (!senha.trim())   { setErro('Digite a senha.');   return; }
    setLoading(true);
    setTimeout(() => {
      const resultado = login(usuario, senha);
      setLoading(false);
      if (resultado === 'errado') {
        setErro('Usuário ou senha incorretos. Tente novamente.');
        setSenha('');
      }
    }, 300);
  };

  const clearErro = () => setErro('');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div className="scale-in" style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        boxShadow: theme.shadowLg,
        padding: '40px 36px',
        maxWidth: 380,
        width: '100%',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 10, lineHeight: 1 }}>📚</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
            Diário de Classe
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            EMEIEF Luiz Gonzaga
          </p>
        </div>

        {/* Campo usuário */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Usuário
          </label>
          <input
            type="text"
            value={usuario}
            onChange={e => { setUsuario(e.target.value); clearErro(); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Digite seu usuário..."
            autoFocus
            autoComplete="username"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 8,
              border: erro ? `1.5px solid ${theme.danger}` : `1.5px solid var(--border)`,
              background: 'var(--input-bg)',
              color: 'var(--text)',
              fontSize: 15,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
          />
        </div>

        {/* Campo senha */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Senha
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={show ? 'text' : 'password'}
              value={senha}
              onChange={e => { setSenha(e.target.value); clearErro(); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Digite sua senha..."
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '12px 44px 12px 14px',
                borderRadius: 8,
                border: erro ? `1.5px solid ${theme.danger}` : `1.5px solid var(--border)`,
                background: 'var(--input-bg)',
                color: 'var(--text)',
                fontSize: 15,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
            />
            <button
              onClick={() => setShow(s => !s)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 16, padding: 4,
              }}
              tabIndex={-1}
              title={show ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {show ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div style={{
            background: theme.dangerLight,
            border: `1px solid ${theme.danger}`,
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 14,
            fontSize: 13,
            color: theme.dangerHover,
            fontWeight: 500,
          }}>
            ⚠️ {erro}
          </div>
        )}

        {/* Botão */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ ...btn('primary', { full: true }), fontSize: 15, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? '⏳ Verificando...' : '🔑 Entrar'}
        </button>

        {/* Dica */}
        <p style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          textAlign: 'center',
          marginTop: 20,
          lineHeight: 1.6,
        }}>
          Entre em contato com a administração<br />
          para obter seu usuário e senha de acesso.
        </p>
      </div>
    </div>
  );
}
