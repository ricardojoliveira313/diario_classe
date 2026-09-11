import { useEffect, useMemo, useState } from 'react';
import { api, supabase } from '../api';
import { Loading } from '../components';
import { theme, card as cardStyle, input, label as labelStyle, MESES } from '../styles';
import { useAno } from '../AnoContext';
import { calcularMapaEja, ehTurmaEja, cicloEjaDaTurma, FAIXAS_ETARIAS_EJA } from '../mapaEja';

const ORDEM_CICLO = { ALFA: 0, POS: 1, MULTI: 2 } as const;

const CICLO_LABEL: Record<string, string> = {
  ALFA: 'Alfa', POS: 'Pós', MULTI: 'Multi',
  TERMO1: '1º Termo', TERMO2: '2º Termo', TERMO3: '3º Termo', TERMO4: '4º Termo',
};
// Lista de espera: pré-cadastro de quem procura vaga — aceita tanto o ciclo
// (Alfa/Pós) quanto o termo (1º a 4º), conforme o que a escola já sabe do candidato.
const TERMOS_ESPERA = ['ALFA', 'POS', 'TERMO1', 'TERMO2', 'TERMO3', 'TERMO4'];
const PERIODOS = ['Manhã', 'Tarde', 'Vespertino', 'Noite'];

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 11.5, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '7px 10px', textAlign: 'center', color: theme.text, fontSize: 13, borderBottom: `1px solid ${theme.borderLight}` };
const tdEsq: React.CSSProperties = { ...td, textAlign: 'left', fontWeight: 600 };

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle({ marginBottom: 20, overflow: 'hidden' })}>
      <div style={{ padding: '10px 14px', background: theme.primary, color: '#fff', fontWeight: 800, fontSize: 14 }}>{titulo}</div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  );
}

export default function MapaEja() {
  const { ano } = useAno();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [listaEspera, setListaEspera] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const hoje = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [salvandoCampo, setSalvandoCampo] = useState('');
  const [novaEspera, setNovaEspera] = useState({ nome: '', ciclo: 'TERMO1', periodo: 'Noite', telefone: '', observacao: '' });
  const [salvandoEspera, setSalvandoEspera] = useState(false);

  // Cada busca é independente — turmas/alunos vêm do mesmo cadastro que a
  // aba Importar já grava, então uma falha na lista de espera (por exemplo,
  // ADICIONAR_MAPA_EJA.sql ainda não rodado no Supabase, tabela inexistente)
  // não pode derrubar a tela inteira e mostrar "nenhuma turma encontrada"
  // como se os dados não existissem — achado real (set/2026).
  const carregar = () => {
    setLoading(true);
    setErro('');
    Promise.all([
      api.getTurmas().catch(e => { throw new Error(`Turmas: ${e.message ?? e}`); }),
      api.getAllAlunos().catch(e => { throw new Error(`Alunos: ${e.message ?? e}`); }),
    ])
      .then(([t, a]) => {
        setTurmas(t ?? []);
        setAlunos(a ?? []);
      })
      .catch(e => setErro(e.message ?? String(e)))
      .finally(() => setLoading(false));
    api.getListaEsperaEja()
      .then(le => setListaEspera(le ?? []))
      .catch(() => setListaEspera([]));
  };
  useEffect(carregar, []);

  const resumo = useMemo(() => calcularMapaEja(alunos, turmas, mes, ano, hoje), [alunos, turmas, mes, ano, hoje]);
  const alunosEjaPendentesDados = useMemo(() => {
    const turmasEja = new Set(turmas.filter(t => ehTurmaEja(t.nome)).map(t => t.id));
    return alunos.filter(a => turmasEja.has(a.turmaId) && (!a.situacao || a.situacao === 'ATIVO'));
  }, [alunos, turmas]);
  // Agrupado por turma (Alfa em cima, Pós embaixo, etc.) em vez de misturado
  // por ordem de chegada do banco — pedido real: fica mais fácil de conferir
  // separado por turma do que intercalado.
  const turmasEjaOrdenadas = useMemo(() =>
    turmas.filter(t => ehTurmaEja(t.nome))
      .sort((x, y) => ORDEM_CICLO[cicloEjaDaTurma(x.nome)] - ORDEM_CICLO[cicloEjaDaTurma(y.nome)]),
    [turmas]);

  const somar = (campo: keyof typeof resumo.linhas[number]) =>
    resumo.linhas.reduce((soma, l) => soma + (l[campo] as number), 0);

  const atualizarCampoAluno = async (id: string, campo: string, valor: any) => {
    setSalvandoCampo(id + campo);
    try {
      const { error } = await supabase.from('Aluno').update({ [campo]: valor }).eq('id', id);
      if (error) throw error;
      setAlunos(atuais => atuais.map(a => a.id === id ? { ...a, [campo]: valor } : a));
    } finally {
      setSalvandoCampo('');
    }
  };

  const atualizarCampoTurma = async (id: string, campo: string, valor: any) => {
    setSalvandoCampo(id + campo);
    try {
      const { error } = await supabase.from('Turma').update({ [campo]: valor }).eq('id', id);
      if (error) throw error;
      setTurmas(atuais => atuais.map(t => t.id === id ? { ...t, [campo]: valor } : t));
    } finally {
      setSalvandoCampo('');
    }
  };

  const criarListaEspera = async () => {
    if (!novaEspera.nome.trim() || !novaEspera.telefone.trim()) return;
    setSalvandoEspera(true);
    try {
      await api.criarListaEsperaEja(novaEspera);
      setNovaEspera({ nome: '', ciclo: 'TERMO1', periodo: 'Noite', telefone: '', observacao: '' });
      const le = await api.getListaEsperaEja();
      setListaEspera(le ?? []);
    } finally {
      setSalvandoEspera(false);
    }
  };

  const removerListaEspera = async (id: string) => {
    await api.removerListaEsperaEja(id);
    setListaEspera(atuais => atuais.filter(l => l.id !== id));
  };

  if (loading) return <Loading />;

  if (erro) {
    return (
      <div>
        <h2 style={{ color: theme.text, marginBottom: 4 }}>📋 Mapa EJA</h2>
        <div style={{ ...cardStyle({ padding: 16 }), border: `1px solid ${theme.danger}`, color: theme.danger }}>
          <strong>Não foi possível carregar os dados:</strong> {erro}
          <div style={{ marginTop: 6, fontSize: 13, color: theme.textSecondary }}>
            Se o erro mencionar uma coluna ou tabela que não existe, é sinal de que o SQL <code>ADICIONAR_MAPA_EJA.sql</code> ainda
            não foi rodado no Supabase — peça pra administração rodar e depois clique em "Tentar de novo".
          </div>
          <button type="button" onClick={carregar} className="report-action report-action-primary" style={{ marginTop: 10 }}>
            🔄 Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (resumo.linhas.length === 0) {
    return (
      <div>
        <h2 style={{ color: theme.text, marginBottom: 4 }}>📋 Mapa EJA</h2>
        <p style={{ color: theme.textSecondary }}>
          Nenhuma turma de EJA encontrada nos dados atuais (buscamos turmas cujo nome contém "EJA"). Importe os
          arquivos da SED na aba Importar, depois volte aqui e clique em "Atualizar dados".
        </p>
        <button type="button" onClick={carregar} className="report-action report-action-primary">🔄 Atualizar dados</button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ color: theme.text, marginBottom: 4 }}>📋 Mapa EJA</h2>
      <p style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 16 }}>
        Gerado automaticamente a partir dos dados importados da SED (situação, datas de matrícula/movimentação e
        data de nascimento). A importação continua sendo feita na aba <strong>Importar</strong> — aqui é só a leitura
        do mesmo cadastro. Óbito, CADE, medida socioeducativa, rematrícula e resultado final são lançados manualmente
        na conferência abaixo — a SED não informa isso.
      </p>

      <div style={{ ...cardStyle({ padding: 14 }), marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Mês de referência</label>
          <select style={{ ...input, minWidth: 160 }} value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <button type="button" onClick={carregar} className="report-action report-action-neutral">
          🔄 Atualizar dados
        </button>
        <div style={{ color: theme.textSecondary, fontSize: 12.5 }}>Ano letivo: <strong>{ano}</strong></div>
      </div>

      <Secao titulo="AJUSTE MANUAL — EVASÃO E NUNCA COMPARECEU (não listados mais pela SED)">
        <div style={{ padding: '10px 14px', fontSize: 12.5, color: theme.textMuted }}>
          Alunos com situação "Evasão" ou "Nunca compareceu" que a SED parou de listar nos
          relatórios (nome/RA perdidos) não podem mais virar um cadastro de aluno de verdade.
          Lance aqui a quantidade fixa por turma e a faixa etária — o valor soma direto no Mapa
          EJA (Eliminação Geral e Faixa Etária) até você conseguir os dados reais, se um dia
          conseguir. Uma evasão ou nunca-comparecimento <strong>novo</strong>, vindo de um import
          real, continua sendo detectado automaticamente pela situação do aluno — não precisa
          lançar aqui.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.primaryHover }}>
              <th style={{ ...th, textAlign: 'left' }}>Turma</th>
              <th style={th}>Qtde Evasão</th>
              <th style={th}>Faixa etária (Evasão)</th>
              <th style={th}>Qtde Nunca Comp.</th>
              <th style={th}>Faixa etária (Nunca Comp.)</th>
            </tr>
          </thead>
          <tbody>
            {turmas.filter(t => ehTurmaEja(t.nome)).map(t => (
              <tr key={t.id}>
                <td style={tdEsq}>{t.nome} — {t.professora}</td>
                <td style={td}>
                  <input type="number" min={0} style={{ ...input, width: 70, textAlign: 'center' }}
                    value={t.ajuste_evasao ?? 0}
                    onChange={e => atualizarCampoTurma(t.id, 'ajuste_evasao', Number(e.target.value) || 0)} />
                </td>
                <td style={td}>
                  <select style={input} value={t.ajuste_faixa_evasao ?? ''}
                    onChange={e => atualizarCampoTurma(t.id, 'ajuste_faixa_evasao', e.target.value || null)}>
                    <option value="">—</option>
                    {FAIXAS_ETARIAS_EJA.map(f => <option key={f.label} value={f.label}>{f.label}</option>)}
                  </select>
                </td>
                <td style={td}>
                  <input type="number" min={0} style={{ ...input, width: 70, textAlign: 'center' }}
                    value={t.ajuste_nunca_compareceram ?? 0}
                    onChange={e => atualizarCampoTurma(t.id, 'ajuste_nunca_compareceram', Number(e.target.value) || 0)} />
                </td>
                <td style={td}>
                  <select style={input} value={t.ajuste_faixa_nunca_compareceram ?? ''}
                    onChange={e => atualizarCampoTurma(t.id, 'ajuste_faixa_nunca_compareceram', e.target.value || null)}>
                    <option value="">—</option>
                    {FAIXAS_ETARIAS_EJA.map(f => <option key={f.label} value={f.label}>{f.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Secao>

      <Secao titulo="ELIMINAÇÃO GERAL">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.primaryHover }}>
              <th style={{ ...th, textAlign: 'left' }}>Professor(a) EJA I</th>
              <th style={th}>Modalidade/Ciclo</th>
              <th style={th}>Matr. Geral</th>
              <th style={th}>Evasão</th>
              <th style={th}>Transferência</th>
              <th style={th}>Óbito</th>
              <th style={th}>Nunca comp.</th>
              <th style={th}>Total eliminados</th>
              <th style={th}>Frequentes</th>
            </tr>
          </thead>
          <tbody>
            {resumo.linhas.map(l => (
              <tr key={l.turmaId}>
                <td style={tdEsq}>{l.turmaNome} — {l.professora}</td>
                <td style={td}>EJA I / {CICLO_LABEL[l.ciclo]} / {l.periodo}</td>
                <td style={td}>{l.matriculaGeral}</td>
                <td style={td}>{l.evasao}</td>
                <td style={td}>{l.transferencia}</td>
                <td style={td}>{l.obito}</td>
                <td style={td}>{l.nuncaCompareceram}</td>
                <td style={{ ...td, fontWeight: 800 }}>{l.totalEliminadosGeral}</td>
                <td style={td}>{l.alunosFrequentes}</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--footer-row)', fontWeight: 800 }}>
              <td style={tdEsq} colSpan={2}>TOTAIS EJA I</td>
              <td style={td}>{somar('matriculaGeral')}</td>
              <td style={td}>{somar('evasao')}</td>
              <td style={td}>{somar('transferencia')}</td>
              <td style={td}>{somar('obito')}</td>
              <td style={td}>{somar('nuncaCompareceram')}</td>
              <td style={td}>{somar('totalEliminadosGeral')}</td>
              <td style={td}>{somar('alunosFrequentes')}</td>
            </tr>
          </tbody>
        </table>
      </Secao>

      <Secao titulo="MATRICULADOS NO MÊS">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.primaryHover }}>
              <th style={{ ...th, textAlign: 'left' }}>Professor(a)</th>
              <th style={th}>Ciclo</th>
              <th style={th}>Período</th>
              <th style={th}>Vieram do mês anterior</th>
              <th style={th}>Matr. Nova</th>
              <th style={th}>Rematrícula</th>
              <th style={th}>CADE</th>
              <th style={th}>Medidas socioeducativas</th>
            </tr>
          </thead>
          <tbody>
            {resumo.linhas.map(l => (
              <tr key={l.turmaId}>
                <td style={tdEsq}>{l.turmaNome}</td>
                <td style={td}>{CICLO_LABEL[l.ciclo]}</td>
                <td style={td}>{l.periodo}</td>
                <td style={td}>{l.vieramDoMesAnterior}</td>
                <td style={td}>{l.matriculaNova}</td>
                <td style={td}>{l.rematricula}</td>
                <td style={td}>{l.cade}</td>
                <td style={td}>{l.medidasSocioeducativas}</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--footer-row)', fontWeight: 800 }}>
              <td style={tdEsq} colSpan={3}>TOTAL</td>
              <td style={td}>{somar('vieramDoMesAnterior')}</td>
              <td style={td}>{somar('matriculaNova')}</td>
              <td style={td}>{somar('rematricula')}</td>
              <td style={td}>{somar('cade')}</td>
              <td style={td}>{somar('medidasSocioeducativas')}</td>
            </tr>
          </tbody>
        </table>
      </Secao>

      <Secao titulo="ELIMINADOS NO MÊS / RESULTADOS FINAIS">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.primaryHover }}>
              <th style={{ ...th, textAlign: 'left' }}>Professor(a)</th>
              <th style={th}>Evadido</th>
              <th style={th}>Transferido</th>
              <th style={th}>Óbito</th>
              <th style={th}>Nunca comp.</th>
              <th style={th}>Promovido</th>
              <th style={th}>Permanece</th>
              <th style={th}>Reclassificados</th>
            </tr>
          </thead>
          <tbody>
            {resumo.linhas.map(l => (
              <tr key={l.turmaId}>
                <td style={tdEsq}>{l.turmaNome}</td>
                <td style={td}>{l.evadidoMes}</td>
                <td style={td}>{l.transferidoMes}</td>
                <td style={td}>{l.obitoMes}</td>
                <td style={td}>{l.nuncaCompareceuMes}</td>
                <td style={td}>{l.promovido}</td>
                <td style={td}>{l.permanece}</td>
                <td style={td}>{l.reclassificados}</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--footer-row)', fontWeight: 800 }}>
              <td style={tdEsq}>TOTAL</td>
              <td style={td}>{somar('evadidoMes')}</td>
              <td style={td}>{somar('transferidoMes')}</td>
              <td style={td}>{somar('obitoMes')}</td>
              <td style={td}>{somar('nuncaCompareceuMes')}</td>
              <td style={td}>{somar('promovido')}</td>
              <td style={td}>{somar('permanece')}</td>
              <td style={td}>{somar('reclassificados')}</td>
            </tr>
          </tbody>
        </table>
      </Secao>

      <Secao titulo="QUADRO GERAL DE DISTRIBUIÇÃO DOS ALUNOS POR PERÍODO E CICLO">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.primaryHover }}>
              <th style={{ ...th, textAlign: 'left' }}>Ciclo</th>
              {PERIODOS.map(p => <th key={p} style={th} colSpan={2}>{p}</th>)}
            </tr>
            <tr style={{ background: theme.primaryHover }}>
              <th style={th}></th>
              {PERIODOS.map(p => <>
                <th key={p + 'a'} style={th}>Alunos</th>
                <th key={p + 'c'} style={th}>Classes</th>
              </>)}
            </tr>
          </thead>
          <tbody>
            {(['ALFA', 'POS', 'MULTI'] as const).map(ciclo => (
              <tr key={ciclo}>
                <td style={tdEsq}>{CICLO_LABEL[ciclo]}</td>
                {PERIODOS.map(p => <>
                  <td key={p + 'a'} style={td}>{resumo.distribuicaoPorPeriodo[p]?.[ciclo].alunos ?? 0}</td>
                  <td key={p + 'c'} style={td}>{resumo.distribuicaoPorPeriodo[p]?.[ciclo].classes ?? 0}</td>
                </>)}
              </tr>
            ))}
            <tr style={{ background: 'var(--footer-row)', fontWeight: 800 }}>
              <td style={tdEsq}>TOTAL</td>
              {PERIODOS.map(p => {
                const alunosP = (['ALFA', 'POS', 'MULTI'] as const).reduce((s, c) => s + (resumo.distribuicaoPorPeriodo[p]?.[c].alunos ?? 0), 0);
                const classesP = (['ALFA', 'POS', 'MULTI'] as const).reduce((s, c) => s + (resumo.distribuicaoPorPeriodo[p]?.[c].classes ?? 0), 0);
                return <>
                  <td key={p + 'a'} style={td}>{alunosP}</td>
                  <td key={p + 'c'} style={td}>{classesP}</td>
                </>;
              })}
            </tr>
          </tbody>
        </table>
      </Secao>

      <Secao titulo="FAIXA ETÁRIA">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.primaryHover }}>
              <th style={{ ...th, textAlign: 'left' }}>Faixa etária</th>
              <th style={th}>Atendimento</th>
              <th style={th}>Evasão</th>
              <th style={th}>Nunca comp.</th>
            </tr>
          </thead>
          <tbody>
            {resumo.faixaEtaria.map(f => (
              <tr key={f.label}>
                <td style={tdEsq}>{f.label}</td>
                <td style={td}>{f.atendimento}</td>
                <td style={td}>{f.evasao}</td>
                <td style={td}>{f.nuncaComp}</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--footer-row)', fontWeight: 800 }}>
              <td style={tdEsq}>Total EJA I</td>
              <td style={td}>{resumo.faixaEtaria.reduce((s, f) => s + f.atendimento, 0)}</td>
              <td style={td}>{resumo.faixaEtaria.reduce((s, f) => s + f.evasao, 0)}</td>
              <td style={td}>{resumo.faixaEtaria.reduce((s, f) => s + f.nuncaComp, 0)}</td>
            </tr>
          </tbody>
        </table>
      </Secao>

      <Secao titulo="CONFERÊNCIA MANUAL — ÓBITO, MEDIDA SOCIOEDUCATIVA, REMATRÍCULA E RESULTADO FINAL">
        <p style={{ padding: '10px 14px 0', fontSize: 12, color: theme.textSecondary }}>
          O CADE não é lançado aqui — é automático, calculado a partir da coluna "Deficiência" abaixo, que já vem da SED.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.primaryHover }}>
              <th style={{ ...th, textAlign: 'left' }}>Aluno</th>
              <th style={{ ...th, textAlign: 'left' }}>Deficiência</th>
              <th style={th}>Óbito</th>
              <th style={th}>Medida socioeducativa</th>
              <th style={th}>Rematrícula</th>
              <th style={th}>Resultado final</th>
            </tr>
          </thead>
          <tbody>
            {turmasEjaOrdenadas.map(turma => {
              const alunosDaTurma = alunosEjaPendentesDados.filter(a => a.turmaId === turma.id);
              if (alunosDaTurma.length === 0) return null;
              return (
                <>
                  <tr key={`grupo-${turma.id}`}>
                    <td colSpan={6} style={{ ...tdEsq, background: theme.primaryHover, color: '#fff', fontWeight: 800 }}>
                      {turma.nome}{turma.professora ? ` — ${turma.professora}` : ''}
                    </td>
                  </tr>
                  {alunosDaTurma.map(a => (
                    <tr key={a.id}>
                      <td style={tdEsq}>{a.nome}</td>
                      <td style={{ ...tdEsq, color: a.deficiencia ? theme.purple : theme.textMuted }}>
                        {a.deficiencia ? `🟣 ${a.deficiencia}` : '—'}
                      </td>
                      <td style={td}>
                        <input type="checkbox" checked={!!a.obito} disabled={salvandoCampo === a.id + 'obito'}
                          onChange={e => atualizarCampoAluno(a.id, 'obito', e.target.checked)} />
                      </td>
                      <td style={td}>
                        <select style={{ ...input, padding: '3px 6px', fontSize: 12 }} value={a.medida_socioeducativa ?? ''}
                          onChange={e => atualizarCampoAluno(a.id, 'medida_socioeducativa', e.target.value || null)}>
                          <option value="">—</option>
                          <option value="LA">L.A.</option>
                          <option value="CRAS">CRAS</option>
                          <option value="CREAS">CREAS</option>
                          <option value="CONSELHO_TUTELAR">Conselho Tutelar</option>
                        </select>
                      </td>
                      <td style={td}>
                        <input type="checkbox" checked={!!a.rematricula} disabled={salvandoCampo === a.id + 'rematricula'}
                          onChange={e => atualizarCampoAluno(a.id, 'rematricula', e.target.checked)} />
                      </td>
                      <td style={td}>
                        <select style={{ ...input, padding: '3px 6px', fontSize: 12 }} value={a.resultado_final ?? ''}
                          onChange={e => atualizarCampoAluno(a.id, 'resultado_final', e.target.value || null)}>
                          <option value="">—</option>
                          <option value="PROMOVIDO">Promovido</option>
                          <option value="PERMANECE">Permanece</option>
                          <option value="CONCLUINTE">Concluinte</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </Secao>

      <Secao titulo="LISTA DE ESPERA">
        <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: `1px solid ${theme.borderLight}` }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input style={input} value={novaEspera.nome} onChange={e => setNovaEspera(v => ({ ...v, nome: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Termo</label>
            <select style={input} value={novaEspera.ciclo} onChange={e => setNovaEspera(v => ({ ...v, ciclo: e.target.value }))}>
              {TERMOS_ESPERA.map(t => <option key={t} value={t}>{CICLO_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Período</label>
            <select style={input} value={novaEspera.periodo} onChange={e => setNovaEspera(v => ({ ...v, periodo: e.target.value }))}>
              {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Telefone/Celular *</label>
            <input style={input} placeholder="(11) 91234-5678" value={novaEspera.telefone}
              onChange={e => setNovaEspera(v => ({ ...v, telefone: e.target.value }))} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={labelStyle}>Observação</label>
            <input style={input} value={novaEspera.observacao} onChange={e => setNovaEspera(v => ({ ...v, observacao: e.target.value }))} />
          </div>
          <button type="button" disabled={salvandoEspera || !novaEspera.nome.trim() || !novaEspera.telefone.trim()} onClick={criarListaEspera}
            className="report-action report-action-primary">
            {salvandoEspera ? 'Salvando…' : '+ Adicionar'}
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.primaryHover }}>
              <th style={{ ...th, textAlign: 'left' }}>Nome</th>
              <th style={th}>Termo</th>
              <th style={th}>Período</th>
              <th style={th}>Telefone/Celular</th>
              <th style={{ ...th, textAlign: 'left' }}>Observação</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {listaEspera.length === 0 && (
              <tr><td style={{ ...td, textAlign: 'left' }} colSpan={6}>Nenhum registro na lista de espera.</td></tr>
            )}
            {listaEspera.map(l => (
              <tr key={l.id}>
                <td style={tdEsq}>{l.nome}</td>
                <td style={td}>{CICLO_LABEL[l.ciclo] ?? l.ciclo}</td>
                <td style={td}>{l.periodo}</td>
                <td style={td}>{l.telefone || '—'}</td>
                <td style={{ ...td, textAlign: 'left' }}>{l.observacao}</td>
                <td style={td}>
                  <button type="button" onClick={() => removerListaEspera(l.id)} className="report-action report-action-danger" style={{ padding: '2px 8px', fontSize: 11 }}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Secao>
    </div>
  );
}
