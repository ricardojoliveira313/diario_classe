import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../api';
import { btn, input, theme } from '../styles';
import { Loading } from '../components';

const FORM_URL = 'https://script.google.com/macros/s/AKfycbxRAI9YowrLP1ffKAV7URQaXWPKaOOV3dqDbxVouD7Q4Jq-lRFJDmVbzbeRahNpDv6STg/exec';
const FICHA_SESSION_KEY = 'censo_docentes_ficha_2026';
const FICHA_NOME_SESSION_KEY = 'censo_docentes_ficha_nome_2026';

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

type Profile = {
  id: string;
  nome: string;
  email?: string | null;
  data_nascimento?: string | null;
  cpf?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cep?: string | null;
  municipio?: string | null;
  estado?: string | null;
  telefone_celular_1?: string | null;
  telefone_celular_2?: string | null;
  telefone_fixo?: string | null;
  cargo_funcao?: string | null;
  horario_trabalho?: string | null;
  registro_funcional_rf?: string | null;
  nome_mae?: string | null;
  nome_pai?: string | null;
  municipio_nascimento?: string | null;
  etnia?: string | null;
  updated_at?: string | null;
};

type Formacao = {
  id: string;
  profile_id: string;
  tipo?: string | null;
  curso?: string | null;
  universidade?: string | null;
  rede_ensino?: string | null;
  modalidade?: string | null;
  inicio?: string | null;
  termino?: string | null;
};

type Turma = {
  id: string;
  nome: string;
  professora?: string | null;
  periodo?: string | null;
  tipo?: string | null;
};

type FichaRow = Record<string, any>;

type LinhaDocente = {
  servidor: Servidor;
  profile: Profile | null;
  ficha: FichaRow | null;
  formacoes: Formacao[];
  turmas: Turma[];
  modalidadeSugerida: string;
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
  posGraduacao: string;
  faltantes: string[];
  completude: number;
  status: 'pronto' | 'pendente' | 'sem_cadastro';
};

function norm(valor: any): string {
  return String(valor ?? '').trim();
}

function soDigitos(valor: any): string {
  return norm(valor).replace(/\D/g, '');
}

function normalizarNome(valor: any): string {
  return norm(valor)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarCabecalho(valor: any): string {
  return normalizarNome(valor).replace(/\s+/g, ' ');
}

function campoFicha(row: FichaRow | null, aliases: string[]): string {
  if (!row) return '';
  const aliasesNorm = aliases.map(normalizarCabecalho);
  for (const [key, value] of Object.entries(row)) {
    const k = normalizarCabecalho(key);
    if (aliasesNorm.some(a => k === a || k.includes(a))) {
      const v = norm(value);
      if (v) return v;
    }
  }
  return '';
}

function primeiro(...valores: any[]): string {
  for (const valor of valores) {
    const v = norm(valor);
    if (v) return v;
  }
  return '';
}

function tokensContidos(nomeCurto: string, nomeCompleto: string): boolean {
  const curtos = normalizarNome(nomeCurto).split(' ').filter(t => t.length > 1);
  const completos = normalizarNome(nomeCompleto).split(' ').filter(Boolean);
  if (!curtos.length || !completos.length) return false;
  return curtos.every(t => completos.includes(t));
}

function ehDocente(cargo: string): boolean {
  const c = normalizarNome(cargo);
  return c.includes('PROFESSOR') || c.startsWith('PROF ') || c.startsWith('PROF.');
}

function sugerirModalidade(servidor: Servidor, turmas: Turma[]): string {
  const cargo = normalizarNome(servidor.cargo);
  const nomes = turmas.map(t => normalizarNome(t.nome));
  const tipos = turmas.map(t => normalizarNome(t.tipo));

  if (cargo.includes('EDUCACAO FISICA')) return 'Educação Física';
  if (cargo.includes('ART')) return 'Arte – Regular';
  if (cargo.includes('ATENDIMENTO EDUCACIONAL ESPECIALIZADO') || tipos.some(t => t === 'AEE')) return 'A conferir (AEE)';
  if (nomes.some(n => n.includes('EJA'))) return 'EJA I';
  if (nomes.some(n => /(^| )1A ETAPA|(^| )2A ETAPA/.test(n))) return 'Educação Infantil';
  if (nomes.some(n => /[1-5]O ANO/.test(n))) return 'Ensino Fundamental Regular';
  return '';
}

function matchTurmas(servidor: Servidor, turmas: Turma[]): Turma[] {
  const atribuida = normalizarNome(servidor.turma_atribuida || servidor.sala_atribuida || '');
  if (atribuida) {
    const exatas = turmas.filter(t => normalizarNome(t.nome) === atribuida);
    if (exatas.length) return exatas;
  }

  return turmas.filter(t => {
    const p = norm(t.professora);
    if (!p) return false;
    return tokensContidos(p, servidor.nome) || tokensContidos(servidor.nome, p);
  });
}

function matchFicha(servidor: Servidor, rows: FichaRow[], cpfConhecido = ''): FichaRow | null {
  const rf = soDigitos(servidor.rf);
  const cpf = soDigitos(cpfConhecido);
  const nome = normalizarNome(servidor.nome);

  for (let i = rows.length - 1; i >= 0; i--) {
    const rowRf = soDigitos(campoFicha(rows[i], ['Registro Funcional (RF)', 'Registro Funcional', 'RF']));
    if (rf && rowRf === rf) return rows[i];
  }
  if (cpf) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const rowCpf = soDigitos(campoFicha(rows[i], ['CPF']));
      if (rowCpf === cpf) return rows[i];
    }
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    const rowNome = normalizarNome(campoFicha(rows[i], ['Nome do Servidor(a)', 'Nome do Servidor', 'Nome Completo', 'Nome']));
    if (rowNome && rowNome === nome) return rows[i];
  }
  return null;
}

function matchProfile(servidor: Servidor, profiles: Profile[], cpfFicha = ''): Profile | null {
  const rf = soDigitos(servidor.rf);
  const cpf = soDigitos(cpfFicha);
  const nome = normalizarNome(servidor.nome);

  const porRf = profiles.find(p => soDigitos(p.registro_funcional_rf) === rf);
  if (porRf) return porRf;
  if (cpf) {
    const porCpf = profiles.find(p => soDigitos(p.cpf) === cpf);
    if (porCpf) return porCpf;
  }
  return profiles.find(p => normalizarNome(p.nome) === nome) ?? null;
}

function mascararCpf(cpf: string): string {
  const d = soDigitos(cpf);
  if (d.length !== 11) return cpf || '—';
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatarRf(rf: string): string {
  const d = soDigitos(rf);
  if (d.length === 6) return `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}`;
  return rf;
}

function Badge({ children, color }: { children: any; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}44`, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function CardResumo({ titulo, valor, detalhe, color }: { titulo: string; valor: string | number; detalhe?: string; color: string }) {
  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radiusMd, padding: '14px 16px', boxShadow: theme.shadow }}>
      <div style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 700, marginBottom: 5 }}>{titulo}</div>
      <div style={{ color, fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{valor}</div>
      {detalhe && <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 6 }}>{detalhe}</div>}
    </div>
  );
}

export default function EducacensoDocentes() {
  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [formacoes, setFormacoes] = useState<Formacao[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [fichaRows, setFichaRows] = useState<FichaRow[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(FICHA_SESSION_KEY) || '[]'); } catch { return []; }
  });
  const [nomeFicha, setNomeFicha] = useState(() => sessionStorage.getItem(FICHA_NOME_SESSION_KEY) || '');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'pronto' | 'pendente' | 'sem_cadastro'>('todos');
  const [selecionadoRf, setSelecionadoRf] = useState('');
  const [aviso, setAviso] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      setErro('');
      const [srv, prof, form, tur] = await Promise.all([
        supabase.from('Servidor').select('rf,nome,cargo,periodo,escola,ativo,turma_atribuida,sala_atribuida').eq('ativo', true).order('nome'),
        supabase.from('profiles').select('id,nome,email,data_nascimento,cpf,endereco,bairro,cep,municipio,estado,telefone_celular_1,telefone_celular_2,telefone_fixo,cargo_funcao,horario_trabalho,registro_funcional_rf,nome_mae,nome_pai,municipio_nascimento,etnia,updated_at').order('updated_at', { ascending: false }),
        supabase.from('formacoes').select('id,profile_id,tipo,curso,universidade,rede_ensino,modalidade,inicio,termino'),
        supabase.from('Turma').select('id,nome,professora,periodo,tipo').order('nome'),
      ]);
      if (!ativo) return;
      const falha = srv.error || prof.error || form.error || tur.error;
      if (falha) {
        setErro(`Não foi possível carregar a base: ${falha.message}`);
      } else {
        setServidores((srv.data ?? []) as Servidor[]);
        setProfiles((prof.data ?? []) as Profile[]);
        setFormacoes((form.data ?? []) as Formacao[]);
        setTurmas((tur.data ?? []) as Turma[]);
      }
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  const linhas = useMemo<LinhaDocente[]>(() => {
    return servidores
      .filter(s => ehDocente(s.cargo))
      .map(servidor => {
        const fichaInicial = matchFicha(servidor, fichaRows);
        const cpfFichaInicial = campoFicha(fichaInicial, ['CPF']);
        const profile = matchProfile(servidor, profiles, cpfFichaInicial);
        const ficha = fichaInicial ?? matchFicha(servidor, fichaRows, profile?.cpf || '');
        const turmasDoProfessor = matchTurmas(servidor, turmas);
        const forms = profile ? formacoes.filter(f => f.profile_id === profile.id) : [];

        const cpf = primeiro(campoFicha(ficha, ['CPF']), profile?.cpf);
        const nascimento = primeiro(campoFicha(ficha, ['Data Nascimento', 'Data de Nascimento']), profile?.data_nascimento);
        const email = primeiro(campoFicha(ficha, ['Endereço de e-mail', 'E-mail', 'Email']), profile?.email);
        const telefone = primeiro(campoFicha(ficha, ['TELEFONE CELULAR 1', 'Telefone Celular 1']), profile?.telefone_celular_1, profile?.telefone_celular_2, profile?.telefone_fixo);
        const endereco = primeiro(campoFicha(ficha, ['Endereço']), profile?.endereco);
        const bairro = primeiro(campoFicha(ficha, ['BAIRRO']), profile?.bairro);
        const cep = primeiro(campoFicha(ficha, ['CEP']), profile?.cep);
        const municipio = primeiro(campoFicha(ficha, ['MUNICÍPIO', 'Municipio']), profile?.municipio);
        const uf = primeiro(campoFicha(ficha, ['ESTADO']), profile?.estado);
        const mae = primeiro(campoFicha(ficha, ['Nome da Mãe', 'Nome da Mae']), profile?.nome_mae);
        const pai = primeiro(campoFicha(ficha, ['Nome do Pai']), profile?.nome_pai);
        const naturalidade = primeiro(campoFicha(ficha, ['Município de Nascimento', 'Municipio de Nascimento']), profile?.municipio_nascimento);
        const etnia = primeiro(campoFicha(ficha, ['Etnia']), profile?.etnia);
        const posGraduacao = primeiro(campoFicha(ficha, ['Informar curso Pós-Graduação', 'Pós-Graduação']), forms.find(f => normalizarNome(f.tipo).includes('POS') || normalizarNome(f.tipo).includes('ESPECIAL'))?.curso);
        const modalidadeSugerida = sugerirModalidade(servidor, turmasDoProfessor);

        const verificacoes: Array<[string, any]> = [
          ['CPF', cpf], ['Data de nascimento', nascimento], ['E-mail', email], ['Telefone', telefone],
          ['Endereço', endereco], ['Bairro', bairro], ['CEP', cep], ['Município', municipio],
          ['Filiação 1', mae], ['Naturalidade', naturalidade], ['Formação acadêmica', forms.length || campoFicha(ficha, ['Favor informar formação acadêmica'])],
          ['Turma/modalidade', turmasDoProfessor.length || modalidadeSugerida],
        ];
        const faltantes = verificacoes.filter(([, v]) => !v).map(([nome]) => nome);
        const preenchidos = verificacoes.length - faltantes.length;
        const completude = Math.round((preenchidos / verificacoes.length) * 100);
        const temCadastro = !!profile || !!ficha;
        const status: LinhaDocente['status'] = !temCadastro ? 'sem_cadastro' : faltantes.length <= 2 ? 'pronto' : 'pendente';

        return {
          servidor, profile, ficha, formacoes: forms, turmas: turmasDoProfessor, modalidadeSugerida,
          cpf, nascimento, email, telefone, endereco, bairro, cep, municipio, uf, mae, pai, naturalidade, etnia, posGraduacao,
          faltantes, completude, status,
        };
      });
  }, [servidores, profiles, formacoes, turmas, fichaRows]);

  const filtradas = useMemo(() => {
    const q = normalizarNome(busca);
    return linhas.filter(l => {
      if (filtro !== 'todos' && l.status !== filtro) return false;
      if (!q) return true;
      const hay = normalizarNome(`${l.servidor.nome} ${l.servidor.rf} ${l.servidor.cargo} ${l.servidor.periodo} ${l.turmas.map(t => t.nome).join(' ')}`);
      return hay.includes(q);
    });
  }, [linhas, busca, filtro]);

  const selecionado = linhas.find(l => soDigitos(l.servidor.rf) === soDigitos(selecionadoRf)) ?? null;

  const resumo = useMemo(() => ({
    total: linhas.length,
    prontos: linhas.filter(l => l.status === 'pronto').length,
    pendentes: linhas.filter(l => l.status === 'pendente').length,
    semCadastro: linhas.filter(l => l.status === 'sem_cadastro').length,
  }), [linhas]);

  const importarFicha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAviso('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<FichaRow>(ws, { defval: '', raw: false });
      if (!rows.length) throw new Error('A planilha não contém respostas.');
      setFichaRows(rows);
      setNomeFicha(file.name);
      try {
        sessionStorage.setItem(FICHA_SESSION_KEY, JSON.stringify(rows));
        sessionStorage.setItem(FICHA_NOME_SESSION_KEY, file.name);
      } catch {
        // Se o navegador limitar o sessionStorage, a importação continua válida na sessão atual.
      }
      setAviso(`Ficha cadastral carregada: ${rows.length} respostas. O RF atual tem prioridade sobre duplicidades históricas.`);
    } catch (err: any) {
      setAviso(`Erro ao importar a ficha cadastral: ${err?.message ?? err}`);
    } finally {
      e.target.value = '';
    }
  };

  const copiarRf = async (rf: string) => {
    const valor = soDigitos(rf);
    try {
      await navigator.clipboard.writeText(valor);
      setAviso(`RF ${valor} copiado. Cole na tela inicial do formulário oficial.`);
    } catch {
      setAviso(`RF para copiar: ${valor}`);
    }
  };

  const abrirFormulario = (rf: string) => {
    const valor = soDigitos(rf);
    window.open(FORM_URL, '_blank', 'noopener,noreferrer');
    copiarRf(valor);
  };

  const limparFicha = () => {
    setFichaRows([]);
    setNomeFicha('');
    sessionStorage.removeItem(FICHA_SESSION_KEY);
    sessionStorage.removeItem(FICHA_NOME_SESSION_KEY);
    setAviso('Ficha importada removida da sessão. A tela continua usando profiles + Servidor + Turmas do Diário.');
  };

  if (loading) return <Loading />;

  return (
    <div style={{ marginTop: 4, animation: 'fadeIn 0.2s ease both' }}>
      <div style={{ background: theme.card, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radiusMd, padding: 20, marginBottom: 16, boxShadow: theme.shadow }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: theme.text, fontSize: 24 }}>👩‍🏫 Censo Docentes 2026</h1>
            <p style={{ margin: '7px 0 0', color: theme.textSecondary, lineHeight: 1.5, maxWidth: 820 }}>
              Cruzamento do cadastro funcional atual com a ficha cadastral, formações e turmas do Diário. Amanhã a folha de frequência entra como validação final dos vínculos em exercício.
            </p>
          </div>
          <Badge color={theme.primary}>EMEIEF LUIZ GONZAGA</Badge>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importarFicha} />
          <button style={btn('primary')} onClick={() => fileRef.current?.click()}>📥 Importar ficha cadastral</button>
          {nomeFicha && <button style={btn('ghost')} onClick={limparFicha}>Remover ficha importada</button>}
          <a href={FORM_URL} target="_blank" rel="noopener noreferrer" style={{ ...btn('sky'), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>🔗 Abrir formulário oficial</a>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 7, color: theme.textSecondary, fontSize: 12 }}>
          <div><strong>Base do Diário:</strong> Servidor ativo + Turmas + profiles + formacoes.</div>
          <div><strong>Ficha desta sessão:</strong> {nomeFicha ? `${nomeFicha} (${fichaRows.length} respostas)` : 'ainda não importada nesta sessão — clique acima para usar a planilha mais recente.'}</div>
          <div><strong>Folha de frequência:</strong> ⏳ pendente para amanhã; será a última validação antes da fila definitiva.</div>
        </div>
        {aviso && <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 8, background: `${theme.primary}12`, border: `1px solid ${theme.primary}33`, color: theme.text, fontSize: 12 }}>{aviso}</div>}
        {erro && <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 8, background: `${theme.danger}12`, border: `1px solid ${theme.danger}33`, color: theme.danger, fontSize: 12 }}>{erro}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <CardResumo titulo="Docentes ativos" valor={resumo.total} detalhe="Cadastro funcional" color={theme.primary} />
        <CardResumo titulo="Quase prontos" valor={resumo.prontos} detalhe="Até 2 pendências objetivas" color={theme.success} />
        <CardResumo titulo="Com pendências" valor={resumo.pendentes} detalhe="Exigem complemento/conferência" color={theme.warning} />
        <CardResumo titulo="Sem cadastro localizado" valor={resumo.semCadastro} detalhe="Sem profile/ficha correspondente" color={theme.danger} />
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radiusMd, padding: 16, marginBottom: 16, boxShadow: theme.shadow }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 190px', gap: 10 }}>
          <input style={{ ...input, width: '100%' }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar professor, RF, cargo ou turma..." />
          <select style={{ ...input, width: '100%' }} value={filtro} onChange={e => setFiltro(e.target.value as any)}>
            <option value="todos">Todos os docentes</option>
            <option value="pronto">Quase prontos</option>
            <option value="pendente">Com pendências</option>
            <option value="sem_cadastro">Sem cadastro localizado</option>
          </select>
        </div>
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radiusMd, overflow: 'hidden', boxShadow: theme.shadow }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
            <thead>
              <tr style={{ background: theme.bg }}>
                {['Professor', 'RF ativo', 'CPF', 'Período', 'Turma / atuação', 'Modalidade sugerida', 'Completude', 'Situação', 'Ações'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 9px', color: theme.textSecondary, fontSize: 11, borderBottom: `1px solid ${theme.borderLight}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(l => {
                const statusColor = l.status === 'pronto' ? theme.success : l.status === 'pendente' ? theme.warning : theme.danger;
                const statusLabel = l.status === 'pronto' ? 'Quase pronto' : l.status === 'pendente' ? 'Pendente' : 'Sem cadastro';
                return (
                  <tr key={`${l.servidor.rf}-${l.servidor.nome}`} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                    <td style={{ padding: '10px 9px', color: theme.text, fontSize: 12, fontWeight: 650 }}>
                      <button onClick={() => setSelecionadoRf(l.servidor.rf)} style={{ border: 0, background: 'transparent', color: theme.primary, padding: 0, cursor: 'pointer', fontWeight: 750, textAlign: 'left' }}>{l.servidor.nome}</button>
                      <div style={{ color: theme.textMuted, fontSize: 10, marginTop: 3 }}>{l.servidor.cargo}</div>
                    </td>
                    <td style={{ padding: '10px 9px', color: theme.text, fontSize: 12, fontWeight: 750 }}>{formatarRf(l.servidor.rf)}</td>
                    <td style={{ padding: '10px 9px', color: theme.textSecondary, fontSize: 12 }}>{mascararCpf(l.cpf)}</td>
                    <td style={{ padding: '10px 9px', color: theme.textSecondary, fontSize: 12 }}>{l.servidor.periodo || '—'}</td>
                    <td style={{ padding: '10px 9px', color: theme.textSecondary, fontSize: 12 }}>{l.turmas.length ? l.turmas.map(t => t.nome).join(', ') : '⚠️ Não vinculada'}</td>
                    <td style={{ padding: '10px 9px', color: theme.textSecondary, fontSize: 12 }}>{l.modalidadeSugerida || '⚠️ A conferir'}</td>
                    <td style={{ padding: '10px 9px', minWidth: 105 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ flex: 1, height: 6, background: theme.borderLight, borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${l.completude}%`, height: '100%', background: l.completude >= 80 ? theme.success : l.completude >= 55 ? theme.warning : theme.danger }} /></div>
                        <span style={{ color: theme.textSecondary, fontSize: 11, fontWeight: 700 }}>{l.completude}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 9px' }}><Badge color={statusColor}>{statusLabel}</Badge></td>
                    <td style={{ padding: '10px 9px', whiteSpace: 'nowrap' }}>
                      <button style={{ ...btn('ghost', { small: true }), marginRight: 5 }} onClick={() => setSelecionadoRf(l.servidor.rf)}>Ver</button>
                      <button style={btn('sky', { small: true })} onClick={() => abrirFormulario(l.servidor.rf)}>Abrir + RF</button>
                    </td>
                  </tr>
                );
              })}
              {!filtradas.length && <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center', color: theme.textMuted }}>Nenhum docente encontrado neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selecionado && (
        <div style={{ marginTop: 16, background: theme.card, border: `1px solid ${theme.primary}55`, borderRadius: theme.radiusMd, padding: 18, boxShadow: theme.shadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, color: theme.text, fontSize: 19 }}>{selecionado.servidor.nome}</h2>
              <div style={{ color: theme.textSecondary, marginTop: 4, fontSize: 12 }}>RF atual: <strong>{formatarRf(selecionado.servidor.rf)}</strong> · {selecionado.servidor.periodo || 'período não informado'} · {selecionado.servidor.cargo}</div>
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button style={btn('ghost', { small: true })} onClick={() => copiarRf(selecionado.servidor.rf)}>Copiar RF</button>
              <button style={btn('primary', { small: true })} onClick={() => abrirFormulario(selecionado.servidor.rf)}>Abrir formulário oficial</button>
              <button style={btn('ghost', { small: true })} onClick={() => setSelecionadoRf('')}>Fechar</button>
            </div>
          </div>

          <div style={{ marginTop: 15, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
            {[
              ['CPF', selecionado.cpf, selecionado.ficha ? 'Ficha cadastral' : selecionado.profile ? 'profiles' : 'Ausente'],
              ['Data de nascimento', selecionado.nascimento, selecionado.ficha ? 'Ficha / profiles' : 'profiles'],
              ['E-mail', selecionado.email, selecionado.ficha ? 'Ficha cadastral' : 'profiles'],
              ['Telefone', selecionado.telefone, selecionado.ficha ? 'Ficha cadastral' : 'profiles'],
              ['Endereço', selecionado.endereco, selecionado.ficha ? 'Ficha cadastral' : 'profiles'],
              ['Bairro / CEP', `${selecionado.bairro || '—'} / ${selecionado.cep || '—'}`, selecionado.ficha ? 'Ficha cadastral' : 'profiles'],
              ['Município / UF', `${selecionado.municipio || '—'} / ${selecionado.uf || '—'}`, selecionado.ficha ? 'Ficha cadastral' : 'profiles'],
              ['Filiação 1', selecionado.mae, selecionado.ficha ? 'Ficha cadastral' : 'profiles'],
              ['Filiação 2', selecionado.pai, selecionado.ficha ? 'Ficha cadastral' : 'profiles'],
              ['Naturalidade', selecionado.naturalidade, selecionado.ficha ? 'Ficha cadastral' : 'profiles'],
              ['Etnia (não converter automaticamente para Cor/Raça)', selecionado.etnia, selecionado.ficha ? 'Ficha cadastral' : 'profiles'],
              ['Pós-graduação', selecionado.posGraduacao, selecionado.ficha ? 'Ficha / formações' : 'formações'],
            ].map(([rotulo, valor, fonte]) => (
              <div key={rotulo} style={{ border: `1px solid ${theme.borderLight}`, borderRadius: 9, padding: 11, background: theme.bg }}>
                <div style={{ color: theme.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{rotulo}</div>
                <div style={{ color: valor && valor !== '— / —' ? theme.text : theme.danger, fontSize: 13, fontWeight: 650, marginTop: 4, wordBreak: 'break-word' }}>{valor || '⚠️ Não localizado'}</div>
                <div style={{ color: theme.textMuted, fontSize: 10, marginTop: 5 }}>Fonte: {fonte}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            <div style={{ border: `1px solid ${theme.borderLight}`, borderRadius: 9, padding: 12 }}>
              <div style={{ color: theme.text, fontWeight: 750, fontSize: 12, marginBottom: 7 }}>🏫 Atuação atual no Diário</div>
              <div style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 1.7 }}>
                <div><strong>Turma(s):</strong> {selecionado.turmas.length ? selecionado.turmas.map(t => `${t.nome}${t.periodo ? ` (${t.periodo})` : ''}`).join(', ') : '⚠️ não localizada automaticamente'}</div>
                <div><strong>Modalidade sugerida:</strong> {selecionado.modalidadeSugerida || '⚠️ a conferir'}</div>
                <div><strong>Escola funcional:</strong> {selecionado.servidor.escola || '—'}</div>
              </div>
            </div>
            <div style={{ border: `1px solid ${theme.borderLight}`, borderRadius: 9, padding: 12 }}>
              <div style={{ color: theme.text, fontWeight: 750, fontSize: 12, marginBottom: 7 }}>🎓 Formação encontrada</div>
              {selecionado.formacoes.length ? selecionado.formacoes.map(f => (
                <div key={f.id} style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 1.55, marginBottom: 6 }}>
                  <strong>{f.tipo || 'Formação'}:</strong> {f.curso || 'curso não informado'}{f.universidade ? ` — ${f.universidade}` : ''}
                </div>
              )) : <div style={{ color: theme.warning, fontSize: 12 }}>Nenhuma formação vinculada ao profile localizado. Conferir a ficha cadastral.</div>}
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, borderRadius: 9, background: selecionado.faltantes.length ? `${theme.warning}10` : `${theme.success}10`, border: `1px solid ${selecionado.faltantes.length ? theme.warning : theme.success}33` }}>
            <div style={{ color: theme.text, fontSize: 12, fontWeight: 750 }}>Pendências objetivas antes do formulário oficial</div>
            <div style={{ color: theme.textSecondary, fontSize: 12, marginTop: 5 }}>
              {selecionado.faltantes.length ? selecionado.faltantes.join(' · ') : 'Nenhuma pendência objetiva nas fontes já cruzadas.'}
            </div>
            <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 7 }}>
              Sexo, Cor/Raça, deficiência/TEA, nacionalidade e a declaração final continuam sujeitos à conferência/autodeclaração; o sistema não deduz esses campos.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
