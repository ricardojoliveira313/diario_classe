import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { theme, btn, input, label, MESES, getDiasLetivos, isInfantilTurma, sortTurmasPedagogico } from '../styles';
import { Loading, EmptyState, StatCard } from '../components';
import { useAno } from '../AnoContext';
import { useAuth } from '../AuthContext';
import { MOTIVOS_BAIXA_FREQUENCIA } from '../motivosBaixaFrequencia';

type Status = 'P' | 'F' | 'J' | 'A';
const CICLO: Status[] = ['P', 'F', 'J', 'A'];
const decodeDias = (freq: string, n: number): Status[] => {
  if (freq?.startsWith('DIAS:')) {
    const chars = freq.slice(5).split('');
    return Array(n).fill('P').map((_, i) =>
      CICLO.includes(chars[i] as Status) ? (chars[i] as Status) : 'P'
    ) as Status[];
  }
  return Array(n).fill('P') as Status[];
};
const ct = (dias: Status[], tipo: Status) => dias.filter(d => d === tipo).length;

function isAtivo(situacao: string | null | undefined): boolean {
  return !situacao || situacao === 'ATIVO';
}

function chaveNomeNascimento(aluno: any): string {
  const nome = String(aluno.nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();
  const nascimento = String(aluno.data_nascimento ?? '').trim();
  return nascimento ? `${nome}|${nascimento}` : `${nome}|${aluno.ra ?? aluno.id}`;
}

interface LinhaBF {
  aluno: any;
  mes: number;
  turmaNome: string;
  isInfantil: boolean;
  diasLetivos: number;
  faltas: number;
  justificadas: number;
  atestados: number;
  freqPct: number;
  minimoExigido: number;
  motivoAtual: string | null;
}

interface PendenteLancamento {
  aluno: any;
  mes: number;
  turmaNome: string;
}

export default function BFFrequencia() {
  const { ano } = useAno();
  const { username } = useAuth();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [mesInicio, setMesInicio] = useState(new Date().getMonth() + 1);
  const [mesFim, setMesFim] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<LinhaBF[] | null>(null);
  const [pendentes, setPendentes] = useState<PendenteLancamento[]>([]);
  const [linhaSelecionada, setLinhaSelecionada] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [salvandoMotivo, setSalvandoMotivo] = useState<Record<string, boolean>>({});
  type OrdemCampo = 'mes' | 'aluno' | 'turma' | 'minimo' | 'freq' | 'faltas' | 'justificadas' | 'atestados' | 'situacao';
  const [ordemCampo, setOrdemCampo] = useState<OrdemCampo>('mes');
  const [ordemDir, setOrdemDir] = useState<'asc' | 'desc'>('asc');

  const alternarOrdem = (campo: OrdemCampo) => {
    if (ordemCampo === campo) {
      setOrdemDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrdemCampo(campo);
      setOrdemDir('asc');
    }
  };

  const setaOrdem = (campo: OrdemCampo) => ordemCampo === campo ? (ordemDir === 'asc' ? ' ▲' : ' ▼') : '';

  const thOrdenavel = (campo: OrdemCampo, texto: string, align: 'left' | 'center' = 'left') => (
    <th
      onClick={() => alternarOrdem(campo)}
      title="Clique para ordenar"
      style={{ padding: '10px 12px', textAlign: align, color: '#fff', fontSize: 13, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {texto}{setaOrdem(campo)}
    </th>
  );

  useEffect(() => { api.getTurmas().then(t => setTurmas(sortTurmasPedagogico(t ?? []))); }, []);

  const calcular = async () => {
    setLoading(true);
    setLinhas(null);
    setLinhaSelecionada(null);
    setSalvo(false);
    const turmaMap = new Map(turmas.map(t => [t.id, t]));

    const [todosAlunos, ...faltasPorMes] = await Promise.all([
      api.getAllAlunos(),
      ...Array.from({ length: mesFim - mesInicio + 1 }, (_, i) => api.getFaltasMes(mesInicio + i, ano)),
    ]);

    // BF — Frequência considera somente a matrícula da sala regular.
    // Se o aluno também frequenta o AEE, o registro complementar não pode
    // gerar uma segunda linha no levantamento enviado ao Sistema Presença.
    const alunosRegularesBF = (todosAlunos ?? []).filter((a: any) => {
      const turma = turmaMap.get(a.turmaId);
      const turmaNome = String(turma?.nome ?? '').trim().toUpperCase();
      const turmaTipo = String(turma?.tipo ?? '').trim().toUpperCase();
      const registroAEE = a.aee === true || turmaTipo === 'AEE' || turmaNome.startsWith('AEE');
      return a.bolsa_familia && isAtivo(a.situacao) && !registroAEE;
    });

    const alunosUnicos = new Map<string, any>();
    for (const aluno of alunosRegularesBF) {
      const chave = chaveNomeNascimento(aluno);
      if (!alunosUnicos.has(chave)) alunosUnicos.set(chave, aluno);
    }
    const bfAlunos = Array.from(alunosUnicos.values());

    // Cálculo MÊS A MÊS (independente) — o lançamento no Sistema Presença do Bolsa
    // Família é mensal, então um aluno abaixo do mínimo em junho mas OK em julho
    // precisa aparecer só para junho, não numa média dos dois meses juntos.
    const resultado: LinhaBF[] = [];
    const pendentesLancamento: PendenteLancamento[] = [];
    for (let i = 0; i < faltasPorMes.length; i++) {
      const mes = mesInicio + i;
      const registros = faltasPorMes[i] ?? [];
      const diasLetivosMes = getDiasLetivos(mes, ano);
      if (diasLetivosMes === 0) continue;
      for (const aluno of bfAlunos) {
        const registro = registros.find((r: any) => r.alunoId === aluno.id);
        const turma = turmaMap.get(aluno.turmaId);
        const turmaNome = turma?.nome ?? '—';
        // Sem lançamento no mês = dado ausente, NÃO é o mesmo que 100% de frequência.
        // Marca como pendência em vez de assumir presença — ver auditoria de ago/2026.
        if (!registro) {
          pendentesLancamento.push({ aluno, mes, turmaNome });
          continue;
        }
        // Alguns fluxos antigos/alternativos salvam somente o total de faltas,
        // com `frequencia` vazia. O registro existe e não pode ser confundido
        // com mês sem lançamento.
        const dias = registro.frequencia ? decodeDias(registro.frequencia, diasLetivosMes) : null;
        const faltas = dias ? ct(dias, 'F') : Number(registro.faltas ?? 0);
        const justificadas = dias ? ct(dias, 'J') : 0;
        const atestados = dias ? ct(dias, 'A') : 0;
        const infantil = isInfantilTurma(turmaNome);
        const minimoExigido = infantil ? 60 : 75;
        const totalAusencias = faltas + justificadas + atestados;
        const freqPct = ((diasLetivosMes - totalAusencias) / diasLetivosMes) * 100;
        if (freqPct < minimoExigido) {
          resultado.push({
            aluno, mes, turmaNome, isInfantil: infantil,
            diasLetivos: diasLetivosMes, faltas, justificadas, atestados,
            freqPct, minimoExigido,
            motivoAtual: registro?.motivo_baixa_frequencia ?? null,
          });
        }
      }
    }
    resultado.sort((a, b) => a.mes - b.mes || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
    pendentesLancamento.sort((a, b) => a.mes - b.mes || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
    setLinhas(resultado);
    setPendentes(pendentesLancamento);
    const mapMotivos: Record<string, string> = {};
    resultado.forEach(l => {
      if (l.motivoAtual) mapMotivos[`${l.aluno.id}-${l.mes}`] = l.motivoAtual;
    });
    setMotivos(mapMotivos);
    setLoading(false);
  };

  // Salva o motivo direto no registro de Falta (aluno/mês/ano) — o mesmo campo
  // usado na aba Faltas, então as duas telas ficam sempre sincronizadas.
  const setMotivoLinha = async (linhaId: string, alunoId: string, mes: number, codigo: string) => {
    setMotivos(prev => {
      const next = { ...prev };
      if (codigo) next[linhaId] = codigo; else delete next[linhaId];
      return next;
    });
    setSalvandoMotivo(prev => ({ ...prev, [linhaId]: true }));
    try {
      await api.atualizarMotivoFalta(alunoId, mes, ano, codigo || null);
    } finally {
      setSalvandoMotivo(prev => ({ ...prev, [linhaId]: false }));
    }
  };

  // Guarda permanentemente no banco os registros calculados — mantém o histórico
  // mesmo que o cadastro do aluno mude depois (ex.: bolsa_familia corrigida).
  const salvarRegistros = async () => {
    if (!linhas || linhas.length === 0) return;
    setSalvando(true);
    try {
      const registros = linhas.map(l => ({
        aluno_id: l.aluno.id,
        aluno_nome: l.aluno.nome,
        ra: l.aluno.ra ?? null,
        turma_nome: l.turmaNome,
        mes: l.mes,
        ano,
        is_infantil: l.isInfantil,
        dias_letivos: l.diasLetivos,
        faltas: l.faltas,
        justificadas: l.justificadas,
        atestados: l.atestados,
        freq_pct: l.freqPct,
        minimo_exigido: l.minimoExigido,
        registrado_em: new Date().toISOString(),
        registrado_por: username ?? null,
      }));
      await api.salvarBFFrequenciaRegistros(registros);
      setSalvo(true);
    } finally {
      setSalvando(false);
    }
  };

  const nomeMesInicio = MESES[mesInicio - 1];
  const nomeMesFim = MESES[mesFim - 1];
  const periodoLabel = mesInicio === mesFim ? `${nomeMesInicio}/${ano}` : `${nomeMesInicio} a ${nomeMesFim}/${ano}`;

  const comAtestado = linhas?.filter(l => l.atestados > 0).length ?? 0;
  const semJustificativa = linhas?.filter(l => l.atestados === 0).length ?? 0;

  const linhasOrdenadas = useMemo(() => {
    if (!linhas) return null;
    const mult = ordemDir === 'asc' ? 1 : -1;
    const situacaoTxt = (l: LinhaBF) => l.atestados > 0 ? 'COM ATESTADO' : 'SEM JUSTIFICATIVA';
    const valores: Record<OrdemCampo, (l: LinhaBF) => number | string> = {
      mes: l => l.mes,
      aluno: l => l.aluno.nome ?? '',
      turma: l => l.turmaNome ?? '',
      minimo: l => l.minimoExigido,
      freq: l => l.freqPct,
      faltas: l => l.faltas,
      justificadas: l => l.justificadas,
      atestados: l => l.atestados,
      situacao: l => situacaoTxt(l),
    };
    const getValor = valores[ordemCampo];
    return [...linhas].sort((a, b) => {
      const va = getValor(a), vb = getValor(b);
      let cmp: number;
      if (typeof va === 'string' || typeof vb === 'string') {
        cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
      } else {
        cmp = (va as number) - (vb as number);
      }
      if (cmp === 0) cmp = a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR');
      return cmp * mult;
    });
  }, [linhas, ordemCampo, ordemDir]);

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 20, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginBottom: 6 }}>💚 BF — Frequência</h1>
        <p style={{ color: theme.textMuted, marginBottom: 18, fontSize: 13.5 }}>
          Levantamento de alunos com Bolsa Família abaixo do mínimo de frequência exigido pelo governo federal
          (Infantil: 60% · Fundamental: 75%) — para lançar no Sistema Presença.
        </p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={label}>Mês início</label>
            <select style={{ ...input, width: 160 }} value={mesInicio} onChange={e => setMesInicio(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Mês fim</label>
            <select style={{ ...input, width: 160 }} value={mesFim} onChange={e => setMesFim(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <button style={btn('primary')} disabled={loading || mesFim < mesInicio} onClick={calcular}>
            {loading ? 'Calculando...' : '🔍 Calcular'}
          </button>
        </div>
        {mesFim < mesInicio && (
          <div style={{ marginTop: 10, color: theme.danger, fontSize: 13 }}>Mês fim não pode ser antes do mês início.</div>
        )}
      </div>

      {loading && <Loading />}

      {!loading && linhas !== null && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard label="Período" val={periodoLabel} color={theme.primary} />
            <StatCard label="Abaixo do mínimo" val={linhas.length} color={theme.danger} />
            <StatCard label="Com atestado médico" val={comAtestado} color="#7c3aed" sub="Falta justificada" />
            <StatCard label="Sem justificativa" val={semJustificativa} color={theme.danger} sub="Precisa contatar família" />
          </div>

          {pendentes.length > 0 && (
            <div style={{
              background: '#fff7ed', border: '1px solid #f59e0b', borderRadius: theme.radius,
              padding: '12px 16px', marginBottom: 16,
            }}>
              <div style={{ fontWeight: 700, color: '#b45309', fontSize: 13.5, marginBottom: 4 }}>
                ⚠️ {pendentes.length} lançamento{pendentes.length !== 1 ? 's' : ''} de frequência ausente{pendentes.length !== 1 ? 's' : ''} no período — não entram nesta lista
              </div>
              <p style={{ fontSize: 12.5, color: '#92400e', margin: 0 }}>
                Estes alunos com Bolsa Família ainda não têm o diário lançado no mês indicado. Frequência ausente
                <strong> não</strong> é tratada como 100% — o aluno só aparece na lista acima depois que o diário for lançado.
                Lance as faltas na tela <strong>Faltas</strong> para esses meses/turmas antes de fechar o Sistema Presença.
              </p>
              <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8, borderTop: '1px solid #f59e0b33', paddingTop: 6 }}>
                {pendentes.map((p, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: '#78350f', padding: '3px 0' }}>
                    {MESES[p.mes - 1]} — {p.aluno.nome} ({p.turmaNome})
                  </div>
                ))}
              </div>
            </div>
          )}

          {linhas.length === 0 ? (
            <EmptyState icon="✅" message={`Nenhum aluno com Bolsa Família abaixo do mínimo de frequência em ${periodoLabel}.`} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <button style={btn('primary')} disabled={salvando} onClick={salvarRegistros}>
                  {salvando ? 'Salvando...' : '💾 Salvar registros deste período'}
                </button>
                {salvo && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.success }}>
                    ✅ Registros salvos no banco — histórico preservado.
                  </span>
                )}
              </div>
            <div style={{ background: theme.card, borderRadius: theme.radiusMd, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: theme.primary }}>
                    {thOrdenavel('mes', 'Mês')}
                    {thOrdenavel('aluno', 'Aluno')}
                    {thOrdenavel('turma', 'Turma')}
                    {thOrdenavel('minimo', 'Mínimo', 'center')}
                    {thOrdenavel('freq', 'Freq.', 'center')}
                    {thOrdenavel('faltas', 'F', 'center')}
                    {thOrdenavel('justificadas', 'J', 'center')}
                    {thOrdenavel('atestados', 'A', 'center')}
                    {thOrdenavel('situacao', 'Situação', 'center')}
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontSize: 13, minWidth: 220 }} title="Código oficial do motivo de baixa frequência — o mesmo lançado no Sistema Presença do governo federal">Motivo da Baixa Frequência</th>
                  </tr>
                </thead>
                <tbody>
                  {(linhasOrdenadas ?? []).map((l, i) => {
                    const linhaId = `${l.aluno.id}-${l.mes}`;
                    const selecionada = linhaSelecionada === linhaId;
                    return (
                      <tr
                        key={linhaId}
                        onClick={() => setLinhaSelecionada(linhaId)}
                        style={{
                          background: selecionada
                            ? 'rgba(250, 204, 21, 0.32)'
                            : i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.06)',
                          boxShadow: selecionada ? 'inset 4px 0 0 #eab308' : 'none',
                          cursor: 'pointer',
                        }}
                        aria-selected={selecionada}
                        title="Clique para destacar este aluno"
                      >
                      <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: theme.text }}>{MESES[l.mes - 1]}</td>
                      <td style={{ padding: '9px 12px', fontSize: 13.5, fontWeight: 600, color: theme.text }}>
                        {l.aluno.nome}
                        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: theme.success }} title="Aluno confirmado com Bolsa Família no cadastro">💚 BF</span>
                        {l.aluno.deficiencia && (
                          <span
                            style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: 'rgba(124,58,237,0.15)', color: '#7c3aed' }}
                            title={`Deficiência registrada: ${l.aluno.deficiencia}`}
                          >
                            ♿ NEE
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 13, color: theme.textMuted }}>{l.turmaNome} {l.isInfantil ? '(Infantil)' : '(Fundamental)'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 13, textAlign: 'center', color: theme.textMuted }}>{l.minimoExigido}%</td>
                      <td style={{ padding: '9px 12px', fontSize: 13.5, textAlign: 'center', fontWeight: 800, color: theme.danger }}>{l.freqPct.toFixed(1)}%</td>
                      <td style={{ padding: '9px 12px', fontSize: 13, textAlign: 'center', color: theme.danger, fontWeight: l.faltas > 0 ? 700 : 400 }}>{l.faltas}</td>
                      <td style={{ padding: '9px 12px', fontSize: 13, textAlign: 'center', color: '#d97706', fontWeight: l.justificadas > 0 ? 700 : 400 }}>{l.justificadas}</td>
                      <td style={{ padding: '9px 12px', fontSize: 13, textAlign: 'center', color: '#7c3aed', fontWeight: l.atestados > 0 ? 700 : 400 }}>{l.atestados}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        {l.atestados > 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(124,58,237,0.15)', color: '#7c3aed' }} title="Aluno tem atestado médico registrado — falta justificada por doença">
                            🏥 COM ATESTADO
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(220,38,38,0.12)', color: theme.danger }} title="Sem atestado médico registrado — recomenda-se contatar a família">
                            ⚠️ SEM JUSTIFICATIVA
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px' }} onClick={e => e.stopPropagation()}>
                        <select
                          value={motivos[linhaId] ?? ''}
                          onChange={e => setMotivoLinha(linhaId, l.aluno.id, l.mes, e.target.value)}
                          style={{ ...input, padding: '4px 6px', fontSize: 11, width: '100%' }}
                          title="Código oficial do motivo de baixa frequência (Bolsa Família/MEC)"
                        >
                          <option value="">— selecionar motivo —</option>
                          {MOTIVOS_BAIXA_FREQUENCIA.map(cat => (
                            <optgroup key={cat.categoria} label={cat.categoria}>
                              {cat.itens.map(m => (
                                <option key={m.codigo} value={m.codigo}>{m.codigo} — {m.descricao}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {salvandoMotivo[linhaId] && <span style={{ fontSize: 10, color: theme.textMuted }}>Salvando...</span>}
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
