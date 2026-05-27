import { useEffect, useState } from 'react';
import { supabase, api } from '../api';
import { useAuth, PAGINAS_VIEWER, CAPABILITIES } from '../AuthContext';
import type { PageKey, CapabilityKey, PermKey } from '../AuthContext';
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
  const [permTemp, setPermTemp] = useState<PageKey[] | null>(null);   // páginas
  const [capTemp, setCapTemp] = useState<CapabilityKey[]>([]);         // capacidades especiais
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
    const allPerm: string[] | null = Array.isArray(u.permissoes) ? [...u.permissoes] : null;
    // Separa páginas de capacidades
    const pages = allPerm?.filter(k => PAGINAS_VIEWER.some(p => p.key === k)) as PageKey[] | undefined;
    const caps = (allPerm?.filter(k => CAPABILITIES.some(c => c.key === k)) ?? []) as CapabilityKey[];
    const allPagesPresent = !pages || pages.length >= PAGINAS_VIEWER.length;
    setPermTemp(allPagesPresent ? null : (pages ?? null));
    setCapTemp(caps);
    // Se tem 'faltas_todas' nas caps, turmaTemp fica null
    const hasTodas = caps.includes('faltas_todas');
    setTurmaTemp(hasTodas ? null : (u.turma_id ?? null));
  };

  const togglePagina = (key: PageKey) => {
    if (permTemp === null) {
      setPermTemp(PAGINAS_VIEWER.filter(p => p.key !== key).map(p => p.key));
    } else if (permTemp.includes(key)) {
      setPermTemp(permTemp.filter(k => k !== key));
    } else {
      const nova = [...permTemp, key];
      setPermTemp(nova.length === PAGINAS_VIEWER.length ? null : nova);
    }
  };

  const toggleCapabilidade = (key: CapabilityKey) => {
    setCapTemp(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const liberarTodas = () => setPermTemp(null);

  const salvarPermissoes = async (id: string) => {
    setSalvandoPerm(true);
    // Monta array final: páginas + capacidades
    const pages: PageKey[] = permTemp === null ? PAGINAS_VIEWER.map(p => p.key) : [...permTemp];
    const combined: PermKey[] = [...pages, ...capTemp];
    // null = todas as páginas + sem capacidades (retrocompatível)
    const finalPerm: PermKey[] | null = (permTemp === null && capTemp.length === 0) ? null : combined;
    // turma_id: null quando 'faltas_todas' (ou consulta), UUID quando turma específica
    const finalTurma = capTemp.includes('faltas_todas') ? null : turmaTemp;
    await supabase.from('Usuario').update({
      permissoes: finalPerm,
      turma_id: finalTurma,
    }).eq('id', id);
    setSalvandoPerm(false);
    setEditandoPermId(null);
    carregar();
  };

  const isPaginaLiberada = (key: PageKey) => permTemp === null || permTemp.includes(key);
  const isCapLiberada = (key: CapabilityKey) => capTemp.includes(key);

  // Estado derivado do modo de faltas
  const faltasModoTodas = capTemp.includes('faltas_todas');
  const faltasModoTurma = !faltasModoTodas && turmaTemp !== null;
  const faltasModoConsulta = !faltasModoTodas && turmaTemp === null;

  const setFaltasConsulta = () => {
    setTurmaTemp(null);
    setCapTemp(prev => prev.filter(k => k !== 'faltas_todas'));
  };
  const setFaltasTurma = () => {
    setTurmaTemp(turmas[0]?.id ?? '');
    setCapTemp(prev => prev.filter(k => k !== 'faltas_todas'));
  };
  const setFaltasTodas = () => {
    setTurmaTemp(null);
    setCapTemp(prev => prev.includes('faltas_todas') ? prev : [...prev, 'faltas_todas']);
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>👥 Gerenciar Usuários</h1>
      <p style={{ color: theme.textSecondary, fontSize: 14, marginBottom: 20 }}>
        Cadastre usuários e defina quais abas e permissões cada viewer tem.
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
            const allPerm: string[] | null = Array.isArray(u.permissoes) ? u.permissoes : null;
            const pageCount = allPerm === null
              ? PAGINAS_VIEWER.length
              : allPerm.filter(k => PAGINAS_VIEWER.some(p => p.key === k)).length;
            const caps = allPerm?.filter(k => CAPABILITIES.some(c => c.key === k)) ?? [];
            const hasTodas = caps.includes('faltas_todas');
            const editandoPerm = editandoPermId === u.id;

            return (
              <div key={u.id} style={{ borderTop: i > 0 ? `1px solid ${theme.borderLight}` : undefined }}>
                {/* Linha principal */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12, flexWrap: 'wrap' }}>
                  {/* Nome e perfil */}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nome}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                      {isViewer ? <>
                        {pageCount === PAGINAS_VIEWER.length
                          ? '🔓 Todas as abas'
                          : `🔒 ${pageCount}/${PAGINAS_VIEWER.length} abas`}
                        {hasTodas
                          ? <span style={{ marginLeft: 8, color: theme.success, fontWeight: 600 }}>· 📋 Lança faltas (todas as turmas)</span>
                          : u.turma_id
                            ? <span style={{ marginLeft: 8, color: theme.success, fontWeight: 600 }}>· 🖊️ Lança faltas: {turmas.find(t => t.id === u.turma_id)?.nome ?? '—'}</span>
                            : <span style={{ marginLeft: 8 }}>· 👁️ Somente consulta</span>}
                        {caps.filter(c => c !== 'faltas_todas').length > 0 &&
                          <span style={{ marginLeft: 8, color: theme.purple, fontWeight: 600 }}>
                            · {caps.filter(c => c !== 'faltas_todas').map(c => CAPABILITIES.find(x => x.key === c)?.label.split(' ').slice(1, 3).join(' ')).join(', ')}
                          </span>}
                      </> : '🔑 Acesso total'}
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
                      <button onClick={() => abrirPermissoes(u)}
                        style={btn(editandoPerm ? 'primary' : 'ghost', { small: true })}>
                        {editandoPerm ? '✕ Fechar' : '⚙️ Permissões'}
                      </button>
                    )}
                    <button onClick={() => remover(u.id, u.nome)} style={btn('danger', { small: true })}>🗑️</button>
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
                        ⚙️ Permissões de <strong>{u.nome}</strong>
                      </div>
                      <button onClick={liberarTodas} style={btn('ghost', { small: true })}>✅ Liberar todas as abas</button>
                    </div>

                    {/* ── Abas visíveis ─────────────────────────────── */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📄 Abas visíveis
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: 8, marginBottom: 14,
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
                            fontWeight: liberada ? 600 : 400, fontSize: 13,
                            transition: 'all 0.15s ease', userSelect: 'none',
                          }}>
                            <input type="checkbox" checked={liberada} onChange={() => togglePagina(p.key)}
                              style={{ width: 16, height: 16, accentColor: theme.success, cursor: 'pointer' }} />
                            <span>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Resumo */}
                    <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 14 }}>
                      {permTemp === null
                        ? '✅ Todas as abas estão liberadas.'
                        : permTemp.length === 0
                          ? '⚠️ Nenhuma aba liberada — o usuário não verá nada no menu.'
                          : `🔒 ${permTemp.length} de ${PAGINAS_VIEWER.length} aba(s) liberada(s): ${permTemp.join(', ')}`}
                    </div>

                    {/* ── Permissão de faltas ────────────────────────── */}
                    <div style={{
                      border: `1px solid ${theme.borderLight}`,
                      borderRadius: theme.radiusMd,
                      padding: 14, marginBottom: 14,
                      background: 'var(--row-even)',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: theme.textSecondary }}>
                        📋 Permissão de lançamento de faltas
                      </div>

                      {/* Opção 1: Somente consulta */}
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 8,
                        background: faltasModoConsulta ? theme.primaryBg : 'transparent',
                        border: `1.5px solid ${faltasModoConsulta ? theme.primary : theme.borderLight}`,
                        transition: 'all 0.15s',
                      }}>
                        <input type="radio" checked={faltasModoConsulta} onChange={setFaltasConsulta}
                          style={{ marginTop: 2, accentColor: theme.primary }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: faltasModoConsulta ? theme.primary : theme.text }}>
                            👁️ Somente consulta
                          </div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                            Pode visualizar dados mas não salvar faltas
                          </div>
                        </div>
                      </label>

                      {/* Opção 2: Turma específica */}
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 8,
                        background: faltasModoTurma ? theme.successLight : 'transparent',
                        border: `1.5px solid ${faltasModoTurma ? theme.success : theme.borderLight}`,
                        transition: 'all 0.15s',
                      }}>
                        <input type="radio" checked={faltasModoTurma} onChange={setFaltasTurma}
                          style={{ marginTop: 2, accentColor: theme.success }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: faltasModoTurma ? theme.success : theme.text }}>
                            🖊️ Pode lançar faltas — turma específica
                          </div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, marginBottom: faltasModoTurma ? 8 : 0 }}>
                            Pode salvar a chamada apenas da turma selecionada abaixo
                          </div>
                          {faltasModoTurma && (
                            <div onClick={e => e.preventDefault()}>
                              <select value={turmaTemp ?? ''} onChange={e => setTurmaTemp(e.target.value)}
                                style={{ ...input, marginBottom: 0, fontSize: 13 }}>
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

                      {/* Opção 3: Todas as turmas */}
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        background: faltasModoTodas ? '#fef3c7' : 'transparent',
                        border: `1.5px solid ${faltasModoTodas ? theme.warning : theme.borderLight}`,
                        transition: 'all 0.15s',
                      }}>
                        <input type="radio" checked={faltasModoTodas} onChange={setFaltasTodas}
                          style={{ marginTop: 2, accentColor: theme.warning }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: faltasModoTodas ? theme.warning : theme.text }}>
                            📋 Pode lançar faltas — todas as turmas
                          </div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                            Pode salvar a chamada de qualquer turma (ex: secretaria)
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* ── Permissões avançadas de cadastro ──────────── */}
                    <div style={{
                      border: `1px solid ${theme.borderLight}`,
                      borderRadius: theme.radiusMd,
                      padding: 14, marginBottom: 14,
                      background: 'var(--row-even)',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: theme.textSecondary }}>
                        🔧 Permissões avançadas de cadastro
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {CAPABILITIES.filter(c => c.key !== 'faltas_todas').map(c => {
                          const ativa = isCapLiberada(c.key);
                          return (
                            <label key={c.key} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                              background: ativa ? theme.purpleLight : 'transparent',
                              border: `1.5px solid ${ativa ? theme.purple : theme.borderLight}`,
                              transition: 'all 0.15s', userSelect: 'none',
                            }}>
                              <input type="checkbox" checked={ativa}
                                onChange={() => toggleCapabilidade(c.key)}
                                style={{ width: 16, height: 16, accentColor: theme.purple, cursor: 'pointer' }} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: ativa ? theme.purple : theme.text }}>
                                  {c.label}
                                </div>
                                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                                  {c.key === 'editar_cpf' && 'Pode adicionar ou editar o CPF de qualquer aluno'}
                                  {c.key === 'editar_cor_raca' && 'Pode adicionar ou editar a Cor/Raça de qualquer aluno'}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
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
