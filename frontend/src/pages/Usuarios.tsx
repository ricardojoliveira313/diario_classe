import { useEffect, useState } from 'react';
import { supabase, api } from '../api';
import { useAuth, PAGINAS_VIEWER } from '../AuthContext';
import type { PageKey } from '../AuthContext';
import { theme, btn, input, label, card as cardStyle } from '../styles';
import { Loading, Spinner } from '../components';

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
  // Painel de permissões por usuário
  const [editandoPermId, setEditandoPermId] = useState<string | null>(null);
  const [permTemp, setPermTemp] = useState<PageKey[] | null>(null);
  const [turmaTemp, setTurmaTemp] = useState<string | null>(null);
  const [salvandoPerm, setSalvandoPerm] = useState(false);
  const [turmas, setTurmas] = useState<any[]>([]);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase.from('Usuario').select('*').order('nome');
    setUsuarios(data ?? []);
    setLoading(false);
  };

  useEffect(() => { carregar(); api.getTurmas().then(setTurmas); }, []);

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
      permissoes: null, // padrão: tudo liberado
    });
    setSalvando(false);
    if (error) {
      setErro(error.message?.includes('duplicate') ? 'Usuário já existe.' : error.message);
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

  // ── Painel de permissões ─────────────────────────────────────────────────
  const abrirPermissoes = (u: any) => {
    if (editandoPermId === u.id) { setEditandoPermId(null); return; }
    setEditandoPermId(u.id);
    // null no banco = tudo liberado; array = só essas páginas
    setPermTemp(Array.isArray(u.permissoes) ? [...u.permissoes] : null);
    setTurmaTemp(u.turma_id ?? null);
  };

  const togglePagina = (key: PageKey) => {
    if (permTemp === null) {
      // estava tudo liberado → remove todas exceto esta
      setPermTemp([key]);
    } else if (permTemp.includes(key)) {
      const nova = permTemp.filter(k => k !== key);
      // se ficou vazio, mantém array vazio (nenhuma página)
      setPermTemp(nova);
    } else {
      const nova = [...permTemp, key];
      // se selecionou todas, volta para null (tudo liberado)
      if (nova.length === PAGINAS_VIEWER.length) setPermTemp(null);
      else setPermTemp(nova);
    }
  };

  const liberarTodas = () => setPermTemp(null);

  const salvarPermissoes = async (id: string) => {
    setSalvandoPerm(true);
    await supabase.from('Usuario').update({ permissoes: permTemp, turma_id: turmaTemp }).eq('id', id);
    setSalvandoPerm(false);
    setEditandoPermId(null);
    carregar();
  };

  const isPaginaLiberada = (key: PageKey) =>
    permTemp === null || permTemp.includes(key);

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>👥 Gerenciar Usuários</h1>
      <p style={{ color: theme.textSecondary, fontSize: 14, marginBottom: 20 }}>
        Cadastre usuários e defina quais abas cada viewer pode acessar.
      </p>

      {/* Formulário novo usuário */}
      <div style={{ ...cardStyle(), padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Novo Usuário</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={label}>Usuário / Email</label>
            <input style={input} value={novoNome} onChange={e => setNovoNome(e.target.value)}
              placeholder="ex: professora@escola.com" />
          </div>
          <div>
            <label style={label}>Senha</label>
            <input style={input} type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
              placeholder="senha segura" />
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

      {/* Lista de usuários */}
      {loading ? <Loading text="Carregando usuários..." /> : (
        <div style={{ ...cardStyle(), overflow: 'hidden' }}>
          {usuarios.length === 0 ? (
            <p style={{ padding: 20, textAlign: 'center', color: theme.textMuted }}>Nenhum usuário cadastrado.</p>
          ) : usuarios.map((u, i) => {
            const isViewer = u.perfil === 'viewer';
            const todasLiberadas = !Array.isArray(u.permissoes) || u.permissoes === null;
            const qtdPaginas = Array.isArray(u.permissoes) ? u.permissoes.length : PAGINAS_VIEWER.length;
            const editandoPerm = editandoPermId === u.id;

            return (
              <div key={u.id} style={{ borderTop: i > 0 ? `1px solid ${theme.borderLight}` : undefined }}>
                {/* Linha principal */}
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '12px 16px',
                  gap: 12, flexWrap: 'wrap',
                }}>
                  {/* Nome e perfil */}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nome}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                      {isViewer
                        ? <>
                            {todasLiberadas
                              ? '🔓 Todas as abas liberadas'
                              : `🔒 ${qtdPaginas} de ${PAGINAS_VIEWER.length} abas liberadas`}
                            {u.turma_id
                              ? <span style={{ marginLeft: 8, color: theme.success, fontWeight: 600 }}>
                                  · 🖊️ Lança faltas: {turmas.find(t => t.id === u.turma_id)?.nome ?? '—'}
                                </span>
                              : <span style={{ marginLeft: 8, color: theme.textMuted }}>· 👁️ Somente consulta</span>}
                          </>
                        : '🔑 Acesso total'}
                    </div>
                  </div>

                  {/* Badge perfil */}
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                    background: u.perfil === 'admin' ? theme.primaryBg : theme.orangeLight,
                    color: u.perfil === 'admin' ? theme.primary : theme.orange,
                  }}>
                    {u.perfil === 'admin' ? '🔑 Admin' : '👁️ Viewer'}
                  </span>

                  {/* Botões */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isViewer && (
                      <button
                        onClick={() => abrirPermissoes(u)}
                        style={btn(editandoPerm ? 'primary' : 'ghost', { small: true })}
                      >
                        {editandoPerm ? '✕ Fechar' : '⚙️ Permissões'}
                      </button>
                    )}
                    <button onClick={() => remover(u.id, u.nome)}
                      style={btn('danger', { small: true })}>
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Painel de permissões (só viewers) */}
                {editandoPerm && isViewer && (
                  <div className="slide-down" style={{
                    margin: '0 16px 16px',
                    background: 'var(--ghost-bg)',
                    border: `1.5px solid ${theme.primary}`,
                    borderRadius: theme.radiusMd,
                    padding: 16,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: theme.primary }}>
                        ⚙️ Abas visíveis para <strong>{u.nome}</strong>
                      </div>
                      <button onClick={liberarTodas} style={btn('ghost', { small: true })}>
                        ✅ Liberar todas
                      </button>
                    </div>

                    {/* Checkboxes */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: 8,
                      marginBottom: 14,
                    }}>
                      {PAGINAS_VIEWER.map(p => {
                        const liberada = isPaginaLiberada(p.key);
                        return (
                          <label key={p.key} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                            background: liberada ? 'var(--success-light)' : 'var(--row-even)',
                            border: `1px solid ${liberada ? theme.success : theme.borderLight}`,
                            color: liberada ? theme.success : theme.text,
                            fontWeight: liberada ? 600 : 400,
                            fontSize: 13,
                            transition: 'all 0.15s ease',
                            userSelect: 'none',
                          }}>
                            <input
                              type="checkbox"
                              checked={liberada}
                              onChange={() => togglePagina(p.key)}
                              style={{ width: 16, height: 16, accentColor: theme.success, cursor: 'pointer' }}
                            />
                            <span>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Resumo */}
                    <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>
                      {permTemp === null
                        ? '✅ Todas as abas estão liberadas para este usuário.'
                        : permTemp.length === 0
                          ? '⚠️ Nenhuma aba liberada — o usuário não verá nada no menu.'
                          : `🔒 Somente ${permTemp.length} aba(s) liberada(s): ${permTemp.join(', ')}`}
                    </div>

                    {/* ── Permissão de lançamento de faltas ─────────────────────── */}
                    <div style={{
                      border: `1px solid ${theme.borderLight}`,
                      borderRadius: theme.radiusMd,
                      padding: 14,
                      marginBottom: 14,
                      background: 'var(--row-even)',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: theme.textSecondary }}>
                        📋 Permissão de lançamento de faltas
                      </div>

                      {/* Opção 1: Somente consulta */}
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        marginBottom: 8,
                        background: turmaTemp === null ? theme.primaryBg : 'transparent',
                        border: `1.5px solid ${turmaTemp === null ? theme.primary : theme.borderLight}`,
                        transition: 'all 0.15s',
                      }}>
                        <input type="radio" checked={turmaTemp === null}
                          onChange={() => setTurmaTemp(null)}
                          style={{ marginTop: 2, accentColor: theme.primary }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: turmaTemp === null ? theme.primary : theme.text }}>
                            👁️ Somente consulta
                          </div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                            Pode visualizar dados mas não salvar faltas
                          </div>
                        </div>
                      </label>

                      {/* Opção 2: Pode lançar faltas */}
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        background: turmaTemp !== null ? theme.successLight : 'transparent',
                        border: `1.5px solid ${turmaTemp !== null ? theme.success : theme.borderLight}`,
                        transition: 'all 0.15s',
                      }}>
                        <input type="radio" checked={turmaTemp !== null}
                          onChange={() => setTurmaTemp(turmas[0]?.id ?? '')}
                          style={{ marginTop: 2, accentColor: theme.success }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: turmaTemp !== null ? theme.success : theme.text }}>
                            🖊️ Pode lançar faltas
                          </div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, marginBottom: turmaTemp !== null ? 8 : 0 }}>
                            Acessa Faltas e pode salvar a chamada da turma abaixo
                          </div>
                          {turmaTemp !== null && (
                            <div onClick={e => e.preventDefault()}>
                              <select
                                value={turmaTemp}
                                onChange={e => setTurmaTemp(e.target.value)}
                                style={{ ...input, marginBottom: 0, fontSize: 13 }}
                              >
                                {turmas.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.nome}{t.professora ? ` — ${t.professora}` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* Salvar */}
                    <button onClick={() => salvarPermissoes(u.id)} disabled={salvandoPerm}
                      style={{ ...btn('primary'), fontSize: 13 }}>
                      {salvandoPerm ? <Spinner size={14} /> : '💾 Salvar permissões'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
