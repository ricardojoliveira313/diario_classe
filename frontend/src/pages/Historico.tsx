import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../api';
import { btn, input, label, theme } from '../styles';

interface TurmaHistorico {
  nome: string;
  professora: string | null;
  periodo: string | null;
}

interface AlunoHistorico {
  id: string;
  ra: number;
  nome: string;
  data_nascimento: string | null;
  cpf: string | null;
  situacao: string | null;
  turmaId: string | null;
  data_inicio_matricula: string | null;
  data_fim_matricula: string | null;
  Turma: TurmaHistorico | null;
}

interface LinhaCiclo {
  ciclo: number;
  label: string;
  anoLetivo: string;
  cargaHoraria: string;
  escola: string;
  municipio: string;
  uf: string;
  resultado: string;
}

interface HistoricoSalvo {
  ciclo: number;
  ano_letivo: string | null;
  carga_horaria: string | null;
  escola: string | null;
  municipio: string | null;
  uf: string | null;
  resultado: string | null;
  cert_num: string | null;
  cert_folha: string | null;
  cert_livro: string | null;
  cert_distrito: string | null;
  cidade_nasc: string | null;
  estado_nasc: string | null;
}

const CICLOS_LABELS = [
  '1º Ano / Inicial',
  '2º Ano / Intermediário',
  '3º Ano / Final',
  '4º Ano / Final (2º ciclo)',
  '5º Ano / Final (2º ciclo)',
];

const ESCOLA_PADRAO = 'EMEIEF LUIZ GONZAGA';
const MUN_PADRAO = 'Santo André';
const DIRETOR = 'Terezinha Babichaka Squiavoni';
const CARGO_DIRETOR = 'Diretora de Unidade Escolar';

const OBSERVACOES_LEGAIS =
  'O Sistema Continuado de Ensino, conforme deliberação CEE 9/97, indicação 22/97 das Escolas Municipais de Santo André prevê avaliação contínua, cumulativa e sistemática, através da síntese de desempenho do aluno. A verificação do rendimento escolar não prevê notas. O Curso de Ensino Fundamental Regular mantido pela Secretaria de Educação do Município de Santo André está organizado em dois ciclos: 1º ciclo (1º, 2º e 3º ano); 2º ciclo (4º e 5º ano). Carga Horária Anual mínima de 1000 horas, distribuídas em 200 dias letivos. A organização do 1º ao 5º ano foi adotada a partir de 2011 (Deliberação CME nº.03/2010). O referido curso equivale às cinco primeiras séries iniciais do Ensino Fundamental de 09 anos.';

function criarLinhasVazias(): LinhaCiclo[] {
  return CICLOS_LABELS.map((labelCiclo, index) => ({
    ciclo: index + 1,
    label: labelCiclo,
    anoLetivo: '',
    cargaHoraria: '1000',
    escola: '',
    municipio: '',
    uf: 'SP',
    resultado: '',
  }));
}

function detectarCiclo(nomeTurma: string): number | null {
  const normalizado = nomeTurma
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, ' ');
  const ano = normalizado.match(/\b([1-5])\b.*ANO/);
  if (ano) return Number(ano[1]);
  if (/ALFABET/.test(normalizado) && !/POS.{0,5}ALFABET/.test(normalizado)) return 1;
  if (/POS.{0,5}ALFABET/.test(normalizado)) return 2;
  if (/1.*(ETAPA|CICLO)|INICIAL/.test(normalizado)) return 1;
  if (/2.*(ETAPA|CICLO)|INTERMEDIAR/.test(normalizado)) return 2;
  return null;
}

function isAtivo(situacao: string | null): boolean {
  return !situacao || situacao === 'ATIVO';
}

function isTurmaAEE(turma: TurmaHistorico | null): boolean {
  const nome = turma?.nome?.toUpperCase() ?? '';
  return nome.includes('AEE') || nome.includes('ATENDIMENTO');
}

function formatarData(data: string | null): string {
  if (!data) return '';
  const iso = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return data;
}

const estiloSecao: CSSProperties = {
  border: '1px solid #111827',
  marginTop: 10,
  padding: 10,
};

const estiloTituloSecao: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
};

const estiloCampoImpressao: CSSProperties = {
  border: 'none',
  borderBottom: '1px solid #6b7280',
  borderRadius: 0,
  background: 'transparent',
  color: '#111827',
  padding: '2px 3px',
  minWidth: 0,
  width: '100%',
};

export default function Historico() {
  const [raInput, setRaInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aluno, setAluno] = useState<AlunoHistorico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [totalFaltas, setTotalFaltas] = useState(0);
  const [linhas, setLinhas] = useState<LinhaCiclo[]>(criarLinhasVazias);
  const [dataEmissao, setDataEmissao] = useState(new Date().toLocaleDateString('pt-BR'));
  const [certNum, setCertNum] = useState('');
  const [certFolha, setCertFolha] = useState('');
  const [certLivro, setCertLivro] = useState('');
  const [certDistrito, setCertDistrito] = useState('');
  const [cidadeNasc, setCidadeNasc] = useState('SANTO ANDRÉ');
  const [estadoNasc, setEstadoNasc] = useState('SP');
  const printRef = useRef<HTMLDivElement>(null);

  const limparCamposComplementares = () => {
    setCertNum('');
    setCertFolha('');
    setCertLivro('');
    setCertDistrito('');
    setCidadeNasc('SANTO ANDRÉ');
    setEstadoNasc('SP');
  };

  const buscarPorRA = async () => {
    const ra = Number.parseInt(raInput.trim(), 10);
    if (Number.isNaN(ra)) {
      setErro('Digite um RA válido.');
      return;
    }

    setCarregando(true);
    setErro(null);
    setAviso(null);
    setSucesso(null);
    setAluno(null);
    setTotalFaltas(0);
    setLinhas(criarLinhasVazias());
    limparCamposComplementares();

    try {
      const { data: rows, error: alunoError } = await supabase
        .from('Aluno')
        .select(`ra, nome, data_nascimento, cpf, situacao,
                 turmaId, data_inicio_matricula, data_fim_matricula, id,
                 Turma:turmaId ( nome, professora, periodo )`)
        .eq('ra', ra);

      if (alunoError) throw new Error(`Não foi possível buscar o aluno: ${alunoError.message}`);
      if (!rows || rows.length === 0) {
        setErro(`Aluno com RA ${ra} não encontrado no sistema.`);
        return;
      }

      const candidatos = rows
        .filter(row => row.situacao !== 'REMA')
        .map(row => ({
          ...row,
          Turma: Array.isArray(row.Turma) ? (row.Turma[0] ?? null) : (row.Turma ?? null),
        })) as AlunoHistorico[];
      const baseSelecao = candidatos.length > 0
        ? candidatos
        : rows.map(row => ({
            ...row,
            Turma: Array.isArray(row.Turma) ? (row.Turma[0] ?? null) : (row.Turma ?? null),
          })) as AlunoHistorico[];
      const selecionado =
        baseSelecao.find(row => isAtivo(row.situacao) && !isTurmaAEE(row.Turma)) ??
        baseSelecao.find(row => isAtivo(row.situacao)) ??
        baseSelecao.find(row => !isTurmaAEE(row.Turma)) ??
        baseSelecao[0];

      if (rows.length === 1 && isTurmaAEE(selecionado.Turma)) {
        setAviso('O único cadastro encontrado está vinculado a uma turma AEE/Atendimento. Confira os dados antes de emitir o histórico.');
      }

      const [faltasResult, historicoResult] = await Promise.all([
        supabase.from('Falta').select('faltas').eq('alunoId', selecionado.id),
        supabase.from('HistoricoAluno').select('*').eq('ra', ra).order('ciclo'),
      ]);

      if (faltasResult.error) {
        throw new Error(`Não foi possível carregar as faltas: ${faltasResult.error.message}`);
      }
      if (historicoResult.error) {
        throw new Error(`Não foi possível carregar o histórico: ${historicoResult.error.message}`);
      }

      const total = (faltasResult.data ?? []).reduce(
        (soma, falta) => soma + Number(falta.faltas ?? 0),
        0,
      );
      const historico = (historicoResult.data ?? []) as HistoricoSalvo[];
      const primeiraLinha = historico[0];
      if (primeiraLinha) {
        setCertNum(primeiraLinha.cert_num ?? '');
        setCertFolha(primeiraLinha.cert_folha ?? '');
        setCertLivro(primeiraLinha.cert_livro ?? '');
        setCertDistrito(primeiraLinha.cert_distrito ?? '');
        setCidadeNasc(primeiraLinha.cidade_nasc ?? 'SANTO ANDRÉ');
        setEstadoNasc(primeiraLinha.estado_nasc ?? 'SP');
      }

      const cicloAtual = detectarCiclo(selecionado.Turma?.nome ?? '');
      const anoMatricula = selecionado.data_inicio_matricula?.slice(0, 4) ?? '';
      const novasLinhas = CICLOS_LABELS.map((labelCiclo, index): LinhaCiclo => {
        const ciclo = index + 1;
        const salva = historico.find(item => item.ciclo === ciclo);
        if (salva) {
          return {
            ciclo,
            label: labelCiclo,
            anoLetivo: salva.ano_letivo ?? '',
            cargaHoraria: salva.carga_horaria ?? (salva.ano_letivo === '2020' ? '800' : '1000'),
            escola: salva.escola ?? '',
            municipio: salva.municipio ?? '',
            uf: salva.uf ?? 'SP',
            resultado: salva.resultado ?? '',
          };
        }
        const ehCicloAtual = ciclo === cicloAtual;
        return {
          ciclo,
          label: labelCiclo,
          anoLetivo: ehCicloAtual ? anoMatricula : '',
          cargaHoraria: anoMatricula === '2020' && ehCicloAtual ? '800' : '1000',
          escola: ehCicloAtual ? ESCOLA_PADRAO : '',
          municipio: ehCicloAtual ? MUN_PADRAO : '',
          uf: 'SP',
          resultado: '',
        };
      });

      setAluno(selecionado);
      setTotalFaltas(total);
      setLinhas(novasLinhas);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar o histórico escolar.');
    } finally {
      setCarregando(false);
    }
  };

  const atualizarLinha = (index: number, campo: keyof Omit<LinhaCiclo, 'ciclo' | 'label'>, valor: string) => {
    setLinhas(atuais => atuais.map((linha, posicao) => {
      if (posicao !== index) return linha;
      if (campo === 'anoLetivo' && valor === '2020') {
        return { ...linha, anoLetivo: valor, cargaHoraria: '800' };
      }
      return { ...linha, [campo]: valor };
    }));
  };

  const salvarHistorico = async (): Promise<boolean> => {
    if (!aluno) return false;
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    const certFields = {
      cert_num: certNum || null,
      cert_folha: certFolha || null,
      cert_livro: certLivro || null,
      cert_distrito: certDistrito || null,
      cidade_nasc: cidadeNasc || null,
      estado_nasc: estadoNasc || null,
    };
    const registros = linhas.map(linha => ({
      ra: aluno.ra,
      ciclo: linha.ciclo,
      ano_letivo: linha.anoLetivo || null,
      carga_horaria: linha.cargaHoraria || null,
      escola: linha.escola || null,
      municipio: linha.municipio || null,
      uf: linha.uf || null,
      resultado: linha.resultado || null,
      ...certFields,
    }));

    const { error } = await supabase
      .from('HistoricoAluno')
      .upsert(registros, { onConflict: 'ra,ciclo' });
    setSalvando(false);

    if (error) {
      setErro(`Não foi possível salvar o histórico: ${error.message}`);
      return false;
    }
    setSucesso('Histórico salvo com sucesso.');
    return true;
  };

  const imprimir = async () => {
    const salvo = await salvarHistorico();
    if (salvo) window.print();
  };

  const mostrarResultado = linhas.some(linha => linha.resultado.trim() !== '');
  const mostrarCertificado = Boolean(aluno && isAtivo(aluno.situacao) && linhas[4]?.anoLetivo.trim());
  const presencas = Math.max(0, 200 - totalFaltas);

  return (
    <div style={{ marginTop: 16 }}>
      <style>{`
        .historico-tabela { width: 100%; border-collapse: collapse; }
        .historico-tabela th, .historico-tabela td { border: 1px solid #111827; padding: 5px; vertical-align: top; }
        .historico-grid-aluno { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px 14px; }
        .historico-grid-certidao { display: grid; grid-template-columns: 2fr 1fr 1fr 2fr; gap: 8px; }
        @media (max-width: 720px) {
          .historico-grid-aluno, .historico-grid-certidao { grid-template-columns: 1fr; }
          .historico-tabela-wrap { overflow-x: auto; }
        }
        @media print {
          body { visibility: hidden; }
          #historico-doc {
            visibility: visible;
            position: fixed;
            top: 0;
            left: 0;
            font-family: Arial, sans-serif;
            font-size: 10pt;
            color: black;
            width: 180mm;
            background: white;
          }
          #historico-doc * { visibility: visible; }
          @page { size: A4; margin: 15mm 15mm 12mm 15mm; }
          .linha-vazia { display: none !important; }
          table, .sec-impressao { break-inside: avoid; }
          .nao-imprimir { display: none !important; }
          input, select {
            border: none !important;
            outline: none !important;
            background: transparent !important;
            color: black !important;
            font-size: 10pt !important;
          }
        }
      `}</style>

      <section style={{ background: theme.card, borderRadius: theme.radiusMd, boxShadow: theme.shadow, padding: 20, marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>📜 Histórico Escolar</h1>
        <p style={{ margin: '0 0 16px', color: theme.textSecondary }}>
          Busque o aluno pelo RA, confira os dados, complete os anos cursados e imprima o documento oficial.
        </p>
        <form
          onSubmit={event => { event.preventDefault(); void buscarPorRA(); }}
          style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 260px' }}>
            <label htmlFor="historico-ra" style={label}>R.A. do aluno</label>
            <input
              id="historico-ra"
              inputMode="numeric"
              style={input}
              value={raInput}
              onChange={event => setRaInput(event.target.value)}
              placeholder="Digite o RA"
              aria-describedby="historico-mensagem"
            />
          </div>
          <button type="submit" disabled={carregando} style={btn('primary')}>
            {carregando ? '⏳ Buscando...' : '🔎 Buscar aluno'}
          </button>
        </form>
        <div id="historico-mensagem" aria-live="polite">
          {erro && <p style={{ color: theme.danger, margin: '12px 0 0' }}>⚠️ {erro}</p>}
          {aviso && <p style={{ color: theme.warningHover, margin: '12px 0 0' }}>⚠️ {aviso}</p>}
          {sucesso && <p style={{ color: theme.success, margin: '12px 0 0' }}>✅ {sucesso}</p>}
        </div>
      </section>

      {aluno && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { void salvarHistorico(); }} disabled={salvando} style={btn('success')}>
              {salvando ? '⏳ Salvando...' : '💾 Salvar'}
            </button>
            <button type="button" onClick={() => { void imprimir(); }} disabled={salvando} style={btn('primary')}>
              🖨️ Salvar e imprimir
            </button>
          </div>

          <div
            id="historico-doc"
            ref={printRef}
            style={{ background: '#fff', color: '#111827', padding: 18, borderRadius: theme.radius, boxShadow: theme.shadow }}
          >
            <header style={{ textAlign: 'center', border: '2px solid #111827', padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>PREFEITURA MUNICIPAL DE SANTO ANDRÉ</div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>SECRETARIA DE EDUCAÇÃO</div>
              <h2 style={{ fontSize: 19, margin: '8px 0' }}>HISTÓRICO ESCOLAR</h2>
              <div style={{ fontWeight: 800 }}>{ESCOLA_PADRAO}</div>
              <div>Rua Ipanema nº 253 · Parque Erasmo Assunção · Santo André/SP</div>
              <div>Fone: 3356-7961 / 3356-7962</div>
            </header>

            <section className="sec-impressao" style={estiloSecao}>
              <h3 style={estiloTituloSecao}>01 — Dados do aluno</h3>
              <div className="historico-grid-aluno">
                <div><strong>Nome:</strong> {aluno.nome || '—'}</div>
                <div><strong>R.A.:</strong> {aluno.ra || '—'}</div>
                <div><strong>Nascimento:</strong> {formatarData(aluno.data_nascimento) || '—'}</div>
                <label style={{ margin: 0 }}>
                  <strong>Cidade de nascimento</strong>
                  <input style={estiloCampoImpressao} value={cidadeNasc} onChange={event => setCidadeNasc(event.target.value)} />
                </label>
                <label style={{ margin: 0 }}>
                  <strong>UF</strong>
                  <input maxLength={2} style={estiloCampoImpressao} value={estadoNasc} onChange={event => setEstadoNasc(event.target.value.toUpperCase())} />
                </label>
                <div><strong>Situação:</strong> {aluno.situacao || 'ATIVO'}</div>
              </div>
            </section>

            <section className="sec-impressao" style={estiloSecao}>
              <h3 style={estiloTituloSecao}>02 — Certidão de nascimento</h3>
              <div className="historico-grid-certidao">
                <label style={{ margin: 0 }}><strong>Número</strong><input style={estiloCampoImpressao} value={certNum} onChange={event => setCertNum(event.target.value)} /></label>
                <label style={{ margin: 0 }}><strong>Folha</strong><input style={estiloCampoImpressao} value={certFolha} onChange={event => setCertFolha(event.target.value)} /></label>
                <label style={{ margin: 0 }}><strong>Livro</strong><input style={estiloCampoImpressao} value={certLivro} onChange={event => setCertLivro(event.target.value)} /></label>
                <label style={{ margin: 0 }}><strong>Distrito</strong><input style={estiloCampoImpressao} value={certDistrito} onChange={event => setCertDistrito(event.target.value)} /></label>
              </div>
            </section>

            <section className="sec-impressao" style={estiloSecao}>
              <h3 style={estiloTituloSecao}>03 — Ciclos escolares</h3>
              {!mostrarResultado && (
                <div className="nao-imprimir" style={{ marginBottom: 10, padding: 10, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>Resultado/nota de outra rede (opcional)</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    {linhas.map((linha, index) => (
                      <label key={linha.ciclo} style={{ fontSize: 11 }}>
                        {linha.label}
                        <input
                          aria-label={`Resultado do ${linha.label}`}
                          placeholder="Ex.: Aprovado ou 7,5"
                          style={{ ...estiloCampoImpressao, marginTop: 3 }}
                          value={linha.resultado}
                          onChange={event => atualizarLinha(index, 'resultado', event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="historico-tabela-wrap">
                <table className="historico-tabela">
                  <thead>
                    <tr>
                      <th>Ciclo/Ano</th>
                      <th>Ano letivo</th>
                      <th>Carga horária</th>
                      <th>Escola</th>
                      <th>Município</th>
                      <th>UF</th>
                      {mostrarResultado && <th>Resultado</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((linha, index) => {
                      const vazia = !linha.anoLetivo.trim() && !linha.escola.trim() && !linha.municipio.trim();
                      return (
                        <tr key={linha.ciclo} className={vazia ? 'linha-vazia' : undefined}>
                          <td style={{ minWidth: 120, fontWeight: 700 }}>{linha.label}</td>
                          <td><input aria-label={`Ano letivo do ${linha.label}`} style={estiloCampoImpressao} value={linha.anoLetivo} onChange={event => atualizarLinha(index, 'anoLetivo', event.target.value)} /></td>
                          <td><input aria-label={`Carga horária do ${linha.label}`} style={estiloCampoImpressao} value={linha.cargaHoraria} onChange={event => atualizarLinha(index, 'cargaHoraria', event.target.value)} /></td>
                          <td><input aria-label={`Escola do ${linha.label}`} style={estiloCampoImpressao} value={linha.escola} onChange={event => atualizarLinha(index, 'escola', event.target.value)} /></td>
                          <td><input aria-label={`Município do ${linha.label}`} style={estiloCampoImpressao} value={linha.municipio} onChange={event => atualizarLinha(index, 'municipio', event.target.value)} /></td>
                          <td><input aria-label={`UF do ${linha.label}`} maxLength={2} style={estiloCampoImpressao} value={linha.uf} onChange={event => atualizarLinha(index, 'uf', event.target.value.toUpperCase())} /></td>
                          {mostrarResultado && <td><input aria-label={`Resultado do ${linha.label}`} style={estiloCampoImpressao} value={linha.resultado} onChange={event => atualizarLinha(index, 'resultado', event.target.value)} /></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {aluno.situacao === 'TRAN' && (
              <section className="sec-impressao" style={estiloSecao}>
                <h3 style={estiloTituloSecao}>05 — Transferência</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div><strong>Dias letivos:</strong> 200</div>
                  <div><strong>Faltas:</strong> {totalFaltas}</div>
                  <div><strong>Presenças:</strong> {presencas}</div>
                  <div><strong>Data de saída:</strong> {formatarData(aluno.data_fim_matricula) || '—'}</div>
                </div>
              </section>
            )}

            <section className="sec-impressao" style={estiloSecao}>
              <h3 style={estiloTituloSecao}>06 — Observações legais</h3>
              <p style={{ margin: 0, textAlign: 'justify', lineHeight: 1.35 }}>{OBSERVACOES_LEGAIS}</p>
            </section>

            {mostrarCertificado && (
              <section className="sec-impressao" style={estiloSecao}>
                <h3 style={estiloTituloSecao}>Certificado de conclusão</h3>
                <p style={{ margin: 0, textAlign: 'justify', lineHeight: 1.45 }}>
                  O diretor da {ESCOLA_PADRAO}, de acordo com o inciso VII do artigo 24 da Lei 9.394/96,
                  certifica que <strong>{aluno.nome}</strong> concluiu o 5º Ano do Ensino Fundamental,
                  no ano letivo de <strong>{linhas[4].anoLetivo}</strong>.
                </p>
              </section>
            )}

            <footer className="sec-impressao" style={{ marginTop: 18, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginBottom: 44 }}>
                <strong>Santo André,</strong>
                <input
                  aria-label="Data de emissão"
                  style={{ ...estiloCampoImpressao, width: 110, textAlign: 'center' }}
                  value={dataEmissao}
                  onChange={event => setDataEmissao(event.target.value)}
                />
              </div>
              <div style={{ width: 320, maxWidth: '80%', margin: '0 auto', borderTop: '1px solid #111827', paddingTop: 5 }}>
                <strong>{DIRETOR}</strong><br />
                {CARGO_DIRETOR}
              </div>
              <div style={{ marginTop: 20, fontWeight: 800 }}>ESTE DOCUMENTO NÃO CONTÉM EMENDA NEM RASURA</div>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}
