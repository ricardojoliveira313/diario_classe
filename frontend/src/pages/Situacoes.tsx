import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, input, label as labelStyle, MESES, SITUACAO_COR, SITUACAO_LABEL, sortTurmasPedagogico, converterCodigoInep } from '../styles';
import { Loading, EmptyState, StatCard, BadgeSituacao } from '../components';
import { useAno } from '../AnoContext';

// Qualquer situação diferente de ATIVO (vazio/nulo também conta como ATIVO,
// mesma regra usada em todo o resto do sistema).
const SITUACOES_NAO_ATIVAS = ['REMA', 'BXTR', 'TRAN', 'N COM', 'ABAN'];

interface LinhaSituacao {
  id: string;
  ra: string;
  nome: string;
  data_nascimento: string;
  situacao: string;
  data: Date | null;
  dataTexto: string;
  turmaNome: string;
  inepDestino: string;
  bolsaFamilia: boolean;
}

// Mesmo parser de data usada em matriculasMensais.ts (aceita ISO e dd/mm/aaaa).
function parseData(valor: unknown): Date | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  let ano: number, mes: number, dia: number;
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) { ano = Number(iso[1]); mes = Number(iso[2]); dia = Number(iso[3]); }
  else if (br) { dia = Number(br[1]); mes = Number(br[2]); ano = Number(br[3]); }
  else return null;
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? data : null;
}

function formatarData(data: Date | null): string {
  if (!data) return '—';
  return data.toLocaleDateString('pt-BR');
}

export default function Situacoes() {
  const { ano, setAno } = useAno();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [mesInicio, setMesInicio] = useState(1);
  const [mesFim, setMesFim] = useState(12);
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroTurmaId, setFiltroTurmaId] = useState('');
  const [soBolsa, setSoBolsa] = useState(false);
  const [busca, setBusca] = useState('');
  const [inepInputs, setInepInputs] = useState<Record<string, string>>({});
  const [inepSalvando, setInepSalvando] = useState<Set<string>>(new Set());
  const [inepSalvos, setInepSalvos] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setErro('');
    Promise.all([api.getAllAlunos(), api.getTurmas()])
      .then(([a, t]) => { setAlunos(a); setTurmas(t); })
      .catch((e: any) => setErro(`Não foi possível carregar os dados: ${e?.message ?? e}`))
      .finally(() => setLoading(false));
  }, []);

  const turmaMap = useMemo(() => new Map(turmas.map(t => [t.id, t.nome])), [turmas]);
  const turmasOrdenadas = useMemo(() => sortTurmasPedagogico(turmas), [turmas]);

  const inicioPeriodo = useMemo(() => new Date(ano, mesInicio - 1, 1), [ano, mesInicio]);
  const fimPeriodo = useMemo(() => new Date(ano, mesFim, 0, 23, 59, 59, 999), [ano, mesFim]);

  // Alunos com situação diferente de ATIVO cuja data de saída (data_fim_matricula,
  // com data_movimentacao como reserva) caiu dentro do período selecionado.
  const linhas: LinhaSituacao[] = useMemo(() => {
    return alunos
      .filter(a => SITUACOES_NAO_ATIVAS.includes(String(a.situacao ?? '').toUpperCase()))
      .map(a => {
        const data = parseData(a.data_fim_matricula) ?? parseData(a.data_movimentacao);
        return {
          id: String(a.id),
          ra: a.ra ? String(a.ra) : '',
          nome: String(a.nome ?? ''),
          data_nascimento: String(a.data_nascimento ?? ''),
          situacao: String(a.situacao ?? '').toUpperCase(),
          data,
          dataTexto: formatarData(data),
          turmaNome: turmaMap.get(a.turmaId) ?? 'Sem turma',
          inepDestino: String(a.inep_destino ?? ''),
          bolsaFamilia: !!a.bolsa_familia,
        };
      })
      .filter(l => l.data && l.data >= inicioPeriodo && l.data <= fimPeriodo)
      .filter(l => !filtroSituacao || l.situacao === filtroSituacao)
      .filter(l => !filtroTurmaId || alunos.find(a => String(a.id) === l.id)?.turmaId === filtroTurmaId)
      .filter(l => !soBolsa || l.bolsaFamilia)
      .filter(l => !busca.trim() || l.nome.toUpperCase().includes(busca.trim().toUpperCase()) || l.ra.includes(busca.trim()))
      .sort((x, y) => (y.data?.getTime() ?? 0) - (x.data?.getTime() ?? 0) || x.nome.localeCompare(y.nome, 'pt-BR'));
  }, [alunos, turmaMap, inicioPeriodo, fimPeriodo, filtroSituacao, filtroTurmaId, soBolsa, busca]);

  // Alunos com situação de saída mas SEM nenhuma data registrada — não entram
  // no filtro por período (não há como saber quando saíram), mas precisam
  // aparecer em algum lugar para não ficarem invisíveis.
  const semData = useMemo(() => alunos
    .filter(a => SITUACOES_NAO_ATIVAS.includes(String(a.situacao ?? '').toUpperCase()))
    .filter(a => !parseData(a.data_fim_matricula) && !parseData(a.data_movimentacao))
    .filter(a => !soBolsa || a.bolsa_familia)
    .map(a => ({
      id: String(a.id),
      ra: a.ra ? String(a.ra) : '',
      nome: String(a.nome ?? ''),
      situacao: String(a.situacao ?? '').toUpperCase(),
      turmaNome: turmaMap.get(a.turmaId) ?? 'Sem turma',
      bolsaFamilia: !!a.bolsa_familia,
    })),
  [alunos, turmaMap, soBolsa]);

  const salvarInepDestino = async (alunoId: string, valor: string) => {
    setInepSalvando(atual => new Set(atual).add(alunoId));
    setInepSalvos(atual => { const novo = new Set(atual); novo.delete(alunoId); return novo; });
    try {
      await api.updateAluno(alunoId, { inep_destino: valor.trim() || null });
      setAlunos(atuais => atuais.map(a => String(a.id) === alunoId ? { ...a, inep_destino: valor.trim() || null } : a));
      setInepSalvos(atual => new Set(atual).add(alunoId));
    } catch (e: any) {
      setErro(`Não foi possível salvar o Inep de destino: ${e?.message ?? e}`);
    } finally {
      setInepSalvando(atual => { const novo = new Set(atual); novo.delete(alunoId); return novo; });
    }
  };

  const contagemPorSituacao = useMemo(() => {
    const contagem: Record<string, number> = {};
    for (const linha of linhas) contagem[linha.situacao] = (contagem[linha.situacao] ?? 0) + 1;
    return contagem;
  }, [linhas]);

  const totalBolsaNoPeriodo = useMemo(() => linhas.filter(l => l.bolsaFamilia).length, [linhas]);

  const exportarExcel = () => {
    const dados = linhas.map(l => ({
      'Nome': l.nome,
      'RA': l.ra,
      'Data de nascimento': l.data_nascimento,
      'Situação': SITUACAO_LABEL[l.situacao] ?? l.situacao,
      'Data da movimentação': l.dataTexto,
      'Turma de origem': l.turmaNome,
      'Inep de destino': l.inepDestino,
      'Bolsa Família': l.bolsaFamilia ? 'Sim' : 'Não',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [{ wch: 34 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Situações');
    XLSX.writeFile(wb, `situacoes_${MESES[mesInicio - 1]}_a_${MESES[mesFim - 1]}_${ano}.xlsx`);
  };

  if (loading) return <Loading text="Carregando situações..." />;
  if (erro) return <EmptyState icon="⚠️" message={erro} />;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ background: theme.card, borderRadius: theme.radiusMd, boxShadow: theme.shadow, padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: theme.text }}>🔄 Situações — alunos fora de ATIVO</h2>
        <p style={{ margin: '6px 0 0', color: theme.textSecondary, fontSize: 13 }}>
          Todo aluno com situação diferente de ATIVO (transferido, remanejado, baixa por transferência,
          não compareceu ou abandono) que teve movimentação dentro do período selecionado. Use para localizar
          quem precisa de tratamento administrativo — como lançar o Inep da escola de destino no caso de transferência.
          Marque "Só Bolsa Família" para ver apenas quem recebe o benefício e precisa de acompanhamento de frequência.
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Ano letivo
            <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ ...input, marginTop: 4 }}>
              {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Mês inicial
            <select value={mesInicio} onChange={e => setMesInicio(Number(e.target.value))} style={{ ...input, marginTop: 4 }}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Mês final
            <select value={mesFim} onChange={e => setMesFim(Number(e.target.value))} style={{ ...input, marginTop: 4 }}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Situação
            <select value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)} style={{ ...input, marginTop: 4 }}>
              <option value="">Todas</option>
              {SITUACOES_NAO_ATIVAS.map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Turma de origem
            <select value={filtroTurmaId} onChange={e => setFiltroTurmaId(e.target.value)} style={{ ...input, marginTop: 4 }}>
              <option value="">Todas as turmas</option>
              {turmasOrdenadas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary, flex: '1 1 180px', minWidth: 180 }}>
            Buscar por nome ou RA
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou RA..." style={{ ...input, marginTop: 4 }} />
          </label>
          <label style={{
            fontSize: 12.5, color: theme.text, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7,
            border: `1.5px solid ${soBolsa ? theme.success : theme.border}`, borderRadius: theme.radius,
            padding: '10px 12px', cursor: 'pointer', background: soBolsa ? `${theme.success}12` : 'transparent',
          }}>
            <input type="checkbox" checked={soBolsa} onChange={e => setSoBolsa(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            💚 Só Bolsa Família
          </label>
          <button type="button" onClick={exportarExcel} disabled={linhas.length === 0}
            className="report-action report-action-success">
            📊 Baixar Excel
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
        <StatCard label="Total no período" val={linhas.length} color={theme.primary} />
        <StatCard label="💚 Com Bolsa Família" val={totalBolsaNoPeriodo} color={theme.success} />
        {SITUACOES_NAO_ATIVAS.map(s => (
          <StatCard key={s} label={SITUACAO_LABEL[s]} val={contagemPorSituacao[s] ?? 0} color={SITUACAO_COR[s]} />
        ))}
      </div>

      {linhas.length === 0 ? (
        <EmptyState icon="✅" message="Nenhum aluno com situação diferente de ATIVO nesse período/filtro." />
      ) : (
        <div style={{ background: theme.card, borderRadius: theme.radiusMd, boxShadow: theme.shadow, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--footer-row)' }}>
                  <th style={{ textAlign: 'left', padding: '9px 12px', color: theme.textSecondary }}>Nome</th>
                  <th style={{ textAlign: 'center', padding: '9px 12px', color: theme.textSecondary }}>BF</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px', color: theme.textSecondary }}>RA</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px', color: theme.textSecondary }}>Nascimento</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px', color: theme.textSecondary }}>Situação</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px', color: theme.textSecondary }}>Data da movimentação</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px', color: theme.textSecondary }}>Turma de origem</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px', color: theme.textSecondary }}>Inep de destino</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => {
                  const salvando = inepSalvando.has(l.id);
                  const salvo = inepSalvos.has(l.id);
                  return (
                    <tr key={l.id} style={{ background: i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)', borderTop: `1px solid ${theme.borderLight}` }}>
                      <td style={{ padding: '8px 12px', color: theme.text, fontWeight: 600 }}>{l.nome}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 15 }} title={l.bolsaFamilia ? 'Bolsa Família' : ''}>{l.bolsaFamilia ? '💚' : '—'}</td>
                      <td style={{ padding: '8px 12px', color: theme.textSecondary }}>{l.ra || '—'}</td>
                      <td style={{ padding: '8px 12px', color: theme.textSecondary }}>{l.data_nascimento || '—'}</td>
                      <td style={{ padding: '8px 12px' }}><BadgeSituacao situacao={l.situacao} /></td>
                      <td style={{ padding: '8px 12px', color: theme.textSecondary }}>{l.dataTexto}</td>
                      <td style={{ padding: '8px 12px', color: theme.textSecondary }}>{l.turmaNome}</td>
                      <td style={{ padding: '6px 10px' }}>
                        {(() => {
                          const valorAtual = inepInputs[l.id] ?? l.inepDestino;
                          const convertido = converterCodigoInep(valorAtual);
                          const mostrarPreview = valorAtual && convertido && convertido !== valorAtual;
                          return (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  value={valorAtual}
                                  onChange={e => setInepInputs(atual => ({ ...atual, [l.id]: e.target.value.replace(/[^\d]/g, '').slice(0, 8) }))}
                                  onBlur={e => {
                                    const digitado = e.target.value;
                                    const final = converterCodigoInep(digitado);
                                    if (final !== l.inepDestino) {
                                      setInepInputs(atual => ({ ...atual, [l.id]: final }));
                                      void salvarInepDestino(l.id, final);
                                    }
                                  }}
                                  placeholder="Ex.: 4539 ou 35008607"
                                  style={{ ...input, padding: '6px 9px', fontSize: 12.5, minWidth: 130 }}
                                />
                                {salvando && <span style={{ fontSize: 11, color: theme.textMuted }}>salvando…</span>}
                                {!salvando && salvo && <span style={{ fontSize: 13, color: theme.success }}>✓</span>}
                              </div>
                              {mostrarPreview && (
                                <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2 }}>
                                  → converte para <strong>{convertido}</strong> ao sair do campo
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {semData.length > 0 && (
        <div style={{ background: `${theme.orange}12`, border: `1px solid ${theme.orange}55`, borderRadius: theme.radiusMd, padding: 14 }}>
          <div style={{ fontWeight: 800, color: theme.text, fontSize: 14, marginBottom: 6 }}>
            ⚠️ {semData.length} aluno(s) fora de ATIVO sem data de movimentação registrada
          </div>
          <div style={{ color: theme.textSecondary, fontSize: 12.5, marginBottom: 8 }}>
            Sem data, não é possível saber em qual mês a saída aconteceu — por isso não entram no filtro de período acima.
            Vale conferir e completar a data na tela Alunos quando possível.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
            {semData.map(a => (
              <div key={a.id} style={{ fontSize: 12.5, color: theme.text, display: 'flex', gap: 8, alignItems: 'center' }}>
                <BadgeSituacao situacao={a.situacao} />
                {a.bolsaFamilia && <span title="Bolsa Família">💚</span>}
                <span style={{ fontWeight: 600 }}>{a.nome}</span>
                <span style={{ color: theme.textSecondary }}>RA {a.ra || '—'} · {a.turmaNome}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
