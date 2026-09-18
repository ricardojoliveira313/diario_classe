const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = 'https://diario.jroapp.com.br';

const dig = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const txt = (v: unknown) => String(v ?? '').trim();
const norm = (v: unknown) => txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const anoDe = (v: unknown) => txt(v).match(/(?:19|20)\d{2}/)?.[0] || '';

const AREAS_POS = [
  'Agricultura, silvicultura, pesca e veterinária', 'Artes e humanidades',
  'Ciências naturais, matemática e estatística', 'Ciências sociais, comunicação e informação',
  'Computação e Tecnologias da Informação e Comunicação (TIC)', 'Educação',
  'Engenharia, produção e construção', 'Negócios, administração e direito', 'Saúde e bem-estar', 'Serviços',
];
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

type Campo = {
  key: string;
  label: string;
  section: string;
  type: 'text'|'email'|'date'|'year'|'select'|'boolean'|'textarea';
  options?: string[];
  dependsOn?: { key: string; equals: string };
};
type EducacensoProfissional = {
  nome?: string; data_nascimento?: string; cpf?: string; nacionalidade_oficial?: string;
  cor_raca_oficial?: string; sexo?: string; grau_formacao_oficial?: string;
  pos_graduacao_raw?: string; cursos_especificos_raw?: string;
};
type FormacaoConsolidada = {
  rf?: string; tipo?: string; tipo_oficial?: string; area_oficial?: string; curso?: string;
  curso_para_censo?: string; universidade?: string; instituicao_para_censo?: string;
  uf_instituicao?: string; categoria_org?: string; termino?: string;
  copia_entregue_ue?: boolean | null; status_validacao?: string;
};

const BASE_FIELDS: Campo[] = [
  { key:'Data Nasc.', label:'Data de nascimento', section:'Dados pessoais', type:'date' },
  { key:'Sexo', label:'Sexo', section:'Dados pessoais', type:'select', options:['Feminino','Masculino','Não declarado'] },
  { key:'Cor/Raça', label:'Cor/Raça', section:'Dados pessoais', type:'select', options:['Branca','Preta','Parda','Amarela','Indígena','Não declarada'] },
  { key:'Telefone/Celular', label:'Telefone/Celular', section:'Dados pessoais', type:'text' },
  { key:'E-mail', label:'E-mail', section:'Dados pessoais', type:'email' },
  { key:'Filiação 1', label:'Filiação 1', section:'Dados pessoais', type:'text' },
  { key:'Filiação 2', label:'Filiação 2', section:'Dados pessoais', type:'text' },
  { key:'Nacionalidade', label:'Nacionalidade', section:'Dados pessoais', type:'select', options:['Brasileiro(a)','Estrangeiro(a)'] },
  { key:'Naturalidade (Cidade)', label:'Naturalidade (Cidade)', section:'Dados pessoais', type:'text' },
  { key:'UF Nascimento', label:'UF de nascimento', section:'Dados pessoais', type:'select', options:UFS },
  { key:'CEP', label:'CEP', section:'Endereço', type:'text' },
  { key:'Rua/Avenida', label:'Rua/Avenida', section:'Endereço', type:'text' },
  { key:'Nº/Complemento', label:'Nº/Complemento', section:'Endereço', type:'text' },
  { key:'Bairro', label:'Bairro', section:'Endereço', type:'text' },
  { key:'Município', label:'Município', section:'Endereço', type:'text' },
  { key:'UF', label:'UF', section:'Endereço', type:'select', options:UFS },
  { key:'Maior Grau de Formação', label:'Maior Grau de Formação', section:'Formação acadêmica', type:'select', options:['Magistério','Ensino Superior'] },
  { key:'Cursos específicos 80h', label:'Cursos específicos com no mínimo 80 horas', section:'Formação acadêmica', type:'textarea' },
];
const SUPERIOR_FIELDS: Campo[] = Array.from({ length: 3 }, (_, idx) => {
  const n = idx + 1;
  return [
    { key:`${n}º Tipo`, label:`${n}º curso — Tipo`, section:'Curso superior', type:'select', options:['Bacharelado','Licenciatura','Sequencial/Curta Duração','Tecnológico'] },
    { key:`${n}º Área`, label:`${n}º curso — Área`, section:'Curso superior', type:'text' },
    { key:`${n}º Curso — sugestão Censo`, label:`${n}º curso — Nome do curso`, section:'Curso superior', type:'text' },
    { key:`${n}º Ano Conclusão`, label:`${n}º curso — Ano de conclusão`, section:'Curso superior', type:'year' },
    { key:`${n}º UF Instituição`, label:`${n}º curso — UF da instituição`, section:'Curso superior', type:'select', options:UFS },
    { key:`${n}º Categoria/Org.`, label:`${n}º curso — Categoria/Organização`, section:'Curso superior', type:'text' },
    { key:`${n}º Instituição`, label:`${n}º curso — Instituição`, section:'Curso superior', type:'text' },
    { key:`${n}º Cópia entregue UE`, label:`${n}º curso — Cópia entregue na unidade?`, section:'Curso superior', type:'boolean' },
  ] as Campo[];
}).flat();
const POS_FIELDS: Campo[] = [
  { key:'Situação da Pós-Graduação', label:'Situação da Pós-Graduação', section:'Pós-graduação', type:'select', options:['Possui pós-graduação concluída','Não possui pós-graduação concluída'] },
  ...Array.from({ length: 6 }, (_, idx) => {
    const n = idx + 1;
    return [
      { key:`Pós ${n} — Tipo`, label:`Pós ${n} — Tipo`, section:'Pós-graduação', type:'select', options:['Especialização','Mestrado','Doutorado'], dependsOn:{key:'Situação da Pós-Graduação',equals:'Possui pós-graduação concluída'} },
      { key:`Pós ${n} — Área`, label:`Pós ${n} — Área`, section:'Pós-graduação', type:'select', options:AREAS_POS, dependsOn:{key:'Situação da Pós-Graduação',equals:'Possui pós-graduação concluída'} },
      { key:`Pós ${n} — Ano`, label:`Pós ${n} — Ano de conclusão`, section:'Pós-graduação', type:'year', dependsOn:{key:'Situação da Pós-Graduação',equals:'Possui pós-graduação concluída'} },
      { key:`Pós ${n} — Cópia entregue UE`, label:`Pós ${n} — Cópia entregue na unidade?`, section:'Pós-graduação', type:'boolean', dependsOn:{key:'Situação da Pós-Graduação',equals:'Possui pós-graduação concluída'} },
    ] as Campo[];
  }).flat(),
];

function origemPermitida(origin: string) {
  if (!origin) return true;
  if (origin === APP_URL || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') return true;
  try { const u = new URL(origin); return u.protocol === 'https:' && u.hostname.endsWith('.onrender.com'); } catch { return false; }
}
function headers(req: Request) {
  const origin = req.headers.get('origin') || '';
  const h: Record<string,string> = {
    'content-type':'application/json; charset=utf-8',
    'access-control-allow-headers':'authorization, x-client-info, apikey, content-type, x-censo-token',
    'access-control-allow-methods':'POST, OPTIONS',
    'vary':'Origin','cache-control':'no-store','pragma':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  };
  if (origemPermitida(origin) && origin) h['access-control-allow-origin'] = origin;
  return h;
}
function json(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers(req) }); }
async function rest(path: string, init: RequestInit = {}) {
  const h = new Headers(init.headers || {});
  h.set('apikey', SERVICE_KEY); h.set('authorization', `Bearer ${SERVICE_KEY}`);
  if (init.body && !h.has('content-type')) h.set('content-type','application/json');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers:h });
  const t = await r.text();
  if (!r.ok) throw new Error(`Banco ${r.status}: ${t.slice(0,240)}`);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return t; }
}
async function sha256(v: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  return [...h].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function tokenHex() {
  const a = crypto.getRandomValues(new Uint8Array(32));
  return [...a].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function validateAdmin(raw: string | null) {
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) return null;
  const hash = await sha256(raw);
  const rows = await rest(`CensoSessaoToken?token_hash=eq.${encodeURIComponent(hash)}&select=usuario,expira_em&limit=1`) as any[];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || norm(row.usuario) !== 'RICOJOLIVEIRA' || new Date(row.expira_em).getTime() <= Date.now()) return null;
  return row;
}
function missing(v: unknown) {
  const n = norm(v);
  return !n || ['-','NAO INFORMADO','A CONFERIR','PENDENTE'].includes(n);
}
function possuiAlgum(dados: Record<string,any>, prefix: string) {
  return Object.entries(dados).some(([k,v]) => k.startsWith(prefix) && !missing(v));
}
function preencherSeVazio(dados: Record<string,any>, key: string, value: unknown) {
  if (missing(dados[key]) && value !== null && value !== undefined && txt(value)) dados[key] = value;
}
function ehPos(f: FormacaoConsolidada) {
  const t = norm(f.tipo_oficial || f.tipo);
  return t.includes('ESPECIALIZACAO') || t.includes('MESTRADO') || t.includes('DOUTORADO') || t.includes('POS GRADUACAO');
}
function ordenarPorAno(a: FormacaoConsolidada, b: FormacaoConsolidada) {
  return Number(anoDe(a.termino) || '9999') - Number(anoDe(b.termino) || '9999');
}
function dadosEfetivos(origem: Record<string,any>, edu: EducacensoProfissional | null, formacoes: FormacaoConsolidada[]) {
  const dados = { ...origem };
  if (edu) {
    preencherSeVazio(dados, 'Data Nasc.', edu.data_nascimento);
    preencherSeVazio(dados, 'Sexo', edu.sexo);
    preencherSeVazio(dados, 'Cor/Raça', edu.cor_raca_oficial);
    preencherSeVazio(dados, 'Nacionalidade', edu.nacionalidade_oficial);
    preencherSeVazio(dados, 'Maior Grau de Formação', edu.grau_formacao_oficial);
    if (missing(dados['Cursos específicos 80h']) && txt(edu.cursos_especificos_raw)) dados['Cursos específicos 80h'] = txt(edu.cursos_especificos_raw) === '-' ? 'Nenhum' : txt(edu.cursos_especificos_raw);
    const posRaw = txt(edu.pos_graduacao_raw);
    if (missing(dados['Situação da Pós-Graduação']) && posRaw) dados['Situação da Pós-Graduação'] = posRaw === '-' ? 'Não possui pós-graduação concluída' : 'Possui pós-graduação concluída';
    if (posRaw && posRaw !== '-') {
      posRaw.split('|').map(x=>x.trim()).filter(Boolean).slice(0,6).forEach((item,idx)=>{
        const n=idx+1; const [tipo,...areaParts]=item.split(/\s+-\s+/);
        preencherSeVazio(dados, `Pós ${n} — Tipo`, tipo);
        preencherSeVazio(dados, `Pós ${n} — Área`, areaParts.join(' - '));
      });
    }
  }
  const validas = formacoes.filter(f => !f.status_validacao || norm(f.status_validacao)==='VALIDADO');
  validas.filter(f=>!ehPos(f)).sort(ordenarPorAno).slice(0,3).forEach((f,idx)=>{
    const n=idx+1;
    preencherSeVazio(dados, `${n}º Tipo`, f.tipo_oficial || f.tipo);
    preencherSeVazio(dados, `${n}º Área`, f.area_oficial);
    preencherSeVazio(dados, `${n}º Curso — sugestão Censo`, f.curso_para_censo || f.curso);
    preencherSeVazio(dados, `${n}º Ano Conclusão`, anoDe(f.termino));
    preencherSeVazio(dados, `${n}º UF Instituição`, f.uf_instituicao);
    preencherSeVazio(dados, `${n}º Categoria/Org.`, f.categoria_org);
    preencherSeVazio(dados, `${n}º Instituição`, f.instituicao_para_censo || f.universidade);
    if (missing(dados[`${n}º Cópia entregue UE`]) && f.copia_entregue_ue !== null && f.copia_entregue_ue !== undefined) dados[`${n}º Cópia entregue UE`] = f.copia_entregue_ue;
  });
  const pos = validas.filter(ehPos).sort(ordenarPorAno).slice(0,6);
  if (pos.length && missing(dados['Situação da Pós-Graduação'])) dados['Situação da Pós-Graduação']='Possui pós-graduação concluída';
  pos.forEach((f,idx)=>{
    const n=idx+1;
    preencherSeVazio(dados, `Pós ${n} — Tipo`, f.tipo_oficial || f.tipo);
    preencherSeVazio(dados, `Pós ${n} — Área`, f.area_oficial);
    preencherSeVazio(dados, `Pós ${n} — Ano`, anoDe(f.termino));
    if (missing(dados[`Pós ${n} — Cópia entregue UE`]) && f.copia_entregue_ue !== null && f.copia_entregue_ue !== undefined) dados[`Pós ${n} — Cópia entregue UE`] = f.copia_entregue_ue;
  });
  return dados;
}
function camposPendentes(dados: Record<string,any>): Campo[] {
  const out: Campo[] = BASE_FIELDS.filter(c=>missing(dados[c.key]));
  const grau=norm(dados['Maior Grau de Formação']);
  if (grau==='ENSINO SUPERIOR' || missing(dados['Maior Grau de Formação'])) {
    for (let n=1;n<=3;n++) {
      const prefix=`${n}º `;
      if (n===1 || possuiAlgum(dados,prefix)) out.push(...SUPERIOR_FIELDS.filter(c=>c.key.startsWith(prefix)&&missing(dados[c.key])));
    }
  }
  const situacaoPos=norm(dados['Situação da Pós-Graduação']);
  if (missing(dados['Situação da Pós-Graduação'])) out.push(POS_FIELDS[0]);
  if (situacaoPos.includes('POSSUI') || missing(dados['Situação da Pós-Graduação'])) {
    for (let n=1;n<=6;n++) {
      const prefix=`Pós ${n} —`;
      if (n===1 || possuiAlgum(dados,prefix)) out.push(...POS_FIELDS.filter(c=>c.key.startsWith(prefix)&&missing(dados[c.key])));
    }
  }
  return [...new Map(out.map(c=>[c.key,c])).values()];
}
function campoVisivel(c: Campo, campos: Campo[], respostas: Record<string,unknown>) {
  if (!c.dependsOn) return true;
  const dependenciaFoiSolicitada = campos.some(x=>x.key===c.dependsOn!.key);
  return !dependenciaFoiSolicitada || txt(respostas[c.dependsOn.key])===c.dependsOn.equals;
}
function validarRespostas(campos: Campo[], respostasRaw: Record<string,unknown>) {
  const respostas: Record<string,unknown> = {};
  const faltando: string[] = [];
  for (const campo of campos) {
    if (!campoVisivel(campo,campos,respostasRaw||{})) continue;
    const value=(respostasRaw||{})[campo.key];
    if (campo.type==='boolean') {
      if (!(typeof value==='boolean' || value==='true' || value==='false' || value==='Sim' || value==='Não')) { faltando.push(campo.label); continue; }
      respostas[campo.key]=value===true || value==='true' || value==='Sim';
      continue;
    }
    const s=txt(value).slice(0,500);
    if (!s) { faltando.push(campo.label); continue; }
    if (campo.type==='year' && !/^(19|20)\d{2}$/.test(s)) throw new Error(`${campo.label}: informe um ano com 4 dígitos.`);
    if (campo.type==='date' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${campo.label}: data inválida.`);
    if (campo.type==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error(`${campo.label}: e-mail inválido.`);
    respostas[campo.key]=s;
  }
  if (faltando.length) throw new Error(`Preencha os campos restantes: ${faltando.slice(0,3).join(', ')}${faltando.length>3?'…':''}`);
  if (!Object.keys(respostas).length) throw new Error('Nenhuma informação foi preenchida.');
  return respostas;
}
function ehEspecialistaSala(freqRow:any, mestre:any, servidor:any) {
  const cargo=norm(freqRow?.cargo || servidor?.cargo);
  const modalidade=norm(mestre?.dados?.['Modalidade sugerida']);
  if (!cargo.includes('PROFESSOR')) return false;
  if (cargo.includes('ATENDIMENTO EDUCACIONAL ESPECIALIZADO') || cargo.includes('ASSESSOR') || cargo.includes('INCLUSAO')) return false;
  return cargo.includes('ARTES') || cargo.includes('EDUCACAO FISICA') || modalidade==='ARTE REGULAR' || modalidade==='EDUCACAO FISICA';
}
function atuacaoEspecialista(freqRow:any,mestre:any) {
  const modalidade=txt(mestre?.dados?.['Modalidade sugerida']);
  if (modalidade) return modalidade;
  const cargo=norm(freqRow?.cargo);
  if (cargo.includes('ARTES')) return 'Arte – Regular';
  if (cargo.includes('EDUCACAO FISICA')) return 'Educação Física';
  return 'Professor especialista';
}
async function ultimaCompetencia() {
  const rows=await rest('CensoFrequenciaServidor?select=ano,mes&order=ano.desc,mes.desc&limit=1') as any[];
  return Array.isArray(rows)&&rows[0]?{ano:Number(rows[0].ano),mes:Number(rows[0].mes)}:{ano:2026,mes:9};
}
async function elegiveis() {
  const comp=await ultimaCompetencia();
  const [tpRows,turRows,freqRows,envRows,mestreRows,convRows,eduRows,formRows,servidorRows]=await Promise.all([
    rest('TurmaProfessor?select=rf,turma,professora,periodo'),
    rest('Turma?tipo=eq.REGULAR&select=nome,periodo,professora'),
    rest(`CensoFrequenciaServidor?ano=eq.${comp.ano}&mes=eq.${comp.mes}&select=rf,nome,cargo,local_trabalho`),
    rest(`CensoEnvioLog?criado_em=gte.${comp.ano}-01-01T00:00:00.000Z&status=in.(enviado,confirmado_secretaria,revisao_necessaria)&select=rf,status,criado_em&order=criado_em.desc&limit=500`),
    rest(`CensoDocenteMestre?ano=eq.${comp.ano}&select=rf,nome,dados`),
    rest(`CensoProfessorConvite?ano=eq.${comp.ano}&select=id,rf,nome,turma,periodo,status,campos,respostas,criado_em,expira_em,respondido_em,conferido_em&order=criado_em.desc&limit=500`),
    rest('EducacensoProfissionalAtual?select=nome,data_nascimento,cpf,nacionalidade_oficial,cor_raca_oficial,sexo,grau_formacao_oficial,pos_graduacao_raw,cursos_especificos_raw'),
    rest('CensoFormacaoConsolidadaAtual?select=rf,tipo,tipo_oficial,area_oficial,curso,curso_para_censo,universidade,instituicao_para_censo,uf_instituicao,categoria_org,termino,copia_entregue_ue,status_validacao'),
    rest('Servidor?select=rf,nome,cargo,periodo,censo_excluido'),
  ]) as any[];
  const regulares=new Set((Array.isArray(turRows)?turRows:[]).map((t:any)=>norm(t.nome)));
  const tpRegular=new Map<string,any>();
  for (const tp of Array.isArray(tpRows)?tpRows:[]) {
    const rf=dig(tp.rf);
    if (rf && regulares.has(norm(tp.turma)) && !tpRegular.has(rf)) tpRegular.set(rf,tp);
  }
  const processados=new Set((Array.isArray(envRows)?envRows:[]).map((e:any)=>dig(e.rf)));
  const mestres=new Map((Array.isArray(mestreRows)?mestreRows:[]).map((m:any)=>[dig(m.rf),m]));
  const servidores=new Map((Array.isArray(servidorRows)?servidorRows:[]).map((s:any)=>[dig(s.rf),s]));
  const eduNome=new Map((Array.isArray(eduRows)?eduRows:[]).map((e:any)=>[norm(e.nome),e]));
  const eduCpf=new Map((Array.isArray(eduRows)?eduRows:[]).filter((e:any)=>dig(e.cpf)).map((e:any)=>[dig(e.cpf),e]));
  const formPorRf=new Map<string,FormacaoConsolidada[]>();
  for (const f of Array.isArray(formRows)?formRows:[]) {
    const rf=dig(f.rf); if(!rf)continue; const arr=formPorRf.get(rf)||[]; arr.push(f); formPorRf.set(rf,arr);
  }
  const latestConv=new Map<string,any>();
  for (const c of Array.isArray(convRows)?convRows:[]) { const rf=dig(c.rf); if(rf&&!latestConv.has(rf))latestConv.set(rf,c); }
  const out:any[]=[]; const vistos=new Set<string>();
  for (const f of Array.isArray(freqRows)?freqRows:[]) {
    const rf=dig(f.rf); if(!rf||vistos.has(rf)||processados.has(rf))continue;
    const servidor=servidores.get(rf)||null;
    if (servidor?.censo_excluido===true) continue;
    const tp=tpRegular.get(rf)||null;
    const m=mestres.get(rf)||{};
    const especialista=ehEspecialistaSala(f,m,servidor);
    if (!tp && !especialista) continue;
    vistos.add(rf);
    const origem=m.dados||{};
    const edu=eduCpf.get(dig(origem.CPF)) || eduNome.get(norm(m.nome || f.nome || tp?.professora)) || null;
    const efetivos=dadosEfetivos(origem,edu,formPorRf.get(rf)||[]);
    const campos=camposPendentes(efetivos);
    out.push({
      rf,rfExibicao:txt(f.rf),nome:txt(tp?.professora||f.nome||m.nome),
      turma:tp?txt(tp.turma):atuacaoEspecialista(f,m),
      periodo:tp?txt(tp.periodo):txt(servidor?.periodo),
      camposPendentes:campos.length,campos:campos.map(c=>c.label),camposDef:campos,
      tipoAtuacao:tp?'regente':'especialista',convite:latestConv.get(rf)||null,
    });
  }
  return {competencia:comp,professores:out.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))};
}
async function buscarConvitePorToken(raw:string) {
  if(!/^[0-9a-f]{64}$/i.test(raw))return null;
  const hash=await sha256(raw);
  const rows=await rest(`CensoProfessorConvite?token_hash=eq.${encodeURIComponent(hash)}&select=id,ano,rf,nome,turma,periodo,status,campos,respostas,expira_em,respondido_em&limit=1`) as any[];
  const row=Array.isArray(rows)?rows[0]:null; if(!row)return null;
  if(new Date(row.expira_em).getTime()<=Date.now()&&!['conferido','cancelado'].includes(row.status)) {
    await rest(`CensoProfessorConvite?id=eq.${row.id}`,{method:'PATCH',headers:{'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify({status:'expirado',atualizado_em:new Date().toISOString()})});
    row.status='expirado';
  }
  return row;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
  if(req.method!=='POST')return json(req,{ok:false,erro:'Método não permitido.'},405);
  if(!origemPermitida(req.headers.get('origin')||''))return json(req,{ok:false,erro:'Origem não autorizada.'},403);
  try{
    const body=await req.json().catch(()=>({})); const action=txt(body?.action);
    if(action==='public-load'){
      const convite=await buscarConvitePorToken(txt(body?.token)); if(!convite)return json(req,{ok:false,erro:'Link inválido.'},404);
      if(['cancelado','expirado'].includes(convite.status))return json(req,{ok:false,erro:'Este link não está mais disponível.'},410);
      if(convite.status==='conferido')return json(req,{ok:true,concluido:true,nome:convite.nome,turma:convite.turma});
      return json(req,{ok:true,concluido:false,nome:convite.nome,rf:convite.rf,turma:convite.turma,periodo:convite.periodo,campos:convite.campos||[],respostas:convite.respostas||{},expiraEm:convite.expira_em,status:convite.status});
    }
    if(action==='public-submit'){
      const convite=await buscarConvitePorToken(txt(body?.token)); if(!convite)return json(req,{ok:false,erro:'Link inválido.'},404);
      if(['cancelado','expirado','conferido'].includes(convite.status))return json(req,{ok:false,erro:'Este formulário já foi encerrado.'},409);
      const respostas=validarRespostas(Array.isArray(convite.campos)?convite.campos:[],body?.respostas||{}); const now=new Date().toISOString();
      await rest(`CensoProfessorConvite?id=eq.${convite.id}`,{method:'PATCH',headers:{'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify({respostas,status:'respondido',respondido_em:now,atualizado_em:now})});
      return json(req,{ok:true,mensagem:'Informações enviadas. A escola fará a conferência antes do envio oficial.'});
    }
    const admin=await validateAdmin(req.headers.get('x-censo-token')); if(!admin)return json(req,{ok:false,erro:'Sessão segura do Censo expirada. Desbloqueie novamente.'},401);
    if(action==='admin-list')return json(req,{ok:true,...await elegiveis()});
    if(action==='admin-generate'){
      const rf=dig(body?.rf); const lista=await elegiveis(); const professor=lista.professores.find((p:any)=>dig(p.rf)===rf);
      if(!professor)return json(req,{ok:false,erro:'Professor não pertence à lista atual de docentes em sala pendentes.'},400);
      if(!professor.camposPendentes)return json(req,{ok:false,erro:'Não há campos pendentes para solicitar a este professor.'},400);
      if(professor.convite?.status==='respondido')return json(req,{ok:false,erro:'Este professor já respondeu. Confira a resposta antes de gerar outro link.'},409);
      const raw=tokenHex(),hash=await sha256(raw),now=new Date(),expira=new Date(now.getTime()+7*24*60*60*1000).toISOString();
      await rest(`CensoProfessorConvite?rf=eq.${encodeURIComponent(professor.rf)}&status=eq.aberto`,{method:'PATCH',headers:{'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify({status:'cancelado',atualizado_em:now.toISOString()})});
      const campos=Array.isArray(professor.camposDef)?professor.camposDef:[];
      const payload={ano:lista.competencia.ano,rf:professor.rf,nome:professor.nome,turma:professor.turma,periodo:professor.periodo,token_hash:hash,campos,respostas:{},status:'aberto',criado_por:admin.usuario,expira_em:expira};
      const created=await rest('CensoProfessorConvite',{method:'POST',headers:{'content-type':'application/json','prefer':'return=representation'},body:JSON.stringify(payload)}) as any[];
      const row=Array.isArray(created)?created[0]:null;
      return json(req,{ok:true,id:row?.id,link:`${APP_URL}/censo-professor/${raw}`,expiraEm:expira,campos:campos.map((c:Campo)=>c.label)});
    }
    if(action==='admin-detail'){
      const id=txt(body?.id); const rows=await rest(`CensoProfessorConvite?id=eq.${encodeURIComponent(id)}&select=id,ano,rf,nome,turma,periodo,status,campos,respostas,criado_em,expira_em,respondido_em,conferido_em&limit=1`) as any[];
      const row=Array.isArray(rows)?rows[0]:null; if(!row)return json(req,{ok:false,erro:'Resposta não localizada.'},404); return json(req,{ok:true,convite:row});
    }
    if(action==='admin-confirm'){
      const id=txt(body?.id); const rows=await rest(`CensoProfessorConvite?id=eq.${encodeURIComponent(id)}&select=id,ano,rf,nome,status,campos,respostas&limit=1`) as any[];
      const convite=Array.isArray(rows)?rows[0]:null; if(!convite||convite.status!=='respondido')return json(req,{ok:false,erro:'Não há resposta aguardando conferência.'},409);
      const respostas=validarRespostas(Array.isArray(convite.campos)?convite.campos:[],convite.respostas||{});
      const masters=await rest(`CensoDocenteMestre?ano=eq.${convite.ano}&select=rf,nome,dados&limit=200`) as any[];
      const master=(Array.isArray(masters)?masters:[]).find((m:any)=>dig(m.rf)===dig(convite.rf)); if(!master)return json(req,{ok:false,erro:'Registro do Banco Mestre não localizado para este RF.'},404);
      const now=new Date().toISOString(); const merged={...(master.dados||{}),...respostas,'Coleta professor — confirmado em':now,'Coleta professor — confirmado por':admin.usuario};
      await rest(`CensoDocenteMestre?ano=eq.${convite.ano}&rf=eq.${encodeURIComponent(master.rf)}`,{method:'PATCH',headers:{'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify({dados:merged,fonte_timestamp:now})});
      await rest(`CensoProfessorConvite?id=eq.${convite.id}`,{method:'PATCH',headers:{'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify({status:'conferido',conferido_em:now,atualizado_em:now})});
      await rest('AuditLog',{method:'POST',headers:{'content-type':'application/json','prefer':'return=minimal'},body:JSON.stringify({usuario:admin.usuario,acao:'CONFIRMAR_COLETA_PROFESSOR',tabela:'CensoDocenteMestre',registro_id:`${convite.ano}:${master.rf}`,dados_depois:{campos:Object.keys(respostas),convite_id:convite.id}})}).catch(()=>null);
      return json(req,{ok:true,mensagem:'Dados conferidos e incorporados ao Banco Mestre. O botão Preparar formulário já usará essas informações.'});
    }
    return json(req,{ok:false,erro:'Ação não suportada.'},400);
  }catch(e){console.error('censo-professor-formulario',e);return json(req,{ok:false,erro:e instanceof Error?e.message:'Falha inesperada no formulário do professor.'},500);}
});
