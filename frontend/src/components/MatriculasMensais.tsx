import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { theme, MESES, input } from '../styles';
import { calcularMatriculasMensais, ContagemSexo } from '../matriculasMensais';

type TipoEnsino = '' | 'INFANTIL' | 'FUNDAMENTAL' | 'EJA' | 'AEE';

function tipoEnsinoDaTurma(turma: any): Exclude<TipoEnsino, ''> {
  const nome = String(turma?.nome ?? '').toUpperCase();
  if (turma?.tipo === 'AEE' || /^AEE\b/.test(nome)) return 'AEE';
  if (/\bEJA\b/.test(nome)) return 'EJA';
  if (/\bETAPA\b/.test(nome)) return 'INFANTIL';
  return 'FUNDAMENTAL';
}

function serieDaTurma(turma: any): string {
  const nome = String(turma?.nome ?? '').trim();
  const regular = nome.match(/^(\d+[ªº]\s+(?:ETAPA|ANO))/i);
  if (regular) return regular[1].toUpperCase();
  if (/^AEE\b/i.test(nome)) return 'AEE';
  return nome.replace(/\s+/g, ' ').toUpperCase();
}

const TIPO_LABEL: Record<Exclude<TipoEnsino, ''>, string> = {
  INFANTIL: 'Educação Infantil',
  FUNDAMENTAL: 'Ensino Fundamental de 9 anos',
  EJA: 'EJA Fundamental — anos iniciais',
  AEE: 'Atendimento Educacional Especializado',
};

function CelulasContagem({ valor }: { valor: ContagemSexo }) {
  return (
    <>
      <td style={numero('#2563eb')}>{valor.masculino}</td>
      <td style={numero('#db2777')}>{valor.feminino}</td>
      <td style={numero(valor.naoInformado > 0 ? theme.orange : theme.textMuted)}>{valor.naoInformado}</td>
      <td style={{ ...numero(theme.text), fontWeight: 800 }}>{valor.total}</td>
    </>
  );
}

function numero(cor: string): CSSProperties {
  return { textAlign: 'center', padding: '8px 7px', color: cor, fontWeight: 700, whiteSpace: 'nowrap' };
}

export default function MatriculasMensais({
  alunos,
  turmas,
  ano,
  onAnoChange,
}: {
  alunos: any[];
  turmas: any[];
  ano: number;
  onAnoChange: (ano: number) => void;
}) {
  const hoje = useMemo(() => new Date(), []);
  const ultimoMesDisponivel = ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
  const [mesInicio, setMesInicio] = useState(1);
  const [mesFim, setMesFim] = useState(ultimoMesDisponivel);
  const [tipoEnsino, setTipoEnsino] = useState<TipoEnsino>('');
  const [serie, setSerie] = useState('');
  const [turmaId, setTurmaId] = useState('');

  useEffect(() => {
    setMesInicio(1);
    setMesFim(ultimoMesDisponivel);
  }, [ano, ultimoMesDisponivel]);

  const turmasDoTipo = useMemo(
    () => turmas.filter(turma => !tipoEnsino || tipoEnsinoDaTurma(turma) === tipoEnsino),
    [turmas, tipoEnsino],
  );
  const seriesDisponiveis = useMemo(
    () => [...new Set(turmasDoTipo.map(serieDaTurma))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [turmasDoTipo],
  );
  const turmasDisponiveis = useMemo(
    () => turmasDoTipo.filter(turma => !serie || serieDaTurma(turma) === serie),
    [turmasDoTipo, serie],
  );
  const turmasFiltradas = useMemo(
    () => turmasDisponiveis.filter(turma => !turmaId || turma.id === turmaId),
    [turmasDisponiveis, turmaId],
  );
  const alunosFiltrados = useMemo(() => {
    if (!tipoEnsino && !serie && !turmaId) return alunos;
    const ids = new Set(turmasFiltradas.map(turma => turma.id));
    return alunos.filter(aluno => ids.has(aluno.turmaId));
  }, [alunos, turmasFiltradas, tipoEnsino, serie, turmaId]);
  const resumo = useMemo(
    () => calcularMatriculasMensais(
      alunosFiltrados,
      turmasFiltradas,
      ano,
      mesInicio,
      mesFim,
      hoje,
      tipoEnsino === 'AEE',
    ),
    [alunosFiltrados, turmasFiltradas, ano, mesInicio, mesFim, hoje, tipoEnsino],
  );

  return (
    <section style={{
      background: theme.card,
      border: `1px solid ${theme.borderLight}`,
      borderRadius: theme.radiusMd,
      boxShadow: theme.shadow,
      marginBottom: 20,
      overflow: 'hidden',
    }} aria-labelledby="titulo-matriculas-mensais">
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.borderLight}` }}>
        <h2 id="titulo-matriculas-mensais" style={{ margin: 0, fontSize: 17, color: theme.text }}>
          📅 Matrículas por mês — {ano}
        </h2>
        <p style={{ margin: '5px 0 0', color: theme.textSecondary, fontSize: 12.5 }}>
          Cada pessoa é contada uma única vez por RA. Remanejamentos e AEE não duplicam o total; transferidos permanecem no mês em que frequentaram.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Ano letivo
            <select value={ano} onChange={e => onAnoChange(Number(e.target.value))}
              style={{ ...input, display: 'block', margin: '4px 0 0', minWidth: 105 }}>
              {[2025, 2026, 2027].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Mês inicial
            <select value={mesInicio} onChange={e => {
              const novoInicio = Number(e.target.value);
              setMesInicio(novoInicio);
              if (novoInicio > mesFim) setMesFim(novoInicio);
            }} style={{ ...input, display: 'block', margin: '4px 0 0', minWidth: 145 }}>
              {MESES.slice(0, ultimoMesDisponivel).map((mes, indice) => <option key={mes} value={indice + 1}>{mes}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Mês final
            <select value={mesFim} onChange={e => setMesFim(Number(e.target.value))}
              style={{ ...input, display: 'block', margin: '4px 0 0', minWidth: 145 }}>
              {MESES.slice(mesInicio - 1, ultimoMesDisponivel).map((mes, indice) => (
                <option key={mes} value={mesInicio + indice}>{mes}</option>
              ))}
            </select>
          </label>
          <div style={{ padding: '8px 11px', borderRadius: theme.radius, background: `${theme.primary}12`, color: theme.textSecondary, fontSize: 12.5 }}>
            {MESES[mesInicio - 1]} a {MESES[mesFim - 1]} de {ano}
            {ano === hoje.getFullYear() && mesFim === hoje.getMonth() + 1 ? ` · até ${hoje.toLocaleDateString('pt-BR')}` : ''}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 10 }}>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Tipo de ensino
            <select value={tipoEnsino} onChange={e => {
              setTipoEnsino(e.target.value as TipoEnsino);
              setSerie('');
              setTurmaId('');
            }} style={{ ...input, display: 'block', margin: '4px 0 0', width: '100%' }}>
              <option value="">Todos — matrícula regular</option>
              {(Object.keys(TIPO_LABEL) as Array<Exclude<TipoEnsino, ''>>).map(tipo => (
                <option key={tipo} value={tipo}>{TIPO_LABEL[tipo]}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Série
            <select value={serie} onChange={e => { setSerie(e.target.value); setTurmaId(''); }}
              style={{ ...input, display: 'block', margin: '4px 0 0', width: '100%' }}>
              <option value="">Todas as séries</option>
              {seriesDisponiveis.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Turma
            <select value={turmaId} onChange={e => setTurmaId(e.target.value)}
              style={{ ...input, display: 'block', margin: '4px 0 0', width: '100%' }}>
              <option value="">Todas as turmas</option>
              {turmasDisponiveis.map(turma => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setTipoEnsino(''); setSerie(''); setTurmaId(''); setMesInicio(1); setMesFim(ultimoMesDisponivel); }}
            style={{ alignSelf: 'end', ...input, cursor: 'pointer', fontWeight: 700, color: theme.primary }}>
            🧹 Limpar filtros
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, padding: '12px 16px' }}>
        <Resumo label="Alunos no período" valor={resumo.totalPeriodo.masculino} cor="#2563eb" />
        <Resumo label="Alunas no período" valor={resumo.totalPeriodo.feminino} cor="#db2777" />
        <Resumo label="Sexo não informado" valor={resumo.totalPeriodo.naoInformado} cor={theme.orange} />
        <Resumo label="Total único do período" valor={resumo.totalPeriodo.total} cor={theme.primary} />
      </div>

      {(resumo.semSexo > 0 || resumo.semDataInicio > 0) && (
        <div style={{ margin: '0 16px 12px', padding: '9px 12px', borderRadius: theme.radius, background: `${theme.orange}12`, border: `1px solid ${theme.orange}55`, color: theme.textSecondary, fontSize: 12.5 }}>
          ⚠️ Conferência necessária na SED:
          {resumo.semSexo > 0 ? ` ${resumo.semSexo} aluno(s) sem sexo informado.` : ''}
          {resumo.semDataInicio > 0 ? ` ${resumo.semDataInicio} aluno(s) sem data de início e fora da contagem mensal.` : ''}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: theme.primary, color: 'white' }}>
              <th rowSpan={2} style={{ padding: '9px 12px', textAlign: 'left' }}>Mês</th>
              <th colSpan={4} style={{ padding: 7, borderLeft: '1px solid rgba(255,255,255,.22)' }}>Matrículas existentes</th>
              <th colSpan={4} style={{ padding: 7, borderLeft: '1px solid rgba(255,255,255,.22)' }}>Entradas no mês</th>
              <th colSpan={4} style={{ padding: 7, borderLeft: '1px solid rgba(255,255,255,.22)' }}>Saídas no mês</th>
            </tr>
            <tr style={{ background: theme.primaryHover, color: 'white' }}>
              {[0, 1, 2].flatMap(grupo => ['Alunos', 'Alunas', 'N/I', 'Total'].map((label, indice) => (
                <th key={`${grupo}-${label}`} title={label === 'N/I' ? 'Sexo não informado' : undefined} style={{ padding: '6px 7px', textAlign: 'center', borderLeft: indice === 0 ? '1px solid rgba(255,255,255,.22)' : undefined }}>{label}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {resumo.meses.map((linha, indice) => (
              <tr key={linha.mes} style={{ background: indice % 2 === 0 ? 'transparent' : theme.bg, borderBottom: `1px solid ${theme.borderLight}` }}>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: theme.text }}>{MESES[linha.mes - 1]}</td>
                <CelulasContagem valor={linha.matriculados} />
                <CelulasContagem valor={linha.entradas} />
                <CelulasContagem valor={linha.saidas} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--footer-row)', borderTop: `2px solid ${theme.primary}55` }}>
              <td style={{ padding: '10px 12px', fontWeight: 800, color: theme.text }}>TOTAL DO PERÍODO*</td>
              <CelulasContagem valor={resumo.totalPeriodo} />
              <CelulasContagem valor={resumo.totalEntradas} />
              <CelulasContagem valor={resumo.totalSaidas} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ padding: '8px 16px 12px', color: theme.textMuted, fontSize: 11.5 }}>
        * Em “Matrículas existentes”, o total representa pessoas únicas no período selecionado — não é a soma dos meses.
      </div>
    </section>
  );
}

function Resumo({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div style={{ border: `1px solid ${cor}44`, borderRadius: theme.radius, padding: '9px 12px', background: `${cor}0d` }}>
      <div style={{ fontSize: 11.5, color: theme.textSecondary }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: cor }}>{valor}</div>
    </div>
  );
}
