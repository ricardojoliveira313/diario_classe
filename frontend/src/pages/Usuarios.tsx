import { useEffect, useState } from 'react';
import { supabase } from '../api';
import { useAuth } from '../AuthContext';
import { theme, btn, input, label, card as cardStyle } from '../styles';
import { Loading } from '../components';

export default function Usuarios() {
  const { role } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<'admin' | 'viewer'>('viewer');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase.from('Usuario').select('*').order('nome');
    setUsuarios(data ?? []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  if (role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', marginTop: 60, color: theme.textSecondary }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <p style={{ fontSize: 17 }}>Acesso restrito à administração.</p>
      </div>
    );
  }

  const adicionar = async () => {
    setErro(''); setSucesso('');
    if (!novoNome.trim()) { setErro('Digite o nome do usuário.'); return; }
    if (!novaSenha.trim()) { setErro('Digite a senha.'); return; }
    setSalvando(true);
    const { error } = await supabase.from('Usuario').insert({
      nome: novoNome.trim(),
      senha: novaSenha,
      perfil: novoPerfil,
    });
    setSalvando(false);
    if (error) {
      if (error.message?.includes('duplicate')) {
        setErro('Usuário já existe.');
      } else {
        setErro(error.message);
      }
      return;
    }
    setSucesso(`Usuário "${novoNome.trim()}" criado!`);
    setNovoNome(''); setNovaSenha('');
    carregar();
  };

  const remover = async (id: string, nome: string) => {
    if (!confirm(`Remover usuário "${nome}"?`)) return;
    await supabase.from('Usuario').delete().eq('id', id);
    carregar();
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>👥 Gerenciar Usuários</h1>
      <p style={{ color: theme.textSecondary, fontSize: 14, marginBottom: 20 }}>
        Os usuários cadastrados aqui funcionam em conjunto com a variável VITE_USERS.
      </p>

      {/* Formulário */}
      <div style={{ ...cardStyle(), padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Novo Usuário</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={label}>Usuário / Email</label>
            <input style={input} value={novoNome} onChange={e => setNovoNome(e.target.value)}
              placeholder="ex: rico@escola.com" />
          </div>
          <div>
            <label style={label}>Senha</label>
            <input style={input} type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
              placeholder="minha senha" />
          </div>
          <div>
            <label style={label}>Perfil</label>
            <select style={input} value={novoPerfil} onChange={e => setNovoPerfil(e.target.value as any)}>
              <option value="admin">🔑 Admin</option>
              <option value="viewer">👁️ Viewer</option>
            </select>
          </div>
        </div>
        {erro && <p style={{ color: theme.danger, fontSize: 13, marginTop: 8 }}>⚠️ {erro}</p>}
        {sucesso && <p style={{ color: theme.success, fontSize: 13, marginTop: 8 }}>✅ {sucesso}</p>}
        <button onClick={adicionar} disabled={salvando} style={{ ...btn('primary'), marginTop: 12 }}>
          {salvando ? '⏳ Salvando...' : '➕ Adicionar'}
        </button>
      </div>

      {/* Lista */}
      {loading ? <Loading text="Carregando usuários..." /> : (
        <div style={{ ...cardStyle(), overflow: 'hidden' }}>
          {usuarios.length === 0 ? (
            <p style={{ padding: 20, textAlign: 'center', color: theme.textMuted }}>Nenhum usuário cadastrado.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--row-even)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: theme.textSecondary }}>Usuário</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: theme.textSecondary }}>Perfil</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: theme.textSecondary }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.nome}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        background: u.perfil === 'admin' ? theme.primaryBg : theme.orangeLight,
                        color: u.perfil === 'admin' ? theme.primary : theme.orange,
                      }}>
                        {u.perfil === 'admin' ? '🔑 Admin' : '👁️ Viewer'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button onClick={() => remover(u.id, u.nome)}
                        style={{ ...btn('danger', { small: true }) }}>
                        🗑️ Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
