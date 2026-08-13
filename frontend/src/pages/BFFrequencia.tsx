import { useEffect, useState } from 'react';
import { api } from '../api';
import { theme, btn, input, label, MESES, getDiasLetivos, isInfantilTurma, sortTurmasPedagogico } from '../styles';
import { Loading, EmptyState, StatCard } from '../components';
import { useAno } from '../AnoContext';

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
}

export default function BFFrequencia() {
  const { ano } = useAno();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [mesInicio, setMesInicio] = useState(new Date().getMonth() + 1);
  const [mesFim, setMesFim] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<LinhaBF[] | null>(null);

  useEffect(() => { api.getTurmas().then(t => setTurmas(sortTurmasPedagogico(t ?? []))); }, []);

  const calcular = async () => {
    setLoading(true);
    setLinhas(null);
    const turmaMap = new Map(turmas.map(t => [t.id, t]));

    const [todosAlunos, ...faltasPorMes] = await Promise.all([
      api.getAllAlunos(),
      ...Array.from({ length: mesFim - mesInicio + 1 }, (_, i) => api.getFaltasMes(mesInicio + i, ano)),
    ]);

    const bfAlunos = (todosAlunos ?? []).filter((a: any) => a.bolsa_familia && isAtivo(a.situacao));

    // Cálculo MÊS A MÊS (independente) — o lançamento no Sistema Presença do Bolsa
    // Família é mensal, então um aluno abaixo do mínimo em junho mas OK em julho
    // precisa aparecer só para junho, não numa média dos dois meses juntos.
    const resultado: LinhaBF[] = [];
    for (let i = 0; i < faltasPorMes.length; i++) {
      const mes = mesInicio + i;
      const registros = faltasPorMes[i] ?? [];
      const diasLetivosMes = getDiasLetivos(mes, ano);
      if (diasLetivosMes === 0) continue;
      for (const aluno of bfAlunos) {
        const registro = registros.find((r: any) => r.alunoId === aluno.id);
        const dias = registro?.frequencia ? decodeDias(registro.frequencia, diasLetivosMes) : null;
        const faltas = dias ? ct(dias, 'F') : 0;
        const justificadas = dias ? ct(dias, 'J') : 0;
        const atestados = dias ? ct(dias, 'A') : 0;
        const turma = turmaMap.get(aluno.turmaId);
        const turmaNome = turma?.nome ?? '—';
        const infantil = isInfantilTurma(turmaNome);
        const minimoExigido = infantil ? 60 : 75;
        const totalAusencias = faltas + justificadas + atestados;
        const freqPct = ((diasLetivosMes - totalAusencias) / diasLetivosMes) * 100;
        if (freqPct < minimoExigido) {
          resultado.push({
            aluno, mes, turmaNome, isInfantil: infantil,
            diasLetivos: diasLetivosMes, faltas, justificadas, atestados,
            freqPct, minimoExigido,
          });
        }
      }
    }
    resultado.sort((a, b) => a.mes - b.mes || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
    setLinhas(resultado);
    setLoading(false);
  };

  const nomeMesInicio = MESES[mesInicio - 1];
  const nomeMesFim = MESES[mesFim - 1];
  const periodoLabel = mesInicio === mesFim ? `${nomeMesInicio}/${ano}` : `${nomeMesInicio} a ${nomeMesFim}/${ano}`;

  const comAtestado = linhas?.filter(l => l.atestados > 0).length ?? 0;
  const semJustificativa = linhas?.filter(l => l.atestados === 0).length ?? 0;

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

          {linhas.length === 0 ? (
            <EmptyState icon="✅" message={`Nenhum aluno com Bolsa Família abaixo do mínimo de frequência em ${periodoLabel}.`} />
          ) : (
            <div style={{ background: theme.card, borderRadius: theme.radiusMd, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: theme.primary }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>Mês</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>Aluno</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>Turma</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontSize: 13 }}>Mínimo</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontSize: 13 }}>Freq.</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontSize: 13 }}>F</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontSize: 13 }}>J</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontSize: 13 }}>A</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontSize: 13 }}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={`${l.aluno.id}-${l.mes}`} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.06)' }}>
                      <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: theme.text }}>{MESES[l.mes - 1]}</td>
                      <td style={{ padding: '9px 12px', fontSize: 13.5, fontWeight: 600, color: theme.text }}>{l.aluno.nome}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
