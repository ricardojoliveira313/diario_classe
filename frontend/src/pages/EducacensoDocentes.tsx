import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../api';
import { useAuth } from '../AuthContext';
import { btn, input, theme } from '../styles';
import { Loading } from '../components';

const FORM_URL = 'https://script.google.com/macros/s/AKfycbxRAI9YowrLP1ffKAV7URQaXWPKaOOV3dqDbxVouD7Q4Jq-lRFJDmVbzbeRahNpDv6STg/exec';
const TOKEN_KEY = 'censo_direto_token';
const TOKEN_EXP_KEY = 'censo_direto_expira';
const SCHOOL = 'EMEIEF LUIZ GONZAGA';

const MODALIDADES = [
  'Educação Infantil', 'Ensino Fundamental Regular', 'Educação Básica I', 'Educação Básica II',
  'Educação Física', 'Arte – Regular', 'EJA I', 'EJA II – Arte', 'EJA II – História',
  'EJA II – Geografia', 'EJA II – Língua Portuguesa', 'EJA II – Matemática', 'EJA II – Ciências', 'EJA II – Inglês',
] as const;
const SEXOS = ['Feminino', 'Masculino', 'Não declarado'] as const;
const CORES_RACAS = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não declarada'] as const;
const NACIONALIDADES = ['Brasileiro(a)', 'Estrangeiro(a)'] as const;
const GRAUS = ['Magistério', 'Ensino Superior'] as const;
const TIPOS_SUPERIOR = ['Bacharelado', 'Licenciatura', 'Sequencial/Curta Duração', 'Tecnológico'] as const;
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'] as const;
const TIPOS_POS = ['Especialização', 'Mestrado', 'Doutorado'] as const;
const AREAS_POS = [
  'Agricultura, silvicultura, pesca e veterinária', 'Artes e humanidades',
  'Ciências naturais, matemática e estatística', 'Ciências sociais, comunicação e informação',
  'Computação e Tecnologias da Informação e Comunicação (TIC)', 'Educação',
  'Engenharia, produção e construção', 'Negócios, administração e direito', 'Saúde e bem-estar', 'Serviços',
] as const;
const DEFICIENCIAS = [
  'Baixa Visão', 'Cegueira', 'Surdez', 'Surdocegueira', 'Deficiência Auditiva', 'Deficiência Física',
  'Deficiência Intelectual', 'Deficiência Múltipla', 'TEA', 'Visão Monocular',
  'Altas Habilidades / Superdotação', 'Não possuo deficiência',
] as const;
const CURSOS_ESPECIFICOS = [
  'Creche (0 a 3 anos)', 'Pré-escola (4 e 5 anos)', 'Alfabetização', 'Anos iniciais do ensino fundamental',
  'Anos finais do ensino fundamental', 'Ensino médio', 'Educação de jovens e adultos', 'Educação especial',
  'Educação indígena', 'Educação do campo', 'Educação ambiental', 'Educação em direitos humanos',
  'Educação bilíngue de surdos', 'Educação e Tecnologia de Informação e Comunicação (TIC)',
  'Educação integral em tempo integral', 'Gênero e diversidade sexual', 'Direitos da criança e do adolescente',
  'Educação para as relações étnico-raciais e história e cultura afro-brasileira e africana',
  'Gestão escolar', 'Outros', 'Nenhum',
] as const;

type Servidor = { rf:string; nome:string; cargo:string; periodo:string; escola:string; ativo:boolean; turma_atribuida?:string|null; sala_atribuida?:string|null };
type Frequencia = { ano:number; mes:number; rf:string; nome:string; categoria?:string|null; lotacao?:string|null; cargo?:string|null; carga_horaria?:number|null; local_trabalho?:string|null; pagina_pdf?:number|null };
type Competencia = { ano:number; mes:number };
type Turma = { id:string; nome:string; professora?:string|null; periodo?:string|null; tipo?:string|null };
type Linha = { servidor:Servidor; frequencia:Frequencia; turmas:Turma[]; modalidade:string; vinculosMesmoNome:number };
type GradOpcao = { tipo?:string; area?:string; curso?:string };
type InstOpcao = { uf?:string; categoria?:string; org?:string; nome?:string };
type PosOpcao = { area?:string };
type OpcoesOficiais = { graduacao:GradOpcao[]; instituicoes:InstOpcao[]; pos:PosOpcao[] };
type CursoSuperior = { tipo:string; area:string; curso:string; ano:string; ufInstituicao:string; categoriaOrg:string; instituicao:string; entregue:boolean };
type PosGraduacao = { tipo:string; area:string; ano:string; entregue:boolean };
type EducacensoRegistro = {
  identificacao_unica?:string; nome?:string; data_nascimento?:string; cpf?:string;
  nacionalidade_oficial?:string; cor_raca_oficial?:string; sexo?:string; deficiencia_raw?:string;
  grau_formacao_oficial?:string; pos_graduacao_raw?:string; formacao_complementacao_raw?:string;
  cursos_especificos_raw?:string; referencia_data?:string; arquivo_nome?:string; importado_em?:string;
};
type Draft = {
  rf:string; nome:string; unidadeEscolar:string; modalidade:string; cpf:string; dataNasc:string;
  sexo:string; corRaca:string; telefone:string; email:string; nomeMae:string; nomePai:string;
  nacionalidade:string; paisEstrangeiro:string; naturalidade:string; ufNascimento:string;
  cep:string; rua:string; numero:string; bairro:string; municipio:string; uf:string;
  deficiencias:string[]; grauFormacao:string; cursosSuperiores:CursoSuperior[]; possuiPos:boolean|null;
  posGraduacoes:PosGraduacao[]; cursosEspecificos:string[];
};
type PrepareResponse = {
  ok:boolean;
  official:{ rf?:string; nome?:string; cpf?:string; dataNascimento?:string; sucesso?:boolean };
  attendance?:Frequencia; unidadeEscolar?:string; opcoesOficiais?:OpcoesOficiais;
  local?: {
    profile?:Record<string,any>|null; profileMatch?:string;
    ficha?:{ dados?:Record<string,any>; fonte_timestamp?:string; metodo_match?:string }|null;
    formacoes?:Array<Record<string,any>>;
  };
};
type EducacensoLookup = {
  ok:boolean; registro?:EducacensoRegistro|null; match?:string|null; referenciaData?:string|null; arquivoNome?:string|null;
  posFonte?:'educacenso'|'ficha_cadastral'|'nao_informado'|null; possuiPosFicha?:boolean|null; avisoConsolidacao?:string|null;
};
type FonteEducacenso = { referenciaData:string; arquivoNome:string; match:string };
type ReferenciaFicha = { formacoes:string[]; universidades:string[]; anos:string[]; ensinoMedio:string; fonteData:string };
type EnvioStatus = { rf:string; modalidade:string; status:'enviado'; criadoEm:string; comprovanteUrl:string };

const EMPTY_OPTIONS:OpcoesOficiais = { graduacao:[], instituicoes:[], pos:[] };
const txt = (v:unknown) => String(v ?? '').trim();
const dig = (v:unknown) => txt(v).replace(/\D/g, '');
const norm = (v:unknown) => txt(v).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const first = (...values:unknown[]) => values.map(txt).find(Boolean) || '';
const uniq = (values:Array<string|undefined|null>) => [...new Set(values.map(txt).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
const inOptions = (value:unknown, options:readonly string[]) => options.find(o=>norm(o)===norm(value)) || '';
const listaPipe = (value:unknown) => { const s=txt(value); return !s||s==='-'?[]:s.split('|').map(x=>x.trim()).filter(Boolean); };

function formatRf(rf:string){const d=dig(rf);return d.length===6?`${d.slice(0,2)}.${d.slice(2,5)}-${d.slice(5)}`:rf}
function maskCpf(cpf:string){const d=dig(cpf);return d.length===11?`***.***.${d.slice(6,9)}-${d.slice(9)}`:(cpf||'—')}
function formatDataBR(value:string){if(!value)return'';const s=value.slice(0,10);const p=s.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:value}
function formatDataHora(value:string){if(!value)return'';const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function formatCompetencia(c:Competencia){const data=new Date(c.ano,c.mes-1,1);return `${data.toLocaleDateString('pt-BR',{month:'long'}).replace(/^./,x=>x.toUpperCase())}/${c.ano}`}
function ehDocente(cargo:string){const c=norm(cargo);return c.includes('PROFESSOR')||/^PROF\b/.test(c)}
function contemNome(curto:string,completo:string){const a=norm(curto).split(' ').filter(t=>t.length>1);const b=norm(completo).split(' ').filter(Boolean);return!!a.length&&a.every(t=>b.includes(t))}
function turmasDoServidor(s:Servidor,turmas:Turma[]){const atribuida=norm(s.turma_atribuida||s.sala_atribuida||'');if(atribuida){const x=turmas.filter(t=>norm(t.nome)===atribuida);if(x.length)return x}return turmas.filter(t=>{const p=txt(t.professora);return!!p&&(contemNome(p,s.nome)||contemNome(s.nome,p))})}
function modalidadeSugerida(s:Servidor,f:Frequencia,turmas:Turma[]){const cargo=norm(f.cargo||s.cargo),lotacao=norm(f.lotacao),nomes=turmas.map(t=>norm(t.nome));if(cargo.includes('EDUCACAO FISICA'))return'Educação Física';if(cargo.includes('ART'))return'Arte – Regular';if(cargo.includes('ATENDIMENTO EDUCACIONAL ESPECIALIZADO')||turmas.some(t=>norm(t.tipo)==='AEE'))return'';if(lotacao.includes('EJA')||nomes.some(n=>n.includes('EJA')))return'EJA I';if(lotacao.includes('PRE ESCOLA')||nomes.some(n=>/^[12] ETAPA\b/.test(n)))return'Educação Infantil';if(nomes.some(n=>/^[1-5] ANO\b/.test(n)))return'Ensino Fundamental Regular';return''}
function splitEndereco(value:string){const s=txt(value),m=s.match(/^(.*?)[,\s]+(\d+\w?(?:\s*[-/]\s*\w+)?(?:.*)?)$/i);return m?{rua:m[1].trim(),numero:m[2].trim()}:{rua:s,numero:''}}
function ufSigla(value:string){const n=norm(value);const map:Record<string,string>={ACRE:'AC',ALAGOAS:'AL',AMAPA:'AP',AMAZONAS:'AM',BAHIA:'BA',CEARA:'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES',GOIAS:'GO',MARANHAO:'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG',PARA:'PA',PARAIBA:'PB',PARANA:'PR',PERNAMBUCO:'PE',PIAUI:'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS',RONDONIA:'RO',RORAIMA:'RR','SANTA CATARINA':'SC','SAO PAULO':'SP',SERGIPE:'SE',TOCANTINS:'TO'};const sigla=/^[A-Z]{2}$/.test(n)?n:(map[n]||'');return UFS.includes(sigla as any)?sigla:''}
function cursoSuperiorVazio():CursoSuperior{return{tipo:'',area:'',curso:'',ano:'',ufInstituicao:'',categoriaOrg:'',instituicao:'',entregue:false}}
function posVazia():PosGraduacao{return{tipo:'',area:'',ano:'',entregue:false}}
function mapCorRaca(value:unknown){if(norm(value)===norm('Não declarado'))return'Não declarada';return inOptions(value,CORES_RACAS)}
function parseDeficienciasEducacenso(value:unknown){return listaPipe(value).map(v=>inOptions(v,DEFICIENCIAS)).filter(Boolean)}
function parseCursosEducacenso(value:unknown){return listaPipe(value).map(v=>inOptions(v,CURSOS_ESPECIFICOS)).filter(Boolean)}
function parsePosEducacenso(value:unknown,areasPermitidas:readonly string[]){return listaPipe(value).slice(0,6).map(item=>{const m=item.match(/^(Especialização|Mestrado|Doutorado)\s*-\s*(.+)$/i);if(!m)return null;const tipo=inOptions(m[1],TIPOS_POS),area=inOptions(m[2],areasPermitidas);return tipo&&area?{...posVazia(),tipo,area}:null}).filter((x):x is PosGraduacao=>!!x)}
function anoConclusao(value:unknown){const m=txt(value).match(/\b(19\d{2}|20\d{2})\b/);if(!m)return'';const ano=Number(m[1]);const limite=new Date().getFullYear()+1;return ano>=1950&&ano<=limite?m[1]:''}
function academicoEntries(f:Record<string,any>){return Array.isArray(f.academicoReferencia)?[...f.academicoReferencia].sort((a:any,b:any)=>Number(a?.coluna||0)-Number(b?.coluna||0)):[]}
function cursosFicha(f:Record<string,any>){
  const values:string[]=[];
  if(txt(f.formacaoPrincipal)) values.push(txt(f.formacaoPrincipal));
  for(const e of academicoEntries(f)){
    const campo=norm(e?.campo),valor=txt(e?.valor);
    if(campo.includes('FORMACAO ACADEMICA')&&valor&&!['SIM','NAO','NÃO'].includes(valor.toUpperCase())) values.push(valor);
  }
  return uniq(values).slice(0,3);
}
function anosFicha(f:Record<string,any>){return academicoEntries(f).filter((e:any)=>norm(e?.campo).includes('TERMINO DO CURSO')).map((e:any)=>anoConclusao(e?.valor)).filter(Boolean)}
function anosPosFicha(f:Record<string,any>){
  const porColuna=new Map<number,string>();
  for(const e of academicoEntries(f)){
    const coluna=Number(e?.coluna||0);
    if([37,43,45].includes(coluna))porColuna.set(coluna,anoConclusao(e?.valor));
  }
  return[37,43,45].map(coluna=>porColuna.get(coluna)||'');
}
function preencherAnosPos(rows:PosGraduacao[],f:Record<string,any>){
  const anos=anosPosFicha(f),conhecidos=anos.filter(Boolean);
  if(rows.length===1&&conhecidos.length===1)return rows.map(p=>({...p,ano:p.ano||conhecidos[0]}));
  return rows.map((p,i)=>({...p,ano:p.ano||anos[i]||''}));
}
function resolveGraduacao(raw:string,opcoes:OpcoesOficiais){
  const matches=opcoes.graduacao.filter(x=>norm(x.curso)===norm(raw));
  const combos=uniq(matches.map(x=>`${txt(x.tipo)}|||${txt(x.area)}|||${txt(x.curso)}`));
  if(combos.length!==1)return null;
  const [tipo,area,curso]=combos[0].split('|||');
  return{tipo,area,curso};
}
function ehPosFormacao(x:Record<string,any>){const tipo=first(x.tipo_oficial,x.tipo);return TIPOS_POS.some(t=>norm(t)===norm(tipo))||norm(tipo).includes('POS')}
function resolveGraduacaoEstruturada(x:Record<string,any>,opcoes:OpcoesOficiais){
  const tipo=txt(x.tipo_oficial),area=txt(x.area_oficial),curso=txt(x.curso_oficial);
  if(tipo&&area&&curso){
    const oficial=opcoes.graduacao.find(o=>norm(o.tipo)===norm(tipo)&&norm(o.area)===norm(area)&&norm(o.curso)===norm(curso));
    if(oficial)return{tipo:txt(oficial.tipo),area:txt(oficial.area),curso:txt(oficial.curso)};
    if(!opcoes.graduacao.length)return{tipo,area,curso};
  }
  return resolveGraduacao(first(x.curso_oficial,x.curso),opcoes);
}
function resolveInstituicao(raw:string,opcoes:OpcoesOficiais){
  if(!raw)return null;
  let matches=opcoes.instituicoes.filter(x=>norm(x.nome)===norm(raw));
  if(!matches.length){const n=norm(raw);matches=opcoes.instituicoes.filter(x=>{const a=norm(x.nome);return a&&(a.includes(n)||n.includes(a))})}
  const unicas=uniq(matches.map(x=>`${txt(x.uf)}|||${txt(x.categoria||x.org)}|||${txt(x.nome)}`));
  if(unicas.length!==1)return null;
  const [uf,categoriaOrg,instituicao]=unicas[0].split('|||');
  return{ufInstituicao:uf,categoriaOrg,instituicao};
}
function montarSuperiores(r:PrepareResponse){
  const f=r.local?.ficha?.dados||{},opcoes=r.opcoesOficiais||EMPTY_OPTIONS;
  const formacoes=Array.isArray(r.local?.formacoes)?r.local!.formacoes!:[];
  const graduacoes=formacoes.filter((x:any)=>!ehPosFormacao(x));
  if(graduacoes.length){
    return graduacoes.slice(0,3).map((x:any)=>{
      const grad=resolveGraduacaoEstruturada(x,opcoes);const inst=resolveInstituicao(first(x.instituicao_oficial,x.universidade),opcoes);
      return{...cursoSuperiorVazio(),tipo:grad?.tipo||inOptions(first(x.tipo_oficial,x.tipo),TIPOS_SUPERIOR),area:grad?.area||'',curso:grad?.curso||'',ano:anoConclusao(x.termino),ufInstituicao:ufSigla(x.uf_instituicao)||inst?.ufInstituicao||'',categoriaOrg:first(x.categoria_org,inst?.categoriaOrg),instituicao:first(inst?.instituicao,x.instituicao_oficial),entregue:x.copia_entregue_ue===true};
    });
  }
  const cursos=cursosFicha(f),universidades=Array.isArray(f.universidades)?f.universidades.map(txt).filter(Boolean):[],anos=anosFicha(f);
  return cursos.map((raw,i)=>{const grad=resolveGraduacao(raw,opcoes);const inst=resolveInstituicao(universidades[i]||universidades[0]||'',opcoes);return{...cursoSuperiorVazio(),tipo:grad?.tipo||'',area:grad?.area||'',curso:grad?.curso||'',ano:anos[i]||'',...(inst||{})}});
}
function resolvePosEstruturada(x:Record<string,any>,areasPos:readonly string[]){
  const tipo=inOptions(first(x.tipo_oficial,x.tipo),TIPOS_POS);
  const area=inOptions(txt(x.area_oficial),areasPos);
  if(!tipo||!area)return null;
  return{...posVazia(),tipo,area,ano:anoConclusao(x.termino),entregue:x.copia_entregue_ue===true};
}
function montarPosEstruturada(r:PrepareResponse,areasPos:readonly string[]):PosGraduacao[]{
  const formacoes=Array.isArray(r.local?.formacoes)?r.local!.formacoes!:[];
  const posRows=formacoes.filter((x:any)=>ehPosFormacao(x));
  if(!posRows.length)return[];
  return posRows.slice(0,6).map((x:any)=>resolvePosEstruturada(x,areasPos)).filter((x):x is PosGraduacao=>!!x);
}
function referenciaFicha(r:PrepareResponse):ReferenciaFicha|null{
  const f=r.local?.ficha?.dados||{};if(!Object.keys(f).length)return null;
  return{formacoes:cursosFicha(f),universidades:Array.isArray(f.universidades)?f.universidades.map(txt).filter(Boolean):[],anos:anosFicha(f),ensinoMedio:txt(f.ensinoMedioMagisterio),fonteData:txt(r.local?.ficha?.fonte_timestamp)};
}
function construirDraft(l:Linha,r:PrepareResponse,base:EducacensoLookup|null):Draft{
  const educacenso=base?.registro||null;
  const p=r.local?.profile||{},f=r.local?.ficha?.dados||{},official=r.official||{};
  const endereco=splitEndereco(first(f.endereco,p.endereco));const superiores=montarSuperiores(r);
  const areasPosOficiais=uniq((r.opcoesOficiais?.pos||[]).map(x=>x.area));const areasPos=areasPosOficiais.length?areasPosOficiais:[...AREAS_POS];
  const posEstruturada=montarPosEstruturada(r,areasPos);const temPosEstruturada=posEstruturada.length>0;
  const posEdu=preencherAnosPos(parsePosEducacenso(educacenso?.pos_graduacao_raw,areasPos),f);
  const posRawEdu=txt(educacenso?.pos_graduacao_raw),temPosEducacenso=posEdu.length>0,temIndicacaoPosEducacenso=!!posRawEdu&&posRawEdu!=='-';
  const possuiPosFicha=base?.possuiPosFicha??(norm(f.posPossui)==='SIM'?true:norm(f.posPossui)==='NAO'?false:null);
  const possuiPos:boolean|null=temPosEstruturada?true:temIndicacaoPosEducacenso?true:possuiPosFicha!==null?possuiPosFicha:posRawEdu==='-'?false:null;
  const posGraduacoes=temPosEstruturada?posEstruturada:temPosEducacenso?posEdu:possuiPos===true?[posVazia()]:[];
  const etnia=txt(f.etniaReferencia||p.etnia),sexoEdu=inOptions(educacenso?.sexo,SEXOS),corEdu=mapCorRaca(educacenso?.cor_raca_oficial),nacionalidadeEdu=inOptions(educacenso?.nacionalidade_oficial,NACIONALIDADES),grauEdu=inOptions(educacenso?.grau_formacao_oficial,GRAUS);
  const grauLocal=superiores.some(c=>c.curso)?'Ensino Superior':norm(f.ensinoMedioMagisterio).includes('MAGISTERIO')?'Magistério':'';
  return{
    rf:dig(official.rf||l.servidor.rf),nome:first(official.nome,l.servidor.nome),unidadeEscolar:r.unidadeEscolar||SCHOOL,
    modalidade:'',cpf:dig(official.cpf||f.cpf||p.cpf),
    dataNasc:first(official.dataNascimento,educacenso?.data_nascimento,f.dataNascimento,p.data_nascimento),sexo:sexoEdu,
    corRaca:corEdu||CORES_RACAS.find(c=>norm(c)===norm(etnia))||'',telefone:first(f.telefone1,p.telefone_celular_1,f.telefone2,p.telefone_celular_2,p.telefone_fixo),
    email:first(f.email,p.email),nomeMae:first(f.nomeMae,p.nome_mae),nomePai:first(f.nomePai,p.nome_pai),nacionalidade:nacionalidadeEdu||'Brasileiro(a)',paisEstrangeiro:'',
    naturalidade:first(f.municipioNascimento,p.municipio_nascimento),ufNascimento:ufSigla(first(f.ufNascimento,p.estado_nascimento)),cep:dig(first(f.cep,p.cep)),rua:endereco.rua,numero:endereco.numero,
    bairro:first(f.bairro,p.bairro),municipio:first(f.municipio,p.municipio,'Santo André'),uf:ufSigla(first(f.estado,p.estado,'SP'))||'SP',
    deficiencias:parseDeficienciasEducacenso(educacenso?.deficiencia_raw),grauFormacao:grauEdu||grauLocal,cursosSuperiores:superiores.length?superiores:[cursoSuperiorVazio()],possuiPos,
    posGraduacoes:possuiPos?(posGraduacoes.length?posGraduacoes:[posVazia()]):[],cursosEspecificos:parseCursosEducacenso(educacenso?.cursos_especificos_raw),
  };
}

function Field({labelText,value,onChange,type='text',readOnly=false,placeholder=''}:{labelText:string;value:string;onChange?:(v:string)=>void;type?:string;readOnly?:boolean;placeholder?:string}){return<label style={{display:'grid',gap:5}}><span style={{color:theme.textSecondary,fontSize:10.5,fontWeight:800}}>{labelText}</span><input type={type} style={{...input,width:'100%',opacity:readOnly?0.78:1}} value={value} readOnly={readOnly} placeholder={placeholder} onChange={e=>onChange?.(e.target.value)}/></label>}
function SelectField({labelText,value,onChange,options,placeholder='Selecione...',disabled=false}:{labelText:string;value:string;onChange:(v:string)=>void;options:readonly string[];placeholder?:string;disabled?:boolean}){return<label style={{display:'grid',gap:5}}><span style={{color:theme.textSecondary,fontSize:10.5,fontWeight:800}}>{labelText}</span><select style={{...input,width:'100%',opacity:disabled?0.65:1}} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">{placeholder}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>}
function Resumo({titulo,valor,cor,sub}:{titulo:string;valor:number;cor:string;sub:string}){return<div style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:theme.radiusMd,padding:'15px 16px',boxShadow:theme.shadow}}><div style={{color:theme.textSecondary,fontSize:11,fontWeight:800}}>{titulo}</div><div style={{color:cor,fontSize:28,fontWeight:900,marginTop:5,lineHeight:1}}>{valor}</div><div style={{color:theme.textMuted,fontSize:10.5,marginTop:7}}>{sub}</div></div>}

export default function EducacensoDocentes(){
  const{username}=useAuth();
  const[servidores,setServidores]=useState<Servidor[]>([]),[frequencias,setFrequencias]=useState<Frequencia[]>([]),[turmas,setTurmas]=useState<Turma[]>([]);
  const[competencias,setCompetencias]=useState<Competencia[]>([]),[competencia,setCompetencia]=useState<Competencia|null>(null);
  const[loading,setLoading]=useState(true),[erro,setErro]=useState(''),[aviso,setAviso]=useState(''),[busca,setBusca]=useState('');
  const[token,setToken]=useState(()=>sessionStorage.getItem(TOKEN_KEY)||''),[expiraEm,setExpiraEm]=useState(()=>sessionStorage.getItem(TOKEN_EXP_KEY)||'');
  const[senha,setSenha]=useState(''),[desbloqueando,setDesbloqueando]=useState(false),[sessaoOk,setSessaoOk]=useState(false),[preparandoRf,setPreparandoRf]=useState('');
  const[linhaEmEdicao,setLinhaEmEdicao]=useState<Linha|null>(null),[draft,setDraft]=useState<Draft|null>(null),[fonteMatch,setFonteMatch]=useState('');
  const[fonteEducacenso,setFonteEducacenso]=useState<FonteEducacenso|null>(null),[refFicha,setRefFicha]=useState<ReferenciaFicha|null>(null),[avisoConsolidacao,setAvisoConsolidacao]=useState(''),[confirmacao,setConfirmacao]=useState(false),[enviando,setEnviando]=useState(false);
  const[resultado,setResultado]=useState<any>(null),[opcoes,setOpcoes]=useState<OpcoesOficiais>(EMPTY_OPTIONS),[envios,setEnvios]=useState<EnvioStatus[]>([]);

  const bridge=async(body:Record<string,any>,explicitToken?:string)=>{const t=explicitToken??token,headers:Record<string,string>={};if(t)headers['x-censo-token']=t;const{data,error}=await supabase.functions.invoke('censo-oficial-bridge',{body,headers});if(error){let message=error.message||'Falha na integração direta.';const ctx=(error as any).context;try{if(ctx&&typeof ctx.json==='function'){const detail=await ctx.json();if(detail?.erro)message=detail.erro}}catch{}throw new Error(message)}if(!data?.ok)throw new Error(data?.erro||'Operação não autorizada.');return data};
  const educacensoLookup=async(cpf:string):Promise<EducacensoLookup>=>{const headers:Record<string,string>={};if(token)headers['x-censo-token']=token;const{data,error}=await supabase.functions.invoke('censo-educacenso-base',{body:{action:'lookup',cpf},headers});if(error){let message=error.message||'Falha ao consultar a base Educacenso.';const ctx=(error as any).context;try{if(ctx&&typeof ctx.json==='function'){const detail=await ctx.json();if(detail?.erro)message=detail.erro}}catch{}throw new Error(message)}if(!data?.ok)throw new Error(data?.erro||'Falha ao consultar a base Educacenso.');return data as EducacensoLookup};
  const carregarEnvios=async(explicitToken?:string)=>{const t=explicitToken??token;if(!t){setEnvios([]);return}const headers:Record<string,string>={'x-censo-token':t};const{data,error}=await supabase.functions.invoke('censo-status-envios',{body:{action:'list'},headers});if(error||!data?.ok){setEnvios([]);return}setEnvios(Array.isArray(data.envios)?data.envios:[])};

  useEffect(()=>{let montado=true;(async()=>{setLoading(true);const comp=await supabase.from('CensoFrequenciaServidor').select('ano,mes').order('ano',{ascending:false}).order('mes',{ascending:false});if(!montado)return;if(comp.error){setErro(`Erro ao carregar as competências: ${comp.error.message}`);setLoading(false);return}const lista=[...new Map((comp.data??[]).map((c:any)=>[`${c.ano}-${c.mes}`,{ano:Number(c.ano),mes:Number(c.mes)}])).values()] as Competencia[];const atual=lista[0]||null;setCompetencias(lista);setCompetencia(atual);const[srv,freq,tur]=await Promise.all([
    supabase.from('ServidorCenso').select('rf,nome,cargo,periodo,escola,ativo,turma_atribuida,sala_atribuida').order('nome'),
    atual?supabase.from('CensoFrequenciaServidor').select('ano,mes,rf,nome,categoria,lotacao,cargo,carga_horaria,local_trabalho,pagina_pdf').eq('ano',atual.ano).eq('mes',atual.mes).order('pagina_pdf'):Promise.resolve({data:[],error:null}),
    supabase.from('Turma').select('id,nome,professora,periodo,tipo').order('nome'),
  ]);if(!montado)return;const falha=srv.error||freq.error||tur.error;if(falha)setErro(`Erro ao carregar as bases: ${falha.message}`);else{setServidores((srv.data??[])as Servidor[]);setFrequencias((freq.data??[])as Frequencia[]);setTurmas((tur.data??[])as Turma[])}setLoading(false)})();return()=>{montado=false}},[]);
  useEffect(()=>{if(!token){setSessaoOk(false);setEnvios([]);return}if(!expiraEm||new Date(expiraEm).getTime()<=Date.now()){sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_EXP_KEY);setToken('');setExpiraEm('');setSessaoOk(false);setEnvios([]);return}let ativo=true;bridge({action:'status'},token).then(()=>{if(ativo){setSessaoOk(true);void carregarEnvios(token)}}).catch(()=>{if(!ativo)return;sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_EXP_KEY);setToken('');setExpiraEm('');setSessaoOk(false);setEnvios([])});return()=>{ativo=false}},[]);

  const docentesFreq=useMemo(()=>frequencias.filter(f=>ehDocente(f.cargo||'')),[frequencias]);
  const servidorPorRf=useMemo(()=>{const m=new Map<string,Servidor>();for(const s of servidores)m.set(dig(s.rf),s);return m},[servidores]);
  const nomesDuplicados=useMemo(()=>{const m=new Map<string,number>();for(const f of docentesFreq)m.set(norm(f.nome),(m.get(norm(f.nome))??0)+1);return m},[docentesFreq]);
  const linhas=useMemo<Linha[]>(()=>docentesFreq.map(freq=>{const servidor=servidorPorRf.get(dig(freq.rf))??{rf:freq.rf,nome:freq.nome,cargo:freq.cargo||'',periodo:'',escola:freq.local_trabalho||SCHOOL,ativo:true,turma_atribuida:'',sala_atribuida:''};const ts=turmasDoServidor(servidor,turmas);return{servidor,frequencia:freq,turmas:ts,modalidade:modalidadeSugerida(servidor,freq,ts),vinculosMesmoNome:nomesDuplicados.get(norm(freq.nome))??1}}),[docentesFreq,servidorPorRf,turmas,nomesDuplicados]);
  const foraDaFrequencia=useMemo(()=>{const rfs=new Set(docentesFreq.map(f=>dig(f.rf)));return servidores.filter(s=>s.ativo&&ehDocente(s.cargo)&&!rfs.has(dig(s.rf)))},[servidores,docentesFreq]);
  const filtradas=useMemo(()=>{const q=norm(busca);if(!q)return linhas;return linhas.filter(l=>norm([l.servidor.nome,l.servidor.rf,l.frequencia.cargo,l.frequencia.lotacao,l.turmas.map(t=>t.nome).join(' '),l.modalidade].join(' ')).includes(q))},[linhas,busca]);
  const enviosPorRf=useMemo(()=>{const m=new Map<string,EnvioStatus[]>();for(const e of envios){const rf=dig(e.rf),lista=m.get(rf)||[];lista.push(e);m.set(rf,lista)}for(const lista of m.values())lista.sort((a,b)=>new Date(b.criadoEm).getTime()-new Date(a.criadoEm).getTime());return m},[envios]);
  const enviosDaLinha=(l:Linha)=>enviosPorRf.get(dig(l.servidor.rf))||[];
  const totalEnviados=useMemo(()=>linhas.filter(l=>enviosPorRf.has(dig(l.servidor.rf))).length,[linhas,enviosPorRf]);

  const gradTiposOficiais=uniq(opcoes.graduacao.map(x=>x.tipo)),gradTipos=gradTiposOficiais.length?gradTiposOficiais:[...TIPOS_SUPERIOR];
  const posAreasOficiais=uniq(opcoes.pos.map(x=>x.area)),posAreas=posAreasOficiais.length?posAreasOficiais:[...AREAS_POS];
  const instUfsOficiais=uniq(opcoes.instituicoes.map(x=>x.uf)),instUfs=instUfsOficiais.length?instUfsOficiais:[...UFS];
  const areasGrad=(c:CursoSuperior)=>uniq(opcoes.graduacao.filter(x=>txt(x.tipo)===c.tipo).map(x=>x.area));
  const cursosGrad=(c:CursoSuperior)=>uniq(opcoes.graduacao.filter(x=>txt(x.tipo)===c.tipo&&txt(x.area)===c.area).map(x=>x.curso));
  const categoriasInst=(c:CursoSuperior)=>uniq(opcoes.instituicoes.filter(x=>txt(x.uf)===c.ufInstituicao).map(x=>x.categoria||x.org));
  const instituicoesInst=(c:CursoSuperior)=>uniq(opcoes.instituicoes.filter(x=>txt(x.uf)===c.ufInstituicao&&txt(x.categoria||x.org)===c.categoriaOrg).map(x=>x.nome));

  const desbloquear=async()=>{if(!username||!senha){setAviso('Informe novamente sua senha do Diário para liberar a integração direta.');return}setDesbloqueando(true);setAviso('');try{const data=await bridge({action:'auth',username,password:senha},'');sessionStorage.setItem(TOKEN_KEY,data.token);sessionStorage.setItem(TOKEN_EXP_KEY,data.expiraEm);setToken(data.token);setExpiraEm(data.expiraEm);setSessaoOk(true);await carregarEnvios(data.token);setSenha('');setAviso('Integração direta segura liberada nesta sessão.')}catch(e:any){setAviso(e?.message||'Não foi possível liberar a integração.')}finally{setDesbloqueando(false)}};
  const bloquear=async()=>{try{if(token)await bridge({action:'logout'})}catch{}sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_EXP_KEY);setToken('');setExpiraEm('');setSessaoOk(false);setEnvios([]);setDraft(null);setLinhaEmEdicao(null);setFonteEducacenso(null);setRefFicha(null);setAvisoConsolidacao('');setAviso('Sessão segura do Censo encerrada.')};
  const mudarCompetencia=async(value:string)=>{const [ano,mes]=value.split('-').map(Number);const proxima=competencias.find(c=>c.ano===ano&&c.mes===mes);if(!proxima)return;setLoading(true);setErro('');const freq=await supabase.from('CensoFrequenciaServidor').select('ano,mes,rf,nome,categoria,lotacao,cargo,carga_horaria,local_trabalho,pagina_pdf').eq('ano',ano).eq('mes',mes).order('pagina_pdf');if(freq.error)setErro(`Erro ao carregar a frequência: ${freq.error.message}`);else{setCompetencia(proxima);setFrequencias((freq.data??[])as Frequencia[]);setDraft(null);setLinhaEmEdicao(null);setResultado(null);setAvisoConsolidacao('')}setLoading(false)};
  const prepararDireto=async(l:Linha)=>{if(!sessaoOk||!token){setAviso('Desbloqueie primeiro a integração direta segura com sua senha do Diário.');document.getElementById('censo-seguranca')?.scrollIntoView({behavior:'smooth',block:'center'});return}if(!competencia){setAviso('Não há competência de frequência disponível para validar este vínculo.');return}setPreparandoRf(l.servidor.rf);setAviso('');setAvisoConsolidacao('');setResultado(null);setConfirmacao(false);setFonteEducacenso(null);setRefFicha(null);try{const data=await bridge({action:'prepare',rf:dig(l.servidor.rf),competencia}) as PrepareResponse;let base:EducacensoLookup|null=null;const cpf=dig(data.official?.cpf||data.local?.ficha?.dados?.cpf||data.local?.profile?.cpf);if(cpf.length===11){try{base=await educacensoLookup(cpf);setAvisoConsolidacao(base.avisoConsolidacao||(!base.registro?'CPF não localizado na fotografia atual do Educacenso. Os campos exclusivos dessa base permanecem em branco para conferência manual.':''))}catch(e:any){setAviso(`Cadastro preparado, mas a fotografia do Educacenso não pôde ser consultada: ${e?.message||'erro de consulta'}.`)}}else setAvisoConsolidacao('CPF de 11 dígitos não disponível. Sexo, deficiência, cursos de 80 horas e demais campos exclusivos do Educacenso permanecem em branco para conferência manual.');setLinhaEmEdicao(l);setOpcoes(data.opcoesOficiais||EMPTY_OPTIONS);setDraft(construirDraft(l,data,base));setFonteMatch(data.local?.profileMatch||'ficha consolidada');setRefFicha(referenciaFicha(data));if(base?.registro)setFonteEducacenso({referenciaData:base.registro.referencia_data||base.referenciaData||'',arquivoNome:base.registro.arquivo_nome||base.arquivoNome||'',match:base.match||'cpf'});setTimeout(()=>document.getElementById('censo-direto-editor')?.scrollIntoView({behavior:'smooth',block:'start'}),50)}catch(e:any){setAviso(e?.message||'Não foi possível preparar este vínculo.')}finally{setPreparandoRf('')}};

  const patch=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(d=>d?({...d,[key]:value}):d);
  const toggleDef=(value:string)=>{if(!draft)return;let next=draft.deficiencias.includes(value)?draft.deficiencias.filter(x=>x!==value):[...draft.deficiencias,value];if(value==='Não possuo deficiência'&&!draft.deficiencias.includes(value))next=['Não possuo deficiência'];if(value!=='Não possuo deficiência')next=next.filter(x=>x!=='Não possuo deficiência');patch('deficiencias',next)};
  const toggleCursoEspecifico=(value:string)=>{if(!draft)return;let next=draft.cursosEspecificos.includes(value)?draft.cursosEspecificos.filter(x=>x!==value):[...draft.cursosEspecificos,value];if(value==='Nenhum'&&!draft.cursosEspecificos.includes(value))next=['Nenhum'];if(value!=='Nenhum')next=next.filter(x=>x!=='Nenhum');patch('cursosEspecificos',next)};
  const atualizarCurso=(i:number,novo:Partial<CursoSuperior>)=>{if(!draft)return;patch('cursosSuperiores',draft.cursosSuperiores.map((c,idx)=>idx===i?({...c,...novo}):c))};
  const atualizarPos=(i:number,novo:Partial<PosGraduacao>)=>{if(!draft)return;patch('posGraduacoes',draft.posGraduacoes.map((c,idx)=>idx===i?({...c,...novo}):c))};
  const validarDraft=()=>{if(!draft)return['Cadastro não preparado'];const faltam:string[]=[];if(draft.unidadeEscolar!==SCHOOL)faltam.push('Unidade Escolar');if(!draft.modalidade)faltam.push('Modalidade');if(dig(draft.cpf).length!==11)faltam.push('CPF');if(!draft.dataNasc)faltam.push('Data Nasc.');if(!draft.email)faltam.push('E-mail');if(!draft.grauFormacao)faltam.push('Grau de Formação');if(typeof draft.possuiPos!=='boolean')faltam.push('Situação da Pós-Graduação');if(draft.possuiPos===true){if(!draft.posGraduacoes.length)faltam.push('Pós-Graduação');draft.posGraduacoes.forEach((p,i)=>{if(!p.tipo)faltam.push(`Tipo da ${i+1}ª Pós`);if(!p.area)faltam.push(`Área da ${i+1}ª Pós`);if(!/^\d{4}$/.test(p.ano))faltam.push(`Ano da ${i+1}ª Pós`)})}return [...new Set(faltam)]};
  const enviarDireto=async()=>{if(!draft||!linhaEmEdicao||!competencia)return;const faltam=validarDraft();if(faltam.length){setAviso(`Antes de enviar, revise: ${faltam.join(', ')}.`);return}if(!confirmacao){setAviso('Marque a declaração de conferência antes do envio oficial.');return}setEnviando(true);setAviso('');setResultado(null);try{const data=await bridge({action:'submit',dados:draft,competencia,confirmacaoFinal:true,requestId:crypto.randomUUID()});setResultado(data.result??data);await carregarEnvios();setConfirmacao(false);setAviso('Envio concluído pelo canal direto. O retorno oficial foi registrado para auditoria.')}catch(e:any){setAviso(e?.message||'Falha no envio. Nada deve ser reenviado sem conferir o aviso.')}finally{setEnviando(false)}};

  if(loading)return<Loading/>;
  const expiraLabel=expiraEm?new Date(expiraEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'',faltamDraft=draft?validarDraft():[];

  return<div style={{marginTop:4}}>
    <section style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:theme.radiusMd,boxShadow:theme.shadow,padding:20,marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h1 style={{margin:0,color:theme.text,fontSize:24}}>👩‍🏫 Censo Docentes 2026</h1><p style={{color:theme.textSecondary,margin:'7px 0 0',maxWidth:900,lineHeight:1.55}}>Formulário oficial espelhado com pré-preenchimento pela fotografia atual do Educacenso, ficha cadastral e perfil local, sempre com conferência antes do envio.</p></div><span style={{color:sessaoOk?theme.success:theme.warning,fontWeight:850,fontSize:11}}>{sessaoOk?'🔐 Integração direta segura ativa':'🔒 Integração direta bloqueada'}</span></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end',marginTop:15}}><a href={FORM_URL} target="_blank" rel="noopener noreferrer" style={{...btn('ghost'),textDecoration:'none'}}>Abrir formulário oficial</a>{competencia&&<label style={{display:'grid',gap:4,color:theme.textSecondary,fontSize:10.5,fontWeight:800}}>Competência da frequência<select style={{...input,minWidth:170}} value={`${competencia.ano}-${competencia.mes}`} onChange={e=>void mudarCompetencia(e.target.value)}>{competencias.map(c=><option key={`${c.ano}-${c.mes}`} value={`${c.ano}-${c.mes}`}>{formatCompetencia(c)}</option>)}</select></label>}</div>
      {aviso&&<div style={{marginTop:11,padding:10,borderRadius:8,background:'var(--ghost-bg)',border:`1px solid ${theme.border}`,color:theme.text,fontSize:11.5}}>{aviso}</div>}
      {erro&&<div style={{marginTop:11,padding:10,borderRadius:8,background:`${theme.danger}12`,border:`1px solid ${theme.danger}44`,color:theme.danger,fontSize:11.5}}>{erro}</div>}
    </section>

    <section id="censo-seguranca" style={{background:theme.card,border:`1px solid ${sessaoOk?theme.success:theme.warning}55`,borderRadius:theme.radiusMd,boxShadow:theme.shadow,padding:15,marginBottom:14}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><div style={{color:theme.text,fontWeight:900,fontSize:14}}>🔐 Canal direto protegido</div><div style={{color:theme.textSecondary,fontSize:11.5,marginTop:4}}>Busca por RF, opções oficiais em tempo real, Educacenso histórico e ficha cadastral.</div></div>{sessaoOk?<div style={{display:'flex',gap:8,alignItems:'center'}}><span style={{color:theme.success,fontSize:11.5,fontWeight:800}}>Ativa até {expiraLabel}</span><button style={btn('ghost',{small:true})} onClick={bloquear}>Encerrar sessão segura</button></div>:<div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><input type="password" autoComplete="current-password" style={{...input,width:220}} value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void desbloquear()}} placeholder="Senha do Diário"/><button style={btn('primary')} disabled={desbloqueando||!senha} onClick={desbloquear}>{desbloqueando?'Liberando...':'Liberar integração direta'}</button></div>}</div></section>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:9,marginBottom:14}}><Resumo titulo="Folhas de frequência" valor={frequencias.length} cor={theme.primaryText} sub={competencia?formatCompetencia(competencia):'Sem competência'}/><Resumo titulo="Vínculos docentes" valor={linhas.length} cor={theme.success} sub="Base principal"/><Resumo titulo="Enviados" valor={totalEnviados} cor={theme.success} sub={`${totalEnviados}/${linhas.length} vínculos`}/><Resumo titulo="Fora da frequência" valor={foraDaFrequencia.length} cor={foraDaFrequencia.length?theme.warning:theme.success} sub="Cadastro ativo, sem folha"/></div>
    <section style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:theme.radiusMd,boxShadow:theme.shadow,padding:13,marginBottom:14}}><input style={{...input,width:'100%'}} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar professor, RF, cargo, turma..."/></section>
    <section style={{background:theme.card,border:`1px solid ${theme.border}`,borderRadius:theme.radiusMd,boxShadow:theme.shadow,overflow:'hidden'}}><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:1000}}><thead><tr style={{background:'var(--ghost-bg)'}}>{['Professor','RF','Frequência','Período','Turma/atuação','Modalidade sugerida','Ação'].map(h=><th key={h} style={{padding:'11px 8px',textAlign:'left',color:theme.textSecondary,fontSize:10.5,borderBottom:`1px solid ${theme.border}`}}>{h}</th>)}</tr></thead><tbody>{filtradas.map((l,idx)=>{const enviosLinha=enviosDaLinha(l),envio=enviosLinha[0]||null;return <tr key={`${l.servidor.rf}-${l.servidor.nome}`} style={{borderBottom:`1px solid ${envio?theme.success:theme.borderLight}`,background:envio?`${theme.success}12`:(idx%2===0?'var(--row-even)':'var(--row-odd)')}}><td style={{padding:'10px 8px',fontSize:12,color:theme.text}}><strong>{l.servidor.nome}</strong>{envio&&<div style={{color:theme.success,fontSize:10,fontWeight:900,marginTop:3}}>✅ ENVIADO · {formatDataHora(envio.criadoEm)} · {enviosLinha.map(e=>e.modalidade).join(' · ')}</div>}<div style={{color:theme.textMuted,fontSize:9.5,marginTop:3}}>{l.frequencia.cargo||l.servidor.cargo}</div>{l.vinculosMesmoNome>1&&<div style={{color:theme.warning,fontSize:9.5,fontWeight:800}}>⚠️ {l.vinculosMesmoNome} RFs — tratar por vínculo</div>}</td><td style={{padding:'10px 8px',fontWeight:850,color:theme.text}}>{formatRf(l.servidor.rf)}</td><td style={{padding:'10px 8px',color:theme.success,fontSize:11}}>✓ pág. {l.frequencia.pagina_pdf??'—'}</td><td style={{padding:'10px 8px',color:theme.textSecondary,fontSize:11}}>{l.servidor.periodo||'—'}</td><td style={{padding:'10px 8px',color:theme.textSecondary,fontSize:11}}>{l.turmas.length?l.turmas.map(t=>t.nome).join(', '):'⚠️ conferir'}</td><td style={{padding:'10px 8px',color:l.modalidade?theme.textSecondary:theme.warning,fontSize:11}}>{l.modalidade||'conferir'}</td><td style={{padding:'10px 8px'}}>{envio?<div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}><span style={{padding:'6px 9px',borderRadius:999,background:`${theme.success}18`,border:`1px solid ${theme.success}55`,color:theme.success,fontWeight:900,fontSize:10.5}}>✅ ENVIADO</span>{enviosLinha.filter(e=>e.comprovanteUrl).map((e,i)=><a key={`${e.modalidade}-${e.criadoEm}`} href={e.comprovanteUrl} target="_blank" rel="noopener noreferrer" style={{...btn('ghost',{small:true}),textDecoration:'none'}}>📄 Comprovante {enviosLinha.length>1?i+1:''}</a>)}<button style={btn('ghost',{small:true})} disabled={preparandoRf===l.servidor.rf} onClick={()=>prepararDireto(l)}>Revisar</button></div>:<button style={btn('primary',{small:true})} disabled={preparandoRf===l.servidor.rf} onClick={()=>prepararDireto(l)}>{preparandoRf===l.servidor.rf?'Preparando...':'Preparar direto'}</button>}</td></tr>})}</tbody></table></div></section>

    {draft&&linhaEmEdicao&&<section id="censo-direto-editor" style={{marginTop:16,background:theme.card,border:`2px solid ${theme.primaryText}`,borderRadius:theme.radiusMd,boxShadow:theme.shadow,padding:17}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><div><h2 style={{margin:0,color:theme.text,fontSize:19}}>Conferência oficial — {draft.nome}</h2><div style={{marginTop:5,color:theme.textSecondary,fontSize:11.5}}>RF <strong>{formatRf(draft.rf)}</strong> · CPF {maskCpf(draft.cpf)} · fonte local: {fonteMatch||'consolidada'}{fonteEducacenso&&<> · <strong style={{color:theme.success}}>Educacenso {formatDataBR(fonteEducacenso.referenciaData)} ({fonteEducacenso.match.toUpperCase()})</strong></>}</div></div><button style={btn('ghost',{small:true})} onClick={()=>{setDraft(null);setLinhaEmEdicao(null);setResultado(null);setFonteEducacenso(null);setRefFicha(null);setAvisoConsolidacao('')}}>Fechar</button></div>
      <div style={{marginTop:11,padding:10,borderRadius:8,background:`${theme.warning}0F`,border:`1px solid ${theme.warning}55`,color:theme.textSecondary,fontSize:11.5,lineHeight:1.5}}><strong style={{color:theme.text}}>Conferência humana:</strong> dados de Educacenso e ficha são pré-preenchimentos para conferência; qualquer divergência pode ser corrigida antes do envio.</div>
      {fonteEducacenso&&<div style={{marginTop:8,padding:10,borderRadius:8,background:`${theme.success}0F`,border:`1px solid ${theme.success}55`,color:theme.textSecondary,fontSize:11.5,lineHeight:1.5}}><strong style={{color:theme.success}}>✓ Base Educacenso aplicada:</strong> Sexo, Cor/Raça, Nacionalidade, Grau de Formação e cursos de 80h são aproveitados quando presentes na fotografia de {formatDataBR(fonteEducacenso.referenciaData)}. A pós-graduação é preenchida automaticamente quando existe registro estruturado validado (Tipo/Área/Ano) na base acadêmica, ou quando a fotografia do Educacenso já traz Tipo e Área oficiais; nos demais casos, fica em branco para conferência manual.</div>}
      {avisoConsolidacao&&<div style={{marginTop:8,padding:10,borderRadius:8,background:`${theme.warning}0F`,border:`1px solid ${theme.warning}66`,color:theme.textSecondary,fontSize:11.5,lineHeight:1.5}}><strong style={{color:theme.warning}}>⚠ Conferência necessária:</strong> {avisoConsolidacao}</div>}
      {refFicha&&<div style={{marginTop:8,padding:10,borderRadius:8,background:'var(--ghost-bg)',border:`1px solid ${theme.border}`,color:theme.textSecondary,fontSize:11.5,lineHeight:1.5}}><strong style={{color:theme.text}}>✓ Ficha cadastral aplicada:</strong> formação, instituição e ano de conclusão são associados às listas oficiais quando há correspondência segura.{refFicha.formacoes.length?<> Formação registrada: <strong>{refFicha.formacoes.join(' · ')}</strong>.</>:null}{refFicha.universidades.length?<> Instituição(ões): <strong>{refFicha.universidades.join(' · ')}</strong>.</>:null}{refFicha.anos.length?<> Ano(s) encontrado(s): <strong>{refFicha.anos.join(' · ')}</strong>.</>:null}</div>}

      <h3 style={{color:theme.text,fontSize:14,margin:'16px 0 9px'}}>1. Dados da instituição e pessoais</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:9}}>
        <Field labelText="Unidade Escolar de Preenchimento *" value={draft.unidadeEscolar} readOnly/><div><SelectField labelText="Modalidade *" value={draft.modalidade} onChange={v=>patch('modalidade',v)} options={MODALIDADES}/><div style={{marginTop:4,color:theme.textMuted,fontSize:10}}>Sugestão automática: <strong>{linhaEmEdicao.modalidade||'sem sugestão segura'}</strong>. Selecione para confirmar.</div></div><Field labelText="Nome Completo" value={draft.nome} onChange={v=>patch('nome',v)}/><Field labelText="CPF *" value={draft.cpf} readOnly/><Field labelText="Data Nasc. *" value={draft.dataNasc} onChange={v=>patch('dataNasc',v)} type="date"/><SelectField labelText="Sexo" value={draft.sexo} onChange={v=>patch('sexo',v)} options={SEXOS}/><SelectField labelText="Cor/Raça" value={draft.corRaca} onChange={v=>patch('corRaca',v)} options={CORES_RACAS}/><Field labelText="Telefone/Celular" value={draft.telefone} onChange={v=>patch('telefone',v)}/><Field labelText="E-mail *" value={draft.email} onChange={v=>patch('email',v)} type="email"/><Field labelText="Filiação 1" value={draft.nomeMae} onChange={v=>patch('nomeMae',v)}/><Field labelText="Filiação 2" value={draft.nomePai} onChange={v=>patch('nomePai',v)}/><SelectField labelText="Nacionalidade" value={draft.nacionalidade} onChange={v=>patch('nacionalidade',v)} options={NACIONALIDADES}/>{draft.nacionalidade==='Estrangeiro(a)'&&<Field labelText="País" value={draft.paisEstrangeiro} onChange={v=>patch('paisEstrangeiro',v)}/>}<Field labelText="Naturalidade (Cidade)" value={draft.naturalidade} onChange={v=>patch('naturalidade',v)}/><SelectField labelText="UF Nascimento" value={draft.ufNascimento} onChange={v=>patch('ufNascimento',v)} options={UFS}/>
      </div>
      {!draft.ufNascimento&&draft.naturalidade&&<div style={{marginTop:7,color:theme.textMuted,fontSize:10.5}}>UF de nascimento não existe na relação atual do Educacenso nem na ficha cadastrada. A naturalidade foi trazida para conferência, mas a UF permanece manual para não ser presumida.</div>}

      <h3 style={{color:theme.text,fontSize:14,margin:'16px 0 9px'}}>2. Endereço residencial</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:9}}><Field labelText="CEP" value={draft.cep} onChange={v=>patch('cep',v)}/><Field labelText="Rua/Avenida" value={draft.rua} onChange={v=>patch('rua',v)}/><Field labelText="Nº/Complemento" value={draft.numero} onChange={v=>patch('numero',v)}/><Field labelText="Bairro" value={draft.bairro} onChange={v=>patch('bairro',v)}/><Field labelText="Município" value={draft.municipio} onChange={v=>patch('municipio',v)}/><SelectField labelText="UF" value={draft.uf} onChange={v=>patch('uf',v)} options={UFS}/></div>

      <h3 style={{color:theme.text,fontSize:14,margin:'16px 0 9px'}}>3. Deficiência / TEA / Altas Habilidades</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:6}}>{DEFICIENCIAS.map(d=><label key={d} style={{display:'flex',alignItems:'center',gap:7,padding:'7px 8px',borderRadius:7,border:`1px solid ${theme.border}`,color:theme.textSecondary,fontSize:11.5,cursor:'pointer'}}><input type="checkbox" checked={draft.deficiencias.includes(d)} onChange={()=>toggleDef(d)}/>{d}</label>)}</div>

      <h3 style={{color:theme.text,fontSize:14,margin:'16px 0 9px'}}>4. Escolaridade e pós-graduação</h3><SelectField labelText="Maior Grau de Formação *" value={draft.grauFormacao} onChange={v=>patch('grauFormacao',v)} options={GRAUS}/>
      <div style={{marginTop:12,color:theme.textSecondary,fontSize:11.5,fontWeight:850}}>Curso(s) Superior(es) — máximo 3</div><div style={{display:'grid',gap:8,marginTop:7}}>{draft.cursosSuperiores.map((c,i)=><div key={i} style={{border:`1px solid ${theme.border}`,borderRadius:8,padding:10,background:'var(--ghost-bg)'}}><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:7}}><SelectField labelText="1º Tipo" value={c.tipo} onChange={v=>atualizarCurso(i,{tipo:v,area:'',curso:''})} options={gradTipos}/><SelectField labelText="2º Área" value={c.area} onChange={v=>atualizarCurso(i,{area:v,curso:''})} options={areasGrad(c)} disabled={!c.tipo}/><SelectField labelText="3º Curso" value={c.curso} onChange={v=>atualizarCurso(i,{curso:v})} options={cursosGrad(c)} disabled={!c.area}/><Field labelText="Ano Conclusão" value={c.ano} onChange={v=>atualizarCurso(i,{ano:v})}/><SelectField labelText="4º UF Inst." value={c.ufInstituicao} onChange={v=>atualizarCurso(i,{ufInstituicao:v,categoriaOrg:'',instituicao:''})} options={instUfs}/><SelectField labelText="5º Categoria / Org." value={c.categoriaOrg} onChange={v=>atualizarCurso(i,{categoriaOrg:v,instituicao:''})} options={categoriasInst(c)} disabled={!c.ufInstituicao}/><SelectField labelText="6º Nome da Instituição" value={c.instituicao} onChange={v=>atualizarCurso(i,{instituicao:v})} options={instituicoesInst(c)} disabled={!c.categoriaOrg}/></div><label style={{display:'flex',gap:7,alignItems:'center',color:theme.textSecondary,fontSize:11,marginTop:8}}><input type="checkbox" checked={c.entregue} onChange={e=>atualizarCurso(i,{entregue:e.target.checked})}/>Cópia entregue nesta UE</label><button style={{...btn('ghost',{small:true}),marginTop:7}} onClick={()=>patch('cursosSuperiores',draft.cursosSuperiores.filter((_,idx)=>idx!==i))}>Remover curso</button></div>)}{draft.cursosSuperiores.length<3&&<button style={btn('ghost',{small:true})} onClick={()=>patch('cursosSuperiores',[...draft.cursosSuperiores,cursoSuperiorVazio()])}>+ Adicionar Curso Superior</button>}</div>

      <div style={{marginTop:13,maxWidth:430}}><SelectField labelText="Situação da Pós-Graduação *" value={draft.possuiPos===null?'':draft.possuiPos?'Possui pós-graduação concluída':'Não possui pós-graduação concluída'} onChange={v=>{const possui=v==='Possui pós-graduação concluída'?true:v==='Não possui pós-graduação concluída'?false:null;patch('possuiPos',possui);patch('posGraduacoes',possui?(draft.posGraduacoes.length?draft.posGraduacoes:[posVazia()]):[])}} options={['Possui pós-graduação concluída','Não possui pós-graduação concluída']} placeholder="Confirme a situação..."/></div>
      {draft.possuiPos===true&&<div style={{display:'grid',gap:8,marginTop:8}}>{draft.posGraduacoes.map((c,i)=><div key={i} style={{border:`1px solid ${theme.border}`,borderRadius:8,padding:10,background:'var(--ghost-bg)'}}><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:7}}><SelectField labelText="Tipo *" value={c.tipo} onChange={v=>atualizarPos(i,{tipo:v})} options={TIPOS_POS}/><SelectField labelText="Área *" value={c.area} onChange={v=>atualizarPos(i,{area:v})} options={posAreas}/><Field labelText="Ano Conclusão *" value={c.ano} onChange={v=>atualizarPos(i,{ano:v})}/></div><label style={{display:'flex',gap:7,alignItems:'center',color:theme.textSecondary,fontSize:11,marginTop:8}}><input type="checkbox" checked={c.entregue} onChange={e=>atualizarPos(i,{entregue:e.target.checked})}/>Cópia entregue nesta UE</label><button style={{...btn('ghost',{small:true}),marginTop:7}} onClick={()=>patch('posGraduacoes',draft.posGraduacoes.filter((_,idx)=>idx!==i))}>Remover pós</button></div>)}{draft.posGraduacoes.length<6&&<button style={btn('ghost',{small:true})} onClick={()=>patch('posGraduacoes',[...draft.posGraduacoes,posVazia()])}>+ Adicionar Pós-Graduação</button>}</div>}

      <div style={{marginTop:15,color:theme.textSecondary,fontSize:11.5,fontWeight:850}}>Outros cursos específicos — formação continuada com no mínimo 80 horas</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:6,marginTop:7}}>{CURSOS_ESPECIFICOS.map(c=><label key={c} style={{display:'flex',alignItems:'center',gap:7,padding:'7px 8px',borderRadius:7,border:`1px solid ${theme.border}`,color:theme.textSecondary,fontSize:11.5,cursor:'pointer'}}><input type="checkbox" checked={draft.cursosEspecificos.includes(c)} onChange={()=>toggleCursoEspecifico(c)}/>{c}</label>)}</div>

      <div style={{marginTop:15,padding:12,borderRadius:8,border:`1px solid ${faltamDraft.length?theme.warning:theme.success}55`,background:`${faltamDraft.length?theme.warning:theme.success}0F`}}><div style={{color:faltamDraft.length?theme.warning:theme.success,fontSize:11.5,fontWeight:850}}>{faltamDraft.length?`Pendências exigidas pelo formulário oficial: ${faltamDraft.join(' · ')}`:'✓ Campos obrigatórios do formulário oficial conferidos.'}</div><label style={{display:'flex',gap:8,alignItems:'flex-start',color:theme.text,fontSize:12,marginTop:10,lineHeight:1.45,cursor:'pointer'}}><input type="checkbox" checked={confirmacao} onChange={e=>setConfirmacao(e.target.checked)} style={{marginTop:2}}/><span><strong>Declaro que as informações apresentadas neste formulário são autodeclaradas e assumo total responsabilidade pela veracidade dos dados fornecidos.</strong></span></label><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button style={btn('success')} disabled={enviando||faltamDraft.length>0||!confirmacao} onClick={enviarDireto}>{enviando?'Enviando...':'✅ Salvar e enviar ao formulário oficial'}</button><a href={FORM_URL} target="_blank" rel="noopener noreferrer" style={{...btn('ghost'),textDecoration:'none'}}>Abrir formulário manual</a></div></div>
      {resultado&&<div style={{marginTop:12,padding:12,borderRadius:8,border:`1px solid ${theme.success}55`,background:`${theme.success}10`,color:theme.textSecondary,fontSize:11.5}}><strong style={{color:theme.success}}>✓ Retorno oficial recebido.</strong>{typeof resultado==='string'&&/^https?:\/\//i.test(resultado)?<div style={{marginTop:7}}><a href={resultado} target="_blank" rel="noopener noreferrer" style={{color:theme.primaryText,fontWeight:800}}>Abrir comprovante/PDF oficial</a></div>:<div style={{marginTop:7}}>O retorno foi registrado na auditoria interna.</div>}</div>}
    </section>}
  </div>;
}
