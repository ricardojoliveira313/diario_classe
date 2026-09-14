import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../api';
import { btn, input, theme } from '../styles';
import { Loading } from '../components';

const FORM_URL = 'https://script.google.com/macros/s/AKfycbxRAI9YowrLP1ffKAV7URQaXWPKaOOV3dqDbxVouD7Q4Jq-lRFJDmVbzbeRahNpDv6STg/exec';
const FICHA_KEY = 'censo_docentes_ficha_2026';
const FICHA_NOME_KEY = 'censo_docentes_ficha_nome_2026';

type Servidor = {
  rf: string;
  nome: string;
  cargo: string;
  periodo: string;
  escola: string;
  ativo: boolean;
  turma_atribuida?: string | null;
  sala_atribuida?: string | null;
};

type Frequencia = {
  ano: number;
  mes: number;
  rf: string;
  nome: string;
  categoria?: string | null;
  lotacao?: string | null;
  cargo?: string | null;
  carga_horaria?: number | null;
  local_trabalho?: string | null;
  pagina_pdf?: number | null;
};

type Turma = {
  id: string;
  nome: string;
  professora?: string | null;
  periodo?: string | null;
  tipo?: string | null;
};

type FichaRow = Record<string, any>;
type Status = 'pronto' | 'pendente' | 'sem_cadastro';

type Linha = {
  servidor: Servidor;
  frequencia: Frequencia;
  ficha: FichaRow | null;
  turmas: Turma[];
  modalidade: string;
  cpf: string;
  nascimento: string;
  email: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  mae: string;
  pai: string;
  naturalidade: string;
  etnia: string;
  formacao: string;
  pos: string;
  faltantes: string[];
  completude: number;
  status: Status;
  vinculosMesmoNome: number;
};

const txt = (v: any) => String(v ?? '').trim();
const dig = (v: any) => txt(v).replace(/\D/g, '');
const norm = (v: any) => txt(v)
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function campo(row: FichaRow | null, aliases: string[]): string {
  if (!row) return '';
  const entries = Object.entries(row).map(([k, v]) => [norm(k), txt(v)] as const);
  for (const alias of aliases.map(norm)) {
    const achou = entries.find(([k, v]) => k === alias && !!v);
    if (achou) return achou[1];
  }
  return '';
}

function ehDocente(cargo: string): boolean {
  const c = norm(cargo);
  return c.includes('PROFESSOR') || /^PROF\b/.test(c);
}

function contemNome(curto: string, completo: string): boolean {
  const a = norm(curto).split(' ').filter(t => t.length > 1);
  const b = norm(completo).split(' ').filter(Boolean);
  return !!a.length && a.every(t => b.includes(t));
}

function turmasDoServidor(s: Servidor, turmas: Turma[]): Turma[] {
  const atribuida = norm(s.turma_atribuida || s.sala_atribuida || '');
  if (atribuida) {
    const porAtribuicao = turmas.filter(t => norm(t.nome) === atribuida);
    if (porAtribuicao.length) return porAtribuicao;
  }

  return turmas.filter(t => {
    const p = txt(t.professora);
    return !!p && (contemNome(p, s.nome) || contemNome(s.nome, p));
  });
}

function modalidadeSugerida(s: Servidor, f: Frequencia, turmas: Turma[]): string {
  const cargo = norm(f.cargo || s.cargo);
  const lotacao = norm(f.lotacao);
  const nomes = turmas.map(t => norm(t.nome));

  if (cargo.includes('EDUCACAO FISICA')) return 'Educação Física';
  if (cargo.includes('ART')) return 'Arte – Regular';
  if (cargo.includes('ATENDIMENTO EDUCACIONAL ESPECIALIZADO') || turmas.some(t => norm(t.tipo) === 'AEE')) return 'A conferir (AEE)';
  if (lotacao.includes('EJA') || nomes.some(n => n.includes('EJA'))) return 'EJA I';
  if (lotacao.includes('PRE ESCOLA') || nomes.some(n => /^[12] ETAPA\b/.test(n))) return 'Educação Infantil';
  if (nomes.some(n => /^[1-5] ANO\b/.test(n))) return 'Ensino Fundamental Regular';
  return '';
}

function fichaDoServidor(s: Servidor, rows: FichaRow[], nomeAmbiguo: boolean): FichaRow | null {
  const rf = dig(s.rf);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rf && dig(campo(rows[i], ['Registro Funcional (RF)', 'Registro Funcional', 'RF'])) === rf) return rows[i];
  }

  if (nomeAmbiguo) return null;

  const nome = norm(s.nome);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (norm(campo(rows[i], ['Nome do Servidor(a)', 'Nome do Servidor', 'Nome Completo'])) === nome) return rows[i];
  }
  return null;
}

function formatRf(rf: string): string {
  const d = dig(rf);
  return d.length === 6 ? `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}` : rf;
}

function maskCpf(cpf: string): string {
  const d = dig(cpf);
  return d.length === 11 ? `***.***.${d.slice(6, 9)}-${d.slice(9)}` : (cpf || '—');
}

function Badge({ status }: { status: Status }) {
  const [label, cor] = status === 'pronto'
    ? ['Quase pronto', theme.success]
    : status === 'pendente'
      ? ['Pendente', theme.warning]
      : ['Sem ficha', theme.danger];

  return (
    <span style={{
      color: cor,
      background: `${cor}18`,
      border: `1px solid ${cor}55`,
      borderRadius: 999,
      padding: '4px 9px',
      fontWeight: 800,
      fontSize: 11,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function Resumo({ titulo, valor, cor, sub }: { titulo: string; valor: number; cor: string; sub: string }) {
  return (
    <div style={{
      background: theme.card,
      border: `1px solid ${theme.border}`,
      borderRadius: theme.radiusMd,
      padding: '15px 16px',
      boxShadow: theme.shadow,
    }}>
      <div style={{ color: theme.textSecondary, fontSize: 11, fontWeight: 800 }}>{titulo}</div>
      <div style={{ color: cor, fontSize: 28, fontWeight: 900, marginTop: 5, lineHeight: 1 }}>{valor}</div>
      <div style={{ color: theme.textMuted, fontSize: 10.5, marginTop: 7 }}>{sub}</div>
    </div>
  );
}

function gerarCsv(linhas: Linha[]) {
  const cab = ['Nome', 'RF', 'Período', 'Turma/atuação', 'Modalidade', 'Carga horária', 'Página frequência', 'Completude', 'Pendências'];
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const corpo = linhas.map(l => [
    l.servidor.nome,
    dig(l.servidor.rf),
    l.servidor.periodo,
    l.turmas.map(t => t.nome).join(' | '),
    l.modalidade,
    l.frequencia.carga_horaria ?? '',
    l.frequencia.pagina_pdf ?? '',
    `${l.completude}%`,
    l.faltantes.join(' | '),
  ].map(esc).join(';'));

  const blob = new Blob(['\ufeff' + [cab.map(esc).join(';'), ...corpo].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'censo_docentes_2026_validado_frequencia.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function EducacensoDocentes() {
  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [frequencias, setFrequencias] = useState<Frequencia[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [ficha, setFicha] = useState<FichaRow[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(FICHA_KEY) || '[]'); } catch { return []; }
  });
  const [nomeFicha, setNomeFicha] = useState(() => sessionStorage.getItem(FICHA_NOME_KEY) || '');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | Status>('todos');
  const [rfSelecionado, setRfSelecionado] = useState('');
  const [mostrarFora, setMostrarFora] = useState(false);
  const [extensaoAtiva, setExtensaoAtiva] = useState(false);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.source === window && ev.data?.source === 'censo-extension' && ['ready', 'prepared'].includes(ev.data?.type)) {
        setExtensaoAtiva(true);
      }
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ source: 'diario-censo', type: 'ping' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    let montado = true;
    (async () => {
      setLoading(true);
      setErro('');

      const [srv, freq, tur] = await Promise.all([
        supabase.from('ServidorCenso')
          .select('rf,nome,cargo,periodo,escola,ativo,turma_atribuida,sala_atribuida')
          .order('nome'),
        supabase.from('CensoFrequenciaServidor')
          .select('ano,mes,rf,nome,categoria,lotacao,cargo,carga_horaria,local_trabalho,pagina_pdf')
          .eq('ano', 2026)
          .eq('mes', 9)
          .order('pagina_pdf'),
        supabase.from('Turma')
          .select('id,nome,professora,periodo,tipo')
          .order('nome'),
      ]);

      if (!montado) return;
      const falha = srv.error || freq.error || tur.error;
      if (falha) {
        setErro(`Erro ao carregar as bases: ${falha.message}`);
      } else {
        setServidores((srv.data ?? []) as Servidor[]);
        setFrequencias((freq.data ?? []) as Frequencia[]);
        setTurmas((tur.data ?? []) as Turma[]);
      }
      setLoading(false);
    })();

    return () => { montado = false; };
  }, []);

  const docentesFreq = useMemo(
    () => frequencias.filter(f => ehDocente(f.cargo || '')),
    [frequencias],
  );

  const nomesDuplicados = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of docentesFreq) {
      const k = norm(f.nome);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [docentesFreq]);

  const servidorPorRf = useMemo(() => {
    const m = new Map<string, Servidor>();
    for (const s of servidores) m.set(dig(s.rf), s);
    return m;
  }, [servidores]);

  const foraDaFrequencia = useMemo(() => {
    const rfFreq = new Set(docentesFreq.map(f => dig(f.rf)));
    return servidores
      .filter(s => ehDocente(s.cargo))
      .filter(s => !rfFreq.has(dig(s.rf)))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [servidores, docentesFreq]);

  const linhas = useMemo<Linha[]>(() => docentesFreq.map(freq => {
    const servidor = servidorPorRf.get(dig(freq.rf)) ?? {
      rf: freq.rf,
      nome: freq.nome,
      cargo: freq.cargo || '',
      periodo: '',
      escola: freq.local_trabalho || 'EMEIEF LUIZ GONZAGA',
      ativo: true,
      turma_atribuida: '',
      sala_atribuida: '',
    };

    const duplicidadeNome = (nomesDuplicados.get(norm(freq.nome)) ?? 0) > 1;
    const f = fichaDoServidor(servidor, ficha, duplicidadeNome);
    const ts = turmasDoServidor(servidor, turmas);
    const modalidade = modalidadeSugerida(servidor, freq, ts);

    const cpf = campo(f, ['CPF:', 'CPF']);
    const nascimento = campo(f, ['Data Nascimento', 'Data de Nascimento']);
    const email = campo(f, ['Endereço de e-mail', 'E-mail', 'Email']);
    const telefone = campo(f, ['TELEFONE CELULAR 1:', 'TELEFONE CELULAR 1', 'Telefone Celular 1']);
    const endereco = campo(f, ['Endereço:', 'Endereço']);
    const bairro = campo(f, ['BAIRRO:', 'BAIRRO']);
    const cep = campo(f, ['CEP:', 'CEP']);
    const municipio = campo(f, ['MUNICÍPIO:', 'MUNICÍPIO', 'Municipio']);
    const uf = campo(f, ['ESTADO']);
    const mae = campo(f, ['Nome da Mãe', 'Nome da Mae']);
    const pai = campo(f, ['Nome do Pai']);
    const naturalidade = campo(f, ['Município de Nascimento:', 'Município de Nascimento', 'Municipio de Nascimento']);
    const etnia = campo(f, ['Etnia']);
    const formacao = campo(f, [
      'Favor informar formação acadêmica:',
      'Favor informar formação acadêmica',
      'Favor informar formação acadêmica: [Linha 2]',
    ]);
    const pos = campo(f, ['Informar curso Pós-Graduação', 'Pós-Graduação']);

    const checks: Array<[string, any]> = [
      ['CPF', cpf],
      ['Nascimento', nascimento],
      ['E-mail', email],
      ['Telefone', telefone],
      ['Endereço', endereco],
      ['Bairro', bairro],
      ['CEP', cep],
      ['Município', municipio],
      ['Filiação 1', mae],
      ['Naturalidade', naturalidade],
      ['Formação', formacao],
      ['Turma/modalidade', ts.length || modalidade],
    ];

    const faltantes = checks.filter(([, v]) => !v).map(([k]) => k);
    const completude = Math.round(((checks.length - faltantes.length) / checks.length) * 100);
    const status: Status = !f ? 'sem_cadastro' : faltantes.length <= 2 ? 'pronto' : 'pendente';

    return {
      servidor,
      frequencia: freq,
      ficha: f,
      turmas: ts,
      modalidade,
      cpf,
      nascimento,
      email,
      telefone,
      endereco,
      bairro,
      cep,
      municipio,
      uf,
      mae,
      pai,
      naturalidade,
      etnia,
      formacao,
      pos,
      faltantes,
      completude,
      status,
      vinculosMesmoNome: nomesDuplicados.get(norm(freq.nome)) ?? 1,
    };
  }), [docentesFreq, servidorPorRf, nomesDuplicados, ficha, turmas]);

  const filtradas = useMemo(() => {
    const q = norm(busca);
    return linhas.filter(l => {
      if (filtro !== 'todos' && l.status !== filtro) return false;
      if (!q) return true;
      return norm([
        l.servidor.nome,
        l.servidor.rf,
        l.servidor.cargo,
        l.servidor.periodo,
        l.frequencia.lotacao,
        l.turmas.map(t => t.nome).join(' '),
      ].join(' ')).includes(q);
    });
  }, [linhas, filtro, busca]);

  const selecionado = linhas.find(l => dig(l.servidor.rf) === dig(rfSelecionado)) ?? null;

  const resumo = useMemo(() => ({
    folhas: frequencias.length,
    docentes: linhas.length,
    pronto: linhas.filter(l => l.status === 'pronto').length,
    pendente: linhas.filter(l => l.status === 'pendente').length,
    sem: linhas.filter(l => l.status === 'sem_cadastro').length,
  }), [frequencias, linhas]);

  const importarFicha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const rows = XLSX.utils.sheet_to_json<FichaRow>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      if (!rows.length) throw new Error('Nenhuma resposta encontrada na primeira aba.');

      setFicha(rows);
      setNomeFicha(file.name);
      try {
        sessionStorage.setItem(FICHA_KEY, JSON.stringify(rows));
        sessionStorage.setItem(FICHA_NOME_KEY, file.name);
      } catch {}

      setAviso(`Ficha carregada: ${rows.length} respostas. RF é a chave principal; nome só é usado quando não há ambiguidade.`);
    } catch (err: any) {
      setAviso(`Erro ao importar a ficha: ${err?.message ?? err}`);
    } finally {
      e.target.value = '';
    }
  };

  const copiarRf = async (rf: string) => {
    const valor = dig(rf);
    try {
      await navigator.clipboard.writeText(valor);
      setAviso(`RF ${valor} copiado.`);
    } catch {
      setAviso(`RF atual: ${valor}`);
    }
  };

  const payloadOficial = (l: Linha) => ({
    version: 1,
    criadoEm: new Date().toISOString(),
    rf: dig(l.servidor.rf),
    nome: l.servidor.nome,
    unidade: 'EMEIEF LUIZ GONZAGA',
    modalidade: l.modalidade,
    periodo: l.servidor.periodo,
    turma: l.turmas.map(t => t.nome).join(', '),
    cpf: l.cpf,
    nascimento: l.nascimento,
    telefone: l.telefone,
    email: l.email,
    filiacao1: l.mae,
    filiacao2: l.pai,
    naturalidade: l.naturalidade,
    cep: l.cep,
    endereco: l.endereco,
    bairro: l.bairro,
    municipio: l.municipio,
    uf: l.uf,
    formacao: l.formacao,
    posGraduacao: l.pos,
  });

  const preencherOficial = (l: Linha) => {
    const payload = payloadOficial(l);
    window.postMessage({ source: 'diario-censo', type: 'prepare', payload }, '*');
    try { localStorage.setItem('censo_autofill_preview', JSON.stringify(payload)); } catch {}

    if (!extensaoAtiva) {
      void copiarRf(l.servidor.rf);
      setAviso('Extensão de autopreenchimento não detectada. O formulário foi aberto e o RF foi copiado como fallback.');
    } else {
      setAviso('Pacote enviado à extensão. O formulário oficial será aberto, validado pelo RF e preenchido sem envio automático.');
    }

    setTimeout(() => window.open(FORM_URL, '_blank', 'noopener,noreferrer'), 120);
  };

  const removerFicha = () => {
    setFicha([]);
    setNomeFicha('');
    sessionStorage.removeItem(FICHA_KEY);
    sessionStorage.removeItem(FICHA_NOME_KEY);
    setAviso('Ficha removida desta sessão.');
  };

  if (loading) return <Loading />;

  return (
    <div style={{ marginTop: 4 }}>
      <section style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radiusMd,
        boxShadow: theme.shadow,
        padding: 20,
        marginBottom: 15,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: theme.text, fontSize: 24 }}>👩‍🏫 Censo Docentes 2026</h1>
            <p style={{ color: theme.textSecondary, margin: '7px 0 0', maxWidth: 860, lineHeight: 1.55 }}>
              Frequência oficial de setembro + cadastro funcional + ficha cadastral + turmas do Diário.
              A folha de frequência agora é a validação principal dos vínculos efetivamente presentes na unidade.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{ color: theme.primaryText, background: 'var(--ghost-bg)', border: `1px solid ${theme.border}`, borderRadius: 999, padding: '6px 10px', fontSize: 11, fontWeight: 850 }}>
              EMEIEF LUIZ GONZAGA
            </span>
            <span style={{
              color: extensaoAtiva ? theme.success : theme.warning,
              background: extensaoAtiva ? `${theme.success}18` : `${theme.warning}18`,
              border: `1px solid ${extensaoAtiva ? theme.success : theme.warning}55`,
              borderRadius: 999,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 850,
            }}>
              {extensaoAtiva ? '🤖 Autopreenchimento ativo' : '🧩 Autopreenchimento não detectado'}
            </span>
          </div>
        </div>

        <input id="censo-ficha-file" type="file" accept=".xlsx,.xls" onChange={importarFicha} style={{ display: 'none' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <label htmlFor="censo-ficha-file" style={{ ...btn('primary'), cursor: 'pointer' }}>📥 Importar ficha cadastral</label>
          {nomeFicha && <button style={btn('ghost')} onClick={removerFicha}>Remover ficha</button>}
          <button style={btn('success')} onClick={() => gerarCsv(linhas)}>⬇ Exportar conferência CSV</button>
          <a href={FORM_URL} target="_blank" rel="noopener noreferrer" style={{ ...btn('sky'), textDecoration: 'none' }}>🔗 Formulário oficial</a>
        </div>

        <div style={{ color: theme.textSecondary, fontSize: 11.5, lineHeight: 1.85, marginTop: 11 }}>
          <div><strong>Frequência:</strong> setembro/2026 carregada no sistema — {frequencias.length} folhas, {docentesFreq.length} vínculos docentes.</div>
          <div><strong>Ficha cadastral:</strong> {nomeFicha ? `${nomeFicha} — ${ficha.length} respostas` : 'ainda não importada nesta sessão.'}</div>
          <div><strong>Regra:</strong> a lista principal vem da frequência; o cadastro funcional complementa período/turma e a ficha fornece os dados pessoais.</div>
        </div>

        {aviso && <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--ghost-bg)', border: `1px solid ${theme.border}`, color: theme.text, fontSize: 11.5 }}>{aviso}</div>}
        {erro && <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: `${theme.danger}12`, border: `1px solid ${theme.danger}44`, color: theme.danger, fontSize: 11.5 }}>{erro}</div>}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 9, marginBottom: 14 }}>
        <Resumo titulo="Folhas de frequência" valor={resumo.folhas} cor={theme.primaryText} sub="Setembro/2026" />
        <Resumo titulo="Docentes confirmados" valor={resumo.docentes} cor={theme.success} sub="Presentes na frequência" />
        <Resumo titulo="Com pendências" valor={resumo.pendente} cor={theme.warning} sub="Complementar/conferir" />
        <Resumo titulo="Sem ficha" valor={resumo.sem} cor={theme.danger} sub="Importar ficha cadastral" />
        <Resumo titulo="Fora da frequência" valor={foraDaFrequencia.length} cor={foraDaFrequencia.length ? theme.warning : theme.success} sub="Ativos no cadastro, ausentes no PDF" />
      </div>

      {foraDaFrequencia.length > 0 && (
        <section style={{ background: theme.card, border: `1px solid ${theme.warning}55`, borderRadius: theme.radiusMd, padding: 12, marginBottom: 14 }}>
          <button
            onClick={() => setMostrarFora(v => !v)}
            style={{ border: 0, background: 'transparent', color: theme.warning, fontWeight: 850, cursor: 'pointer', padding: 0 }}
          >
            ⚠️ {foraDaFrequencia.length} vínculo(s) docente(s) ainda marcado(s) como ativo(s) no cadastro funcional, mas sem folha de setembro {mostrarFora ? '▲' : '▼'}
          </button>
          {mostrarFora && (
            <div style={{ marginTop: 9, display: 'grid', gap: 6 }}>
              {foraDaFrequencia.map(s => (
                <div key={s.rf} style={{ background: 'var(--ghost-bg)', borderRadius: 8, padding: '8px 10px', color: theme.textSecondary, fontSize: 11.5 }}>
                  <strong style={{ color: theme.text }}>{s.nome}</strong> — RF {formatRf(s.rf)} — {s.cargo} — {s.periodo || 'período não informado'}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radiusMd, boxShadow: theme.shadow, padding: 13, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) 190px', gap: 9 }}>
          <input style={{ ...input, width: '100%' }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar professor, RF, cargo, turma..." />
          <select style={{ ...input, width: '100%' }} value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)}>
            <option value="todos">Todos</option>
            <option value="pronto">Quase prontos</option>
            <option value="pendente">Pendentes</option>
            <option value="sem_cadastro">Sem ficha</option>
          </select>
        </div>
      </section>

      <section style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radiusMd, boxShadow: theme.shadow, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1110 }}>
            <thead>
              <tr style={{ background: 'var(--ghost-bg)' }}>
                {['Professor', 'RF', 'Frequência', 'Período', 'Turma/atuação', 'Modalidade', 'Dados', 'Situação', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '11px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 10.5, borderBottom: `1px solid ${theme.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l, idx) => (
                <tr key={`${l.servidor.rf}-${l.servidor.nome}`} style={{ borderBottom: `1px solid ${theme.borderLight}`, background: idx % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)' }}>
                  <td style={{ padding: '10px 8px', fontSize: 12 }}>
                    <button
                      onClick={() => setRfSelecionado(l.servidor.rf)}
                      style={{ border: 0, background: 'transparent', padding: 0, color: theme.primaryText, cursor: 'pointer', fontWeight: 850, textAlign: 'left', fontSize: 12 }}
                    >
                      {l.servidor.nome}
                    </button>
                    <div style={{ color: theme.textMuted, fontSize: 9.5, marginTop: 3 }}>{l.frequencia.cargo || l.servidor.cargo}</div>
                    {l.vinculosMesmoNome > 1 && (
                      <div style={{ color: theme.warning, fontSize: 9.5, marginTop: 3, fontWeight: 800 }}>
                        ⚠️ {l.vinculosMesmoNome} RFs ativos na frequência — tratar por vínculo
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', color: theme.text, fontWeight: 850, fontSize: 12 }}>{formatRf(l.servidor.rf)}</td>
                  <td style={{ padding: '10px 8px', color: theme.success, fontSize: 11, fontWeight: 800 }}>
                    ✓ pág. {l.frequencia.pagina_pdf ?? '—'}<div style={{ color: theme.textMuted, fontSize: 9.5, marginTop: 2 }}>{l.frequencia.carga_horaria ?? '—'} h</div>
                  </td>
                  <td style={{ padding: '10px 8px', color: theme.textSecondary, fontSize: 11 }}>{l.servidor.periodo || '—'}</td>
                  <td style={{ padding: '10px 8px', color: theme.textSecondary, fontSize: 11 }}>{l.turmas.length ? l.turmas.map(t => t.nome).join(', ') : '⚠️ conferir'}</td>
                  <td style={{ padding: '10px 8px', color: theme.textSecondary, fontSize: 11 }}>{l.modalidade || '⚠️ conferir'}</td>
                  <td style={{ padding: '10px 8px', minWidth: 105 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ height: 7, flex: 1, borderRadius: 9, background: 'var(--ghost-bg)', overflow: 'hidden', border: `1px solid ${theme.borderLight}` }}>
                        <div style={{ height: '100%', width: `${l.completude}%`, background: l.completude >= 80 ? theme.success : l.completude >= 55 ? theme.warning : theme.danger }} />
                      </div>
                      <span style={{ fontSize: 10, color: theme.textSecondary, fontWeight: 850 }}>{l.completude}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 8px' }}><Badge status={l.status} /></td>
                  <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                    <button style={{ ...btn('ghost', { small: true }), marginRight: 4 }} onClick={() => setRfSelecionado(l.servidor.rf)}>Ver</button>
                    <button style={btn('sky', { small: true })} onClick={() => preencherOficial(l)}>{extensaoAtiva ? 'Preencher oficial' : 'Abrir + RF'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtradas.length && <div style={{ padding: 28, color: theme.textMuted, textAlign: 'center' }}>Nenhum docente encontrado.</div>}
      </section>

      {selecionado && (
        <section style={{ marginTop: 14, background: theme.card, border: `1px solid ${theme.primaryText}`, borderRadius: theme.radiusMd, boxShadow: theme.shadow, padding: 17 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, color: theme.text, fontSize: 18 }}>{selecionado.servidor.nome}</h2>
              <div style={{ marginTop: 5, color: theme.textSecondary, fontSize: 11.5 }}>
                RF <strong>{formatRf(selecionado.servidor.rf)}</strong> · {selecionado.servidor.periodo || 'período não informado'} ·
                frequência pág. {selecionado.frequencia.pagina_pdf ?? '—'} · carga {selecionado.frequencia.carga_horaria ?? '—'} h
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={btn('ghost', { small: true })} onClick={() => copiarRf(selecionado.servidor.rf)}>Copiar RF</button>
              <button style={btn('primary', { small: true })} onClick={() => preencherOficial(selecionado)}>Preencher oficial</button>
              <button style={btn('ghost', { small: true })} onClick={() => setRfSelecionado('')}>Fechar</button>
            </div>
          </div>

          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: `${theme.success}10`, border: `1px solid ${theme.success}44`, color: theme.textSecondary, fontSize: 11.5 }}>
            <strong style={{ color: theme.text }}>Validação funcional:</strong> este RF consta na folha de frequência oficial de setembro/2026.
            <div style={{ marginTop: 4 }}><strong style={{ color: theme.text }}>Lotação:</strong> {selecionado.frequencia.lotacao || '—'}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8, marginTop: 13 }}>
            {[
              ['CPF', selecionado.cpf],
              ['Nascimento', selecionado.nascimento],
              ['E-mail', selecionado.email],
              ['Telefone', selecionado.telefone],
              ['Endereço', selecionado.endereco],
              ['Bairro / CEP', `${selecionado.bairro || '—'} / ${selecionado.cep || '—'}`],
              ['Município / UF', `${selecionado.municipio || '—'} / ${selecionado.uf || '—'}`],
              ['Filiação 1', selecionado.mae],
              ['Filiação 2', selecionado.pai],
              ['Naturalidade', selecionado.naturalidade],
              ['Etnia — referência; não converter em Cor/Raça', selecionado.etnia],
              ['Formação', selecionado.formacao],
              ['Pós-graduação', selecionado.pos],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: 'var(--ghost-bg)' }}>
                <div style={{ color: theme.textMuted, fontSize: 9, fontWeight: 850, textTransform: 'uppercase' }}>{k}</div>
                <div style={{ color: v && v !== '— / —' ? theme.text : theme.danger, marginTop: 4, fontSize: 12, fontWeight: 680, wordBreak: 'break-word' }}>
                  {v || '⚠️ não localizado'}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 9, padding: 10, borderRadius: 8, border: `1px solid ${selecionado.faltantes.length ? theme.warning : theme.success}55`, background: `${selecionado.faltantes.length ? theme.warning : theme.success}0F`, color: theme.textSecondary, fontSize: 11.5 }}>
            <strong style={{ color: theme.text }}>Atuação:</strong> {selecionado.turmas.length ? selecionado.turmas.map(t => `${t.nome}${t.periodo ? ` (${t.periodo})` : ''}`).join(', ') : '⚠️ conferir'}
            {' · '}
            <strong style={{ color: theme.text }}>Modalidade:</strong> {selecionado.modalidade || '⚠️ conferir'}
            <div style={{ marginTop: 6 }}><strong style={{ color: theme.text }}>Pendências:</strong> {selecionado.faltantes.length ? selecionado.faltantes.join(' · ') : 'nenhuma nas fontes cruzadas.'}</div>
            <div style={{ color: theme.textMuted, marginTop: 5 }}>
              Sexo, Cor/Raça, deficiência/TEA, nacionalidade e a declaração final não são deduzidos. O autopreenchimento nunca envia o formulário sozinho.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
