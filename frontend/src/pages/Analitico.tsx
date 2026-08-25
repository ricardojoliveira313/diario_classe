import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { theme, input, MESES, MESES_ABR, SITUACAO_COR, SITUACAO_LABEL, sortTurmasPedagogico, getDiasLetivos } from '../styles';
import { Loading, EmptyState } from '../components';
import { useAno } from '../AnoContext';
import { SITUACOES_NAO_ATIVAS, consolidarPorAluno } from '../situacoes';
import { MOTIVO_BF_POR_CODIGO } from '../motivosBaixaFrequencia';

// ─── Painel Analítico — visão gerencial cruzando dados que já existem em
// outras telas (Faltas, BF-Frequência, Situações), sem duplicar cálculo:
// reaproveita consolidarPorAluno (Situações) e os mesmos campos de Falta
// usados em Faltas.tsx (faltas, motivo_baixa_frequencia).

interface LinhaBarra {
  chave: string;
  label: string;
  valor: number;
  sub?: string;
}

// Barra horizontal simples: rótulo à esquerda, barra proporcional ao maior
// valor do conjunto, número por extenso ao lado (rótulo direto, sem exigir
// hover) — uma única cor por gráfico (magnitude = escala sequencial única).
function BarraHorizontal({ linhas, cor, formatarValor }: {
  linhas: LinhaBarra[]; cor: string; formatarValor?: (v: number) => string;
}) {
  const max = Math.max(1, ...linhas.map(l => l.valor));
  const fmt = formatarValor ?? (v => String(v));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {linhas.map(l => (
        <div key={l.chave} style={{ display: 'grid', gridTemplateColumns: '1fr 3fr auto', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.label}>
            {l.label}
            {l.sub && <span style={{ color: theme.textMuted, fontWeight: 500 }}> · {l.sub}</span>}
          </div>
          <div style={{ background: 'var(--ghost-bg)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(2, (l.valor / max) * 100)}%`, height: '100%', background: cor, borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12.5, color: theme.textSecondary, fontWeight: 700, textAlign: 'right', minWidth: 34 }}>
            {fmt(l.valor)}
          </div>
        </div>
      ))}
    </div>
  );
}

// 12 colunas verticais (uma por mês) — magnitude única por coluna.
function GraficoMensal({ valores, cor, formatarValor }: {
  valores: number[]; cor: string; formatarValor?: (v: number) => string;
}) {
  const max = Math.max(1, ...valores);
  const fmt = formatarValor ?? (v => String(v));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
      {valores.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 10.5, color: theme.textSecondary, fontWeight: 700, marginBottom: 3 }}>{v > 0 ? fmt(v) : ''}</div>
          <div style={{ width: '70%', height: `${Math.max(2, (v / max) * 100)}%`, background: cor, borderRadius: '3px 3px 0 0' }} />
          <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 4 }}>{MESES_ABR[i]}</div>
        </div>
      ))}
    </div>
  );
}

// 12 colunas empilhadas (uma por mês, várias situações) — categórico, cores
// já estabelecidas em toda a aplicação (SITUACAO_COR), legenda sempre visível
// porque são 5+ séries.
function GraficoMensalEmpilhado({ porMes, situacoes }: {
  porMes: Record<string, number>[]; situacoes: string[];
}) {
  const totais = porMes.map(m => situacoes.reduce((soma, s) => soma + (m[s] ?? 0), 0));
  const max = Math.max(1, ...totais);
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {situacoes.map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: theme.textSecondary }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: SITUACAO_COR[s], display: 'inline-block' }} />
            {SITUACAO_LABEL[s]}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150 }}>
        {porMes.map((m, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 10.5, color: theme.textSecondary, fontWeight: 700, marginBottom: 3 }}>{totais[i] > 0 ? totais[i] : ''}</div>
            <div style={{ width: '70%', height: `${Math.max(totais[i] > 0 ? 2 : 0, (totais[i] / max) * 100)}%`, borderRadius: '3px 3px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
              {situacoes.map(s => {
                const v = m[s] ?? 0;
                if (!v) return null;
                return <div key={s} style={{ width: '100%', height: `${(v / (totais[i] || 1)) * 100}%`, background: SITUACAO_COR[s] }} title={`${SITUACAO_LABEL[s]}: ${v}`} />;
              })}
            </div>
            <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 4 }}>{MESES_ABR[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardGrafico({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: theme.card, borderRadius: theme.radiusMd, boxShadow: theme.shadow, padding: 16, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 15, color: theme.text }}>{titulo}</h2>
      {sub && <p style={{ margin: '4px 0 14px', color: theme.textSecondary, fontSize: 12 }}>{sub}</p>}
      <div style={{ marginTop: sub ? 0 : 14 }}>{children}</div>
    </div>
  );
}

export default function Analitico() {
  const { ano, setAno } = useAno();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [faltasPorMes, setFaltasPorMes] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [mesInicio, setMesInicio] = useState(1);
  const [mesFim, setMesFim] = useState(12);

  useEffect(() => {
    setLoading(true);
    setErro('');
    Promise.all([
      api.getTurmas(),
      api.getAllAlunos(),
      ...Array.from({ length: 12 }, (_, i) => api.getFaltasMes(i + 1, ano)),
    ])
      .then(([t, a, ...meses]) => { setTurmas(t); setAlunos(a); setFaltasPorMes(meses); })
      .catch((e: any) => setErro(`Não foi possível carregar os dados: ${e?.message ?? e}`))
      .finally(() => setLoading(false));
  }, [ano]);

  const turmaMap = useMemo(() => new Map(turmas.map(t => [t.id, t])), [turmas]);
  const alunoMap = useMemo(() => new Map(alunos.map(a => [a.id, a])), [alunos]);
  const ativos = useMemo(() => alunos.filter(a => !a.situacao || a.situacao === 'ATIVO'), [alunos]);

  const faltasNoPeriodo = useMemo(
    () => faltasPorMes.slice(mesInicio - 1, mesFim).flat(),
    [faltasPorMes, mesInicio, mesFim],
  );
  const mesesNoPeriodo = mesFim - mesInicio + 1;

  // ── 1) Ranking de faltas por turma ────────────────────────────────────
  const rankingTurmas: LinhaBarra[] = useMemo(() => {
    const somaPorTurma = new Map<string, number>();
    for (const f of faltasNoPeriodo) {
      const aluno = alunoMap.get(f.alunoId);
      if (!aluno || (aluno.situacao && aluno.situacao !== 'ATIVO')) continue;
      somaPorTurma.set(f.turmaId, (somaPorTurma.get(f.turmaId) ?? 0) + (f.faltas ?? 0));
    }
    return sortTurmasPedagogico(turmas)
      .map(t => ({
        chave: t.id,
        label: t.nome,
        sub: t.professora || undefined,
        valor: somaPorTurma.get(t.id) ?? 0,
      }))
      .filter(l => l.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [faltasNoPeriodo, turmas, alunoMap]);

  // ── 2) Frequência média: Bolsa Família vs. demais ─────────────────────
  const comparativoBF = useMemo(() => {
    const porAluno = new Map<string, { faltas: number; letivos: number; bf: boolean }>();
    for (const f of faltasNoPeriodo) {
      const aluno = alunoMap.get(f.alunoId);
      if (!aluno || (aluno.situacao && aluno.situacao !== 'ATIVO')) continue;
      const atual = porAluno.get(f.alunoId) ?? { faltas: 0, letivos: 0, bf: !!aluno.bolsa_familia };
      atual.faltas += f.faltas ?? 0;
      atual.letivos += getDiasLetivos(f.mes, ano);
      porAluno.set(f.alunoId, atual);
    }
    const calcularMedia = (soBolsa: boolean) => {
      const grupo = [...porAluno.values()].filter(a => a.bf === soBolsa && a.letivos > 0);
      if (grupo.length === 0) return null;
      const media = grupo.reduce((soma, a) => soma + (a.letivos - a.faltas) / a.letivos, 0) / grupo.length;
      return { percentual: media * 100, alunos: grupo.length };
    };
    return { comBolsa: calcularMedia(true), semBolsa: calcularMedia(false) };
  }, [faltasNoPeriodo, alunoMap, ano]);

  // ── 3) Evolução mensal de faltas (ano inteiro, todas as turmas) ───────
  const evolucaoMensal = useMemo(() => {
    return faltasPorMes.map(mesRegistros => {
      let soma = 0;
      for (const f of mesRegistros) {
        const aluno = alunoMap.get(f.alunoId);
        if (!aluno || (aluno.situacao && aluno.situacao !== 'ATIVO')) continue;
        soma += f.faltas ?? 0;
      }
      return soma;
    });
  }, [faltasPorMes, alunoMap]);

  // ── 4) Ranking de motivos de baixa frequência ─────────────────────────
  const rankingMotivos: LinhaBarra[] = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const f of faltasNoPeriodo) {
      if (!f.motivo_baixa_frequencia) continue;
      contagem.set(f.motivo_baixa_frequencia, (contagem.get(f.motivo_baixa_frequencia) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .map(([codigo, valor]) => ({ chave: codigo, label: MOTIVO_BF_POR_CODIGO[codigo] ?? codigo, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [faltasNoPeriodo]);

  // ── 5) Situações (transferência, remanejamento etc.) por mês ─────────
  const situacoesPorMes = useMemo(() => {
    const vencedores = consolidarPorAluno(alunos);
    const naoAtivos = vencedores.filter(v => SITUACOES_NAO_ATIVAS.includes(v.situacaoNorm) && v.data && v.data.getFullYear() === ano);
    return Array.from({ length: 12 }, (_, indiceMes) => {
      const doMes = naoAtivos.filter(v => v.data!.getMonth() === indiceMes);
      const porSituacao: Record<string, number> = {};
      for (const v of doMes) porSituacao[v.situacaoNorm] = (porSituacao[v.situacaoNorm] ?? 0) + 1;
      return porSituacao;
    });
  }, [alunos, ano]);

  if (loading) return <Loading text="Carregando painel analítico..." />;
  if (erro) return <EmptyState icon="⚠️" message={erro} />;
  if (alunos.length === 0) return <EmptyState icon="📈" message="Nenhum aluno importado ainda." />;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ background: theme.card, borderRadius: theme.radiusMd, boxShadow: theme.shadow, padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: theme.text }}>📈 Painel Analítico</h2>
        <p style={{ margin: '6px 0 0', color: theme.textSecondary, fontSize: 13 }}>
          Visão gerencial cruzando dados que já existem no sistema (Faltas, Bolsa Família, Situações) — sem nenhum
          lançamento novo, só leitura.
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
        </div>
      </div>

      <CardGrafico titulo="🏫 Ranking de faltas por turma" sub={`Total de faltas (F+J+A) de alunos ativos, de ${MESES[mesInicio - 1]} a ${MESES[mesFim - 1]}/${ano} — quanto maior, mais atenção a turma precisa.`}>
        {rankingTurmas.length === 0
          ? <p style={{ color: theme.textMuted, fontSize: 13 }}>Nenhuma falta lançada nesse período.</p>
          : <BarraHorizontal linhas={rankingTurmas} cor={theme.danger} />}
      </CardGrafico>

      <CardGrafico titulo="💚 Frequência média: Bolsa Família x demais alunos" sub={`Frequência média (%) no período selecionado, entre alunos ativos.`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div style={{ textAlign: 'center', padding: '10px 8px', borderRadius: theme.radius, background: 'var(--ghost-bg)' }}>
            <div style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 600 }}>💚 Com Bolsa Família</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: theme.success, marginTop: 4 }}>
              {comparativoBF.comBolsa ? `${comparativoBF.comBolsa.percentual.toFixed(1)}%` : '—'}
            </div>
            {comparativoBF.comBolsa && <div style={{ fontSize: 11, color: theme.textMuted }}>{comparativoBF.comBolsa.alunos} aluno(s)</div>}
          </div>
          <div style={{ textAlign: 'center', padding: '10px 8px', borderRadius: theme.radius, background: 'var(--ghost-bg)' }}>
            <div style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 600 }}>Demais alunos</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: theme.primary, marginTop: 4 }}>
              {comparativoBF.semBolsa ? `${comparativoBF.semBolsa.percentual.toFixed(1)}%` : '—'}
            </div>
            {comparativoBF.semBolsa && <div style={{ fontSize: 11, color: theme.textMuted }}>{comparativoBF.semBolsa.alunos} aluno(s)</div>}
          </div>
        </div>
      </CardGrafico>

      <CardGrafico titulo="📅 Evolução mensal de faltas" sub={`Total de faltas de alunos ativos por mês, em ${ano} — ajuda a identificar picos (ex.: pós-recesso).`}>
        <GraficoMensal valores={evolucaoMensal} cor={theme.warning} />
      </CardGrafico>

      <CardGrafico titulo="📋 Motivos de baixa frequência mais frequentes" sub={`Top 10 motivos lançados de ${MESES[mesInicio - 1]} a ${MESES[mesFim - 1]}/${ano}.`}>
        {rankingMotivos.length === 0
          ? <p style={{ color: theme.textMuted, fontSize: 13 }}>Nenhum motivo registrado nesse período.</p>
          : <BarraHorizontal linhas={rankingMotivos} cor={theme.purple} />}
      </CardGrafico>

      <CardGrafico titulo="🔄 Situações (transferências, remanejamentos etc.) por mês" sub={`Alunos fora de ATIVO em ${ano}, pela data de movimentação — mesma lógica da aba Situações.`}>
        <GraficoMensalEmpilhado porMes={situacoesPorMes} situacoes={SITUACOES_NAO_ATIVAS} />
      </CardGrafico>
    </div>
  );
}
