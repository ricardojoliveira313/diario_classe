import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../api';
import { btn, input, theme } from '../styles';
import { Loading } from '../components';

const FORM_URL = 'https://script.google.com/macros/s/AKfycbxRAI9YowrLP1ffKAV7URQaXWPKaOOV3dqDbxVouD7Q4Jq-lRFJDmVbzbeRahNpDv6STg/exec';
const FICHA_KEY = 'censo_docentes_ficha_2026';
const FICHA_NOME_KEY = 'censo_docentes_ficha_nome_2026';

type Servidor = {
  rf: string; nome: string; cargo: string; periodo: string; escola: string; ativo: boolean;
  turma_atribuida?: string | null; sala_atribuida?: string | null;
};
type Profile = {
  id: string; nome: string; email?: string | null; data_nascimento?: string | null; cpf?: string | null;
  endereco?: string | null; bairro?: string | null; cep?: string | null; municipio?: string | null; estado?: string | null;
  telefone_celular_1?: string | null; telefone_celular_2?: string | null; telefone_fixo?: string | null;
  registro_funcional_rf?: string | null; nome_mae?: string | null; nome_pai?: string | null;
  municipio_nascimento?: string | null; etnia?: string | null; updated_at?: string | null;
};
type Formacao = {
  id: string; profile_id: string; tipo?: string | null; curso?: string | null; universidade?: string | null;
  rede_ensino?: string | null; modalidade?: string | null; inicio?: string | null; termino?: string | null;
};
type Turma = { id: string; nome: string; professora?: string | null; periodo?: string | null; tipo?: string | null };
type FichaRow = Record<string, any>;
type Status = 'pronto' | 'pendente' | 'sem_cadastro';

type Linha = {
  servidor: Servidor; profile: Profile | null; ficha: FichaRow | null; formacoes: Formacao[]; turmas: Turma[];
  modalidade: string; cpf: string; nascimento: string; email: string; telefone: string; endereco: string;
  bairro: string; cep: string; municipio: string; uf: string; mae: string; pai: string; naturalidade: string;
  etnia: string; pos: string; faltantes: string[]; completude: number; status: Status;
};

const txt = (v: any) => String(v ?? '').trim();
const dig = (v: any) => txt(v).replace(/\D/g, '');
const norm = (v: any) => txt(v).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function campo(row: FichaRow | null, aliases: string[]): string {
  if (!row) return '';
  const entries = Object.entries(row).map(([k, v]) => [norm(k), txt(v)] as const);
  for (const alias of aliases.map(norm)) {
    const achou = entries.find(([k, v]) => k === alias && !!v);
    if (achou) return achou[1];
  }
  return '';
}

function primeiro(...values: any[]): string {
  for (const v of values) if (txt(v)) return txt(v);
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

function modalidadeSugerida(s: Servidor, turmas: Turma[]): string {
  const cargo = norm(s.cargo);
  const nomes = turmas.map(t => norm(t.nome));
  if (cargo.includes('EDUCACAO FISICA')) return 'Educação Física';
  if (cargo.includes('ART')) return 'Arte – Regular';
  if (cargo.includes('ATENDIMENTO EDUCACIONAL ESPECIALIZADO') || turmas.some(t => norm(t.tipo) === 'AEE')) return 'A conferir (AEE)';
  if (nomes.some(n => n.includes('EJA'))) return 'EJA I';
  if (nomes.some(n => /^[12] ETAPA\b/.test(n))) return 'Educação Infantil';
  if (nomes.some(n => /^[1-5] ANO\b/.test(n))) return 'Ensino Fundamental Regular';
  return '';
}

function fichaDoServidor(s: Servidor, rows: FichaRow[], cpfConhecido = ''): FichaRow | null {
  const rf = dig(s.rf), cpf = dig(cpfConhecido), nome = norm(s.nome);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rf && dig(campo(rows[i], ['Registro Funcional (RF)', 'Registro Funcional', 'RF'])) === rf) return rows[i];
  }
  if (cpf) {
    for (let i = rows.length - 1; i >= 0; i--) if (dig(campo(rows[i], ['CPF:', 'CPF'])) === cpf) return rows[i];
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    if (norm(campo(rows[i], ['Nome do Servidor(a)', 'Nome do Servidor', 'Nome Completo'])) === nome) return rows[i];
  }
  return null;
}

function profileDoServidor(s: Servidor, profiles: Profile[], cpfFicha = ''): Profile | null {
  const rf = dig(s.rf), cpf = dig(cpfFicha), nome = norm(s.nome);
  return profiles.find(p => dig(p.registro_funcional_rf) === rf)
    ?? (cpf ? profiles.find(p => dig(p.cpf) === cpf) : undefined)
    ?? profiles.find(p => norm(p.nome) === nome)
    ?? null;
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
  const cfg = status === 'pronto'
    ? ['Quase pronto', theme.success]
    : status === 'pendente'
      ? ['Pendente', theme.warning]
      : ['Sem cadastro', theme.danger];
  return <span style={{ color: cfg[1], background: `${cfg[1]}15`, border: `1px solid ${cfg[1]}44`, borderRadius: 999, padding: '3px 8px', fontWeight: 750, fontSize: 11, whiteSpace: 'nowrap' }}>{cfg[0]}</span>;
}

function Resumo({ titulo, valor, cor, sub }: { titulo: string; valor: number; cor: string; sub: string }) {
  return <div style={{ background: theme.card, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radiusMd, padding: 14, boxShadow: theme.shadow }}>
    <div style={{ color: theme.textSecondary, fontSize: 11, fontWeight: 750 }}>{titulo}</div>
    <div style={{ color: cor, fontSize: 27, fontWeight: 850, marginTop: 4 }}>{valor}</div>
    <div style={{ color: theme.textMuted, fontSize: 10, marginTop: 3 }}>{sub}</div>
  </div>;
}

export default function EducacensoDocentes() {
  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [formacoes, setFormacoes] = useState<Formacao[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [ficha, setFicha] = useState<FichaRow[]>(() => { try { return JSON.parse(sessionStorage.getItem(FICHA_KEY) || '[]'); } catch { return []; } });
  const [nomeFicha, setNomeFicha] = useState(() => sessionStorage.getItem(FICHA_NOME_KEY) || '');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | Status>('todos');
  const [rfSelecionado, setRfSelecionado] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let montado = true;
    (async () => {
      setLoading(true);
      const [srv, prof, form, tur] = await Promise.all([
        supabase.from('Servidor').select('rf,nome,cargo,periodo,escola,ativo,turma_atribuida,sala_atribuida').eq('ativo', true).order('nome'),
        supabase.from('profiles').select('id,nome,email,data_nascimento,cpf,endereco,bairro,cep,municipio,estado,telefone_celular_1,telefone_celular_2,telefone_fixo,registro_funcional_rf,nome_mae,nome_pai,municipio_nascimento,etnia,updated_at').order('updated_at', { ascending: false }),
        supabase.from('formacoes').select('id,profile_id,tipo,curso,universidade,rede_ensino,modalidade,inicio,termino'),
        supabase.from('Turma').select('id,nome,professora,periodo,tipo').order('nome'),
      ]);
      if (!montado) return;
      const falha = srv.error || prof.error || form.error || tur.error;
      if (falha) setErro(`Erro ao carregar as bases: ${falha.message}`);
      else {
        setServidores((srv.data ?? []) as Servidor[]);
        setProfiles((prof.data ?? []) as Profile[]);
        setFormacoes((form.data ?? []) as Formacao[]);
        setTurmas((tur.data ?? []) as Turma[]);
      }
      setLoading(false);
    })();
    return () => { montado = false; };
  }, []);

  const linhas = useMemo<Linha[]>(() => servidores.filter(s => ehDocente(s.cargo)).map(s => {
    const ficha1 = fichaDoServidor(s, ficha);
    const p = profileDoServidor(s, profiles, campo(ficha1, ['CPF:', 'CPF']));
    const f = ficha1 ?? fichaDoServidor(s, ficha, p?.cpf || '');
    const ts = turmasDoServidor(s, turmas);
    const fs = p ? formacoes.filter(x => x.profile_id === p.id) : [];

    const cpf = primeiro(campo(f, ['CPF:', 'CPF']), p?.cpf);
    const nascimento = primeiro(campo(f, ['Data Nascimento', 'Data de Nascimento']), p?.data_nascimento);
    const email = primeiro(campo(f, ['Endereço de e-mail', 'E-mail', 'Email']), p?.email);
    const telefone = primeiro(campo(f, ['TELEFONE CELULAR 1:', 'TELEFONE CELULAR 1', 'Telefone Celular 1']), p?.telefone_celular_1, p?.telefone_celular_2, p?.telefone_fixo);
    const endereco = primeiro(campo(f, ['Endereço:', 'Endereço']), p?.endereco);
    const bairro = primeiro(campo(f, ['BAIRRO:', 'BAIRRO']), p?.bairro);
    const cep = primeiro(campo(f, ['CEP:', 'CEP']), p?.cep);
    const municipio = primeiro(campo(f, ['MUNICÍPIO:', 'MUNICÍPIO', 'Municipio']), p?.municipio);
    const uf = primeiro(campo(f, ['ESTADO']), p?.estado);
    const mae = primeiro(campo(f, ['Nome da Mãe', 'Nome da Mae']), p?.nome_mae);
    const pai = primeiro(campo(f, ['Nome do Pai']), p?.nome_pai);
    const naturalidade = primeiro(campo(f, ['Município de Nascimento:', 'Município de Nascimento', 'Municipio de Nascimento']), p?.municipio_nascimento);
    const etnia = primeiro(campo(f, ['Etnia']), p?.etnia);
    const pos = primeiro(campo(f, ['Informar curso Pós-Graduação', 'Pós-Graduação']), fs.find(x => norm(x.tipo).includes('POS') || norm(x.tipo).includes('ESPECIAL'))?.curso);
    const modalidade = modalidadeSugerida(s, ts);
    const formacaoFicha = campo(f, ['Favor informar formação acadêmica:', 'Favor informar formação acadêmica']);

    const checks: Array<[string, any]> = [
      ['CPF', cpf], ['Nascimento', nascimento], ['E-mail', email], ['Telefone', telefone], ['Endereço', endereco],
      ['Bairro', bairro], ['CEP', cep], ['Município', municipio], ['Filiação 1', mae], ['Naturalidade', naturalidade],
      ['Formação acadêmica', fs.length || formacaoFicha], ['Turma/modalidade', ts.length || modalidade],
    ];
    const faltantes = checks.filter(([, v]) => !v).map(([k]) => k);
    const completude = Math.round(((checks.length - faltantes.length) / checks.length) * 100);
    const temCadastro = !!p || !!f;
    const status: Status = !temCadastro ? 'sem_cadastro' : faltantes.length <= 2 ? 'pronto' : 'pendente';
    return { servidor: s, profile: p, ficha: f, formacoes: fs, turmas: ts, modalidade, cpf, nascimento, email, telefone, endereco, bairro, cep, municipio, uf, mae, pai, naturalidade, etnia, pos, faltantes, completude, status };
  }), [servidores, profiles, formacoes, turmas, ficha]);

  const filtradas = useMemo(() => {
    const q = norm(busca);
    return linhas.filter(l => (filtro === 'todos' || l.status === filtro) && (!q || norm(`${l.servidor.nome} ${l.servidor.rf} ${l.servidor.cargo} ${l.servidor.periodo} ${l.turmas.map(t => t.nome).join(' ')}`).includes(q)));
  }, [linhas, filtro, busca]);

  const selecionado = linhas.find(l => dig(l.servidor.rf) === dig(rfSelecionado)) ?? null;
  const resumo = useMemo(() => ({
    total: linhas.length,
    pronto: linhas.filter(l => l.status === 'pronto').length,
    pendente: linhas.filter(l => l.status === 'pendente').length,
    sem: linhas.filter(l => l.status === 'sem_cadastro').length,
  }), [linhas]);

  const importarFicha = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const rows = XLSX.utils.sheet_to_json<FichaRow>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      if (!rows.length) throw new Error('Nenhuma resposta encontrada na primeira aba.');
      setFicha(rows); setNomeFicha(file.name);
      try { sessionStorage.setItem(FICHA_KEY, JSON.stringify(rows)); sessionStorage.setItem(FICHA_NOME_KEY, file.name); } catch {}
      setAviso(`Ficha carregada: ${rows.length} respostas. No cruzamento, o RF ativo tem prioridade sobre RFs históricos e duplicidades.`);
    } catch (err: any) {
      setAviso(`Erro ao importar: ${err?.message ?? err}`);
    } finally { e.target.value = ''; }
  };

  const copiarRf = async (rf: string) => {
    const valor = dig(rf);
    try { await navigator.clipboard.writeText(valor); setAviso(`RF ${valor} copiado para a área de transferência.`); }
    catch { setAviso(`RF atual: ${valor}`); }
  };

  const abrir = (rf: string) => {
    window.open(FORM_URL, '_blank', 'noopener,noreferrer');
    void copiarRf(rf);
  };

  const removerFicha = () => {
    setFicha([]); setNomeFicha('');
    sessionStorage.removeItem(FICHA_KEY); sessionStorage.removeItem(FICHA_NOME_KEY);
    setAviso('Ficha removida da sessão; permanecem as bases atuais do Diário.');
  };

  if (loading) return <Loading />;

  return <div style={{ marginTop: 4 }}>
    <section style={{ background: theme.card, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radiusMd, boxShadow: theme.shadow, padding: 20, marginBottom: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: theme.text, fontSize: 24 }}>👩‍🏫 Censo Docentes 2026</h1>
          <p style={{ color: theme.textSecondary, margin: '7px 0 0', maxWidth: 820, lineHeight: 1.5 }}>Base de trabalho para o formulário da Secretaria: servidor ativo + ficha cadastral + formações + turmas. A folha de frequência entra amanhã como validação final.</p>
        </div>
        <span style={{ color: theme.primary, background: `${theme.primary}12`, border: `1px solid ${theme.primary}44`, borderRadius: 999, padding: '5px 10px', fontSize: 11, fontWeight: 800 }}>EMEIEF LUIZ GONZAGA</span>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importarFicha} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 15 }}>
        <button style={btn('primary')} onClick={() => fileRef.current?.click()}>📥 Importar ficha cadastral</button>
        {nomeFicha && <button style={btn('ghost')} onClick={removerFicha}>Remover ficha</button>}
        <a href={FORM_URL} target="_blank" rel="noopener noreferrer" style={{ ...btn('sky'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>🔗 Formulário oficial</a>
      </div>
      <div style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 1.8, marginTop: 10 }}>
        <div><strong>Ficha:</strong> {nomeFicha ? `${nomeFicha} — ${ficha.length} respostas` : 'não importada nesta sessão'}</div>
        <div><strong>Frequência:</strong> ⏳ aguardando o arquivo de amanhã</div>
      </div>
      {aviso && <div style={{ marginTop: 10, padding: 9, borderRadius: 8, background: `${theme.primary}10`, border: `1px solid ${theme.primary}33`, color: theme.text, fontSize: 11 }}>{aviso}</div>}
      {erro && <div style={{ marginTop: 10, padding: 9, borderRadius: 8, background: `${theme.danger}10`, border: `1px solid ${theme.danger}33`, color: theme.danger, fontSize: 11 }}>{erro}</div>}
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 9, marginBottom: 14 }}>
      <Resumo titulo="Docentes ativos" valor={resumo.total} cor={theme.primary} sub="Cadastro funcional" />
      <Resumo titulo="Quase prontos" valor={resumo.pronto} cor={theme.success} sub="Até 2 pendências" />
      <Resumo titulo="Com pendências" valor={resumo.pendente} cor={theme.warning} sub="Complementar/conferir" />
      <Resumo titulo="Sem cadastro" valor={resumo.sem} cor={theme.danger} sub="Sem ficha/profile localizado" />
    </div>

    <section style={{ background: theme.card, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radiusMd, boxShadow: theme.shadow, padding: 13, marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) 190px', gap: 9 }}>
        <input style={{ ...input, width: '100%' }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar professor, RF, cargo, turma..." />
        <select style={{ ...input, width: '100%' }} value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)}>
          <option value="todos">Todos</option><option value="pronto">Quase prontos</option><option value="pendente">Pendentes</option><option value="sem_cadastro">Sem cadastro</option>
        </select>
      </div>
    </section>

    <section style={{ background: theme.card, border: `1px solid ${theme.borderLight}`, borderRadius: theme.radiusMd, boxShadow: theme.shadow, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
        <thead><tr style={{ background: theme.bg }}>{['Professor', 'RF ativo', 'CPF', 'Período', 'Turma/atuação', 'Modalidade sugerida', 'Dados', 'Situação', 'Ações'].map(h => <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 10, borderBottom: `1px solid ${theme.borderLight}` }}>{h}</th>)}</tr></thead>
        <tbody>{filtradas.map(l => <tr key={`${l.servidor.rf}-${l.servidor.nome}`} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
          <td style={{ padding: '9px 8px', fontSize: 12 }}><button onClick={() => setRfSelecionado(l.servidor.rf)} style={{ border: 0, background: 'transparent', padding: 0, color: theme.primary, cursor: 'pointer', fontWeight: 800, textAlign: 'left' }}>{l.servidor.nome}</button><div style={{ color: theme.textMuted, fontSize: 9, marginTop: 3 }}>{l.servidor.cargo}</div></td>
          <td style={{ padding: '9px 8px', color: theme.text, fontWeight: 800, fontSize: 12 }}>{formatRf(l.servidor.rf)}</td>
          <td style={{ padding: '9px 8px', color: theme.textSecondary, fontSize: 11 }}>{maskCpf(l.cpf)}</td>
          <td style={{ padding: '9px 8px', color: theme.textSecondary, fontSize: 11 }}>{l.servidor.periodo || '—'}</td>
          <td style={{ padding: '9px 8px', color: theme.textSecondary, fontSize: 11 }}>{l.turmas.length ? l.turmas.map(t => t.nome).join(', ') : '⚠️ conferir'}</td>
          <td style={{ padding: '9px 8px', color: theme.textSecondary, fontSize: 11 }}>{l.modalidade || '⚠️ conferir'}</td>
          <td style={{ padding: '9px 8px', minWidth: 105 }}><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><div style={{ height: 6, flex: 1, borderRadius: 9, background: theme.borderLight, overflow: 'hidden' }}><div style={{ height: '100%', width: `${l.completude}%`, background: l.completude >= 80 ? theme.success : l.completude >= 55 ? theme.warning : theme.danger }} /></div><span style={{ fontSize: 10, color: theme.textSecondary, fontWeight: 800 }}>{l.completude}%</span></div></td>
          <td style={{ padding: '9px 8px' }}><Badge status={l.status} /></td>
          <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}><button style={{ ...btn('ghost', { small: true }), marginRight: 4 }} onClick={() => setRfSelecionado(l.servidor.rf)}>Ver</button><button style={btn('sky', { small: true })} onClick={() => abrir(l.servidor.rf)}>Abrir + RF</button></td>
        </tr>)}</tbody>
      </table></div>
      {!filtradas.length && <div style={{ padding: 28, color: theme.textMuted, textAlign: 'center' }}>Nenhum docente encontrado.</div>}
    </section>

    {selecionado && <section style={{ marginTop: 14, background: theme.card, border: `1px solid ${theme.primary}55`, borderRadius: theme.radiusMd, boxShadow: theme.shadow, padding: 17 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: 0, color: theme.text, fontSize: 18 }}>{selecionado.servidor.nome}</h2><div style={{ marginTop: 4, color: theme.textSecondary, fontSize: 11 }}>RF atual <strong>{formatRf(selecionado.servidor.rf)}</strong> · {selecionado.servidor.periodo || 'período não informado'}</div></div>
        <div style={{ display: 'flex', gap: 6 }}><button style={btn('ghost', { small: true })} onClick={() => copiarRf(selecionado.servidor.rf)}>Copiar RF</button><button style={btn('primary', { small: true })} onClick={() => abrir(selecionado.servidor.rf)}>Abrir oficial</button><button style={btn('ghost', { small: true })} onClick={() => setRfSelecionado('')}>Fechar</button></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8, marginTop: 13 }}>
        {[
          ['CPF', selecionado.cpf], ['Nascimento', selecionado.nascimento], ['E-mail', selecionado.email], ['Telefone', selecionado.telefone],
          ['Endereço', selecionado.endereco], ['Bairro / CEP', `${selecionado.bairro || '—'} / ${selecionado.cep || '—'}`], ['Município / UF', `${selecionado.municipio || '—'} / ${selecionado.uf || '—'}`],
          ['Filiação 1', selecionado.mae], ['Filiação 2', selecionado.pai], ['Naturalidade', selecionado.naturalidade], ['Etnia — apenas referência, não converter em Cor/Raça', selecionado.etnia], ['Pós-graduação', selecionado.pos],
        ].map(([k, v]) => <div key={k} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.borderLight}`, background: theme.bg }}><div style={{ color: theme.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>{k}</div><div style={{ color: v && v !== '— / —' ? theme.text : theme.danger, marginTop: 4, fontSize: 12, fontWeight: 650, wordBreak: 'break-word' }}>{v || '⚠️ não localizado'}</div></div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 8, marginTop: 9 }}>
        <div style={{ padding: 11, border: `1px solid ${theme.borderLight}`, borderRadius: 8, color: theme.textSecondary, fontSize: 11, lineHeight: 1.7 }}><strong style={{ color: theme.text }}>🏫 Atuação</strong><br />Turma(s): {selecionado.turmas.length ? selecionado.turmas.map(t => `${t.nome}${t.periodo ? ` (${t.periodo})` : ''}`).join(', ') : '⚠️ conferir'}<br />Modalidade sugerida: {selecionado.modalidade || '⚠️ conferir'}<br />Escola: {selecionado.servidor.escola || '—'}</div>
        <div style={{ padding: 11, border: `1px solid ${theme.borderLight}`, borderRadius: 8, color: theme.textSecondary, fontSize: 11, lineHeight: 1.7 }}><strong style={{ color: theme.text }}>🎓 Formação vinculada</strong><br />{selecionado.formacoes.length ? selecionado.formacoes.map(x => `${x.tipo || 'Formação'}: ${x.curso || 'curso não informado'}${x.universidade ? ` — ${x.universidade}` : ''}`).join(' | ') : '⚠️ nenhuma formação vinculada ao profile; conferir a ficha'}</div>
      </div>
      <div style={{ marginTop: 9, padding: 10, borderRadius: 8, border: `1px solid ${selecionado.faltantes.length ? theme.warning : theme.success}44`, background: `${selecionado.faltantes.length ? theme.warning : theme.success}0D`, color: theme.textSecondary, fontSize: 11 }}><strong style={{ color: theme.text }}>Pendências objetivas:</strong> {selecionado.faltantes.length ? selecionado.faltantes.join(' · ') : 'nenhuma nas fontes cruzadas.'}<div style={{ color: theme.textMuted, marginTop: 5 }}>Sexo, Cor/Raça, deficiência/TEA, nacionalidade e a declaração final não são deduzidos automaticamente; exigem conferência/autodeclaração.</div></div>
    </section>}
  </div>;
}
